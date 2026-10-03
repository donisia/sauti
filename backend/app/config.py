import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def _bool(name, default):
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-insecure-change-me")
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL", f"sqlite:///{(BASE_DIR / 'instance' / 'sovereign.db').as_posix()}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JSON_SORT_KEYS = False

    CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

    # Create tables and load seeds/catalogue.json when the database is empty.
    SEED_ON_START = _bool("SEED_ON_START", True)

    # Lightning
    LIGHTNING_PROVIDER = os.getenv("LIGHTNING_PROVIDER", "mock")
    INVOICE_TTL_SECONDS = int(os.getenv("INVOICE_TTL_SECONDS", "600"))

    # M-Pesa (Safaricom Daraja STK Push). "mock" needs no credentials.
    MPESA_PROVIDER = os.getenv("MPESA_PROVIDER", "mock")  # mock | daraja
    MPESA_ENV = os.getenv("MPESA_ENV", "sandbox")  # sandbox | production
    MPESA_CONSUMER_KEY = os.getenv("MPESA_CONSUMER_KEY", "")
    MPESA_CONSUMER_SECRET = os.getenv("MPESA_CONSUMER_SECRET", "")
    MPESA_SHORTCODE = os.getenv("MPESA_SHORTCODE", "174379")  # Daraja sandbox paybill
    MPESA_PASSKEY = os.getenv("MPESA_PASSKEY", "")
    MPESA_TRANSACTION_TYPE = os.getenv("MPESA_TRANSACTION_TYPE", "CustomerPayBillOnline")
    # Public HTTPS URL Daraja posts results to, e.g. https://api.example.com/api/mpesa/callback?token=…
    MPESA_CALLBACK_URL = os.getenv("MPESA_CALLBACK_URL", "")
    # If set, callbacks must carry ?token=<value>; put the same token in MPESA_CALLBACK_URL.
    MPESA_CALLBACK_TOKEN = os.getenv("MPESA_CALLBACK_TOKEN", "")
    MPESA_TTL_SECONDS = int(os.getenv("MPESA_TTL_SECONDS", "180"))
    # Don't hit the STK query API more often than this per payment while polling.
    MPESA_QUERY_INTERVAL_SECONDS = int(os.getenv("MPESA_QUERY_INTERVAL_SECONDS", "10"))
    # Prices are set in sats; M-Pesa charges the KES equivalent (rounded up, min KES 1).
    KES_PER_SAT = float(os.getenv("KES_PER_SAT", "0.13"))

    # Monthly subscriptions unlock every paid chapter by one author.
    SUBSCRIPTION_DAYS = int(os.getenv("SUBSCRIPTION_DAYS", "30"))
    DEFAULT_SUBSCRIPTION_SATS = int(os.getenv("DEFAULT_SUBSCRIPTION_SATS", "3000"))

    # Demo mode enables the payment simulator and the reader lock/unlock toggle,
    # and accepts unsigned "simulated" events — but only for DEMO_PUBKEY.
    DEMO_MODE = _bool("DEMO_MODE", True)
    DEMO_PUBKEY = os.getenv("DEMO_PUBKEY", "a7c19e4f3b2d8e6015f9c4a7b3e2d1f08c6a5b4e3d2c1f0e9d8c7b6a5f4e3d2c")
    DEMO_NPUB = os.getenv("DEMO_NPUB", "npub17x8qmw3vfz0r5n4t2l6h9e8ycjdk5a3sgu7p4wxe2hqz6m9tlv0rfuak9p")

    # NIP-98 auth events older (or newer) than this are rejected to limit replay.
    AUTH_MAX_AGE_SECONDS = int(os.getenv("AUTH_MAX_AGE_SECONDS", "120"))


class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    SEED_ON_START = False
