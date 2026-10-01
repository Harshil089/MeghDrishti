"""Run with meghdrishti-backend/.venv/bin/python scripts/verify_local_shutdown.py.

Starts and stops the native application twice; leaves it stopped.
"""
import asyncio
import os
import socket
import subprocess
import time
from pathlib import Path

import websockets
from websockets.exceptions import ConnectionClosed

ROOT = Path(__file__).resolve().parent.parent
os.chdir(ROOT / "meghdrishti-backend")
from app.core.security import create_access_token  # noqa: E402


def run_launcher(action):
    subprocess.run(["bash", str(ROOT / "scripts/local.sh"), action],
                   cwd=ROOT, check=True, timeout=45, stdout=subprocess.DEVNULL)


async def main():
    for cycle in range(1, 3):
        await asyncio.to_thread(run_launcher, "start")
        token = create_access_token(subject="shutdown-verification", roles=["VIEWER"])
        log = ROOT / ".local/logs/api.log"
        offset = log.stat().st_size
        async with websockets.connect(f"ws://127.0.0.1:8000/ws/alerts?token={token}") as ws:
            # An idle connection: no Redis event is needed to release shutdown.
            await asyncio.sleep(0.2)
            start = time.monotonic()
            await asyncio.to_thread(run_launcher, "stop")
            elapsed = time.monotonic() - start
            try:
                await asyncio.wait_for(ws.recv(), timeout=2)
                raise AssertionError("WebSocket stayed open")
            except ConnectionClosed:
                pass
        assert elapsed < 15, f"Shutdown needed {elapsed:.1f}s"
        with log.open("rb") as file:
            file.seek(offset)
            shutdown_log = file.read().decode()
        assert "timeout graceful shutdown exceeded" not in shutdown_log
        assert "Finished server process" in shutdown_log
        for port in (3000, 8000, 5432, 6379):
            try:
                with socket.create_connection(("127.0.0.1", port), timeout=1):
                    raise AssertionError(f"Port {port} still has a listener")
            except OSError:
                pass
        print(f"Cycle {cycle}: idle WebSocket closed, all services stopped in {elapsed:.1f}s")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    finally:
        run_launcher("stop")
