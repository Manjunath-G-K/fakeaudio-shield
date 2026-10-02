"""Download a balanced subset of ASVspoof 2019 LA without downloading the whole 7 GB LA.zip.

The official LA.zip (Edinburgh DataShare, ODC-By licence) is read remotely with HTTP
range requests: first the ZIP index, then only the selected FLAC files. The result is
the normal ASVspoof folder layout, so train.py works the same as with the full dataset.

    python fetch_asvspoof_subset.py --out ../data/LA
"""
import argparse
import random
import struct
import time
import urllib.request
import zipfile
import zlib
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

LA_ZIP_URL = "https://datashare.ed.ac.uk/server/api/core/bitstreams/a9f87c35-f055-4015-80e2-2fdff0d46269/content"
PROTOCOLS = {
    "train": "ASVspoof2019.LA.cm.train.trn.txt",
    "dev": "ASVspoof2019.LA.cm.dev.trl.txt",
    "eval": "ASVspoof2019.LA.cm.eval.trl.txt",
}


def http_range(url: str, start: int, end: int, retries: int = 8) -> bytes:
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"Range": f"bytes={start}-{end}"})
            with urllib.request.urlopen(req, timeout=120) as resp:
                if resp.status != 206:
                    raise IOError(f"server ignored the range request (HTTP {resp.status})")
                return resp.read()
        except Exception as exc:
            if attempt == retries - 1:
                raise
            print(f"  retrying range {start}-{end} after error: {exc}")
            time.sleep(3 * (attempt + 1))


class RemoteFile:
    """Minimal seekable read-only file over HTTP range requests (enough for zipfile)."""

    def __init__(self, url: str):
        self.url, self.pos = url, 0
        req = urllib.request.Request(url, headers={"Range": "bytes=0-0"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            self.size = int(resp.headers["Content-Range"].split("/")[1])

    def seek(self, offset, whence=0):
        self.pos = {0: offset, 1: self.pos + offset, 2: self.size + offset}[whence]
        return self.pos

    def tell(self):
        return self.pos

    def read(self, n=-1):
        if n is None or n < 0:
            n = self.size - self.pos
        n = min(n, self.size - self.pos)
        if n <= 0:
            return b""
        data = http_range(self.url, self.pos, self.pos + n - 1)
        self.pos += len(data)
        return data

    def seekable(self):
        return True


def fetch_member(url: str, info: zipfile.ZipInfo) -> bytes:
    """Download and decompress one ZIP member using its local header offset."""
    raw = http_range(url, info.header_offset, info.header_offset + 30 + 1024 + info.compress_size)
    name_len, extra_len = struct.unpack("<HH", raw[26:30])
    start = 30 + name_len + extra_len
    data = raw[start:start + info.compress_size]
    if info.compress_type == zipfile.ZIP_STORED:
        return data
    if info.compress_type == zipfile.ZIP_DEFLATED:
        return zlib.decompressobj(-15).decompress(data)
    raise ValueError(f"unsupported compression {info.compress_type} for {info.filename}")


def choose(rows, per_class: int, rng: random.Random):
    """per_class bona-fide files + per_class spoof files spread evenly over attack types."""
    bona = [r for r in rows if r[2] == "bonafide"]
    by_attack = defaultdict(list)
    for r in rows:
        if r[2] == "spoof":
            by_attack[r[1]].append(r)
    picked = rng.sample(bona, min(per_class, len(bona)))
    attacks = sorted(by_attack)
    for i, attack in enumerate(attacks):
        n = per_class // len(attacks) + (1 if i < per_class % len(attacks) else 0)
        picked += rng.sample(by_attack[attack], min(n, len(by_attack[attack])))
    return picked


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default="../data/LA", help="output folder (ASVspoof LA layout)")
    ap.add_argument("--train-per-class", type=int, default=1250)
    ap.add_argument("--dev-per-class", type=int, default=400)
    ap.add_argument("--eval-per-class", type=int, default=400)
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()

    out = Path(args.out)
    print("Reading the LA.zip index from Edinburgh DataShare ...")
    zf = zipfile.ZipFile(RemoteFile(LA_ZIP_URL))
    members = {Path(i.filename).name: i for i in zf.infolist() if not i.is_dir()}
    print(f"  {len(members)} files in LA.zip")

    proto_dir = out / "ASVspoof2019_LA_cm_protocols"
    proto_dir.mkdir(parents=True, exist_ok=True)
    rng = random.Random(args.seed)
    jobs = []
    sizes = {"train": args.train_per_class, "dev": args.dev_per_class, "eval": args.eval_per_class}
    for split, proto_name in PROTOCOLS.items():
        text = fetch_member(zf.fp.url, members[proto_name]).decode()
        (proto_dir / proto_name).write_text(text)
        rows = [(p[1], p[3], p[4]) for p in (line.split() for line in text.splitlines()) if len(p) == 5]
        picked = choose(rows, sizes[split], rng)
        flac_dir = out / f"ASVspoof2019_LA_{split}" / "flac"
        flac_dir.mkdir(parents=True, exist_ok=True)
        jobs += [(members[f"{utt}.flac"], flac_dir / f"{utt}.flac") for utt, _, _ in picked]
        print(f"  {split}: {len(picked)} files selected")

    todo = [(info, dest) for info, dest in jobs if not dest.exists()]
    total_mb = sum(i.compress_size for i, _ in todo) / 1e6
    print(f"Downloading {len(todo)} files (~{total_mb:.0f} MB, {len(jobs) - len(todo)} already present) ...")

    def work(job):
        info, dest = job
        data = fetch_member(zf.fp.url, info)
        tmp = dest.with_suffix(".part")
        tmp.write_bytes(data)
        tmp.replace(dest)

    t0 = time.time()
    with ThreadPoolExecutor(args.workers) as pool:
        for n, fut in enumerate(as_completed(pool.submit(work, j) for j in todo), 1):
            fut.result()
            if n % 100 == 0 or n == len(todo):
                print(f"  {n}/{len(todo)} files ({time.time() - t0:.0f} s)")
    print(f"Done. Dataset subset is in {out.resolve()}")


if __name__ == "__main__":
    main()
