"""Who may read what: single-chapter unlocks and monthly subscriptions."""

from datetime import timedelta

from flask import current_app

from .extensions import db
from .models import Subscription, Unlock, utcnow


def active_subscription(reader, author_pubkey):
    return (
        Subscription.query.filter(
            Subscription.reader_id == reader,
            Subscription.author_pubkey == author_pubkey,
            Subscription.expires_at > utcnow(),
        )
        .order_by(Subscription.expires_at.desc())
        .first()
    )


def reader_owns_chapter(reader, chapter):
    if chapter.is_free:
        return True
    if not reader:
        return False
    if Unlock.query.filter_by(reader_id=reader, chapter_id=chapter.id).first():
        return True
    return active_subscription(reader, chapter.book.author_pubkey) is not None


def grant(invoice):
    """Give the reader what they paid for (idempotent per invoice)."""
    if invoice.purpose == "subscription":
        if Subscription.query.filter_by(invoice_hash=invoice.payment_hash).first():
            return
        now = utcnow()
        current = active_subscription(invoice.reader_id, invoice.author_pubkey)
        # Renewing early extends the current period instead of overlapping it.
        start = current.expires_at if current else now
        db.session.add(
            Subscription(
                reader_id=invoice.reader_id,
                author_pubkey=invoice.author_pubkey,
                invoice_hash=invoice.payment_hash,
                started_at=now,
                expires_at=start + timedelta(days=current_app.config["SUBSCRIPTION_DAYS"]),
            )
        )
    elif not Unlock.query.filter_by(reader_id=invoice.reader_id, chapter_id=invoice.chapter_id).first():
        db.session.add(Unlock(reader_id=invoice.reader_id, chapter_id=invoice.chapter_id, invoice_hash=invoice.payment_hash))
