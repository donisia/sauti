"""Load the demo catalogue from seeds/catalogue.json."""

import hashlib
import json
import math
import secrets
from datetime import datetime, timedelta

from flask import current_app

from .config import BASE_DIR
from .extensions import db
from .models import Author, Book, Chapter, Invoice, Subscription, Unlock, utcnow

SEED_FILES = [BASE_DIR / "seeds" / "catalogue.json", BASE_DIR / "seeds" / "african_literature.json"]

# Monthly subscription price per seed author, in catalogue order.
SUBSCRIPTION_PRICES = [4000, 3500, 2000, 5000]
# (author index, reader id, hours ago)
SEED_SUBSCRIBERS = [(0, "rdr_seed_mpesa_000001", 3.5), (3, "rdr_seed_mpesa_000002", 27), (3, "rdr_seed_mpesa_000003", 50)]


def _fake_pubkey(npub):
    # Seed authors are fictional, so derive a stable placeholder pubkey.
    return hashlib.sha256(npub.encode()).hexdigest()


def _load_seed_data():
    data = {"authors": [], "books": [], "income": []}
    for path in SEED_FILES:
        chunk = json.loads(path.read_text(encoding="utf-8"))
        for key in data:
            data[key].extend(chunk.get(key, []))
    return data


def seed_database():
    data = _load_seed_data()
    config = current_app.config
    now = utcnow()

    db.session.add(
        Author(
            pubkey=config["DEMO_PUBKEY"],
            npub=config["DEMO_NPUB"],
            name="Demo Author",
            initials="DA",
            bio="The simulated identity used when no NIP-07 signer is installed. Publish a book to see it here.",
            location="Somewhere on the network",
            lightning_address="demo@sovereign.pub",
            avatar_hue=30,
            joined_at=now,
        )
    )

    pubkeys = {}
    for index, a in enumerate(data["authors"]):
        pubkeys[a["npub"]] = _fake_pubkey(a["npub"])
        db.session.add(
            Author(
                pubkey=pubkeys[a["npub"]],
                npub=a["npub"],
                name=a["name"],
                initials=a["initials"],
                bio=a["bio"],
                location=a["location"],
                lightning_address=a["lightningAddress"],
                avatar_hue=a["avatarHue"],
                subscription_price_sats=SUBSCRIPTION_PRICES[index % len(SUBSCRIPTION_PRICES)],
                joined_at=datetime.fromisoformat(a["joined"]),
            )
        )

    chapters = {}
    for b in data["books"]:
        published = datetime.fromisoformat(b["publishedAt"])
        book = Book(
            id=b["id"],
            author_pubkey=pubkeys[b["authorNpub"]],
            title=b["title"],
            subtitle=b.get("subtitle", ""),
            category=b["category"],
            language=b["language"],
            format=b.get("format", "prose"),
            description=b["description"],
            tags=b.get("tags", []),
            cover=b.get("cover"),
            cover_url=b.get("coverUrl"),
            featured=b.get("featured", False),
            nostr_event_id=b.get("nostrEventId"),
            published_at=published,
        )
        db.session.add(book)
        for c in b["chapters"]:
            chapter = Chapter(
                book=book,
                slug=c["id"],
                number=c["number"],
                title=c["title"],
                price_sats=c["priceSats"],
                reading_minutes=c["readingMinutes"],
                content=c["content"],
                published_at=published + timedelta(days=c["number"] - 1),
            )
            db.session.add(chapter)
            chapters[(b["id"], c["id"])] = chapter

    db.session.flush()

    for entry in data["income"]:
        chapter = chapters[(entry["bookId"], entry["chapterId"])]
        paid_at = now - timedelta(hours=entry["hoursAgo"])
        payment_hash = secrets.token_hex(32)
        db.session.add(
            Invoice(
                payment_hash=payment_hash,
                bolt11=f"lnbc{entry['sats'] * 10}n1pseed{payment_hash[:40]}",
                chapter_id=chapter.id,
                reader_id=entry["reader"],
                amount_sats=entry["sats"],
                status="paid",
                created_at=paid_at - timedelta(seconds=20),
                expires_at=paid_at + timedelta(minutes=10),
                paid_at=paid_at,
            )
        )
        db.session.add(
            Unlock(reader_id=entry["reader"], chapter_id=chapter.id, invoice_hash=payment_hash, created_at=paid_at)
        )

    # A few monthly subscribers who paid with M-Pesa.
    for npub_index, reader, hours_ago in SEED_SUBSCRIBERS:
        author_pubkey = pubkeys[data["authors"][npub_index]["npub"]]
        sats = SUBSCRIPTION_PRICES[npub_index % len(SUBSCRIPTION_PRICES)]
        paid_at = now - timedelta(hours=hours_ago)
        payment_hash = secrets.token_hex(32)
        db.session.add(
            Invoice(
                payment_hash=payment_hash,
                method="mpesa",
                purpose="subscription",
                author_pubkey=author_pubkey,
                reader_id=reader,
                amount_sats=sats,
                amount_kes=max(1, math.ceil(sats * config["KES_PER_SAT"])),
                phone="254700000000",
                provider_ref=f"ws_CO_seed{payment_hash[:16]}",
                receipt=f"S{payment_hash[:9].upper()}",
                status="paid",
                created_at=paid_at - timedelta(seconds=30),
                expires_at=paid_at + timedelta(minutes=3),
                paid_at=paid_at,
            )
        )
        db.session.add(
            Subscription(
                reader_id=reader,
                author_pubkey=author_pubkey,
                invoice_hash=payment_hash,
                started_at=paid_at,
                expires_at=paid_at + timedelta(days=config["SUBSCRIPTION_DAYS"]),
            )
        )

    db.session.commit()
    return {
        "authors": len(data["authors"]) + 1,
        "books": len(data["books"]),
        "payments": len(data["income"]) + len(SEED_SUBSCRIBERS),
    }
