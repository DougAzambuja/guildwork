// ==========================================
// 0. PROTEÇÃO E INICIALIZAÇÃO
// ==========================================
const token = localStorage.getItem('guild_token');
let activeSprintId = null; // ID da sprint com status 'active' (para adicionar quests)
let viewSprintId   = null; // ID da sprint exibida no dashboard

document.addEventListener('DOMContentLoaded', () => {
    if (!token || localStorage.getItem('guild_role') !== 'admin') {
        window.location.href = 'login.html';
        return;
    }

    setupSprintForm();
    document.getElementById('editSprintForm').addEventListener('submit', submitEditSprint);

    loadPage();
});

async function loadPage() {
    await loadAllSprints();
    hideLoadingOverlay();
}

// ==========================================
// 1. SPRINT DASHBOARD (selecionável)
// ==========================================
const HEALTH_CONFIG = {
    on_track: { label: '✅ NO RITMO',  color: '#27ae60' },
    at_risk:  { label: '⚠️ EM RISCO',  color: '#e67e22' },
    behind:   { label: '🚨 ATRASADA',  color: '#e74c3c' }
};

const FACTION_ICONS = { Produto: '📦', Suporte: '🎧', 'Customer Service': '📣' };

async function loadSprintDashboard(sprintId) {
    if (!sprintId) return;
    viewSprintId = sprintId;
    try {
        const res  = await fetch(`${API_URL}/sprints/${sprintId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        renderActiveSprint(data);
        document.getElementById('sprintDashboardContent').style.display = 'block';
    } catch (err) {
        console.error('Erro ao carregar dashboard da sprint:', err);
    }
}

window.onSprintSelectorChange = async (sprintId) => {
    if (!sprintId) return;
    document.getElementById('sprintDashboardContent').style.display = 'none';
    await loadSprintDashboard(sprintId);
};

function renderActiveSprint({ sprint, metrics, by_faction, top_performers }) {
    const health = HEALTH_CONFIG[metrics.health_score] || HEALTH_CONFIG.on_track;

    // Badge de saúde
    const badge = document.getElementById('sprintHealthBadge');
    badge.textContent      = health.label;
    badge.style.background = health.color;
    badge.style.display    = 'inline-block';

    // Info card
    document.getElementById('activeSprintName').textContent    = sprint.name;
    document.getElementById('activeSprintGoal').textContent    = sprint.goal || '—';
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

    // Facções
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

    // Top performers — cards enriquecidos
    const performersEl = document.getElementById('sprintTopPerformers');
    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
    const DEFAULT_AVATAR = 'assets/imgs/caneca_pixel.jpg';

    performersEl.innerHTML = top_performers.length
        ? `<div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:10px;">
            ${top_performers.map((p, i) => {
                const name   = p.user.nome || p.user.username || '—';
                const avatar = p.user.avatar_url || DEFAULT_AVATAR;
                const pct    = metrics.total_quests > 0
                    ? Math.round((p.done / metrics.total_quests) * 100) : 0;
                return `
                <div style="background:#1a252f; border:2px solid #2c3e50; border-left:4px solid #f1c40f; padding:12px; display:flex; gap:10px; align-items:center;" data-cy="performer-card">
                    <div style="font-size:18px; flex-shrink:0; line-height:1;">${medals[i]}</div>
                    <img src="${avatar}" alt=""
                         style="width:36px; height:36px; border:2px solid #f1c40f; object-fit:cover; image-rendering:pixelated; flex-shrink:0;"
                         onerror="this.src='${DEFAULT_AVATAR}'">
                    <div style="min-width:0; flex:1;">
                        <div style="font-size:9px; color:#f1c40f; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${name}">${name}</div>
                        <div style="display:flex; gap:8px; margin-top:5px; flex-wrap:wrap;">
                            <span style="font-size:8px; color:#2ecc71;">${p.xp.toLocaleString('pt-BR')} XP</span>
                            <span style="font-size:8px; color:#3498db;">${p.done} quest(s)</span>
                        </div>
                        <div style="background:#2c3e50; height:4px; border-radius:2px; margin-top:6px; overflow:hidden;">
                            <div style="height:100%; width:${pct}%; background:#f1c40f;"></div>
                        </div>
                    </div>
                </div>`;
            }).join('')}
           </div>`
        : '<div style="font-size:8px; color:#7f8c8d; padding:8px 0;">Nenhuma quest concluída ainda.</div>';

    // Exibe "ADICIONAR QUESTS" somente quando visualizando a sprint ativa
    const addSection = document.getElementById('addQuestsSection');
    if (addSection) {
        const isActive = sprint.status === 'active' || String(sprint._id) === activeSprintId;
        addSection.style.display = isActive ? 'block' : 'none';
    }
}

async function loadAvailableQuests() {
    if (!activeSprintId) return;
    try {
        const res  = await fetch(`${API_URL}/quests/all?sprint_id=backlog&limit=100`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const available = (Array.isArray(data) ? data : (data.quests || []))
            .filter(q => q.status !== 'done');

        const select = document.getElementById('questsToAdd');
        if (!select) return;
        select.innerHTML = available.length
            ? available.map(q => `<option value="${q._id}">[${q.faction}] ${q.title}</option>`).join('')
            : '<option disabled style="color:#7f8c8d;">Nenhuma quest no backlog</option>';
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

// serve (npx serve) faz 301 de *.html?param=x → * dropando o query string.
// Usamos sessionStorage para passar o sprint ID de forma confiável.
window.goToBoard = function (sprintId) {
    sessionStorage.setItem('admin_board_sprint_id', sprintId);
    window.location.href = 'admin-sprint-board.html?id=' + sprintId;
};

const STATUS_CONFIG = {
    planning:  { label: 'Planning',  color: '#3498db' },
    active:    { label: 'Ativa',     color: '#27ae60' },
    completed: { label: 'Concluída', color: '#7f8c8d' },
    cancelled: { label: 'Cancelada', color: '#e74c3c' }
};

async function loadAllSprints() {
    try {
        const res     = await fetch(`${API_URL}/sprints`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const sprints = await res.json();

        renderSprintsList(sprints);
        populateSprintSelector(sprints);
    } catch (err) {
        console.error('Erro ao carregar sprints:', err);
    }
}

function populateSprintSelector(sprints) {
    const selector = document.getElementById('viewSprintSelect');
    if (!selector) return;

    if (!sprints.length) {
        selector.innerHTML = '<option value="">Nenhuma sprint</option>';
        document.getElementById('noSprintsMsg').style.display = 'block';
        return;
    }

    const STATUS_SPRINT_LABELS = {
        planning:  '📋',
        active:    '⚡',
        completed: '✅',
        cancelled: '❌'
    };

    selector.innerHTML = sprints.map(s =>
        `<option value="${s._id}">${STATUS_SPRINT_LABELS[s.status] || ''} ${s.name}</option>`
    ).join('');

    // Detecta sprint ativa para controles de "Adicionar Quests"
    const active = sprints.find(s => s.status === 'active');
    activeSprintId = active ? String(active._id) : null;

    // Pré-seleciona: sprint ativa ou a primeira da lista
    const defaultId = activeSprintId || String(sprints[0]._id);
    selector.value = defaultId;

    // Carrega dashboard + quests disponíveis em paralelo
    Promise.all([
        loadSprintDashboard(defaultId),
        loadAvailableQuests()
    ]);
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
                           onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'"
                           onclick="event.preventDefault(); goToBoard('${s._id}')">${s.name} ↗</a>
                        ${s.goal ? `<div style="font-size:8px; color:#7f8c8d; margin-top:2px;">${s.goal}</div>` : ''}
                        <div style="font-size:8px; color:#bdc3c7; margin-top:4px;">
                            ${fmt(s.start_date)} → ${fmt(s.end_date)} &nbsp;|&nbsp; ${s.duration_days} dias
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        <span class="status-badge" style="background:${st.color}; font-size:8px; padding:3px 8px;">${st.label}</span>
                        <span style="font-size:9px; color:#2ecc71;">${s.quests_done || 0}/${s.quest_count || 0} quests</span>
                        <button class="btn-pixel" data-cy="btn-view-board" style="font-size:7px; padding:4px 8px; background:#2980b9;" onclick="goToBoard('${s._id}')">Board</button>
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
