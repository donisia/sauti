"""Public read endpoints: books, chapters, authors."""

from flask import current_app, jsonify, request
from sqlalchemy import String, cast, or_

from . import api
from ..extensions import db
from ..entitlements import reader_owns_chapter
from ..models import Author, Book, Chapter
from ..security import ApiError
from ..serializers import author_full, book_detail, book_summary, chapter_read

CATEGORIES = ["Fiction", "Feminism", "Non-fiction", "Politics", "History", "Culture", "Technology", "Poetry"]


@api.get("/health")
def health():
    config = current_app.config
    return jsonify(
        status="ok",
        lightningProvider=config["LIGHTNING_PROVIDER"],
        demoMode=config["DEMO_MODE"],
        payments={
            "methods": ["lightning", "mpesa"],
            "kesPerSat": config["KES_PER_SAT"],
            "mpesaProvider": config["MPESA_PROVIDER"],
            "subscriptionDays": config["SUBSCRIPTION_DAYS"],
        },
    )


@api.get("/books")
def list_books():
    query = Book.query.join(Author)

    category = request.args.get("category")
    if category and category != "All":
        query = query.filter(Book.category == category)

    if request.args.get("featured") in {"1", "true"}:
        query = query.filter(Book.featured.is_(True))

    author = request.args.get("author")
    if author:
        query = query.filter(Author.npub == author)

    needle = (request.args.get("q") or "").strip()
    if needle:
        like = f"%{needle}%"
        query = query.filter(
            or_(
                Book.title.ilike(like),
                Book.subtitle.ilike(like),
                Book.description.ilike(like),
                cast(Book.tags, String).ilike(like),
                Author.name.ilike(like),
            )
        )

    books = query.order_by(Book.featured.desc(), Book.published_at.desc()).all()
    counts = dict(db.session.query(Book.category, db.func.count()).group_by(Book.category).all())
    return jsonify(
        books=[book_summary(b) for b in books],
        categoryCounts={"All": sum(counts.values()), **{c: counts.get(c, 0) for c in CATEGORIES}},
    )


def _get_book(book_id):
    book = db.session.get(Book, book_id)
    if not book:
        raise ApiError("Book not found.", 404, "not_found")
    return book


@api.get("/books/<book_id>")
def get_book(book_id):
    return jsonify(book=book_detail(_get_book(book_id)))


@api.get("/books/<book_id>/chapters/<chapter_slug>")
def read_chapter(book_id, chapter_slug):
    chapter = Chapter.query.filter_by(book_id=book_id, slug=chapter_slug).first()
    if not chapter:
        raise ApiError("Chapter not found.", 404, "not_found")

    unlocked = reader_owns_chapter(request.headers.get("X-Reader-Id"), chapter)
    return jsonify(chapter_read(chapter, unlocked))


@api.get("/authors/<npub>")
def get_author(npub):
    author = Author.query.filter_by(npub=npub).first()
    if not author:
        raise ApiError("Author not found.", 404, "not_found")
    return jsonify(author=author_full(author), books=[book_summary(b) for b in author.books])
