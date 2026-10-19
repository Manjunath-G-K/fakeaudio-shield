"""One command for the whole data -> model -> results pipeline.

    python run_pipeline.py                     # everything (downloads skip files already present)
    python run_pipeline.py --skip-download     # only clean, train, evaluate, write RESULTS.md
    python run_pipeline.py --languages Hindi Kannada --per-language 300

Steps:
  1. fetch_asvspoof_subset.py   English ASVspoof 2019 LA subset            (no login)
  2. fetch_indic_subset.py fake IndicSynth AI-generated speech             (no login)
  3. fetch_indic_subset.py real Kathbath real speech                       (needs `hf auth login`)
  4. prepare_dataset.py         dedupe, validate, speaker-disjoint splits, balance
  5. train.py                   features (cached) + LCNN + per-language evaluation + report
  6. make_results_md.py         RESULTS.md generated from the evaluation report
"""
import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")   # Windows consoles default to cp1252
import argparse
import subprocess

from huggingface_hub import get_token

INDIC = ["Hindi", "Kannada", "Tamil", "Telugu", "Malayalam"]


def run(*cmd):
    print(f"\n$ {' '.join(cmd)}", flush=True)
    subprocess.run([sys.executable, *cmd], check=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--skip-download", action="store_true")
    ap.add_argument("--languages", nargs="+", default=INDIC, help="Indian languages to download")
    ap.add_argument("--per-language", type=int, default=300)
    ap.add_argument("--epochs", type=int, default=12)
    ap.add_argument("--proj-dim", default="64")
    ap.add_argument("--time-pool", default="2")
    args = ap.parse_args()

    if not args.skip_download:
        run("fetch_asvspoof_subset.py", "--out", "../data/LA")
        run("fetch_indic_subset.py", "--out", "../data/indic", "--kind", "fake",
            "--per-language", str(args.per_language), "--languages", *args.languages)
        if get_token():
            run("fetch_indic_subset.py", "--out", "../data/indic", "--kind", "real",
                "--per-language", str(args.per_language), "--languages", *args.languages)
        else:
            print("\n! Not logged in to Hugging Face: skipping Kathbath real speech. Indian languages "
                  "will be excluded until you accept the Kathbath terms and run `hf auth login`.")
    run("prepare_dataset.py")
    run("train.py", "--epochs", str(args.epochs), "--proj-dim", args.proj_dim, "--time-pool", args.time_pool)
    run("make_results_md.py")
    print("\nDone. Restart the backend to load the new model.")


if __name__ == "__main__":
    main()
