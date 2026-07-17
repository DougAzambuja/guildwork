// ==========================================
// 0. PROTEÇÃO E INICIALIZAÇÃO
// ==========================================
const token = localStorage.getItem('guild_token');
let activeSprintId = null;

document.addEventListener('DOMContentLoaded', () => {
    if (!token || localStorage.getItem('guild_role') !== 'admin') {
        window.location.href = 'login.html';
        return;
    }

    const adminName = localStorage.getItem('guild_user') || 'Mestre da Guilda';
    const nameEl    = document.getElementById('playerName');
    if (nameEl) nameEl.innerText = adminName;

    setupSprintForm();
    document.getElementById('editSprintForm').addEventListener('submit', submitEditSprint);

    loadPage();
});

async function loadPage() {
    await Promise.all([loadActiveSprint(), loadAllSprints()]);
}

// ==========================================
// 1. SPRINT ATIVA — DASHBOARD
// ==========================================
const HEALTH_CONFIG = {
    on_track: { label: '✅ NO RITMO',  color: '#27ae60' },
    at_risk:  { label: '⚠️ EM RISCO',  color: '#e67e22' },
    behind:   { label: '🚨 ATRASADA',  color: '#e74c3c' }
};

const FACTION_ICONS = { Produto: '📦', Suporte: '🎧', 'Customer Service': '📣' };

async function loadActiveSprint() {
    try {
        const res  = await fetch(`${API_URL}/sprints/active`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (!data || !data.sprint) {
            document.getElementById('activeSprint').style.display = 'none';
            return;
        }

        activeSprintId = data.sprint._id;
        renderActiveSprint(data);
        await loadAvailableQuests();
        document.getElementById('activeSprint').style.display = 'block';
    } catch (err) {
        console.error('Erro ao carregar sprint ativa:', err);
    }
}

function renderActiveSprint({ sprint, metrics, by_faction, top_performers }) {
    const health = HEALTH_CONFIG[metrics.health_score] || HEALTH_CONFIG.on_track;

    // Badge de saúde
    const badge = document.getElementById('sprintHealthBadge');
    badge.textContent        = health.label;
    badge.style.background   = health.color;

    // Info card
    document.getElementById('activeSprintName').textContent   = sprint.name;
    document.getElementById('activeSprintGoal').textContent   = sprint.goal || '—';
    document.getElementById('activeSprintDaysLeft').textContent = `${metrics.days_remaining}d`;

    const fmt = d => new Date(d).toLocaleDateString('pt-BR');
    document.getElementById('activeSprintPeriod').textContent =
        `${fmt(sprint.start_date)} → ${fmt(sprint.end_date)}`;

    // Barras de progresso
    document.getElementById('sprintTimePct').textContent       = `${metrics.time_pct}%`;
    document.getElementById('sprintTimeBar').style.width       = `${metrics.time_pct}%`;
    document.getElementById('sprintCompletionPct').textContent = `${metrics.completion_pct}%`;
    document.getElementById('sprintCompletionBar').style.width = `${metrics.completion_pct}%`;

    // Métricas
    document.getElementById('mTotal').textContent      = metrics.total_quests;
    document.getElementById('mDone').textContent       = metrics.done_quests;
    document.getElementById('mInProgress').textContent = metrics.in_progress;
    document.getElementById('mXp').textContent         = metrics.total_xp.toLocaleString('pt-BR');
    document.getElementById('mCoins').textContent      = `💰 ${metrics.total_coins.toLocaleString('pt-BR')}`;

    // Fações
    const factionGrid = document.getElementById('sprintFactionGrid');
    const entries = Object.entries(by_faction);
    factionGrid.innerHTML = entries.length
        ? entries.map(([name, data]) => {
            const pct = data.total > 0 ? Math.round((data.done / data.total) * 100) : 0;
            return `
                <div class="faction-card">
                    <h3 class="faction-name">${FACTION_ICONS[name] || '🏰'} ${name}</h3>
                    <div style="font-size:9px; display:flex; flex-direction:column; gap:6px;">
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:#bdc3c7;">Total</span><span>${data.total}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:#27ae60;">Concluídas</span><span>${data.done}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:#e67e22;">Em progresso</span><span>${data.in_progress}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:#3498db;">XP gerado</span><span>${(data.xp || 0).toLocaleString('pt-BR')}</span>
                        </div>
                        <div style="background:#2c3e50; height:5px; border-radius:2px; margin-top:4px; overflow:hidden;">
                            <div style="height:100%; width:${pct}%; background:#27ae60;"></div>
                        </div>
                        <div style="text-align:right; color:#7f8c8d; font-size:8px;">${pct}%</div>
                    </div>
                </div>
            `;
        }).join('')
        : '<div style="font-size:8px; color:#7f8c8d;">Nenhuma quest nesta sprint ainda.</div>';

    // Top performers
    const performersEl = document.getElementById('sprintTopPerformers');
    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
    performersEl.innerHTML = top_performers.length
        ? top_performers.map((p, i) => `
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:9px; padding:6px 0; border-bottom:1px solid #2c3e50;">
                <span>${medals[i]} ${p.user.nome || p.user.username}</span>
                <div style="display:flex; gap:12px;">
                    <span style="color:#3498db;">${p.done} quest(s)</span>
                    <span style="color:#2ecc71;">${p.xp.toLocaleString('pt-BR')} XP</span>
                </div>
            </div>
        `).join('')
        : '<div style="font-size:8px; color:#7f8c8d;">Nenhuma quest concluída ainda.</div>';
}

async function loadAvailableQuests() {
    if (!activeSprintId) return;
    try {
        const res    = await fetch(`${API_URL}/quests/all`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const quests = await res.json();

        // Quests sem sprint atribuída (ou sem sprint_id)
        const available = quests.filter(q => !q.sprint_id && q.status !== 'done');
        const select    = document.getElementById('questsToAdd');
        select.innerHTML = available.length
            ? available.map(q => `<option value="${q._id}">[${q.faction}] ${q.title}</option>`).join('')
            : '<option disabled>Nenhuma quest disponível</option>';
    } catch (err) {
        console.error('Erro ao carregar quests disponíveis:', err);
    }
}

window.addQuestsToActiveSprint = async () => {
    const select    = document.getElementById('questsToAdd');
    const selected  = Array.from(select.selectedOptions).map(o => o.value);
    if (!selected.length) { showToast('Selecione ao menos uma quest.', 'error'); return; }

    try {
        const res = await fetch(`${API_URL}/sprints/${activeSprintId}/quests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ quest_ids: selected })
        });

        if (res.ok) {
            showToast(`${selected.length} quest(s) adicionada(s) à sprint!`);
            await loadPage();
        } else {
            const err = await res.json();
            showToast(err.message || 'Erro ao adicionar quests.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Erro de conexão.', 'error');
    }
};

// ==========================================
// 2. HISTÓRICO DE SPRINTS
// ==========================================
const STATUS_CONFIG = {
    planning:  { label: 'Planning',  color: '#3498db' },
    active:    { label: 'Ativa',     color: '#27ae60' },
    completed: { label: 'Concluída', color: '#7f8c8d' },
    cancelled: { label: 'Cancelada', color: '#e74c3c' }
};

async function loadAllSprints() {
    try {
        const res    = await fetch(`${API_URL}/sprints`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const sprints = await res.json();
        renderSprintsList(sprints);
    } catch (err) {
        console.error('Erro ao carregar sprints:', err);
    }
}

function renderSprintsList(sprints) {
    const container = document.getElementById('sprintsList');
    if (!sprints.length) {
        container.innerHTML = '<div style="font-size:8px; color:#7f8c8d; padding:12px;">Nenhuma sprint forjada ainda.</div>';
        return;
    }

    const fmt = d => new Date(d).toLocaleDateString('pt-BR');

    container.innerHTML = sprints.map(s => {
        const st  = STATUS_CONFIG[s.status] || STATUS_CONFIG.planning;
        const pct = s.completion_pct || 0;

        return `
            <div style="border:2px solid #2c3e50; padding:12px; margin-bottom:8px; background:#1a252f;" data-cy="sprint-item">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:8px;">
                    <div style="flex:1; min-width:0;">
                        <a href="admin-sprint-board.html?id=${s._id}" style="font-size:10px; color:#f1c40f; text-decoration:none; cursor:pointer;" data-cy="btn-open-sprint-board"
                           onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${s.name} ↗</a>
                        ${s.goal ? `<div style="font-size:8px; color:#7f8c8d; margin-top:2px;">${s.goal}</div>` : ''}
                        <div style="font-size:8px; color:#bdc3c7; margin-top:4px;">
                            ${fmt(s.start_date)} → ${fmt(s.end_date)} &nbsp;|&nbsp; ${s.duration_days} dias
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        <span class="status-badge" style="background:${st.color}; font-size:8px; padding:3px 8px;">${st.label}</span>
                        <span style="font-size:9px; color:#2ecc71;">${s.quests_done || 0}/${s.quest_count || 0} quests</span>
                        <a href="admin-sprint-board.html?id=${s._id}" class="btn-pixel" data-cy="btn-view-board" style="font-size:7px; padding:4px 8px; background:#2980b9; text-decoration:none; display:inline-block;">Board</a>
                        <button class="btn-pixel" data-cy="btn-edit-sprint" style="font-size:7px; padding:4px 8px;" onclick="openEditSprintModal('${s._id}', ${JSON.stringify(s).replace(/"/g, '&quot;')})">Editar</button>
                        <button class="btn-pixel" data-cy="btn-delete-sprint" style="font-size:7px; padding:4px 8px; background:#e74c3c;" onclick="deleteSprint('${s._id}')">Excluir</button>
                    </div>
                </div>
                <div style="margin-top:8px;">
                    <div style="background:#2c3e50; height:5px; border-radius:2px; overflow:hidden;">
                        <div style="height:100%; width:${pct}%; background:#27ae60;"></div>
                    </div>
                    <div style="text-align:right; font-size:7px; color:#7f8c8d; margin-top:2px;">${pct}% concluída</div>
                </div>
            </div>
        `;
    }).join('');
}

// ==========================================
// 3. FORMULÁRIO — CRIAR SPRINT
// ==========================================
function setupSprintForm() {
    const form = document.getElementById('sprintForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const factions = ['factionProduto', 'factionSuporte', 'factionCS']
            .filter(id => document.getElementById(id)?.checked)
            .map(id => document.getElementById(id).value);

        const payload = {
            name:          document.getElementById('sprintName').value.trim(),
            goal:          document.getElementById('sprintGoal').value.trim() || null,
            start_date:    document.getElementById('sprintStart').value,
            duration_days: parseInt(document.getElementById('sprintDuration').value),
            factions
        };

        try {
            const res = await fetch(`${API_URL}/sprints`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                showToast('Sprint forjada com sucesso!');
                form.reset();
                await loadPage();
            } else {
                const err = await res.json();
                showToast(err.message || 'Erro ao criar sprint.', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Erro de conexão.', 'error');
        }
    });
}

// ==========================================
// 4. MODAL DE EDIÇÃO
// ==========================================
window.openEditSprintModal = (id, sprint) => {
    document.getElementById('editSprintId').value   = id;
    document.getElementById('editSprintName').value = sprint.name;
    document.getElementById('editSprintGoal').value = sprint.goal || '';

    const startDate = sprint.start_date ? sprint.start_date.slice(0, 10) : '';
    document.getElementById('editSprintStart').value    = startDate;
    document.getElementById('editSprintDuration').value = sprint.duration_days;
    document.getElementById('editSprintStatus').value   = sprint.status;

    document.getElementById('editSprintModal').style.display = 'flex';
};

window.closeEditSprintModal = () => {
    document.getElementById('editSprintModal').style.display = 'none';
};

async function submitEditSprint(e) {
    e.preventDefault();

    const id = document.getElementById('editSprintId').value;
    const payload = {
        name:          document.getElementById('editSprintName').value.trim(),
        goal:          document.getElementById('editSprintGoal').value.trim() || null,
        start_date:    document.getElementById('editSprintStart').value,
        duration_days: parseInt(document.getElementById('editSprintDuration').value),
        status:        document.getElementById('editSprintStatus').value
    };

    try {
        const res = await fetch(`${API_URL}/sprints/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            showToast('Sprint atualizada com sucesso!');
            closeEditSprintModal();
            await loadPage();
        } else {
            const err = await res.json();
            showToast(err.message || 'Erro ao atualizar sprint.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Erro de conexão.', 'error');
    }
}

// ==========================================
// 5. EXCLUSÃO
// ==========================================
window.deleteSprint = async (id) => {
    if (!confirm('Excluir esta sprint? As quests vinculadas serão desvinculadas.')) return;

    try {
        const res = await fetch(`${API_URL}/sprints/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            showToast('Sprint removida.');
            await loadPage();
        } else {
            const err = await res.json();
            showToast(err.message || 'Erro ao remover sprint.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Erro de conexão.', 'error');
    }
};
