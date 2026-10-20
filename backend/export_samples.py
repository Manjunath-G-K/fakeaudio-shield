"""Copy demo clips for each Indian language from the TEST split into the website.

    python export_samples.py

For every language in data/manifest.csv (except English, which has hand-labelled ASVspoof
samples), one real (Kathbath) and one AI (IndicSynth) clip are taken from the test split.
Clips are picked by sorted file name, NOT by whether the model gets them right, so the demo
shows honest behaviour. Writes frontend/public/samples/<lang>-*.{ext} and
frontend/src/data/samples.generated.json (read by src/lib/samples.js).
"""
import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")   # Windows consoles default to cp1252
import csv
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "frontend" / "public" / "samples"
GEN = {"xtts_v2": "XTTS-v2 voice cloning", "freevc24": "FreeVC voice conversion"}


def main():
    rows = list(csv.DictReader((ROOT / "data" / "manifest.csv").open(encoding="utf-8")))
    samples = {}
    for lang in sorted({r["lang"] for r in rows} - {"English"}):
        test = sorted((r for r in rows if r["lang"] == lang and r["split"] == "test"), key=lambda r: r["path"])
        real = [r for r in test if r["label"] == "bonafide"][:1]
        fake = [r for r in test if r["label"] == "spoof"][:1]
        entries = []
        for r, kind in [(x, "real") for x in real] + [(x, "ai") for x in fake]:
            src = ROOT / "data" / r["path"]
            name = f"{lang.lower()}-{kind}{src.suffix}"
            shutil.copyfile(src, OUT / name)
            entries.append({
                "file": name,
                "name": f"{'Real person' if kind == 'real' else 'AI voice'} ({lang})",
                "detail": "Kathbath recording, unseen speaker" if kind == "real"
                          else f"IndicSynth, {GEN.get(r['attack'], r['attack'])}",
                "truth": r["label"],
            })
        if entries:
            samples[lang] = entries
            print(f"{lang}: {[e['file'] for e in entries]}")
    (ROOT / "frontend" / "src" / "data" / "samples.generated.json").write_text(json.dumps(samples, indent=2, ensure_ascii=False), encoding="utf-8")
    print("wrote frontend/src/data/samples.generated.json")


if __name__ == "__main__":
    main()
