const token = localStorage.getItem('guild_token');
if (!token) window.location.href = 'login.html';

function logout() {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = 'login.html';
}

function xpParaProximoNivel(level) { return 200 * (level + 1) + 300; }

function xpCellHtml(xp, level) {
    const needed = xpParaProximoNivel(level);
    const pct    = Math.min(Math.round((xp / needed) * 100), 100);
    return `
        <div class="rank-xp-num">${xp.toLocaleString('pt-BR')} XP</div>
        <div class="rank-xp-bar-track">
            <div class="rank-xp-bar-fill" style="width:${pct}%"></div>
        </div>
        <div class="rank-xp-next">meta nível ${level + 1}: ${needed.toLocaleString('pt-BR')} XP</div>
    `;
}


let guildData   = null;
let membersData = [];
let isLeader    = false;

async function loadGuild() {
    try {
        const res = await fetch(`${API_URL}/guild`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
            if (res.status === 401) { localStorage.clear(); window.location.href = 'login.html'; return; }
            const err = await res.json();
            showToast(err.message || 'Erro ao carregar guilda.', 'error');
            return;
        }

        const data = await res.json();
        guildData   = data.guild;
        membersData = data.members;
        isLeader    = data.isLeader;

        renderGuildHeader();
        renderRanking();
        renderLeaderPanel();
        renderPlayerTopBar();
    } catch (err) {
        console.error(err);
        showToast('Erro de conexão.', 'error');
    }
}

function renderGuildHeader() {
    document.getElementById('guildIcon').textContent    = guildData.icon;
    document.getElementById('guildName').textContent    = guildData.name.toUpperCase();
    document.getElementById('guildFaction').textContent = `FACÇÃO: ${guildData.faction_key.toUpperCase()}`;
    document.getElementById('treasuryBalance').textContent = guildData.treasury_balance.toLocaleString('pt-BR');
    document.getElementById('treasuryTax').textContent  = `${Math.round(guildData.tax_rate * 100)}% de cada missão concluída`;

    const count    = membersData.length;
    const avgLevel = count ? (membersData.reduce((s, m) => s + m.level, 0) / count).toFixed(1) : '—';
    const totalXP  = membersData.reduce((s, m) => s + m.xp, 0);

    document.getElementById('guildStats').innerHTML = `
        <div class="guild-stat-chip">
            <span class="guild-stat-label">Aventureiros</span>
            <span class="guild-stat-value">👥 ${count}</span>
        </div>
        <div class="guild-stat-chip">
            <span class="guild-stat-label">Nível Médio</span>
            <span class="guild-stat-value">⚔️ ${avgLevel}</span>
        </div>
        <div class="guild-stat-chip">
            <span class="guild-stat-label">XP Total</span>
            <span class="guild-stat-value">✨ ${totalXP.toLocaleString('pt-BR')}</span>
        </div>
    `;
}

function renderRanking() {
    const tbody   = document.getElementById('rankingBody');
    const myId    = parseJwt(token)?.id;
    const leaderId = guildData.leader_id?._id || guildData.leader_id;

    const posClasses = ['rank-pos-1', 'rank-pos-2', 'rank-pos-3'];
    const posMedals  = ['🥇', '🥈', '🥉'];

    tbody.innerHTML = membersData.map((m, i) => {
        const isMe      = m._id === myId;
        const isLdr     = m._id.toString() === leaderId?.toString();
        const curseMark = m.is_cursed ? '<span class="rank-badge-cursed" title="Amaldiçoado">💀</span>' : '';
        const crownMark = isLdr       ? '<span class="rank-leader-crown" title="Líder">👑</span>'       : '';
        const meStyle   = isMe ? 'background:rgba(243,156,18,0.10); outline:1px solid rgba(243,156,18,0.3);' : '';
        const posClass  = posClasses[i] || 'rank-pos';
        const posLabel  = i < 3 ? posMedals[i] : `${i + 1}º`;

        return `<tr style="${meStyle}">
            <td class="rank-pos ${posClass}">${posLabel}</td>
            <td>
                <div class="rank-name">
                    <img src="${m.avatar_url || 'assets/imgs/caneca_pixel.jpg'}" class="rank-avatar" alt="">
                    <a href="perfil.html#${m._id}" class="rank-name-text rank-name-link" data-cy="link-perfil-${m._id}">${m.nome || m.username}</a>${crownMark}${curseMark}
                </div>
            </td>
            <td class="rank-level">${m.level}</td>
            <td class="rank-xp-cell">${xpCellHtml(m.xp, m.level)}</td>
            <td class="rank-quests">${m.quests_completed}</td>
            <td class="rank-gold">💰 ${m.coins.toLocaleString('pt-BR')}</td>
        </tr>`;
    }).join('');
}

function renderLeaderPanel() {
    const leader = guildData.leader_id;
    if (leader) {
        document.getElementById('leaderAvatar').src = leader.avatar_url || 'assets/imgs/caneca_pixel.jpg';
        document.getElementById('leaderName').textContent = leader.nome || leader.username;
    }

    const spendForm = document.getElementById('spendForm');
    const lockedMsg = document.getElementById('lockedMsg');

    if (isLeader) {
        spendForm.style.display = 'flex';
        lockedMsg.style.display = 'none';
        populateSpendSelect();
    } else {
        spendForm.style.display = 'none';
        lockedMsg.style.display = 'block';
    }
}

function populateSpendSelect() {
    const sel   = document.getElementById('spendTarget');
    const myId  = parseJwt(token)?.id;
    sel.innerHTML = membersData
        .map(m => `<option value="${m._id}">${m.nome || m.username}</option>`)
        .join('');
}

async function spendTreasury() {
    const target = document.getElementById('spendTarget').value;
    const amount = parseInt(document.getElementById('spendAmount').value);

    if (!amount || amount <= 0) { showToast('Informe um valor válido.', 'error'); return; }

    const btn = document.getElementById('spendBtn');
    btn.disabled = true;

    try {
        const res = await fetch(`${API_URL}/guild/spend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ amount, target_user_id: target })
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.message || 'Erro ao gastar tesouro.', 'error'); return; }

        showToast(data.message);
        guildData.treasury_balance = data.treasury_balance;
        document.getElementById('treasuryBalance').textContent = data.treasury_balance.toLocaleString('pt-BR');
        document.getElementById('spendAmount').value = '';
    } catch (err) {
        showToast('Erro de conexão.', 'error');
    } finally {
        btn.disabled = false;
    }
}

function renderPlayerTopBar() {
    const myId  = parseJwt(token)?.id;
    const me    = membersData.find(m => m._id === myId);
    if (!me) return;

    const nameEl  = document.getElementById('playerName');
    const levelEl = document.getElementById('levelDisplay');
    const xpBar   = document.getElementById('xpBar');
    const coinEl  = document.getElementById('coinCount');
    const avatarEl= document.getElementById('playerAvatar');

    if (nameEl)   nameEl.textContent  = me.nome || me.username;
    if (levelEl)  levelEl.textContent = `Lvl: ${me.level}`;
    if (coinEl)   coinEl.textContent  = me.coins;
    if (avatarEl) avatarEl.src        = me.avatar_url || 'assets/imgs/caneca_pixel.jpg';
    if (xpBar) {
        const pct = Math.min((me.xp / xpParaProximoNivel(me.level)) * 100, 100);
        xpBar.style.width = pct + '%';
    }
}

// Decoda o JWT para pegar o id do usuário logado
function parseJwt(token) {
    try {
        return JSON.parse(atob(token.split('.')[1]));
    } catch { return null; }
}

loadGuild();
