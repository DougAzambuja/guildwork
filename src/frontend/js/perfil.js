const token = localStorage.getItem('guild_token');
if (!token) window.location.href = 'login.html';


document.addEventListener('DOMContentLoaded', async () => {
    const id = window.location.hash.slice(1); // perfil.html#OBJECTID

    if (!id) {
        document.getElementById('perfilCard').innerHTML =
            '<div class="perfil-loading">ID do jogador não informado.</div>';
        return;
    }

    try {
        const res = await fetch(`${API_URL}/players/${id}/public`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) {
            if (res.status === 401) { localStorage.clear(); window.location.href = 'login.html'; return; }
            document.getElementById('perfilCard').innerHTML =
                '<div class="perfil-loading">Jogador não encontrado.</div>';
            return;
        }

        const p = await res.json();
        renderPerfil(p);

    } catch (err) {
        console.error(err);
        document.getElementById('perfilCard').innerHTML =
            '<div class="perfil-loading">Erro de conexão.</div>';
    }
});

function renderPerfil(p) {
    const card      = document.getElementById('perfilCard');
    const xpMax     = xpParaProximoNivel(p.level);
    const xpPct     = Math.min(100, Math.round(((p.xp || 0) / xpMax) * 100));
    const guildIcon = GUILD_ICONS[p.faction] || '🏰';
    const unlockedKeys = new Set((p.achievements || []).map(a => a.key));

    // Banner de maldição
    let curseBanner = '';
    if (p.is_cursed && p.curse_type && CURSE_CONFIG[p.curse_type]) {
        const cfg = CURSE_CONFIG[p.curse_type];
        curseBanner = `
            <div class="perfil-curse-banner" style="background:rgba(0,0,0,0.3);border:1px solid ${cfg.color};color:${cfg.color};margin:16px 20px 0;">
                ${cfg.icon} ${cfg.label} ativa
            </div>
        `;
    }

    // Stats agregados
    const s = p.stats || {};
    const streak   = p.delivery_streak || 0;
    const lastStat = s.avg_csat != null
        ? { icon: '⭐', value: `${s.avg_csat}★`, label: 'CSAT médio' }
        : { icon: '🛡️', value: s.clean_rate != null ? `${s.clean_rate}%` : '—', label: 'Taxa limpa' };

    // Conquistas
    const achievementsHtml = ALL_ACHIEVEMENTS.map(a => {
        const unlocked      = unlockedKeys.has(a.key);
        const [icon, ...rest] = a.title.split(' ');
        const name          = rest.join(' ');
        return `
            <div class="achievement-badge ${unlocked ? 'unlocked' : 'locked'}" data-cy="badge-${a.key}">
                <span class="achievement-icon">${unlocked ? icon : '🔒'}</span>
                <div style="flex:1;">
                    <div class="achievement-name">${name}</div>
                    <div class="achievement-desc">${a.desc}</div>
                </div>
                ${unlocked ? '<span class="achievement-check">✓</span>' : ''}
            </div>
        `;
    }).join('');

    card.innerHTML = `
        <div class="perfil-header">
            <div class="perfil-avatar-wrap">
                <img class="perfil-avatar" src="${p.avatar_url || 'assets/imgs/caneca_pixel.jpg'}" alt="Avatar" data-cy="perfil-avatar">
                <div class="perfil-level-badge">Lv.${p.level}</div>
            </div>
            <div class="perfil-info">
                <div class="perfil-nome" data-cy="perfil-nome">${p.nome || p.username}</div>
                <div class="perfil-faction-badge">${guildIcon} ${p.faction}</div>
                <div class="perfil-xp-label">
                    <span>XP</span>
                    <span>${(p.xp || 0).toLocaleString('pt-BR')} / ${xpMax.toLocaleString('pt-BR')}</span>
                </div>
                <div class="perfil-xp-track">
                    <div class="perfil-xp-fill" style="width:${xpPct}%"></div>
                </div>
            </div>
        </div>

        ${curseBanner}

        <div class="perfil-stats">
            <div class="perfil-stat">
                <span class="perfil-stat-icon">⚔️</span>
                <span class="perfil-stat-value">${p.quests_completed || 0}</span>
                <span class="perfil-stat-label">Missões</span>
            </div>
            <div class="perfil-stat">
                <span class="perfil-stat-icon">🏅</span>
                <span class="perfil-stat-value">${unlockedKeys.size}</span>
                <span class="perfil-stat-label">Conquistas</span>
            </div>
            <div class="perfil-stat">
                <span class="perfil-stat-icon">🔥</span>
                <span class="perfil-stat-value">${streak > 0 ? streak : '—'}</span>
                <span class="perfil-stat-label">Streak dias</span>
            </div>
            <div class="perfil-stat">
                <span class="perfil-stat-icon">✨</span>
                <span class="perfil-stat-value">${(s.total_xp_earned || 0).toLocaleString('pt-BR')}</span>
                <span class="perfil-stat-label">XP Total</span>
            </div>
            <div class="perfil-stat">
                <span class="perfil-stat-icon">💰</span>
                <span class="perfil-stat-value">${(p.coins || 0).toLocaleString('pt-BR')}</span>
                <span class="perfil-stat-label">Gold atual</span>
            </div>
            <div class="perfil-stat">
                <span class="perfil-stat-icon">${lastStat.icon}</span>
                <span class="perfil-stat-value">${lastStat.value}</span>
                <span class="perfil-stat-label">${lastStat.label}</span>
            </div>
        </div>

        <div class="perfil-section-title">CONQUISTAS</div>
        <div class="perfil-achievements" data-cy="perfil-achievements">
            ${achievementsHtml}
        </div>
    `;

    document.title = `GuildWork - ${p.nome || p.username}`;
}
