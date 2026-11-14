import base64
import os
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

os.environ.setdefault("FRONTEND_ORIGIN", "http://localhost:5500")

from fastapi.testclient import TestClient

from app.main import app
from app.retrieval.vector_store import MissingIndexedDocumentsError


class AskDocumentsTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_repository_documents_are_listed_recursively_with_supported_encodings(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            data_directory = Path(temporary_directory)
            (data_directory / "guide.md").write_text("# Guide", encoding="utf-8")
            (data_directory / "nested").mkdir()
            pdf_content = b"%PDF-1.7"
            (data_directory / "nested" / "report.pdf").write_bytes(pdf_content)
            (data_directory / "ignored.bin").write_bytes(b"not a supported document")

            with patch("app.main.DATA_DIRECTORY", data_directory):
                response = self.client.get("/documents")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            [
                {
                    "id": "repository:guide.md",
                    "name": "guide.md",
                    "content": "# Guide",
                    "encoding": "text",
                },
                {
                    "id": "repository:nested/report.pdf",
                    "name": "nested/report.pdf",
                    "content": base64.b64encode(pdf_content).decode("ascii"),
                    "encoding": "base64",
                },
            ],
        )

    @patch("app.main.persist_documents", return_value=2)
    def test_index_endpoint_persists_document_and_chunks(self, persist_documents):
        response = self.client.post(
            "/index",
            json={
                "documents": [
                    {
                        "id": "guide-1",
                        "name": "guide.md",
                        "content": " ".join(f"word{index}" for index in range(160)),
                    }
                ]
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"indexed_chunks": 2})
        documents, chunks = persist_documents.call_args.args
        self.assertEqual(documents[0]["id"], "guide-1")
        self.assertEqual(len(chunks), 2)
        self.assertEqual(chunks[0]["source"], "guide.md")
        self.assertEqual(chunks[0]["document_id"], "guide-1")

    def test_questions_retrieve_backend_persisted_documents_by_id(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            vector_store_path = Path(temporary_directory) / "vectors.sqlite3"
            with (
                patch("app.retrieval.vector_store.VECTOR_STORE_PATH", vector_store_path),
                patch(
                    "app.retrieval.vector_store._embed_contents",
                    side_effect=[[[1.0, 0.0]], [[1.0, 0.0]]],
                ) as embed_contents,
                patch("app.main.ask_llm", return_value="The project started in 2024.") as ask_llm,
            ):
                index_response = self.client.post(
                    "/index",
                    json={
                        "documents": [
                            {
                                "id": "project-1",
                                "name": "project.txt",
                                "content": "The project started in 2024.",
                                "encoding": "text",
                            }
                        ]
                    },
                )
                ask_response = self.client.post(
                    "/ask",
                    json={
                        "question": "When did the project start?",
                        "document_ids": ["project-1"],
                    },
                )

                with closing(sqlite3.connect(vector_store_path)) as connection:
                    stored_document = connection.execute(
                        "SELECT content FROM documents WHERE id = ?",
                        ("project-1",),
                    ).fetchone()

                delete_response = self.client.delete(
                    "/documents",
                    params={"document_id": "project-1"},
                )
                missing_response = self.client.post(
                    "/ask",
                    json={
                        "question": "When did the project start?",
                        "document_ids": ["project-1"],
                    },
                )

        self.assertEqual(index_response.status_code, 200)
        self.assertEqual(ask_response.status_code, 200)
        self.assertIn("project.txt", ask_response.json())
        self.assertEqual(stored_document[0], "The project started in 2024.")
        self.assertEqual(embed_contents.call_count, 2)
        ask_llm.assert_called_once()
        self.assertEqual(delete_response.status_code, 200)
        self.assertEqual(missing_response.status_code, 409)

    def test_index_endpoint_rejects_documents_without_readable_text(self):
        response = self.client.post(
            "/index",
            json={"documents": [{"id": "empty", "name": "empty.md", "content": "   "}]},
        )

        self.assertEqual(response.status_code, 422)
        self.assertIn("No readable text", response.json()["detail"])

    @patch("app.main.persist_documents", side_effect=RuntimeError("embedding unavailable"))
    def test_index_endpoint_reports_embedding_failures(self, persist_documents):
        response = self.client.post(
            "/index",
            json={"documents": [{"id": "guide-1", "name": "guide.md", "content": "some readable text"}]},
        )

        self.assertEqual(response.status_code, 502)
        self.assertIn("Document indexing failed", response.json()["detail"])

    @patch("app.main.delete_indexed_document")
    def test_document_delete_endpoint_removes_backend_copy(self, delete_indexed_document):
        response = self.client.delete(
            "/documents",
            params={"document_id": "repository:guide.md"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"deleted": True})
        delete_indexed_document.assert_called_once_with("repository:guide.md")

    def test_document_delete_endpoint_allows_browser_preflight(self):
        response = self.client.options(
            "/documents?document_id=guide-1",
            headers={
                "Origin": "http://localhost:5500",
                "Access-Control-Request-Method": "DELETE",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("DELETE", response.headers["access-control-allow-methods"])

    @patch("app.main.ask_llm", return_value="Grounded answer.")
    @patch("app.main.retrieve_relevant_chunks")
    def test_indexed_document_ids_are_retrieved_and_cited(
        self,
        retrieve_relevant_chunks,
        ask_llm,
    ):
        retrieve_relevant_chunks.return_value = [
            {
                "text": "The project started in 2024.",
                "source": "project.txt",
                "page": None,
                "chunk": 1,
                "score": 1.0,
            }
        ]

        response = self.client.post(
            "/ask",
            json={
                "question": "When did the project start?",
                "document_ids": ["project-1"],
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("project.txt", response.json())
        retrieve_relevant_chunks.assert_called_once_with(
            "When did the project start?",
            ["project-1"],
        )
        self.assertIn("The project started in 2024.", ask_llm.call_args.args[1])

    @patch("app.main.ask_llm", return_value="General answer.")
    @patch("app.main.retrieve_relevant_chunks")
    def test_requests_without_documents_keep_plain_llm_behavior(
        self,
        retrieve_relevant_chunks,
        ask_llm,
    ):
        response = self.client.post("/ask", json={"question": "A general question"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), "General answer.")
        ask_llm.assert_called_once_with("A general question", None)
        retrieve_relevant_chunks.assert_not_called()

    @patch(
        "app.main.retrieve_relevant_chunks",
        side_effect=MissingIndexedDocumentsError("not indexed"),
    )
    def test_ask_rejects_document_ids_missing_from_backend(self, retrieve_relevant_chunks):
        response = self.client.post(
            "/ask",
            json={"question": "What is in this document?", "document_ids": ["missing"]},
        )

        self.assertEqual(response.status_code, 409)
        self.assertIn("not indexed", response.json()["detail"])
        retrieve_relevant_chunks.assert_called_once_with(
            "What is in this document?",
            ["missing"],
        )

    def test_existing_pdf_records_must_be_added_again(self):
        response = self.client.post(
            "/index",
            json={
                "documents": [
                    {
                        "id": "report-1",
                        "name": "report.pdf",
                        "content": "old browser-decoded content",
                    }
                ],
            },
        )

        self.assertEqual(response.status_code, 422)
        self.assertIn("remove and add this PDF again", response.json()["detail"])


if __name__ == "__main__":
    unittest.main()
