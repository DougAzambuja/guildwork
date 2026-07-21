// ==========================================
// 0. PROTEÇÃO E INICIALIZAÇÃO
// ==========================================
const token = localStorage.getItem('guild_token');

const truncate = (str, max) => str && str.length > max ? str.slice(0, max) + '…' : (str || '');

document.addEventListener('DOMContentLoaded', () => {
    if (!token || localStorage.getItem('guild_role') !== 'admin') {
        window.location.href = 'login.html';
        return;
    }

    const adminName = localStorage.getItem('guild_user') || 'Mestre da Guilda';
    const nameEl    = document.getElementById('playerName');
    if (nameEl) nameEl.innerText = adminName;

    setupQuestForm();
    initFilterBar();
    loadSprintsSelect();
    renderAdminQuests(1);
});

// ==========================================
// 1. FORJA DE QUESTS — SELECT DE SPRINTS
// ==========================================
const STATUS_SPRINT_LABELS = {
    planning:  'Planning',
    active:    '⚡ Ativa',
    completed: 'Concluída',
    cancelled: 'Cancelada'
};

async function loadSprintsSelect() {
    try {
        const res = await fetch(`${API_URL}/sprints`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;

        const sprints = await res.json();
        const active  = sprints.filter(s => s.status !== 'cancelled' && s.status !== 'completed');

        const forgeOpts = '<option value="">🗂️ Sem sprint (Backlog)</option>' +
            active.map(s => `<option value="${s._id}">[${STATUS_SPRINT_LABELS[s.status] || s.status}] ${s.name}</option>`).join('');

        const forgeSelect = document.getElementById('questSprint');
        if (forgeSelect) forgeSelect.innerHTML = forgeOpts;

        const filterSelect = document.getElementById('filterSprint');
        if (filterSelect) {
            filterSelect.innerHTML = '<option value="">Todas as Sprints</option>' +
                '<option value="backlog">🗂️ Backlog</option>' +
                sprints.map(s => `<option value="${s._id}">${s.name}</option>`).join('');
        }

        const sprintOpts = '<option value="">🗂️ Sem sprint (Backlog)</option>' +
            sprints.map(s => `<option value="${s._id}">${s.name}</option>`).join('');
        const editSprintSelect = document.getElementById('qdm-a-edit-sprint');
        if (editSprintSelect) editSprintSelect.innerHTML = sprintOpts;
    } catch (err) {
        console.error('Erro ao carregar sprints:', err);
    }
}

// ==========================================
// 2. FORJA DE QUESTS
// ==========================================
function setupQuestForm() {
    const questForm = document.getElementById('questForm');
    if (!questForm) return;

    questForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const sprintVal = document.getElementById('questSprint')?.value;
        const labelsRaw = document.getElementById('questLabels')?.value || '';
        const questData = {
            title:       document.getElementById('questTitle').value.trim(),
            type:        document.getElementById('questType').value,
            faction:     document.getElementById('questFaction').value,
            xp_reward:   parseInt(document.getElementById('questXp').value),
            coin_reward: parseInt(document.getElementById('questCoins').value),
            sla_seconds: document.getElementById('slaTime').value
                            ? parseInt(document.getElementById('slaTime').value)
                            : null,
            sprint_id:   sprintVal || null,
            labels:      labelsRaw.split(',').map(l => l.trim()).filter(Boolean)
        };

        try {
            const res = await fetch(`${API_URL}/quests`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(questData)
            });

            if (res.ok) {
                showToast('Quest forjada com sucesso!');
                questForm.reset();
                await renderAdminQuests(1);
            } else {
                const err = await res.json();
                showToast(`Erro: ${err.message}`, 'error');
            }
        } catch (err) {
            console.error('Erro ao forjar quest:', err);
            showToast('Erro de conexão com o servidor.', 'error');
        }
    });
}

// ==========================================
// 3. BARRA DE FILTROS
// ==========================================
let _searchDebounceTimer = null;

function initFilterBar() {
    const searchEl  = document.getElementById('filterSearch');
    const factionEl = document.getElementById('filterFaction');
    const statusEl  = document.getElementById('filterStatus');
    const sprintEl  = document.getElementById('filterSprint');
    const limitEl   = document.getElementById('filterLimit');

    if (searchEl) {
        searchEl.addEventListener('input', () => {
            clearTimeout(_searchDebounceTimer);
            _searchDebounceTimer = setTimeout(() => renderAdminQuests(1), 300);
        });
    }

    [factionEl, statusEl, sprintEl, limitEl].forEach(el => {
        if (el) el.addEventListener('change', () => renderAdminQuests(1));
    });
}

function buildQueryParams(page) {
    const params = new URLSearchParams();
    params.set('page',  String(page));
    params.set('limit', document.getElementById('filterLimit')?.value || '10');

    const search  = document.getElementById('filterSearch')?.value.trim();
    const faction = document.getElementById('filterFaction')?.value;
    const status  = document.getElementById('filterStatus')?.value;
    const sprint  = document.getElementById('filterSprint')?.value;

    if (search)  params.set('search',    search);
    if (faction) params.set('faction',   faction);
    if (status)  params.set('status',    status);
    if (sprint)  params.set('sprint_id', sprint);

    return params;
}

// ==========================================
// 4. TABELA DE QUESTS + PAGINAÇÃO SERVER-SIDE
// ==========================================
const STATUS_LABELS = {
    todo:        { label: 'A FAZER',    color: '#2980b9' },
    in_progress: { label: 'PROGRESSO', color: '#e67e22' },
    done:        { label: 'CONCLUÍDA', color: '#27ae60' }
};

const BADGE_STYLE = 'padding:3px 8px;font-size:8px;white-space:nowrap;display:inline-block;min-width:60px;text-align:center;';
const BTN_ICON    = 'width:28px;height:28px;padding:0;font-size:13px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;';

async function renderAdminQuests(page = 1) {
    try {
        const params   = buildQueryParams(page);
        const response = await fetch(`${API_URL}/quests/all?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const { quests, total, page: currentPage, limit } = await response.json();
            renderQuestPage(quests);
            renderPaginationControls(total, limit, currentPage);
        }
    } catch (err) {
        console.error('Erro ao buscar quests:', err);
    }
}

function formatAdminSla(seconds) {
    if (seconds >= 3600) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return m > 0 ? `${h}h${m}m` : `${h}h`;
    }
    if (seconds >= 60) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return s > 0 ? `${m}m${s}s` : `${m}m`;
    }
    return `${seconds}s`;
}

function renderQuestPage(quests) {
    const tableBody = document.getElementById('adminQuestsTableBody');
    if (!tableBody) return;

    if (!quests.length) {
        tableBody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:#7f8c8d;padding:20px;">Nenhuma quest encontrada.</td></tr>';
        return;
    }

    const FACTION_BADGE = { Produto: '📦', Suporte: '🎧', 'Customer Service': '📣' };

    tableBody.innerHTML = quests.map(q => {
        const st          = STATUS_LABELS[q.status] || STATUS_LABELS.todo;
        const assigneeRaw = q.assigned_to ? (q.assigned_to.nome || q.assigned_to.username) : '';
        const assignee    = assigneeRaw
            ? `<span title="${assigneeRaw}" style="white-space:nowrap;">${truncate(assigneeRaw, 11)}</span>`
            : '<span style="color:#4a5568;">—</span>';
        const factionIcon = FACTION_BADGE[q.faction] || '🏰';
        const canReset    = q.status === 'in_progress';
        const detailBtn   = `<button class="btn-pixel" style="${BTN_ICON}background:#2980b9;" title="Ver detalhes" data-cy="btn-quest-detail" onclick="openQuestDetail('${q._id}')">👁</button>`;
        const editBtn     = `<button class="btn-pixel" style="${BTN_ICON}background:#8e44ad;" title="Editar quest" data-cy="btn-edit-quest" onclick="openQuestDetail('${q._id}', true)">✏️</button>`;
        const resetBtn    = `<button class="btn-pixel" style="${BTN_ICON}background:#e67e22;${!canReset ? 'opacity:.35;cursor:not-allowed;' : ''}" title="Resetar quest" data-cy="btn-reset-quest" onclick="resetQuest('${q._id}')" ${!canReset ? 'disabled' : ''}>↺</button>`;
        const deleteBtn   = `<button class="btn-pixel btn-delete" style="${BTN_ICON}" title="Excluir quest" data-cy="btn-delete-quest" onclick="deleteQuest('${q._id}', '${_aEsc(q.title).replace(/'/g, "\\'")}')">🗑</button>`;

        let slaDisplay = '—';
        if (q.sla_seconds && q.status === 'in_progress' && q.started_at) {
            const elapsed   = (Date.now() - new Date(q.started_at).getTime()) / 1000;
            const remaining = Math.max(0, q.sla_seconds - Math.floor(elapsed));
            const pct       = remaining / q.sla_seconds;
            const color     = pct <= 0 ? '#e74c3c' : pct <= 0.25 ? '#e67e22' : '#27ae60';
            const label     = remaining <= 0 ? '🚨 ESTOURADO' : formatAdminSla(remaining);
            slaDisplay = `<span style="color:${color}; font-size:9px;">${label}</span>`;
        } else if (q.sla_seconds) {
            slaDisplay = `<span style="color:#7f8c8d; font-size:9px;">${formatAdminSla(q.sla_seconds)}</span>`;
        }

        const sprintInfo = q.sprint_id
            ? `<a href="admin-sprint-board.html?id=${q.sprint_id._id}" style="color:#3498db;font-size:8px;text-decoration:none;white-space:nowrap;" title="${q.sprint_id.name}">🏃 ${q.sprint_id.name}</a>`
            : '<span style="color:#4a5568;font-size:8px;white-space:nowrap;">—</span>';

        const labelBadges = (q.labels || []).length
            ? ' ' + q.labels.map(l => `<span style="background:#2c3e50;color:#bdc3c7;font-size:7px;padding:1px 5px;border-radius:2px;">${l}</span>`).join(' ')
            : '';

        const isSubtask = !!q.parent_id;
        const subtaskPrefix = isSubtask
            ? '<span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;flex-shrink:0;margin-right:5px;background:#3d1a52;border:2px solid #8e44ad;border-radius:2px;color:#f0e6f6;font-size:9px;font-weight:900;font-family:\'Courier New\',monospace;line-height:1;text-shadow:0 1px 3px rgba(0,0,0,0.9);">L</span>'
            : '';
        const trStyle = isSubtask ? 'background:rgba(142,68,173,0.10);' : '';

        return `
            <tr style="${trStyle}">
                <td style="max-width:160px;overflow:hidden;">
                    <div style="display:flex;align-items:center;overflow:hidden;">
                        ${subtaskPrefix}
                        <span title="${q.title}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;">${q.title}</span>
                    </div>
                    ${labelBadges}
                </td>
                <td>${q.type || 'normal'}</td>
                <td style="font-size:9px;white-space:nowrap;">${factionIcon} ${q.faction || 'Produto'}</td>
                <td>${sprintInfo}</td>
                <td>${q.xp_reward}</td>
                <td>${q.coin_reward}</td>
                <td>${slaDisplay}</td>
                <td><span class="status-badge" style="background:${st.color};${BADGE_STYLE}">${st.label}</span></td>
                <td>${assignee}</td>
                <td><div style="display:flex;gap:3px;align-items:center;">${detailBtn}${editBtn}${resetBtn}${deleteBtn}</div></td>
            </tr>
        `;
    }).join('');
}

function renderPaginationControls(total, limit, page) {
    const row = document.getElementById('questPaginationRow');
    if (!row) return;

    const totalPages = Math.ceil(total / limit);

    if (totalPages <= 1) {
        row.style.display = 'none';
        return;
    }

    const start = (page - 1) * limit + 1;
    const end   = Math.min(start + limit - 1, total);

    row.style.display = 'flex';

    const prevBtn   = document.getElementById('btnQuestPrev');
    const nextBtn   = document.getElementById('btnQuestNext');
    const pageInfo  = document.getElementById('paginationPageInfo');
    const countInfo = document.getElementById('paginationCountInfo');

    if (prevBtn) {
        prevBtn.disabled = page <= 1;
        prevBtn.onclick  = () => goQuestPage(page - 1);
    }
    if (nextBtn) {
        nextBtn.disabled = page >= totalPages;
        nextBtn.onclick  = () => goQuestPage(page + 1);
    }
    if (pageInfo)  pageInfo.textContent  = `Página ${page} de ${totalPages}`;
    if (countInfo) countInfo.textContent = `${start}–${end} de ${total}`;
}

window.goQuestPage = (page) => renderAdminQuests(page);

// ==========================================
// 5. MODAL DE DETALHE DA QUEST (ADMIN)
// ==========================================
const _A_STATUS = {
    todo:        { label: 'A FAZER',    color: '#2980b9' },
    in_progress: { label: 'PROGRESSO', color: '#e67e22' },
    done:        { label: 'CONCLUÍDA', color: '#27ae60' }
};
const _A_FACTION_ICON = { Produto: '📦', Suporte: '🎧', 'Customer Service': '📣' };

let _adminDetailQuestId = null;
let _adminEditingChecklistItemId = null;
let _adminLastQuest = null;
let _adminEditMode = false;
let _adminChecklistDraft = null;

function _aEsc(str) {
    return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _aTimeAgo(iso) {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}d atrás`;
    if (h > 0) return `${h}h atrás`;
    if (m > 0) return `${m}min atrás`;
    return 'agora';
}

window.openQuestDetail = async (questId, startInEditMode) => {
    _adminDetailQuestId = questId;
    _adminEditingChecklistItemId = null;
    _adminEditMode = false;
    _adminChecklistDraft = null;
    const modal = document.getElementById('questAdminDetailModal');
    if (!modal) return;

    modal.style.display = 'flex';
    const commentsEl = document.getElementById('qdm-a-comments');
    if (commentsEl) commentsEl.innerHTML = '<div style="color:#7f8c8d;font-size:9px;text-align:center;padding:10px;">Carregando...</div>';

    try {
        const res = await fetch(`${API_URL}/quests/${questId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        renderAdminQuestDetail(await res.json());
        if (startInEditMode) window.adminToggleEditMode(true);
    } catch (err) {
        console.error('Erro ao carregar detalhe:', err);
    }
};

let _adminPendingDiscard = null;

function _adminHasSubtaskFormContent() {
    const form = document.getElementById('qdm-a-subtask-form');
    if (!form || form.style.display === 'none') return false;
    return !!(document.getElementById('qdm-a-subtask-title-input')?.value.trim());
}

function _adminNeedsUnsavedWarning() {
    return _adminEditMode && (_adminHasUnsavedEdits() || _adminHasSubtaskFormContent());
}

function _forceCloseQuestDetail() {
    const modal = document.getElementById('questAdminDetailModal');
    if (modal) modal.style.display = 'none';
    _adminDetailQuestId = null;
    _adminEditingChecklistItemId = null;
    _adminEditMode = false;
    _adminChecklistDraft = null;
    _adminLastQuest = null;
}

window.closeQuestDetail = () => {
    if (_adminNeedsUnsavedWarning()) {
        _adminPendingDiscard = 'close';
        document.getElementById('adminUnsavedModal').style.display = 'flex';
        return;
    }
    _forceCloseQuestDetail();
};

window.adminCancelDiscard = () => {
    document.getElementById('adminUnsavedModal').style.display = 'none';
    _adminPendingDiscard = null;
};

window.adminConfirmDiscard = () => {
    document.getElementById('adminUnsavedModal').style.display = 'none';
    if (_adminPendingDiscard === 'close') _forceCloseQuestDetail();
    else if (_adminPendingDiscard === 'cancel') window.adminToggleEditMode(false);
    _adminPendingDiscard = null;
};

function renderAdminQuestDetail(quest) {
    _adminLastQuest = quest;
    const editing = _adminEditMode;

    const typeBadge = document.getElementById('qdm-a-type-badge');
    if (typeBadge) typeBadge.innerHTML = `<span class="kanban-type-badge badge-${quest.type || 'normal'}" style="font-size:9px;">${(quest.type || 'NORMAL').toUpperCase()}</span>`;

    const parentBreadcrumb = document.getElementById('qdm-a-parent-breadcrumb');
    if (parentBreadcrumb) {
        if (quest.parent_id) {
            parentBreadcrumb.style.display = 'block';
            parentBreadcrumb.innerHTML = `<span style="font-size:8px;color:#9b59b6;">↩ Quest pai: <button onclick="openQuestDetail('${quest.parent_id._id}')" style="background:none;border:none;color:#3498db;font-family:'Press Start 2P',cursive;font-size:8px;cursor:pointer;padding:0;text-decoration:underline;">${_aEsc(quest.parent_id.title)}</button></span>`;
        } else {
            parentBreadcrumb.style.display = 'none';
            parentBreadcrumb.innerHTML = '';
        }
    }

    const titleEl = document.getElementById('qdm-a-title');
    if (titleEl) { titleEl.textContent = quest.title; titleEl.style.display = editing ? 'none' : ''; }

    const factionEl = document.getElementById('qdm-a-faction');
    if (factionEl) factionEl.textContent = `${_A_FACTION_ICON[quest.faction] || '🏰'} ${quest.faction || 'Produto'}`;

    const st = _A_STATUS[quest.status] || _A_STATUS.todo;
    const statusEl = document.getElementById('qdm-a-status');
    if (statusEl) statusEl.innerHTML = `<span class="status-badge" style="background:${st.color};padding:3px 8px;font-size:8px;">${st.label}</span>`;

    const assigneeEl = document.getElementById('qdm-a-assignee');
    if (assigneeEl) assigneeEl.textContent = quest.assigned_to
        ? _aEsc(quest.assigned_to.nome || quest.assigned_to.username)
        : '—';

    const slaEl = document.getElementById('qdm-a-sla');
    if (slaEl) slaEl.textContent = quest.sla_seconds ? formatAdminSla(quest.sla_seconds) : '—';

    // Alterna entre visão de leitura e formulário de edição unificado (título, tipo,
    // XP/Gold, SLA, guilda, sprint, labels) — igual ao padrão do líder de guilda.
    const controls   = document.getElementById('qdm-a-controls');
    const editForm    = document.getElementById('qdm-a-edit-form');
    const infoGrid    = document.getElementById('qdm-a-info-grid');
    const activitySec = document.getElementById('qdm-a-activity-section');
    const editActions = document.getElementById('qdm-a-edit-actions');
    if (controls)   controls.style.display   = editing ? 'none' : 'flex';
    if (editForm)   editForm.style.display   = editing ? 'block' : 'none';
    if (infoGrid)   infoGrid.style.display   = editing ? 'none' : 'grid';
    if (activitySec) activitySec.style.display = (editing || quest.parent_id) ? 'none' : 'block';
    if (editActions) editActions.style.display = editing ? 'flex' : 'none';

    // Checklist — modo de edição igual ao do líder de guilda: EDITAR mostra
    // remover/adicionar/renomear num rascunho local, só persiste no SALVAR.
    const checklistSection = document.getElementById('qdm-a-checklist');
    const items = editing ? (_adminChecklistDraft || []) : (quest.checklist || []);
    if (checklistSection) {
        checklistSection.style.display = 'block';

        const addRow = document.getElementById('qdm-a-checklist-add-row');
        if (addRow) addRow.style.display = editing ? 'flex' : 'none';

        const progressEl = document.getElementById('qdm-a-checklist-progress');
        if (progressEl) {
            if (items.length) {
                const done = items.filter(i => i.done).length;
                const pct  = Math.round((done / items.length) * 100);
                progressEl.innerHTML = `
                    <div style="display:flex;justify-content:space-between;font-size:8px;color:#7f8c8d;margin-bottom:4px;">
                        <span>${done}/${items.length} itens</span><span>${pct}%</span>
                    </div>
                    <div style="background:#0d1b2a;height:6px;border-radius:2px;overflow:hidden;">
                        <div style="height:100%;background:#27ae60;width:${pct}%;"></div>
                    </div>`;
            } else {
                progressEl.innerHTML = '';
            }
        }

        const itemsEl = document.getElementById('qdm-a-checklist-items');
        if (itemsEl) itemsEl.innerHTML = items.map(item => {
            const isEditingThis = editing && item._id === _adminEditingChecklistItemId;
            const textCell = isEditingThis
                ? `<input type="text" class="pixel-input" data-cy="input-admin-checklist-item-text"
                       data-item-id="${item._id}" data-original="${_aEsc(item.text)}"
                       value="${_aEsc(item.text)}"
                       style="flex:1;font-size:9px;padding:5px 6px;color:#1a1a1a;"
                       onblur="adminSaveChecklistItemText(this)"
                       onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}">`
                : `<span ${editing ? `data-cy="text-admin-checklist-item" onclick="adminStartEditChecklistItemText('${item._id}')" style="cursor:pointer;` : `style="`}flex:1;font-size:9px;color:${item.done ? '#7f8c8d' : '#ecf0f1'};text-decoration:${item.done ? 'line-through' : 'none'};">${_aEsc(item.text)}</span>`;

            const toggleAllowed = !item._isNew;

            return `
            <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #1a252f;">
                <input type="checkbox" ${item.done ? 'checked' : ''} ${!toggleAllowed ? 'disabled' : ''}
                       data-cy="checkbox-admin-checklist-item"
                       onchange="adminToggleChecklistItem('${quest._id}','${item._id}',this)"
                       style="cursor:${toggleAllowed ? 'pointer' : 'default'};accent-color:#27ae60;flex-shrink:0;">
                ${textCell}
                ${editing ? `<button type="button" data-cy="btn-admin-remove-checklist-item" onclick="adminRemoveChecklistItem('${item._id}')" style="background:#c0392b;border:none;color:#fff;font-size:13px;padding:8px 14px;cursor:pointer;flex-shrink:0;">Remover</button>` : ''}
            </div>`;
        }).join('');
    }

    renderAdminSubtasks(quest);
    renderAdminComments(quest.comments || []);
}

function renderAdminComments(comments) {
    const listEl = document.getElementById('qdm-a-comments');
    if (!listEl) return;

    const sorted = [...comments].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    if (!sorted.length) {
        listEl.innerHTML = '<div style="color:#7f8c8d;font-size:9px;text-align:center;padding:8px;">Sem atividade ainda.</div>';
        return;
    }

    listEl.innerHTML = sorted.map(c => {
        const isActivity = c.type === 'activity';
        const author     = c.user_id ? _aEsc(c.user_id.nome || c.user_id.username) : 'Sistema';
        const ago        = _aTimeAgo(c.created_at);

        if (isActivity) {
            return `<div style="display:flex;align-items:center;gap:6px;padding:4px 0;color:#7f8c8d;font-size:8px;">
                <span style="color:#2980b9;flex-shrink:0;">●</span>
                <span>${_aEsc(c.text)}</span>
                <span style="margin-left:auto;white-space:nowrap;font-size:7px;">${ago}</span>
            </div>`;
        }

        return `<div style="padding:6px 0;border-bottom:1px solid #1a252f;">
            <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                <span style="font-size:8px;color:#f1c40f;font-weight:bold;">${author}</span>
                <span style="font-size:7px;color:#7f8c8d;">${ago}</span>
            </div>
            <div style="font-size:9px;color:#ecf0f1;">${_aEsc(c.text)}</div>
        </div>`;
    }).join('');

    listEl.scrollTop = listEl.scrollHeight;
}

window.adminToggleChecklistItem = async (questId, itemId, checkbox) => {
    try {
        const res = await fetch(`${API_URL}/quests/${questId}/checklist/${itemId}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            checkbox.checked = !checkbox.checked;
            showToast('Erro ao atualizar item.', 'error');
            return;
        }
        const detailRes = await fetch(`${API_URL}/quests/${questId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (detailRes.ok) {
            const fresh = await detailRes.json();
            // "Concluído" é operacional, não faz parte do rascunho — mas sincroniza
            // o rascunho pra não mostrar um "done" antigo se estiver em edição.
            if (_adminChecklistDraft) {
                const draftItem = _adminChecklistDraft.find(i => i._id === itemId);
                const freshItem = (fresh.checklist || []).find(i => i._id === itemId);
                if (draftItem && freshItem) draftItem.done = freshItem.done;
            }
            renderAdminQuestDetail(fresh);
        }
    } catch (err) {
        checkbox.checked = !checkbox.checked;
        console.error(err);
    }
};

// — Edição unificada (admin): título, tipo, XP/Gold, SLA, guilda, sprint, labels e
// checklist, tudo no mesmo EDITAR/SALVAR/CANCELAR — igual ao padrão do líder de guilda.
// Checklist fica em rascunho local (_adminChecklistDraft); nada vai pro backend até SALVAR.
window.adminToggleEditMode = (on) => {
    _adminEditMode = on;
    _adminEditingChecklistItemId = null;
    const quest = _adminLastQuest;
    if (!quest) return;

    if (on) {
        document.getElementById('qdm-a-edit-title').value    = quest.title;
        document.getElementById('qdm-a-edit-type').value     = quest.type || 'normal';
        document.getElementById('qdm-a-edit-xp').value       = quest.xp_reward;
        document.getElementById('qdm-a-edit-coins').value    = quest.coin_reward;
        document.getElementById('qdm-a-edit-sla').value      = quest.sla_seconds || '';
        document.getElementById('qdm-a-edit-faction').value  = quest.faction || 'Produto';
        document.getElementById('qdm-a-edit-labels').value   = (quest.labels || []).join(', ');
        const sprintId = quest.sprint_id ? (quest.sprint_id._id || quest.sprint_id) : '';
        document.getElementById('qdm-a-edit-sprint').value   = sprintId;

        _adminChecklistDraft = (quest.checklist || []).map(i => ({ _id: i._id, text: i.text, done: i.done }));
    } else {
        _adminChecklistDraft = null;
        const subtaskForm = document.getElementById('qdm-a-subtask-form');
        if (subtaskForm) subtaskForm.style.display = 'none';
        const titleInput = document.getElementById('qdm-a-subtask-title-input');
        if (titleInput) titleInput.value = '';
        const xpEl   = document.getElementById('qdm-a-subtask-xp-input');
        const goldEl = document.getElementById('qdm-a-subtask-gold-input');
        if (xpEl)   xpEl.value = '0';
        if (goldEl) goldEl.value = '0';
    }

    renderAdminQuestDetail(quest);
};

function _adminFieldsAreDirty() {
    const quest = _adminLastQuest;
    if (!quest) return false;

    const titleVal = document.getElementById('qdm-a-edit-title').value.trim();
    const typeVal  = document.getElementById('qdm-a-edit-type').value;
    const xpVal    = parseInt(document.getElementById('qdm-a-edit-xp').value);
    const coinsVal = parseInt(document.getElementById('qdm-a-edit-coins').value);
    const slaRaw   = document.getElementById('qdm-a-edit-sla').value;
    const slaVal   = slaRaw ? parseInt(slaRaw) : null;
    const factionVal = document.getElementById('qdm-a-edit-faction').value;
    const sprintVal  = document.getElementById('qdm-a-edit-sprint').value || null;
    const labelsVal  = document.getElementById('qdm-a-edit-labels').value.trim();

    const questSprintId = quest.sprint_id ? (quest.sprint_id._id || quest.sprint_id) : null;
    const questLabels   = (quest.labels || []).join(', ');

    return titleVal   !== (quest.title || '') ||
           typeVal     !== (quest.type || 'normal') ||
           xpVal       !== quest.xp_reward ||
           coinsVal    !== quest.coin_reward ||
           slaVal      !== (quest.sla_seconds || null) ||
           factionVal  !== (quest.faction || 'Produto') ||
           sprintVal   !== questSprintId ||
           labelsVal   !== questLabels;
}

function _adminChecklistDraftIsDirty() {
    if (!_adminChecklistDraft) return false;
    const original = _adminLastQuest?.checklist || [];
    if (original.length !== _adminChecklistDraft.length) return true;

    return _adminChecklistDraft.some(draftItem => {
        if (draftItem._isNew) return true;
        const orig = original.find(o => o._id === draftItem._id);
        return !orig || orig.text !== draftItem.text;
    });
}

function _adminHasUnsavedEdits() {
    return _adminFieldsAreDirty() || _adminChecklistDraftIsDirty();
}

window.adminCancelEdit = () => {
    if (_adminHasUnsavedEdits() || _adminHasSubtaskFormContent()) {
        _adminPendingDiscard = 'cancel';
        document.getElementById('adminUnsavedModal').style.display = 'flex';
        return;
    }
    window.adminToggleEditMode(false);
};

window.adminSaveEdit = async () => {
    if (!_adminDetailQuestId) return;

    const title = document.getElementById('qdm-a-edit-title').value.trim();
    if (!title) { showToast('Título não pode ficar vazio.', 'error'); return; }

    const slaVal = document.getElementById('qdm-a-edit-sla').value;
    const labelsRaw = document.getElementById('qdm-a-edit-labels').value || '';
    const payload = {
        title,
        type:        document.getElementById('qdm-a-edit-type').value,
        faction:     document.getElementById('qdm-a-edit-faction').value,
        xp_reward:   parseInt(document.getElementById('qdm-a-edit-xp').value),
        coin_reward: parseInt(document.getElementById('qdm-a-edit-coins').value),
        sla_seconds: slaVal ? parseInt(slaVal) : null,
        sprint_id:   document.getElementById('qdm-a-edit-sprint').value || null,
        labels:      labelsRaw.split(',').map(l => l.trim()).filter(Boolean)
    };

    try {
        const res = await fetch(`${API_URL}/quests/${_adminDetailQuestId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.message || 'Erro ao atualizar missão.', 'error'); return; }

        const checklistOk = await _adminCommitChecklistDraft();
        showToast(checklistOk ? 'Missão atualizada!' : 'Missão atualizada, mas houve erro ao salvar o checklist.', checklistOk ? 'success' : 'error');

        window.adminToggleEditMode(false);

        // Re-fetch completo para garantir parent_id populado e dados atualizados
        const freshRes = await fetch(`${API_URL}/quests/${_adminDetailQuestId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (freshRes.ok) {
            _adminLastQuest = await freshRes.json();
            renderAdminQuestDetail(_adminLastQuest);
        }

        await renderAdminQuests(1);
    } catch (err) {
        console.error(err);
        showToast('Erro de conexão.', 'error');
    }
};

async function _adminCommitChecklistDraft() {
    if (!_adminChecklistDraft || !_adminDetailQuestId) return true;

    const original = _adminLastQuest?.checklist || [];
    const add    = _adminChecklistDraft.filter(i => i._isNew).map(i => i.text);
    const remove = original.filter(o => !_adminChecklistDraft.some(d => d._id === o._id)).map(o => o._id);
    const update = _adminChecklistDraft
        .filter(d => !d._isNew)
        .filter(d => {
            const orig = original.find(o => o._id === d._id);
            return orig && orig.text !== d.text;
        })
        .map(d => ({ id: d._id, text: d.text }));

    if (!add.length && !remove.length && !update.length) return true;

    try {
        const res = await fetch(`${API_URL}/quests/${_adminDetailQuestId}/checklist`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ add, remove, update })
        });
        const data = await res.json();
        if (!res.ok) return false;

        if (_adminLastQuest) _adminLastQuest.checklist = data.checklist;
        return true;
    } catch (err) {
        console.error(err);
        return false;
    }
}

window.adminAddChecklistItem = () => {
    const input = document.getElementById('qdm-a-checklist-add-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    if (!_adminChecklistDraft) _adminChecklistDraft = [];
    _adminChecklistDraft.push({
        _id: `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        text, done: false, _isNew: true
    });

    if (_adminLastQuest) renderAdminQuestDetail(_adminLastQuest);

    const freshInput = document.getElementById('qdm-a-checklist-add-input');
    if (freshInput) freshInput.focus();
};

window.adminRemoveChecklistItem = (itemId) => {
    if (!_adminChecklistDraft) return;
    _adminChecklistDraft = _adminChecklistDraft.filter(i => i._id !== itemId);
    if (_adminLastQuest) renderAdminQuestDetail(_adminLastQuest);
};

window.adminStartEditChecklistItemText = (itemId) => {
    _adminEditingChecklistItemId = itemId;
    if (_adminLastQuest) renderAdminQuestDetail(_adminLastQuest);

    const input = document.querySelector(`#qdm-a-checklist-items input[data-item-id="${itemId}"]`);
    if (input) { input.focus(); input.select(); }
};

window.adminSaveChecklistItemText = (inputEl) => {
    const itemId  = inputEl.dataset.itemId;
    const newText = inputEl.value.trim();

    _adminEditingChecklistItemId = null;

    if (newText && _adminChecklistDraft) {
        const draftItem = _adminChecklistDraft.find(i => i._id === itemId);
        if (draftItem) draftItem.text = newText;
    }

    if (_adminLastQuest) renderAdminQuestDetail(_adminLastQuest);
};

window.submitAdminComment = async () => {
    if (!_adminDetailQuestId) return;
    const input = document.getElementById('qdm-a-comment-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    try {
        const res = await fetch(`${API_URL}/quests/${_adminDetailQuestId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ text })
        });
        if (res.ok) {
            input.value = '';
            const detailRes = await fetch(`${API_URL}/quests/${_adminDetailQuestId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (detailRes.ok) {
                const full = await detailRes.json();
                renderAdminComments(full.comments || []);
            }
        } else {
            showToast('Erro ao enviar comentário.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Erro de conexão.', 'error');
    }
};

// ==========================================
// 7. EDIÇÃO DA QUEST — unificada dentro do modal de detalhes (ver adminToggleEditMode)
// ==========================================

let _pendingDeleteQuestId = null;

window.deleteQuest = (questId, questTitle) => {
    _pendingDeleteQuestId = questId;

    const msgEl = document.getElementById('deleteConfirmMessage');
    if (msgEl) msgEl.textContent = questTitle
        ? `Excluir "${questTitle}" permanentemente? Esta ação não pode ser desfeita.`
        : 'Excluir esta quest permanentemente? Esta ação não pode ser desfeita.';

    document.getElementById('deleteConfirmModal').style.display = 'flex';
};

window.closeDeleteConfirmModal = () => {
    document.getElementById('deleteConfirmModal').style.display = 'none';
    _pendingDeleteQuestId = null;
};

window.confirmDeleteQuest = async () => {
    const questId = _pendingDeleteQuestId;
    document.getElementById('deleteConfirmModal').style.display = 'none';
    if (!questId) return;

    try {
        const res = await fetch(`${API_URL}/quests/${questId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            showToast('Quest excluída.');
            await renderAdminQuests(1);
        } else {
            const err = await res.json();
            showToast(err.message || 'Erro ao excluir quest.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Erro de conexão com o servidor.', 'error');
    } finally {
        _pendingDeleteQuestId = null;
    }
};

window.resetQuest = async (questId) => {
    if (!confirm('Resetar esta quest para "A Fazer" e desatribuir o aventureiro?')) return;

    try {
        const res = await fetch(`${API_URL}/quests/${questId}/assign`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ userId: null })
        });

        if (res.ok) {
            showToast('Quest resetada com sucesso.');
            await renderAdminQuests(1);
        } else {
            const err = await res.json();
            showToast(err.message || 'Erro ao resetar quest.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Erro de conexão com o servidor.', 'error');
    }
};

// ==========================================
// SUBTASKS — admin-quests modal
// ==========================================
const _A_STATUS_SUBTASK = {
    todo:        { label: 'A Fazer',      color: '#2c3e50' },
    in_progress: { label: 'Em Progresso', color: '#e67e22' },
    done:        { label: 'Concluída',    color: '#27ae60' }
};

function renderAdminSubtasks(quest) {
    const section = document.getElementById('qdm-a-subtasks');
    if (!section) return;

    if (quest.parent_id) {
        section.style.display = 'none';
        return;
    }
    section.style.display = 'block';

    const addBtn = document.getElementById('qdm-a-subtask-add-btn');
    if (addBtn) addBtn.style.display = '';

    const progEl = document.getElementById('qdm-a-subtasks-progress');
    const listEl = document.getElementById('qdm-a-subtask-list');
    if (!progEl || !listEl) return;

    const subtasks = quest.subtasks || [];
    const total    = subtasks.length;
    const done     = subtasks.filter(s => s.status === 'done').length;
    const pct      = total > 0 ? Math.round((done / total) * 100) : 0;

    progEl.innerHTML = total > 0 ? `
        <div style="display:flex;justify-content:space-between;font-size:8px;color:#7f8c8d;margin-bottom:4px;">
            <span>${done} de ${total} concluídas</span><span>${pct}%</span>
        </div>
        <div style="background:#1a252f;height:4px;border-radius:2px;overflow:hidden;">
            <div style="width:${pct}%;height:100%;background:${pct===100?'#27ae60':'#3498db'};"></div>
        </div>` : '<div style="font-size:8px;color:#7f8c8d;">Nenhuma subtask ainda.</div>';

    listEl.innerHTML = subtasks.map(s => {
        const st       = _A_STATUS_SUBTASK[s.status] || _A_STATUS_SUBTASK.todo;
        const assignee = s.assigned_to ? (s.assigned_to.nome || s.assigned_to.username) : 'Nenhum herói responsável';
        return `
        <div onclick="openQuestDetail('${s._id}')" data-cy="btn-open-subtask"
             style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#0d1b2a;border:1px solid #2c3e50;margin-bottom:4px;cursor:pointer;"
             onmouseover="this.style.background='#162538';this.style.borderColor='#3498db';"
             onmouseout="this.style.background='#0d1b2a';this.style.borderColor='#2c3e50';">
            <span style="background:${st.color};font-size:7px;padding:2px 6px;color:#fff;white-space:nowrap;flex-shrink:0;">${st.label}</span>
            <span style="flex:1;font-size:8px;color:#ecf0f1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_aEsc(s.title)}</span>
            <span style="font-size:7px;color:#7f8c8d;white-space:nowrap;flex-shrink:0;">👤 ${_aEsc(assignee)}</span>
        </div>`;
    }).join('');
}

window.adminToggleSubtaskForm = async () => {
    const form = document.getElementById('qdm-a-subtask-form');
    if (!form) return;
    const opening = form.style.display === 'none';
    form.style.display = opening ? 'flex' : 'none';
    if (!opening) return;

    const sel = document.getElementById('qdm-a-subtask-assignee-select');
    if (!sel || sel.options.length > 1) return;
    try {
        const res = await fetch(`${API_URL}/admin/roster`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) return;
        const players = await res.json();
        sel.innerHTML = '<option value="">👤 Sem atribuição</option>' +
            players.map(p => `<option value="${p._id}">${p.nome || p.username}</option>`).join('');
    } catch {}
};

window.adminCreateSubtask = async () => {
    const title      = document.getElementById('qdm-a-subtask-title-input')?.value.trim();
    const assignee   = document.getElementById('qdm-a-subtask-assignee-select')?.value;
    const xp_reward  = parseInt(document.getElementById('qdm-a-subtask-xp-input')?.value || '0', 10) || 0;
    const coin_reward = parseInt(document.getElementById('qdm-a-subtask-gold-input')?.value || '0', 10) || 0;
    if (!title) { showToast('Informe o título da subtask.', 'error'); return; }

    try {
        const res = await fetch(`${API_URL}/quests/${_adminDetailQuestId}/subtasks`, {
            method:  'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body:    JSON.stringify({ title, assigned_to: assignee || null, xp_reward, coin_reward })
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.message || 'Erro ao criar subtask.', 'error'); return; }

        document.getElementById('qdm-a-subtask-title-input').value = '';
        const xpEl   = document.getElementById('qdm-a-subtask-xp-input');
        const goldEl = document.getElementById('qdm-a-subtask-gold-input');
        if (xpEl)   xpEl.value   = '0';
        if (goldEl) goldEl.value = '0';
        document.getElementById('qdm-a-subtask-form').style.display = 'none';
        showToast('Subtask criada!', 'success');

        // Atualiza o painel sem fechar o modal
        const freshRes = await fetch(`${API_URL}/quests/${_adminDetailQuestId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (freshRes.ok) renderAdminSubtasks(await freshRes.json());
    } catch (err) {
        showToast('Erro de conexão.', 'error');
    }
};
