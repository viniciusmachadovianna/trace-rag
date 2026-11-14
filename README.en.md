# Skill Shard - Explainable RAG for Hallucination Mitigation

Author: Vinícius Machado

[Versão em português](README.md)

[EN-US] Codebase and evaluation framework for my Bachelor's Thesis (TCC)

## Objective

Developing a Relational Retrieval-Augmented Generation (RAG) system that combines vector search, cross-document entity linking, and explicit source citation to minimize LLM hallucinations.

Capabilities:
- Answer questions based on TXT, Markdown, CSV, JSON, and PDF documents.
- Automatically list supported documents from `data/` in the knowledge base, disabled by default.
- Minimize hallucinations.
- Present the sources and relationships used to construct the answer to the user.
- Visualize metadata relationships between enabled knowledge-base documents.

## Architecture

backend/ <br>
├── app/ <br>
│ ├── ingestion/ # PDF extraction, chunking, embeddings <br>

frontend/ <br>
├── index.html <br>
├── style/ <br>
└── script/ <br>

The local backend persists original documents, chunks, and embeddings in `backend/data/vectors.sqlite3`. Configure Live Server to ignore `backend/` so database changes do not reload the page. After synchronization, questions send only document IDs instead of full contents. Gemini is still required to generate embeddings and answers.

When the interface loads, it syncs enabled documents to the backend for indexing before enabling chat. The status indicator shows this initial loading; use **Retry check** if indexing fails.

## Stack

- **Frontend:** HTML, CSS e JS vanilla
- **Backend:** Python
- **LLM:** Gemini (API)
- **Vector Storage:** Local SQLite (`backend/data/vectors.sqlite3`)
- **Graph Visualization:** Locally bundled vis-network 10.1.5

## API endpoints

- `POST /index`: accepts `{"documents": [{"id": "...", "name": "...", "content": "...", "encoding": "text"}]}`, chunks enabled documents, and persists originals, chunks, and embeddings. Returns `{"indexed_chunks": n}`; responds with `422` for invalid documents or documents without readable text, and `502` if the embedding API fails. The interface calls it on startup and when the knowledge base changes.
- `GET /graph`: returns `{"nodes": [...], "edges": [...]}` for indexed documents. Nodes have `id`, `label`, and `type`; edges have `id`, `source`, `target`, `label`, and `evidence` (document ID/name, item title, and optional source URL). Repeat `document_ids` to filter, for example `/graph?document_ids=id-1&document_ids=id-2`; omitting the filter returns all indexed documents. The local, token-free rules use structured Markdown metadata (`Tipo`, `Projeto`, `Produto`, `Hierarquia`, and `Tags`) and cache the result during indexing. This first version does not infer entities from arbitrary prose. Returns `409` if a requested document is not indexed.
- `POST /ask`: accepts `{"question": "...", "document_ids": [...]}` and retrieves stored chunks; missing or unindexed documents return `409`.
- `DELETE /documents?document_id=...`: removes a document, its chunks, and its associated vectors from the local database.

## Evaluation Methodology

Comparison of three configurations:
1. No RAG (baseline)
2. Traditional RAG (Vector search)
3. RAG + Entity relationship layer

**Factual** and **relational** test questions, with manual classification of responses in:
- Correct and well-grounded
- Correct but poorly grounded
- Hallucination
