from datetime import datetime, timezone

from .extensions import db


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Author(db.Model):
    """A publishing identity, keyed by its Nostr public key (hex)."""

    pubkey = db.Column(db.String(64), primary_key=True)
    npub = db.Column(db.String(80), unique=True, nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    initials = db.Column(db.String(4), nullable=False, default="?")
    bio = db.Column(db.Text, nullable=False, default="")
    location = db.Column(db.String(120), nullable=False, default="")
    lightning_address = db.Column(db.String(160), nullable=False, default="")
    avatar_hue = db.Column(db.Integer, nullable=False, default=30)
    subscription_price_sats = db.Column(db.Integer, nullable=False, default=3000)
    joined_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    books = db.relationship("Book", back_populates="author", order_by="Book.published_at.desc()")


class Book(db.Model):
    id = db.Column(db.String(120), primary_key=True)  # URL slug
    author_pubkey = db.Column(db.String(64), db.ForeignKey("author.pubkey"), nullable=False, index=True)
    title = db.Column(db.String(200), nullable=False)
    subtitle = db.Column(db.String(300), nullable=False, default="")
    category = db.Column(db.String(40), nullable=False, index=True)
    language = db.Column(db.String(40), nullable=False, default="English")
    format = db.Column(db.String(10), nullable=False, default="prose")  # prose | verse
    description = db.Column(db.Text, nullable=False)
    tags = db.Column(db.JSON, nullable=False, default=list)
    cover = db.Column(db.JSON, nullable=True)  # generated-cover palette
    cover_url = db.Column(db.String(500), nullable=True)
    featured = db.Column(db.Boolean, nullable=False, default=False)
    nostr_event_id = db.Column(db.String(100), nullable=True)
    published_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    author = db.relationship("Author", back_populates="books")
    chapters = db.relationship(
        "Chapter", back_populates="book", order_by="Chapter.number", cascade="all, delete-orphan"
    )


class Chapter(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    book_id = db.Column(db.String(120), db.ForeignKey("book.id"), nullable=False, index=True)
    slug = db.Column(db.String(20), nullable=False)  # public id, e.g. "ch-3"
    number = db.Column(db.Integer, nullable=False)
    title = db.Column(db.String(200), nullable=False)
    price_sats = db.Column(db.Integer, nullable=False, default=0)
    reading_minutes = db.Column(db.Integer, nullable=False, default=1)
    content = db.Column(db.JSON, nullable=False, default=list)  # list of paragraphs
    nostr_event_id = db.Column(db.String(100), nullable=True)
    published_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    book = db.relationship("Book", back_populates="chapters")

    __table_args__ = (
        db.UniqueConstraint("book_id", "number", name="uq_chapter_number"),
        db.UniqueConstraint("book_id", "slug", name="uq_chapter_slug"),
    )

    @property
    def is_free(self):
        return self.price_sats == 0


class Invoice(db.Model):
    """
    One payment attempt by a reader, for a single chapter or a monthly
    subscription, over Lightning or M-Pesa.
    """

    payment_hash = db.Column(db.String(64), primary_key=True)  # Lightning hash, or a random id for M-Pesa
    method = db.Column(db.String(10), nullable=False, default="lightning")  # lightning | mpesa
    purpose = db.Column(db.String(15), nullable=False, default="chapter")  # chapter | subscription
    chapter_id = db.Column(db.Integer, db.ForeignKey("chapter.id"), nullable=True, index=True)
    author_pubkey = db.Column(db.String(64), db.ForeignKey("author.pubkey"), nullable=True, index=True)
    reader_id = db.Column(db.String(64), nullable=False, index=True)
    amount_sats = db.Column(db.Integer, nullable=False)
    amount_kes = db.Column(db.Integer, nullable=True)
    status = db.Column(db.String(10), nullable=False, default="pending")  # pending | paid | failed | expired
    bolt11 = db.Column(db.Text, nullable=True)
    phone = db.Column(db.String(15), nullable=True)
    provider_ref = db.Column(db.String(80), nullable=True, index=True)  # M-Pesa CheckoutRequestID
    receipt = db.Column(db.String(40), nullable=True)  # M-Pesa receipt number
    failure_reason = db.Column(db.String(200), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    checked_at = db.Column(db.DateTime, nullable=True)
    paid_at = db.Column(db.DateTime, nullable=True)

    chapter = db.relationship("Chapter")
    author = db.relationship("Author")

    @property
    def beneficiary_pubkey(self):
        """The author who earns this payment."""
        return self.author_pubkey or self.chapter.book.author_pubkey


class Subscription(db.Model):
    """A reader's monthly pass to every paid chapter by one author."""

    id = db.Column(db.Integer, primary_key=True)
    reader_id = db.Column(db.String(64), nullable=False, index=True)
    author_pubkey = db.Column(db.String(64), db.ForeignKey("author.pubkey"), nullable=False, index=True)
    invoice_hash = db.Column(db.String(64), db.ForeignKey("invoice.payment_hash"), nullable=True)
    started_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)

    author = db.relationship("Author")


class Unlock(db.Model):
    """A reader's entitlement to a paid chapter."""

    id = db.Column(db.Integer, primary_key=True)
    reader_id = db.Column(db.String(64), nullable=False, index=True)
    chapter_id = db.Column(db.Integer, db.ForeignKey("chapter.id"), nullable=False)
    invoice_hash = db.Column(db.String(64), db.ForeignKey("invoice.payment_hash"), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    chapter = db.relationship("Chapter")

    __table_args__ = (db.UniqueConstraint("reader_id", "chapter_id", name="uq_reader_chapter"),)
