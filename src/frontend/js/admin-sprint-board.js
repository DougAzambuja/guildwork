// ==========================================
// 0. PROTEÇÃO E INICIALIZAÇÃO
// ==========================================
const token    = localStorage.getItem('guild_token');
const params   = new URLSearchParams(window.location.search);
// serve (npx serve) dropa query string no redirect de *.html → *.
// Lemos do query param primeiro; sessionStorage é o fallback.
const sprintId = params.get('id') || sessionStorage.getItem('admin_board_sprint_id') || null;

let allQuests        = [];
let allSprints       = [];
let allGuilds        = [];
let sprintFactions   = []; // Facções da sprint carregada — filtra as abas de guilda
let boardColumns     = [];
let boardGuildMembers = []; // Membros da guilda selecionada — usado no seletor de responsável
// Guarda contra sessionStorage com valor '' ou string 'null' de testes anteriores
const _rawGuildId  = sessionStorage.getItem('admin_board_guild');
let currentGuildId = (_rawGuildId && _rawGuildId !== 'null') ? _rawGuildId : null;

document.addEventListener('DOMContentLoaded', () => {
    if (!token || localStorage.getItem('guild_role') !== 'admin') {
        window.location.href = 'login.html';
        return;
    }

    if (!sprintId) {
        window.location.href = 'admin-sprints.html';
        return;
    }

    showLoadingState();
    // Carrega em paralelo: board da sprint, lista de sprints e lista de guildas
    Promise.all([loadSprintBoard(), loadAllSprints(), loadAllGuilds()]);
});

function showLoadingState() {
    const board = document.getElementById('kanbanBoard');
    if (!board) return;
    if (boardColumns.length) {
        boardColumns.forEach(col => {
            const el = document.getElementById(`cards-${col._id}`);
            if (el) el.innerHTML = '<div style="font-size:7px;color:#4a5568;padding:16px 0;text-align:center;">Carregando...</div>';
        });
    } else {
        board.innerHTML = '<div style="font-size:7px;color:#4a5568;padding:24px;text-align:center;">Carregando board...</div>';
    }
}

async function fetchBoardColumns(guildId) {
    if (!guildId) {
        // Admin sem guilda selecionada: usa fallback sem chamar API
        boardColumns = [];
        renderBoardKanbanStructure();
        return;
    }
    try {
        const res = await fetch(`${API_URL}/guild/columns?guild_id=${guildId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) boardColumns = await res.json();
    } catch (err) {
        console.error('Erro ao buscar colunas do board:', err);
    }
    renderBoardKanbanStructure(); // sempre renderiza
}

async function fetchBoardGuildMembers() {
    if (!currentGuildId) { boardGuildMembers = []; return; }
    try {
        const guild = allGuilds.find(g => String(g._id) === String(currentGuildId));
        if (!guild) { boardGuildMembers = []; return; }
        const res = await fetch(`${API_URL}/admin/roster`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) { boardGuildMembers = []; return; }
        const all = await res.json();
        boardGuildMembers = all.filter(u => u.faction === guild.faction_key);
    } catch {
        boardGuildMembers = [];
    }
}

function renderBoardKanbanStructure() {
    const board = document.getElementById('kanbanBoard');
    if (!board) return;

    const cols = boardColumns.length ? boardColumns : [
        { _id: 'todo',        name: 'A Fazer',      color: '#3498db', status_map: 'todo'        },
        { _id: 'in_progress', name: 'Em Progresso', color: '#e67e22', status_map: 'in_progress' },
        { _id: 'done',        name: 'Concluídas',   color: '#27ae60', status_map: 'done'        }
    ];

    board.innerHTML = cols.map(col => {
        const sortVal = _colSortState[String(col._id)] || '';
        const sortOpts = [
            ['', '⇅'],
            ['title_asc',  'A→Z'],
            ['title_desc', 'Z→A'],
            ['xp_desc',    'XP ↓'],
            ['xp_asc',     'XP ↑'],
            ['gold_desc',  'Gold ↓'],
            ['gold_asc',   'Gold ↑'],
        ].map(([v, l]) => `<option value="${v}"${sortVal === v ? ' selected' : ''}>${l}</option>`).join('');
        return `
        <div class="kanban-col" id="col-${col._id}" data-col-id="${col._id}">
            <div class="kanban-col-header" style="border-bottom:2px solid ${col.color};">
                <span class="kanban-col-title" style="color:${col.color};">${col.name.toUpperCase()}</span>
                <div style="display:flex;align-items:center;gap:6px;">
                    <select class="col-sort-select" data-cy="select-col-sort-${col._id}"
                            onchange="_setColSort('${col._id}', this.value)">${sortOpts}</select>
                    <span class="kanban-count" id="count-${col._id}">0</span>
                </div>
            </div>
            <div id="cards-${col._id}" class="kanban-cards-body" data-col-id="${col._id}"></div>
        </div>`;
    }).join('');
}

// ==========================================
// 1. CONFIGURAÇÕES
// ==========================================
const SORT_FUNCS = {
    title_asc:  (a, b) => a.title.localeCompare(b.title),
    title_desc: (a, b) => b.title.localeCompare(a.title),
    xp_desc:    (a, b) => (b.xp_reward  || 0) - (a.xp_reward  || 0),
    xp_asc:     (a, b) => (a.xp_reward  || 0) - (b.xp_reward  || 0),
    gold_desc:  (a, b) => (b.coin_reward || 0) - (a.coin_reward || 0),
    gold_asc:   (a, b) => (a.coin_reward || 0) - (b.coin_reward || 0),
};

let _colSortState = {}; // { [colId]: sortKey }

window._setColSort = (colId, value) => {
    _colSortState[String(colId)] = value;
    renderKanban();
};

const HEALTH_CONFIG = {
    on_track: { label: '✅ NO RITMO',  color: '#27ae60' },
    at_risk:  { label: '⚠️ EM RISCO',  color: '#e67e22' },
    behind:   { label: '🚨 ATRASADA',  color: '#e74c3c' }
};

const SPRINT_STATUS_LABELS = {
    planning:  { label: 'Planning',  color: '#3498db' },
    active:    { label: 'Ativa',     color: '#27ae60' },
    completed: { label: 'Concluída', color: '#7f8c8d' },
    cancelled: { label: 'Cancelada', color: '#e74c3c' }
};

const FACTION_ICONS = { Produto: '📦', Suporte: '🎧', 'Customer Service': '📣' };
const TYPE_LABELS   = { normal: 'Normal', urgent: '⚡ Urgente', support: '🎧 Suporte', jira: 'Jira' };

// ==========================================
// 2. CARREGAR BOARD
// ==========================================
async function loadSprintBoard() {
    try {
        const url = currentGuildId
            ? `${API_URL}/sprints/${sprintId}?guild_id=${currentGuildId}`
            : `${API_URL}/sprints/${sprintId}`;

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            // Se o guild_id em sessão apontava para uma guilda excluída, limpa e retenta
            if (res.status === 404 && currentGuildId && err.message?.includes('Guilda')) {
                currentGuildId = null;
                sessionStorage.removeItem('admin_board_guild');
                renderGuildTabs();
                return loadSprintBoard();
            }
            showToast(err.message || 'Sprint não encontrada.', 'error');
            showError('Sprint não encontrada ou sem acesso.');
            return;
        }

        const data = await res.json();

        if (!data || !data.sprint) {
            showError('Dados da sprint inválidos.');
            return;
        }

        allQuests      = Array.isArray(data.quests) ? data.quests : [];
        sprintFactions = Array.isArray(data.sprint.factions) ? data.sprint.factions : [];

        await Promise.all([
            fetchBoardColumns(currentGuildId),
            fetchBoardGuildMembers()
        ]);
        renderSprintHeader(data);
        renderKanban();
        // Re-renderiza abas de guilda após conhecer as facções da sprint
        renderGuildTabs();

        // Canvas precisa de layout pronto — usa rAF
        requestAnimationFrame(() => loadBurndown());

    } catch (err) {
        console.error('[Board] Erro ao carregar sprint:', err);
        showToast('Erro de conexão com o servidor.', 'error');
        showError('Erro ao conectar com o servidor.');
    }
}

function showError(msg) {
    const titleEl = document.getElementById('sprintTitle');
    if (titleEl) titleEl.textContent = 'Erro ao carregar';

    const board = document.getElementById('kanbanBoard');
    if (board) {
        const targets = boardColumns.length
            ? boardColumns.map(col => document.getElementById(`cards-${col._id}`)).filter(Boolean)
            : [board];
        targets.forEach(el => {
            el.innerHTML = `<div style="font-size:7px;color:#e74c3c;padding:10px;">${msg}</div>`;
        });
    }
}

// ==========================================
// 3. HEADER DA SPRINT
// ==========================================
function renderSprintHeader({ sprint, metrics }) {
    document.title = `GuildWork — ${sprint.name}`;

    const titleEl = document.getElementById('sprintTitle');
    if (titleEl) titleEl.textContent = sprint.name;

    const fmt = d => new Date(d).toLocaleDateString('pt-BR');
    const metaEl = document.getElementById('sprintMeta');
    if (metaEl) {
        metaEl.innerHTML = `
            <span>📅 <strong>${fmt(sprint.start_date)} → ${fmt(sprint.end_date)}</strong></span>
            <span>⏱️ <strong>${sprint.duration_days} dias</strong></span>
            ${sprint.goal ? `<span>🎯 <strong>${sprint.goal}</strong></span>` : ''}
            <span>💎 <strong>${(metrics.total_xp || 0).toLocaleString('pt-BR')} XP</strong></span>
            <span>💰 <strong>${(metrics.total_coins || 0).toLocaleString('pt-BR')} Gold</strong></span>
        `;
    }

    const health = HEALTH_CONFIG[metrics.health_score];
    if (health) {
        const badge = document.getElementById('sprintHealthBadge');
        if (badge) {
            badge.textContent      = health.label;
            badge.style.background = health.color;
        }
    }

    const stCfg = SPRINT_STATUS_LABELS[sprint.status] || SPRINT_STATUS_LABELS.planning;
    const stBadge = document.getElementById('sprintStatusBadge');
    if (stBadge) {
        stBadge.textContent      = stCfg.label;
        stBadge.style.background = stCfg.color;
    }

    const timePct       = metrics.time_pct       || 0;
    const completionPct = metrics.completion_pct || 0;

    const timePctLabel  = document.getElementById('timePctLabel');
    const timeBar       = document.getElementById('timeBar');
    const compPctLabel  = document.getElementById('completionPctLabel');
    const compBar       = document.getElementById('completionBar');

    if (timePctLabel) timePctLabel.textContent = `${timePct}%`;
    if (timeBar)      timeBar.style.width      = `${timePct}%`;
    if (compPctLabel) compPctLabel.textContent = `${completionPct}%`;
    if (compBar)      compBar.style.width      = `${completionPct}%`;
}

// ==========================================
// 4. KANBAN
// ==========================================
function renderKanban() {
    const cols = boardColumns.length ? boardColumns : [
        { _id: 'todo',        status_map: 'todo'        },
        { _id: 'in_progress', status_map: 'in_progress' },
        { _id: 'done',        status_map: 'done'        }
    ];

    // Agrupa por column_id (precedência) ou fallback por status
    const byColumn = {};
    cols.forEach(col => { byColumn[String(col._id)] = []; });

    allQuests.forEach(q => {
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
        const colId   = String(col._id);
        const quests  = byColumn[colId] || [];
        const sortKey = _colSortState[colId] || '';
        const sorted  = sortKey
            ? [...quests].sort(SORT_FUNCS[sortKey] || (() => 0))
            : [...quests].sort((a, b) => (a.card_order ?? Infinity) - (b.card_order ?? Infinity));

        const countEl = document.getElementById(`count-${col._id}`);
        const cardsEl = document.getElementById(`cards-${col._id}`);
        if (countEl) countEl.textContent = sorted.length;
        if (cardsEl) {
            cardsEl.innerHTML = sorted.length
                ? sorted.map(q => renderQuestCard(q)).join('')
                : emptyColumn();
        }
    });

    initBoardDnD();
}

function emptyColumn() {
    return '<div style="font-size:7px;color:#4a5568;text-align:center;padding:20px 0;">Nenhuma quest</div>';
}

// ─── Drag-and-drop ────────────────────────────────────────────────────────────
let _dndBoardReady = false;
let _dndDraggedId  = null;

function _dndClearIndicators(board) {
    board.querySelectorAll('.kanban-col.dnd-over').forEach(el => el.classList.remove('dnd-over'));
    board.querySelectorAll('.quest-card.dnd-before, .quest-card.dnd-after').forEach(el => {
        el.classList.remove('dnd-before', 'dnd-after');
    });
}

function initBoardDnD() {
    const board = document.getElementById('kanbanBoard');
    if (!board || _dndBoardReady) return;
    _dndBoardReady = true;

    board.addEventListener('dragstart', e => {
        const card = e.target.closest('.quest-card[draggable="true"]');
        if (!card) return;
        _dndDraggedId = card.dataset.id;
        e.dataTransfer.setData('text/plain', card.dataset.id);
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => card.classList.add('dragging'), 0);
    });

    board.addEventListener('dragend', e => {
        const card = e.target.closest('.quest-card');
        if (card) card.classList.remove('dragging');
        _dndClearIndicators(board);
        _dndDraggedId = null;
    });

    board.addEventListener('dragover', e => {
        const col = e.target.closest('.kanban-col');
        if (!col) return;
        e.preventDefault();

        const targetCard = e.target.closest('.quest-card');

        if (targetCard && targetCard.dataset.id !== _dndDraggedId) {
            // Within-column reorder: indicador de inserção
            board.querySelectorAll('.kanban-col.dnd-over').forEach(el => el.classList.remove('dnd-over'));
            board.querySelectorAll('.quest-card.dnd-before, .quest-card.dnd-after').forEach(el => {
                if (el !== targetCard) el.classList.remove('dnd-before', 'dnd-after');
            });
            const rect   = targetCard.getBoundingClientRect();
            const before = e.clientY < rect.top + rect.height / 2;
            targetCard.classList.toggle('dnd-before', before);
            targetCard.classList.toggle('dnd-after',  !before);
        } else {
            // Mover para outra coluna: destaca a coluna inteira
            board.querySelectorAll('.quest-card.dnd-before, .quest-card.dnd-after').forEach(el => {
                el.classList.remove('dnd-before', 'dnd-after');
            });
            board.querySelectorAll('.kanban-col.dnd-over').forEach(el => { if (el !== col) el.classList.remove('dnd-over'); });
            col.classList.add('dnd-over');
        }
    });

    board.addEventListener('dragleave', e => {
        const col = e.target.closest('.kanban-col');
        if (col && !col.contains(e.relatedTarget)) {
            col.classList.remove('dnd-over');
            col.querySelectorAll('.quest-card.dnd-before, .quest-card.dnd-after').forEach(el => {
                el.classList.remove('dnd-before', 'dnd-after');
            });
        }
    });

    board.addEventListener('drop', async e => {
        const col = e.target.closest('.kanban-col');
        if (!col) return;
        e.preventDefault();
        _dndClearIndicators(board);

        const questId    = e.dataTransfer.getData('text/plain');
        const zone       = col.querySelector('.kanban-cards-body');
        const columnId   = zone?.dataset.colId;
        if (!questId || !columnId) return;

        const targetCard = e.target.closest('.quest-card');
        if (targetCard && targetCard.dataset.id !== questId) {
            // Reorder dentro da coluna (ou mover para coluna + posicionar)
            const rect         = targetCard.getBoundingClientRect();
            const insertBefore = e.clientY < rect.top + rect.height / 2;
            await dndReorderCard(questId, columnId, targetCard.dataset.id, insertBefore);
        } else {
            // Mover entre colunas
            const quest = allQuests.find(q => String(q._id) === String(questId));
            if (quest && String(quest.column_id) === String(columnId)) return;
            await dndMoveAdminCard(questId, columnId);
        }
    });
}

async function dndReorderCard(questId, columnId, targetCardId, insertBefore) {
    const quest = allQuests.find(q => String(q._id) === String(questId));
    const isCrossColumn = quest && String(quest.column_id) !== String(columnId);

    if (isCrossColumn) {
        // Mover para outra coluna: não reordena, apenas move
        await dndMoveAdminCard(questId, columnId);
        return;
    }

    // Coleta a ordem atual visível na coluna
    const cardEls   = document.querySelectorAll(`#cards-${columnId} .quest-card`);
    const orderedIds = Array.from(cardEls).map(el => el.dataset.id);

    const from = orderedIds.indexOf(questId);
    if (from !== -1) orderedIds.splice(from, 1);

    let to = orderedIds.indexOf(targetCardId);
    if (to === -1) return;
    if (!insertBefore) to++;
    orderedIds.splice(to, 0, questId);

    try {
        const updates = orderedIds.map((id, idx) => ({ _id: id, card_order: idx }));
        const res = await fetch(`${API_URL}/quests/reorder-in-column`, {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body:    JSON.stringify({ updates })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            showToast(err.message || 'Erro ao reordenar.', 'error');
            return;
        }
        // Atualiza estado local sem precisar de reload completo
        orderedIds.forEach((id, idx) => {
            const q = allQuests.find(q => String(q._id) === id);
            if (q) q.card_order = idx;
        });
        renderKanban();
    } catch {
        showToast('Erro de conexão.', 'error');
    }
}

async function dndMoveAdminCard(questId, columnId) {
    try {
        const res = await fetch(`${API_URL}/quests/${questId}/move-column`, {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body:    JSON.stringify({ column_id: columnId })
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.message || 'Erro ao mover quest.', 'error'); return; }
        const col = boardColumns.find(c => String(c._id) === String(columnId));
        showToast(`Quest movida para "${col?.name || 'coluna'}".`);
        await loadSprintBoard();
    } catch {
        showToast('Erro de conexão.', 'error');
    }
}
// ─────────────────────────────────────────────────────────────────────────────

function renderQuestCard(q) {
    const qId          = String(q._id);
    const assigneeName = q.assigned_to ? (q.assigned_to.nome || q.assigned_to.username || '—') : null;
    const factionIcon  = FACTION_ICONS[q.faction] || '🏰';
    const typeKey      = q.type || 'normal';
    const faction      = (q.faction || 'Produto').replace(/'/g, "\\'");

    return `
        <div class="quest-card" draggable="true" data-status="${q.status}" data-cy="quest-card" data-id="${qId}">
            <span class="kanban-type-badge badge-${typeKey}" style="margin-bottom:5px;">${(TYPE_LABELS[typeKey] || typeKey).toUpperCase()}</span>
            <div class="quest-card-title">${q.title}</div>
            <div class="quest-card-meta">
                <span class="quest-tag faction">${factionIcon} ${q.faction || 'Produto'}</span>
                <span class="quest-tag xp">+${q.xp_reward || 0} XP</span>
                <span class="quest-tag gold">💰 ${q.coin_reward || 0}</span>
                ${assigneeName ? `<span class="quest-tag assignee">👤 ${assigneeName}</span>` : ''}
                ${(q.subtasks_total > 0) ? `<span class="quest-tag" style="background:#8e44ad;color:#fff;" data-cy="subtask-badge">[${q.subtasks_done || 0}/${q.subtasks_total}]</span>` : ''}
            </div>
            <div class="quest-card-actions">
                <button class="quest-action-btn detail" data-cy="btn-card-details"
                    onclick="openBoardQuestDetail('${qId}')">👁 Detalhes</button>
                <button class="quest-action-btn" data-cy="btn-card-transfer-sprint"
                    onclick="openTransferSprint('${qId}')">🔀 Sprint</button>
                <button class="quest-action-btn" data-cy="btn-card-transfer-faction"
                    onclick="openTransferFaction('${qId}', '${faction}')">🏰 Guilda</button>
                <button class="quest-action-btn copy" data-cy="btn-card-copy-quest"
                    onclick="openCopyQuest('${qId}')">📋 Copiar</button>
                <button class="quest-action-btn remove" data-cy="btn-card-remove-quest"
                    onclick="openRemoveQuest('${qId}')">✖</button>
            </div>
        </div>
    `;
}

// ==========================================
// 5. FILTRO DE GUILDA (server-side)
// ==========================================
// GUILD_ICONS já está disponível globalmente via utils.js

async function loadAllGuilds() {
    try {
        const res = await fetch(`${API_URL}/guild/all`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        allGuilds = await res.json();
        renderGuildTabs();
    } catch (err) {
        console.error('[Board] Erro ao carregar guildas:', err);
    }
}

function renderGuildTabs() {
    const container = document.getElementById('guildFilters');
    if (!container) return;

    // Exibe somente as guildas associadas às facções da sprint
    const visibleGuilds = sprintFactions.length
        ? allGuilds.filter(g => sprintFactions.includes(g.faction_key))
        : allGuilds;

    // Omite "Todas" quando só há uma guilda — não há nada para alternar
    const showAll = visibleGuilds.length > 1;
    const allBtn  = showAll
        ? `<button class="faction-filter-btn${!currentGuildId ? ' active' : ''}" data-cy="filter-all-guilds" onclick="setGuildFilter(null, this)">🏰 Todas</button>`
        : '';

    const guildBtns = visibleGuilds.map(g => {
        const icon     = GUILD_ICONS[g.faction_key] || '🏰';
        const isActive = currentGuildId === String(g._id);
        return `<button class="faction-filter-btn${isActive ? ' active' : ''}"
                    data-cy="filter-guild-${g._id}"
                    data-guild-id="${g._id}"
                    onclick="setGuildFilter('${g._id}', this)">
                    ${icon} ${g.name}
                </button>`;
    }).join('');

    container.innerHTML = allBtn + guildBtns;
}

window.setGuildFilter = async (guildId, btn) => {
    currentGuildId = guildId || null;
    sessionStorage.setItem('admin_board_guild', currentGuildId || '');
    document.querySelectorAll('.faction-filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    showLoadingState();
    await loadSprintBoard();
};

// ==========================================
// 6. BURNDOWN CHART (#23)
// ==========================================
async function loadBurndown() {
    try {
        const res = await fetch(`${API_URL}/sprints/${sprintId}/burndown`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) return;
        const data = await res.json();

        // Garante que o layout está pronto antes de medir o canvas
        requestAnimationFrame(() => renderBurndownChart(data));
    } catch (err) {
        console.error('[Board] Erro ao carregar burndown:', err);
    }
}

function renderBurndownChart({ labels, ideal_line, actual_line, total_quests }) {
    const canvas = document.getElementById('burndownCanvas');
    if (!canvas) return;

    const wrapper = canvas.parentElement;
    const W = Math.max(wrapper.clientWidth - 32, 200);
    const H = 220;
    canvas.width  = W;
    canvas.height = H;

    const ctx = canvas.getContext('2d');
    const PAD = { top: 20, right: 20, bottom: 36, left: 44 };
    const cW  = W - PAD.left - PAD.right;
    const cH  = H - PAD.top  - PAD.bottom;

    const maxY      = Math.max(total_quests || 1, 1);
    const pts       = (labels || []).length;
    // Evita labels duplicadas no eixo Y quando total de quests é pequeno
    const gridLines = Math.min(5, maxY);

    ctx.clearRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = '#1e2d3d';
    ctx.lineWidth   = 1;
    for (let i = 0; i <= gridLines; i++) {
        const y = PAD.top + (cH / gridLines) * i;
        ctx.beginPath();
        ctx.moveTo(PAD.left, y);
        ctx.lineTo(PAD.left + cW, y);
        ctx.stroke();

        const val = Math.round(maxY - (maxY / gridLines) * i);
        ctx.fillStyle  = '#7f8c8d';
        ctx.font       = '9px monospace';
        ctx.textAlign  = 'right';
        ctx.fillText(val, PAD.left - 6, y + 3);
    }

    // Eixos
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(PAD.left, PAD.top);
    ctx.lineTo(PAD.left, PAD.top + cH);
    ctx.lineTo(PAD.left + cW, PAD.top + cH);
    ctx.stroke();

    if (pts === 0) {
        ctx.fillStyle = '#7f8c8d';
        ctx.font      = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Sem dados de burndown ainda', PAD.left + cW / 2, PAD.top + cH / 2);
        return;
    }

    const xStep = pts > 1 ? cW / (pts - 1) : cW;
    const toX   = i => PAD.left + i * xStep;
    const toY   = v => PAD.top + cH - Math.max(0, Math.min(v / maxY, 1)) * cH;

    // Linha ideal (tracejada, azul)
    ctx.strokeStyle = '#3498db';
    ctx.lineWidth   = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    (ideal_line || []).forEach((v, i) => {
        if (i === 0) ctx.moveTo(toX(i), toY(v));
        else         ctx.lineTo(toX(i), toY(v));
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Linha real (vermelha, preenchida) — dias futuros chegam como null, são ignorados
    const actual   = actual_line || [];
    const lastReal = actual.reduce((last, v, i) => v !== null ? i : last, -1);
    if (lastReal >= 0) {
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth   = 2;
        ctx.beginPath();
        let started = false;
        actual.forEach((v, i) => {
            if (v === null) return;
            if (!started) { ctx.moveTo(toX(i), toY(v)); started = true; }
            else          { ctx.lineTo(toX(i), toY(v)); }
        });
        ctx.stroke();

        // Preenchimento sob a linha real (até o último dia com dado real)
        ctx.beginPath();
        started = false;
        actual.forEach((v, i) => {
            if (v === null) return;
            if (!started) { ctx.moveTo(toX(i), toY(v)); started = true; }
            else          { ctx.lineTo(toX(i), toY(v)); }
        });
        ctx.lineTo(toX(lastReal), PAD.top + cH);
        ctx.lineTo(toX(0), PAD.top + cH);
        ctx.closePath();
        ctx.fillStyle = 'rgba(231,76,60,0.10)';
        ctx.fill();

        // Pontos na linha real (somente dias com valor não-null)
        ctx.fillStyle = '#e74c3c';
        actual.forEach((v, i) => {
            if (v === null) return;
            ctx.beginPath();
            ctx.arc(toX(i), toY(v), 3, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // Labels do eixo X (mostra no máximo 10 labels)
    ctx.fillStyle  = '#7f8c8d';
    ctx.font       = '8px monospace';
    ctx.textAlign  = 'center';
    const skip = Math.max(1, Math.ceil(pts / 10));
    (labels || []).forEach((label, i) => {
        if (i % skip === 0 || i === pts - 1) {
            ctx.fillText(label, toX(i), PAD.top + cH + 18);
        }
    });
}

// ==========================================
// 7. MODAL — MOVER SPRINT
// ==========================================
window.openTransferSprint = (questId) => {
    document.getElementById('transferQuestId').value = questId;

    const select = document.getElementById('transferSprintSelect');
    select.innerHTML = '<option value="">🗂️ Backlog (sem sprint)</option>' +
        allSprints
            .filter(s => String(s._id) !== sprintId && s.status !== 'cancelled')
            .map(s => {
                const cfg = SPRINT_STATUS_LABELS[s.status] || {};
                return `<option value="${s._id}">[${cfg.label || s.status}] ${s.name}</option>`;
            })
            .join('');

    document.getElementById('modalTransferSprint').style.display = 'flex';
};

window.confirmTransferSprint = async () => {
    const questId  = document.getElementById('transferQuestId').value;
    const targetId = document.getElementById('transferSprintSelect').value;

    try {
        const res = await fetch(`${API_URL}/quests/${questId}/transfer`, {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body:    JSON.stringify({ sprint_id: targetId || null })
        });

        if (res.ok) {
            closeModal('modalTransferSprint');
            showToast('Quest movida para a sprint!');
            await loadSprintBoard();
        } else {
            const err = await res.json().catch(() => ({}));
            showToast(err.message || 'Erro ao mover quest.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Erro de conexão.', 'error');
    }
};

// ==========================================
// 8. MODAL — TRANSFERIR GUILDA
// ==========================================
window.openTransferFaction = (questId, currentFaction) => {
    document.getElementById('transferFactionQuestId').value = questId;
    const sel = document.getElementById('transferFactionSelect');
    if (sel) sel.value = currentFaction || 'Produto';
    document.getElementById('modalTransferFaction').style.display = 'flex';
};

window.confirmTransferFaction = async () => {
    const questId = document.getElementById('transferFactionQuestId').value;
    const faction = document.getElementById('transferFactionSelect').value;

    try {
        const res = await fetch(`${API_URL}/quests/${questId}/transfer`, {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body:    JSON.stringify({ faction })
        });

        if (res.ok) {
            closeModal('modalTransferFaction');
            showToast('Quest transferida de guilda!');
            await loadSprintBoard();
        } else {
            const err = await res.json().catch(() => ({}));
            showToast(err.message || 'Erro ao transferir quest.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Erro de conexão.', 'error');
    }
};

// ==========================================
// 9. MODAL — COPIAR QUEST
// ==========================================
window.openCopyQuest = (questId) => {
    document.getElementById('copyQuestId').value = questId;

    const select = document.getElementById('copySprintSelect');
    select.innerHTML = '<option value="">🗂️ Backlog (sem sprint)</option>' +
        allSprints
            .filter(s => s.status !== 'cancelled')
            .map(s => {
                const cfg     = SPRINT_STATUS_LABELS[s.status] || {};
                const sel     = String(s._id) === sprintId ? ' selected' : '';
                return `<option value="${s._id}"${sel}>[${cfg.label || s.status}] ${s.name}</option>`;
            })
            .join('');

    document.getElementById('copyFactionSelect').value = '';
    document.getElementById('modalCopyQuest').style.display = 'flex';
};

window.confirmCopyQuest = async () => {
    const questId   = document.getElementById('copyQuestId').value;
    const sprintDst = document.getElementById('copySprintSelect').value;
    const faction   = document.getElementById('copyFactionSelect').value;

    const payload = { sprint_id: sprintDst || null };
    if (faction) payload.faction = faction;

    try {
        const res = await fetch(`${API_URL}/quests/${questId}/copy`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body:    JSON.stringify(payload)
        });

        if (res.ok) {
            closeModal('modalCopyQuest');
            showToast('Quest copiada com sucesso!');
            await loadSprintBoard();
        } else {
            const err = await res.json().catch(() => ({}));
            showToast(err.message || 'Erro ao copiar quest.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Erro de conexão.', 'error');
    }
};

// ==========================================
// 10. MODAL — REMOVER DA SPRINT
// ==========================================
window.openRemoveQuest = (questId) => {
    document.getElementById('removeQuestId').value = questId;
    document.getElementById('modalRemoveQuest').style.display = 'flex';
};

window.confirmRemoveQuest = async () => {
    const questId = document.getElementById('removeQuestId').value;

    try {
        const res = await fetch(`${API_URL}/sprints/${sprintId}/quests/${questId}`, {
            method:  'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            closeModal('modalRemoveQuest');
            showToast('Quest removida da sprint.');
            await loadSprintBoard();
        } else {
            const err = await res.json().catch(() => ({}));
            showToast(err.message || 'Erro ao remover quest.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Erro de conexão.', 'error');
    }
};

// ==========================================
// 11. AUXILIARES
// ==========================================
window.closeModal = (id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
};

async function loadAllSprints() {
    try {
        const res = await fetch(`${API_URL}/sprints`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) allSprints = await res.json();
    } catch (err) {
        console.error('[Board] Erro ao carregar lista de sprints:', err);
    }
}

// Redimensiona o canvas se a janela mudar de tamanho
window.addEventListener('resize', () => {
    if (allQuests.length >= 0) requestAnimationFrame(() => loadBurndown());
});

// ==========================================
// 12. MODAL — DETALHE DA QUEST
// ==========================================
let _boardDetailQuestId = null;

const _B_STATUS = {
    todo:        { label: 'A FAZER',   color: '#2980b9' },
    in_progress: { label: 'PROGRESSO', color: '#e67e22' },
    done:        { label: 'CONCLUÍDA', color: '#27ae60' }
};

function _bEsc(str) {
    return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _bTimeAgo(iso) {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}d atrás`;
    if (h > 0) return `${h}h atrás`;
    if (m > 0) return `${m}min atrás`;
    return 'agora';
}

function _bFormatSla(seconds) {
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

window.openBoardQuestDetail = async (questId) => {
    _boardDetailQuestId = questId;
    const modal = document.getElementById('modalBoardQuestDetail');
    if (!modal) return;
    modal.style.display = 'flex';

    const commentsEl = document.getElementById('bqd-comments');
    if (commentsEl) commentsEl.innerHTML = '<div style="color:#7f8c8d;font-size:8px;text-align:center;padding:10px;">Carregando...</div>';

    try {
        const res = await fetch(`${API_URL}/quests/${questId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) { showToast('Erro ao carregar quest.', 'error'); return; }
        renderBoardQuestDetail(await res.json());
    } catch (err) {
        console.error(err);
        showToast('Erro de conexão.', 'error');
    }
};

window.closeBoardQuestDetail = () => {
    const modal = document.getElementById('modalBoardQuestDetail');
    if (modal) modal.style.display = 'none';
    _boardDetailQuestId = null;
};

window.moveAdminCardToColumn = async () => {
    const questId  = _boardDetailQuestId;
    const columnId = document.getElementById('bqd-move-column-select')?.value;
    if (!questId || !columnId) return;

    const btn = document.querySelector('[data-cy="btn-admin-move-column"]');
    if (btn) btn.disabled = true;

    try {
        const res = await fetch(`${API_URL}/quests/${questId}/move-column`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ column_id: columnId })
        });
        const data = await res.json();
        if (!res.ok) {
            showToast(data.message || 'Erro ao mover quest.', 'error');
            return;
        }
        const col = boardColumns.find(c => String(c._id) === String(columnId));
        showToast(`Quest movida para "${col?.name || 'coluna'}".`);
        closeBoardQuestDetail();
        await loadSprintBoard();
    } catch {
        showToast('Erro de conexão.', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
};

window.saveAdminQuestAssignee = async () => {
    const questId = _boardDetailQuestId;
    const userId  = document.getElementById('bqd-assignee-select')?.value || null;
    if (!questId) return;

    const btn = document.querySelector('[data-cy="btn-admin-save-assignee"]');
    if (btn) btn.disabled = true;

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
            ? (boardGuildMembers.find(m => String(m._id) === String(userId))?.nome || '—')
            : 'nenhum';
        showToast(`Responsável atualizado: ${memberName}.`);
        closeBoardQuestDetail();
        await loadSprintBoard();
    } catch {
        showToast('Erro de conexão.', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
};

function renderBoardQuestDetail(quest) {
    const typeBadge = document.getElementById('bqd-type-badge');
    if (typeBadge) {
        typeBadge.innerHTML = `<span class="status-badge" style="font-size:7px;padding:2px 8px;background:#2c3e50;">${(TYPE_LABELS[quest.type] || quest.type || 'normal').toUpperCase()}</span>`;
    }

    const titleEl = document.getElementById('bqd-title');
    if (titleEl) titleEl.textContent = quest.title;

    const parentBreadcrumb = document.getElementById('bqd-parent-breadcrumb');
    if (parentBreadcrumb) {
        if (quest.parent_id) {
            parentBreadcrumb.style.display = 'block';
            parentBreadcrumb.innerHTML = `<span style="font-size:7px;color:#9b59b6;">↩ Quest pai: <button onclick="openBoardQuestDetail('${quest.parent_id._id}')" style="background:none;border:none;color:#3498db;font-family:'Press Start 2P',cursive;font-size:7px;cursor:pointer;padding:0;text-decoration:underline;">${_bEsc(quest.parent_id.title)}</button></span>`;
        } else {
            parentBreadcrumb.style.display = 'none';
            parentBreadcrumb.innerHTML = '';
        }
    }

    const st           = _B_STATUS[quest.status] || _B_STATUS.todo;
    const assigneeName = quest.assigned_to ? (quest.assigned_to.nome || quest.assigned_to.username || '—') : '—';
    const slaText      = quest.sla_seconds ? _bFormatSla(quest.sla_seconds) : '—';
    const labelBadges  = (quest.labels || []).map(l =>
        `<span style="background:#2c3e50;color:#bdc3c7;font-size:7px;padding:2px 6px;">${_bEsc(l)}</span>`
    ).join('');

    const metaEl = document.getElementById('bqd-meta');
    if (metaEl) {
        metaEl.innerHTML = `
            <span class="status-badge" style="background:${st.color};font-size:7px;padding:2px 8px;">${st.label}</span>
            <span style="font-size:7px;color:#3498db;border:1px solid #2980b9;padding:2px 6px;">${FACTION_ICONS[quest.faction] || '🏰'} ${_bEsc(quest.faction || 'Produto')}</span>
            <span style="font-size:7px;color:#2ecc71;border:1px solid #27ae60;padding:2px 6px;">+${quest.xp_reward || 0} XP</span>
            <span style="font-size:7px;color:#f1c40f;border:1px solid #d4ac0d;padding:2px 6px;">💰 ${quest.coin_reward || 0}</span>
            <span style="font-size:7px;color:#bdc3c7;border:1px solid #2c3e50;padding:2px 6px;">⏱️ ${slaText}</span>
            <span style="font-size:7px;color:#9b59b6;border:1px solid #8e44ad;padding:2px 6px;">👤 ${_bEsc(assigneeName)}</span>
            ${labelBadges}
        `;
    }

    const editTitle   = document.getElementById('bqd-edit-title');
    const editXp      = document.getElementById('bqd-edit-xp');
    const editGold    = document.getElementById('bqd-edit-gold');
    const editSla     = document.getElementById('bqd-edit-sla');
    const editFaction = document.getElementById('bqd-edit-faction');
    const editLabels  = document.getElementById('bqd-edit-labels');
    if (editTitle)   editTitle.value   = quest.title;
    if (editXp)      editXp.value      = quest.xp_reward || 0;
    if (editGold)    editGold.value    = quest.coin_reward || 0;
    if (editSla)     editSla.value     = quest.sla_seconds || '';
    if (editFaction) editFaction.value = quest.faction || 'Produto';
    if (editLabels)  editLabels.value  = (quest.labels || []).join(', ');

    // Seletor de responsável — visível quando há membros da guilda carregados
    const assigneeSection = document.getElementById('bqd-assignee-section');
    const assigneeSelect  = document.getElementById('bqd-assignee-select');
    if (assigneeSection && assigneeSelect && boardGuildMembers.length > 0) {
        const currentAssigneeId = quest.assigned_to ? String(quest.assigned_to._id || quest.assigned_to) : '';
        assigneeSelect.innerHTML =
            `<option value="">— Sem responsável —</option>` +
            boardGuildMembers.map(m =>
                `<option value="${m._id}" ${String(m._id) === currentAssigneeId ? 'selected' : ''}>${_bEsc(m.nome || m.username)}</option>`
            ).join('');
        assigneeSection.style.display = '';
    } else if (assigneeSection) {
        assigneeSection.style.display = 'none';
    }

    // Seletor de coluna — visível quando há colunas carregadas e quest não está done
    const moveSection = document.getElementById('bqd-move-section');
    const moveSelect  = document.getElementById('bqd-move-column-select');
    if (moveSection && moveSelect && boardColumns.length > 0) {
        const currentColId = quest.column_id ? String(quest.column_id) : null;
        moveSelect.innerHTML = boardColumns.map(col =>
            `<option value="${col._id}" ${String(col._id) === currentColId ? 'selected' : ''}>${col.name}${String(col._id) === currentColId ? ' (atual)' : ''}</option>`
        ).join('');
        moveSection.style.display = '';
    } else if (moveSection) {
        moveSection.style.display = 'none';
    }

    const checklistSection = document.getElementById('bqd-checklist-section');
    const items = quest.checklist || [];
    if (checklistSection) {
        checklistSection.style.display = 'block';

        const progressEl = document.getElementById('bqd-checklist-progress');
        if (progressEl) {
            if (items.length) {
                const done = items.filter(i => i.done).length;
                const pct  = Math.round((done / items.length) * 100);
                progressEl.innerHTML = `
                    <div style="display:flex;justify-content:space-between;font-size:7px;color:#7f8c8d;margin-bottom:4px;">
                        <span>${done}/${items.length} itens</span><span>${pct}%</span>
                    </div>
                    <div style="background:#0d1b2a;height:5px;border-radius:2px;overflow:hidden;">
                        <div style="height:100%;background:#27ae60;width:${pct}%;"></div>
                    </div>`;
            } else {
                progressEl.innerHTML = '';
            }
        }

        const itemsEl = document.getElementById('bqd-checklist-items');
        if (itemsEl) itemsEl.innerHTML = items.map(item => `
            <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #1a252f;">
                <input type="checkbox" ${item.done ? 'checked' : ''}
                       data-cy="checkbox-board-checklist-item"
                       onchange="boardToggleChecklistItem('${quest._id}','${item._id}',this)"
                       style="cursor:pointer;accent-color:#27ae60;flex-shrink:0;">
                <span style="font-size:8px;color:${item.done ? '#7f8c8d' : '#ecf0f1'};text-decoration:${item.done ? 'line-through' : 'none'};">
                    ${_bEsc(item.text)}
                </span>
            </div>`).join('');
    }

    const activitySection = document.getElementById('bqd-activity-section');
    if (activitySection) activitySection.style.display = quest.parent_id ? 'none' : '';

    renderBoardSubtasks(quest);
    renderBoardQuestComments(quest.comments || []);
}

// ==========================================
// SUBTASKS — board modal
// ==========================================
const _BQD_STATUS = {
    todo:        { label: 'A Fazer',      color: '#2c3e50' },
    in_progress: { label: 'Em Progresso', color: '#e67e22' },
    done:        { label: 'Concluída',    color: '#27ae60' }
};

function renderBoardSubtasks(quest) {
    const section = document.getElementById('bqd-subtasks-section');
    if (!section) return;

    if (quest.parent_id) {
        section.style.display = 'none';
        return;
    }
    section.style.display = '';

    const addBtn = document.getElementById('bqd-subtask-add-btn');
    if (addBtn) addBtn.style.display = '';

    const progEl = document.getElementById('bqd-subtasks-progress');
    const listEl = document.getElementById('bqd-subtask-list');
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
        const st       = _BQD_STATUS[s.status] || _BQD_STATUS.todo;
        const assignee = s.assigned_to ? (s.assigned_to.nome || s.assigned_to.username) : 'Nenhum herói responsável';
        return `
        <div onclick="openBoardQuestDetail('${s._id}')" data-cy="btn-open-subtask-board"
             style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#0d1b2a;border:1px solid #2c3e50;margin-bottom:4px;cursor:pointer;"
             onmouseover="this.style.background='#162538';this.style.borderColor='#3498db';"
             onmouseout="this.style.background='#0d1b2a';this.style.borderColor='#2c3e50';">
            <span style="background:${st.color};font-size:7px;padding:2px 6px;color:#fff;white-space:nowrap;flex-shrink:0;">${st.label}</span>
            <span style="flex:1;font-size:8px;color:#ecf0f1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_bEsc(s.title)}</span>
            <span style="font-size:7px;color:#7f8c8d;white-space:nowrap;flex-shrink:0;">👤 ${_bEsc(assignee)}</span>
        </div>`;
    }).join('');
}

window.bqdToggleSubtaskForm = async () => {
    const form = document.getElementById('bqd-subtask-form');
    if (!form) return;
    const opening = form.style.display === 'none';
    form.style.display = opening ? 'block' : 'none';
    if (!opening) return;

    const sel = document.getElementById('bqd-subtask-assignee');
    if (!sel || sel.options.length > 1) return;
    try {
        const res = await fetch(`${API_URL}/admin/roster`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) return;
        const players = await res.json();
        sel.innerHTML = '<option value="">👤 Sem atribuição</option>' +
            players.map(p => `<option value="${p._id}">${p.nome || p.username}</option>`).join('');
    } catch {}
};

window.bqdCreateSubtask = async () => {
    const title      = document.getElementById('bqd-subtask-title')?.value.trim();
    const assignee   = document.getElementById('bqd-subtask-assignee')?.value;
    const xp_reward  = parseInt(document.getElementById('bqd-subtask-xp')?.value || '0', 10) || 0;
    const coin_reward = parseInt(document.getElementById('bqd-subtask-gold')?.value || '0', 10) || 0;
    if (!title) { showToast('Informe o título da subtask.', 'error'); return; }

    try {
        const res = await fetch(`${API_URL}/quests/${_boardDetailQuestId}/subtasks`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body:    JSON.stringify({ title, assigned_to: assignee || null, xp_reward, coin_reward })
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.message || 'Erro ao criar subtask.', 'error'); return; }

        document.getElementById('bqd-subtask-title').value   = '';
        const xpEl   = document.getElementById('bqd-subtask-xp');
        const goldEl = document.getElementById('bqd-subtask-gold');
        if (xpEl)   xpEl.value   = '0';
        if (goldEl) goldEl.value = '0';
        document.getElementById('bqd-subtask-form').style.display = 'none';
        showToast('Subtask criada!', 'success');

        const freshRes = await fetch(`${API_URL}/quests/${_boardDetailQuestId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (freshRes.ok) {
            const fresh = await freshRes.json();
            renderBoardSubtasks(fresh);
        }
        loadSprintBoard();
    } catch {
        showToast('Erro de conexão.', 'error');
    }
};

function renderBoardQuestComments(comments) {
    const listEl = document.getElementById('bqd-comments');
    if (!listEl) return;

    const sorted = [...comments].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    if (!sorted.length) {
        listEl.innerHTML = '<div style="color:#7f8c8d;font-size:8px;text-align:center;padding:8px;">Sem atividade ainda.</div>';
        return;
    }

    listEl.innerHTML = sorted.map(c => {
        const isActivity = c.type === 'activity';
        const author     = c.user_id ? _bEsc(c.user_id.nome || c.user_id.username) : 'Sistema';
        const ago        = _bTimeAgo(c.created_at);

        if (isActivity) {
            return `<div style="display:flex;align-items:center;gap:6px;padding:4px 0;color:#7f8c8d;font-size:7px;">
                <span style="color:#2980b9;flex-shrink:0;">●</span>
                <span>${_bEsc(c.text)}</span>
                <span style="margin-left:auto;white-space:nowrap;font-size:7px;">${ago}</span>
            </div>`;
        }

        return `<div style="padding:6px 0;border-bottom:1px solid #1a252f;">
            <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                <span style="font-size:7px;color:#f1c40f;font-weight:bold;">${author}</span>
                <span style="font-size:7px;color:#7f8c8d;">${ago}</span>
            </div>
            <div style="font-size:8px;color:#ecf0f1;">${_bEsc(c.text)}</div>
        </div>`;
    }).join('');

    listEl.scrollTop = listEl.scrollHeight;
}

window.boardToggleChecklistItem = async (questId, itemId, checkbox) => {
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
        if (detailRes.ok) renderBoardQuestDetail(await detailRes.json());
    } catch (err) {
        checkbox.checked = !checkbox.checked;
        console.error(err);
    }
};

window.submitBoardComment = async () => {
    if (!_boardDetailQuestId) return;
    const input = document.getElementById('bqd-comment-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    try {
        const res = await fetch(`${API_URL}/quests/${_boardDetailQuestId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ text })
        });
        if (res.ok) {
            input.value = '';
            const detailRes = await fetch(`${API_URL}/quests/${_boardDetailQuestId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (detailRes.ok) renderBoardQuestComments((await detailRes.json()).comments || []);
        } else {
            showToast('Erro ao enviar comentário.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Erro de conexão.', 'error');
    }
};

window.submitBoardQuestEdit = async () => {
    if (!_boardDetailQuestId) return;

    const title   = document.getElementById('bqd-edit-title')?.value.trim();
    const xp      = parseInt(document.getElementById('bqd-edit-xp')?.value   || '0');
    const gold    = parseInt(document.getElementById('bqd-edit-gold')?.value  || '0');
    const slaRaw  = parseInt(document.getElementById('bqd-edit-sla')?.value   || '0');
    const faction = document.getElementById('bqd-edit-faction')?.value;
    const labels  = (document.getElementById('bqd-edit-labels')?.value || '')
        .split(',').map(l => l.trim()).filter(Boolean);

    if (!title) { showToast('Título não pode ser vazio.', 'error'); return; }

    try {
        const res = await fetch(`${API_URL}/quests/${_boardDetailQuestId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ title, xp_reward: xp, coin_reward: gold, sla_seconds: slaRaw || null, faction, labels })
        });

        if (res.ok) {
            showToast('Quest atualizada!');
            const [detailRes] = await Promise.all([
                fetch(`${API_URL}/quests/${_boardDetailQuestId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
                loadSprintBoard()
            ]);
            if (detailRes.ok) renderBoardQuestDetail(await detailRes.json());
        } else {
            const err = await res.json().catch(() => ({}));
            showToast(err.message || 'Erro ao salvar.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Erro de conexão.', 'error');
    }
};


window.bqdAddChecklistItem = async () => {
    const input = document.getElementById('bqd-checklist-new-item');
    const text  = input?.value.trim();
    if (!text || !_boardDetailQuestId) return;

    try {
        const res = await fetch(`${API_URL}/quests/${_boardDetailQuestId}/checklist`, {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body:    JSON.stringify({ add: [text] })
        });
        if (!res.ok) { showToast('Erro ao salvar item.', 'error'); return; }

        input.value = '';
        const freshRes = await fetch(`${API_URL}/quests/${_boardDetailQuestId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (freshRes.ok) renderBoardQuestDetail(await freshRes.json());
    } catch {
        showToast('Erro de conexão.', 'error');
    }
};

// ==========================================
// MODAL — EDITAR COLUNAS DO KANBAN
// ==========================================
let _editColumnsData = [];

window.openEditColumnsModal = () => {
    if (!currentGuildId) { showToast('Selecione uma guilda para editar as colunas.', 'error'); return; }
    _editColumnsData = boardColumns.map(c => ({ ...c }));
    const guild  = allGuilds.find(g => g._id === currentGuildId);
    const nameEl = document.getElementById('editColumnsGuildName');
    if (nameEl) nameEl.textContent = guild ? `// ${guild.name.toUpperCase()}` : '';
    renderEditColumnsList();
    document.getElementById('editColumnsModal').style.display = 'flex';
};

window.closeEditColumnsModal = () => {
    document.getElementById('editColumnsModal').style.display = 'none';
};

function renderEditColumnsList() {
    const list = document.getElementById('editColumnsList');
    if (!list) return;
    const total = _editColumnsData.length;
    list.innerHTML = _editColumnsData.map((col, i) => {
        const tag     = i === 0 ? 'INÍCIO' : i === total - 1 ? 'FIM' : 'MEIO';
        const tagBg   = i === 0 ? '#0e3460' : i === total - 1 ? '#0a3d2b' : '#2d1b69';
        const tagText = i === 0 ? '#5bc8f5' : i === total - 1 ? '#2ecc71'  : '#9b59b6';
        const upDis   = i === 0;
        const downDis = i === total - 1;
        const delDis  = total <= 3;
        return `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding:12px 14px;background:#1a252f;border:1px solid #2c3e50;">
            <div style="display:flex;flex-direction:column;gap:4px;">
                <button onclick="_colMoveUp(${i})"
                        style="background:#2c3e50;border:none;color:#ecf0f1;font-family:inherit;font-size:9px;padding:3px 8px;cursor:pointer;${upDis ? 'opacity:.35;cursor:not-allowed;' : ''}"
                        ${upDis ? 'disabled' : ''}>↑</button>
                <button onclick="_colMoveDown(${i})"
                        style="background:#2c3e50;border:none;color:#ecf0f1;font-family:inherit;font-size:9px;padding:3px 8px;cursor:pointer;${downDis ? 'opacity:.35;cursor:not-allowed;' : ''}"
                        ${downDis ? 'disabled' : ''}>↓</button>
            </div>
            <input type="color" value="${col.color || '#2c3e50'}" data-cy="input-col-color-${i}"
                   oninput="_editColumnsData[${i}].color = this.value"
                   title="Cor da coluna"
                   style="width:32px;height:32px;padding:2px;background:#0d1b2a;border:2px solid #2c3e50;cursor:pointer;flex-shrink:0;">
            <input type="text" value="${col.name}" data-cy="input-col-name-${i}"
                   oninput="_editColumnsData[${i}].name = this.value"
                   style="flex:1;font-family:inherit;font-size:10px;padding:10px 12px;background:#0d1b2a;color:#ecf0f1;border:2px solid #2c3e50;outline:none;">
            <span style="font-size:7px;padding:4px 8px;background:${tagBg};color:${tagText};white-space:nowrap;flex-shrink:0;min-width:44px;text-align:center;border:1px solid ${tagText}55;">${tag}</span>
            <button onclick="_colDelete(${i})" data-cy="btn-delete-col-${i}"
                    style="background:#c0392b;border:none;color:#fff;font-family:inherit;font-size:9px;padding:7px 10px;cursor:pointer;${delDis ? 'opacity:.35;cursor:not-allowed;' : ''}"
                    ${delDis ? 'disabled' : ''}>✕</button>
        </div>`;
    }).join('');
}

window.addNewColumn = () => {
    _editColumnsData.push({ _id: null, name: 'Nova Coluna', order: _editColumnsData.length + 1, color: '#2c3e50', status_map: 'in_progress' });
    renderEditColumnsList();
};

window._colMoveUp = (i) => {
    if (i <= 0) return;
    [_editColumnsData[i - 1], _editColumnsData[i]] = [_editColumnsData[i], _editColumnsData[i - 1]];
    renderEditColumnsList();
};

window._colMoveDown = (i) => {
    if (i >= _editColumnsData.length - 1) return;
    [_editColumnsData[i], _editColumnsData[i + 1]] = [_editColumnsData[i + 1], _editColumnsData[i]];
    renderEditColumnsList();
};

window._colDelete = (i) => {
    if (_editColumnsData.length <= 3) return;
    _editColumnsData.splice(i, 1);
    renderEditColumnsList();
};

window.saveColumnsEdit = async () => {
    if (!currentGuildId) { showToast('Selecione uma guilda antes de editar colunas.', 'error'); return; }
    const btn = document.querySelector('[data-cy="btn-save-columns"]');
    if (btn) btn.disabled = true;
    const total = _editColumnsData.length;
    try {
        // Deleta colunas que existiam no banco mas foram removidas localmente
        const editIds = new Set(_editColumnsData.filter(c => c._id).map(c => String(c._id)));
        const toDelete = boardColumns.filter(c => !editIds.has(String(c._id)));
        for (const col of toDelete) {
            const delRes = await fetch(`${API_URL}/guild/columns/${col._id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!delRes.ok) {
                const err = await delRes.json().catch(() => ({}));
                showToast(err.message || 'Erro ao excluir coluna.', 'error');
                if (btn) btn.disabled = false;
                return;
            }
        }

        for (let i = 0; i < total; i++) {
            const col = { ..._editColumnsData[i], order: i + 1 };
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
                    body: JSON.stringify({ name: col.name, order: col.order, status_map: col.status_map, color: col.color, guild_id: currentGuildId })
                });
            }
        }
        closeEditColumnsModal();
        await fetchBoardColumns(currentGuildId);
        renderKanban();
        showToast('Colunas atualizadas com sucesso!');
    } catch {
        showToast('Erro ao salvar colunas.', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
};
