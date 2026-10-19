"""Download real Kathbath speech by reading whole Parquet row groups from the Hugging Face hub.

    python fetch_kathbath_parquet.py --languages Hindi Tamil Telugu Malayalam --row-groups 2

Faster alternative to fetch_indic_subset.py --kind real when the dataset-viewer row API is
rate-limiting (HTTP 429). Kathbath's train files store 100 clips per row group, with ~25-35
different speakers each, so a couple of row groups from different files give a sample spread
over many speakers. Writes the same layout and manifest format (manifest_real_parquet.csv);
speaker-disjoint splits are assigned by fetch_indic_subset.speaker_split.
Needs the Kathbath terms accepted and `hf auth login`.
"""
import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")   # Windows consoles default to cp1252
import argparse
import csv
import random
import time
from pathlib import Path

import pyarrow.parquet as pq
from huggingface_hub import HfFileSystem

from fetch_indic_subset import FIELDS, speaker_split


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default="../data/indic")
    ap.add_argument("--languages", nargs="+", required=True)
    ap.add_argument("--row-groups", type=int, default=2, help="row groups (100 clips each) per language")
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()

    fs = HfFileSystem()
    out = Path(args.out)
    manifest = out / "manifest_real_parquet.csv"
    new = not manifest.exists()
    mf = manifest.open("a", newline="", encoding="utf-8")
    writer = csv.DictWriter(mf, fieldnames=FIELDS)
    if new:
        writer.writeheader()

    for lang in args.languages:
        files = sorted(f for f in fs.glob(f"datasets/ai4bharat/Kathbath/{lang.lower()}/train-*.parquet"))
        rng = random.Random(f"{args.seed}-{lang}")
        picks = rng.sample(files, min(args.row_groups, len(files)))   # one row group from each of N different files
        folder = out / lang / "real"
        folder.mkdir(parents=True, exist_ok=True)
        n, speakers, t0 = 0, set(), time.time()
        for f in picks:
            pf = pq.ParquetFile(fs.open(f, block_size=8 << 20))
            g = rng.randrange(pf.metadata.num_row_groups)
            rows = pf.read_row_group(g, columns=["audio_filepath", "speaker_id", "gender"]).to_pylist()
            shard = Path(f).stem
            for i, r in enumerate(rows):
                audio = r["audio_filepath"]
                ext = Path(audio.get("path") or "x.flac").suffix or ".flac"
                dest = folder / f"pq_{shard}_{g}_{i}{ext}"
                dest.write_bytes(audio["bytes"])
                spk = r["speaker_id"]
                speakers.add(spk)
                writer.writerow({"path": dest.relative_to(out).as_posix(), "label": "bonafide", "lang": lang,
                                 "split": speaker_split(lang, spk), "speaker": spk, "gender": r.get("gender"),
                                 "generator": "", "source": f"ai4bharat/Kathbath/{lang.lower()}/{shard}", "row": f"rg{g}:{i}"})
                n += 1
            mf.flush()
            print(f"  {lang}: {n} clips so far ({time.time() - t0:.0f} s)", flush=True)
        print(f"{lang}: {n} real clips from {len(speakers)} speakers")
    mf.close()
    print("Done.")


if __name__ == "__main__":
    main()
