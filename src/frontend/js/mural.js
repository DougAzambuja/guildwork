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

function xpParaProximoNivel(level) {
    return 200 * (level + 1) + 300;
}

const CURSE_CONFIG = {
    sla_breach: {
        icon:    '💀',
        label:   'Maldição do Atraso',
        color:   '#e74c3c',
        penalty: 'XP reduzido pela metade nesta entrega.',
        cure:    'Conclua qualquer missão para quebrar a maldição.'
    },
    abandoned: {
        icon:    '👻',
        label:   'Maldição do Abandono',
        color:   '#8e44ad',
        penalty: 'Gold reduzido pela metade nesta entrega.',
        cure:    'Conclua qualquer missão para quebrar a maldição.'
    },
    csat_low: {
        icon:    '💔',
        label:   'Maldição da Insatisfação',
        color:   '#e67e22',
        penalty: 'XP e Gold reduzidos. Missões urgentes bloqueadas.',
        cure:    'Conclua uma quest de Suporte com CSAT ≥ 4★.'
    }
};

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
    avatar:      'assets/imgs/caneca_pixel.jpg',
    activeBuff:   null,
    csatStreak:   0,
    achievements: []
};

let currentBoardStats = { todo: 0, inProgress: 0, done: 0, myWip: 0, slaAlerts: 0 };

const targetTasks  = 5;
const activeTimers = new Map();
const questCache   = new Map();

document.addEventListener('DOMContentLoaded', async () => {
    await fetchPlayerState();
    await loadBoard();
    startBoardAutoRefresh();
});

// ==========================================
// 2. AUTO-REFRESH DO BOARD
// ==========================================
const REFRESH_SECONDS = 30;

function startBoardAutoRefresh() {
    const btn = document.getElementById('btnRefreshBoard');
    let countdown = REFRESH_SECONDS;

    // Reseta countdown quando o usuário atualiza manualmente
    if (btn) {
        btn.addEventListener('click', () => { countdown = REFRESH_SECONDS; });
    }

    setInterval(() => {
        countdown--;
        if (btn) btn.textContent = `↻ ${countdown}s`;

        if (countdown <= 0) {
            countdown = REFRESH_SECONDS;
            if (btn) btn.classList.add('refreshing');
            loadBoard().then(() => {
                if (btn) btn.classList.remove('refreshing');
            });
        }
    }, 1000);
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
                avatar:     data.avatar_url       || 'assets/imgs/caneca_pixel.jpg',
                activeBuff: data.buff_type ? {
                    type:      data.buff_type,
                    expiresAt: data.buff_expires_at       || null,
                    quests:    data.buff_quests_remaining || null
                } : null,
                csatStreak:   data.csat_streak    || 0,
                achievements: data.achievements   || []
            };

            updateUI();
            updateBuffUI();

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
// 4. KANBAN BOARD — CARREGAMENTO
// ==========================================
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
function renderBoard(quests) {
    activeTimers.forEach(id => clearInterval(id));
    activeTimers.clear();

    const todo       = quests.filter(q => q.status === 'todo');
    const inProgress = quests.filter(q => q.status === 'in_progress');
    const done       = quests.filter(q => q.status === 'done');

    quests.forEach(q => questCache.set(q._id, q));

    const myWipCount = inProgress.filter(q =>
        q.assigned_to && q.assigned_to._id === playerData.id
    ).length;

    const slaAlerts = inProgress.filter(q => {
        if (!q.sla_seconds || !q.started_at) return false;
        const elapsed = (Date.now() - new Date(q.started_at).getTime()) / 1000;
        return elapsed > q.sla_seconds * 0.75;
    }).length;

    currentBoardStats = {
        todo:       todo.length,
        inProgress: inProgress.length,
        done:       done.length,
        myWip:      myWipCount,
        slaAlerts
    };

    renderColumn('col-todo',        todo,       q => renderTodoCard(q, myWipCount));
    renderColumn('col-in-progress', inProgress, q => renderInProgressCard(q));
    renderColumn('col-done',        done,       renderDoneCard);

    const countTodo = document.getElementById('count-todo');
    const countWip  = document.getElementById('count-in-progress');
    const countDone = document.getElementById('count-done');
    if (countTodo) countTodo.textContent = todo.length;
    if (countWip)  countWip.textContent  = inProgress.length;
    if (countDone) countDone.textContent = done.length;

    updateSidebar();
}

function renderColumn(colId, quests, cardFn) {
    const body = document.getElementById(colId);
    if (!body) return;
    body.innerHTML = '';
    if (quests.length === 0) {
        body.innerHTML = '<div style="font-size:8px;color:#bdc3c7;text-align:center;padding:20px;">Nenhuma missão aqui.</div>';
        return;
    }
    quests.forEach(q => body.appendChild(cardFn(q)));
}

function renderTodoCard(quest, myWipCount) {
    const el = document.createElement('div');
    const typeClass = quest.type === 'urgent' ? 'urgent' : (quest.type === 'support' ? 'support' : '');
    el.className = `kanban-card ${typeClass}`;

    const overWip      = myWipCount >= WIP_LIMIT;
    const csatBlocked  = playerData.curseType === 'csat_low' && quest.type === 'urgent';
    const cantPickUp   = overWip || csatBlocked;
    const slaInfo = quest.sla_seconds
        ? `<div style="font-size:8px;color:#888;margin-bottom:8px;">SLA: ${formatSla(quest.sla_seconds)}</div>`
        : '';
    const wipWarning = overWip      ? '<div class="wip-warning">Limite WIP atingido (max 3)</div>'
                     : csatBlocked  ? '<div class="wip-warning">💔 Maldição: urgentes bloqueadas</div>'
                     : '';

    el.innerHTML = `
        <span class="kanban-type-badge badge-${quest.type || 'normal'}">${(quest.type || 'NORMAL').toUpperCase()}</span>
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

    el.addEventListener('click', () => openQuestModal(quest._id));
    return el;
}

function renderInProgressCard(quest) {
    const el = document.createElement('div');
    const typeClass = quest.type === 'urgent' ? 'urgent' : (quest.type === 'support' ? 'support' : '');
    el.className = `kanban-card ${typeClass}`;

    const assignee     = quest.assigned_to;
    const isMyQuest    = assignee && assignee._id === playerData.id;
    const assigneeName = assignee ? (assignee.nome || assignee.username) : 'Desconhecido';
    const assigneeAv   = assignee && assignee.avatar_url
        ? assignee.avatar_url
        : 'assets/imgs/caneca_pixel.jpg';

    const slaHtml = quest.sla_seconds
        ? `<div class="kanban-sla-timer" id="sla-${quest._id}">SLA: calculando...</div>`
        : '';

    const slaBreached = quest.sla_seconds && quest.started_at &&
        (Date.now() - new Date(quest.started_at).getTime()) / 1000 > quest.sla_seconds;
    const finishBtn = isMyQuest
        ? `<button class="btn-kanban btn-finish${slaBreached ? ' btn-finish-cursed' : ''}"
               onclick="finishQuest('${quest._id}', '${quest.type}')">
               ${slaBreached ? '💀 CONCLUIR (MALDIÇÃO)' : '✅ CONCLUIR'}
           </button>`
        : '';

    el.innerHTML = `
        <span class="kanban-type-badge badge-${quest.type || 'normal'}">${(quest.type || 'NORMAL').toUpperCase()}</span>
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
        ${finishBtn.replace('onclick="finishQuest(', 'onclick="event.stopPropagation(); finishQuest(')}
    `;

    if (quest.sla_seconds && quest.started_at) {
        const assignedToId = quest.assigned_to ? quest.assigned_to._id : null;
        startSlaTimer(quest._id, quest.sla_seconds, quest.started_at, assignedToId);
    }

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

let _modalQuestId = null;

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
    _renderModalInfo(cached);

    const checklistSection = document.getElementById('qdm-checklist-section');
    const commentsList     = document.getElementById('qdm-comments-list');
    if (checklistSection) checklistSection.style.display = 'none';
    if (commentsList) commentsList.innerHTML = '<div style="color:#7f8c8d;font-size:9px;text-align:center;padding:10px;">Carregando...</div>';

    document.getElementById('questDetailModal').style.display = 'flex';

    try {
        const res = await fetch(`${API_URL}/quests/${questId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        const full = await res.json();
        _renderModalChecklist(full);
        _renderModalComments(full.comments || []);
    } catch (err) {
        console.error('Erro ao carregar detalhe da quest:', err);
    }
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
        const av   = assignee.avatar_url || 'assets/imgs/caneca_pixel.jpg';
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
}

function _renderModalChecklist(quest) {
    const section   = document.getElementById('qdm-checklist-section');
    const progressEl = document.getElementById('qdm-checklist-progress');
    const itemsEl   = document.getElementById('qdm-checklist-items');
    if (!section) return;

    const items = quest.checklist || [];
    if (!items.length) { section.style.display = 'none'; return; }

    section.style.display = 'block';

    const doneCount = items.filter(i => i.done).length;
    const pct       = Math.round((doneCount / items.length) * 100);

    if (progressEl) progressEl.innerHTML = `
        <div style="display:flex;justify-content:space-between;font-size:8px;color:#7f8c8d;margin-bottom:4px;">
            <span>${doneCount} de ${items.length} itens</span><span>${pct}%</span>
        </div>
        <div style="background:#0d1b2a;height:6px;border-radius:2px;overflow:hidden;">
            <div style="height:100%;background:#27ae60;width:${pct}%;transition:width 0.3s;"></div>
        </div>
    `;

    const assignedId = quest.assigned_to ? (quest.assigned_to._id || quest.assigned_to).toString() : null;
    const canToggle  = assignedId === playerData.id;

    if (itemsEl) itemsEl.innerHTML = items.map(item => `
        <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #1a252f;">
            <input type="checkbox" ${item.done ? 'checked' : ''} ${!canToggle ? 'disabled' : ''}
                   data-cy="checkbox-checklist-item"
                   onchange="toggleChecklistItem('${quest._id}','${item._id}',this)"
                   style="cursor:${canToggle ? 'pointer' : 'default'};accent-color:#27ae60;flex-shrink:0;">
            <span style="font-size:9px;color:${item.done ? '#7f8c8d' : '#ecf0f1'};text-decoration:${item.done ? 'line-through' : 'none'};">
                ${_esc(item.text)}
            </span>
        </div>
    `).join('');
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
        if (detailRes.ok) _renderModalChecklist(await detailRes.json());
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

function closeQuestModal() {
    document.getElementById('questDetailModal').style.display = 'none';
    _modalQuestId = null;
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

async function finishQuest(questId, questType) {
    let csatScore = null;
    if (questType === 'support') {
        const nota    = prompt('⭐ Qual foi a nota CSAT do cliente? (1 a 5)');
        const notaNum = parseInt(nota);
        if (isNaN(notaNum) || notaNum < 1 || notaNum > 5) {
            showToast('Nota inválida! Digite um número de 1 a 5.', 'error');
            return;
        }
        csatScore = notaNum;
    }

    try {
        const res = await fetch(`${API_URL}/quests/complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ questId, csatScore })
        });

        if (res.ok) {
            const data = await res.json();

            const wasCurseType    = playerData.curseType;
            playerData.xp         = data.updatedState.xp;
            playerData.coins       = data.updatedState.coins;
            playerData.level       = data.updatedState.level;
            playerData.tasks       = data.updatedState.questsCompleted;
            playerData.isCursed    = data.updatedState.isCursed;
            playerData.curseType   = data.updatedState.curseType || null;
            playerData.activeBuff  = data.updatedState.activeBuff || null;
            playerData.csatStreak  = data.updatedState.csatStreak || 0;
            playerData.farmedGold += data.coinsGained;
            playerData.farmedXP   += data.xpGained;
            sessionStorage.setItem('session_gold', playerData.farmedGold);
            sessionStorage.setItem('session_xp',   playerData.farmedXP);

            updateUI();
            updateBuffUI();

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

            await loadBoard();
        } else {
            const err = await res.json();
            showToast(err.message || 'Erro ao concluir quest.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Erro de conexão com o servidor.', 'error');
    }
}

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
                const card    = timerEl.closest('.kanban-card');
                const finBtn  = card && card.querySelector('.btn-finish');
                if (finBtn) {
                    finBtn.classList.add('btn-finish-cursed');
                    finBtn.textContent = '💀 CONCLUIR (MALDIÇÃO)';
                }
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
// 11. GESTÃO DE PERFIL (MODAL)
// ==========================================
let tempSelectedAvatar = '';

const ALL_ACHIEVEMENTS = [
    { key: 'first_quest', title: '🎖️ Aventureiro Estreante', desc: '1 missão concluída' },
    { key: 'quests_5',   title: '⚔️ Guerreiro Dedicado',    desc: '5 missões concluídas' },
    { key: 'quests_10',  title: '🛡️ Veterano da Guilda',    desc: '10 missões concluídas' },
    { key: 'quests_25',  title: '👑 Herói Lendário',         desc: '25 missões concluídas' },
    { key: 'quests_50',  title: '🌟 Mestre das Missões',     desc: '50 missões concluídas' }
];

function renderAchievementBadges() {
    const container = document.getElementById('achievementsBadges');
    if (!container) return;

    const unlockedKeys = new Set((playerData.achievements || []).map(a => a.key));

    container.innerHTML = ALL_ACHIEVEMENTS.map(a => {
        const unlocked = unlockedKeys.has(a.key);
        const stored   = (playerData.achievements || []).find(u => u.key === a.key);
        const dateStr  = stored?.unlocked_at
            ? new Date(stored.unlocked_at).toLocaleDateString('pt-BR')
            : '';

        return `
            <div style="display:flex; align-items:center; gap:12px; padding:8px 10px;
                        background:${unlocked ? 'rgba(243,156,18,0.08)' : 'rgba(255,255,255,0.02)'};
                        border:1px solid ${unlocked ? '#f39c12' : '#2c3e50'};
                        border-radius:3px; opacity:${unlocked ? '1' : '0.45'};">
                <span style="font-size:20px; line-height:1; flex-shrink:0;">${unlocked ? a.title.split(' ')[0] : '🔒'}</span>
                <div style="flex:1; min-width:0;">
                    <div style="font-size:9px; color:${unlocked ? '#f1c40f' : '#7f8c8d'}; font-weight:bold; letter-spacing:1px;">
                        ${a.title.split(' ').slice(1).join(' ')}
                    </div>
                    <div style="font-size:8px; color:#7f8c8d; margin-top:2px;">${unlocked ? (dateStr ? `Desbloqueado em ${dateStr}` : 'Desbloqueado') : a.desc}</div>
                </div>
                ${unlocked ? '<span style="font-size:10px;color:#27ae60;">✓</span>' : ''}
            </div>
        `;
    }).join('');
}

window.openProfileModal = () => {
    document.getElementById('profileModal').style.display = 'flex';
    document.getElementById('editProfileName').value = playerData.name;
    tempSelectedAvatar = playerData.avatar;
    document.getElementById('modalAvatarPreview').src = tempSelectedAvatar;
    document.querySelectorAll('.avatar-option').forEach(el => {
        el.classList.remove('selected');
        if (el.getAttribute('src') === playerData.avatar) el.classList.add('selected');
    });
    renderAchievementBadges();
};

window.closeProfileModal = () => {
    document.getElementById('profileModal').style.display = 'none';
};

window.selectAvatar = (url, element) => {
    tempSelectedAvatar = url;
    document.getElementById('modalAvatarPreview').src = url;
    document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
    if (element) element.classList.add('selected');
};

const editProfilePicEl = document.getElementById('editProfilePic');
if (editProfilePicEl) {
    editProfilePicEl.addEventListener('input', function(e) {
        const val = e.target.value.trim();
        if (val) {
            tempSelectedAvatar = val;
            document.getElementById('modalAvatarPreview').src = val;
            document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
        }
    });
}

const profileForm = document.getElementById('profileForm');
if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newName = document.getElementById('editProfileName').value.trim();
        const newPic  = document.getElementById('editProfilePic').value.trim() || tempSelectedAvatar;

        try {
            const res = await fetch(`${API_URL}/players/me`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ nome: newName, avatar_url: newPic })
            });

            if (res.ok) {
                playerData.name   = newName;
                playerData.avatar = newPic;
                localStorage.setItem('guild_user', newName);
                updateUI();
                closeProfileModal();
                showToast('Perfil forjado com sucesso!');
            } else {
                showToast('Erro ao salvar perfil.', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Erro de conexão com o servidor.', 'error');
        }
    });
}
