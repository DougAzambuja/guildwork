// Componente de header compartilhado para todas as telas do painel admin.
// Incluir APÓS config.js e utils.js, ANTES de notifications.js.
// O script detecta automaticamente a aba ativa pela URL.
(function () {
    const TABS = [
        { id: 'dashboard', label: '📈 Dashboard', href: 'admin.html',         cy: 'tab-dashboard' },
        { id: 'quests',    label: '⚔️ Missões',   href: 'admin-quests.html',  cy: 'tab-quests'    },
        { id: 'loot',      label: '🔨 Loot',       href: 'admin-loot.html',    cy: 'tab-loot'      },
        { id: 'roster',    label: '🛡️ Membros',   href: 'admin-roster.html',  cy: 'tab-roster'    },
        { id: 'sprints',   label: '🏃 Sprints',    href: 'admin-sprints.html', cy: 'tab-sprints'   },
        { id: 'metrics',   label: '📊 Métricas',   href: 'admin-metrics.html', cy: 'tab-metrics'   },
    ];

    function detectActiveTab() {
        const p = window.location.pathname.toLowerCase();
        if (p.includes('admin-quests'))   return 'quests';
        if (p.includes('admin-loot'))     return 'loot';
        if (p.includes('admin-roster'))   return 'roster';
        if (p.includes('admin-sprint'))   return 'sprints'; // admin-sprints e admin-sprint-board
        if (p.includes('admin-metrics'))  return 'metrics';
        return 'dashboard';
    }

    function render() {
        const el = document.getElementById('admin-header');
        if (!el) return;

        const activeTab = detectActiveTab();
        const adminName = localStorage.getItem('guild_user') || 'Mestre da Guilda';

        const navLinks = TABS.map(t =>
            `<a href="${t.href}" class="admin-tab${t.id === activeTab ? ' active' : ''}" data-cy="${t.cy}">${t.label}</a>`
        ).join('');

        el.innerHTML = `
            <div class="top-bar">
                <div class="player-info">
                    <div class="avatar" style="background-color:#f1c40f;display:flex;align-items:center;justify-content:center;font-size:8px;text-align:center;">DM</div>
                    <div class="stats">
                        <h1 id="playerName" data-cy="admin-name">${adminName}</h1>
                        <div style="font-size:10px;color:#7f8c8d;">Centro de Comando</div>
                    </div>
                </div>
                <div class="actions" id="adminActions">
                    <button class="btn-pixel logout-btn" data-cy="btn-logout" onclick="logout()">Sair</button>
                </div>
            </div>
            <nav class="admin-tabs" id="adminNav">${navLinks}</nav>
        `;
    }

    // Ao rodar no final do <body>, readyState já é 'interactive' — chama direto.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', render);
    } else {
        render();
    }
})();
