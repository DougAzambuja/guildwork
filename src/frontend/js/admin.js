// ==========================================
// 0. PROTEÇÃO E INICIALIZAÇÃO
// ==========================================
const token = localStorage.getItem('guild_token');

document.addEventListener('DOMContentLoaded', () => {
    if (!token || localStorage.getItem('guild_role') !== 'admin') {
        window.location.href = 'login.html';
        return;
    }
    initDashboard();
});

async function initDashboard() {
    await loadDashboard();
    hideLoadingOverlay();
    setInterval(loadDashboard, 30000);
}

async function loadDashboard() {
    try {
        const [rosterRes, sprintsRes] = await Promise.all([
            fetch(`${API_URL}/admin/roster`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${API_URL}/sprints`,       { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (rosterRes.ok)  renderDashboardStats(await rosterRes.json());
        if (sprintsRes.ok) populateDashSprintSelector(await sprintsRes.json());
    } catch (err) {
        console.error('Erro ao carregar dashboard:', err);
    }
}

// ==========================================
// 1. DASHBOARD — SPRINT
// ==========================================
const HEALTH_LABELS = {
    on_track: { label: '✅ NO RITMO',  color: '#27ae60' },
    at_risk:  { label: '⚠️ EM RISCO',  color: '#e67e22' },
    behind:   { label: '🚨 ATRASADA',  color: '#e74c3c' }
};
const STATUS_SPRINT_LABELS_DASH = {
    active:    '⚡',
    planning:  '📋',
    completed: '✅',
    cancelled: '❌'
};
const FACTION_ICONS_DASH = { Produto: '📦', Suporte: '🎧', 'Customer Service': '📣' };

function populateDashSprintSelector(sprints) {
    const section = document.getElementById('dashSprintSection');
    const select  = document.getElementById('dashSprintSelect');
    if (!section || !select) return;

    if (!sprints || sprints.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    select.innerHTML = sprints.map(s =>
        `<option value="${s._id}">${STATUS_SPRINT_LABELS_DASH[s.status] || ''} ${s.name}</option>`
    ).join('');

    // Prefere a sprint ativa; senão a primeira da lista
    const active = sprints.find(s => s.status === 'active');
    const defaultId = active ? String(active._id) : String(sprints[0]._id);
    select.value = defaultId;

    loadDashSprintData(defaultId);
}

async function loadDashSprintData(sprintId) {
    try {
        const res = await fetch(`${API_URL}/sprints/${sprintId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) renderActiveSprint(await res.json());
    } catch (err) {
        console.error('Erro ao carregar sprint do dashboard:', err);
    }
}

window.onDashSprintChange = (sprintId) => {
    if (sprintId) loadDashSprintData(sprintId);
};

function renderActiveSprint(data) {
    if (!data || !data.sprint) return;

    const { sprint, metrics, by_faction } = data;

    const health = HEALTH_LABELS[metrics.health_score] || HEALTH_LABELS.on_track;
    const badge  = document.getElementById('dashSprintHealth');
    if (badge) {
        badge.textContent      = health.label;
        badge.style.background = health.color;
        badge.style.display    = 'inline-block';
    }

    const link = document.getElementById('dashSprintBoardLink');
    if (link) {
        link.href = `admin-sprint-board.html?id=${sprint._id}`;
        link.onclick = (e) => {
            e.preventDefault();
            sessionStorage.setItem('admin_board_sprint_id', sprint._id);
            window.location.href = link.href;
        };
    }

    const fmt = d => new Date(d).toLocaleDateString('pt-BR');
    document.getElementById('dashSprintName').textContent     = sprint.name;
    document.getElementById('dashSprintPeriod').textContent   = `${fmt(sprint.start_date)} → ${fmt(sprint.end_date)}`;
    document.getElementById('dashSprintDaysLeft').textContent = `${metrics.days_remaining}d`;
    document.getElementById('dashSprintQuests').textContent   = `${metrics.done_quests}/${metrics.total_quests} concluídas`;
    document.getElementById('dashSprintPct').textContent      = `${metrics.completion_pct}%`;
    document.getElementById('dashSprintBar').style.width      = `${metrics.completion_pct}%`;

    const factionsEl = document.getElementById('dashSprintFactions');
    if (factionsEl) {
        const entries = Object.entries(by_faction || {});
        factionsEl.innerHTML = entries.length
            ? entries.map(([name, d]) => {
                const pct = d.total > 0 ? Math.round((d.done / d.total) * 100) : 0;
                return `
                    <div style="background:#0d1b2a; border:1px solid #2c3e50; padding:8px 10px; min-width:120px; flex:1;">
                        <div style="font-size:8px; color:#f1c40f; margin-bottom:4px;">${FACTION_ICONS_DASH[name] || '🏰'} ${name}</div>
                        <div style="font-size:8px; color:#bdc3c7;">${d.done}/${d.total} quests</div>
                        <div style="background:#1a252f; height:4px; margin-top:5px; border-radius:2px; overflow:hidden;">
                            <div style="height:100%; width:${pct}%; background:${pct === 100 ? '#27ae60' : pct >= 50 ? '#e67e22' : '#e74c3c'};"></div>
                        </div>
                    </div>
                `;
            }).join('')
            : '<div style="font-size:7px;color:#7f8c8d;">Sem facções mapeadas.</div>';
    }
}

// ==========================================
// 2. DASHBOARD — MÉTRICAS E FACÇÕES
// ==========================================
function renderDashboardStats(players) {
    const totalGold = players.reduce((sum, p) => sum + (p.coins || 0), 0);
    const goldEl = document.getElementById('repTotalGold');
    if (goldEl) goldEl.innerText = totalGold.toLocaleString('pt-BR');

    const cursed   = players.filter(p => p.is_cursed).length;
    const slaScore = players.length > 0
        ? Math.round(((players.length - cursed) / players.length) * 100)
        : 100;
    const slaEl = document.getElementById('repSlaHealth');
    if (slaEl) slaEl.innerText = `${slaScore}%`;

    const performers = [...players]
        .sort((a, b) => (b.xp || 0) - (a.xp || 0))
        .slice(0, 3);

    const medals = ['🥇', '🥈', '🥉'];
    const list   = document.getElementById('topPerformersList');
    if (list) {
        list.innerHTML = performers.length
            ? performers.map((p, i) => `
                <div style="display:flex; justify-content:space-between; font-size:9px; padding:6px 0; border-bottom:1px solid #34495e;">
                    <span>${medals[i]} ${p.nome || p.username}</span>
                    <span style="color:#f1c40f;">${(p.xp || 0).toLocaleString('pt-BR')} XP</span>
                </div>
            `).join('')
            : '<div style="font-size:8px;color:#7f8c8d;">Nenhum aventureiro ainda.</div>';
    }

    const factions = {};
    players.forEach(p => {
        const key = p.faction || 'Sem Facção';
        if (!factions[key]) factions[key] = { members: 0, xp: 0, coins: 0, quests: 0 };
        factions[key].members++;
        factions[key].xp     += p.xp              || 0;
        factions[key].coins  += p.coins            || 0;
        factions[key].quests += p.quests_completed || 0;
    });

    const FACTION_ICONS = { Produto: '📦', Suporte: '🎧', 'Customer Service': '📣', 'Sem Facção': '❓' };
    const grid = document.getElementById('factionsGrid');
    if (grid) {
        const entries = Object.entries(factions);
        grid.innerHTML = entries.length
            ? entries.map(([name, data]) => `
                <div class="faction-card">
                    <h3 class="faction-name">${FACTION_ICONS[name] || '🏰'} ${name}</h3>
                    <div style="font-size:9px; display:flex; flex-direction:column; gap:6px;">
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:#bdc3c7;">Membros</span>
                            <span style="color:#fff;">${data.members}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:#bdc3c7;">XP Total</span>
                            <span style="color:#2ecc71;">${data.xp.toLocaleString('pt-BR')}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:#bdc3c7;">Gold Total</span>
                            <span style="color:#f1c40f;">💰 ${data.coins.toLocaleString('pt-BR')}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:#bdc3c7;">Missões</span>
                            <span style="color:#3498db;">${data.quests}</span>
                        </div>
                    </div>
                </div>
            `).join('')
            : '<div style="font-size:8px;color:#7f8c8d;padding:10px;">Nenhum aventureiro recrutado ainda.</div>';
    }
}
