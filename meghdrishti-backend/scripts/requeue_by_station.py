"""Re-queue every reading that has no QC results onto its own per-station queue.

Used with `scripts/local.sh backlog`: one worker per station drains its queue in
timestamp order, so stations run in parallel without any station being
processed out of order. Prints the station codes (one per line) it queued for.
"""
from __future__ import annotations

from sqlalchemy import create_engine, text

from app.core.config import settings
from app.workers.celery_app import celery_app
from app.workers.qc_tasks import process_observation_task


def queue_name(code: str) -> str:
    return f"qc_{code.lower()}"


def main() -> None:
    engine = create_engine(settings.database_url_sync)
    with engine.connect() as conn:
        rows = conn.execute(text(
            "select s.station_code, o.id from weather_observations o join stations s on s.id = o.station_id "
            "where not exists (select 1 from qc_rule_results r where r.observation_id = o.id) "
            "order by s.station_code, o.timestamp"
        )).all()
    # Drop the shared and any earlier per-station backlogs first so nothing is queued twice.
    with celery_app.connection_or_acquire() as conn:
        for name in ["qc", *(queue_name(c) for c in {code for code, _ in rows})]:
            conn.default_channel.queue_purge(name)
    codes: dict[str, int] = {}
    for code, obs_id in rows:
        process_observation_task.apply_async(args=[str(obs_id)], queue=queue_name(code))
        codes[code] = codes.get(code, 0) + 1
    for code, n in codes.items():
        print(f"{code} {n}")


if __name__ == "__main__":
    main()
