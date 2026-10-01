.PHONY: dev up down status migrate seed test lint

dev:
	uvicorn app.main:app --reload

up:
	bash ../scripts/local.sh start

down:
	bash ../scripts/local.sh stop

status:
	bash ../scripts/local.sh status

migrate:
	alembic upgrade head

seed:
	python -m app.db.seed

test:
	pytest -q

lint:
	ruff check . && mypy app
