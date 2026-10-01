#!/usr/bin/env python
"""Train candidates using the same policy as the API. Activation is explicit.

Usage: python scripts/train_models.py [--activate]
Forecast-only and legacy candidates cannot be activated for sensor decisions.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.session import AsyncSessionLocal, engine  # noqa: E402
from app.ml.registry import ModelRegistry  # noqa: E402
from app.ml.workflow import train_candidates  # noqa: E402


async def main(activate: bool) -> None:
    try:
        async with AsyncSessionLocal() as session:
            result = await train_candidates(session)
            print(json.dumps(result, indent=2))
            if activate:
                registry = ModelRegistry(session)
                for candidate_id in result["candidates"]:
                    await registry.activate(uuid.UUID(candidate_id))
                    print(f"{candidate_id}: activated")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--activate", action="store_true", help="Explicitly activate eligible sensor candidates")
    args = parser.parse_args()
    asyncio.run(main(args.activate))
