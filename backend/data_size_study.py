"""How much training data does this model need? Learning curve on cached features.

    python data_size_study.py

Trains the (fast) LCNN on 10%, 25%, 50% and 100% of the training clips (class-balanced,
same seed), picks the best epoch on dev, and measures test EER. Results go to
checkpoints/data_size_study.json and are shown on the website's Results page.
"""
import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")   # Windows consoles default to cp1252
import json
import random
import time
from pathlib import Path

import numpy as np
import torch
from torch import nn

from app import config
from app.model import FakeAudioLCNN
from train import compute_eer, load_features, read_manifest, scores_of

FRACTIONS = [0.1, 0.25, 0.5, 1.0]
EPOCHS = 5


def subset(data, idx):
    return {k: (v[idx] if hasattr(v, "__getitem__") else v) for k, v in data.items()}


def main():
    items = read_manifest(Path("../data/manifest.csv"), Path("../data"))
    data = {s: load_features([i for i in items if i["split"] == s], Path("../data/cache"), []) for s in ("train", "dev", "test")}
    y_all = data["train"]["labels"].numpy()
    results = []
    for frac in FRACTIONS:
        rng = random.Random(0)
        idx = []
        for c in (0, 1):                                   # keep classes balanced
            cls = list(np.where(y_all == c)[0])
            idx += rng.sample(cls, max(2, int(len(cls) * frac)))
        idx = torch.tensor(sorted(idx))
        train = subset(data["train"], idx)
        torch.manual_seed(0)
        model = FakeAudioLCNN()
        opt = torch.optim.AdamW(model.parameters(), lr=3e-4, weight_decay=1e-4)
        best_dev, best_state, t0 = None, None, time.time()
        for _ in range(EPOCHS):
            model.train()
            perm = torch.randperm(len(idx))
            for i in range(0, len(perm), 32):
                b = perm[i:i + 32]
                if len(b) < 2:
                    continue
                loss = nn.functional.cross_entropy(model(train["w2v"][b].float(), train["spec"][b].float()), train["labels"][b])
                opt.zero_grad(); loss.backward(); opt.step()
            dev_eer = compute_eer(data["dev"]["labels"].numpy(), scores_of(model, data["dev"]))
            if best_dev is None or dev_eer < best_dev:
                best_dev, best_state = dev_eer, {k: v.clone() for k, v in model.state_dict().items()}
        model.load_state_dict(best_state)
        test_eer = compute_eer(data["test"]["labels"].numpy(), scores_of(model, data["test"]))
        row = {"fraction": frac, "train_clips": int(len(idx)), "dev_eer": round(best_dev, 4), "test_eer": round(test_eer, 4),
               "seconds": round(time.time() - t0)}
        results.append(row)
        print(row, flush=True)
    out = {"model": "fast LCNN (proj 64, time-pool 2), Wav2Vec2 frozen", "epochs": EPOCHS, "language": "English",
           "note": "Same seed and test set for every size; the best epoch is picked on dev.", "results": results}
    Path(config.CHECKPOINT_PATH.with_name("data_size_study.json")).write_text(json.dumps(out, indent=2))
    print("saved checkpoints/data_size_study.json")


if __name__ == "__main__":
    main()
