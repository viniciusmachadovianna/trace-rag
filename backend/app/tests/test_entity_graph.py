import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

os.environ.setdefault("FRONTEND_ORIGIN", "http://localhost:5500")

from fastapi.testclient import TestClient

from app.main import app
from app.retrieval.entity_graph import build_document_graph, merge_document_graphs


class EntityGraphTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_graph_uses_structured_metadata_and_keeps_source_evidence(self):
        graph = build_document_graph(
            {
                "id": "guide-1",
                "name": "guide.md",
                "encoding": "text",
                "content": (
                    "Guide overview\n"
                    "\\--------------------------------------------------------------------------------\n"
                    "Creating a process\n\n"
                    "**Tipo:** documentation \\| **Projeto:** \\_global "
                    "\\| **Produto:** bpm **Hierarquia:** Process modeling "
                    "**URL fonte:** https\\://example.test/guide "
                    "**Extraído em:** 04/08 **Tags:** email, approval\n"
                    "Article content.\n"
                ),
            }
        )

        node_by_type_and_label = {
            (node["type"], node["label"]): node for node in graph["nodes"]
        }
        self.assertIn(("project", "_global"), node_by_type_and_label)
        self.assertIn(("product", "bpm"), node_by_type_and_label)
        self.assertIn(("topic", "Process modeling"), node_by_type_and_label)
        self.assertIn(("tag", "approval"), node_by_type_and_label)

        product_node = node_by_type_and_label[("product", "bpm")]
        product_edge = next(
            edge for edge in graph["edges"] if edge["target"] == product_node["id"]
        )
        self.assertEqual(product_edge["label"], "product")
        self.assertEqual(
            product_edge["evidence"],
            [
                {
                    "document_id": "guide-1",
                    "document_name": "guide.md",
                    "title": "Creating a process",
                    "source_url": "https://example.test/guide",
                }
            ],
        )

    def test_graph_merges_shared_entities_across_documents(self):
        first = build_document_graph(
            {
                "id": "first",
                "name": "first.md",
                "content": (
                    "\\--------------------------------------------------------------------------------\n"
                    "First article\n"
                    "**Tipo:** documentation **Produto:** bpm\n"
                ),
            }
        )
        second = build_document_graph(
            {
                "id": "second",
                "name": "second.md",
                "content": (
                    "\\--------------------------------------------------------------------------------\n"
                    "Second article\n"
                    "**Tipo:** documentation **Produto:** bpm\n"
                ),
            }
        )

        merged = merge_document_graphs([first, second])
        product_nodes = [
            node for node in merged["nodes"]
            if node["type"] == "product" and node["label"] == "bpm"
        ]
        self.assertEqual(len(product_nodes), 1)
        self.assertEqual(
            sum(edge["target"] == product_nodes[0]["id"] for edge in merged["edges"]),
            2,
        )

    def test_graph_endpoint_filters_and_removes_deleted_documents(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            vector_store_path = Path(temporary_directory) / "vectors.sqlite3"
            with (
                patch("app.retrieval.vector_store.VECTOR_STORE_PATH", vector_store_path),
                patch(
                    "app.retrieval.vector_store._embed_contents",
                    return_value=[[1.0, 0.0]],
                ),
            ):
                index_response = self.client.post(
                    "/index",
                    json={
                        "documents": [
                            {
                                "id": "guide-1",
                                "name": "guide.md",
                                "content": (
                                    "\\--------------------------------------------------------------------------------\n"
                                    "Creating a process\n"
                                    "**Tipo:** documentation **Produto:** bpm\n"
                                ),
                            }
                        ]
                    },
                )
                graph_response = self.client.get(
                    "/graph",
                    params={"document_ids": ["guide-1"]},
                )
                missing_response = self.client.get(
                    "/graph",
                    params={"document_ids": ["missing"]},
                )
                delete_response = self.client.delete(
                    "/documents",
                    params={"document_id": "guide-1"},
                )
                empty_response = self.client.get("/graph")

        self.assertEqual(index_response.status_code, 200)
        self.assertEqual(graph_response.status_code, 200)
        self.assertTrue(graph_response.json()["nodes"])
        self.assertTrue(graph_response.json()["edges"])
        self.assertEqual(missing_response.status_code, 409)
        self.assertEqual(delete_response.status_code, 200)
        self.assertEqual(empty_response.json(), {"nodes": [], "edges": []})


if __name__ == "__main__":
    unittest.main()
