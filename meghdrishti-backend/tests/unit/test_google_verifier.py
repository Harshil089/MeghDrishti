import time
from unittest.mock import AsyncMock, patch

import jwt as pyjwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from jwt.algorithms import RSAAlgorithm

from app.core import google_auth
from app.core.config import settings
from app.core.google_auth import GoogleTokenError, verify_google_id_token

KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
JWK = {**__import__("json").loads(RSAAlgorithm.to_jwk(KEY.public_key())), "kid": "k1", "alg": "RS256"}


def _token(**overrides):
    claims = {
        "iss": "https://accounts.google.com",
        "aud": "test-client",
        "sub": "123",
        "email": "a@b.com",
        "email_verified": True,
        "exp": int(time.time()) + 300,
        "iat": int(time.time()),
    }
    claims.update(overrides)
    return pyjwt.encode(claims, KEY, algorithm="RS256", headers={"kid": "k1"})


@pytest.fixture
def google(monkeypatch):
    monkeypatch.setattr(settings, "google_client_id", "test-client")
    with patch.object(google_auth, "_get_jwks", new=AsyncMock(return_value={"keys": [JWK]})):
        yield


@pytest.mark.asyncio
async def test_valid_token_accepted(google):
    payload = await verify_google_id_token(_token())
    assert payload["sub"] == "123"


@pytest.mark.asyncio
async def test_wrong_issuer_rejected(google):
    with pytest.raises(GoogleTokenError):
        await verify_google_id_token(_token(iss="https://evil.example"))


@pytest.mark.asyncio
async def test_wrong_audience_rejected(google):
    with pytest.raises(GoogleTokenError):
        await verify_google_id_token(_token(aud="other-client"))


@pytest.mark.asyncio
async def test_expired_rejected(google):
    with pytest.raises(GoogleTokenError):
        await verify_google_id_token(_token(exp=int(time.time()) - 10))


@pytest.mark.asyncio
async def test_unverified_email_rejected(google):
    with pytest.raises(GoogleTokenError):
        await verify_google_id_token(_token(email_verified=False))
