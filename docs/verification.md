# Validation — 20 October 2026

The source graph export contains 22 entities and 33 relationships. The seeded
Qdrant collection contains all source records plus labelled synthetic examples,
for 101 points total. Original node properties and all relationship references
were compared with the exported data.

13 unit tests pass. Live integration against a real Qdrant cluster verifies
health, counts, facets, hybrid search, exact source filters, authorization, create/
read/update/delete with re-embedding, migration metadata preservation, protection
of connected source records, and cleanup of test records.

Ten curated topic queries each returned the intended topic first. Initial
median backend latency was 168 ms and maximum latency was 622 ms. This is a
small tuning check, not an independent benchmark. Query vectors are generated
by the free hosted MiniLM model and BM25; no paid embedding provider is used.

Browser checks cover live statistics, search, top-five result caps, metadata
filters, provenance labels, record details, relationship navigation and mobile
layout. Screenshots and private evaluation reports are excluded from GitHub.

The original backend-only repository excluded frontend files. This complete
project repository includes the frontend, backend and font license. Source
exports, API keys, admin tokens and private test fixtures remain excluded.
Cloudflare keeps database credentials in server-side secrets.
