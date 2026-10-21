> Historical plan: this was written for the original backend-only repository. The new `alumni-vector-database` repository includes the complete frontend as requested. See README.md for the current setup.

# Alumni vector search implementation

Approved design: Qdrant Cloud, free MiniLM embeddings, Cloudflare Worker REST
backend, semantic search with exact filters, five results per page. Preserve
Neo4j separately. GitHub remains backend-only; ignored frontend assets are
published only to Cloudflare.

1. Verify credentials and free inference. Inspect existing collections before writes.
2. Test adapter and API validation, payload filtering, result caps and auth.
3. Migrate all 22 retained graph entities and their 33 relationship references.
   Add clearly marked synthetic examples to reach 50 alumni, 20 jobs and
   15 mentorships, alongside the other migrated entity types.
4. Create collection with dense 384-dimensional cosine vectors, sparse BM25
   vectors, and keyword indexes. Use reciprocal-rank fusion for hybrid search.
5. Implement public search, browse, facets, related records and stats; admin CRUD.
6. Build a responsive search UI with top-five cards, filters, detail views and
   honest synthetic-data labels. No graph layout or Cypher console.
7. Evaluate topic relevance, filters, migration integrity, API CRUD and latency.
   Verify live desktop/mobile UI; push backend and deploy full site with Wrangler.
