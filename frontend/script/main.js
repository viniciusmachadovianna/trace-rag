import { applyTheme } from './theme.js';
import { applyLanguage, getCurrentLanguage, initializeLanguage, t } from './language.js';
import { clearChat, initializeChat, cancelPendingResponse } from './chat.js';
import { initializeKnowledgeBase } from './knowledge-base.js';
import { initializeEntityGraph } from './entity-graph.js';
import { $ } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    applyTheme();
    initializeLanguage();
});

const appShell = $('.app-shell');

const toast = $('#toast');
let toastTimeout;

const informationModal = $('.information-modal');
const informationDialog = $('#information-dialog');
const informationClose = $('#information-close');
const adjustmentsToggle = $('#adjustments-toggle');
const adjustmentsDialog = $('#adjustments-dialog');
const adjustmentsClose = $('#adjustments-close');
const adjustmentsRetrievalMode = $('#adjustments-retrieval-mode');
const assistantCopy = $('#assistant-copy');
const entityGraphDialog = $('#entity-graph-dialog');
$('#right-panel-preview').append($('#assistant-document-preview'));
const entityGraphHeader = entityGraphDialog.querySelector('.knowledge-dialog-header');
entityGraphHeader.querySelector('#entity-graph-close').remove();
entityGraphHeader.remove();
$('#right-panel-graph').append(entityGraphHeader, $('#entity-graph-refresh'), ...entityGraphDialog.children);
entityGraphDialog.remove();
adjustmentsDialog.append(assistantCopy);
assistantCopy.hidden = false;

const sidebar = $('.sidebar');
const sidebarToggle = $('.sidebar-toggle');
const sidebarToggleIcon = sidebarToggle.querySelector('img');
const sidebarResizeHandle = $('.sidebar-resize-handle');
const rightPanel = $('.right-panel');
const rightPanelToggle = $('.right-panel-toggle');
const rightPanelToggleIcon = rightPanelToggle.querySelector('img');
if (window.matchMedia('(max-width: 800px)').matches) rightPanel.classList.add('is-collapsed');

const conversationList = $('.sidebar-top');
const conversationCount = $('#conversation-count');
const workspaceTitle = $('#workspace-title');
const retrievalMode = $('#retrieval-mode');
const retrievalModeIcon = $('#retrieval-mode-icon');
const conversationDeleteDialog = $('#conversation-delete-dialog');
const conversationDeleteMessage = $('#conversation-delete-message');
const conversationDeleteCancel = $('#conversation-delete-cancel');
const conversationDeleteConfirm = $('#conversation-delete-confirm');
let conversationPendingDeletion;

function updateRetrievalModeIcon() {
    const icon = retrievalMode.selectedOptions[0]?.dataset.icon;
    if (icon) retrievalModeIcon.src = icon;
    adjustmentsRetrievalMode.value = retrievalMode.value;
}

export function showToast(message) {
    toast.textContent = message;
    toast.classList.add('visible');
    window.clearTimeout(toastTimeout);
    toastTimeout = window.setTimeout(() => toast.classList.remove('visible'), 3200);
}

function syncSidebarState() {
    const leftHidden = sidebar.classList.contains('is-collapsed');
    const rightHidden = rightPanel.classList.contains('is-collapsed');
    appShell.classList.toggle('sidebar-collapsed', leftHidden);
    appShell.classList.toggle('right-panel-collapsed', rightHidden);
    sidebarResizeHandle.hidden = leftHidden;

    sidebarToggle.dataset.i18nAria = leftHidden ? 'sidebar-expand' : 'sidebar-collapse';
    sidebarToggle.dataset.i18nTitle = leftHidden ? 'sidebar-expand' : 'sidebar-collapse';
    rightPanelToggle.dataset.i18nAria = rightHidden ? 'right-panel-expand' : 'right-panel-collapse';
    rightPanelToggle.dataset.i18nTitle = rightHidden ? 'right-panel-expand' : 'right-panel-collapse';

    sidebarToggleIcon.src = leftHidden ? 'assets/icons/left_panel_open.svg' : 'assets/icons/left_panel_close.svg';
    sidebarToggleIcon.alt = leftHidden ? 'Show workspace sidebar' : 'Hide workspace sidebar';
    rightPanelToggleIcon.src = rightHidden ? 'assets/icons/right_panel_open.svg' : 'assets/icons/right_panel_close.svg';
    rightPanelToggleIcon.alt = rightHidden ? 'Show data explorer panel' : 'Hide data explorer panel';

    applyLanguage(getCurrentLanguage());
}

function createConversationEntry(name) {
    const entry = document.createElement('div');
    entry.className = 'conversation-entry';

    const selectButton = document.createElement('button');
    selectButton.type = 'button';
    selectButton.className = 'conversation-item';
    const icon = document.createElement('img');
    icon.className = 'chat-icon';
    icon.src = 'assets/icons/chat.svg';
    icon.alt = '';
    const title = document.createElement('span');
    title.textContent = name;
    selectButton.append(icon, title);

    const deleteButton = document.createElement('button');
    deleteButton.className = 'knowledge-delete conversation-delete';
    deleteButton.type = 'button';
    deleteButton.dataset.conversationAction = 'delete';
    deleteButton.setAttribute('aria-label', t('delete-conversation'));
    deleteButton.dataset.i18nAria = 'delete-conversation';
    deleteButton.title = t('delete-conversation');
    deleteButton.dataset.i18nTitle = 'delete-conversation';
    const deleteIcon = document.createElement('img');
    deleteIcon.src = 'assets/icons/delete.svg';
    deleteIcon.alt = '';
    deleteIcon.setAttribute('aria-hidden', 'true');
    deleteButton.append(deleteIcon);

    // const menuToggle = document.createElement('button');
    // menuToggle.type = 'button';
    // menuToggle.className = 'conversation-menu-toggle';
    // menuToggle.setAttribute('aria-label', 'Conversation options');
    // menuToggle.setAttribute('aria-haspopup', 'menu');
    // menuToggle.setAttribute('aria-expanded', 'false');
    // menuToggle.textContent = '···';

    const menu = document.createElement('div');
    menu.className = 'conversation-menu';
    menu.setAttribute('role', 'menu');
    menu.hidden = true;
    // for (const [action, label] of [['rename', 'Rename'], ['delete', 'Delete']]) {
    //     const button = document.createElement('button');
    //     button.type = 'button';
    //     button.setAttribute('role', 'menuitem');
    //     button.dataset.conversationAction = action;
    //     button.textContent = label;
    //     menu.append(button);
    // }

    entry.append(selectButton, deleteButton, menu);
    // entry.append(selectButton, menuToggle, menu);
    return entry;
}

// function closeConversationMenus() {
//     conversationList.querySelectorAll('.conversation-entry').forEach((entry) => {
//         entry.classList.remove('menu-open');
//         entry.querySelector('.conversation-menu').hidden = true;
//         entry.querySelector('.conversation-menu-toggle').setAttribute('aria-expanded', 'false');
//     });
// }

function activateConversation(entry) {
    conversationList.querySelectorAll('.conversation-entry').forEach((item) => {
        item.classList.toggle('active', item === entry);
    });
    workspaceTitle.textContent = entry.querySelector('.conversation-item span:last-child').textContent;
}

function updateConversationCount() {
    conversationCount.textContent = String(conversationList.querySelectorAll('.conversation-entry').length).padStart(2, '0');
}

function deleteConversation(entry) {
    if (!entry.isConnected) return;

    const entries = [...conversationList.querySelectorAll('.conversation-entry')];
    const wasActive = entry.classList.contains('active');
    const deletedIndex = entries.indexOf(entry);
    if (wasActive) cancelPendingResponse();
    entry.remove();
    updateConversationCount();

    if (wasActive) {
        const remainingEntries = conversationList.querySelectorAll('.conversation-entry');
        const nextEntry = remainingEntries[Math.min(deletedIndex, remainingEntries.length - 1)];
        if (nextEntry) {
            activateConversation(nextEntry);
        } else {
            workspaceTitle.textContent = 'No conversation selected';
            clearChat();
        }
    }
    showToast(t('conversation-deleted'));
}

const chat = initializeChat({
    onEmptyExport: () => showToast('There are no messages to export yet.')
});

const knowledgeBase = initializeKnowledgeBase({
    showToast,
    onIndexingState: chat.setKnowledgeIndexStatus
});
chat.setRetryKnowledgeIndex(knowledgeBase.retryIndexing);
initializeEntityGraph();

sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('is-collapsed');
    syncSidebarState();
});

rightPanelToggle.addEventListener('click', () => {
    rightPanel.classList.toggle('is-collapsed');
    syncSidebarState();
});

function getSidebarWidthBounds() {
    const compactLayout = window.matchMedia('(max-width: 800px)').matches;
    const narrowLayout = window.matchMedia('(max-width: 1050px)').matches;
    const minimumMainWidth = compactLayout ? 0 : narrowLayout ? 380 : 420;
    const rightPanelWidth = compactLayout
        ? 32
        : rightPanel.classList.contains('is-collapsed')
            ? 32
            : narrowLayout ? 260 : 306;
    const defaultWidth = compactLayout ? 190 : narrowLayout ? 205 : 232;
    const minimum = 160;
    const maximum = Math.max(defaultWidth, minimum, Math.min(420, appShell.clientWidth - minimumMainWidth - rightPanelWidth));
    return { minimum, maximum };
}

function setSidebarWidth(width, bounds = getSidebarWidthBounds()) {
    const { minimum, maximum } = bounds;
    const boundedWidth = Math.round(Math.min(maximum, Math.max(minimum, width)));
    appShell.style.setProperty('--sidebar-width', `${boundedWidth}px`);
    sidebarResizeHandle.setAttribute('aria-valuemin', String(minimum));
    sidebarResizeHandle.setAttribute('aria-valuemax', String(maximum));
    sidebarResizeHandle.setAttribute('aria-valuenow', String(boundedWidth));
}

let sidebarWidthAdjusted = false;

function updateSidebarResizeHandle() {
    const width = sidebar.getBoundingClientRect().width;
    const { minimum, maximum } = getSidebarWidthBounds();
    sidebarResizeHandle.setAttribute('aria-valuemin', String(minimum));
    sidebarResizeHandle.setAttribute('aria-valuemax', String(maximum));
    sidebarResizeHandle.setAttribute('aria-valuenow', String(Math.round(width)));
}

sidebarResizeHandle.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebar.getBoundingClientRect().width;
    const widthBounds = getSidebarWidthBounds();
    appShell.classList.add('is-resizing');
    sidebarResizeHandle.setPointerCapture(event.pointerId);

    const resize = (pointerEvent) => {
        if (pointerEvent.pointerId === event.pointerId) {
            sidebarWidthAdjusted = true;
            setSidebarWidth(startWidth + pointerEvent.clientX - startX, widthBounds);
        }
    };
    const stopResizing = (pointerEvent) => {
        if (pointerEvent.pointerId !== event.pointerId) return;
        sidebarResizeHandle.removeEventListener('pointermove', resize);
        sidebarResizeHandle.removeEventListener('pointerup', stopResizing);
        sidebarResizeHandle.removeEventListener('pointercancel', stopResizing);
        appShell.classList.remove('is-resizing');
    };

    sidebarResizeHandle.addEventListener('pointermove', resize);
    sidebarResizeHandle.addEventListener('pointerup', stopResizing);
    sidebarResizeHandle.addEventListener('pointercancel', stopResizing);
});

sidebarResizeHandle.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const currentWidth = sidebar.getBoundingClientRect().width;
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    sidebarWidthAdjusted = true;
    setSidebarWidth(currentWidth + direction * (event.shiftKey ? 30 : 10));
});

updateSidebarResizeHandle();
window.addEventListener('resize', () => {
    if (sidebarWidthAdjusted) setSidebarWidth(sidebar.getBoundingClientRect().width);
    updateSidebarResizeHandle();
});

syncSidebarState();
retrievalMode.addEventListener('change', updateRetrievalModeIcon);
adjustmentsRetrievalMode.addEventListener('change', () => {
    retrievalMode.value = adjustmentsRetrievalMode.value;
    retrievalMode.dispatchEvent(new Event('change'));
});
updateRetrievalModeIcon();

conversationDeleteCancel.addEventListener('click', () => conversationDeleteDialog.close());
conversationDeleteConfirm.addEventListener('click', () => {
    if (conversationPendingDeletion) deleteConversation(conversationPendingDeletion);
    conversationPendingDeletion = undefined;
    conversationDeleteDialog.close();
});
conversationDeleteDialog.addEventListener('close', () => {
    conversationPendingDeletion = undefined;
});

conversationList.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const target = event.target;
    const newConversationButton = target.closest('.new-conversation');

    if (newConversationButton) {
        clearChat();
        const conversation = createConversationEntry('New investigation');
        conversationList.append(conversation);
        activateConversation(conversation);
        // closeConversationMenus();
        updateConversationCount();
        showToast(t('new-conversation-toast'));
        return;
    }

    const entry = target.closest('.conversation-entry');
    if (!entry) return;

    const menuToggle = target.closest('.conversation-menu-toggle');
    if (menuToggle) {
        const menu = entry.querySelector('.conversation-menu');
        const shouldOpen = menu.hidden;
        // closeConversationMenus();
        menu.hidden = !shouldOpen;
        menuToggle.setAttribute('aria-expanded', String(shouldOpen));
        entry.classList.toggle('menu-open', shouldOpen);
        return;
    }

    const actionButton = target.closest('[data-conversation-action]');
    if (actionButton) {
        const action = actionButton.dataset.conversationAction;
        const title = entry.querySelector('.conversation-item span:last-child');
        // closeConversationMenus();

        if (action === 'rename') {
            const newName = window.prompt('Rename conversation:', title.textContent);
            if (newName === null) return;
            const trimmedName = newName.trim();
            if (!trimmedName) {
                showToast('Conversation name cannot be empty.');
                return;
            }
            title.textContent = trimmedName;
            if (entry.classList.contains('active')) workspaceTitle.textContent = trimmedName;
            showToast('Conversation renamed.');
        } else if (action === 'delete') {
            conversationPendingDeletion = entry;
            conversationDeleteMessage.textContent = t('delete-conversation-confirm')
                .replace('{name}', title.textContent);
            conversationDeleteDialog.showModal();
            conversationDeleteCancel.focus();
        }
        return;
    }

    // if (target.closest('.conversation-item')) {
    //     activateConversation(entry);
    //     closeConversationMenus();
    // }
});

// document.addEventListener('click', (event) => {
//     if (!(event.target instanceof Element) || !event.target.closest('.conversation-entry')) {
//         closeConversationMenus();
//     }
// });

document.addEventListener('keydown', (event) => {
    if (!(event.target instanceof Element)) return;
    const entry = event.target.closest('.conversation-entry');

    if (event.key === 'Escape') {
        const openEntry = conversationList.querySelector('.conversation-entry.menu-open');
        // closeConversationMenus();
        openEntry?.querySelector('.conversation-menu-toggle').focus();
        return;
    }

    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && entry?.classList.contains('menu-open')) {
        const menuItems = [...entry.querySelectorAll('[role="menuitem"]')];
        const currentIndex = menuItems.indexOf(event.target);
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        const nextIndex = (currentIndex + direction + menuItems.length) % menuItems.length;
        event.preventDefault();
        menuItems[nextIndex].focus();
    }
});

informationModal.addEventListener('click', () => {
    informationDialog.showModal();
    informationClose.focus();
});

informationClose.addEventListener('click', () => {
    informationDialog.close();
});

informationDialog.addEventListener('click', (event) => {
    if (event.target === informationDialog) informationDialog.close();
});

adjustmentsToggle.addEventListener('click', () => {
    adjustmentsDialog.showModal();
    adjustmentsRetrievalMode.focus();
});

adjustmentsClose.addEventListener('click', () => {
    adjustmentsDialog.close();
});

adjustmentsDialog.addEventListener('click', (event) => {
    if (event.target === adjustmentsDialog) adjustmentsDialog.close();
});