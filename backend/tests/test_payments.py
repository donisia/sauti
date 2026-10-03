import math

from .conftest import READER

SALT_AUTHOR = "npub1q8m4a7tzk3wv9hf2ljd6xye0cr5ns8g4u3pa7mk2qzv9thw6fx0dlsa3ce"  # Amara Nwosu


def _invoice(client, headers, **body):
    return client.post("/api/invoices", json=body, headers=headers)


def _simulate(client, headers, invoice, outcome="paid"):
    return client.post(f"/api/invoices/{invoice['paymentHash']}/simulate", json={"outcome": outcome}, headers=headers)


def test_health_exposes_payment_options(client):
    payments = client.get("/api/health").get_json()["payments"]
    assert payments["methods"] == ["lightning", "mpesa"]
    assert payments["subscriptionDays"] == 30 and payments["kesPerSat"] > 0


def test_mpesa_requires_valid_safaricom_number(client, reader_headers):
    response = _invoice(
        client, reader_headers, bookId="the-salt-roads", chapterId="ch-3", method="mpesa", phone="12345"
    )
    assert response.status_code == 422
    assert "phone" in response.get_json()["error"]["fields"]


def test_mpesa_chapter_payment_unlocks(client, reader_headers, app):
    response = _invoice(
        client, reader_headers, bookId="the-salt-roads", chapterId="ch-3", method="mpesa", phone="0712 345 678"
    )
    assert response.status_code == 201
    invoice = response.get_json()["invoice"]
    assert invoice["method"] == "mpesa" and invoice["bolt11"] is None
    assert invoice["amountKes"] == math.ceil(210 * app.config["KES_PER_SAT"])
    assert invoice["phone"] == "254712•••678"

    paid = _simulate(client, reader_headers, invoice).get_json()["invoice"]
    assert paid["status"] == "paid" and paid["receipt"]
    body = client.get("/api/books/the-salt-roads/chapters/ch-3", headers=reader_headers).get_json()
    assert body["unlocked"] is True


def test_mpesa_cancelled_payment_reports_reason(client, reader_headers):
    invoice = _invoice(
        client, reader_headers, bookId="the-salt-roads", chapterId="ch-4", method="mpesa", phone="+254712345678"
    ).get_json()["invoice"]
    failed = _simulate(client, reader_headers, invoice, "failed").get_json()["invoice"]
    assert failed["status"] == "failed" and "cancelled" in failed["failureReason"].lower()


def test_daraja_callback_settles_and_is_matched_by_checkout_id(client, reader_headers, app):
    invoice = _invoice(
        client, reader_headers, bookId="ledger-of-kings", chapterId="ch-2", method="mpesa", phone="0712345678"
    ).get_json()["invoice"]
    with app.app_context():
        from app.models import Invoice
        from app.extensions import db

        checkout_id = db.session.get(Invoice, invoice["paymentHash"]).provider_ref

    def callback(checkout, code=0, amount=invoice["amountKes"]):
        items = [{"Name": "Amount", "Value": amount}, {"Name": "MpesaReceiptNumber", "Value": "SGR7ABC123"}]
        return client.post(
            "/api/mpesa/callback",
            json={"Body": {"stkCallback": {"CheckoutRequestID": checkout, "ResultCode": code, "ResultDesc": "ok",
                                            "CallbackMetadata": {"Item": items}}}},
        )

    # Unknown checkout ids are acknowledged but change nothing.
    assert callback("ws_CO_unknown").get_json()["ResultCode"] == 0
    status = client.get(f"/api/invoices/{invoice['paymentHash']}", headers=reader_headers).get_json()["invoice"]
    assert status["status"] == "pending"

    callback(checkout_id)
    status = client.get(f"/api/invoices/{invoice['paymentHash']}", headers=reader_headers).get_json()["invoice"]
    assert status["status"] == "paid" and status["receipt"] == "SGR7ABC123"
    assert client.get("/api/books/ledger-of-kings/chapters/ch-2", headers=reader_headers).get_json()["unlocked"]


def test_callback_token_is_enforced_when_configured(client, app):
    app.config["MPESA_CALLBACK_TOKEN"] = "s3cret"
    assert client.post("/api/mpesa/callback", json={}).status_code == 403
    assert client.post("/api/mpesa/callback?token=s3cret", json={}).status_code == 200


def test_subscription_unlocks_every_chapter_by_that_author_only(client, reader_headers):
    book = client.get("/api/books/the-salt-roads").get_json()["book"]
    price = book["author"]["subscriptionPriceSats"]
    invoice = _invoice(client, reader_headers, type="subscription", authorNpub=SALT_AUTHOR).get_json()["invoice"]
    assert invoice["purpose"] == "subscription" and invoice["amountSats"] == price

    _simulate(client, reader_headers, invoice)

    for book_id, chapter in [("the-salt-roads", "ch-6"), ("letters-from-the-harmattan", "ch-4")]:
        body = client.get(f"/api/books/{book_id}/chapters/{chapter}", headers=reader_headers).get_json()
        assert body["unlocked"] is True, book_id
    other = client.get("/api/books/ledger-of-kings/chapters/ch-2", headers=reader_headers).get_json()
    assert other["unlocked"] is False

    subs = client.get("/api/readers/me/unlocks", headers=reader_headers).get_json()["subscriptions"]
    assert [s["authorNpub"] for s in subs] == [SALT_AUTHOR]

    # Chapters covered by the subscription can't be bought again.
    dup = _invoice(client, reader_headers, bookId="the-salt-roads", chapterId="ch-5")
    assert dup.status_code == 409


def test_renewing_early_extends_the_subscription(client, reader_headers):
    def subscribe():
        invoice = _invoice(client, reader_headers, type="subscription", authorNpub=SALT_AUTHOR, method="mpesa",
                           phone="0712345678").get_json()["invoice"]
        _simulate(client, reader_headers, invoice)
        return client.get("/api/readers/me/unlocks", headers=reader_headers).get_json()["subscriptions"][0]["expiresAt"]

    first, second = subscribe(), subscribe()
    assert second > first


def test_subscription_revenue_reaches_author_dashboard(client, signer, reader_headers):
    book = client.post(
        "/api/books",
        json={"title": "Subscribed Book", "category": "Fiction",
              "description": "A description that is comfortably longer than forty characters."},
        headers={"Authorization": signer.auth_header("POST", "/api/books")},
    ).get_json()["book"]
    npub = book["author"]["npub"]
    invoice = _invoice(client, reader_headers, type="subscription", authorNpub=npub).get_json()["invoice"]
    _simulate(client, reader_headers, invoice)

    dashboard = client.get("/api/me/dashboard",
                           headers={"Authorization": signer.auth_header("GET", "/api/me/dashboard")}).get_json()
    assert dashboard["stats"]["satsEarned"] == invoice["amountSats"]
    assert dashboard["stats"]["subscribers"] == 1
    assert dashboard["income"][0]["purpose"] == "subscription"
    assert dashboard["income"][0]["reader"] == READER[:14]
