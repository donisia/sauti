"""
M-Pesa payments via Safaricom Daraja "Lipa na M-Pesa Online" (STK Push).

Flow: we ask Daraja to push a payment prompt to the reader's phone; the
reader enters their PIN; Daraja POSTs the result to MPESA_CALLBACK_URL.
While waiting we can also poll the STK Push Query API.

`mock` (the default) never touches the network: prompts are "sent"
instantly and settled through the demo simulator or the callback endpoint.
`daraja` talks to the sandbox or production API using the MPESA_* settings.
"""

import base64
import json
import re
import secrets
import time
import urllib.error
import urllib.request
from datetime import datetime

DARAJA_HOSTS = {
    "sandbox": "https://sandbox.safaricom.co.ke",
    "production": "https://api.safaricom.co.ke",
}

# Daraja answers STK queries for in-flight payments with this error code.
_STILL_PROCESSING = "500.001.1001"

_PHONE = re.compile(r"^254(7|1)\d{8}$")


class MpesaError(Exception):
    """The M-Pesa provider rejected the request or couldn't be reached."""


def normalize_phone(raw):
    """Accept 07XX…, 01XX…, +2547XX…, 2547XX… and return 2547XXXXXXXX (or None)."""
    digits = re.sub(r"[\s\-()]", "", str(raw or ""))
    if digits.startswith("+"):
        digits = digits[1:]
    if re.fullmatch(r"0(7|1)\d{8}", digits):
        digits = "254" + digits[1:]
    elif re.fullmatch(r"(7|1)\d{8}", digits):
        digits = "254" + digits
    return digits if _PHONE.match(digits) else None


def mask_phone(phone):
    return f"{phone[:6]}•••{phone[-3:]}" if phone and len(phone) > 9 else phone


class MockMpesaProvider:
    name = "mock"
    supports_simulation = True

    def stk_push(self, amount_kes, phone, reference, description):
        return {
            "checkout_request_id": f"ws_CO_{datetime.now():%d%m%Y%H%M%S}{secrets.token_hex(6)}",
            "customer_message": "Success. Request accepted for processing",
        }

    def query(self, checkout_request_id):
        # Mock prompts are only resolved via the simulator or the callback.
        return {"status": "pending"}


class DarajaProvider:
    name = "daraja"
    supports_simulation = False

    def __init__(self, config):
        self.base = DARAJA_HOSTS.get(config["MPESA_ENV"], DARAJA_HOSTS["sandbox"])
        self.consumer_key = config["MPESA_CONSUMER_KEY"]
        self.consumer_secret = config["MPESA_CONSUMER_SECRET"]
        self.shortcode = config["MPESA_SHORTCODE"]
        self.passkey = config["MPESA_PASSKEY"]
        self.callback_url = config["MPESA_CALLBACK_URL"]
        self.transaction_type = config["MPESA_TRANSACTION_TYPE"]
        missing = [
            name
            for name, value in {
                "MPESA_CONSUMER_KEY": self.consumer_key,
                "MPESA_CONSUMER_SECRET": self.consumer_secret,
                "MPESA_PASSKEY": self.passkey,
                "MPESA_CALLBACK_URL": self.callback_url,
            }.items()
            if not value
        ]
        if missing:
            raise MpesaError(f"M-Pesa is not configured: set {', '.join(missing)}.")

    # Access tokens live for an hour; share one across requests.
    _token_cache = {}

    def _token(self):
        cached = self._token_cache.get(self.consumer_key)
        if cached and cached[1] > time.time() + 60:
            return cached[0]
        basic = base64.b64encode(f"{self.consumer_key}:{self.consumer_secret}".encode()).decode()
        data = self._request(
            "GET", "/oauth/v1/generate?grant_type=client_credentials", headers={"Authorization": f"Basic {basic}"}
        )
        token = data["access_token"]
        self._token_cache[self.consumer_key] = (token, time.time() + int(data.get("expires_in", 3599)))
        return token

    def _password(self):
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        password = base64.b64encode(f"{self.shortcode}{self.passkey}{timestamp}".encode()).decode()
        return password, timestamp

    def _request(self, method, path, body=None, headers=None):
        request = urllib.request.Request(
            self.base + path,
            method=method,
            data=json.dumps(body).encode() if body is not None else None,
            headers={"Content-Type": "application/json", **(headers or {})},
        )
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                return json.loads(response.read().decode() or "{}")
        except urllib.error.HTTPError as error:
            try:
                return {"_http_status": error.code, **json.loads(error.read().decode() or "{}")}
            except ValueError:
                raise MpesaError(f"M-Pesa returned HTTP {error.code}.")
        except (urllib.error.URLError, TimeoutError) as error:
            raise MpesaError(f"Couldn't reach M-Pesa: {error}")

    def stk_push(self, amount_kes, phone, reference, description):
        password, timestamp = self._password()
        data = self._request(
            "POST",
            "/mpesa/stkpush/v1/processrequest",
            body={
                "BusinessShortCode": self.shortcode,
                "Password": password,
                "Timestamp": timestamp,
                "TransactionType": self.transaction_type,
                "Amount": int(amount_kes),
                "PartyA": phone,
                "PartyB": self.shortcode,
                "PhoneNumber": phone,
                "CallBackURL": self.callback_url,
                "AccountReference": reference[:12],
                "TransactionDesc": description[:13],
            },
            headers={"Authorization": f"Bearer {self._token()}"},
        )
        if str(data.get("ResponseCode")) != "0":
            raise MpesaError(data.get("errorMessage") or data.get("ResponseDescription") or "M-Pesa rejected the request.")
        return {"checkout_request_id": data["CheckoutRequestID"], "customer_message": data.get("CustomerMessage", "")}

    def query(self, checkout_request_id):
        password, timestamp = self._password()
        data = self._request(
            "POST",
            "/mpesa/stkpushquery/v1/query",
            body={
                "BusinessShortCode": self.shortcode,
                "Password": password,
                "Timestamp": timestamp,
                "CheckoutRequestID": checkout_request_id,
            },
            headers={"Authorization": f"Bearer {self._token()}"},
        )
        if data.get("errorCode") == _STILL_PROCESSING or "ResultCode" not in data:
            return {"status": "pending"}
        if str(data["ResultCode"]) == "0":
            # The receipt number only arrives in the callback.
            return {"status": "paid", "receipt": None}
        return {"status": "failed", "reason": data.get("ResultDesc") or "The payment was not completed."}


def get_mpesa_provider(config):
    name = config["MPESA_PROVIDER"]
    if name == "mock":
        return MockMpesaProvider()
    if name == "daraja":
        return DarajaProvider(config)
    raise MpesaError(f"Unknown MPESA_PROVIDER '{name}'. Use 'mock' or 'daraja'.")


def parse_callback(payload):
    """Extract the fields we need from a Daraja STK callback body."""
    callback = (payload or {}).get("Body", {}).get("stkCallback") or {}
    items = {i.get("Name"): i.get("Value") for i in (callback.get("CallbackMetadata") or {}).get("Item", [])}
    return {
        "checkout_request_id": callback.get("CheckoutRequestID"),
        "result_code": str(callback.get("ResultCode", "")),
        "result_desc": callback.get("ResultDesc") or "",
        "receipt": items.get("MpesaReceiptNumber"),
        "amount": items.get("Amount"),
    }
