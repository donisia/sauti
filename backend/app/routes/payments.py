"""Payments (Lightning or M-Pesa), monthly subscriptions, and reader entitlements."""

import math
import secrets
from datetime import timedelta

from flask import current_app, jsonify, request

from . import api
from ..entitlements import grant, reader_owns_chapter
from ..extensions import db
from ..lightning import get_provider
from ..models import Author, Chapter, Invoice, Subscription, Unlock, utcnow
from ..mpesa import MpesaError, get_mpesa_provider, normalize_phone, parse_callback
from ..security import ApiError, reader_id, require_demo_mode
from ..serializers import iso, invoice_json

METHODS = ("lightning", "mpesa")


def sats_to_kes(sats):
    return max(1, math.ceil(sats * current_app.config["KES_PER_SAT"]))


def _chapter_or_404(book_id, chapter_slug):
    chapter = Chapter.query.filter_by(book_id=book_id, slug=chapter_slug).first()
    if not chapter:
        raise ApiError("Chapter not found.", 404, "not_found")
    return chapter


def _invoice_for_reader(payment_hash, reader):
    invoice = db.session.get(Invoice, payment_hash)
    if not invoice or invoice.reader_id != reader:
        raise ApiError("Invoice not found.", 404, "not_found")
    return invoice


def _mpesa():
    try:
        return get_mpesa_provider(current_app.config)
    except MpesaError as error:
        raise ApiError(str(error), 503, "mpesa_unavailable")


def _settle(invoice, receipt=None):
    """Mark an invoice paid and grant its chapter or subscription (idempotent)."""
    invoice.status = "paid"
    invoice.paid_at = invoice.paid_at or utcnow()
    invoice.receipt = receipt or invoice.receipt
    grant(invoice)


def _fail(invoice, reason):
    invoice.status = "failed"
    invoice.failure_reason = (reason or "The payment was not completed.")[:200]


def _refresh(invoice):
    """Ask the provider about a pending invoice, then apply expiry."""
    if invoice.status != "pending":
        return
    now = utcnow()
    if invoice.method == "lightning":
        if get_provider(current_app.config["LIGHTNING_PROVIDER"]).is_paid(invoice.payment_hash):
            _settle(invoice)
            return
    elif invoice.provider_ref:
        interval = timedelta(seconds=current_app.config["MPESA_QUERY_INTERVAL_SECONDS"])
        if not invoice.checked_at or now - invoice.checked_at >= interval:
            invoice.checked_at = now
            try:
                result = _mpesa().query(invoice.provider_ref)
            except (ApiError, MpesaError):
                result = {"status": "pending"}
            if result["status"] == "paid":
                _settle(invoice, result.get("receipt"))
                return
            if result["status"] == "failed":
                _fail(invoice, result.get("reason"))
                return
    if now >= invoice.expires_at:
        invoice.status = "expired"


def _purchase(body, reader):
    """Resolve what is being bought into invoice fields."""
    if body.get("type") == "subscription":
        author = Author.query.filter_by(npub=body.get("authorNpub")).first()
        if not author:
            raise ApiError("Author not found.", 404, "not_found")
        days = current_app.config["SUBSCRIPTION_DAYS"]
        return {
            "purpose": "subscription",
            "author_pubkey": author.pubkey,
            "amount_sats": author.subscription_price_sats,
            "memo": f"{author.name} · {days}-day subscription",
            "reference": "Subscription",
        }

    chapter = _chapter_or_404(body.get("bookId"), body.get("chapterId"))
    if chapter.is_free:
        raise ApiError("This chapter is free — no payment needed.", 400, "chapter_free")
    if reader_owns_chapter(reader, chapter):
        raise ApiError("You already own this chapter.", 409, "already_unlocked")
    return {
        "purpose": "chapter",
        "chapter_id": chapter.id,
        "amount_sats": chapter.price_sats,
        "memo": f"{chapter.book.title} · Chapter {chapter.number}",
        "reference": f"Ch{chapter.number}",
    }


@api.post("/invoices")
def create_invoice():
    """
    Body: { bookId, chapterId } for one chapter, or { type: "subscription", authorNpub },
    plus optional { method: "lightning" | "mpesa", phone } (phone is required for M-Pesa).
    """
    reader = reader_id()
    body = request.get_json(silent=True) or {}
    method = body.get("method") or "lightning"
    if method not in METHODS:
        raise ApiError("method must be 'lightning' or 'mpesa'.", 400, "invalid_method")

    purchase = _purchase(body, reader)
    memo, reference = purchase.pop("memo"), purchase.pop("reference")
    now = utcnow()
    config = current_app.config

    if method == "lightning":
        created = get_provider(config["LIGHTNING_PROVIDER"]).create_invoice(purchase["amount_sats"], memo)
        invoice = Invoice(
            payment_hash=created["payment_hash"],
            method="lightning",
            bolt11=created["bolt11"],
            reader_id=reader,
            status="pending",
            created_at=now,
            expires_at=now + timedelta(seconds=config["INVOICE_TTL_SECONDS"]),
            **purchase,
        )
    else:
        phone = normalize_phone(body.get("phone"))
        if not phone:
            raise ApiError(
                "Enter a Safaricom number like 0712 345 678.",
                422,
                "validation_error",
                {"phone": "Enter a Safaricom number like 0712 345 678."},
            )
        amount_kes = sats_to_kes(purchase["amount_sats"])
        try:
            pushed = _mpesa().stk_push(amount_kes, phone, reference, "Sauti")
        except MpesaError as error:
            raise ApiError(str(error), 502, "mpesa_failed")
        invoice = Invoice(
            payment_hash=secrets.token_hex(32),
            method="mpesa",
            phone=phone,
            amount_kes=amount_kes,
            provider_ref=pushed["checkout_request_id"],
            reader_id=reader,
            status="pending",
            created_at=now,
            checked_at=now,
            expires_at=now + timedelta(seconds=config["MPESA_TTL_SECONDS"]),
            **purchase,
        )

    db.session.add(invoice)
    db.session.commit()
    return jsonify(invoice=invoice_json(invoice)), 201


@api.get("/invoices/<payment_hash>")
def get_invoice(payment_hash):
    invoice = _invoice_for_reader(payment_hash, reader_id())
    _refresh(invoice)
    db.session.commit()
    return jsonify(invoice=invoice_json(invoice))


@api.post("/invoices/<payment_hash>/simulate")
def simulate_invoice(payment_hash):
    """Demo-only: settle or fail a mock invoice (Lightning or M-Pesa)."""
    require_demo_mode()
    invoice = _invoice_for_reader(payment_hash, reader_id())
    config = current_app.config
    provider = get_provider(config["LIGHTNING_PROVIDER"]) if invoice.method == "lightning" else _mpesa()
    if not provider.supports_simulation:
        raise ApiError("The configured payment provider can't be simulated.", 400, "simulation_unsupported")

    _refresh(invoice)
    if invoice.status != "pending":
        raise ApiError(f"Invoice is already {invoice.status}.", 409, "invoice_not_pending")

    outcome = (request.get_json(silent=True) or {}).get("outcome")
    if outcome == "paid":
        receipt = f"S{secrets.token_hex(5).upper()}" if invoice.method == "mpesa" else None
        _settle(invoice, receipt)
    elif outcome == "failed":
        _fail(invoice, "Request cancelled by user." if invoice.method == "mpesa" else "No route to the author's node.")
    else:
        raise ApiError("outcome must be 'paid' or 'failed'.", 400, "invalid_outcome")

    db.session.commit()
    return jsonify(invoice=invoice_json(invoice))


@api.post("/mpesa/callback")
def mpesa_callback():
    """
    Daraja STK Push result webhook. Daraja doesn't sign callbacks, so we only
    accept results for a pending M-Pesa invoice whose CheckoutRequestID and
    amount match, optionally gated by MPESA_CALLBACK_TOKEN.
    """
    token = current_app.config["MPESA_CALLBACK_TOKEN"]
    if token and not secrets.compare_digest(request.args.get("token", ""), token):
        raise ApiError("Invalid callback token.", 403, "forbidden")

    result = parse_callback(request.get_json(silent=True))
    invoice = (
        Invoice.query.filter_by(method="mpesa", provider_ref=result["checkout_request_id"]).first()
        if result["checkout_request_id"]
        else None
    )
    if invoice and invoice.status in ("pending", "expired"):
        if result["result_code"] == "0":
            if result["amount"] is None or int(float(result["amount"])) >= invoice.amount_kes:
                _settle(invoice, result["receipt"])
            else:
                _fail(invoice, "Amount paid did not match the invoice.")
        else:
            _fail(invoice, result["result_desc"])
        db.session.commit()

    # Daraja only needs an acknowledgement.
    return jsonify(ResultCode=0, ResultDesc="Accepted")


@api.get("/readers/me/unlocks")
def list_unlocks():
    reader = reader_id()
    unlocks = Unlock.query.filter_by(reader_id=reader).all()
    subscriptions = {}
    for sub in Subscription.query.filter(Subscription.reader_id == reader, Subscription.expires_at > utcnow()).all():
        current = subscriptions.get(sub.author.npub)
        if not current or sub.expires_at > current["_expires"]:
            subscriptions[sub.author.npub] = {
                "authorNpub": sub.author.npub,
                "authorName": sub.author.name,
                "expiresAt": iso(sub.expires_at),
                "_expires": sub.expires_at,
            }
    return jsonify(
        unlocks=[f"{u.chapter.book_id}:{u.chapter.slug}" for u in unlocks],
        subscriptions=[{k: v for k, v in s.items() if k != "_expires"} for s in subscriptions.values()],
    )


@api.put("/readers/me/unlocks/<book_id>/<chapter_slug>")
def demo_unlock(book_id, chapter_slug):
    """Demo-only toggle: grant a chapter without paying."""
    require_demo_mode()
    reader = reader_id()
    chapter = _chapter_or_404(book_id, chapter_slug)
    if not Unlock.query.filter_by(reader_id=reader, chapter_id=chapter.id).first():
        db.session.add(Unlock(reader_id=reader, chapter_id=chapter.id))
        db.session.commit()
    return jsonify(unlocked=True)


@api.delete("/readers/me/unlocks/<book_id>/<chapter_slug>")
def demo_lock(book_id, chapter_slug):
    """Demo-only toggle: revoke a chapter so the paywall can be tested again."""
    require_demo_mode()
    reader = reader_id()
    chapter = _chapter_or_404(book_id, chapter_slug)
    Unlock.query.filter_by(reader_id=reader, chapter_id=chapter.id).delete()
    db.session.commit()
    return jsonify(unlocked=reader_owns_chapter(reader, chapter))
