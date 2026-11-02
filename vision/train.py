"""Train a linear screenshot head on frozen MobileNetV3 features; never fabricate data or scores."""
import argparse
import hashlib
import json
from pathlib import Path

import torch
from torch.utils.data import DataLoader
from torchvision.datasets import ImageFolder
from torchvision.models import mobilenet_v3_small, MobileNet_V3_Small_Weights

MODEL_ID = "mobilenet-v3-small-imagenet1k-v1-pool576-v1"


def no_exact_overlap(*datasets):
    seen = set()
    for dataset in datasets:
        hashes = {hashlib.sha256(Path(name).read_bytes()).hexdigest() for name, _ in dataset.samples}
        if seen.intersection(hashes):
            raise ValueError("Exact duplicate images exist across dataset splits")
        seen.update(hashes)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("data", type=Path, help="Contains train/, val/, test/ with identical class subfolders")
    parser.add_argument("--output", type=Path, default=Path("models/screenshot-head.pt"))
    parser.add_argument("--epochs", type=int, default=15)
    args = parser.parse_args()
    if not 1 <= args.epochs <= 100:
        raise ValueError("Epochs must be between 1 and 100")
    torch.manual_seed(42)
    torch.set_num_threads(2)
    weights = MobileNet_V3_Small_Weights.IMAGENET1K_V1
    datasets = [ImageFolder(args.data / split, transform=weights.transforms()) for split in ("train", "val", "test")]
    train, val, test = datasets
    if not 2 <= len(train.classes) <= 20 or any(d.class_to_idx != train.class_to_idx for d in datasets):
        raise ValueError("Need 2–20 identical classes in all three splits")
    no_exact_overlap(*datasets)
    backbone = mobilenet_v3_small(weights=weights).eval()
    for parameter in backbone.parameters():
        parameter.requires_grad = False

    def extract(dataset):
        features, labels = [], []
        with torch.inference_mode():
            for images, targets in DataLoader(dataset, batch_size=16):
                features.append(backbone.avgpool(backbone.features(images)).flatten(1))
                labels.append(targets)
        return torch.cat(features).clone(), torch.cat(labels)

    x_train, y_train = extract(train)
    x_val, y_val = extract(val)
    head = torch.nn.Linear(576, len(train.classes))
    optimizer = torch.optim.AdamW(head.parameters(), lr=0.001)
    best_loss, best_state = float("inf"), None
    for epoch in range(args.epochs):
        head.train()
        for indices in torch.randperm(len(y_train)).split(32):
            optimizer.zero_grad()
            loss = torch.nn.functional.cross_entropy(head(x_train[indices]), y_train[indices])
            loss.backward()
            optimizer.step()
        head.eval()
        with torch.no_grad():
            val_loss = torch.nn.functional.cross_entropy(head(x_val), y_val).item()
        print(f"epoch={epoch + 1} validation_loss={val_loss:.4f}")
        if val_loss < best_loss:
            best_loss = val_loss
            best_state = {key: value.detach().clone() for key, value in head.state_dict().items()}
    head.load_state_dict(best_state)
    x_test, y_test = extract(test)
    with torch.no_grad():
        predictions = head(x_test).argmax(dim=1)
    confusion = torch.zeros((len(train.classes), len(train.classes)), dtype=torch.int64)
    for actual, predicted in zip(y_test, predictions):
        confusion[actual, predicted] += 1
    per_class = {}
    for i, name in enumerate(train.classes):
        true_positive = confusion[i, i].item()
        per_class[name] = {"support": confusion[i].sum().item(),
                           "precision": true_positive / max(1, confusion[:, i].sum().item()),
                           "recall": true_positive / max(1, confusion[i].sum().item())}
    report = {"feature_model": MODEL_ID, "seed": 42, "classes": train.classes,
              "split_sizes": {name: len(data) for name, data in zip(("train", "val", "test"), datasets)},
              "test_accuracy": (predictions == y_test).float().mean().item(),
              "confusion_matrix": confusion.tolist(), "per_class": per_class,
              "limitations": "Exact duplicate checks do not detect near duplicates. Split by source/session manually. Softmax scores are not calibrated. Test results must not guide repeated model selection."}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    torch.save({"feature_model": MODEL_ID, "classes": train.classes, "head": best_state}, args.output)
    args.output.with_suffix(".metrics.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
