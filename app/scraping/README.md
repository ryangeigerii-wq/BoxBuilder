# app/scraping/

Implements HTML fetch + parse pipeline and site adapters.

Files:
- fetcher.py: HTTP retrieval & normalization.
- parser.py: Extract structured fields from HTML.
- pipeline.py: Orchestrates multi-URL scrape process.
- sites/: Site-specific selectors (e.g., crutchfield.py).

Practices:
- Respect robots.txt / site TOS.
- Add retry/backoff for transient failures.
- Consider caching parsed results.

Testing:
- Use fixture HTML or monkeypatch network calls for determinism.

---
