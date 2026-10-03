"""Small server boundary for the Sirah Journey.

Run with ``uv run api.py``. Turath is deliberately reachable only here; browser
code talks to the bounded endpoints below and never receives credentials.
"""
from __future__ import annotations

import json
import os
import re
import sys
from dataclasses import asdict, dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen

from guide import CHAPTER, STEPS, OpenAIGuideProvider

CATEGORY_ID = 24
MAX_QUERY = 240
MAX_PAGE = 10
MAX_RESULTS = 20
MAX_EXCERPT = 6000
DEFAULT_BASE = "https://api.turath.io"
WORKING_BOOK_ALLOWLIST = {"930", "13606", "9820"}
UI_LANGUAGES = {locale['code'] for locale in json.loads(
    Path(__file__).with_name('locales.config.json').read_text()
)['locales']}


class BoundaryError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


@dataclass(frozen=True)
class Citation:
    book_id: str
    page_id: str
    book: str
    author: str
    volume: str | None
    page: str | None
    heading: str | None
    excerpt: str


def _text(value: Any, limit: int = MAX_EXCERPT) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        value = json.dumps(value, ensure_ascii=False)
    return str(value).strip()[:limit]


def _first(item: dict[str, Any], *names: str) -> Any:
    for name in names:
        if name in item and item[name] is not None:
            return item[name]
    return None


def _items(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if not isinstance(payload, dict):
        raise BoundaryError("Turath returned malformed JSON", 502)
    for key in ("results", "data", "items", "books", "pages"):
        value = payload.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
        if isinstance(value, dict):
            return [value]
    if any(key in payload for key in ("book_id", "page_id", "id")):
        return [payload]
    raise BoundaryError("Turath response has no bounded result list", 502)


def normalize_result(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "book_id": _text(_first(item, "book_id", "bookId", "book")),
        "page_id": _text(_first(item, "page_id", "pageId", "pg", "id")),
        "book": _text(_first(item, "book_name", "book_title", "title", "book")),
        "author": _text(_first(item, "author_name", "author")),
        "volume": _text(_first(item, "volume", "vol")) or None,
        "page": _text(_first(item, "page", "page_number", "number")) or None,
        "heading": _text(_first(item, "heading", "chapter", "title")) or None,
        "excerpt": _text(_first(item, "excerpt", "text", "content", "body")),
    }


class TurathAdapter:
    def __init__(
        self,
        base_url: str = DEFAULT_BASE,
        allowlist: set[str] | None = None,
        fetch: Callable[[str], Any] | None = None,
        timeout: float = 8.0,
    ):
        self.base_url = os.getenv("TURATH_BASE_URL", base_url).rstrip("/")
        self.allowlist = allowlist if allowlist is not None else configured_allowlist()
        self.fetch = fetch or self._fetch
        self.timeout = timeout

    def _fetch(self, url: str) -> Any:
        request = Request(
            url,
            headers={
                "X-Turath-Client": os.getenv("TURATH_CLIENT", "turath-ai"),
                "User-Agent": "sirah-journey/0.1",
                "Accept": "application/json",
            },
        )
        try:
            with urlopen(request, timeout=self.timeout) as response:
                if response.status < 200 or response.status >= 300:
                    raise BoundaryError(f"Turath upstream returned HTTP {response.status}", 502)
                return json.loads(response.read(1_000_000))
        except HTTPError as error:
            raise BoundaryError(f"Turath upstream returned HTTP {error.code}", 502) from error
        except (URLError, TimeoutError) as error:
            raise BoundaryError("Turath request timed out or failed", 504) from error
        except json.JSONDecodeError as error:
            raise BoundaryError("Turath returned invalid JSON", 502) from error

    def _url(self, path: str, **params: Any) -> str:
        params = {key: value for key, value in params.items() if value is not None}
        return f"{self.base_url}/{path}?{urlencode(params)}"

    def _request(self, url: str) -> Any:
        try:
            return self.fetch(url)
        except BoundaryError:
            raise
        except TimeoutError as error:
            raise BoundaryError("Turath request timed out or failed", 504) from error
        except OSError as error:
            raise BoundaryError("Turath upstream request failed", 502) from error

    def _require_allowed(self, book_id: str) -> None:
        if not re.fullmatch(r"\d+", book_id):
            raise BoundaryError("book_id must be numeric")
        if book_id not in self.allowlist:
            raise BoundaryError("This book is not in the configured publication allowlist", 403)

    def search(self, query: str, page: int = 1, book_id: str | None = None, author: str | None = None) -> dict[str, Any]:
        query = query.strip()
        if not query or len(query) > MAX_QUERY:
            raise BoundaryError("q is required and must be 240 characters or fewer")
        if not 1 <= page <= MAX_PAGE:
            raise BoundaryError(f"page must be between 1 and {MAX_PAGE}")
        if book_id:
            self._require_allowed(book_id)
        raw = self._request(self._url("search", q=query, ver=4, page=page, book=book_id, author=author, cat=CATEGORY_ID))
        results = [normalize_result(item) for item in _items(raw)]
        if self.allowlist:
            results = [item for item in results if item["book_id"] in self.allowlist]
        return {"category_id": CATEGORY_ID, "query": query, "page": page, "results": results[:MAX_RESULTS]}

    def page(self, book_id: str, page_id: str) -> dict[str, Any]:
        self._require_allowed(book_id)
        if not re.fullmatch(r"[\w-]+", page_id):
            raise BoundaryError("page_id is invalid")
        raw = self._request(self._url("page", book_id=book_id, pg=page_id))
        items = _items(raw)
        if not items:
            raise BoundaryError("Turath page was not found", 404)
        item = normalize_result(items[0])
        item["book_id"] = book_id
        item["page_id"] = page_id
        return {"category_id": CATEGORY_ID, "citation": item}

    def book(self, book_id: str) -> dict[str, Any]:
        self._require_allowed(book_id)
        raw = self._request(self._url("book", id=book_id, include="indexes"))
        if not isinstance(raw, dict):
            raise BoundaryError("Turath book metadata is malformed", 502)
        return {"category_id": CATEGORY_ID, "book": normalize_result({**raw, "book_id": book_id})}

    def author(self, author_id: str) -> dict[str, Any]:
        if not re.fullmatch(r"\d+", author_id):
            raise BoundaryError("author_id must be numeric")
        raw = self._request(self._url("author", id=author_id))
        if not isinstance(raw, dict):
            raise BoundaryError("Turath author metadata is malformed", 502)
        return {"category_id": CATEGORY_ID, "author": {key: _text(value) for key, value in raw.items() if key in {"id", "name", "bio"}}}


def configured_allowlist() -> set[str]:
    value = os.getenv("TURATH_BOOK_ALLOWLIST")
    if value is None:
        return set(WORKING_BOOK_ALLOWLIST)
    return {part.strip() for part in value.split(",") if re.fullmatch(r"\d+", part.strip())}


class LocalGuideProvider:
    """Finite offline fallback; never presented as a researched model answer."""

    def answer(self, question: str, step_id: str, source_ids: list[str]) -> dict[str, Any]:
        normalized = question.lower()

        def cited(*ids: str) -> list[str]:
            result = [source_id for source_id in ids if source_id in source_ids]
            return result if len(result) == len(ids) else []

        if "exact route" in normalized or "precise" in normalized:
            text = "The selected evidence does not establish an exact route. It describes a coastal way, while this overview is schematic rather than a measured itinerary."
            citations = cited("E07")
            action = None
        elif "after" in normalized and ("cave" in normalized or "thawr" in normalized):
            text = "‘Amir ibn Fuhayrah and the guide went with them when they continued, and the guide led them by the coastal way. The guide’s personal name and the precise route are not established here."
            citations = cited("E06", "E07")
            action = {"type": "detour", "step_id": "onward", "label": "Show the onward journey"}
        elif "news" in normalized or "message" in normalized:
            text = "‘Abdullah ibn Abi Bakr brought news of plans against them after darkness and returned to Makkah before daybreak."
            citations = cited("E04")
            action = None
        elif "milk" in normalized or "sheep" in normalized or "amir" in normalized:
            text = "‘Amir ibn Fuhayrah tended the flock and brought milk near the cave during the three nights."
            citations = cited("E05")
            action = None
        elif "guide" in normalized or "coastal" in normalized:
            text = "They hired a skilled guide, entrusted him with two riding animals, and arranged to meet him at Thawr. The account says he led them by the coastal way."
            citations = cited("E06", "E07")
            action = None
        elif "how long" in normalized or "how many nights" in normalized or "three nights" in normalized:
            text = "The selected account says that they remained in the cave for three nights."
            citations = cited("E03")
            action = None
        elif "asma" in normalized or "provision" in normalized or "food" in normalized:
            text = "The preparations account describes provisions packed in a bag and Asma bint Abi Bakr using part of her waist-belt to tie its opening."
            citations = cited("E01", "E02")
            action = None
        elif "arrival" in normalized or "madi" in normalized or "mosque" in normalized:
            text = "The arrival account describes Muslims waiting, the stay among Bani ‘Amr ibn ‘Awf, and later building work at the mosque site."
            citations = cited("E11", "E12")
            action = None
        else:
            text = "The selected evidence does not establish an answer to that question. The available source records are shown below."
            citations = []
            action = None
        if not citations:
            text = 'The offline chapter notes do not establish an answer to that question.'
            action = None
        return {
            "answer": text,
            "status": "local-bounded",
            "confidence": "bounded",
            "citations": citations,
            "action": action,
            "provider": "local",
            "sources": [],
        }


def guide_response(payload: Any, provider: LocalGuideProvider | OpenAIGuideProvider | None = None) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise BoundaryError("guide payload must be an object")
    question = payload.get("question")
    context = payload.get("context")
    if not isinstance(question, str) or not question.strip() or len(question) > 1200:
        raise BoundaryError("question is required and limited to 1200 characters")
    if not isinstance(context, dict):
        raise BoundaryError("bounded chapter context is required")
    step_id = context.get("step_id")
    source_ids = context.get("source_ids", [])
    if not isinstance(step_id, str) or step_id not in STEPS:
        raise BoundaryError("context step_id is invalid")
    known_ids = {source['id'] for source in CHAPTER['sources']}
    if not isinstance(source_ids, list) or len(source_ids) > len(known_ids) or not all(isinstance(item, str) and item in known_ids for item in source_ids):
        raise BoundaryError('context source_ids are invalid')
    if context.get('chapter_id', CHAPTER['id']) != CHAPTER['id']:
        raise BoundaryError('unknown chapter')
    language = context.get('language', 'en')
    if not isinstance(language, str) or language not in UI_LANGUAGES:
        raise BoundaryError('context language is invalid')
    recent_turns = context.get('recent_turns', [])
    if not isinstance(recent_turns, list) or len(recent_turns) > 6 or not all(
        isinstance(turn, dict) and isinstance(turn.get('role'), str) and turn['role'] in {'user', 'assistant'}
        and isinstance(turn.get('text'), str) and len(turn['text']) <= 4000
        for turn in recent_turns
    ):
        raise BoundaryError('context recent_turns are invalid')
    audience = context.get('audience', 'deep')
    if audience not in {'young', 'new', 'deep'}:
        raise BoundaryError('context audience is invalid')
    if isinstance(provider, OpenAIGuideProvider):
        return provider.answer(
            question.strip(), step_id, source_ids, language, recent_turns, audience
        )
    return (provider or LocalGuideProvider()).answer(question.strip(), step_id, source_ids)


def _json(handler: BaseHTTPRequestHandler, value: Any, status: int = 200) -> None:
    data = json.dumps(value, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(data)))
    handler.send_header('Cache-Control', 'no-store')
    handler.send_header("Access-Control-Allow-Origin", "http://127.0.0.1:5100")
    handler.end_headers()
    handler.wfile.write(data)


class APIHandler(BaseHTTPRequestHandler):
    adapter = TurathAdapter()
    provider = OpenAIGuideProvider(LocalGuideProvider()) if os.getenv('OPENAI_API_KEY') else LocalGuideProvider()

    def log_message(self, _format: str, *_args: Any) -> None:
        return

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "http://127.0.0.1:5100")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        try:
            parsed = urlparse(self.path)
            query = parse_qs(parsed.query)
            if parsed.path == "/api/health":
                return _json(self, {"ok": True, "category_id": CATEGORY_ID, "allowlist_configured": bool(self.adapter.allowlist)})
            if parsed.path == "/api/turath/search":
                return _json(self, self.adapter.search(query.get("q", [""])[0], int(query.get("page", [1])[0]), query.get("book", [None])[0], query.get("author", [None])[0]))
            if parsed.path == "/api/turath/page":
                return _json(self, self.adapter.page(query.get("book_id", [""])[0], query.get("pg", [""])[0]))
            if parsed.path == "/api/turath/book":
                return _json(self, self.adapter.book(query.get("id", [""])[0]))
            if parsed.path == "/api/turath/author":
                return _json(self, self.adapter.author(query.get("id", [""])[0]))
            return _json(self, {"error": "Not found"}, 404)
        except (BoundaryError, ValueError) as error:
            _json(self, {"error": str(error)}, getattr(error, "status", 400))

    def do_POST(self) -> None:
        if self.path != "/api/guide":
            return _json(self, {"error": "Not found"}, 404)
        try:
            if self.headers.get('Content-Type', '').split(';')[0].strip() != 'application/json':
                raise BoundaryError('Content-Type must be application/json', 415)
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 30_000:
                raise BoundaryError("request is too large")
            payload = json.loads(self.rfile.read(length))
            _json(self, guide_response(payload, self.provider))
        except (BoundaryError, ValueError, json.JSONDecodeError) as error:
            _json(self, {"error": str(error)}, getattr(error, "status", 400))


def main() -> None:
    port = int(os.getenv("API_PORT", "8000"))
    server = ThreadingHTTPServer((os.getenv("API_HOST", "127.0.0.1"), port), APIHandler)
    print(f"Sirah API boundary listening on http://127.0.0.1:{port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
