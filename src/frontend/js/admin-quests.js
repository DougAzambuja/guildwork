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
        const editSprintSelect = document.getElementById('editQuestSprint');
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
        const editBtn     = `<button class="btn-pixel" style="${BTN_ICON}background:#8e44ad;" title="Editar quest" data-cy="btn-edit-quest" onclick="openEditQuest('${q._id}')">✏️</button>`;
        const resetBtn    = `<button class="btn-pixel" style="${BTN_ICON}background:#e67e22;${!canReset ? 'opacity:.35;cursor:not-allowed;' : ''}" title="Resetar quest" data-cy="btn-reset-quest" onclick="resetQuest('${q._id}')" ${!canReset ? 'disabled' : ''}>↺</button>`;
        const deleteBtn   = `<button class="btn-pixel btn-delete" style="${BTN_ICON}" title="Excluir quest" data-cy="btn-delete-quest" onclick="deleteQuest('${q._id}')">🗑</button>`;

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

        return `
            <tr>
                <td style="max-width:160px;">
                    <span title="${q.title}" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${q.title}</span>
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

window.openQuestDetail = async (questId) => {
    _adminDetailQuestId = questId;
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
    } catch (err) {
        console.error('Erro ao carregar detalhe:', err);
    }
};

window.closeQuestDetail = () => {
    const modal = document.getElementById('questAdminDetailModal');
    if (modal) modal.style.display = 'none';
    _adminDetailQuestId = null;
};

function renderAdminQuestDetail(quest) {
    const typeBadge = document.getElementById('qdm-a-type-badge');
    if (typeBadge) typeBadge.innerHTML = `<span class="kanban-type-badge badge-${quest.type || 'normal'}" style="font-size:9px;">${(quest.type || 'NORMAL').toUpperCase()}</span>`;

    const titleEl = document.getElementById('qdm-a-title');
    if (titleEl) titleEl.textContent = quest.title;

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

    // Checklist
    const checklistSection = document.getElementById('qdm-a-checklist');
    const items = quest.checklist || [];
    if (items.length && checklistSection) {
        checklistSection.style.display = 'block';
        const done = items.filter(i => i.done).length;
        const pct  = Math.round((done / items.length) * 100);

        const progressEl = document.getElementById('qdm-a-checklist-progress');
        if (progressEl) progressEl.innerHTML = `
            <div style="display:flex;justify-content:space-between;font-size:8px;color:#7f8c8d;margin-bottom:4px;">
                <span>${done}/${items.length} itens</span><span>${pct}%</span>
            </div>
            <div style="background:#0d1b2a;height:6px;border-radius:2px;overflow:hidden;">
                <div style="height:100%;background:#27ae60;width:${pct}%;"></div>
            </div>`;

        const itemsEl = document.getElementById('qdm-a-checklist-items');
        if (itemsEl) itemsEl.innerHTML = items.map(item => `
            <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #1a252f;">
                <input type="checkbox" ${item.done ? 'checked' : ''}
                       data-cy="checkbox-admin-checklist-item"
                       onchange="adminToggleChecklistItem('${quest._id}','${item._id}',this)"
                       style="cursor:pointer;accent-color:#27ae60;flex-shrink:0;">
                <span style="font-size:9px;color:${item.done ? '#7f8c8d' : '#ecf0f1'};text-decoration:${item.done ? 'line-through' : 'none'};">
                    ${_aEsc(item.text)}
                </span>
            </div>`).join('');
    } else if (checklistSection) {
        checklistSection.style.display = 'none';
    }

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
        if (detailRes.ok) renderAdminQuestDetail(await detailRes.json());
    } catch (err) {
        checkbox.checked = !checkbox.checked;
        console.error(err);
    }
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
// 7. MODAL DE EDIÇÃO DA QUEST
// ==========================================
window.openEditQuest = async (questId) => {
    try {
        const res = await fetch(`${API_URL}/quests/${questId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        const q = await res.json();

        document.getElementById('editQuestId').value      = q._id;
        document.getElementById('editQuestTitle').value   = q.title;
        document.getElementById('editQuestType').value    = q.type || 'normal';
        document.getElementById('editQuestXp').value      = q.xp_reward;
        document.getElementById('editQuestCoins').value   = q.coin_reward;
        document.getElementById('editQuestSla').value     = q.sla_seconds || '';
        document.getElementById('editQuestFaction').value = q.faction || 'Produto';
        document.getElementById('editQuestLabels').value  = (q.labels || []).join(', ');

        const sprintId = q.sprint_id ? (q.sprint_id._id || q.sprint_id) : '';
        document.getElementById('editQuestSprint').value  = sprintId;

        document.getElementById('questEditModal').style.display = 'flex';
    } catch (err) {
        console.error(err);
        showToast('Erro ao carregar quest para edição.', 'error');
    }
};

window.closeEditQuest = () => {
    document.getElementById('questEditModal').style.display = 'none';
};

const questEditForm = document.getElementById('questEditForm');
if (questEditForm) {
    questEditForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const questId   = document.getElementById('editQuestId').value;
        const labelsRaw = document.getElementById('editQuestLabels').value || '';
        const slaVal    = document.getElementById('editQuestSla').value;

        const payload = {
            title:       document.getElementById('editQuestTitle').value.trim(),
            type:        document.getElementById('editQuestType').value,
            faction:     document.getElementById('editQuestFaction').value,
            xp_reward:   parseInt(document.getElementById('editQuestXp').value),
            coin_reward: parseInt(document.getElementById('editQuestCoins').value),
            sla_seconds: slaVal ? parseInt(slaVal) : null,
            sprint_id:   document.getElementById('editQuestSprint').value || null,
            labels:      labelsRaw.split(',').map(l => l.trim()).filter(Boolean)
        };

        try {
            const res = await fetch(`${API_URL}/quests/${questId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                showToast('Quest atualizada com sucesso!');
                closeEditQuest();
                await renderAdminQuests(1);
            } else {
                const err = await res.json();
                showToast(`Erro: ${err.message}`, 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Erro de conexão com o servidor.', 'error');
        }
    });
}

window.deleteQuest = async (questId) => {
    if (!confirm('Excluir esta quest permanentemente? Esta ação não pode ser desfeita.')) return;

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
