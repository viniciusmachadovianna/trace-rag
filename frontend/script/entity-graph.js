import { t } from './language.js';

const knowledgeDialog = document.querySelector('#knowledge-dialog');
const openButton = document.querySelector('#entity-graph-open');
const refreshButton = document.querySelector('#entity-graph-refresh');
const fitButton = document.querySelector('#entity-graph-fit');
const graphCanvas = document.querySelector('#entity-graph-canvas');
const graphStatus = document.querySelector('#entity-graph-status');
const graphSummary = document.querySelector('#entity-graph-summary');
const graphEmpty = document.querySelector('#entity-graph-empty');
const selectionEmpty = document.querySelector('#entity-graph-selection-empty');
const selectionDetails = document.querySelector('#entity-graph-selection');
const selectedLabel = document.querySelector('#entity-graph-selected-label');
const selectedType = document.querySelector('#entity-graph-selected-type');
const evidenceList = document.querySelector('#entity-graph-evidence-list');
const evidenceMore = document.querySelector('#entity-graph-evidence-more');
const MAX_EVIDENCE_ITEMS = 12;
const NODE_LABEL_LINE_LENGTH = 22;
const ORBIT_LAYER_GAP = 180;
const ORBIT_NODE_GAP = 54;
const MIN_ORBIT_RADIUS = 180;

const NODE_SHAPES = {
    document: 'box',
    knowledge_item: 'dot',
    document_type: 'triangle',
    project: 'hexagon',
    product: 'diamond',
    topic: 'ellipse',
    tag: 'star'
};

let network;
let currentGraph;
let requestId = 0;

function getEnabledDocumentIds() {
    return [...document.querySelectorAll('#knowledge-document-list .knowledge-document')]
        .filter((row) => row.querySelector('input[type="checkbox"]')?.checked)
        .map((row) => row.dataset.documentId)
        .filter(Boolean);
}

function setGraphStatus(message, state) {
    graphStatus.textContent = message;
    graphStatus.dataset.state = state;
}

function showEmptyMessage(message) {
    graphEmpty.textContent = message;
    graphEmpty.hidden = false;
}

function clearSelection() {
    selectionDetails.hidden = true;
    selectionEmpty.hidden = false;
    evidenceList.replaceChildren();
    evidenceMore.hidden = true;
}

function validateGraph(graph) {
    if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
        throw new Error(t('entity-graph-invalid-data'));
    }

    const nodeIds = new Set();
    for (const node of graph.nodes) {
        if (
            typeof node.id !== 'string'
            || typeof node.label !== 'string'
            || typeof node.type !== 'string'
        ) {
            throw new Error(t('entity-graph-invalid-data'));
        }
        nodeIds.add(node.id);
    }

    for (const edge of graph.edges) {
        if (
            typeof edge.id !== 'string'
            || typeof edge.source !== 'string'
            || typeof edge.target !== 'string'
            || typeof edge.label !== 'string'
            || !Array.isArray(edge.evidence)
            || !nodeIds.has(edge.source)
            || !nodeIds.has(edge.target)
        ) {
            throw new Error(t('entity-graph-invalid-data'));
        }
        if (edge.evidence.some((item) => (
            !item
            || typeof item.document_id !== 'string'
            || typeof item.document_name !== 'string'
            || typeof item.title !== 'string'
        ))) {
            throw new Error(t('entity-graph-invalid-data'));
        }
    }

    return graph;
}

async function fetchGraph(documentIds) {
    const url = new URL('http://127.0.0.1:8000/graph');
    documentIds.forEach((documentId) => url.searchParams.append('document_ids', documentId));
    const response = await fetch(url);
    const result = await response.json();

    if (!response.ok) {
        throw new Error(typeof result.detail === 'string'
            ? result.detail
            : `${t('entity-graph-load-error')} (${response.status})`);
    }

    return validateGraph(result);
}

function getGraphColors() {
    const styles = getComputedStyle(document.documentElement);
    const value = (name) => styles.getPropertyValue(name).trim();
    return {
        text: value('--text'),
        muted: value('--muted'),
        edge: value('--graph-edge'),
        document: value('--graph-document'),
        knowledge_item: value('--graph-item'),
        document_type: value('--graph-type'),
        project: value('--graph-project'),
        product: value('--graph-product'),
        topic: value('--graph-topic'),
        tag: value('--graph-tag')
    };
}

function wrapNodeLabel(label) {
    const lines = [];
    let line = '';

    label.split(/\s+/).forEach((originalWord) => {
        let word = originalWord;
        while (word.length > NODE_LABEL_LINE_LENGTH) {
            if (line) {
                lines.push(line);
                line = '';
            }
            lines.push(word.slice(0, NODE_LABEL_LINE_LENGTH));
            word = word.slice(NODE_LABEL_LINE_LENGTH);
        }

        if (line && line.length + word.length + 1 > NODE_LABEL_LINE_LENGTH) {
            lines.push(line);
            line = '';
        }
        line = line ? `${line} ${word}` : word;
    });

    if (line) lines.push(line);
    return lines.join('\n');
}

function getOrbitPositions(graph) {
    const adjacency = new Map(graph.nodes.map((node) => [node.id, []]));
    graph.edges.forEach(({ source, target }) => {
        adjacency.get(source).push(target);
        adjacency.get(target).push(source);
    });

    const distances = new Map();
    let remaining = [...graph.nodes];
    let startLevel = 0;

    while (remaining.length) {
        const documentRoots = remaining.filter((node) => node.type === 'document');
        const roots = documentRoots.length
            ? documentRoots
            : [remaining.reduce((best, node) => (
                adjacency.get(node.id).length > adjacency.get(best.id).length ? node : best
            ))];
        const queue = [];

        roots.forEach((root) => {
            distances.set(root.id, startLevel);
            queue.push(root.id);
        });

        for (let index = 0; index < queue.length; index += 1) {
            const nodeId = queue[index];
            adjacency.get(nodeId).forEach((neighborId) => {
                if (distances.has(neighborId)) return;
                distances.set(neighborId, distances.get(nodeId) + 1);
                queue.push(neighborId);
            });
        }

        remaining = graph.nodes.filter((node) => !distances.has(node.id));
        if (remaining.length) {
            startLevel = Math.max(...distances.values()) + 1;
        }
    }

    const layers = new Map();
    graph.nodes.forEach((node) => {
        const level = distances.get(node.id);
        if (!layers.has(level)) layers.set(level, []);
        layers.get(level).push(node);
    });

    const positions = new Map();
    let previousRadius = 0;
    [...layers.entries()].sort(([left], [right]) => left - right).forEach(([level, nodes]) => {
        nodes.sort((left, right) => (
            left.label.localeCompare(right.label) || left.id.localeCompare(right.id)
        ));
        const radius = level === 0 && nodes.length === 1
            ? 0
            : Math.max(
                MIN_ORBIT_RADIUS + Math.max(0, level - 1) * ORBIT_LAYER_GAP,
                (nodes.length * ORBIT_NODE_GAP) / (2 * Math.PI),
                previousRadius + ORBIT_LAYER_GAP
            );
        const angleOffset = -Math.PI / 2;

        nodes.forEach((node, index) => {
            const angle = angleOffset + (2 * Math.PI * index) / nodes.length;
            positions.set(node.id, {
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius
            });
        });
        previousRadius = Math.max(previousRadius, radius);
    });

    return positions;
}

function makeNetworkData(graph) {
    const colors = getGraphColors();
    const positions = getOrbitPositions(graph);
    const nodes = new window.vis.DataSet(graph.nodes.map((node) => {
        const color = colors[node.type] || colors.knowledge_item;
        return {
            ...node,
            ...positions.get(node.id),
            label: wrapNodeLabel(node.label),
            title: node.label,
            shape: NODE_SHAPES[node.type] || 'dot',
            color: {
                background: color,
                border: color,
                highlight: { background: color, border: colors.text },
                hover: { background: color, border: colors.text }
            },
            font: { color: colors.text, face: 'IBM Plex Mono', size: 10 },
            borderWidth: 2,
            size: node.type === 'knowledge_item' ? 10 : 14
        };
    }));
    const edges = new window.vis.DataSet(graph.edges.map((edge) => ({
        ...edge,
        from: edge.source,
        to: edge.target,
        label: '',
        color: {
            color: colors.edge,
            highlight: colors.knowledge_item,
            hover: colors.knowledge_item
        },
        width: 1.5,
        hoverWidth: 2,
        arrows: { to: { enabled: true, scaleFactor: 0.35 } },
        smooth: { type: 'continuous', roundness: 0.15 }
    })));

    return { nodes, edges };
}

function getEvidence(edges) {
    const evidence = new Map();
    edges.flatMap((edge) => edge.evidence).forEach((item) => {
        const key = `${item.document_id}\0${item.title}\0${item.source_url ?? ''}`;
        evidence.set(key, item);
    });
    return [...evidence.values()];
}

function safeSourceUrl(sourceUrl) {
    if (typeof sourceUrl !== 'string') return undefined;
    try {
        const url = new URL(sourceUrl);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined;
    } catch {
        return undefined;
    }
}

function renderEvidence(items) {
    evidenceList.replaceChildren();
    const visibleItems = items.slice(0, MAX_EVIDENCE_ITEMS);

    visibleItems.forEach((item) => {
        const entry = document.createElement('li');
        const title = document.createElement('strong');
        const source = document.createElement('span');
        title.textContent = item.title;
        source.textContent = item.document_name;
        entry.append(title, source);

        const sourceUrl = safeSourceUrl(item.source_url);
        if (sourceUrl) {
            const link = document.createElement('a');
            link.href = sourceUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = t('entity-graph-source-link');
            entry.append(link);
        }
        evidenceList.append(entry);
    });

    evidenceMore.hidden = items.length <= MAX_EVIDENCE_ITEMS;
    if (!evidenceMore.hidden) {
        evidenceMore.textContent = t('entity-graph-evidence-more')
            .replace('{count}', String(items.length - MAX_EVIDENCE_ITEMS));
    }
}

function showSelection(label, type, edges, relation = '') {
    selectedLabel.textContent = label;
    const typeLabel = t(`entity-graph-type-${type}`, type);
    const relationLabel = relation
        ? t(`entity-graph-relation-${relation}`, relation)
        : '';
    selectedType.textContent = relationLabel
        ? `${relationLabel} · ${typeLabel}`
        : typeLabel;

    const evidence = getEvidence(edges);
    renderEvidence(evidence);
    if (!evidence.length) {
        const emptyEvidence = document.createElement('li');
        emptyEvidence.textContent = t('entity-graph-no-evidence');
        evidenceList.append(emptyEvidence);
    }

    selectionEmpty.hidden = true;
    selectionDetails.hidden = false;
}

function handleGraphClick({ nodes, edges }) {
    if (nodes.length) {
        const nodeId = nodes[0];
        const node = currentGraph.nodes.find((item) => item.id === nodeId);
        const relatedEdges = currentGraph.edges.filter(
            (edge) => edge.source === nodeId || edge.target === nodeId
        );
        if (node) showSelection(node.label, node.type, relatedEdges);
        return;
    }

    if (edges.length) {
        const edge = currentGraph.edges.find((item) => item.id === edges[0]);
        if (edge) {
            const source = currentGraph.nodes.find((item) => item.id === edge.source);
            const target = currentGraph.nodes.find((item) => item.id === edge.target);
            showSelection(
                `${source?.label ?? edge.source} → ${target?.label ?? edge.target}`,
                'relation',
                [edge],
                edge.label
            );
        }
        return;
    }

    clearSelection();
}

function updateNetwork(graph, fit = true) {
    if (!window.vis?.Network || !window.vis?.DataSet) {
        throw new Error(t('entity-graph-library-unavailable'));
    }

    const data = makeNetworkData(graph);
    if (!network) {
        network = new window.vis.Network(graphCanvas, data, {
            autoResize: true,
            interaction: {
                hover: true,
                keyboard: { enabled: true, bindToWindow: false },
                navigationButtons: false,
                tooltipDelay: 150
            },
            physics: { enabled: false },
            nodes: { chosen: true },
            edges: { chosen: true }
        });
        network.on('click', handleGraphClick);
        network.on('stabilizationIterationsDone', () => network.fit({ animation: true }));
    } else {
        network.setData(data);
    }

    if (fit) network.fit({ animation: true });
}

async function openEntityGraph() {
    if (knowledgeDialog.open) knowledgeDialog.close();
    const currentRequestId = ++requestId;
    currentGraph = undefined;
    fitButton.disabled = true;
    graphSummary.textContent = '';
    clearSelection();
    showEmptyMessage(t('entity-graph-loading'));
    setGraphStatus(t('entity-graph-loading'), 'loading');

    const documentIds = getEnabledDocumentIds();
    if (!documentIds.length) {
        setGraphStatus(t('entity-graph-no-documents'), 'empty');
        showEmptyMessage(t('entity-graph-no-documents'));
        return;
    }

    try {
        const graph = await fetchGraph(documentIds);
        if (currentRequestId !== requestId) return;
        currentGraph = graph;

        if (!graph.nodes.length) {
            setGraphStatus(t('entity-graph-empty-result'), 'empty');
            showEmptyMessage(t('entity-graph-empty-result'));
            return;
        }

        graphEmpty.hidden = true;
        updateNetwork(graph);
        fitButton.disabled = false;
        graphSummary.textContent = t('entity-graph-summary')
            .replace('{nodes}', String(graph.nodes.length))
            .replace('{edges}', String(graph.edges.length));
        setGraphStatus(
            graph.edges.length
                ? t('entity-graph-loaded')
                : t('entity-graph-no-relationships'),
            'ready'
        );
    } catch (error) {
        if (currentRequestId !== requestId) return;
        console.error('Could not render the entity graph:', error);
        const detail = error instanceof Error ? error.message : t('entity-graph-load-error');
        setGraphStatus(`${t('entity-graph-load-error')} ${detail}`, 'error');
        showEmptyMessage(t('entity-graph-load-error'));
    }
}

export function initializeEntityGraph() {
    openButton.addEventListener('click', openEntityGraph);
    refreshButton.addEventListener('click', openEntityGraph);
    fitButton.addEventListener('click', () => network?.fit({
        nodes: currentGraph?.nodes.map((node) => node.id),
        animation: { duration: 450, easingFunction: 'easeInOutQuad' }
    }));

    const themeObserver = new MutationObserver(() => {
        if (!network || !currentGraph) return;
        network.setData(makeNetworkData(currentGraph));
    });
    themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme']
    });
}
