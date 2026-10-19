"""Write RESULTS.md and the README results table from backend/checkpoints/report.json, so documented numbers always
match the trained model (nothing typed by hand).

    python make_results_md.py
"""
import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")   # Windows consoles default to cp1252
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def pct(x, d=1):
    return "–" if x is None else f"{x * 100:.{d}f}%"


def ci(c):
    return "–" if not c else f"{c[0] * 100:.1f}–{c[1] * 100:.1f}%"


def main():
    rep = json.loads((ROOT / "backend" / "checkpoints" / "report.json").read_text())
    L, ds, tr, m = rep["languages"], rep.get("dataset") or {}, rep["training"], rep["model"]
    out = [
        "# FakeAudio Shield: measured results",
        "",
        f"_Generated from `backend/checkpoints/report.json` ({rep['generated_at']}). Do not edit by hand: run `python make_results_md.py`._",
        "",
        "## Language support",
        "",
        "| Language | Status | Model | Test EER (95% CI) | Accuracy (95% CI) | Real passed | AI caught | Test clips (real + AI) | Test speakers | Recording check (channel-only EER) |",
        "|---|---|---|---|---|---|---|---|---|---|",
    ]
    for lang, d in L.items():
        t = d["test"]
        model = rep.get("models", {}).get(d.get("model"), {}).get("name", "–")
        out.append(f"| {lang} | **{d['status']}** | {model} | {pct(t['eer'], 2)} ({ci(t['eer_ci'])}) | {pct(t['accuracy'])} ({ci(t['accuracy_ci'])}) | "
                   f"{t['bonafide_correct']}/{t['bonafide_total']} | {t['spoof_correct']}/{t['spoof_total']} | "
                   f"{t['bonafide_total']} + {t['spoof_total']} | {t['speakers']} | "
                   + (f"{'⚠ ' if d['shortcut_probe']['shortcut_risk'] else ''}{pct(d['shortcut_probe']['channel_eer'])}" if d.get("shortcut_probe") else "–") + " |")
        if d.get("status_reason"):
            out.append(f"|  | _{d['status_reason']}_ | | | | | | | | |")
    out += ["", f"Status rule: {rep['metric_definitions']['support_rule']}", ""]
    if rep["model"].get("routing"):
        out += [f"Model routing: {rep['model']['routing']}", ""]
    out += [
            "Test conditions:", ""]
    out += [f"- **{lang}**: {d['test_condition']}" for lang, d in L.items()]
    out += ["", "## Metric definitions", ""]
    out += [f"- **{k.replace('_', ' ')}**: {v}" for k, v in rep["metric_definitions"].items()]
    out += ["", "## Per-attack / per-generator detection (test set)", ""]
    for lang, d in L.items():
        att = d["test"].get("by_attack") or {}
        if att:
            out.append(f"**{lang}**: " + ", ".join(f"{a} {v['spoof_correct']}/{v['spoof_total']}" for a, v in att.items()))
            out.append("")
    if ds:
        out += ["## Dataset", "", f"{ds['records_found']} clips collected, {ds['records_kept']} kept after cleaning and balancing.", "",
                "| Language | Train (real + AI) | Dev | Test | Hours | Sources |", "|---|---|---|---|---|---|"]
        for lang, d in ds["languages"].items():
            out.append(f"| {lang} | " + " | ".join(f"{d[s]['bonafide']} + {d[s]['spoof']} ({d[s]['speakers']} spk)" for s in ("train", "dev", "test"))
                       + f" | {d['hours']} | {', '.join(d['sources'])} |")
        out += ["", "Removed during cleaning:", ""]
        out += [f"- {why}: {n}" for why, n in ds["removed"].items()] or ["- nothing"]
        out += ["", "Sources and licences:", ""]
        out += [f"- [{s}]({v['url']}): {v['license']}" for s, v in ds["sources"].items()]
        out += [""] + [f"- {n}" for n in ds["notes"]]
    out += ["", "## Model and training", "",
            f"- Speech model: {m['frontend']}", f"- Spectral features: {m['spectral_features']}",
            f"- Classifier: {m['classifier']}",
            f"- Input: {m['segment_seconds']} s segments, scores averaged; threshold P(AI) ≥ {m['threshold']}", ""]
    for info in rep.get("models", {"multilingual": {"name": "Model", "arch": m["arch"], "languages": list(L),
                                                    "trainable_parameters": m["trainable_parameters"], "training": tr}}).values():
        t = info.get("training") or {}
        out += [f"**{info['name']}** (`{info.get('checkpoint', '')}`): trained on {', '.join(info['languages'])}; "
                f"{info['trainable_parameters']:,} trainable parameters, arch {info['arch']}", "",
                f"- Training: {t.get('epochs_run')} epochs (best {t.get('best_epoch')}), {round((t.get('seconds') or 0) / 60)} min on {t.get('device', 'CPU')}, "
                f"{t.get('optimizer')}, lr {t.get('learning_rate')}, batch {t.get('batch_size')}",
                f"- Balancing: {t.get('balancing')}", f"- Model selection: {t.get('model_selection')}", ""]
    study_path = ROOT / "backend" / "checkpoints" / "data_size_study.json"
    if study_path.exists():
        st = json.loads(study_path.read_text())
        out += ["## How much training data is needed? (learning curve)", "",
                f"{st['model']}; {st['epochs']} epochs; {st['note']}", "",
                "| Training clips | Dev EER | Test EER |", "|---|---|---|"]
        out += [f"| {r['train_clips']:,} | {pct(r['dev_eer'])} | {pct(r['test_eer'])} |" for r in st["results"]]
        out.append("")
    (ROOT / "RESULTS.md").write_text("\n".join(out), encoding="utf-8")
    print(f"wrote {ROOT / 'RESULTS.md'}")
    update_readme(rep)


def update_readme(rep):
    """Replace the block between the results markers in README.md."""
    start, end = "<!-- results:start -->", "<!-- results:end -->"
    path = ROOT / "README.md"
    text = path.read_text(encoding="utf-8")
    if start not in text or end not in text:
        return
    rows = ["| Language | Status | Model | Test EER (95% CI) | Accuracy | Test clips | Test speakers |",
            "|---|---|---|---|---|---|---|"]
    for lang, d in rep["languages"].items():
        t = d["test"]
        model = rep.get("models", {}).get(d.get("model"), {}).get("name", "–")
        rows.append(f"| {lang} | **{d['status']}** | {model} | {pct(t['eer'])} ({ci(t['eer_ci'])}) | {pct(t['accuracy'])} | "
                    f"{t['bonafide_total'] + t['spoof_total']} | {t['speakers']} |")
    o = rep["overall"]
    block = "\n".join([start, f"_Generated by `backend/make_results_md.py` from the evaluation report ({rep['generated_at'][:10]})._", "",
                       *rows, "",
                       f"All languages together: {pct(o['accuracy'])} accuracy and {pct(o['eer'])} EER on "
                       f"{o['bonafide_total'] + o['spoof_total']:,} unseen test clips.", end])
    head, rest = text.split(start, 1)
    path.write_text(head + block + rest.split(end, 1)[1], encoding="utf-8")
    print(f"updated the results table in {path}")


if __name__ == "__main__":
    main()
