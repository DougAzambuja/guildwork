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
const maxXP    = 10000;
const WIP_LIMIT = 3;

let playerData = {
    id:         null,
    xp:         0,
    coins:      0,
    level:      1,
    tasks:      0,
    farmedGold: parseInt(sessionStorage.getItem('session_gold') || '0'),
    farmedXP:   parseInt(sessionStorage.getItem('session_xp')   || '0'),
    isCursed:   false,
    name:       'Aventureiro',
    avatar:     'assets/imgs/caneca_pixel.jpg'
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
                name:       data.nome             || data.username,
                avatar:     data.avatar_url       || 'assets/imgs/caneca_pixel.jpg'
            };

            updateUI();

            if (playerData.isCursed) applyCurseVisuals();

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

    const overWip = myWipCount >= WIP_LIMIT;
    const slaInfo = quest.sla_seconds
        ? `<div style="font-size:8px;color:#888;margin-bottom:8px;">SLA: ${formatSla(quest.sla_seconds)}</div>`
        : '';
    const wipWarning = overWip
        ? '<div class="wip-warning">Limite WIP atingido (max 3)</div>'
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
        <button class="btn-kanban btn-pickup" onclick="event.stopPropagation(); pickUpQuest('${quest._id}')" ${overWip ? 'disabled' : ''}>
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
    const finishBtn = isMyQuest
        ? `<button class="btn-kanban btn-finish" onclick="finishQuest('${quest._id}', '${quest.type}')">✅ CONCLUIR</button>`
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
        startSlaTimer(quest._id, quest.sla_seconds, quest.started_at);
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

function openQuestModal(questId) {
    const quest = questCache.get(questId);
    if (!quest) return;

    const st = STATUS_MAP[quest.status] || STATUS_MAP.todo;

    // Tipo
    const typeEl = document.getElementById('qdm-type-badge');
    typeEl.innerHTML = `<span class="kanban-type-badge badge-${quest.type || 'normal'}" style="font-size:9px;">${(quest.type || 'NORMAL').toUpperCase()}</span>`;

    // Título
    document.getElementById('qdm-title').textContent = quest.title;

    // Status
    document.getElementById('qdm-status').innerHTML =
        `<span class="status-badge" style="background:${st.color}; padding:4px 10px; font-size:8px;">${st.label}</span>`;

    // Recompensas
    document.getElementById('qdm-xp').textContent    = `+${quest.xp_reward} XP`;
    document.getElementById('qdm-coins').textContent = `+${quest.coin_reward} 💰`;

    // SLA
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

    // Atribuído a
    const assigneeEl  = document.getElementById('qdm-assignee');
    const assignee    = quest.assigned_to;
    if (assignee) {
        const av   = assignee.avatar_url || 'assets/imgs/caneca_pixel.jpg';
        const name = assignee.nome || assignee.username;
        assigneeEl.innerHTML = `
            <img class="kanban-assignee-avatar" src="${av}" alt="" style="border-color:#f1c40f;">
            <span style="font-size:11px; color:#ecf0f1;">${name}</span>
        `;
    } else {
        assigneeEl.innerHTML = '<span style="font-size:10px; color:#7f8c8d;">Disponível — nenhum aventureiro ainda</span>';
    }

    // Em progresso desde
    const startedSection = document.getElementById('qdm-started-section');
    if (quest.status === 'in_progress' && quest.started_at) {
        startedSection.style.display = 'block';
        document.getElementById('qdm-started').textContent = formatDate(quest.started_at);
    } else {
        startedSection.style.display = 'none';
    }

    document.getElementById('questDetailModal').style.display = 'flex';
}

function closeQuestModal() {
    document.getElementById('questDetailModal').style.display = 'none';
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

            const wasCursed      = playerData.isCursed;
            playerData.xp        = data.updatedState.xp;
            playerData.coins     = data.updatedState.coins;
            playerData.level     = data.updatedState.level;
            playerData.tasks     = data.updatedState.questsCompleted;
            playerData.isCursed  = data.updatedState.isCursed;
            playerData.farmedGold += data.coinsGained;
            playerData.farmedXP   += data.xpGained;
            sessionStorage.setItem('session_gold', playerData.farmedGold);
            sessionStorage.setItem('session_xp',   playerData.farmedXP);

            updateUI();

            if (data.leveledUp) {
                showLevelUpAnimation(data.updatedState.level);
            } else {
                showToast(`Quest concluída! +${data.xpGained} XP +${data.coinsGained} 💰`);
            }

            if (wasCursed && !playerData.isCursed) {
                removeCurseVisuals();
                showToast('✨ Maldição quebrada!');
            } else if (playerData.isCursed) {
                applyCurseVisuals();
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
function startSlaTimer(questId, slaSeconds, startedAt) {
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
            if (!playerData.isCursed) {
                applyCurseVisuals();
                await setPlayerCurseState(true);
                showToast('🚨 SLA estourado! Maldição aplicada!', 'error');
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
    const xpPct = Math.min((playerData.xp / maxXP) * 100, 100);

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
    const xpToLevel    = Math.max(0, maxXP - playerData.xp);
    const xpPct        = Math.min((playerData.xp / maxXP) * 100, 100);
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
function applyCurseVisuals() {
    playerData.isCursed = true;
    const avatarEl    = document.getElementById('playerAvatar');
    const xpBar       = document.getElementById('xpBar');
    const xpContainer = document.getElementById('xpContainer');
    if (avatarEl) {
        avatarEl.classList.remove('curse-warning');
        avatarEl.classList.add('curse-critical');
    }
    if (xpBar) {
        xpBar.classList.remove('curse-warning');
        xpBar.classList.add('curse-critical');
    }
    if (xpContainer) xpContainer.classList.add('curse-critical');
}

function removeCurseVisuals() {
    playerData.isCursed = false;
    const avatarEl    = document.getElementById('playerAvatar');
    const xpBar       = document.getElementById('xpBar');
    const xpContainer = document.getElementById('xpContainer');
    if (avatarEl)    avatarEl.classList.remove('curse-warning', 'curse-critical');
    if (xpBar)       xpBar.classList.remove('curse-warning', 'curse-critical');
    if (xpContainer) xpContainer.classList.remove('curse-critical');
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

window.openProfileModal = () => {
    document.getElementById('profileModal').style.display = 'flex';
    document.getElementById('editProfileName').value = playerData.name;
    tempSelectedAvatar = playerData.avatar;
    document.getElementById('modalAvatarPreview').src = tempSelectedAvatar;
    document.querySelectorAll('.avatar-option').forEach(el => {
        el.classList.remove('selected');
        if (el.getAttribute('src') === playerData.avatar) el.classList.add('selected');
    });
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
