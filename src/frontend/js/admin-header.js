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
        { id: 'profile',   label: '👤 Perfil',     href: 'admin-profile.html', cy: 'tab-profile'   },
    ];

    function detectActiveTab() {
        const p = window.location.pathname.toLowerCase();
        if (p.includes('admin-quests'))   return 'quests';
        if (p.includes('admin-loot'))     return 'loot';
        if (p.includes('admin-roster'))   return 'roster';
        if (p.includes('admin-sprint'))   return 'sprints';
        if (p.includes('admin-metrics'))  return 'metrics';
        if (p.includes('admin-profile'))  return 'profile';
        return 'dashboard';
    }

    function render() {
        const el = document.getElementById('admin-header');
        if (!el) return;

        const activeTab  = detectActiveTab();
        const adminName  = localStorage.getItem('guild_user')       || 'Mestre da Guilda';
        const adminUser  = localStorage.getItem('guild_username')    || 'admin';
        const adminAvatar= localStorage.getItem('guild_avatar')      || (typeof dicebearUrl === 'function' ? dicebearUrl(adminUser) : '');

        const navLinks = TABS.map(t =>
            `<a href="${t.href}" class="admin-tab${t.id === activeTab ? ' active' : ''}" data-cy="${t.cy}">${t.label}</a>`
        ).join('');

        el.innerHTML = `
            <div class="top-bar">
                <div class="player-info">
                    <a href="admin-profile.html" style="display:contents;" title="Editar perfil">
                        <img src="${adminAvatar}" alt="avatar"
                             class="avatar" data-cy="admin-avatar"
                             style="width:40px;height:40px;object-fit:cover;cursor:pointer;border:2px solid #f1c40f;image-rendering:pixelated;"
                             onerror="this.src='${typeof dicebearUrl === 'function' ? dicebearUrl(adminUser) : ''}'">
                    </a>
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
