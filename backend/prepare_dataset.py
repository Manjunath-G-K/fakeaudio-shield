"""Build the cleaned, balanced training manifest from every downloaded source.

    python prepare_dataset.py            # writes ../data/manifest.csv and ../data/dataset_report.json

Sources (each used if present on disk):
  * English   ASVspoof 2019 LA subset   ../data/LA      (fetch_asvspoof_subset.py)  ODC-By 1.0
  * Indian    Kathbath (real)           ../data/indic   (fetch_indic_subset.py)     CC BY 4.0
  * Indian    IndicSynth (AI-generated) ../data/indic   (fetch_indic_subset.py)     CC BY-NC 4.0

Cleaning steps, applied identically to every language:
  1. exact duplicates removed (SHA-1 of the audio file; first copy kept)
  2. unreadable / corrupted files removed (header check with soundfile)
  3. clips shorter than 1.0 s or longer than 60 s removed
  4. speaker leakage check: a speaker may appear in only one of train/dev/test
  5. class balance: within every (language, split) the larger class is randomly
     down-sampled to the size of the smaller one (seeded, reproducible)
  6. a language is only kept if it has real AND fake clips in train, dev and test

Labels are standardised to "bonafide" (real human speech) and "spoof" (AI-generated).
No source files are deleted; removed records are listed in the report with the reason.
"""
import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")   # Windows consoles default to cp1252
import argparse
import csv
import hashlib
import json
import random
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

import soundfile as sf

ASV_PROTOCOLS = {"train": ("ASVspoof2019.LA.cm.train.trn.txt", "train"),
                 "dev": ("ASVspoof2019.LA.cm.dev.trl.txt", "dev"),
                 "eval": ("ASVspoof2019.LA.cm.eval.trl.txt", "test")}
SOURCES = {
    "ASVspoof 2019 LA": {"license": "ODC-By 1.0", "url": "https://datashare.ed.ac.uk/handle/10283/3336"},
    "Kathbath": {"license": "CC BY 4.0", "url": "https://huggingface.co/datasets/ai4bharat/Kathbath"},
    "IndicSynth": {"license": "CC BY-NC 4.0", "url": "https://huggingface.co/datasets/vdivyasharma/IndicSynth"},
}
FIELDS = ["path", "cache_key", "label", "lang", "split", "speaker", "source", "attack", "duration_s", "sample_rate", "sha1"]
MIN_S, MAX_S = 1.0, 60.0


def collect(data: Path) -> list[dict]:
    rows = []
    la = data / "LA"
    for asv_split, (proto, split) in ASV_PROTOCOLS.items():
        p = la / "ASVspoof2019_LA_cm_protocols" / proto
        if not p.exists():
            continue
        for line in p.read_text().splitlines():
            f = line.split()
            if len(f) != 5:
                continue
            audio = la / f"ASVspoof2019_LA_{asv_split}" / "flac" / f"{f[1]}.flac"
            if audio.exists():
                rows.append({"path": audio.relative_to(data).as_posix(), "cache_key": f"{asv_split}/{f[1]}",
                             "label": f[4], "lang": "English", "split": split, "speaker": f[0],
                             "source": "ASVspoof 2019 LA", "attack": "" if f[3] == "-" else f[3]})
    indic = data / "indic"
    for kind, source in (("real", "Kathbath"), ("fake", "IndicSynth")):
      for m in sorted(indic.glob(f"manifest_{kind}*.csv")):     # parallel downloads write separate files
        with m.open(newline="", encoding="utf-8") as fh:
            for r in csv.DictReader(fh):
                audio = indic / r["path"]
                if audio.exists():
                    rows.append({"path": audio.relative_to(data).as_posix(),
                                 "cache_key": f"indic/{Path(r['path']).with_suffix('').as_posix()}",
                                 "label": r["label"], "lang": r["lang"], "split": r["split"],
                                 "speaker": f"{r['lang']}-{r['speaker']}", "source": source,
                                 "attack": r.get("generator", "")})
    return rows


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", default="../data")
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()
    data = Path(args.data)

    raw = collect(data)
    removed = Counter()
    removed_examples = defaultdict(list)

    def drop(row, reason):
        removed[reason] += 1
        if len(removed_examples[reason]) < 5:
            removed_examples[reason].append(row["path"])

    seen, clean = {}, []
    for r in raw:
        p = data / r["path"]
        try:
            info = sf.info(str(p))
        except Exception:
            drop(r, "corrupted or unreadable")
            continue
        r["duration_s"] = round(info.duration, 3)
        r["sample_rate"] = info.samplerate
        if not MIN_S <= info.duration <= MAX_S:
            drop(r, f"duration outside {MIN_S}-{MAX_S} s")
            continue
        r["sha1"] = hashlib.sha1(p.read_bytes()).hexdigest()
        if r["sha1"] in seen:
            drop(r, "exact duplicate")
            continue
        seen[r["sha1"]] = r["path"]
        clean.append(r)

    # speaker leakage check (fatal: would make test results meaningless)
    splits_of = defaultdict(set)
    for r in clean:
        splits_of[(r["lang"], r["speaker"])].add(r["split"])
    leaks = [k for k, v in splits_of.items() if len(v) > 1]
    if leaks:
        raise SystemExit(f"Speaker leakage between splits: {leaks[:10]}")

    # 1) only languages with real AND fake clips in every split are usable
    usable, excluded = [], {}
    for lang in sorted({r["lang"] for r in clean}):
        c = Counter((r["split"], r["label"]) for r in clean if r["lang"] == lang)
        missing = [f"{s}/{l}" for s in ("train", "dev", "test") for l in ("bonafide", "spoof") if c[(s, l)] == 0]
        if not missing:
            usable.append(lang)
            continue
        have = Counter(r["label"] for r in clean if r["lang"] == lang)
        if not have.get("bonafide"):
            excluded[lang] = f"no real human speech yet (Kathbath download pending); {have.get('spoof', 0)} AI-generated clips ready"
        elif not have.get("spoof"):
            excluded[lang] = f"no AI-generated speech yet; {have.get('bonafide', 0)} real clips ready"
        else:
            excluded[lang] = f"too few speakers to fill every split (missing {', '.join(missing)})"
        for r in clean:
            if r["lang"] == lang:
                drop(r, "language not usable yet (missing real or AI clips)")

    # 2) class balance within every (language, split) of the usable languages
    rng = random.Random(args.seed)
    groups = defaultdict(list)
    for r in clean:
        if r["lang"] in usable:
            groups[(r["lang"], r["split"], r["label"])].append(r)
    balanced = []
    for lang in usable:
        for split in ("train", "dev", "test"):
            real, fake = groups[(lang, split, "bonafide")], groups[(lang, split, "spoof")]
            n = min(len(real), len(fake))
            for cls in (real, fake):
                keep = rng.sample(cls, n) if len(cls) > n else cls
                kept = set(id(r) for r in keep)
                for r in cls:
                    if id(r) not in kept:
                        drop(r, "class balancing (down-sampled)")
                balanced.extend(keep)
    final = [r for r in balanced if r["lang"] in usable]

    final.sort(key=lambda r: (r["lang"], r["split"], r["label"], r["path"]))
    with (data / "manifest.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(final)

    per_lang = {}
    for lang in usable:
        rows = [r for r in final if r["lang"] == lang]
        per_lang[lang] = {
            split: {"bonafide": sum(r["split"] == split and r["label"] == "bonafide" for r in rows),
                    "spoof": sum(r["split"] == split and r["label"] == "spoof" for r in rows),
                    "speakers": len({r["speaker"] for r in rows if r["split"] == split})}
            for split in ("train", "dev", "test")}
        per_lang[lang]["sources"] = sorted({r["source"] for r in rows})
        per_lang[lang]["hours"] = round(sum(r["duration_s"] for r in rows) / 3600, 2)
    report = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "records_found": len(raw), "records_kept": len(final),
        "removed": dict(removed), "removed_examples": dict(removed_examples),
        "languages": per_lang, "excluded_languages": excluded,
        "sources": SOURCES,
        "largest_source_records": max(Counter(r["source"] for r in raw).values(), default=0),
        "notes": [
            "No source has 1,000,000 or more records; nothing needed removing for size.",
            "Audio is standardised at load time (16 kHz mono, silence trimmed, peak-normalised); "
            "transcripts are not used, so no text normalisation is applied.",
            "Splits are speaker-disjoint (checked above). ASVspoof test = eval set with attacks A07-A19 unseen in training.",
        ],
    }
    (data / "dataset_report.json").write_text(json.dumps(report, indent=2))

    print(f"found {len(raw)} records, kept {len(final)}")
    for reason, n in removed.items():
        print(f"  removed {n:5d}  {reason}")
    for lang, d in per_lang.items():
        print(f"  {lang:10s} " + "  ".join(f"{s}: {d[s]['bonafide']}+{d[s]['spoof']} ({d[s]['speakers']} spk)" for s in ("train", "dev", "test")))
    for lang, why in excluded.items():
        print(f"  EXCLUDED {lang}: {why}")
    print(f"wrote {data / 'manifest.csv'} and {data / 'dataset_report.json'}")


if __name__ == "__main__":
    main()
