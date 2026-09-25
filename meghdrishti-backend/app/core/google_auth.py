"""Verifies Google Sign-In ID tokens against Google's published JWKS.

No google-auth/requests dependency needed — httpx + jose (already project
dependencies) do the whole job: fetch Google's public keys, pick the one
matching the token's `kid`, verify signature + audience + issuer.
"""
from __future__ import annotations

import time

import httpx
from jose import jwt

from app.core.config import settings

GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = {"https://accounts.google.com", "accounts.google.com"}

_jwks_cache: dict | None = None
_jwks_fetched_at: float = 0.0
_JWKS_TTL_SECONDS = 3600


async def _get_jwks() -> dict:
    global _jwks_cache, _jwks_fetched_at
    if _jwks_cache is None or (time.time() - _jwks_fetched_at) > _JWKS_TTL_SECONDS:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(GOOGLE_JWKS_URL)
            resp.raise_for_status()
            _jwks_cache = resp.json()
            _jwks_fetched_at = time.time()
    return _jwks_cache


class GoogleTokenError(ValueError):
    pass


async def verify_google_id_token(id_token: str) -> dict:
    """Returns the verified token payload (email, name, sub, ...) or raises GoogleTokenError."""
    if not settings.google_client_id:
        raise GoogleTokenError("Google sign-in is not configured (GOOGLE_CLIENT_ID unset)")

    try:
        header = jwt.get_unverified_header(id_token)
    except Exception as exc:  # noqa: BLE001
        raise GoogleTokenError("Malformed token") from exc

    jwks = await _get_jwks()
    key = next((k for k in jwks["keys"] if k["kid"] == header.get("kid")), None)
    if key is None:
        raise GoogleTokenError("Unknown signing key")

    try:
        payload = jwt.decode(
            id_token,
            key,
            algorithms=["RS256"],
            audience=settings.google_client_id,
            issuer=list(GOOGLE_ISSUERS),
        )
    except Exception as exc:  # noqa: BLE001
        raise GoogleTokenError("Invalid Google token") from exc

    if not payload.get("email_verified", False):
        raise GoogleTokenError("Google email not verified")

    return payload
