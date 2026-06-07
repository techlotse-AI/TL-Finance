# Statement Ingestion Strategy

Statement ingestion foundation has started in v0.2.0. The parser registry,
preview contract, deterministic hashes, and additive source-fact schema are
implemented. No institution parser is production-ready yet.

Structured formats are prioritized over PDF and OCR. Each production parser
requires at least two sanitized real fixtures, fails closed on ambiguous dates,
signs, currency, or account identity, preserves original row JSON and parser
version, returns structured warnings, and never silently drops rows.

Preview writes no actual transactions. Commit is idempotent by household/file
hash and row dedupe hash. Parsing, allocation, dedupe, transfer matching, and FX
matching remain deterministic and do not use AI.
