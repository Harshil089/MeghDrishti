.PHONY: dev up down migrate seed test lint

dev:
	uvicorn app.main:app --reload

up:
	docker compose up -d

down:
	docker compose down

migrate:
	alembic upgrade head

seed:
	python -m app.db.seed

test:
	pytest -q

lint:
	ruff check . && mypy app
