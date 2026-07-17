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
    const adminName = localStorage.getItem('guild_user') || 'Mestre da Guilda';
    const nameEl    = document.getElementById('playerName');
    if (nameEl) nameEl.innerText = adminName;

    await loadDashboard();
    setInterval(loadDashboard, 30000);
}

async function loadDashboard() {
    try {
        const response = await fetch(`${API_URL}/admin/roster`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            renderDashboardStats(await response.json());
        }
    } catch (err) {
        console.error('Erro ao carregar dashboard:', err);
    }
}

// ==========================================
// 1. DASHBOARD — MÉTRICAS E FACÇÕES
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
