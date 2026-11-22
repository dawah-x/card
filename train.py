#!/usr/bin/env python3
"""CLI tool to sync `Ebrahim-ead/DAWAH-X` and train/evaluate the DAWAH X AI Model."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from dawahx_ai.model import DawahXAIModel


def main() -> None:
    parser = argparse.ArgumentParser(description="Train & evaluate DAWAH X AI Model")
    parser.add_argument("--sync", action="store_true", help="Pull latest updates from Ebrahim-ead/DAWAH-X before training")
    parser.add_argument("--force", action="store_true", help="Force full corpus & model rebuild")
    args = parser.parse_args()

    cache_dir = Path(__file__).resolve().parent / ".cache"
    model = DawahXAIModel(cache_dir)
    res = model.load_or_train(force_retrain=args.force, pull_updates=args.sync)
    print(json.dumps(res["metrics"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
