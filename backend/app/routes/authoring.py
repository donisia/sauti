"""Author endpoints. Every route here requires a NIP-98 signed request."""

import re
from datetime import datetime, timedelta, timezone

from flask import current_app, g, jsonify, request

from . import api
from .catalogue import CATEGORIES
from ..extensions import db
from ..models import Author, Book, Chapter, Invoice, utcnow
from ..nostr import hex_to_npub
from ..security import ApiError, require_nostr_auth
from ..serializers import author_full, book_detail, book_summary, chapter_meta, earnings_filter, income_entry

DEFAULT_COVER = {"from": "#3A2414", "to": "#0F1012", "accent": "#F7931A", "motif": "sun"}
_URL = re.compile(r"^https?://\S+$", re.IGNORECASE)


def _slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:80] or "untitled"


def _current_author(create=False):
    author = db.session.get(Author, g.pubkey)
    if not author and create:
        npub = hex_to_npub(g.pubkey)
        author = Author(
            pubkey=g.pubkey,
            npub=npub,
            name="Anonymous Author",
            initials="✦",
            subscription_price_sats=current_app.config["DEFAULT_SUBSCRIPTION_SATS"],
        )
        db.session.add(author)
    return author


def _owned_book(book_id):
    book = db.session.get(Book, book_id)
    if not book:
        raise ApiError("Book not found.", 404, "not_found")
    if book.author_pubkey != g.pubkey:
        raise ApiError("Only the book's author can change it.", 403, "forbidden")
    return book


def _book_fields(body):
    errors = {}
    title = str(body.get("title", "")).strip()
    description = str(body.get("description", "")).strip()
    category = body.get("category")
    cover_url = str(body.get("coverUrl") or "").strip()
    tags = body.get("tags") or []

    if len(title) < 2:
        errors["title"] = "Title must be at least 2 characters."
    if len(description) < 40:
        errors["description"] = "Description must be at least 40 characters."
    if category not in CATEGORIES:
        errors["category"] = f"Category must be one of: {', '.join(CATEGORIES)}."
    if cover_url and not _URL.match(cover_url):
        errors["coverUrl"] = "Cover URL must start with http:// or https://."
    if not isinstance(tags, list):
        errors["tags"] = "Tags must be a list."

    if errors:
        raise ApiError("Please fix the highlighted fields.", 422, "validation_error", errors)

    clean_tags = list(dict.fromkeys(str(t).strip().lower() for t in tags if str(t).strip()))[:8]
    return {
        "title": title[:200],
        "subtitle": str(body.get("subtitle", "")).strip()[:300],
        "category": category,
        "language": str(body.get("language") or "English")[:40],
        "description": description[:1200],
        "cover_url": cover_url or None,
        "tags": clean_tags,
    }


@api.post("/books")
@require_nostr_auth
def create_book():
    body = request.get_json(silent=True) or {}
    fields = _book_fields(body)
    author = _current_author(create=True)

    base = _slugify(fields["title"])
    slug, n = base, 2
    while db.session.get(Book, slug):
        slug, n = f"{base}-{n}", n + 1

    book = Book(id=slug, author=author, cover=DEFAULT_COVER, nostr_event_id=body.get("nostrEventId"), **fields)
    db.session.add(book)
    db.session.commit()
    return jsonify(book=book_detail(book)), 201


@api.put("/books/<book_id>")
@require_nostr_auth
def update_book(book_id):
    book = _owned_book(book_id)
    body = request.get_json(silent=True) or {}
    for key, value in _book_fields(body).items():
        setattr(book, key, value)
    if body.get("nostrEventId"):
        book.nostr_event_id = body["nostrEventId"]
    db.session.commit()
    return jsonify(book=book_detail(book))


@api.post("/books/<book_id>/chapters")
@require_nostr_auth
def create_chapter(book_id):
    book = _owned_book(book_id)
    body = request.get_json(silent=True) or {}
    errors = {}

    try:
        number = int(body.get("number"))
        if number < 1:
            raise ValueError
    except (TypeError, ValueError):
        errors["number"] = "Chapter number must be 1 or more."
        number = None

    title = str(body.get("title", "")).strip()
    if len(title) < 2:
        errors["title"] = "Give the chapter a title."

    raw = str(body.get("content", "")).replace("\r\n", "\n")
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", raw) if p.strip()]
    words = len(raw.split())
    if words < 20:
        errors["content"] = "Write at least 20 words."

    price = 0
    if body.get("access") == "paid":
        try:
            price = int(body.get("priceSats"))
            if not 1 <= price <= 1_000_000:
                raise ValueError
        except (TypeError, ValueError):
            errors["priceSats"] = "Price must be a whole number of sats between 1 and 1,000,000."

    if number and Chapter.query.filter_by(book_id=book.id, number=number).first():
        errors["number"] = f"Chapter {number} already exists in this book."

    if errors:
        raise ApiError("Please fix the highlighted fields.", 422, "validation_error", errors)

    chapter = Chapter(
        book=book,
        slug=f"ch-{number}",
        number=number,
        title=title[:200],
        price_sats=price,
        reading_minutes=max(1, round(words / 230)),
        content=paragraphs,
        nostr_event_id=body.get("nostrEventId"),
    )
    db.session.add(chapter)
    db.session.commit()
    return jsonify(chapter=chapter_meta(chapter), book=book_detail(book)), 201


@api.get("/me/dashboard")
@require_nostr_auth
def dashboard():
    author = _current_author()
    if not author:
        return jsonify(
            author=None,
            npub=hex_to_npub(g.pubkey),
            books=[],
            stats={
                "books": 0,
                "chapters": 0,
                "paidReaders": 0,
                "satsEarned": 0,
                "subscribers": 0,
                "satsToday": 0,
                "satsWeek": 0,
            },
            weekly=[],
            income=[],
        )

    paid = Invoice.query.filter(earnings_filter(author)).order_by(Invoice.paid_at.desc()).all()

    now = utcnow()
    today = now.date()
    weekly = []
    for offset in range(6, -1, -1):
        day = today - timedelta(days=offset)
        weekly.append(
            {
                "date": day.isoformat(),
                "label": day.strftime("%a"),
                "sats": sum(i.amount_sats for i in paid if i.paid_at.date() == day),
            }
        )

    full = author_full(author)
    stats = {
        **full["stats"],
        "satsToday": sum(i.amount_sats for i in paid if now - i.paid_at < timedelta(hours=24)),
        "satsWeek": sum(d["sats"] for d in weekly),
    }
    return jsonify(
        author=full,
        npub=author.npub,
        books=[{**book_summary(b), "chapters": [chapter_meta(c) for c in b.chapters]} for b in author.books],
        stats=stats,
        weekly=weekly,
        income=[income_entry(i) for i in paid[:50]],
    )
