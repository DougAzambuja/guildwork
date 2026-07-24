// ==========================================
// 0. PROTEÇÃO DE ROTA E INICIALIZAÇÃO
// ==========================================
const token = localStorage.getItem('guild_token');

if (!token || !localStorage.getItem('guild_role')) {
    window.location.href = 'login.html';
}

// ==========================================
// 1. VARIÁVEIS DE ESTADO
// ==========================================
const WIP_LIMIT = 3;


let playerData = {
    id:          null,
    xp:          0,
    coins:       0,
    level:       1,
    tasks:       0,
    farmedGold:  parseInt(sessionStorage.getItem('session_gold') || '0'),
    farmedXP:    parseInt(sessionStorage.getItem('session_xp')   || '0'),
    isCursed:    false,
    curseType:   null,
    name:        'Aventureiro',
    avatar:      dicebearUrl('adventurer'),
    activeBuff:     null,
    csatStreak:     0,
    achievements:   [],
    deliveryStreak: 0,
};

let currentBoardStats = { todo: 0, inProgress: 0, done: 0, myWip: 0, slaAlerts: 0 };

const targetTasks  = 5;
const activeTimers = new Map();
const questCache   = new Map();

let isGuildLeader    = false;
let guildMembers     = [];
let cqChecklistDraft = [];
let kanbanColumns    = [];
let colSortState     = {};   // { [colId]: 'default'|'sla'|'date_new'|'date_old'|'type'|'alpha' }
let boardFilterPlayer = null; // null = sem filtro
let _boardDndReady   = false; // garante que os listeners de DnD são adicionados apenas uma vez
let lastBoardQuests   = [];   // cache para re-render sem request

document.addEventListener('DOMContentLoaded', async () => {
    await fetchPlayerState();
    await fetchGuildContext();
    await fetchKanbanColumns();
    await loadBoard();
    await fetchAndRenderEncounters();
    await fetchAndRenderSocialEvents();
    hideLoadingOverlay();
    startBoardAutoRefresh();
});

// Quando o browser restaura a página do bfcache (ex: botão Voltar),
// fecha o modal e refaz o fetch para garantir dados frescos (avatar, coins, etc.)
window.addEventListener('pageshow', async (e) => {
    if (!e.persisted) return;
    const modal = document.getElementById('profileModal');
    if (modal) modal.style.display = 'none';
    await fetchPlayerState();
});

// ==========================================
// 2. AUTO-REFRESH DO BOARD
// ==========================================
const REFRESH_SECONDS = 15;

function startBoardAutoRefresh() {
    setInterval(() => {
        Promise.all([loadBoard(), fetchPlayerState(), fetchAndRenderEncounters(), fetchAndRenderSocialEvents()]);
    }, REFRESH_SECONDS * 1000);
}

// ==========================================
// 3. DADOS DO JOGADOR
// ==========================================
async function fetchPlayerState() {
    try {
        const res = await fetch(`${API_URL}/players/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const data = await res.json();
            playerData = {
                id:         data._id,
                xp:         data.xp              || 0,
                coins:      data.coins            || 0,
                level:      data.level            || 1,
                tasks:      data.quests_completed || 0,
                farmedGold: parseInt(sessionStorage.getItem('session_gold') || '0'),
                farmedXP:   parseInt(sessionStorage.getItem('session_xp')   || '0'),
                isCursed:   data.is_cursed        || false,
                curseType:  data.curse_type       || null,
                name:       data.nome             || data.username,
                avatar:     data.avatar_url       || dicebearUrl(data.username),
                activeBuff: data.buff_type ? {
                    type:      data.buff_type,
                    expiresAt: data.buff_expires_at       || null,
                    quests:    data.buff_quests_remaining || null
                } : null,
                csatStreak:     data.csat_streak      || 0,
                achievements:    data.achievements      || [],
                deliveryStreak:  data.delivery_streak  || 0,
                ownedCosmetics:  data.owned_cosmetics  || [],
                faction:         data.faction          || 'Produto',
            };

            updateUI();
            updateBuffUI();
            updateStreakUI();

            if (playerData.curseType) applyCurseVisuals(playerData.curseType);

        } else {
            localStorage.clear();
            window.location.href = 'login.html';
        }
    } catch (err) {
        console.error('Erro ao puxar dados do jogador:', err);
        showToast('Erro de conexão com o servidor.', 'error');
    }
}

// ==========================================
// 3b. LIDERANÇA DE GUILDA (criar/editar/excluir missões)
// ==========================================
async function fetchGuildContext() {
    try {
        const res = await fetch(`${API_URL}/guild`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;

        const data = await res.json();
        isGuildLeader = !!data.isLeader;
        guildMembers  = data.members || [];

        const btnNewQuest = document.getElementById('btnNewQuest');
        if (btnNewQuest) btnNewQuest.style.display = isGuildLeader ? 'inline-block' : 'none';
    } catch (err) {
        console.error('Erro ao verificar liderança de guilda:', err);
    }
}

// — Modal de criação de missão —
window.openCreateQuestModal = () => {
    const sel = document.getElementById('cqAssignee');
    sel.innerHTML = '<option value="">Sem atribuição (fica no backlog)</option>' +
        guildMembers.map(m => `<option value="${m._id}">${_esc(m.nome || m.username)}</option>`).join('');

    document.getElementById('createQuestForm').reset();
    cqChecklistDraft = [];
    renderCqChecklistDraft();
    document.getElementById('createQuestModal').style.display = 'flex';
};

window.closeCreateQuestModal = () => {
    document.getElementById('createQuestModal').style.display = 'none';
};

window.addCreateQuestChecklistItem = () => {
    const input = document.getElementById('cqChecklistInput');
    const text  = input.value.trim();
    if (!text) return;
    cqChecklistDraft.push(text);
    input.value = '';
    renderCqChecklistDraft();
};

window.removeCreateQuestChecklistItem = (index) => {
    cqChecklistDraft.splice(index, 1);
    renderCqChecklistDraft();
};

function renderCqChecklistDraft() {
    const container = document.getElementById('cqChecklistDraft');
    container.innerHTML = cqChecklistDraft.map((text, i) => `
        <div style="display:flex;align-items:center;gap:8px;background:#34495e;border:2px solid #7f8c8d;padding:6px 10px;font-size:9px;color:#ecf0f1;">
            <span style="flex:1;">${_esc(text)}</span>
            <button type="button" style="background:#c0392b;border:none;color:#fff;font-size:8px;padding:3px 8px;cursor:pointer;" onclick="removeCreateQuestChecklistItem(${i})">remover</button>
        </div>
    `).join('');
}

document.getElementById('createQuestForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const slaVal = document.getElementById('cqSla').value;
    const payload = {
        title:       document.getElementById('cqTitle').value.trim(),
        size:        document.getElementById('cqSize').value,
        description: document.getElementById('cqDescription').value.trim(),
        sla_seconds: slaVal ? parseInt(slaVal) : null,
        assigned_to: document.getElementById('cqAssignee').value || null,
        checklist:   cqChecklistDraft
    };

    const btn = document.getElementById('btnSubmitCreateQuest');
    btn.disabled = true;

    try {
        const res  = await fetch(`${API_URL}/quests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (!res.ok) { showToast(data.message || 'Erro ao criar missão.', 'error'); return; }

        showToast(`Missão "${data.title}" forjada!`);
        closeCreateQuestModal();
        await loadBoard();
    } catch (err) {
        console.error(err);
        showToast('Erro de conexão.', 'error');
    } finally {
        btn.disabled = false;
    }
});

// ==========================================
// 4. KANBAN BOARD — COLUNAS E CARREGAMENTO
// ==========================================
async function fetchKanbanColumns() {
    try {
        const res = await fetch(`${API_URL}/guild/columns`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) kanbanColumns = await res.json();
    } catch (err) {
        console.error('Erro ao buscar colunas do kanban:', err);
    }
    renderKanbanStructure(); // sempre renderiza — usa fallback se kanbanColumns vazio
}

function renderKanbanStructure() {
    const board = document.getElementById('kanban-board');
    if (!board) return;

    const cols = kanbanColumns.length ? kanbanColumns : [
        { _id: 'todo',        name: 'A FAZER',      color: '#2c3e50', status_map: 'todo'        },
        { _id: 'in-progress', name: 'EM PROGRESSO', color: '#e67e22', status_map: 'in_progress' },
        { _id: 'done',        name: 'CONCLUÍDO',    color: '#27ae60', status_map: 'done'        }
    ];

    board.style.minWidth = '';

    const toolbar = document.getElementById('kanban-toolbar');
    if (toolbar) {
        toolbar.innerHTML = isGuildLeader
            ? `<button class="btn-pixel btn-special" data-cy="btn-edit-columns" onclick="openPlayerColumnsModal()" style="font-size:15px;padding:8px 14px;">⚙️</button>`
            : '';
    }

    board.innerHTML = cols.map(col => {
        const sortVal = colSortState[String(col._id)] || 'default';
        return `
        <div class="kanban-column" data-col-id="${col._id}">
            <div class="kanban-col-header" style="border-bottom:2px solid ${col.color};">
                <span class="kanban-col-title">${col.name.toUpperCase()}</span>
                <div style="display:flex;align-items:center;gap:5px;">
                    <select onchange="setColSort('${col._id}', this.value)"
                            style="font-family:inherit;font-size:10px;background:#111;color:#f1c40f;border:1px solid #444;padding:2px 3px;cursor:pointer;outline:none;">
                        <option value="default" ${sortVal==='default'?'selected':''}>⇅</option>
                        <option value="sla"      ${sortVal==='sla'?'selected':''}>SLA</option>
                        <option value="date_new" ${sortVal==='date_new'?'selected':''}>Nova</option>
                        <option value="date_old" ${sortVal==='date_old'?'selected':''}>Antiga</option>
                        <option value="type"     ${sortVal==='type'?'selected':''}>Tipo</option>
                        <option value="alpha"    ${sortVal==='alpha'?'selected':''}>A-Z</option>
                    </select>
                    <span class="kanban-col-count" id="count-${col._id}">0</span>
                </div>
            </div>
            <div class="kanban-col-body" id="col-${col._id}" data-col-id="${col._id}"></div>
        </div>`;
    }).join('');

    if (!_boardDndReady) {
        _boardDndReady = true;
        board.addEventListener('dragover', e => {
            const body = e.target.closest('.kanban-col-body');
            if (!body) return;
            e.preventDefault();
            body.classList.add('dnd-over');
        });
        board.addEventListener('dragleave', e => {
            const body = e.target.closest('.kanban-col-body');
            if (body && !body.contains(e.relatedTarget)) body.classList.remove('dnd-over');
        });
        board.addEventListener('drop', async e => {
            const body = e.target.closest('.kanban-col-body');
            if (!body) return;
            e.preventDefault();
            body.classList.remove('dnd-over');
            const questId  = e.dataTransfer.getData('text/plain');
            const columnId = body.dataset.colId;
            if (!questId || !columnId) return;
            const quest = questCache.get(questId);
            if (quest && String(quest.column_id) === String(columnId)) return;
            await moveCardToColumn(questId, columnId);
        });
    }
}

async function loadBoard() {
    try {
        const res = await fetch(`${API_URL}/quests`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const quests = await res.json();
            renderBoard(quests);
        } else {
            showToast('Falha ao carregar o board.', 'error');
        }
    } catch (err) {
        console.error('Erro ao carregar board:', err);
        showToast('Erro de conexão com o servidor.', 'error');
    }
}

// ==========================================
// 4. KANBAN BOARD — RENDERIZAÇÃO
// ==========================================
const SORT_FUNCS = {
    default:  () => 0,
    sla:      (a, b) => {
        const dl = q => q.sla_seconds && q.started_at
            ? new Date(q.started_at).getTime() + q.sla_seconds * 1000
            : Infinity;
        return dl(a) - dl(b);
    },
    date_new: (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
    date_old: (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0),
    type:     (a, b) => {
        const o = { urgent: 0, support: 1, normal: 2, jira: 3 };
        return (o[a.type] ?? 9) - (o[b.type] ?? 9);
    },
    alpha:    (a, b) => a.title.localeCompare(b.title, 'pt'),
};

function renderBoard(quests) {
    activeTimers.forEach(id => clearInterval(id));
    activeTimers.clear();

    lastBoardQuests = quests;
    quests.forEach(q => questCache.set(q._id, q));

    // Filtro de player
    const visible = boardFilterPlayer
        ? quests.filter(q => {
            const id = q.assigned_to?._id || q.assigned_to;
            return String(id) === String(boardFilterPlayer);
          })
        : quests;

    const inProgress = visible.filter(q => q.status === 'in_progress');
    const myWipCount = inProgress.filter(q =>
        q.assigned_to && q.assigned_to._id === playerData.id
    ).length;

    const slaAlerts = inProgress.filter(q => {
        if (!q.sla_seconds || !q.started_at) return false;
        const elapsed = (Date.now() - new Date(q.started_at).getTime()) / 1000;
        return elapsed > q.sla_seconds * 0.75;
    }).length;

    currentBoardStats = {
        todo:       visible.filter(q => q.status === 'todo').length,
        inProgress: inProgress.length,
        done:       visible.filter(q => q.status === 'done').length,
        myWip:      myWipCount,
        slaAlerts
    };

    // Agrupa quests por coluna: column_id tem precedência, fallback por status
    const cols = kanbanColumns.length ? kanbanColumns : [
        { _id: 'todo',        status_map: 'todo'        },
        { _id: 'in-progress', status_map: 'in_progress' },
        { _id: 'done',        status_map: 'done'        }
    ];

    const byColumn = {};
    cols.forEach(col => { byColumn[String(col._id)] = []; });

    visible.forEach(q => {
        const colId = q.column_id ? String(q.column_id) : null;
        if (colId && byColumn[colId] !== undefined) {
            const targetCol = cols.find(c => String(c._id) === colId);
            // Dado podre: quest in_progress cujo column_id ainda aponta para coluna todo
            const isStale = q.status === 'in_progress' && targetCol?.status_map === 'todo';
            if (!isStale) {
                byColumn[colId].push(q);
                return;
            }
        }
        const fallback = cols.find(c => c.status_map === q.status);
        if (fallback) byColumn[String(fallback._id)].push(q);
    });

    cols.forEach(col => {
        const sortFn    = SORT_FUNCS[colSortState[String(col._id)]] || SORT_FUNCS.default;
        const colQuests = [...(byColumn[String(col._id)] || [])].sort(sortFn);
        const countEl   = document.getElementById(`count-${col._id}`);
        const bodyEl    = document.getElementById(`col-${col._id}`);
        if (countEl) countEl.textContent = colQuests.length;
        if (!bodyEl) return;

        bodyEl.innerHTML = '';
        if (colQuests.length === 0) {
            bodyEl.innerHTML = '<div class="empty-state" style="padding:20px;color:var(--text-secondary)">Nenhuma missão aqui.</div>';
            return;
        }
        const cardFn = col.status_map === 'todo'        ? (q => renderTodoCard(q, myWipCount))
                     : col.status_map === 'in_progress' ? (q => renderInProgressCard(q))
                     : renderDoneCard;
        colQuests.forEach(q => bodyEl.appendChild(cardFn(q)));
    });

    updateKanbanFilterBar(quests);
    updateSidebar();
}

function updateKanbanFilterBar(quests) {
    const bar = document.getElementById('kanban-filter-bar');
    if (!bar) return;

    const players = new Map();
    quests.forEach(q => {
        const p = q.assigned_to;
        if (p && p._id) players.set(p._id, p.nome || p.username || 'Aventureiro');
    });

    if (players.size === 0) { bar.style.display = 'none'; return; }

    const label   = `<span style="font-size:7px;color:#bdc3c7;margin-right:2px;white-space:nowrap;">FILTRAR:</span>`;
    const allBtn  = `<button class="kanban-filter-btn ${boardFilterPlayer === null ? 'active' : ''}" onclick="setBoardFilter(null)">👥 Todos</button>`;
    const pBtns   = [...players.entries()].map(([id, name]) =>
        `<button class="kanban-filter-btn ${boardFilterPlayer === id ? 'active' : ''}" onclick="setBoardFilter('${id}')">${name.split(' ')[0]}</button>`
    ).join('');

    bar.style.display = 'flex';
    bar.innerHTML = label + allBtn + pBtns;
}

window.setColSort = (colId, sortKey) => {
    colSortState[colId] = sortKey;
    renderBoard(lastBoardQuests);
};

window.setBoardFilter = (playerId) => {
    boardFilterPlayer = (boardFilterPlayer === playerId) ? null : playerId;
    renderBoard(lastBoardQuests);
};

function renderColumn(colId, quests, cardFn) {
    const body = document.getElementById(colId);
    if (!body) return;
    body.innerHTML = '';
    if (quests.length === 0) {
        body.innerHTML = '<div class="empty-state" style="padding:20px;color:var(--text-secondary)">Nenhuma missão aqui.</div>';
        return;
    }
    quests.forEach(q => body.appendChild(cardFn(q)));
}

function _makeDraggable(el, questId) {
    el.draggable = true;
    el.dataset.questId = questId;
    el.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', questId);
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => el.classList.add('dragging'), 0);
    });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));
}

function renderTodoCard(quest, myWipCount) {
    const el = document.createElement('div');
    const typeClass = ['urgent', 'support'].includes(quest.type) ? quest.type : '';
    el.className = `kanban-card ${typeClass}`;

    const overWip      = myWipCount >= WIP_LIMIT;
    const csatBlocked  = playerData.curseType === 'csat_low' && quest.type === 'urgent';
    const alreadyTaken = quest.status !== 'todo';
    const cantPickUp   = overWip || csatBlocked || alreadyTaken;
    const slaInfo = quest.sla_seconds
        ? `<div style="font-size:8px;color:#888;margin-bottom:8px;">SLA: ${formatSla(quest.sla_seconds)}</div>`
        : '';
    const wipWarning = overWip      ? '<div class="wip-warning">Limite WIP atingido (max 3)</div>'
                     : csatBlocked  ? '<div class="wip-warning">💔 Maldição: urgentes bloqueadas</div>'
                     : '';

    const subtaskBadge = quest.subtasks_total > 0
        ? `<span style="background:#8e44ad;color:#fff;font-size:8px;padding:2px 6px;display:inline-block;margin-bottom:4px;" data-cy="subtask-badge">[${quest.subtasks_done || 0}/${quest.subtasks_total}]</span>`
        : '';
    const rejectCount  = (quest.contributors || []).filter(c => c.action === 'rejected').length;
    const rejectBadge  = rejectCount > 0
        ? `<span style="background:#c0392b;color:#fff;font-size:7px;padding:1px 5px;display:inline-block;margin-bottom:4px;" title="Devolvida ${rejectCount}× para o backlog">↩ ${rejectCount}×</span>`
        : '';

    el.innerHTML = `
        <span class="kanban-type-badge badge-${quest.type || 'normal'}">${(quest.type || 'NORMAL').toUpperCase()}</span>
        ${rejectBadge}${subtaskBadge}
        <div class="kanban-card-title">${quest.title}</div>
        <div class="kanban-card-meta">
            <span class="xp-reward">+${quest.xp_reward} XP</span>
            <span class="coin-reward">+${quest.coin_reward} 💰</span>
        </div>
        ${slaInfo}
        ${wipWarning}
        <button class="btn-kanban btn-pickup" onclick="event.stopPropagation(); pickUpQuest('${quest._id}')" ${cantPickUp ? 'disabled' : ''}>
            ⚔️ ACEITAR MISSÃO
        </button>
    `;

    _makeDraggable(el, quest._id);
    el.addEventListener('click', () => openQuestModal(quest._id));
    return el;
}

function renderInProgressCard(quest) {
    const el = document.createElement('div');
    const typeClass = ['urgent', 'support'].includes(quest.type) ? quest.type : '';
    el.className = `kanban-card ${typeClass}`;

    const assignee     = quest.assigned_to;
    const isMyQuest    = assignee && assignee._id === playerData.id;
    const assigneeName = assignee ? (assignee.nome || assignee.username) : '— Sem responsável';
    const assigneeAv   = (assignee && assignee.avatar_url)
        ? assignee.avatar_url
        : dicebearUrl(assignee?.username);

    const slaHtml = quest.sla_seconds
        ? `<div class="kanban-sla-timer" id="sla-${quest._id}">SLA: calculando...</div>`
        : '';

    const slaBreached = quest.sla_seconds && quest.started_at &&
        (Date.now() - new Date(quest.started_at).getTime()) / 1000 > quest.sla_seconds;

    const subtaskBadgeIP = quest.subtasks_total > 0
        ? `<span style="background:#8e44ad;color:#fff;font-size:8px;padding:2px 6px;display:inline-block;margin-bottom:4px;" data-cy="subtask-badge">[${quest.subtasks_done || 0}/${quest.subtasks_total}]</span>`
        : '';

    el.innerHTML = `
        <span class="kanban-type-badge badge-${quest.type || 'normal'}">${(quest.type || 'NORMAL').toUpperCase()}</span>
        ${subtaskBadgeIP}
        <div class="kanban-card-title">${quest.title}</div>
        <div class="kanban-card-meta">
            <span class="xp-reward">+${quest.xp_reward} XP</span>
            <span class="coin-reward">+${quest.coin_reward} 💰</span>
        </div>
        <div class="kanban-assignee">
            <img class="kanban-assignee-avatar" src="${assigneeAv}" alt="">
            <span>${assigneeName}</span>
        </div>
        ${slaHtml}
    `;

    if (quest.sla_seconds && quest.started_at) {
        const assignedToId = quest.assigned_to ? quest.assigned_to._id : null;
        startSlaTimer(quest._id, quest.sla_seconds, quest.started_at, assignedToId);
    }

    _makeDraggable(el, quest._id);
    el.addEventListener('click', () => openQuestModal(quest._id));
    return el;
}

function renderDoneCard(quest) {
    const el = document.createElement('div');
    el.className = 'kanban-card done-card';

    const assigneeName = quest.assigned_to
        ? (quest.assigned_to.nome || quest.assigned_to.username)
        : '—';

    el.innerHTML = `
        <span class="kanban-type-badge badge-${quest.type || 'normal'}">${(quest.type || 'NORMAL').toUpperCase()}</span>
        <div class="kanban-card-title">${quest.title}</div>
        <div class="kanban-card-meta">
            <span class="xp-reward">+${quest.xp_reward} XP</span>
            <span class="coin-reward">+${quest.coin_reward} 💰</span>
        </div>
        <div class="kanban-assignee"><span>Por: ${assigneeName}</span></div>
        <div class="kanban-done-stamp">✅ CONCLUÍDA</div>
    `;

    _makeDraggable(el, quest._id);
    el.addEventListener('click', () => openQuestModal(quest._id));
    return el;
}

// ==========================================
// 5. MODAL DE DETALHES DA QUEST
// ==========================================
const STATUS_MAP = {
    todo:        { label: 'A Fazer',      color: '#2980b9' },
    in_progress: { label: 'Em Progresso', color: '#e67e22' },
    done:        { label: 'Concluída',    color: '#27ae60' }
};

// Espelha as faixas do backend (LEADER_QUEST_SIZE_TIERS em questController.js) só
// pra pré-selecionar o <select> ao abrir a edição — o valor real de XP/Gold sempre
// vem do servidor, isso aqui é só apresentação.
const QUEST_SIZE_TIERS = {
    pequena: { xp_reward: 100, coin_reward: 15 },
    media:   { xp_reward: 250, coin_reward: 30 },
    grande:  { xp_reward: 450, coin_reward: 50 }
};

function mapRewardsToSize(xp, coin) {
    const match = Object.entries(QUEST_SIZE_TIERS)
        .find(([, t]) => t.xp_reward === xp && t.coin_reward === coin);
    return match ? match[0] : 'pequena';
}

let _modalQuestId = null;
let _questEditMode = false;
let _editingChecklistItemId = null;
let _pendingUnsavedAction = null; // 'close' | 'cancel'
let _checklistDraft = null; // rascunho local do checklist durante a edição — só vira PATCH real no SALVAR

function _esc(str) {
    return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _timeAgo(iso) {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}d atrás`;
    if (h > 0) return `${h}h atrás`;
    if (m > 0) return `${m}min atrás`;
    return 'agora';
}

async function openQuestModal(questId) {
    const cached = questCache.get(questId);
    if (!cached) return;

    _modalQuestId = questId;
    _editingChecklistItemId = null;
    _pendingUnsavedAction = null;
    toggleQuestEditMode(false); // reseta o modal para modo leitura e renderiza os dados da quest

    const checklistSection = document.getElementById('qdm-checklist-section');
    const commentsList     = document.getElementById('qdm-comments-list');
    const subtaskForm      = document.getElementById('qdm-subtask-form');
    const subtaskSection   = document.getElementById('qdm-subtasks-section');
    if (checklistSection) checklistSection.style.display = 'none';
    if (commentsList) commentsList.innerHTML = '<div class="empty-state" style="padding:10px">Carregando...</div>';
    if (subtaskForm)    subtaskForm.style.display = 'none';
    if (subtaskSection) subtaskSection.style.display = 'none';

    const modal = document.getElementById('questDetailModal');
    modal.style.display = 'flex';
    modal.dataset.questId = questId;

    try {
        const res = await fetch(`${API_URL}/quests/${questId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        const full = await res.json();
        _renderModalChecklist(full);
        _renderPlayerSubtasks(full);
        _renderModalComments(full.comments || []);
        _renderModalContributors(full);
    } catch (err) {
        console.error('Erro ao carregar detalhe da quest:', err);
    }
}

function _renderModalContributors(quest) {
    const section = document.getElementById('qdm-contributors-section');
    const list    = document.getElementById('qdm-contributors-list');
    if (!section || !list) return;

    const contributors = quest.contributors || [];
    if (contributors.length === 0) { section.style.display = 'none'; return; }

    // Agregar por user_id: soma tempo e conta rejeições
    const map = {};
    for (const c of contributors) {
        const id = String(c.user_id?._id || c.user_id);
        if (!map[id]) map[id] = { user: c.user_id, totalSecs: 0, rejections: 0, actions: [] };
        map[id].totalSecs  += c.time_held_secs || 0;
        map[id].actions.push(c.action);
        if (c.action === 'rejected') map[id].rejections++;
    }

    const totalSecs = Object.values(map).reduce((s, e) => s + e.totalSecs, 0);

    const rows = Object.values(map).map(entry => {
        const u       = entry.user;
        const name    = u?.nome || u?.username || 'Aventureiro';
        const avatar  = u?.avatar_url || (u?.username ? dicebearUrl(u.username) : 'assets/imgs/caneca_pixel.jpg');
        const pct     = totalSecs > 0 ? Math.round((entry.totalSecs / totalSecs) * 100) : 0;
        const timeStr = entry.totalSecs >= 3600
            ? `${Math.round(entry.totalSecs / 3600)}h`
            : entry.totalSecs >= 60
                ? `${Math.round(entry.totalSecs / 60)}min`
                : `${entry.totalSecs}s`;
        const rejectBadge = entry.rejections > 0
            ? `<span style="color:#e74c3c;font-size:7px;margin-left:6px;">↩ ${entry.rejections}×</span>`
            : '';
        const isCompleter = entry.actions.includes('completed');
        const completedMark = isCompleter
            ? `<span style="color:#2ecc71;font-size:7px;margin-left:4px;">✔ concluiu</span>`
            : '';

        return `
            <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #2c3e50;">
                <img src="${avatar}" style="width:24px;height:24px;border:1px solid #555;object-fit:cover;">
                <span style="font-size:8px;color:#ecf0f1;flex:1;">${_esc(name)}${completedMark}${rejectBadge}</span>
                <span style="font-size:7px;color:#7f8c8d;">${timeStr} · ${pct}%</span>
            </div>`;
    });

    list.innerHTML = rows.join('');
    section.style.display = 'block';
}

function _renderModalInfo(quest) {
    const st = STATUS_MAP[quest.status] || STATUS_MAP.todo;

    document.getElementById('qdm-type-badge').innerHTML =
        `<span class="kanban-type-badge badge-${quest.type || 'normal'}" style="font-size:9px;">${(quest.type || 'NORMAL').toUpperCase()}</span>`;

    document.getElementById('qdm-title').textContent = quest.title;
    document.getElementById('qdm-status').innerHTML  =
        `<span class="status-badge" style="background:${st.color}; padding:4px 10px; font-size:8px;">${st.label}</span>`;
    document.getElementById('qdm-xp').textContent    = `+${quest.xp_reward} XP`;
    document.getElementById('qdm-coins').textContent = `+${quest.coin_reward} 💰`;

    const descSection = document.getElementById('qdm-description-section');
    if (quest.description) {
        descSection.style.display = 'block';
        document.getElementById('qdm-description').textContent = quest.description;
    } else {
        descSection.style.display = 'none';
    }

    // Controles do líder de guilda — só para quests da própria guilda
    const leaderControls = document.getElementById('qdm-leader-controls');
    const canManage = isGuildLeader && quest.faction === playerData.faction;
    leaderControls.style.display = canManage ? 'flex' : 'none';
    if (canManage) {
        const blocked   = quest.status === 'in_progress';
        const deleteBtn = document.getElementById('qdm-btn-delete');
        deleteBtn.disabled  = blocked;
        deleteBtn.style.opacity = blocked ? '0.5' : '1';
        deleteBtn.title = blocked ? 'Não é possível excluir uma missão em progresso.' : '';
    }

    const slaEl = document.getElementById('qdm-sla');
    if (!quest.sla_seconds) {
        slaEl.innerHTML = '<span class="quest-modal-sla-none">Sem tempo limite</span>';
    } else if (quest.status === 'in_progress' && quest.started_at) {
        const elapsed   = (Date.now() - new Date(quest.started_at).getTime()) / 1000;
        const remaining = Math.max(0, quest.sla_seconds - Math.floor(elapsed));
        slaEl.innerHTML = remaining > 0
            ? `<span class="quest-modal-sla-active">Restam ${formatSlaVerbose(remaining)}</span>`
            : '<span class="quest-modal-sla-active">SLA ESTOURADO</span>';
    } else {
        slaEl.innerHTML = `<span class="quest-modal-value">${formatSlaVerbose(quest.sla_seconds)}</span>`;
    }

    const assigneeEl = document.getElementById('qdm-assignee');
    const assignee   = quest.assigned_to;
    if (assignee) {
        const av   = assignee.avatar_url || dicebearUrl(assignee.username);
        const name = assignee.nome || assignee.username;
        assigneeEl.innerHTML = `
            <img class="kanban-assignee-avatar" src="${av}" alt="" style="border-color:#f1c40f;">
            <span style="font-size:11px; color:#ecf0f1;">${_esc(name)}</span>
        `;
    } else {
        assigneeEl.innerHTML = '<span style="font-size:10px; color:#7f8c8d;">Disponível — nenhum aventureiro ainda</span>';
    }

    const startedSection = document.getElementById('qdm-started-section');
    if (quest.status === 'in_progress' && quest.started_at) {
        startedSection.style.display = 'block';
        document.getElementById('qdm-started').textContent = formatDate(quest.started_at);
    } else {
        startedSection.style.display = 'none';
    }

    // Seletor de troca de responsável — apenas para líderes de guilda
    const reassignSection = document.getElementById('qdm-reassign-section');
    const reassignSelect  = document.getElementById('qdm-reassign-select');
    const canReassign = isGuildLeader && quest.faction === playerData.faction && quest.status !== 'done' && guildMembers.length > 0;
    if (reassignSection && reassignSelect) {
        if (canReassign) {
            const currentAssigneeId = quest.assigned_to ? String(quest.assigned_to._id || quest.assigned_to) : '';
            reassignSelect.innerHTML =
                `<option value="">— Sem responsável —</option>` +
                guildMembers.map(m =>
                    `<option value="${m._id}" ${String(m._id) === currentAssigneeId ? 'selected' : ''}>${_esc(m.nome || m.username)}</option>`
                ).join('');
            reassignSection.style.display = 'block';
        } else {
            reassignSection.style.display = 'none';
        }
    }

    const moveSection = document.getElementById('qdm-move-column-section');
    const moveSelect  = document.getElementById('qdm-move-column-select');
    const isOwner     = quest.assigned_to && (quest.assigned_to._id === playerData.id || quest.assigned_to === playerData.id);
    const canMove     = (isOwner || isGuildLeader) && kanbanColumns.length > 0 && quest.status !== 'done';
    if (canMove) {
        const currentColId = quest.column_id ? String(quest.column_id) : null;
        moveSelect.innerHTML = kanbanColumns.map(col =>
            `<option value="${col._id}" ${String(col._id) === currentColId ? 'selected' : ''}>${col.name}</option>`
        ).join('');
        moveSection.style.display = 'block';
    } else {
        moveSection.style.display = 'none';
    }
}

function _renderModalChecklist(quest) {
    const section    = document.getElementById('qdm-checklist-section');
    const progressEl = document.getElementById('qdm-checklist-progress');
    const itemsEl    = document.getElementById('qdm-checklist-items');
    if (!section) return;

    const canManage  = _questEditMode && isGuildLeader && quest.faction === playerData.faction;
    const items      = canManage ? (_checklistDraft || []) : (quest.checklist || []);

    if (!items.length && !canManage) { section.style.display = 'none'; return; }
    section.style.display = 'block';

    if (items.length) {
        const doneCount = items.filter(i => i.done).length;
        const pct       = Math.round((doneCount / items.length) * 100);
        progressEl.innerHTML = `
            <div style="display:flex;justify-content:space-between;font-size:8px;color:#7f8c8d;margin-bottom:4px;">
                <span>${doneCount} de ${items.length} itens</span><span>${pct}%</span>
            </div>
            <div style="background:#0d1b2a;height:6px;border-radius:2px;overflow:hidden;">
                <div style="height:100%;background:#27ae60;width:${pct}%;transition:width 0.3s;"></div>
            </div>
        `;
    } else {
        progressEl.innerHTML = '';
    }

    const assignedId = quest.assigned_to ? (quest.assigned_to._id || quest.assigned_to).toString() : null;
    const canToggle   = assignedId === playerData.id;

    itemsEl.innerHTML = items.map(item => {
        const isEditingThis = canManage && item._id === _editingChecklistItemId;
        const toggleAllowed = canToggle && !item._isNew; // item novo (ainda não salvo) não pode ser marcado

        const textCell = isEditingThis
            ? `<input type="text" class="pixel-input" data-cy="input-checklist-item-text"
                   data-item-id="${item._id}" data-original="${_esc(item.text)}"
                   value="${_esc(item.text)}"
                   style="flex:1;font-size:9px;padding:5px 6px;color:#1a1a1a;"
                   onblur="saveChecklistItemText(this)"
                   onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}">`
            : `<span ${canManage ? `data-cy="text-checklist-item" onclick="startEditChecklistItemText('${item._id}')" style="cursor:pointer;` : `style="`}flex:1;font-size:9px;color:${item.done ? '#7f8c8d' : '#ecf0f1'};text-decoration:${item.done ? 'line-through' : 'none'};">${_esc(item.text)}</span>`;

        return `
        <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #1a252f;">
            <input type="checkbox" ${item.done ? 'checked' : ''} ${!toggleAllowed ? 'disabled' : ''}
                   data-cy="checkbox-checklist-item"
                   onchange="toggleChecklistItem('${quest._id}','${item._id}',this)"
                   style="cursor:${toggleAllowed ? 'pointer' : 'default'};accent-color:#27ae60;flex-shrink:0;">
            ${textCell}
            ${canManage ? `<button type="button" data-cy="btn-remove-checklist-item" onclick="removeChecklistItemEdit('${item._id}')" style="background:#c0392b;border:none;color:#fff;font-size:13px;padding:8px 14px;cursor:pointer;flex-shrink:0;">Remover</button>` : ''}
        </div>
    `;
    }).join('');

    if (canManage) {
        itemsEl.innerHTML += `
            <div style="display:flex;gap:6px;margin-top:8px;">
                <input type="text" id="qdm-checklist-add-input" class="pixel-input" data-cy="input-add-checklist-item"
                       placeholder="Novo item..." style="flex:1;font-size:9px;padding:6px;"
                       onkeydown="if(event.key==='Enter'){event.preventDefault();addChecklistItemEdit();}">
                <button type="button" data-cy="btn-add-checklist-item" onclick="addChecklistItemEdit()"
                        style="background:#2980b9;border:none;color:#fff;font-size:15px;padding:6px 10px;cursor:pointer;">+ Item</button>
            </div>
        `;
    }
}

function _renderModalComments(comments) {
    const listEl = document.getElementById('qdm-comments-list');
    if (!listEl) return;

    const sorted = [...comments].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    if (!sorted.length) {
        listEl.innerHTML = '<div style="color:#7f8c8d;font-size:9px;text-align:center;padding:8px;">Sem atividade ainda.</div>';
        return;
    }

    listEl.innerHTML = sorted.map(c => {
        const isActivity = c.type === 'activity';
        const author     = c.user_id ? _esc(c.user_id.nome || c.user_id.username) : 'Sistema';
        const ago        = _timeAgo(c.created_at);

        if (isActivity) {
            return `<div style="display:flex;align-items:center;gap:6px;padding:4px 0;color:#7f8c8d;font-size:8px;">
                <span style="color:#2980b9;flex-shrink:0;">●</span>
                <span>${_esc(c.text)}</span>
                <span style="margin-left:auto;white-space:nowrap;font-size:7px;">${ago}</span>
            </div>`;
        }

        return `<div style="padding:6px 0;border-bottom:1px solid #1a252f;">
            <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                <span style="font-size:8px;color:#f1c40f;font-weight:bold;">${author}</span>
                <span style="font-size:7px;color:#7f8c8d;">${ago}</span>
            </div>
            <div style="font-size:9px;color:#ecf0f1;">${_esc(c.text)}</div>
        </div>`;
    }).join('');

    listEl.scrollTop = listEl.scrollHeight;
}

window.toggleChecklistItem = async (questId, itemId, checkbox) => {
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
        // Recarrega o detalhe para atualizar a barra de progresso
        const detailRes = await fetch(`${API_URL}/quests/${questId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (detailRes.ok) {
            const fresh = await detailRes.json();
            // "Concluído" é operacional (não faz parte do rascunho de edição) — mas
            // sincroniza o rascunho pra não mostrar um estado antigo se o líder também
            // for o responsável e estiver com o card em modo de edição.
            if (_checklistDraft) {
                const draftItem = _checklistDraft.find(i => i._id === itemId);
                const freshItem = (fresh.checklist || []).find(i => i._id === itemId);
                if (draftItem && freshItem) draftItem.done = freshItem.done;
            }
            _renderModalChecklist(fresh);
        }
    } catch (err) {
        checkbox.checked = !checkbox.checked;
        console.error(err);
    }
};

window.submitQuestComment = async () => {
    if (!_modalQuestId) return;
    const input = document.getElementById('qdm-comment-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    try {
        const res = await fetch(`${API_URL}/quests/${_modalQuestId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ text })
        });
        if (res.ok) {
            input.value = '';
            const detailRes = await fetch(`${API_URL}/quests/${_modalQuestId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (detailRes.ok) {
                const full = await detailRes.json();
                _renderModalComments(full.comments || []);
            }
        } else {
            showToast('Erro ao enviar comentário.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Erro de conexão.', 'error');
    }
};

// Compara os campos do formulário de edição (título/descrição/SLA) e o rascunho do
// checklist contra a quest em cache — tudo isso fica "pendurado" localmente até o SALVAR.
function checklistDraftDiffers() {
    if (!_checklistDraft) return false;
    const quest = questCache.get(_modalQuestId);
    if (!quest) return false;

    const original = quest.checklist || [];
    if (original.length !== _checklistDraft.length) return true;

    return _checklistDraft.some(draftItem => {
        if (draftItem._isNew) return true;
        const orig = original.find(o => o._id === draftItem._id);
        return !orig || orig.text !== draftItem.text;
    });
}

function hasUnsavedQuestEdits() {
    if (!_questEditMode) return false;
    const quest = questCache.get(_modalQuestId);
    if (!quest) return false;

    const titleEl = document.getElementById('qdm-edit-title');
    const descEl  = document.getElementById('qdm-edit-description');
    const slaEl   = document.getElementById('qdm-edit-sla');
    const sizeEl  = document.getElementById('qdm-edit-size');
    if (!titleEl || !descEl || !slaEl || !sizeEl) return false;

    const titleVal = titleEl.value.trim();
    const descVal  = descEl.value.trim();
    const slaRaw   = slaEl.value;
    const slaVal   = slaRaw ? parseInt(slaRaw) : null;
    const sizeVal  = sizeEl.value;

    return titleVal !== (quest.title || '') ||
           descVal  !== (quest.description || '') ||
           slaVal   !== (quest.sla_seconds || null) ||
           sizeVal  !== mapRewardsToSize(quest.xp_reward, quest.coin_reward) ||
           checklistDraftDiffers();
}

function _forceCloseQuestModal() {
    document.getElementById('questDetailModal').style.display = 'none';
    toggleQuestEditMode(false);
    _modalQuestId = null;
    _editingChecklistItemId = null;
}

function closeQuestModal() {
    if (hasUnsavedQuestEdits()) {
        _pendingUnsavedAction = 'close';
        document.getElementById('unsavedChangesModal').style.display = 'flex';
        return;
    }
    _forceCloseQuestModal();
}

window.cancelQuestEdit = () => {
    if (hasUnsavedQuestEdits()) {
        _pendingUnsavedAction = 'cancel';
        document.getElementById('unsavedChangesModal').style.display = 'flex';
        return;
    }
    toggleQuestEditMode(false);
};

window.cancelDiscardQuestEdit = () => {
    document.getElementById('unsavedChangesModal').style.display = 'none';
    _pendingUnsavedAction = null;
};

window.confirmDiscardQuestEdit = () => {
    document.getElementById('unsavedChangesModal').style.display = 'none';
    if (_pendingUnsavedAction === 'close')  _forceCloseQuestModal();
    if (_pendingUnsavedAction === 'cancel') toggleQuestEditMode(false);
    _pendingUnsavedAction = null;
};

// — Edição inline (líder de guilda) —
// No modo de edição, escondemos as seções não-editáveis (recompensa, responsável,
// atividade) para o modal ficar compacto — só título/descrição/SLA/checklist ficam visíveis.
function toggleQuestEditMode(on) {
    _questEditMode = on;
    const quest = questCache.get(_modalQuestId);
    if (!quest) return;

    if (on) {
        document.getElementById('qdm-edit-title').value       = quest.title;
        document.getElementById('qdm-edit-description').value = quest.description || '';
        document.getElementById('qdm-edit-sla').value          = quest.sla_seconds || '';
        document.getElementById('qdm-edit-size').value         = mapRewardsToSize(quest.xp_reward, quest.coin_reward);
        // Rascunho local do checklist — add/remover/renomear só mexem aqui até o SALVAR
        _checklistDraft = (quest.checklist || []).map(i => ({ _id: i._id, text: i.text, done: i.done }));
    } else {
        _checklistDraft = null;
    }

    document.getElementById('qdm-edit-form').style.display        = on ? 'block' : 'none';
    document.getElementById('qdm-edit-actions').style.display     = on ? 'flex'  : 'none';
    document.getElementById('qdm-title').style.display            = on ? 'none'  : '';
    document.getElementById('qdm-rewards-section').style.display  = on ? 'none'  : '';
    document.getElementById('qdm-assignee-section').style.display = on ? 'none'  : '';
    document.getElementById('qdm-activity-section').style.display = on ? 'none'  : '';

    _renderModalInfo(quest);
    _renderModalChecklist(quest);

    if (on) {
        document.getElementById('qdm-description-section').style.display = 'none';
        document.getElementById('qdm-sla-section').style.display         = 'none';
        document.getElementById('qdm-started-section').style.display     = 'none';
    }
}
window.toggleQuestEditMode = toggleQuestEditMode;

window.saveQuestEdit = async () => {
    if (!_modalQuestId) return;

    const title = document.getElementById('qdm-edit-title').value.trim();
    if (!title) { showToast('Título não pode ficar vazio.', 'error'); return; }

    const slaVal = document.getElementById('qdm-edit-sla').value;
    const payload = {
        title,
        size:        document.getElementById('qdm-edit-size').value,
        description: document.getElementById('qdm-edit-description').value.trim(),
        sla_seconds: slaVal ? parseInt(slaVal) : null
    };

    try {
        const res  = await fetch(`${API_URL}/quests/${_modalQuestId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (!res.ok) { showToast(data.message || 'Erro ao atualizar missão.', 'error'); return; }

        const quest = { ...questCache.get(data._id), ...data };
        questCache.set(data._id, quest);

        const checklistOk = await commitChecklistDraft(quest);
        showToast(checklistOk ? 'Missão atualizada!' : 'Missão atualizada, mas houve erro ao salvar o checklist.', checklistOk ? 'success' : 'error');

        toggleQuestEditMode(false);
        await loadBoard();
    } catch (err) {
        console.error(err);
        showToast('Erro de conexão.', 'error');
    }
};

window.deleteQuestFromModal = () => {
    if (!_modalQuestId) return;

    const deleteBtn = document.getElementById('qdm-btn-delete');
    if (deleteBtn.disabled) return;

    const quest = questCache.get(_modalQuestId);
    const msgEl = document.getElementById('deleteConfirmMessage');
    if (msgEl) msgEl.textContent = quest ? `Excluir "${quest.title}"? Esta ação não pode ser desfeita.` : 'Esta ação não pode ser desfeita.';

    document.getElementById('deleteConfirmModal').style.display = 'flex';
};

window.closeDeleteConfirmModal = () => {
    document.getElementById('deleteConfirmModal').style.display = 'none';
};

window.confirmDeleteQuest = async () => {
    document.getElementById('deleteConfirmModal').style.display = 'none';
    if (!_modalQuestId) return;

    try {
        const res  = await fetch(`${API_URL}/quests/${_modalQuestId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (!res.ok) { showToast(data.message || 'Erro ao excluir missão.', 'error'); return; }

        showToast('Missão excluída!', 'error');
        closeQuestModal();
        await loadBoard();
    } catch (err) {
        console.error(err);
        showToast('Erro de conexão.', 'error');
    }
};

// — Checklist: adicionar/remover/renomear itens no RASCUNHO local (líder de guilda,
// no modo de edição). Nada disso toca a API — só vira PATCH real quando o usuário
// clica em SALVAR (ver commitChecklistDraft), pra não perder o item se ele fechar
// o card sem salvar.
function _rerenderChecklistFromCache() {
    const quest = questCache.get(_modalQuestId);
    if (quest) _renderModalChecklist(quest);
}

window.addChecklistItemEdit = () => {
    const input = document.getElementById('qdm-checklist-add-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    if (!_checklistDraft) _checklistDraft = [];
    _checklistDraft.push({
        _id: `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        text,
        done: false,
        _isNew: true
    });

    _rerenderChecklistFromCache();

    const freshInput = document.getElementById('qdm-checklist-add-input');
    if (freshInput) freshInput.focus();
};

window.removeChecklistItemEdit = (itemId) => {
    if (!_checklistDraft) return;
    _checklistDraft = _checklistDraft.filter(i => i._id !== itemId);
    _rerenderChecklistFromCache();
};

window.startEditChecklistItemText = (itemId) => {
    _editingChecklistItemId = itemId;
    _rerenderChecklistFromCache();

    const input = document.querySelector(`#qdm-checklist-items input[data-item-id="${itemId}"]`);
    if (input) { input.focus(); input.select(); }
};

window.saveChecklistItemText = (inputEl) => {
    const itemId  = inputEl.dataset.itemId;
    const newText = inputEl.value.trim();

    _editingChecklistItemId = null;

    if (newText && _checklistDraft) {
        const draftItem = _checklistDraft.find(i => i._id === itemId);
        if (draftItem) draftItem.text = newText;
    }

    _rerenderChecklistFromCache();
};

// Compara o rascunho contra o checklist salvo e envia só a diferença (add/remove/update)
// num único PATCH — chamado pelo SALVAR do formulário de edição.
async function commitChecklistDraft(quest) {
    if (!_checklistDraft) return true;

    const original = quest.checklist || [];
    const add    = _checklistDraft.filter(i => i._isNew).map(i => i.text);
    const remove = original.filter(o => !_checklistDraft.some(d => d._id === o._id)).map(o => o._id);
    const update = _checklistDraft
        .filter(d => !d._isNew)
        .filter(d => {
            const orig = original.find(o => o._id === d._id);
            return orig && orig.text !== d.text;
        })
        .map(d => ({ id: d._id, text: d.text }));

    if (!add.length && !remove.length && !update.length) return true;

    try {
        const res  = await fetch(`${API_URL}/quests/${_modalQuestId}/checklist`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ add, remove, update })
        });
        const data = await res.json();
        if (!res.ok) return false;

        quest.checklist = data.checklist;
        questCache.set(_modalQuestId, quest);
        return true;
    } catch (err) {
        console.error(err);
        return false;
    }
}

function formatDate(isoString) {
    const d = new Date(isoString);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ==========================================
// 6. AÇÕES DO KANBAN
// ==========================================
async function pickUpQuest(questId) {
    try {
        const res = await fetch(`${API_URL}/quests/${questId}/move`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: 'in_progress' })
        });

        if (res.ok) {
            showToast('Missão aceita! Boa caçada, aventureiro!');
            await loadBoard();
        } else {
            const err = await res.json();
            showToast(err.message || 'Erro ao aceitar missão.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Erro de conexão com o servidor.', 'error');
    }
}

async function moveCardToColumn(questId, columnId, csatScore = null) {
    const targetCol = kanbanColumns.find(c => String(c._id) === String(columnId));
    if (csatScore === null && targetCol?.status_map === 'done') {
        const quest = questCache.get(questId);
        if (quest?.type === 'support') {
            const nota    = prompt('⭐ Qual foi a nota CSAT do cliente? (1 a 5)');
            const notaNum = parseInt(nota);
            if (isNaN(notaNum) || notaNum < 1 || notaNum > 5) {
                showToast('Nota inválida! Digite um número de 1 a 5.', 'error');
                return;
            }
            csatScore = notaNum;
        }
    }

    try {
        const res = await fetch(`${API_URL}/quests/${questId}/move-column`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ column_id: columnId, csat_score: csatScore })
        });

        const data = await res.json();

        if (!res.ok) {
            showToast(data.message || 'Erro ao mover quest.', 'error');
            return;
        }

        if (data.updatedState) {
            const wasCurseType    = playerData.curseType;
            playerData.xp         = data.updatedState.xp;
            playerData.coins       = data.updatedState.coins;
            playerData.level       = data.updatedState.level;
            playerData.tasks       = data.updatedState.questsCompleted;
            playerData.isCursed    = data.updatedState.isCursed;
            playerData.curseType   = data.updatedState.curseType || null;
            playerData.activeBuff     = data.updatedState.activeBuff    || null;
            playerData.csatStreak     = data.updatedState.csatStreak    || 0;
            playerData.deliveryStreak = data.updatedState.deliveryStreak || 0;
            playerData.farmedGold    += data.coinsGained;
            playerData.farmedXP      += data.xpGained;
            sessionStorage.setItem('session_gold', playerData.farmedGold);
            sessionStorage.setItem('session_xp',   playerData.farmedXP);

            updateUI();
            updateBuffUI();
            updateStreakUI();

            if (data.leveledUp) {
                showLevelUpAnimation(data.updatedState.level);
            } else {
                const treasuryMsg = data.treasuryContribution > 0
                    ? ` (+${data.treasuryContribution} ao tesouro 🏰)`
                    : '';
                showToast(`Quest concluída! +${data.xpGained} XP +${data.coinsGained} 💰${treasuryMsg}`);
            }

            if (wasCurseType && !playerData.curseType) {
                removeCurseVisuals();
                showToast('✨ Maldição quebrada!');
            } else if (playerData.curseType) {
                applyCurseVisuals(playerData.curseType);
                if (data.newCurseApplied) {
                    const cfg = CURSE_CONFIG[playerData.curseType];
                    showToast(`${cfg.icon} ${cfg.label} aplicada! ${cfg.penalty}`, 'error');
                }
            }

            if (data.buffGranted === 'xp_double_activity') {
                showToast('⚡ CSAT STREAK x3! XP duplo nas próximas 2 missões!');
            } else if (data.buffGranted === 'xp_double_time') {
                showToast('⚡ CSAT STREAK MÁXIMO! XP duplo por 24 horas!');
            } else if (data.buffApplied) {
                const buffLabel = data.buffApplied === 'xp_double_time' ? '(tempo)' : '(atividade)';
                showToast(`⚡ Buff XP Duplo ${buffLabel} aplicado!`);
            }

            if (data.updatedState.streakBonusXP > 0) {
                showToast(`🔥 STREAK ${data.updatedState.deliveryStreak} DIAS! Bônus de +${data.updatedState.streakBonusXP} XP!`);
            }
        } else {
            const col = kanbanColumns.find(c => String(c._id) === String(columnId));
            showToast(`Card movido para "${col?.name || 'coluna'}".`);
        }

        await loadBoard();
    } catch (err) {
        console.error(err);
        showToast('Erro de conexão com o servidor.', 'error');
    }
}

window.moveCardFromModal = async () => {
    const questId  = _modalQuestId;
    const columnId = document.getElementById('qdm-move-column-select')?.value;
    if (!questId || !columnId) return;

    const targetCol = kanbanColumns.find(c => String(c._id) === String(columnId));
    const quest     = questCache.get(questId);

    // Valida antes de fechar o modal — erro visível enquanto o modal ainda está aberto
    if (targetCol?.status_map === 'done' && quest?.status !== 'in_progress') {
        showToast('A quest precisa estar em progresso para ser concluída.', 'error');
        return;
    }

    let csatScore = null;
    if (targetCol?.status_map === 'done' && quest?.type === 'support') {
        const nota    = prompt('⭐ Qual foi a nota CSAT do cliente? (1 a 5)');
        const notaNum = parseInt(nota);
        if (isNaN(notaNum) || notaNum < 1 || notaNum > 5) {
            showToast('Nota inválida! Digite um número de 1 a 5.', 'error');
            return;
        }
        csatScore = notaNum;
    }

    closeQuestModal();
    await moveCardToColumn(questId, columnId, csatScore);
};

window.saveQuestAssignee = async () => {
    const questId = _modalQuestId;
    const userId  = document.getElementById('qdm-reassign-select')?.value || null;
    if (!questId) return;

    try {
        const res = await fetch(`${API_URL}/quests/${questId}/assign`, {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body:    JSON.stringify({ userId: userId || null })
        });
        const data = await res.json();
        if (!res.ok) {
            showToast(data.message || 'Erro ao salvar responsável.', 'error');
            return;
        }
        const memberName = userId
            ? (guildMembers.find(m => String(m._id) === String(userId))?.nome || '—')
            : 'nenhum';
        showToast(`Responsável atualizado: ${memberName}.`);
        closeQuestModal();
        await loadBoard();
    } catch {
        showToast('Erro de conexão.', 'error');
    }
};

// ==========================================
// 7. SLA TIMER (conta a partir de started_at)
// ==========================================
function startSlaTimer(questId, slaSeconds, startedAt, assignedToId) {
    const slaMs  = slaSeconds * 1000;
    const halfMs = slaMs / 2;
    const startMs = new Date(startedAt).getTime();

    let timerId;

    const tick = async () => {
        const timerEl   = document.getElementById(`sla-${questId}`);
        if (!timerEl) {
            clearInterval(timerId);
            activeTimers.delete(questId);
            return;
        }

        const elapsed   = Date.now() - startMs;
        const remaining = slaMs - elapsed;

        if (remaining <= 0) {
            clearInterval(timerId);
            activeTimers.delete(questId);
            timerEl.textContent       = '🚨 SLA ESTOURADO!';
            timerEl.style.color       = '#e74c3c';
            timerEl.style.borderColor = '#e74c3c';
            const isMyQuest = assignedToId && assignedToId.toString() === playerData.id;
            if (isMyQuest) {
                showToast('🚨 SLA estourado! Completar esta missão aplicará a Maldição do Atraso.', 'error');
            }
            return;
        }

        const secs = Math.ceil(remaining / 1000);
        if (remaining > halfMs) {
            timerEl.textContent       = `SLA: ${formatSla(secs)}`;
            timerEl.style.color       = '#c0392b';
            timerEl.style.borderColor = '#c0392b';
        } else {
            timerEl.textContent       = `⚠️ CORRE! ${formatSla(secs)}`;
            timerEl.style.color       = '#e67e22';
            timerEl.style.borderColor = '#e67e22';
        }
    };

    tick();
    timerId = setInterval(tick, 1000);
    activeTimers.set(questId, timerId);
}

function formatSla(seconds) {
    if (seconds >= 3600) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${h}h${m}m`;
    }
    if (seconds >= 60) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}m${String(s).padStart(2, '0')}s`;
    }
    return `${seconds}s`;
}

function formatSlaVerbose(seconds) {
    if (seconds >= 3600) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return m > 0 ? `${h} hora${h > 1 ? 's' : ''} e ${m} min` : `${h} hora${h > 1 ? 's' : ''}`;
    }
    if (seconds >= 60) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return s > 0 ? `${m} min e ${s}s` : `${m} minutos`;
    }
    return `${seconds} segundos`;
}

// ==========================================
// 8. ATUALIZAÇÃO VISUAL (UI)
// ==========================================
function updateUI() {
    const xpMax = xpParaProximoNivel(playerData.level);
    const xpPct = Math.min((playerData.xp / xpMax) * 100, 100);

    const xpBar = document.getElementById('xpBar');
    if (xpBar) xpBar.style.width = xpPct + '%';

    const coinEl = document.getElementById('coinCount');
    if (coinEl) coinEl.innerText = playerData.coins;

    const levelEl = document.getElementById('levelDisplay');
    if (levelEl) levelEl.innerText = `Lvl: ${playerData.level}`;

    const nameEl = document.getElementById('playerName');
    if (nameEl) nameEl.innerText = playerData.name;

    const avatarEl = document.getElementById('playerAvatar');
    if (avatarEl) avatarEl.src = playerData.avatar;

    updateObjectivesUI();
}

function updateObjectivesUI() {
    updateSidebar();
}

function updateBuffUI() {
    const banner = document.getElementById('buffBanner');
    if (!banner) return;

    const buff = playerData.activeBuff;

    if (!buff || !buff.type) {
        // Sem buff — mostrar streak se > 0
        if (playerData.csatStreak > 0) {
            const next    = playerData.csatStreak < 3 ? 3 : 5;
            const current = playerData.csatStreak;
            banner.style.cssText = 'display:block; background:#0d1520; border:1px solid #f1c40f55; padding:8px 12px; margin-bottom:10px; border-radius:2px;';
            banner.innerHTML = `
                <div style="font-size:8px;color:#f1c40f;letter-spacing:1px;">⭐ CSAT STREAK: ${current}/${next}</div>
                <div style="background:#1e2f3f;height:3px;border-radius:2px;margin-top:6px;overflow:hidden;">
                    <div style="height:100%;background:#f1c40f;width:${Math.round((current / next) * 100)}%;transition:width 0.3s;"></div>
                </div>
                <div style="font-size:7px;color:#7f8c8d;margin-top:4px;">Streak 3: XP duplo × 2 quests · Streak 5: XP duplo × 24h</div>
            `;
        } else {
            banner.style.display = 'none';
        }
        return;
    }

    let detail = '';
    if (buff.type === 'xp_double_time') {
        const remaining = buff.expiresAt ? Math.max(0, new Date(buff.expiresAt) - Date.now()) : 0;
        const h = Math.floor(remaining / 3600000);
        const m = Math.floor((remaining % 3600000) / 60000);
        detail = remaining > 0 ? `Expira em ${h}h${m}m` : 'Expirando...';
    } else if (buff.type === 'xp_double_activity') {
        detail = `${buff.quests} quest${buff.quests === 1 ? '' : 's'} restante${buff.quests === 1 ? '' : 's'}`;
    }

    banner.style.cssText = 'display:block; background:#0d1b12; border:2px solid #f1c40f; padding:10px 12px; margin-bottom:10px; border-radius:2px;';
    banner.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <span style="font-size:16px;line-height:1;">⚡</span>
            <span style="font-size:8px;color:#f1c40f;font-weight:bold;letter-spacing:1px;">XP DUPLO ATIVO</span>
        </div>
        <div style="font-size:8px;color:#f39c12;">${detail}</div>
    `;
}

// ==========================================
// RANDOM ENCOUNTERS
// ==========================================
let _activeEncounters = [];

// Efeitos que merecem destaque positivo inline na sidebar
const POSITIVE_EFFECT_KINDS = new Set(['xp_bonus', 'gold_bonus', 'luck', 'store_discount']);

async function fetchAndRenderEncounters() {
    const banner = document.getElementById('encounterBanner');
    if (!banner) return;
    try {
        const res = await fetch(`${API_URL}/encounters/active`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) { banner.style.display = 'none'; return; }
        _activeEncounters = await res.json();

        if (!_activeEncounters.length) { banner.style.display = 'none'; return; }

        const count      = _activeEncounters.length;
        const single     = count === 1 ? _activeEncounters[0] : null;
        const singleKind = single?.effect?.kind;

        if (single && POSITIVE_EFFECT_KINDS.has(singleKind)) {
            // 1 evento positivo → card inline (mesmo formato do streak)
            const col   = ENC_COLORS[singleKind];
            const icon  = ENC_ICONS[singleKind]  || '⚡';
            const label = ENC_LABELS[singleKind] || 'EVENTO ATIVO';
            const pct   = Math.round((single.effect?.value || 0) * 100);
            const time  = _formatTimeRemaining(single.active_until);

            banner.style.cssText = `
                display:block; cursor:pointer;
                background:${col.bg};
                border:1px solid ${col.border};
                padding:8px 12px;
                margin-bottom:10px;
            `;
            banner.innerHTML = `
                <div style="font-size:8px;color:${col.text};letter-spacing:1px;font-weight:bold;">${icon} EVENTO ATIVO</div>
                <div style="font-size:8px;color:#ecf0f1;margin-top:3px;">${single.title}</div>
                <div style="font-size:7px;color:${col.text};margin-top:4px;">+${pct}% · ${time}</div>
            `;
        } else {
            // 1 evento negativo OU múltiplos → pill neutro com chevron
            const plural = count > 1;
            banner.style.cssText = `
                display:block; cursor:pointer;
                background:#1a1400;
                border:1px solid #f39c1230;
                border-left:4px solid #f39c12;
                padding:8px 12px;
                margin-bottom:10px;
            `;
            banner.innerHTML = `
                <div style="display:flex;align-items:center;gap:10px;"
                     onmouseenter="this.style.opacity='.85'" onmouseleave="this.style.opacity='1'">
                    <span style="font-size:15px;line-height:1;">⚡</span>
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:8px;color:#f39c12;letter-spacing:1px;">EVENTO${plural ? 'S' : ''} ATIVO${plural ? 'S' : ''}</div>
                        <div style="font-size:8px;color:#ecf0f1;margin-top:3px;">${plural ? `${count} eventos — ver detalhes` : 'Ver detalhes'}</div>
                    </div>
                    <span style="font-size:11px;color:#f39c12;flex-shrink:0;">›</span>
                </div>
            `;
        }
    } catch {
        banner.style.display = 'none';
    }
}

function _formatTimeRemaining(until) {
    if (!until) return '—';
    const ms = new Date(until) - Date.now();
    if (ms <= 0) return 'Encerrado';
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    if (h > 0) return `${h}h ${m}m restantes`;
    return `${m}m restantes`;
}

let _encounterTimerInterval = null;

window.openEncounterModal = function() {
    const modal = document.getElementById('encounterModal');
    const body  = document.getElementById('encounterModalBody');
    if (!modal || !body) return;

    const renderModal = () => {
        body.innerHTML = _activeEncounters.map(enc => {
            const kind  = enc.effect?.kind || 'xp_bonus';
            const col   = ENC_COLORS[kind] || ENC_COLORS.xp_bonus;
            const icon  = ENC_ICONS[kind]  || '⚡';
            const label = ENC_LABELS[kind] || 'EVENTO';
            const pct   = Math.round((enc.effect?.value || 0) * 100);
            const scope = enc.type === 'faction' ? `🏰 ${enc.affected_faction}` : '🌐 Todas as Facções';
            const time  = _formatTimeRemaining(enc.active_until);

            return `
            <div style="
                background:${col.bg};border:2px solid ${col.border};
                padding:18px 20px;margin-bottom:14px;
            ">
                <div style="display:flex;align-items:center;gap:14px;margin-bottom:12px;">
                    <span style="font-size:32px;line-height:1;">${icon}</span>
                    <div>
                        <div style="font-size:11px;color:${col.text};letter-spacing:1px;margin-bottom:5px;">${label}</div>
                        <div style="font-size:13px;color:#ecf0f1;">${enc.title}</div>
                    </div>
                </div>
                <div style="display:flex;gap:12px;flex-wrap:wrap;">
                    <div style="background:#0d1b2a;padding:8px 14px;flex:1;min-width:80px;text-align:center;">
                        <div style="font-size:8px;color:#7f8c8d;margin-bottom:4px;">EFEITO</div>
                        <div style="font-size:14px;color:${col.text};">+${pct}%</div>
                    </div>
                    <div style="background:#0d1b2a;padding:8px 14px;flex:1;min-width:80px;text-align:center;">
                        <div style="font-size:8px;color:#7f8c8d;margin-bottom:4px;">ALCANCE</div>
                        <div style="font-size:9px;color:#ecf0f1;">${scope}</div>
                    </div>
                    <div style="background:#0d1b2a;padding:8px 14px;flex:1;min-width:80px;text-align:center;">
                        <div style="font-size:8px;color:#7f8c8d;margin-bottom:4px;">TEMPO</div>
                        <div style="font-size:9px;color:${col.text};">${time}</div>
                    </div>
                </div>
                ${enc.description ? `<div style="font-size:9px;color:#7f8c8d;margin-top:12px;border-top:1px solid ${col.border}40;padding-top:10px;">${enc.description}</div>` : ''}
            </div>`;
        }).join('');
    };

    renderModal();
    modal.style.display = 'flex';

    // Atualiza tempo restante a cada minuto enquanto modal está aberto
    _encounterTimerInterval = setInterval(renderModal, 60_000);
}

window.closeEncounterModal = function() {
    const modal = document.getElementById('encounterModal');
    if (modal) modal.style.display = 'none';
    clearInterval(_encounterTimerInterval);
    _encounterTimerInterval = null;
}

// ── SOCIAL EVENTS ────────────────────────────────────────────────────────────

async function fetchAndRenderSocialEvents() {
    const banner = document.getElementById('socialEventsBanner');
    const list   = document.getElementById('socialEventsSidebar');
    if (!banner || !list) return;

    try {
        const res = await fetch(`${API_URL}/social-events`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) { banner.style.display = 'none'; return; }

        const events = await res.json();

        // Mostra apenas os próximos 5 eventos (futuros primeiro, depois passados)
        const future = events.filter(e => !e.is_past);
        const past   = events.filter(e => e.is_past);
        const visible = [...future, ...past].slice(0, 5);

        if (!visible.length) { banner.style.display = 'none'; return; }

        banner.style.display = '';

        const formatDate = d => new Date(d).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit',
            hour: '2-digit', minute: '2-digit',
        });

        list.innerHTML = visible.map(ev => {
            const faction = ev.faction ? `🏰 ${ev.faction}` : '🌐 Empresa toda';
            return `
            <div style="
                padding:8px 10px;
                margin-bottom:6px;
                background:${ev.is_past ? '#0d1b2a' : '#0d1f0d'};
                border-left:3px solid ${ev.is_past ? '#3d5166' : '#27ae60'};
                opacity:${ev.is_past ? '0.55' : '1'};
            ">
                <div style="font-size:8px;color:${ev.is_past ? '#7f8c8d' : '#2ecc71'};margin-bottom:3px;">
                    ${ev.is_past ? '📋' : '📅'} ${formatDate(ev.event_date)}
                </div>
                <div style="font-size:9px;color:#ecf0f1;margin-bottom:2px;">${ev.title}</div>
                ${ev.description ? `<div style="font-size:8px;color:#7f8c8d;">${ev.description}</div>` : ''}
                <div style="font-size:7px;color:#3d5166;margin-top:3px;">${faction}</div>
            </div>`;
        }).join('');

    } catch {
        banner.style.display = 'none';
    }
}

const STREAK_MILESTONES_DISPLAY = [3, 7, 14, 30];

function updateStreakUI() {
    const banner = document.getElementById('streakBanner');
    if (!banner) return;

    const streak = playerData.deliveryStreak || 0;

    if (streak === 0) {
        banner.style.display = 'none';
        return;
    }

    const nextMilestone = STREAK_MILESTONES_DISPLAY.find(m => m > streak) || null;
    const prevMilestone = [...STREAK_MILESTONES_DISPLAY].reverse().find(m => m <= streak) || 0;

    let progressHtml = '';
    if (nextMilestone) {
        const range   = nextMilestone - prevMilestone;
        const current = streak - prevMilestone;
        const pct     = Math.round((current / range) * 100);
        progressHtml = `
            <div style="background:#1e2f3f;height:3px;border-radius:2px;margin-top:6px;overflow:hidden;">
                <div style="height:100%;background:#e67e22;width:${pct}%;transition:width 0.3s;"></div>
            </div>
            <div style="font-size:7px;color:#7f8c8d;margin-top:4px;">${streak}/${nextMilestone} dias para bônus</div>
        `;
    } else {
        progressHtml = `<div style="font-size:7px;color:#e67e22;margin-top:4px;">🏆 Streak máximo atingido!</div>`;
    }

    const isMilestone = STREAK_MILESTONES_DISPLAY.includes(streak);
    const borderColor = isMilestone ? '#e67e22' : '#e67e2255';
    const bgColor     = isMilestone ? '#1a0f00'  : '#0d1520';

    banner.style.cssText = `display:block; background:${bgColor}; border:${isMilestone ? '2px' : '1px'} solid ${borderColor}; padding:8px 12px; margin-bottom:10px; border-radius:2px;`;
    banner.innerHTML = `
        <div style="font-size:8px;color:#e67e22;letter-spacing:1px;font-weight:bold;">🔥 STREAK: ${streak} DIA${streak !== 1 ? 'S' : ''}</div>
        ${progressHtml}
    `;
}

function updateSidebar() {
    // — Missões Fechadas —
    const taskPct  = Math.min((playerData.tasks / targetTasks) * 100, 100);
    const taskBar  = document.getElementById('objTaskBar');
    const taskText = document.getElementById('objTaskText');
    if (taskBar)  {
        taskBar.style.width = taskPct + '%';
        if (taskPct >= 100) taskBar.classList.add('complete');
        else taskBar.classList.remove('complete');
    }
    if (taskText) taskText.innerText = `${playerData.tasks} / ${targetTasks}`;

    // — XP e Gold da sessão —
    const sessionXpEl   = document.getElementById('sessionXp');
    const sessionGoldEl = document.getElementById('sessionGold');
    if (sessionXpEl)   sessionXpEl.innerText   = `+${playerData.farmedXP}`;
    if (sessionGoldEl) sessionGoldEl.innerText = `+${playerData.farmedGold}`;

    // — WIP slots —
    const wipText  = document.getElementById('myWipText');
    const wipSlots = document.querySelectorAll('.wip-slot');
    if (wipText) wipText.innerText = `${currentBoardStats.myWip} / ${WIP_LIMIT}`;
    wipSlots.forEach((slot, i) => {
        slot.classList.toggle('filled', i < currentBoardStats.myWip);
    });

    // — Próximo Nível —
    const _xpMax    = xpParaProximoNivel(playerData.level);
    const xpToLevel = Math.max(0, _xpMax - playerData.xp);
    const xpPct     = Math.min((playerData.xp / _xpMax) * 100, 100);
    const xpToLevelBar = document.getElementById('xpToLevelBar');
    const xpToLevelTxt = document.getElementById('xpToLevelText');
    if (xpToLevelBar) xpToLevelBar.style.width = xpPct + '%';
    if (xpToLevelTxt) xpToLevelTxt.innerText   = `${xpToLevel} XP`;

    // — Saúde da Sprint —
    const healthTodo = document.getElementById('healthTodo');
    const healthWip  = document.getElementById('healthWip');
    const healthDone = document.getElementById('healthDone');
    if (healthTodo) healthTodo.textContent = currentBoardStats.todo;
    if (healthWip)  healthWip.textContent  = currentBoardStats.inProgress;
    if (healthDone) healthDone.textContent = currentBoardStats.done;

    // — SLA Alert banner —
    const banner   = document.getElementById('slaAlertBanner');
    const alertCnt = document.getElementById('slaAlertCount');
    if (banner && alertCnt) {
        if (currentBoardStats.slaAlerts > 0) {
            alertCnt.textContent  = currentBoardStats.slaAlerts;
            banner.style.display  = 'block';
        } else {
            banner.style.display  = 'none';
        }
    }
}

// ==========================================
// 9. MECÂNICA DE MALDIÇÃO
// ==========================================
function applyCurseVisuals(curseType) {
    const cfg = CURSE_CONFIG[curseType] || CURSE_CONFIG.sla_breach;
    playerData.isCursed  = true;
    playerData.curseType = curseType;

    const avatarEl    = document.getElementById('playerAvatar');
    const xpBar       = document.getElementById('xpBar');
    const xpContainer = document.getElementById('xpContainer');
    if (avatarEl) {
        avatarEl.classList.remove('curse-warning');
        avatarEl.classList.add('curse-critical');
        avatarEl.style.outline      = `2px solid ${cfg.color}`;
        avatarEl.style.outlineOffset = '2px';
    }
    if (xpBar) {
        xpBar.classList.remove('curse-warning');
        xpBar.classList.add('curse-critical');
        xpBar.style.background = cfg.color;
    }
    if (xpContainer) xpContainer.classList.add('curse-critical');

    const banner = document.getElementById('curseBanner');
    if (banner) {
        banner.style.cssText = `display:block; background:#0d1b2a; border:2px solid ${cfg.color}; padding:10px 12px; margin-bottom:10px; border-radius:2px;`;
        banner.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                <span style="font-size:18px;line-height:1;">${cfg.icon}</span>
                <span style="font-size:8px;color:${cfg.color};font-weight:bold;letter-spacing:1px;">${cfg.label.toUpperCase()}</span>
            </div>
            <div style="font-size:8px;color:#e67e22;margin-bottom:4px;">⚠ ${cfg.penalty}</div>
            <div style="font-size:7px;color:#7f8c8d;">✨ Cura: ${cfg.cure}</div>
        `;
    }
}

function removeCurseVisuals() {
    playerData.isCursed  = false;
    playerData.curseType = null;

    const avatarEl    = document.getElementById('playerAvatar');
    const xpBar       = document.getElementById('xpBar');
    const xpContainer = document.getElementById('xpContainer');
    if (avatarEl) {
        avatarEl.classList.remove('curse-warning', 'curse-critical');
        avatarEl.style.outline = '';
        avatarEl.style.outlineOffset = '';
    }
    if (xpBar) {
        xpBar.classList.remove('curse-warning', 'curse-critical');
        xpBar.style.background = '';
    }
    if (xpContainer) xpContainer.classList.remove('curse-critical');

    const banner = document.getElementById('curseBanner');
    if (banner) banner.style.display = 'none';
}

async function setPlayerCurseState(state) {
    try {
        await fetch(`${API_URL}/players/curse`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ is_cursed: state })
        });
    } catch (err) {
        console.error('Erro ao sincronizar estado de maldição:', err);
    }
}

// ==========================================
// 10. LEVEL UP ANIMATION
// ==========================================
function showLevelUpAnimation(level) {
    const overlay = document.getElementById('levelUpOverlay');
    const numEl   = document.getElementById('levelUpNumber');
    if (!overlay || !numEl) return;

    numEl.textContent      = level;
    overlay.style.display  = 'flex';

    // Auto-fecha após 4s
    setTimeout(() => {
        overlay.style.display = 'none';
    }, 4000);
}

// ==========================================
// 11. MODAL DE PERFIL (preview rápido)
// ==========================================
window.openProfileModal = () => {
    document.getElementById('profileModal').style.display = 'flex';
    const modalAvatarEl = document.getElementById('modalAvatarPreview');
    modalAvatarEl.src = playerData.avatar;
    applyCurseAvatarClass(modalAvatarEl, playerData.isCursed);

    const nameEl = document.getElementById('modalPlayerName');
    if (nameEl) nameEl.textContent = playerData.name;

    const levelEl = document.getElementById('modalPlayerLevel');
    if (levelEl) levelEl.textContent = `Nível ${playerData.level} · ${GUILD_ICONS[playerData.faction] || '🏰'} ${playerData.faction || ''}`;

    const link = document.getElementById('modalEditPerfilLink');
    if (link && playerData.id) {
        link.href = `perfil.html#${playerData.id}`;
        link.onclick = () => { document.getElementById('profileModal').style.display = 'none'; };
    }

    const curseBannerEl = document.getElementById('modalCurseBanner');
    if (curseBannerEl) {
        const cfg = playerData.curseType ? CURSE_CONFIG[playerData.curseType] : null;
        if (cfg) {
            curseBannerEl.style.cssText = `display:block; background:rgba(0,0,0,0.3); border:1px solid ${cfg.color}; color:${cfg.color}; padding:10px 12px; border-radius:2px; font-size:8px;`;
            curseBannerEl.innerHTML = `${cfg.icon} ${cfg.label} ativa — ${cfg.penalty}`;
        } else {
            curseBannerEl.style.display = 'none';
        }
    }
};

window.closeProfileModal = () => {
    document.getElementById('profileModal').style.display = 'none';
};

// ==========================================
// SUBTASKS — modal do jogador (somente leitura)
// ==========================================
function _renderPlayerSubtasks(quest) {
    const section  = document.getElementById('qdm-subtasks-section');
    const progEl   = document.getElementById('qdm-subtasks-progress');
    const listEl   = document.getElementById('qdm-subtask-list');
    if (!section || !progEl || !listEl) return;

    const canManage = isGuildLeader && quest.faction === playerData.faction;
    const isSubtask = !!quest.parent_id;

    const addBtn = document.getElementById('qdm-subtask-add-btn');
    if (addBtn) addBtn.style.display = (canManage && !isSubtask) ? 'inline-block' : 'none';

    const breadcrumb = document.getElementById('qdm-subtask-parent-breadcrumb');
    if (breadcrumb) {
        if (isSubtask && quest.parent_id) {
            breadcrumb.style.display = 'block';
            breadcrumb.innerHTML = `<span style="font-size:8px;color:#9b59b6;">↩ Quest pai: <button onclick="openQuestModal('${quest.parent_id._id}')" style="background:none;border:none;color:#3498db;font-family:'Press Start 2P',cursive;font-size:8px;cursor:pointer;padding:0;text-decoration:underline;">${_esc(quest.parent_id.title)}</button></span>`;
        } else {
            breadcrumb.style.display = 'none';
            breadcrumb.innerHTML = '';
        }
    }

    const subtasks = quest.subtasks || [];
    const hasContent = subtasks.length > 0 || canManage;
    if (!hasContent) { section.style.display = 'none'; return; }
    section.style.display = 'block';

    const total = subtasks.length;
    const done  = subtasks.filter(s => s.status === 'done').length;
    const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

    const statusColors = { todo: '#2c3e50', in_progress: '#e67e22', done: '#27ae60' };
    const statusLabels = { todo: 'A Fazer', in_progress: 'Em Progresso', done: 'Concluída' };

    progEl.innerHTML = total > 0 ? `
        <div style="display:flex;justify-content:space-between;font-size:8px;color:#7f8c8d;margin-bottom:4px;">
            <span>${done} de ${total} concluídas</span><span>${pct}%</span>
        </div>
        <div style="background:#ddd;height:4px;border-radius:2px;overflow:hidden;">
            <div style="width:${pct}%;height:100%;background:${pct===100?'#27ae60':'#3498db'};"></div>
        </div>` : '<div style="font-size:8px;color:#7f8c8d;">Nenhuma subtask ainda.</div>';

    listEl.innerHTML = subtasks.map(s => {
        const color    = statusColors[s.status] || statusColors.todo;
        const label    = statusLabels[s.status] || 'A Fazer';
        const assignee = s.assigned_to ? (s.assigned_to.nome || s.assigned_to.username) : 'Nenhum herói responsável';
        if (canManage) {
            return `
            <div onclick="openQuestModal('${s._id}')"
                 style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#1a252f;border:1px solid #2c3e50;margin-bottom:4px;cursor:pointer;"
                 onmouseover="this.style.background='#1e3044';this.style.borderColor='#3498db';"
                 onmouseout="this.style.background='#1a252f';this.style.borderColor='#2c3e50';">
                <span style="background:${color};color:#fff;font-size:7px;padding:2px 6px;white-space:nowrap;flex-shrink:0;">${label}</span>
                <span style="flex:1;font-size:9px;color:#ecf0f1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_esc(s.title)}</span>
                <span style="font-size:8px;color:#7f8c8d;white-space:nowrap;flex-shrink:0;">👤 ${_esc(assignee)}</span>
            </div>`;
        }
        return `
        <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#1a252f;border:1px solid #2c3e50;margin-bottom:4px;">
            <span style="background:${color};color:#fff;font-size:7px;padding:2px 6px;white-space:nowrap;flex-shrink:0;">${label}</span>
            <span style="flex:1;font-size:9px;color:#ecf0f1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_esc(s.title)}</span>
            <span style="font-size:8px;color:#7f8c8d;white-space:nowrap;flex-shrink:0;">👤 ${_esc(assignee)}</span>
        </div>`;
    }).join('');
}

window.playerToggleSubtaskForm = () => {
    const form = document.getElementById('qdm-subtask-form');
    if (!form) return;
    const opening = form.style.display === 'none';
    form.style.display = opening ? 'block' : 'none';
    if (!opening) return;

    const sel = document.getElementById('qdm-subtask-assignee-select');
    if (sel && sel.options.length <= 1 && guildMembers.length) {
        sel.innerHTML = '<option value="">👤 Sem atribuição</option>' +
            guildMembers.map(m => `<option value="${m._id}">${_esc(m.nome || m.username)}</option>`).join('');
    }
};

window.playerCreateSubtask = async () => {
    const title       = document.getElementById('qdm-subtask-title-input')?.value.trim();
    const assignee    = document.getElementById('qdm-subtask-assignee-select')?.value;
    const xp_reward   = parseInt(document.getElementById('qdm-subtask-xp-input')?.value || '0', 10) || 0;
    const coin_reward = parseInt(document.getElementById('qdm-subtask-gold-input')?.value || '0', 10) || 0;
    if (!title) { showToast('Informe o título da subtask.', 'error'); return; }

    const questId = document.getElementById('questDetailModal')?.dataset.questId;
    if (!questId) return;

    try {
        const res = await fetch(`${API_URL}/quests/${questId}/subtasks`, {
            method:  'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body:    JSON.stringify({ title, assigned_to: assignee || null, xp_reward, coin_reward })
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.message || 'Erro ao criar subtask.', 'error'); return; }

        document.getElementById('qdm-subtask-title-input').value = '';
        const xpEl   = document.getElementById('qdm-subtask-xp-input');
        const goldEl = document.getElementById('qdm-subtask-gold-input');
        if (xpEl)   xpEl.value   = '0';
        if (goldEl) goldEl.value = '0';
        document.getElementById('qdm-subtask-form').style.display = 'none';
        showToast('Subtask criada!', 'success');

        const freshRes = await fetch(`${API_URL}/quests/${questId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (freshRes.ok) _renderPlayerSubtasks(await freshRes.json());
    } catch {
        showToast('Erro de conexão.', 'error');
    }
};

// ==========================================
// MODAL — EDITAR COLUNAS (LÍDER DE GUILDA)
// ==========================================
let _playerEditCols = [];

window.openPlayerColumnsModal = () => {
    _playerEditCols = kanbanColumns.map(c => ({ ...c }));
    renderPlayerColumnsList();
    document.getElementById('playerEditColumnsModal').style.display = 'flex';
};

window.closePlayerColumnsModal = () => {
    document.getElementById('playerEditColumnsModal').style.display = 'none';
};

function renderPlayerColumnsList() {
    const list = document.getElementById('playerEditColumnsList');
    if (!list) return;
    const total = _playerEditCols.length;
    list.innerHTML = _playerEditCols.map((col, i) => {
        const tag = i === 0 ? 'INÍCIO' : i === total - 1 ? 'FIM' : 'MEIO';
        const tagColor = i === 0 ? '#2980b9' : i === total - 1 ? '#27ae60' : '#e67e22';
        const upDis   = i === 0;
        const downDis = i === total - 1;
        const delDis  = total <= 3;
        return `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding:12px 14px;background:#1a252f;border:2px solid #34495e;">
            <div style="display:flex;flex-direction:column;gap:4px;">
                <button onclick="_playerColUp(${i})"
                        class="btn-pixel" style="font-size:9px;padding:3px 8px;background:#2c3e50;${upDis ? 'opacity:.35;cursor:not-allowed;' : ''}"
                        ${upDis ? 'disabled' : ''}>↑</button>
                <button onclick="_playerColDown(${i})"
                        class="btn-pixel" style="font-size:9px;padding:3px 8px;background:#2c3e50;${downDis ? 'opacity:.35;cursor:not-allowed;' : ''}"
                        ${downDis ? 'disabled' : ''}>↓</button>
            </div>
            <input type="text" value="${col.name}" onchange="_playerEditCols[${i}].name = this.value"
                   class="pixel-input" style="flex:1;font-size:10px;padding:10px 12px;">
            <input type="color" value="${col.color || '#2c3e50'}"
                   oninput="_playerEditCols[${i}].color = this.value"
                   title="Cor da coluna"
                   style="width:32px;height:32px;padding:2px;border:2px solid #34495e;background:#111;cursor:pointer;flex-shrink:0;">
            <span style="font-size:7px;padding:4px 8px;background:${tagColor};color:#fff;white-space:nowrap;flex-shrink:0;min-width:44px;text-align:center;">${tag}</span>
            <button onclick="_playerColDelete(${i})"
                    class="btn-pixel btn-danger" style="font-size:9px;padding:7px 10px;${delDis ? 'opacity:.35;cursor:not-allowed;' : ''}"
                    ${delDis ? 'disabled' : ''}>✕</button>
        </div>`;
    }).join('');
}

window.playerAddNewColumn = () => {
    _playerEditCols.push({ _id: null, name: 'Nova Coluna', order: _playerEditCols.length + 1, color: '#2c3e50', status_map: 'in_progress' });
    renderPlayerColumnsList();
};

window._playerColUp = (i) => {
    if (i <= 0) return;
    [_playerEditCols[i - 1], _playerEditCols[i]] = [_playerEditCols[i], _playerEditCols[i - 1]];
    renderPlayerColumnsList();
};

window._playerColDown = (i) => {
    if (i >= _playerEditCols.length - 1) return;
    [_playerEditCols[i], _playerEditCols[i + 1]] = [_playerEditCols[i + 1], _playerEditCols[i]];
    renderPlayerColumnsList();
};

window._playerColDelete = (i) => {
    if (_playerEditCols.length <= 3) return;
    _playerEditCols.splice(i, 1);
    renderPlayerColumnsList();
};

window.savePlayerColumnsEdit = async () => {
    const btn = document.querySelector('[data-cy="btn-player-save-columns"]');
    if (btn) btn.disabled = true;
    try {
        // Deleta colunas que existiam no banco mas foram removidas localmente
        const editIds = new Set(_playerEditCols.filter(c => c._id).map(c => String(c._id)));
        const toDelete = kanbanColumns.filter(c => !editIds.has(String(c._id)));
        for (const col of toDelete) {
            await fetch(`${API_URL}/guild/columns/${col._id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        }

        const total = _playerEditCols.length;
        for (let i = 0; i < total; i++) {
            const col = { ..._playerEditCols[i], order: i + 1 };
            // colunas existentes mantêm status_map; novas recebem derivação por posição
            if (!col._id) {
                col.status_map = i === 0 ? 'todo' : i === total - 1 ? 'done' : 'in_progress';
            }
            if (col._id) {
                await fetch(`${API_URL}/guild/columns/${col._id}`, {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: col.name, order: col.order, status_map: col.status_map, color: col.color })
                });
            } else {
                await fetch(`${API_URL}/guild/columns`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: col.name, order: col.order, status_map: col.status_map, color: col.color || '#2c3e50' })
                });
            }
        }
        closePlayerColumnsModal();
        await fetchKanbanColumns();
        await loadBoard();
        showToast('Colunas atualizadas com sucesso!');
    } catch {
        showToast('Erro ao salvar colunas.', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
};
