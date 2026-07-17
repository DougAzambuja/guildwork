// ==========================================
// 0. PROTEÇÃO E INICIALIZAÇÃO
// ==========================================
const token    = localStorage.getItem('guild_token');
const params   = new URLSearchParams(window.location.search);
const sprintId = params.get('id');

let allQuests     = [];
let allSprints    = [];
let currentFilter = null;

document.addEventListener('DOMContentLoaded', () => {
    if (!token || localStorage.getItem('guild_role') !== 'admin') {
        window.location.href = 'login.html';
        return;
    }

    if (!sprintId) {
        window.location.href = 'admin-sprints.html';
        return;
    }

    const adminName = localStorage.getItem('guild_user') || 'Mestre da Guilda';
    const nameEl    = document.getElementById('playerName');
    if (nameEl) nameEl.textContent = adminName;

    showLoadingState();
    // Carrega ambos em paralelo — sprint first, sprints list second
    Promise.all([loadSprintBoard(), loadAllSprints()]);
});

function showLoadingState() {
    ['cards-todo', 'cards-in_progress', 'cards-done'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<div style="font-size:7px;color:#4a5568;padding:16px 0;text-align:center;">Carregando...</div>';
    });
}

// ==========================================
// 1. CONFIGURAÇÕES
// ==========================================
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
        const res = await fetch(`${API_URL}/sprints/${sprintId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            showToast(err.message || 'Sprint não encontrada.', 'error');
            showError('Sprint não encontrada ou sem acesso.');
            return;
        }

        const data = await res.json();

        if (!data || !data.sprint) {
            showError('Dados da sprint inválidos.');
            return;
        }

        allQuests = Array.isArray(data.quests) ? data.quests : [];

        renderSprintHeader(data);
        renderKanban();

        // Canvas precisa de layout pronto — usa rAF
        requestAnimationFrame(() => loadBurndown());

    } catch (err) {
        console.error('[Board] Erro ao carregar sprint:', err);
        showToast('Erro de conexão com o servidor.', 'error');
        showError('Erro ao conectar com o servidor.');
    }
}

function showError(msg) {
    ['cards-todo', 'cards-in_progress', 'cards-done'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = `<div style="font-size:7px;color:#e74c3c;padding:10px;">${msg}</div>`;
    });
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
    const filtered = currentFilter
        ? allQuests.filter(q => q.faction === currentFilter)
        : allQuests;

    const groups = {
        todo:        filtered.filter(q => q.status === 'todo'),
        in_progress: filtered.filter(q => q.status === 'in_progress'),
        done:        filtered.filter(q => q.status === 'done')
    };

    for (const [status, quests] of Object.entries(groups)) {
        const countEl = document.getElementById(`count-${status}`);
        const cardsEl = document.getElementById(`cards-${status}`);
        if (countEl) countEl.textContent = quests.length;
        if (cardsEl) {
            cardsEl.innerHTML = quests.length
                ? quests.map(q => renderQuestCard(q)).join('')
                : emptyColumn();
        }
    }
}

function emptyColumn() {
    return '<div style="font-size:7px;color:#4a5568;text-align:center;padding:20px 0;">Nenhuma quest</div>';
}

function renderQuestCard(q) {
    const qId          = String(q._id);
    const assigneeName = q.assigned_to ? (q.assigned_to.nome || q.assigned_to.username || '—') : null;
    const factionIcon  = FACTION_ICONS[q.faction] || '🏰';
    const typeLabel    = TYPE_LABELS[q.type]       || (q.type || 'normal');
    const faction      = (q.faction || 'Produto').replace(/'/g, "\\'");

    return `
        <div class="quest-card" data-status="${q.status}" data-cy="quest-card" data-id="${qId}">
            <div class="quest-card-title">${q.title}</div>
            <div class="quest-card-meta">
                <span class="quest-tag faction">${factionIcon} ${q.faction || 'Produto'}</span>
                <span class="quest-tag">${typeLabel}</span>
                <span class="quest-tag xp">+${q.xp_reward || 0} XP</span>
                <span class="quest-tag gold">💰 ${q.coin_reward || 0}</span>
                ${assigneeName ? `<span class="quest-tag assignee">👤 ${assigneeName}</span>` : ''}
            </div>
            <div class="quest-card-actions">
                <button class="quest-action-btn" data-cy="btn-card-transfer-sprint"
                    onclick="openTransferSprint('${qId}')">🔀 Mover Sprint</button>
                <button class="quest-action-btn" data-cy="btn-card-transfer-faction"
                    onclick="openTransferFaction('${qId}', '${faction}')">🏰 Guilda</button>
                <button class="quest-action-btn copy" data-cy="btn-card-copy-quest"
                    onclick="openCopyQuest('${qId}')">📋 Copiar</button>
                <button class="quest-action-btn remove" data-cy="btn-card-remove-quest"
                    onclick="openRemoveQuest('${qId}')">✖ Remover</button>
            </div>
        </div>
    `;
}

// ==========================================
// 5. FILTRO DE FACÇÃO
// ==========================================
window.setFactionFilter = (faction, btn) => {
    currentFilter = faction;
    document.querySelectorAll('.faction-filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderKanban();
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

    const maxY  = Math.max(total_quests || 1, 1);
    const pts   = (labels || []).length;

    ctx.clearRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = '#1e2d3d';
    ctx.lineWidth   = 1;
    for (let i = 0; i <= 5; i++) {
        const y = PAD.top + (cH / 5) * i;
        ctx.beginPath();
        ctx.moveTo(PAD.left, y);
        ctx.lineTo(PAD.left + cW, y);
        ctx.stroke();

        const val = Math.round(maxY - (maxY / 5) * i);
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

    // Linha real (vermelha, preenchida)
    const actual = actual_line || [];
    if (actual.length > 0) {
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth   = 2;
        ctx.beginPath();
        actual.forEach((v, i) => {
            if (i === 0) ctx.moveTo(toX(i), toY(v));
            else         ctx.lineTo(toX(i), toY(v));
        });
        ctx.stroke();

        // Preenchimento sob a linha real
        ctx.beginPath();
        actual.forEach((v, i) => {
            if (i === 0) ctx.moveTo(toX(i), toY(v));
            else         ctx.lineTo(toX(i), toY(v));
        });
        ctx.lineTo(toX(actual.length - 1), PAD.top + cH);
        ctx.lineTo(toX(0), PAD.top + cH);
        ctx.closePath();
        ctx.fillStyle = 'rgba(231,76,60,0.10)';
        ctx.fill();

        // Pontos na linha real
        ctx.fillStyle = '#e74c3c';
        actual.forEach((v, i) => {
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
