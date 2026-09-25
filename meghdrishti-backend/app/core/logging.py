"""Structured JSON logging setup."""
from __future__ import annotations

import logging
import sys
import uuid
from contextvars import ContextVar

import structlog

from app.core.config import settings

request_id_ctx: ContextVar[str] = ContextVar("request_id", default="")
correlation_id_ctx: ContextVar[str] = ContextVar("correlation_id", default="")


def new_request_id() -> str:
    return uuid.uuid4().hex


def _add_context_ids(logger, method_name, event_dict):
    rid = request_id_ctx.get()
    if rid:
        event_dict["request_id"] = rid
    cid = correlation_id_ctx.get()
    if cid:
        event_dict["correlation_id"] = cid
    return event_dict


def configure_logging() -> None:
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
    )

    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        _add_context_ids,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    renderer = (
        structlog.processors.JSONRenderer()
        if settings.log_json
        else structlog.dev.ConsoleRenderer()
    )

    structlog.configure(
        processors=[*shared_processors, renderer],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, settings.log_level.upper(), logging.INFO)
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str = "meghdrishti"):
    return structlog.get_logger(name)
