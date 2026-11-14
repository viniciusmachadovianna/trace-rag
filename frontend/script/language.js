const FALLBACK_LANGUAGE = 'en';
const SUPPORTED_LANGUAGES = ['en', 'pt-BR'];

const translations = {
    en: {
        'system-status': 'LOCAL SYSTEM ONLINE',
        'workspace': 'WORKSPACE',
        'conversations': 'CONVERSATIONS',
        'new-conversation': 'NEW CONVERSATION',
        'new-investigation': 'New investigation',
        'information-title': 'Skill Shard / System information',
        'information-subtitle': 'Android-inspired RAG interface prototype',
        'information-description': 'Original documents are kept in this browser and indexed in the local backend. Questions and retrieved excerpts are sent to Gemini.',
        'information-version': 'SS-800 / INTERFACE V.01',
        'close-information': 'Close information',
        'delete-conversation': 'Delete conversation',
        'delete-conversation-confirm': 'Delete "{name}"?',
        'delete-conversation-title': 'Delete conversation?',
        'conversation-deleted': 'Conversation deleted.',
        'cancel': 'Cancel',
        'delete': 'Delete',
        'brand-tagline': 'RETRIEVAL AUGMENTED INTELLIGENCE',
        'interface-initialized': 'COGNITIVE INTERFACE INITIALIZED',
        'knowledge-base': 'Knowledge base',
        'documents-available': 'DOCUMENTS AVAILABLE',
        'knowledge-summary': '{count} documents · Stored locally',
        'close-knowledge-base': 'Close knowledge base',
        'supported-document-formats': 'TXT / MARKDOWN / CSV / JSON / PDF · UP TO 2 MB EACH',
        'knowledge-local-note': 'Repository documents from data/ are listed automatically and start disabled. Enabled originals, text chunks, and embeddings are stored in the local backend. Gemini generates embeddings and answers.',
        'document-preview-title': 'DOCUMENT PREVIEW',
        'document-preview-select-label': 'Select an enabled document to preview',
        'document-preview-empty': 'Enable a document in the knowledge base to preview it here.',
        'document-preview-pdf-readd': 'Remove and add this PDF again to preview it.',
        'document-preview-error': 'This document preview could not be loaded.',
        'document-preview-no-text': 'This document does not contain readable text.',
        'document-preview-truncated': 'Preview limited to the first 1,200 characters.',
        'knowledge-documents': 'Knowledge base documents',
        'knowledge-empty': 'No documents found. Add a file or place a supported document in data/.',
        'repository-documents-error': 'Could not load repository documents. Check that the backend is running and try again.',
        'toggle-document': 'Use {name} in the knowledge base',
        'delete-document': 'Delete {name}',
        'delete-document-title': 'Delete document',
        'document-singular': 'DOCUMENT',
        'document-plural': 'DOCUMENTS',
        'documents-added': '{count} document(s) added to this browser.',
        'document-deleted': 'Document deleted.',
        'unsupported-document-type': '{name}: file type not supported.',
        'document-too-large': '{name}: maximum file size is 2 MB.',
        'knowledge-storage-error': 'Could not access local document storage. Check browser storage permissions and try again.',
        'document-indexing-error': 'Could not prepare document vectors. Check the embedding model connection and retry.',
        'document-backend-delete-error': 'Could not remove this document from the local backend. Check that the backend is running and try again.',
        'operator': 'Operator',
        'local-session': 'LOCAL SESSION',
        'knowledge-sources': 'Knowledge sources',
        'source-metric': '00 DOCUMENTS',
        'source-metric-short': '00 DOCUMENTS',
        'objective-label': 'SELECT AN OBJECTIVE',
        'greeting-title': 'What do you',
        'greeting-emphasis': 'want to know?',
        'greeting-subtitle': "Every answer begins with a question. Let's find yours in the knowledge you trust.",
        'objective-analyze': 'Analyze a document',
        'objective-connect': 'Connect the dots',
        'objective-summary': 'Summarize a document',
        'objective-search': 'Search knowledge',
        'prompt-placeholder': 'Analyze the key findings in my documents.',
        'prompt-aria': 'Ask a question',
        'awaiting-input': 'AWAITING YOUR INPUT',
        'backend-checking': 'CHECKING MODEL CONNECTION',
        'indexing-documents': 'INDEXING KNOWLEDGE BASE',
        'indexing-failed': 'DOCUMENT INDEXING FAILED',
        'backend-ready': 'MODEL CONNECTION READY',
        'backend-config-missing': 'MODEL CONFIGURATION MISSING',
        'backend-model-unavailable': 'MODEL UNAVAILABLE',
        'backend-unavailable': 'BACKEND UNAVAILABLE',
        'backend-check-timeout': 'CONNECTION CHECK TIMED OUT',
        'backend-retry': 'RETRY CHECK',
        'knowledge-base-meta': 'KNOWLEDGE BASE',
        'retrieval-mode-label': 'Select retrieval mode',
        'no-sources': 'NO SOURCES',
        'rag-mode': 'RAG MODE',
        'composer-footnote': 'Answers grounded in your documents. Decisions remain yours.',
        'new-conversation-toast': 'New investigation started.',
        'request-failed': 'Could not get an answer. Check that the backend is running and try again.',
        'assistant': 'ASSISTANT',
        'system-telemetry': 'SYSTEM TELEMETRY',
        'inference-engine': 'Inference engine',
        'chunking-overlap': 'Chunking overlap',
        'lm-model': 'LM Model',
        'conversation-memory': 'Conversation memory',
        'retrieval-protocol': 'Retrieval protocol',
        'not-connected': 'NOT CONNECTED',
        'local': 'LOCAL',
        'standby': 'STANDBY',
        'gemini': 'Gemini',
        'sidebar-collapse': 'Hide workspace sidebar',
        'sidebar-expand': 'Show workspace sidebar',
        'assistant-collapse': 'Hide assistant panel',
        'assistant-expand': 'Show assistant panel',
        'language-toggle': 'Switch language',
        'prompt-analyze': 'Analyze the key findings in my documents.',
        'prompt-connect': 'Connect the dots across my knowledge base.',
        'prompt-summary': 'Give me a concise summary of my documents.',
        'prompt-search': 'Search my knowledge base for a specific topic.'
    },
    'pt-BR': {
        'system-status': 'SISTEMA LOCAL ONLINE',
        'workspace': 'ESPAÇO DE TRABALHO',
        'conversations': 'CONVERSAS',
        'new-conversation': 'NOVA CONVERSA',
        'new-investigation': 'Nova investigação',
        'information-title': 'Skill Shard / Informações do sistema',
        'information-subtitle': 'Protótipo de interface RAG inspirado no Android',
        'information-description': 'Os documentos originais ficam neste navegador e são indexados no backend local. Perguntas e trechos recuperados são enviados ao Gemini.',
        'information-version': 'SS-800 / INTERFACE V.01',
        'close-information': 'Fechar informações',
        'delete-conversation': 'Excluir conversa',
        'delete-conversation-confirm': 'Excluir "{name}"?',
        'delete-conversation-title': 'Excluir conversa?',
        'conversation-deleted': 'Conversa excluída.',
        'cancel': 'Cancelar',
        'delete': 'Excluir',
        'brand-tagline': 'INTELIGÊNCIA AUMENTADA POR RECUPERAÇÃO',
        'interface-initialized': 'INTERFACE COGNITIVA INICIALIZADA',
        'knowledge-base': 'Base de conhecimento',
        'documents-available': 'DOCUMENTOS DISPONÍVEIS',
        'knowledge-summary': '{count} documento(s) · Armazenados localmente',
        'close-knowledge-base': 'Fechar base de conhecimento',
        'supported-document-formats': 'TXT / MARKDOWN / CSV / JSON / PDF · ATÉ 2 MB CADA',
        'knowledge-local-note': 'Documentos da pasta data/ são listados automaticamente e começam desativados. Originais ativados, trechos e embeddings ficam no backend local. O Gemini gera os embeddings e as respostas.',
        'document-preview-title': 'PRÉVIA DO DOCUMENTO',
        'document-preview-select-label': 'Selecione um documento ativado para visualizar',
        'document-preview-empty': 'Ative um documento na base de conhecimento para visualizá-lo aqui.',
        'document-preview-pdf-readd': 'Remova e adicione este PDF novamente para visualizá-lo.',
        'document-preview-error': 'Não foi possível carregar a prévia deste documento.',
        'document-preview-no-text': 'Este documento não contém texto legível.',
        'document-preview-truncated': 'Prévia limitada aos primeiros 1.200 caracteres.',
        'knowledge-documents': 'Documentos da base de conhecimento',
        'knowledge-empty': 'Nenhum documento encontrado. Adicione um arquivo ou coloque um documento compatível em data/.',
        'repository-documents-error': 'Não foi possível carregar os documentos do repositório. Verifique se o backend está ativo e tente novamente.',
        'toggle-document': 'Usar {name} na base de conhecimento',
        'delete-document': 'Excluir {name}',
        'delete-document-title': 'Excluir documento',
        'document-singular': 'DOCUMENTO',
        'document-plural': 'DOCUMENTOS',
        'documents-added': '{count} documento(s) adicionado(s) a este navegador.',
        'document-deleted': 'Documento excluído.',
        'unsupported-document-type': '{name}: tipo de arquivo não suportado.',
        'document-too-large': '{name}: o tamanho máximo é 2 MB.',
        'knowledge-storage-error': 'Não foi possível acessar o armazenamento local. Verifique as permissões do navegador e tente novamente.',
        'document-indexing-error': 'Não foi possível preparar os vetores dos documentos. Verifique a conexão com o modelo de embeddings e tente novamente.',
        'document-backend-delete-error': 'Não foi possível remover este documento do backend local. Verifique se o backend está ativo e tente novamente.',
        'operator': 'Operador',
        'local-session': 'SESSÃO LOCAL',
        'knowledge-sources': 'Fontes de conhecimento',
        'source-metric': '00 DOCUMENTOS',
        'source-metric-short': '00 DOCUMENTOS',
        'objective-label': 'SELECIONE UM OBJETIVO',
        'greeting-title': 'O que você',
        'greeting-emphasis': 'quer saber?',
        'greeting-subtitle': 'Toda resposta começa com uma pergunta. Vamos encontrar a sua no conhecimento em que você confia.',
        'objective-analyze': 'Analisar um documento',
        'objective-connect': 'Conectar ideias',
        'objective-summary': 'Resumir um documento',
        'objective-search': 'Buscar conhecimento',
        'prompt-placeholder': 'Analise os principais achados dos meus documentos.',
        'prompt-aria': 'Faça uma pergunta',
        'awaiting-input': 'AGUARDANDO SUA ENTRADA',
        'backend-checking': 'VERIFICANDO CONEXÃO COM O MODELO',
        'indexing-documents': 'INDEXANDO BASE DE CONHECIMENTO',
        'indexing-failed': 'FALHA AO INDEXAR DOCUMENTOS',
        'backend-ready': 'CONEXÃO COM O MODELO PRONTA',
        'backend-config-missing': 'CONFIGURAÇÃO DO MODELO AUSENTE',
        'backend-model-unavailable': 'MODELO INDISPONÍVEL',
        'backend-unavailable': 'BACKEND INDISPONÍVEL',
        'backend-check-timeout': 'TEMPO ESGOTADO AO VERIFICAR CONEXÃO',
        'backend-retry': 'VERIFICAR NOVAMENTE',
        'knowledge-base-meta': 'BASE DE CONHECIMENTO',
        'retrieval-mode-label': 'Selecionar modo de recuperação',
        'no-sources': 'SEM FONTES',
        'rag-mode': 'MODO RAG',
        'composer-footnote': 'Respostas fundamentadas nos seus documentos. As decisões continuam sendo suas.',
        'new-conversation-toast': 'Nova investigação iniciada.',
        'request-failed': 'Não foi possível obter uma resposta. Verifique se o backend está ativo e tente novamente.',
        'assistant': 'ASSISTENTE',
        'system-telemetry': 'TELEMETRIA DO SISTEMA',
        'inference-engine': 'Motor de inferência',
        'chunking-overlap': 'Sobreposição de chunks',
        'lm-model': 'Modelo de IA',
        'conversation-memory': 'Memória da conversa',
        'retrieval-protocol': 'Protocolo de recuperação',
        'not-connected': 'NÃO CONECTADO',
        'local': 'LOCAL',
        'standby': 'EM ESPERA',
        'gemini': 'Gemini',
        'sidebar-collapse': 'Ocultar barra lateral',
        'sidebar-expand': 'Mostrar barra lateral',
        'assistant-collapse': 'Ocultar painel do assistente',
        'assistant-expand': 'Mostrar painel do assistente',
        'language-toggle': 'Alternar idioma',
        'prompt-analyze': 'Analise os principais achados dos meus documentos.',
        'prompt-connect': 'Conecte os pontos ao longo da minha base de conhecimento.',
        'prompt-summary': 'Me dê um resumo conciso dos meus documentos.',
        'prompt-search': 'Pesquise minha base de conhecimento por um tópico específico.'
    }
};

function normalizeLanguage(language) {
    if (language === 'pt-BR') return 'pt-BR';
    return FALLBACK_LANGUAGE;
}

function getStoredLanguage() {
    try {
        const stored = localStorage.getItem('deviant-language');
        return normalizeLanguage(stored);
    } catch (error) {
        return FALLBACK_LANGUAGE;
    }
}

export function getCurrentLanguage() {
    return normalizeLanguage(document.documentElement.dataset.lang || getStoredLanguage());
}

export function t(key, fallback = '') {
    const current = getCurrentLanguage();
    return translations[current]?.[key] ?? translations[FALLBACK_LANGUAGE]?.[key] ?? fallback ?? key;
}

export function applyLanguage(language = getStoredLanguage()) {
    const current = normalizeLanguage(language);
    document.documentElement.dataset.lang = current;
    document.documentElement.lang = current === 'pt-BR' ? 'pt-BR' : 'en';

    const dict = translations[current];

    document.querySelectorAll('[data-i18n]').forEach((element) => {
        const key = element.dataset.i18n;
        const value = dict[key];
        if (!value) return;
        element.textContent = value;
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
        const key = element.dataset.i18nPlaceholder;
        const value = dict[key];
        if (!value) return;
        element.placeholder = value;
    });

    document.querySelectorAll('[data-i18n-aria]').forEach((element) => {
        const key = element.dataset.i18nAria;
        const value = dict[key];
        if (!value) return;
        element.setAttribute('aria-label', value);
    });

    document.querySelectorAll('[data-i18n-title]').forEach((element) => {
        const key = element.dataset.i18nTitle;
        const value = dict[key];
        if (!value) return;
        element.title = value;
    });

    document.querySelectorAll('[data-prompt-key]').forEach((element) => {
        const key = element.dataset.promptKey;
        const value = dict[key];
        if (!value) return;
        element.dataset.prompt = value;
    });

    try {
        localStorage.setItem('deviant-language', current);
    } catch (error) {
        console.warn('Could not save language preference.', error);
    }
}

export function toggleLanguage() {
    const nextLanguage = getCurrentLanguage() === 'pt-BR' ? 'en' : 'pt-BR';
    applyLanguage(nextLanguage);
    return nextLanguage;
}

export function initializeLanguage() {
    const savedLanguage = getStoredLanguage();
    applyLanguage(savedLanguage);

    const languageToggle = document.getElementById('language-toggle');
    if (!languageToggle) return;

    languageToggle.addEventListener('click', () => {
        toggleLanguage();
    });
}

export const supportedLanguages = SUPPORTED_LANGUAGES;
