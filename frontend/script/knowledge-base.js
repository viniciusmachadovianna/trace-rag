import { t } from './language.js';

const DATABASE_NAME = 'skill-shard-knowledge-base';
const DATABASE_VERSION = 1;
const STORE_NAME = 'documents';
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = new Set(['txt', 'md', 'csv', 'json', 'pdf']);

const dialog = document.querySelector('#knowledge-dialog');
const knowledgeButton = document.querySelector('#knowledge-button');
const closeButton = document.querySelector('#knowledge-close');
const addButton = document.querySelector('#add-documents');
const fileInput = document.querySelector('#file-input');
const documentList = document.querySelector('#knowledge-document-list');
const emptyState = document.querySelector('#knowledge-empty');
const summary = document.querySelector('#knowledge-summary');
const documentCount = document.querySelector('#document-count');
const sourceMetric = document.querySelector('#source-metric');
const previewSelect = document.querySelector('#assistant-document-select');
const previewEmpty = document.querySelector('#assistant-document-empty');
const previewText = document.querySelector('#assistant-document-text');
const previewPdf = document.querySelector('#assistant-document-pdf');
const PREVIEW_CHARACTER_LIMIT = 1200;

let databasePromise;
let currentDocuments = [];
let selectedPreviewDocumentId;
let previewObjectUrl;

function openDatabase() {
    if (!('indexedDB' in window)) {
        return Promise.reject(new Error('This browser does not support local document storage.'));
    }

    if (!databasePromise) {
        databasePromise = new Promise((resolve, reject) => {
            const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

            request.onupgradeneeded = () => {
                if (!request.result.objectStoreNames.contains(STORE_NAME)) {
                    request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error ?? new Error('Could not open local document storage.'));
            request.onblocked = () => reject(new Error('Local document storage is blocked by another tab.'));
        }).catch((error) => {
            databasePromise = undefined;
            throw error;
        });
    }

    return databasePromise;
}

async function runTransaction(mode, operation) {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const request = operation(transaction.objectStore(STORE_NAME));
        let result;

        request.onsuccess = () => {
            result = request.result;
        };
        request.onerror = () => reject(request.error ?? new Error('Local document storage request failed.'));
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () => reject(transaction.error ?? new Error('Local document storage transaction failed.'));
        transaction.onabort = () => reject(transaction.error ?? new Error('Local document storage transaction was aborted.'));
    });
}

function getDocuments() {
    return runTransaction('readonly', (store) => store.getAll());
}

function saveDocument(document) {
    return runTransaction('readwrite', (store) => store.put(document));
}

function removeDocument(id) {
    return runTransaction('readwrite', (store) => store.delete(id));
}

async function removeIndexedDocument(id) {
    const response = await fetch(
        `http://127.0.0.1:8000/documents?document_id=${encodeURIComponent(id)}`,
        { method: 'DELETE' }
    );
    const result = await response.json();
    if (!response.ok) {
        throw new Error(typeof result.detail === 'string'
            ? result.detail
            : `Response status: ${response.status}`);
    }
}

async function synchronizeRepositoryDocuments() {
    const response = await fetch('http://127.0.0.1:8000/documents?include_chunk_counts=true');
    const repositoryDocuments = await response.json();
    if (!response.ok) {
        throw new Error(typeof repositoryDocuments.detail === 'string'
            ? repositoryDocuments.detail
            : `Response status: ${response.status}`);
    }
    if (!Array.isArray(repositoryDocuments) || repositoryDocuments.some((document) => (
        typeof document.id !== 'string'
        || !document.id.startsWith('repository:')
        || typeof document.name !== 'string'
        || typeof document.content !== 'string'
        || !['text', 'base64'].includes(document.encoding)
        || (document.chunk_count !== undefined && (!Number.isInteger(document.chunk_count) || document.chunk_count < 0))
    ))) {
        throw new Error('The API returned an invalid repository document list.');
    }

    const storedDocuments = await getDocuments();
    const storedRepositoryDocuments = new Map(
        storedDocuments
            .filter((document) => document.source === 'repository')
            .map((document) => [document.id, document])
    );
    const currentIds = new Set();
    let changed = false;

    for (const document of repositoryDocuments) {
        currentIds.add(document.id);
        const storedDocument = storedRepositoryDocuments.get(document.id);
        const chunkCount = Number.isInteger(document.chunk_count) ? document.chunk_count : storedDocument?.chunk_count ?? 0;
        if (
            !storedDocument
            || storedDocument.name !== document.name
            || storedDocument.content !== document.content
            || storedDocument.encoding !== document.encoding
            || storedDocument.chunk_count !== chunkCount
        ) {
            changed = true;
        }
        await saveDocument({
            ...document,
            source: 'repository',
            enabled: storedDocument?.enabled ?? false,
            chunk_count: chunkCount
        });
    }

    for (const [id] of storedRepositoryDocuments) {
        if (!currentIds.has(id)) {
            try {
                await removeIndexedDocument(id);
            } catch (error) {
                console.error('Could not remove a deleted repository document from the backend:', error);
                throw new Error(t('document-backend-delete-error'));
            }
            await removeDocument(id);
            changed = true;
        }
    }

    return changed;
}

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';

    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }

    return window.btoa(binary);
}

async function readDocumentFile(file, extension) {
    if (extension === 'pdf') {
        return {
            content: arrayBufferToBase64(await file.arrayBuffer()),
            encoding: 'base64'
        };
    }

    return {
        content: await file.text(),
        encoding: 'text'
    };
}

export async function getEnabledDocuments() {
    const documents = await getDocuments();
    return documents
        .filter((document) => document.enabled)
        .map(({ id, name, content, encoding }) => ({
            id,
            name,
            content,
            encoding: encoding ?? 'text'
        }));
}

async function requestDocumentIndex(documents) {
    const response = await fetch('http://127.0.0.1:8000/index?include_chunk_counts=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documents })
    });

    const result = await response.json();
    if (!response.ok) {
        throw new Error(typeof result.detail === 'string'
            ? result.detail
            : `Response status: ${response.status}`);
    }
    if (!Number.isInteger(result.indexed_chunks) || result.indexed_chunks < 0) {
        throw new Error('The API returned an invalid document indexing result.');
    }
    if (result.chunk_counts !== undefined && (typeof result.chunk_counts !== 'object' || result.chunk_counts === null)) {
        throw new Error('The API returned an invalid chunk count payload.');
    }

    return result;
}

async function updateDocumentChunkCounts(documents, chunkCounts = {}) {
    if (!documents.length) return;

    const storedDocuments = new Map(
        (await getDocuments()).map((document) => [document.id, document])
    );
    for (const document of documents) {
        const count = Number(chunkCounts[document.id]);
        if (!Number.isInteger(count) || count < 0) continue;
        const storedDocument = storedDocuments.get(document.id);
        if (!storedDocument) {
            throw new Error(`Could not find document ${document.id} while updating its chunk count.`);
        }
        await saveDocument({ ...storedDocument, chunk_count: count });
    }
}

function formatSummary(count) {
    return t('knowledge-summary').replace('{count}', String(count));
}

function updateDocumentCounters(documents) {
    const enabledCount = documents.filter((document) => document.enabled).length;
    documentCount.textContent = String(enabledCount);
    sourceMetric.textContent = `${String(enabledCount).padStart(2, '0')} ${t(enabledCount === 1 ? 'document-singular' : 'document-plural')}`;
    summary.textContent = formatSummary(documents.length);
    documentList.hidden = documents.length === 0;
    emptyState.hidden = documents.length !== 0;
}

function createDocumentRow(document) {
    const row = documentList.ownerDocument.createElement('li');
    row.className = 'knowledge-document';
    row.dataset.documentId = document.id;

    const icon = documentList.ownerDocument.createElement('img');
    icon.className = 'knowledge-document-icon';
    icon.src = 'assets/icons/database.svg';
    icon.alt = '';
    icon.setAttribute('aria-hidden', 'true');

    const copy = documentList.ownerDocument.createElement('div');
    copy.className = 'knowledge-document-copy';

    const name = documentList.ownerDocument.createElement('span');
    name.className = 'knowledge-document-name';
    name.textContent = document.name;
    name.title = document.name;

    const metadata = documentList.ownerDocument.createElement('span');
    metadata.className = 'knowledge-document-meta';
    const chunkCount = Number(document.chunk_count ?? 0);
    metadata.textContent = `${chunkCount} chunk${chunkCount === 1 ? '' : 's'}`;

    copy.append(name, metadata);

    const toggleLabel = documentList.ownerDocument.createElement('label');
    toggleLabel.className = 'knowledge-switch';
    const toggle = documentList.ownerDocument.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = document.enabled;
    toggle.setAttribute('aria-label', t('toggle-document').replace('{name}', document.name));
    const toggleTrack = documentList.ownerDocument.createElement('span');
    toggleTrack.className = 'knowledge-switch-track';
    toggleTrack.setAttribute('aria-hidden', 'true');
    toggleLabel.append(toggle, toggleTrack);

    row.append(icon, copy, toggleLabel);
    if (document.source !== 'repository') {
        const deleteButton = documentList.ownerDocument.createElement('button');
        deleteButton.className = 'knowledge-delete';
        deleteButton.type = 'button';
        deleteButton.setAttribute('aria-label', t('delete-document').replace('{name}', document.name));
        deleteButton.title = t('delete-document-title');
        const deleteIcon = documentList.ownerDocument.createElement('img');
        deleteIcon.src = 'assets/icons/delete.svg';
        deleteIcon.alt = '';
        deleteIcon.setAttribute('aria-hidden', 'true');
        deleteButton.append(deleteIcon);
        row.append(deleteButton);
    }
    return row;
}

async function renderDocuments() {
    const documents = await getDocuments();
    currentDocuments = documents;
    documentList.replaceChildren(...documents.map(createDocumentRow));
    updateDocumentCounters(documents);
    renderAssistantPreview(documents);
    return documents;
}

function clearPdfPreview() {
    previewPdf.removeAttribute('src');
    if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
        previewObjectUrl = undefined;
    }
}

function renderAssistantPreview(documents) {
    const enabledDocuments = documents.filter((document) => document.enabled);
    const selectedDocument = enabledDocuments.find((document) => document.id === selectedPreviewDocumentId)
        ?? enabledDocuments[0];

    selectedPreviewDocumentId = selectedDocument?.id;
    previewSelect.replaceChildren(...enabledDocuments.map((document) => {
        const option = documentList.ownerDocument.createElement('option');
        option.value = document.id;
        option.textContent = document.name;
        return option;
    }));
    previewSelect.hidden = enabledDocuments.length === 0;
    if (selectedDocument) previewSelect.value = selectedDocument.id;

    previewText.hidden = true;
    previewPdf.hidden = true;
    previewEmpty.hidden = Boolean(selectedDocument);
    previewEmpty.textContent = t('document-preview-empty');
    clearPdfPreview();

    if (!selectedDocument) return;

    const extension = selectedDocument.name.split('.').pop()?.toLowerCase();
    if (extension === 'pdf') {
        if (selectedDocument.encoding !== 'base64') {
            previewEmpty.hidden = false;
            previewEmpty.textContent = t('document-preview-pdf-readd');
            return;
        }

        try {
            const binary = window.atob(selectedDocument.content);
            const bytes = new Uint8Array(binary.length);
            for (let index = 0; index < binary.length; index += 1) {
                bytes[index] = binary.charCodeAt(index);
            }
            previewObjectUrl = URL.createObjectURL(
                new Blob([bytes], { type: 'application/pdf' })
            );
            previewPdf.src = previewObjectUrl;
            previewPdf.hidden = false;
            previewEmpty.hidden = true;
        } catch (error) {
            console.error('Could not render the PDF preview:', error);
            previewEmpty.hidden = false;
            previewEmpty.textContent = t('document-preview-error');
        }
        return;
    }

    const content = selectedDocument.content ?? '';
    const isTruncated = content.length > PREVIEW_CHARACTER_LIMIT;
    previewText.textContent = isTruncated
        ? `${content.slice(0, PREVIEW_CHARACTER_LIMIT)}\n\n${t('document-preview-truncated')}`
        : content || t('document-preview-no-text');
    previewText.hidden = false;
    previewEmpty.hidden = true;
}

function reportStorageError(error, showToast) {
    console.error('Could not update the local knowledge base:', error);
    showToast(t('knowledge-storage-error'));
}

export function initializeKnowledgeBase({ showToast, onIndexingState = () => {} }) {
    let indexRequestId = 0;

    async function indexEnabledDocuments() {
        const requestId = ++indexRequestId;
        onIndexingState('loading');

        try {
            const documents = await getEnabledDocuments();
            const result = await requestDocumentIndex(documents);
            await updateDocumentChunkCounts(documents, result.chunk_counts ?? {});
            await renderDocuments();
            if (requestId === indexRequestId) onIndexingState('ready');
            return result;
        } catch (error) {
            if (requestId === indexRequestId) onIndexingState('error');
            throw error;
        }
    }

    async function retryIndexing() {
        try {
            await synchronizeRepositoryDocuments();
            await renderDocuments();
            await indexEnabledDocuments();
        } catch (error) {
            console.error('Could not index enabled documents:', error);
            showToast(t('document-indexing-error'));
        }
    }

    previewSelect.addEventListener('change', () => {
        selectedPreviewDocumentId = previewSelect.value;
        renderAssistantPreview(currentDocuments);
    });

    async function refreshDocuments({ synchronize = false, index = false } = {}) {
        let repositoryDocumentsChanged = false;
        if (synchronize) {
            try {
                repositoryDocumentsChanged = await synchronizeRepositoryDocuments();
            } catch (error) {
                console.error('Could not load repository documents:', error);
                showToast(t('repository-documents-error'));
            }
        }

        try {
            await renderDocuments();
        } catch (error) {
            reportStorageError(error, showToast);
            if (index) onIndexingState('error');
            return;
        }

        if (index || repositoryDocumentsChanged) {
            try {
                await indexEnabledDocuments();
            } catch (error) {
                console.error('Could not index enabled documents:', error);
                showToast(t('document-indexing-error'));
            }
        }
    }

    function openDialog() {
        if (!dialog.open) dialog.showModal();
        refreshDocuments({ synchronize: true });
    }

    knowledgeButton.addEventListener('click', openDialog);
    closeButton.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
        if (event.target === dialog) dialog.close();
    });

    addButton.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async () => {
        const files = Array.from(fileInput.files ?? []);
        let addedCount = 0;
        const errors = [];

        for (const file of files) {
            const extension = file.name.split('.').pop()?.toLowerCase();
            if (!extension || !SUPPORTED_EXTENSIONS.has(extension)) {
                errors.push(t('unsupported-document-type').replace('{name}', file.name));
                continue;
            }
            if (file.size > MAX_FILE_SIZE) {
                errors.push(t('document-too-large').replace('{name}', file.name));
                continue;
            }

            try {
                const fileContent = await readDocumentFile(file, extension);
                await saveDocument({
                    id: window.crypto.randomUUID(),
                    name: file.name,
                    ...fileContent,
                    enabled: true
                });
                addedCount += 1;
            } catch (error) {
                reportStorageError(error, showToast);
                break;
            }
        }

        fileInput.value = '';
        await refreshDocuments({ index: true });

        if (errors.length) showToast(errors.join(' '));
        else if (addedCount) showToast(t('documents-added').replace('{count}', String(addedCount)));
    });

    documentList.addEventListener('change', async (event) => {
        if (!(event.target instanceof HTMLInputElement) || event.target.type !== 'checkbox') return;

        const row = event.target.closest('.knowledge-document');
        if (!row) return;

        try {
            const documents = await getDocuments();
            const document = documents.find((item) => item.id === row.dataset.documentId);
            if (!document) return;
            document.enabled = event.target.checked;
            await saveDocument(document);
            await refreshDocuments({ index: true });
        } catch (error) {
            reportStorageError(error, showToast);
            await refreshDocuments({ index: true });
        }
    });

    documentList.addEventListener('click', async (event) => {
        if (!(event.target instanceof Element)) return;
        const deleteButton = event.target.closest('.knowledge-delete');
        const row = deleteButton?.closest('.knowledge-document');
        if (!row) return;

        try {
            await removeIndexedDocument(row.dataset.documentId);
            await removeDocument(row.dataset.documentId);
            await refreshDocuments({ index: true });
            showToast(t('document-deleted'));
        } catch (error) {
            console.error('Could not delete the document from the local knowledge base:', error);
            showToast(t('document-backend-delete-error'));
        }
    });

    onIndexingState('loading');
    refreshDocuments({ synchronize: true, index: true });

    return { retryIndexing };
}
