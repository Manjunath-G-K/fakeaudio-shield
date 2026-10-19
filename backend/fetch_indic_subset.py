"""Download a speaker-split sample of real and AI-generated speech in 7 Indian languages.

    python fetch_indic_subset.py --out ../data/indic --kind fake
    python fetch_indic_subset.py --out ../data/indic --kind real   # needs Hugging Face login

  fake : IndicSynth (vdivyasharma/IndicSynth, CC BY-NC 4.0) - XTTS-v2, VITS and FreeVC speech
         cloned from Kathbath / IndicSUPERB speakers
  real : Kathbath (ai4bharat/Kathbath, CC BY 4.0, gated) - the genuine recordings of that
         same speaker pool. Accept its terms on Hugging Face and run `hf auth login` first.

Both datasets are hundreds of GB and their files are sorted by speaker, so instead of
downloading files, individual rows at random positions are fetched through the Hugging Face
dataset viewer API. This spreads the sample over many speakers and generators.

Every clip is assigned to train / dev / test by its speaker (70 / 15 / 15), so test speakers
are never heard during training. Results are listed in <out>/manifest_fake.csv and
<out>/manifest_real.csv.
"""
import argparse
import csv
import hashlib
import json
import random
import threading
import time
import urllib.parse
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from huggingface_hub import get_token

LANGUAGES = ["Hindi", "Kannada", "Tamil", "Telugu", "Malayalam", "Marathi", "Bengali"]
ROWS_API = "https://datasets-server.huggingface.co/rows"
SOURCES = {
    # kind: (dataset, config name for a language, splits, audio column, speaker column)
    "fake": ("vdivyasharma/IndicSynth", lambda lang: lang, ["train"], "audio", "Target Speaker ID"),
    "real": ("ai4bharat/Kathbath", lambda lang: lang.lower(), ["train", "valid"], "audio_filepath", "speaker_id"),
}
FIELDS = ["path", "label", "lang", "split", "speaker", "gender", "generator", "source", "row"]


def speaker_split(lang: str, speaker) -> str:
    h = int(hashlib.md5(f"{lang}-{speaker}".encode()).hexdigest(), 16) % 100
    return "train" if h < 70 else "dev" if h < 85 else "test"


def get_json(url: str, token: str | None, retries: int = 8) -> dict:
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=120) as r:
                return json.load(r)
        except urllib.error.HTTPError as exc:
            if exc.code in (401, 403):
                raise SystemExit(
                    "Access denied by Hugging Face. For Kathbath: open "
                    "https://huggingface.co/datasets/ai4bharat/Kathbath, accept the terms, then run `hf auth login`."
                )
            err = exc
        except Exception as exc:
            err = exc
        time.sleep(min(60, 3 * 2 ** attempt))
    raise IOError(f"failed after {retries} attempts: {url} ({err})")


def download(url: str, dest: Path, retries: int = 8):
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                data = r.read()
            tmp = dest.with_suffix(".part")
            tmp.write_bytes(data)
            tmp.replace(dest)
            return
        except Exception as exc:
            err = exc
            time.sleep(min(60, 3 * 2 ** attempt))
    raise IOError(f"download failed: {err}")


def rows_url(dataset, config, split, offset, length=1):
    q = urllib.parse.urlencode({"dataset": dataset, "config": config, "split": split,
                                "offset": offset, "length": length})
    return f"{ROWS_API}?{q}"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default="../data/indic")
    ap.add_argument("--kind", choices=["fake", "real"], required=True)
    ap.add_argument("--per-language", type=int, default=300, help="clips per language")
    ap.add_argument("--languages", nargs="+", default=LANGUAGES)
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--tag", default="", help="write manifest_<kind>_<tag>.csv (lets two downloads run in parallel)")
    args = ap.parse_args()

    dataset, config_of, splits, audio_col, spk_col = SOURCES[args.kind]
    token = get_token()
    if args.kind == "real" and not token:
        raise SystemExit("Not logged in to Hugging Face. Accept the Kathbath terms, then run `hf auth login`.")

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    # separate files per kind (and per --tag) so several downloads can run at once
    manifest = out / f"manifest_{args.kind}{'_' + args.tag if args.tag else ''}.csv"
    done = set()
    for m in out.glob(f"manifest_{args.kind}*.csv"):          # skip rows any download already has
        with m.open(newline="", encoding="utf-8") as f:
            done |= {(r["source"], r["row"]) for r in csv.DictReader(f)}
    lock = threading.Lock()
    new_file = not manifest.exists()
    mf = manifest.open("a", newline="", encoding="utf-8")
    writer = csv.DictWriter(mf, fieldnames=FIELDS)
    if new_file:
        writer.writeheader()

    for lang in args.languages:
        config = config_of(lang)
        # sample row positions spread over every split of the source dataset
        totals = {s: get_json(rows_url(dataset, config, s, 0), token)["num_rows_total"] for s in splits}
        population = [(s, i) for s in splits for i in range(totals[s])]
        rng = random.Random(f"{args.seed}-{args.kind}-{lang}")
        picks = [p for p in rng.sample(population, args.per_language)
                 if (f"{dataset}/{config}/{p[0]}", str(p[1])) not in done]
        print(f"{lang}: {sum(totals.values())} rows available, fetching {len(picks)} "
              f"({args.per_language - len(picks)} already present)")
        folder = out / lang / args.kind
        folder.mkdir(parents=True, exist_ok=True)

        def work(pick):
            split, idx = pick
            row = get_json(rows_url(dataset, config, split, idx), token)["rows"][0]["row"]
            src = row[audio_col][0]["src"]
            ext = Path(urllib.parse.urlparse(src).path).suffix or ".wav"
            dest = folder / f"{split}_{idx}{ext}"
            download(src, dest)
            speaker = row.get(spk_col)
            rec = {
                "path": dest.relative_to(out).as_posix(),
                "label": "spoof" if args.kind == "fake" else "bonafide",
                "lang": lang,
                "split": speaker_split(lang, speaker),
                "speaker": speaker,
                "gender": row.get("Gender") or row.get("gender"),
                "generator": row.get("Generative Model", "") if args.kind == "fake" else "",
                "source": f"{dataset}/{config}/{split}",
                "row": idx,
            }
            with lock:
                writer.writerow(rec)
                mf.flush()
            return rec

        t0, recs = time.time(), []
        with ThreadPoolExecutor(args.workers) as pool:
            futures = [pool.submit(work, p) for p in picks]
            for n, fut in enumerate(as_completed(futures), 1):
                try:
                    recs.append(fut.result())
                except SystemExit:
                    raise
                except Exception as exc:
                    print(f"  skipped one clip: {exc}")
                if n % 50 == 0 or n == len(picks):
                    print(f"  {n}/{len(picks)} ({time.time() - t0:.0f} s)")
        print(f"  splits: {dict(Counter(r['split'] for r in recs))}  speakers: {len({r['speaker'] for r in recs})}"
              + (f"  generators: {dict(Counter(r['generator'] for r in recs))}" if args.kind == "fake" else ""))
    mf.close()
    print(f"Done. Manifest: {manifest.resolve()}")


if __name__ == "__main__":
    main()
