import hashlib
import json
import sqlite3
from contextlib import closing
from pathlib import Path

from sklearn.metrics.pairwise import cosine_similarity
from google.genai import types
from app.config import client


EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_BATCH_SIZE = 100
VECTOR_STORE_PATH = Path(__file__).resolve().parents[2] / "data" / "vectors.sqlite3"


class MissingIndexedDocumentsError(ValueError):
    pass


def embed_content(contents: str | list[str]) -> types.EmbedContentResponse:
    return client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=contents,
    )


def _embed_contents(texts: list[str]) -> list[list[float]]:
    embeddings = []

    for start in range(0, len(texts), EMBEDDING_BATCH_SIZE):
        batch = texts[start:start + EMBEDDING_BATCH_SIZE]
        result = embed_content(batch)
        embeddings.extend(embedding.values for embedding in result.embeddings)

    if len(embeddings) != len(texts):
        raise RuntimeError("The embedding service returned an unexpected number of vectors.")

    return embeddings


def _chunk_id(chunk: dict) -> str:
    identity = json.dumps(
        [
            EMBEDDING_MODEL,
            chunk.get("document_id", chunk["source"]),
            chunk["source"],
            chunk["page"],
            chunk["chunk"],
            chunk["text"],
        ],
        ensure_ascii=False,
        separators=(",", ":"),
    )
    return hashlib.sha256(identity.encode("utf-8")).hexdigest()


def _ensure_store_directory() -> None:
    VECTOR_STORE_PATH.parent.mkdir(parents=True, exist_ok=True)


def _load_cached_embeddings(chunk_ids: list[str]) -> dict[str, list[float]]:
    if not chunk_ids:
        return {}

    if not VECTOR_STORE_PATH.exists():
        return {}

    cached_embeddings = {}
    with closing(sqlite3.connect(VECTOR_STORE_PATH)) as connection:
        for start in range(0, len(chunk_ids), 500):
            batch = chunk_ids[start:start + 500]
            placeholders = ",".join("?" for _ in batch)
            rows = connection.execute(
                f"SELECT id, embedding FROM chunks WHERE id IN ({placeholders})",
                batch,
            )
            cached_embeddings.update(
                (chunk_id, json.loads(embedding))
                for chunk_id, embedding in rows
            )

    return cached_embeddings


def _store_embeddings(chunks: list[dict], embeddings: list[list[float]]) -> None:
    if not chunks:
        return

    _ensure_store_directory()
    with closing(sqlite3.connect(VECTOR_STORE_PATH)) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS chunks (
                id TEXT PRIMARY KEY,
                text TEXT NOT NULL,
                source TEXT NOT NULL,
                page INTEGER,
                chunk INTEGER NOT NULL,
                embedding TEXT NOT NULL
            )
            """
        )
        with connection:
            connection.executemany(
                """
                INSERT OR REPLACE INTO chunks (id, text, source, page, chunk, embedding)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        _chunk_id(chunk),
                        chunk["text"],
                        chunk["source"],
                        chunk["page"],
                        chunk["chunk"],
                        json.dumps(embedding),
                    )
                    for chunk, embedding in zip(chunks, embeddings)
                ],
            )


def _delete_cached_embeddings(connection: sqlite3.Connection, chunk_ids: set[str]) -> None:
    chunk_ids = list(chunk_ids)
    for start in range(0, len(chunk_ids), 500):
        batch = chunk_ids[start:start + 500]
        placeholders = ",".join("?" for _ in batch)
        connection.execute(
            f"DELETE FROM chunks WHERE id IN ({placeholders})",
            batch,
        )


def _index_is_current(
    documents: list[dict],
    chunks: list[dict],
    chunk_ids: list[str],
) -> bool:
    if not VECTOR_STORE_PATH.exists():
        return False

    document_ids = [document["id"] for document in documents]
    with closing(sqlite3.connect(VECTOR_STORE_PATH)) as connection:
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
        }
        if not {"chunks", "documents", "document_chunks"}.issubset(tables):
            return False

        stored_documents = {}
        for start in range(0, len(document_ids), 500):
            batch = document_ids[start:start + 500]
            placeholders = ",".join("?" for _ in batch)
            stored_documents.update(
                (row[0], row[1:])
                for row in connection.execute(
                    f"""
                    SELECT id, name, content, encoding
                    FROM documents
                    WHERE id IN ({placeholders})
                    """,
                    batch,
                )
            )

        if any(
            stored_documents.get(document["id"])
            != (document["name"], document["content"], document["encoding"])
            for document in documents
        ):
            return False

        stored_chunks = []
        for start in range(0, len(document_ids), 500):
            batch = document_ids[start:start + 500]
            placeholders = ",".join("?" for _ in batch)
            stored_chunks.extend(
                connection.execute(
                    f"""
                    SELECT dc.document_id, dc.chunk_id, dc.ordinal
                    FROM document_chunks AS dc
                    JOIN chunks AS c ON c.id = dc.chunk_id
                    WHERE dc.document_id IN ({placeholders})
                    """,
                    batch,
                ).fetchall()
            )

    expected_chunks = sorted(
        (chunk["document_id"], chunk_id, ordinal)
        for ordinal, (chunk, chunk_id) in enumerate(zip(chunks, chunk_ids))
    )
    return sorted(stored_chunks) == expected_chunks


def _get_chunk_embeddings(chunks: list[dict]) -> list[list[float]]:
    chunk_ids = [_chunk_id(chunk) for chunk in chunks]
    cached_embeddings = _load_cached_embeddings(chunk_ids)
    missing_chunks = [
        chunk for chunk, chunk_id in zip(chunks, chunk_ids)
        if chunk_id not in cached_embeddings
    ]

    if missing_chunks:
        new_embeddings = _embed_contents([chunk["text"] for chunk in missing_chunks])
        _store_embeddings(missing_chunks, new_embeddings)
        cached_embeddings.update(
            (_chunk_id(chunk), embedding)
            for chunk, embedding in zip(missing_chunks, new_embeddings)
        )

    return [cached_embeddings[chunk_id] for chunk_id in chunk_ids]


def persist_documents(documents: list[dict], chunks: list[dict]) -> int:
    if not documents or not chunks:
        return 0

    chunk_ids = [_chunk_id(chunk) for chunk in chunks]
    _get_chunk_embeddings(chunks)
    if _index_is_current(documents, chunks, chunk_ids):
        return len(chunks)

    _ensure_store_directory()

    with closing(sqlite3.connect(VECTOR_STORE_PATH)) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                content TEXT NOT NULL,
                encoding TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS document_chunks (
                document_id TEXT NOT NULL,
                chunk_id TEXT NOT NULL,
                ordinal INTEGER NOT NULL,
                PRIMARY KEY (document_id, ordinal),
                FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
            )
            """
        )

        with connection:
            previous_chunk_ids = set()
            for document in documents:
                previous_chunk_ids.update(
                    row[0]
                    for row in connection.execute(
                        "SELECT chunk_id FROM document_chunks WHERE document_id = ?",
                        (document["id"],),
                    )
                )
                connection.execute(
                    """
                    INSERT OR REPLACE INTO documents (id, name, content, encoding)
                    VALUES (?, ?, ?, ?)
                    """,
                    (
                        document["id"],
                        document["name"],
                        document["content"],
                        document["encoding"],
                    ),
                )
                connection.execute(
                    "DELETE FROM document_chunks WHERE document_id = ?",
                    (document["id"],),
                )

            new_chunk_ids = set()
            connection.executemany(
                """
                INSERT INTO document_chunks (document_id, chunk_id, ordinal)
                VALUES (?, ?, ?)
                """,
                [
                    (chunk["document_id"], chunk_id, ordinal)
                    for ordinal, (chunk, chunk_id) in enumerate(zip(chunks, chunk_ids))
                ],
            )
            new_chunk_ids.update(chunk_ids)
            stale_chunk_ids = previous_chunk_ids - new_chunk_ids
            if stale_chunk_ids:
                _delete_cached_embeddings(connection, stale_chunk_ids)

    return len(chunks)


def delete_indexed_document(document_id: str) -> None:
    if not VECTOR_STORE_PATH.exists():
        return

    with closing(sqlite3.connect(VECTOR_STORE_PATH)) as connection:
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
        }
        if not {"documents", "document_chunks"}.issubset(tables):
            return

        chunk_ids = [
            row[0]
            for row in connection.execute(
                "SELECT chunk_id FROM document_chunks WHERE document_id = ?",
                (document_id,),
            )
        ]
        with connection:
            connection.execute(
                "DELETE FROM document_chunks WHERE document_id = ?",
                (document_id,),
            )
            connection.execute("DELETE FROM documents WHERE id = ?", (document_id,))
            if chunk_ids:
                _delete_cached_embeddings(connection, set(chunk_ids))


def _load_indexed_chunks(document_ids: list[str]) -> tuple[list[dict], list[list[float]]]:
    if not document_ids:
        return [], []

    if not VECTOR_STORE_PATH.exists():
        raise MissingIndexedDocumentsError("One or more documents have not been indexed.")

    with closing(sqlite3.connect(VECTOR_STORE_PATH)) as connection:
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
        }
        if not {"chunks", "documents", "document_chunks"}.issubset(tables):
            raise MissingIndexedDocumentsError("One or more documents have not been indexed.")

        rows = []
        found_document_ids = set()
        for start in range(0, len(document_ids), 500):
            batch = document_ids[start:start + 500]
            placeholders = ",".join("?" for _ in batch)
            batch_rows = connection.execute(
                f"""
                SELECT dc.document_id, c.text, c.source, c.page, c.chunk, c.embedding
                FROM document_chunks AS dc
                JOIN documents AS d ON d.id = dc.document_id
                JOIN chunks AS c ON c.id = dc.chunk_id
                WHERE dc.document_id IN ({placeholders})
                ORDER BY dc.document_id, dc.ordinal
                """,
                batch,
            ).fetchall()
            rows.extend(batch_rows)
            found_document_ids.update(row[0] for row in batch_rows)

    missing_document_ids = set(document_ids) - found_document_ids
    if missing_document_ids:
        raise MissingIndexedDocumentsError("One or more documents have not been indexed.")

    chunks = [
        {
            "text": text,
            "source": source,
            "page": page,
            "chunk": chunk_number,
        }
        for _, text, source, page, chunk_number, _ in rows
    ]
    embeddings = [json.loads(row[5]) for row in rows]
    return chunks, embeddings


def retrieve_relevant_chunks(
    question: str,
    document_ids: list[str],
    top_k: int = 5,
) -> list[dict]:
    if not document_ids or top_k <= 0:
        return []

    chunks, chunk_embeddings = _load_indexed_chunks(document_ids)
    question_embedding = _embed_contents([question])[0]
    similarities = cosine_similarity([question_embedding], chunk_embeddings)[0]
    ranked_indices = sorted(
        range(len(chunks)),
        key=lambda index: (similarities[index], -index),
        reverse=True,
    )[:top_k]

    return [
        {**chunks[index], "score": float(similarities[index])}
        for index in ranked_indices
    ]
