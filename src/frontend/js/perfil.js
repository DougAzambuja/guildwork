const token = localStorage.getItem('guild_token');
if (!token) window.location.href = 'login.html';

let pendingAvatar = '';
let isDirty = false;

// Intercepta o botão Voltar com modal customizado
window.handleVoltar = () => {
    if (isDirty) {
        document.getElementById('unsavedModal').style.display = 'flex';
    } else {
        history.back();
    }
};

// Usuário confirma que quer sair sem salvar
window.confirmUnsavedExit = () => {
    isDirty = false; // limpa antes de navegar para o beforeunload não interceptar
    history.back();
};

// Fallback para fechar aba / digitar outra URL no browser
window.addEventListener('beforeunload', (e) => {
    if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
    }
});

const AVATAR_CLASSES = [
    { src: 'assets/imgs/caneca_pixel.jpg',  label: 'Mago do Café' },
    { src: 'assets/imgs/mouse_pixel.jpg',   label: 'Guerreiro do Clique' },
    { src: 'assets/imgs/mochila_pixel.jpg', label: 'Ladino Suporte' },
    { src: 'assets/imgs/caneta_pixel.jpg',  label: 'Escudeiro de QA' },
];

let _dicebearUsername = '';

async function initPerfil() {
    const id = window.location.hash.slice(1);

    if (!id) {
        document.getElementById('perfilCard').innerHTML =
            '<div class="perfil-loading">ID do jogador não informado.</div>';
        return;
    }

    try {
        const [publicRes, meRes] = await Promise.all([
            fetch(`${API_URL}/players/${id}/public`, { headers: { Authorization: `Bearer ${token}` } }),
            fetch(`${API_URL}/players/me`,            { headers: { Authorization: `Bearer ${token}` } })
        ]);

        if (!publicRes.ok) {
            if (publicRes.status === 401) { localStorage.clear(); window.location.href = 'login.html'; return; }
            document.getElementById('perfilCard').innerHTML =
                '<div class="perfil-loading">Jogador não encontrado.</div>';
            return;
        }

        const p  = await publicRes.json();
        const me = meRes.ok ? await meRes.json() : null;

        const isOwnProfile = me && me._id === id;
        renderPerfil(p, isOwnProfile ? me : null);

    } catch (err) {
        console.error(err);
        document.getElementById('perfilCard').innerHTML =
            '<div class="perfil-loading">Erro de conexão.</div>';
    }
}

document.addEventListener('DOMContentLoaded', initPerfil);
window.addEventListener('pageshow', (e) => { if (e.persisted) initPerfil(); });

function selectAvatarPerfil(src) {
    pendingAvatar = src;
    isDirty = true;
    const preview = document.getElementById('perfilAvatarImg');
    if (preview) preview.src = src;

    document.querySelectorAll('.perfil-avatar-opt').forEach(el => {
        el.style.borderColor = el.getAttribute('data-src') === src ? '#f39c12' : '#2c3e50';
    });

    const urlInput = document.getElementById('perfilAvatarUrl');
    if (urlInput) urlInput.value = '';
}

window.selectAvatarPerfil = selectAvatarPerfil;

function renderPerfil(p, me) {
    const card      = document.getElementById('perfilCard');
    const xpMax     = xpParaProximoNivel(p.level);
    const xpPct     = Math.min(100, Math.round(((p.xp || 0) / xpMax) * 100));
    const guildIcon = GUILD_ICONS[p.faction] || '🏰';
    const unlockedKeys = new Set((p.achievements || []).map(a => a.key));

    pendingAvatar = p.avatar_url || dicebearUrl(p.username);
    _dicebearUsername = p.username || '';

    // Banner de maldição
    let curseBanner = '';
    if (p.is_cursed && p.curse_type && CURSE_CONFIG[p.curse_type]) {
        const cfg = CURSE_CONFIG[p.curse_type];
        curseBanner = `
            <div class="perfil-curse-banner" style="background:rgba(0,0,0,0.3);border:1px solid ${cfg.color};color:${cfg.color};margin:16px 20px 0;">
                ${cfg.icon} ${cfg.label} ativa
            </div>`;
    }

    // Stats
    const s       = p.stats || {};
    const streak  = p.delivery_streak || 0;
    const lastStat = s.avg_csat != null
        ? { icon: '⭐', value: `${s.avg_csat}★`, label: 'CSAT médio' }
        : { icon: '🛡️', value: s.clean_rate != null ? `${s.clean_rate}%` : '—', label: 'Taxa limpa' };

    // Conquistas
    const achievementsHtml = ALL_ACHIEVEMENTS.map(a => {
        const unlocked        = unlockedKeys.has(a.key);
        const [icon, ...rest] = a.title.split(' ');
        const stored          = (p.achievements || []).find(u => u.key === a.key);
        const dateStr         = stored?.unlocked_at
            ? new Date(stored.unlocked_at).toLocaleDateString('pt-BR') : '';
        return `
            <div class="achievement-badge ${unlocked ? 'unlocked' : 'locked'}" data-cy="badge-${a.key}">
                <span class="achievement-icon">${unlocked ? icon : '🔒'}</span>
                <div style="flex:1;">
                    <div class="achievement-name">${rest.join(' ')}</div>
                    <div class="achievement-desc">${unlocked && dateStr ? `Desbloqueado em ${dateStr}` : a.desc}</div>
                </div>
                ${unlocked ? '<span class="achievement-check">✓</span>' : ''}
            </div>`;
    }).join('');

    // Seção de edição (só no próprio perfil)
    let editSection = '';
    if (me) {
        const cosmetics = me.owned_cosmetics || [];

        const wardrobeHtml = cosmetics.length
            ? cosmetics.map(c => `
                <div style="display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;"
                     onclick="selectAvatarPerfil('${c.image}')" title="${c.name}">
                    <img src="${c.image}" data-src="${c.image}"
                         class="perfil-avatar-opt"
                         style="width:52px;height:52px;object-fit:cover;border:2px solid #2c3e50;image-rendering:pixelated;transition:border-color 0.15s;"
                         onmouseover="this.style.borderColor='#9b59b6'"
                         onmouseout="if('${c.image}'!==pendingAvatar)this.style.borderColor='#2c3e50'">
                    <div style="font-size:7px;color:#bdc3c7;max-width:54px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;">${c.name}</div>
                </div>`).join('')
            : `<div style="font-size:8px;color:#7f8c8d;letter-spacing:1px;">Nenhum cosmético ainda. Compre na Loja!</div>`;

        const classesHtml = AVATAR_CLASSES.map(av => `
            <img src="${av.src}" data-src="${av.src}"
                 class="perfil-avatar-opt"
                 style="width:48px;height:48px;object-fit:cover;cursor:pointer;border:2px solid ${pendingAvatar === av.src ? '#f39c12' : '#2c3e50'};image-rendering:pixelated;transition:border-color 0.15s;"
                 onclick="selectAvatarPerfil('${av.src}')" title="${av.label}"
                 onmouseover="this.style.borderColor='#f39c12'"
                 onmouseout="if('${av.src}'!==pendingAvatar)this.style.borderColor='#2c3e50'">`).join('');

        editSection = `
            <div style="padding:0 20px 20px; border-bottom:2px solid #2c3e50;">

                <div class="perfil-section-title" style="padding-top:16px;">⚔️ NOME DO AVENTUREIRO</div>
                <input type="text" id="editNome" class="pixel-input" value="${escHtml(p.nome || p.username)}"
                       style="width:100%;box-sizing:border-box;margin-bottom:16px;" autocomplete="off" data-cy="input-perfil-nome"
                       oninput="isDirty=true">

                <div class="perfil-section-title">🎭 GUARDA-ROUPA</div>
                <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px;" data-cy="wardrobe-grid">
                    ${wardrobeHtml}
                </div>

                <div class="perfil-section-title">🧙 CLASSE DO HERÓI</div>
                <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;">
                    ${classesHtml}
                </div>

                <div style="margin-bottom:16px;">
                    <div style="font-size:8px;color:#7f8c8d;letter-spacing:1px;margin-bottom:8px;">⚡ DICEBEAR (PIXEL ART)</div>
                    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
                        <img id="dicebearPreview" src="${typeof dicebearUrl === 'function' ? dicebearUrl(p.username) : ''}"
                             style="width:48px;height:48px;border:2px solid #2c3e50;image-rendering:pixelated;flex-shrink:0;" alt="DiceBear">
                        <button onclick="useDicebearPerfil()" data-cy="btn-dicebear-perfil"
                                style="font-family:'Press Start 2P',cursive;font-size:7px;padding:7px 10px;background:#2c3e50;color:#3498db;border:2px solid #3498db;cursor:pointer;">
                            ⚡ Usar DiceBear
                        </button>
                    </div>
                    <div style="font-size:7px;color:#7f8c8d;letter-spacing:1px;margin-bottom:6px;">OU URL PERSONALIZADA</div>
                    <input type="text" id="perfilAvatarUrl" class="pixel-input"
                           placeholder="Cole o link de uma imagem..."
                           style="width:100%;box-sizing:border-box;" data-cy="input-perfil-avatar-url"
                           oninput="onAvatarUrlInput(this.value)">
                </div>

                <button onclick="saveHero()" class="btn-pixel" data-cy="btn-salvar-heroi"
                        style="width:100%;box-sizing:border-box;background:#27ae60;padding:14px;font-size:10px;">
                    ⚔️ SALVAR HERÓI
                </button>
            </div>`;
    }

    card.innerHTML = `
        <div class="perfil-header">
            <div class="perfil-avatar-wrap">
                <img class="perfil-avatar${p.is_cursed ? ' curse-avatar' : ''}" id="perfilAvatarImg"
                     src="${p.avatar_url || dicebearUrl(p.username)}" alt="Avatar" data-cy="perfil-avatar">
                <div class="perfil-level-badge">Lv.${p.level}</div>
            </div>
            <div class="perfil-info">
                <div class="perfil-nome" data-cy="perfil-nome">${escHtml(p.nome || p.username)}</div>
                <div class="perfil-faction-badge">${guildIcon} ${p.faction}</div>
                <div class="perfil-xp-label">
                    <span>XP — Nível ${p.level}</span>
                    <span>${(p.xp || 0).toLocaleString('pt-BR')} / ${xpMax.toLocaleString('pt-BR')}</span>
                </div>
                <div class="perfil-xp-track">
                    <div class="perfil-xp-fill" style="width:${xpPct}%"></div>
                </div>
                <div style="font-size:7px;color:#7f8c8d;margin-top:4px;letter-spacing:1px;">
                    ${xpMax - (p.xp || 0) > 0 ? `Faltam ${(xpMax - (p.xp || 0)).toLocaleString('pt-BR')} XP para o próximo nível` : '⬆️ Pronto para subir de nível!'}
                </div>
            </div>
        </div>

        ${curseBanner}

        ${editSection}

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

window.useDicebearPerfil = () => {
    const randomSuffix = Math.random().toString(36).slice(2, 7);
    const url = typeof dicebearUrl === 'function' ? dicebearUrl(_dicebearUsername + '_' + randomSuffix) : '';
    if (!url) return;
    pendingAvatar = url;
    isDirty = true;
    const smallPreview = document.getElementById('dicebearPreview');
    if (smallPreview) smallPreview.src = url;
    const urlInput = document.getElementById('perfilAvatarUrl');
    if (urlInput) urlInput.value = url;
    document.querySelectorAll('.perfil-avatar-opt').forEach(el => {
        el.style.borderColor = '#2c3e50';
    });
};

window.onAvatarUrlInput = (val) => {
    if (!val.trim()) return;
    isDirty = true;
    pendingAvatar = val.trim();
    const preview = document.getElementById('perfilAvatarImg');
    if (preview) preview.src = pendingAvatar;
    document.querySelectorAll('.perfil-avatar-opt').forEach(el => {
        el.style.borderColor = '#2c3e50';
    });
};

window.saveHero = async () => {
    const nomeEl = document.getElementById('editNome');
    const nome   = nomeEl ? nomeEl.value.trim() : '';

    if (!nome) { showToast('Nome não pode ser vazio.', 'error'); return; }

    try {
        const res = await fetch(`${API_URL}/players/me`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ nome, avatar_url: pendingAvatar })
        });

        const data = await res.json();
        if (res.ok) {
            isDirty = false;
            const nomeDisplay = document.querySelector('[data-cy="perfil-nome"]');
            if (nomeDisplay) nomeDisplay.textContent = data.nome;
            const mainAvatar = document.getElementById('perfilAvatarImg');
            if (mainAvatar) mainAvatar.src = data.avatar_url || pendingAvatar;
            localStorage.setItem('guild_user',   data.nome || data.username);
            localStorage.setItem('guild_avatar', data.avatar_url || '');
            showToast('Herói salvo com sucesso! ⚔️');
        } else {
            showToast(`❌ ${data.message || 'Erro ao salvar.'}`, 'error');
        }
    } catch {
        showToast('Erro de conexão.', 'error');
    }
};

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
