from .conftest import READER


def test_health(client):
    body = client.get("/api/health").get_json()
    assert body["status"] == "ok" and body["demoMode"] is True


def test_list_and_filter_books(client):
    all_books = client.get("/api/books").get_json()
    assert len(all_books["books"]) == 25
    assert all_books["categoryCounts"]["Fiction"] == 8
    assert all_books["categoryCounts"]["Feminism"] == 7

    covered = {b["id"]: b["coverUrl"] for b in all_books["books"] if b["coverUrl"]}
    assert covered["burgers-daughter"] == "/covers/burgers-daughter.png"
    assert covered["things-fall-apart"] == "/covers/things-fall-apart.jpg"
    assert len(covered) == 10

    poetry = client.get("/api/books?category=Poetry").get_json()["books"]
    assert [b["id"] for b in poetry] == ["small-hours"]

    by_tag = client.get("/api/books?q=lisbon").get_json()["books"]
    assert [b["id"] for b in by_tag] == ["cartographers-of-ash"]

    by_author = client.get("/api/books?q=mwandishi").get_json()["books"]
    assert {b["id"] for b in by_author} == {"the-quiet-republic", "protocols-of-trust"}


def test_book_detail_never_includes_chapter_content(client):
    book = client.get("/api/books/the-salt-roads").get_json()["book"]
    assert book["startingPrice"] == 210
    assert len(book["chapters"]) == 6
    assert all("content" not in c and "paragraphs" not in c for c in book["chapters"])


def test_unknown_book_is_404_json(client):
    response = client.get("/api/books/nope")
    assert response.status_code == 404
    assert response.get_json()["error"]["code"] == "not_found"


def test_free_chapter_is_readable(client):
    body = client.get("/api/books/the-salt-roads/chapters/ch-1").get_json()
    assert body["unlocked"] is True and len(body["paragraphs"]) == 5


def test_paid_chapter_only_returns_preview_until_paid(client, reader_headers):
    url = "/api/books/the-salt-roads/chapters/ch-3"
    locked = client.get(url, headers=reader_headers).get_json()
    assert locked["unlocked"] is False and len(locked["paragraphs"]) == 2

    invoice = client.post(
        "/api/invoices", json={"bookId": "the-salt-roads", "chapterId": "ch-3"}, headers=reader_headers
    ).get_json()["invoice"]
    assert invoice["status"] == "pending" and invoice["amountSats"] == 210
    assert invoice["bolt11"].startswith("lnbc2100n1p")

    paid = client.post(
        f"/api/invoices/{invoice['paymentHash']}/simulate", json={"outcome": "paid"}, headers=reader_headers
    ).get_json()["invoice"]
    assert paid["status"] == "paid"

    unlocked = client.get(url, headers=reader_headers).get_json()
    assert unlocked["unlocked"] is True and len(unlocked["paragraphs"]) == 5

    unlocks = client.get("/api/readers/me/unlocks", headers=reader_headers).get_json()["unlocks"]
    assert "the-salt-roads:ch-3" in unlocks

    # Another reader still sees only the preview.
    other = client.get(url, headers={"X-Reader-Id": "rdr_someone_else_123"}).get_json()
    assert other["unlocked"] is False


def test_failed_payment_does_not_unlock(client, reader_headers):
    invoice = client.post(
        "/api/invoices", json={"bookId": "ledger-of-kings", "chapterId": "ch-2"}, headers=reader_headers
    ).get_json()["invoice"]
    client.post(f"/api/invoices/{invoice['paymentHash']}/simulate", json={"outcome": "failed"}, headers=reader_headers)
    body = client.get("/api/books/ledger-of-kings/chapters/ch-2", headers=reader_headers).get_json()
    assert body["unlocked"] is False


def test_invoices_are_private_to_their_reader(client, reader_headers):
    invoice = client.post(
        "/api/invoices", json={"bookId": "ledger-of-kings", "chapterId": "ch-2"}, headers=reader_headers
    ).get_json()["invoice"]
    response = client.post(
        f"/api/invoices/{invoice['paymentHash']}/simulate",
        json={"outcome": "paid"},
        headers={"X-Reader-Id": "rdr_attacker_00000001"},
    )
    assert response.status_code == 404


def test_cannot_invoice_free_chapter_or_without_reader_id(client, reader_headers):
    free = client.post("/api/invoices", json={"bookId": "the-salt-roads", "chapterId": "ch-1"}, headers=reader_headers)
    assert free.status_code == 400
    anonymous = client.post("/api/invoices", json={"bookId": "the-salt-roads", "chapterId": "ch-3"})
    assert anonymous.status_code == 400


def test_demo_lock_toggle(client, reader_headers):
    url = "/api/readers/me/unlocks/protocols-of-trust/ch-3"
    assert client.put(url, headers=reader_headers).get_json()["unlocked"] is True
    assert client.get("/api/books/protocols-of-trust/chapters/ch-3", headers=reader_headers).get_json()["unlocked"]
    assert client.delete(url, headers=reader_headers).get_json()["unlocked"] is False
    assert not client.get("/api/books/protocols-of-trust/chapters/ch-3", headers=reader_headers).get_json()["unlocked"]


def test_author_page(client):
    first = client.get("/api/books").get_json()["books"][0]["author"]["npub"]
    body = client.get(f"/api/authors/{first}").get_json()
    assert body["author"]["stats"]["books"] == len(body["books"]) > 0


BOOK = {
    "title": "A Signed Book",
    "subtitle": "Tested end to end",
    "category": "Technology",
    "language": "English",
    "description": "A description that is comfortably longer than forty characters.",
    "tags": ["Nostr", "nostr", "testing"],
}


def test_publishing_requires_nostr_auth(client):
    response = client.post("/api/books", json=BOOK)
    assert response.status_code == 401


def test_author_publishes_book_and_paid_chapter(client, signer, reader_headers):
    auth = {"Authorization": signer.auth_header("POST", "http://localhost:5173/api/books")}
    created = client.post("/api/books", json=BOOK, headers=auth)
    assert created.status_code == 201
    book = created.get_json()["book"]
    assert book["id"] == "a-signed-book" and book["tags"] == ["nostr", "testing"]
    assert book["author"]["pubkey"] == signer.pubkey

    chapters_url = f"/api/books/{book['id']}/chapters"
    chapter_body = {
        "number": 1,
        "title": "Paid opening",
        "content": "First paragraph " * 10 + "\n\n" + "Second paragraph " * 10 + "\n\nThird.",
        "access": "paid",
        "priceSats": 500,
    }
    auth = {"Authorization": signer.auth_header("POST", chapters_url)}
    chapter = client.post(chapters_url, json=chapter_body, headers=auth)
    assert chapter.status_code == 201
    assert chapter.get_json()["chapter"]["priceSats"] == 500

    # Readers see only the preview (at most half of a short chapter); the
    # dashboard reflects the catalogue.
    read = client.get(f"/api/books/{book['id']}/chapters/ch-1", headers=reader_headers).get_json()
    assert read["unlocked"] is False and len(read["paragraphs"]) == 1

    auth = {"Authorization": signer.auth_header("GET", "/api/me/dashboard")}
    dashboard = client.get("/api/me/dashboard", headers=auth).get_json()
    assert dashboard["stats"]["books"] == 1 and dashboard["stats"]["chapters"] == 1

    # Pay for it and check the author's earnings.
    invoice = client.post(
        "/api/invoices", json={"bookId": book["id"], "chapterId": "ch-1"}, headers=reader_headers
    ).get_json()["invoice"]
    client.post(f"/api/invoices/{invoice['paymentHash']}/simulate", json={"outcome": "paid"}, headers=reader_headers)
    auth = {"Authorization": signer.auth_header("GET", "/api/me/dashboard")}
    dashboard = client.get("/api/me/dashboard", headers=auth).get_json()
    assert dashboard["stats"]["satsEarned"] == 500 and dashboard["stats"]["paidReaders"] == 1
    assert dashboard["income"][0]["reader"] == READER[:14]


def test_only_owner_can_edit_or_add_chapters(client, signer):
    other = signer.__class__("eve")
    url = "/api/books/the-salt-roads"
    response = client.put(url, json=BOOK, headers={"Authorization": other.auth_header("PUT", url)})
    assert response.status_code == 403

    url = "/api/books/the-salt-roads/chapters"
    response = client.post(
        url,
        json={"number": 9, "title": "Nope", "content": "word " * 30},
        headers={"Authorization": other.auth_header("POST", url)},
    )
    assert response.status_code == 403


def test_book_validation_errors_are_reported_per_field(client, signer):
    response = client.post(
        "/api/books",
        json={"title": "x", "description": "short", "category": "Cooking", "coverUrl": "ftp://nope"},
        headers={"Authorization": signer.auth_header("POST", "/api/books")},
    )
    assert response.status_code == 422
    assert set(response.get_json()["error"]["fields"]) == {"title", "description", "category", "coverUrl"}


def test_duplicate_chapter_number_rejected(client, signer):
    created = client.post(
        "/api/books", json=BOOK, headers={"Authorization": signer.auth_header("POST", "/api/books")}
    ).get_json()["book"]
    url = f"/api/books/{created['id']}/chapters"
    body = {"number": 1, "title": "One", "content": "word " * 30, "access": "free"}
    assert client.post(url, json=body, headers={"Authorization": signer.auth_header("POST", url)}).status_code == 201
    dup = client.post(url, json=body, headers={"Authorization": signer.auth_header("POST", url)})
    assert dup.status_code == 422 and "number" in dup.get_json()["error"]["fields"]
