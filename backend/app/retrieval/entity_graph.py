import hashlib
import json
import re


_RECORD_SEPARATOR = re.compile(r"(?m)^\\-{5,}\s*$")
_FIELD_MARKER = re.compile(r"\*\*(?P<key>[^*]+):\*\*")
_GRAPH_FIELDS = {
    "tipo": ("document_type", "type"),
    "projeto": ("project", "project"),
    "produto": ("product", "product"),
    "hierarquia": ("topic", "topic"),
    "tags": ("tag", "tag"),
}
_ESCAPED_MARKDOWN = re.compile(r"\\([\\_*|:>])")


def _clean_metadata_value(value: str) -> str:
    value = value.strip().strip("\\|").strip()
    return _ESCAPED_MARKDOWN.sub(r"\1", value)


def _parse_metadata(line: str) -> dict[str, str]:
    markers = list(_FIELD_MARKER.finditer(line))
    metadata = {}

    for index, marker in enumerate(markers):
        end = markers[index + 1].start() if index + 1 < len(markers) else len(line)
        key = marker.group("key").strip().casefold()
        value = _clean_metadata_value(line[marker.end():end])
        if value:
            metadata[key] = value

    return metadata


def _stable_id(kind: str, identity: str) -> str:
    digest = hashlib.sha256(identity.encode("utf-8")).hexdigest()[:20]
    return f"{kind}:{digest}"


def _graph_node(kind: str, label: str, identity: str | None = None) -> dict:
    node_identity = identity if identity is not None else " ".join(label.casefold().split())
    return {
        "id": _stable_id(kind, node_identity),
        "label": label,
        "type": kind,
    }


def build_document_graph(document: dict) -> dict:
    document_id = document["id"]
    document_name = document["name"]
    document_node = {
        "id": f"document:{document_id}",
        "label": document_name,
        "type": "document",
    }
    nodes = {document_node["id"]: document_node}
    edges = {}
    content = document.get("content", "")

    if document.get("encoding", "text") != "text":
        return {"nodes": list(nodes.values()), "edges": []}

    for ordinal, record in enumerate(_RECORD_SEPARATOR.split(content)):
        lines = record.splitlines()
        metadata_index = next(
            (index for index, line in enumerate(lines) if "**Tipo:**" in line),
            None,
        )
        if metadata_index is None:
            continue

        title = next(
            (
                line.strip().lstrip("#").strip()
                for line in lines[:metadata_index]
                if line.strip()
            ),
            "",
        )
        metadata = _parse_metadata(lines[metadata_index])
        if not title or not any(field in metadata for field in _GRAPH_FIELDS):
            continue

        source_url = metadata.get("url fonte", "")
        item_identity = "\0".join((document_id, str(ordinal), title, source_url))
        item_node = _graph_node(
            "knowledge_item",
            title,
            item_identity,
        )
        nodes[item_node["id"]] = item_node
        evidence = {
            "document_id": document_id,
            "document_name": document_name,
            "title": title,
        }
        if source_url:
            evidence["source_url"] = source_url

        _add_edge(edges, document_node["id"], item_node["id"], "contains", evidence)

        for field, (node_type, relation) in _GRAPH_FIELDS.items():
            value = metadata.get(field)
            if not value:
                continue
            values = (
                [tag.strip() for tag in re.split(r"[,;]", value) if tag.strip()]
                if field == "tags"
                else [value]
            )
            for entity in values:
                entity_node = _graph_node(node_type, entity)
                nodes[entity_node["id"]] = entity_node
                _add_edge(edges, item_node["id"], entity_node["id"], relation, evidence)

    return {
        "nodes": sorted(nodes.values(), key=lambda node: node["id"]),
        "edges": sorted(edges.values(), key=lambda edge: edge["id"]),
    }


def _add_edge(
    edges: dict[str, dict],
    source: str,
    target: str,
    label: str,
    evidence: dict,
) -> None:
    edge_id = _stable_id("edge", "\0".join((source, label, target)))
    edge = edges.setdefault(
        edge_id,
        {
            "id": edge_id,
            "source": source,
            "target": target,
            "label": label,
            "evidence": [],
        },
    )
    if evidence not in edge["evidence"]:
        edge["evidence"].append(evidence)


def merge_document_graphs(graphs: list[dict]) -> dict:
    nodes = {}
    edges = {}

    for graph in graphs:
        for node in graph["nodes"]:
            nodes.setdefault(node["id"], node)
        for graph_edge in graph["edges"]:
            edge = edges.setdefault(graph_edge["id"], {**graph_edge, "evidence": []})
            for evidence in graph_edge["evidence"]:
                if evidence not in edge["evidence"]:
                    edge["evidence"].append(evidence)

    return {
        "nodes": sorted(nodes.values(), key=lambda node: node["id"]),
        "edges": sorted(edges.values(), key=lambda edge: edge["id"]),
    }


def serialize_document_graph(document: dict) -> str:
    return json.dumps(
        build_document_graph(document),
        ensure_ascii=False,
        separators=(",", ":"),
    )
