(async function () {
    const token = localStorage.getItem('guild_token');
    if (!token) { window.location.href = 'login.html'; return; }

    const DEFAULT_AVATAR = 'assets/imgs/caneca_pixel.jpg';
    const MEDALS = ['🥇', '🥈', '🥉'];

    // ── Cabeçalho do player logado ──────────────────────────────
    async function loadTopBar() {
        try {
            const res = await fetch(`${API_URL}/players/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) { logout(); return; }
            const p = await res.json();
            document.getElementById('topAvatar').src = p.avatar_url || DEFAULT_AVATAR;
            applyCurseAvatarClass(document.getElementById('topAvatar'), p.is_cursed);
            document.getElementById('topName').textContent = p.nome || p.username;
            document.getElementById('topLevel').textContent = `Lvl ${p.level} · ${p.faction || '—'}`;
        } catch {
            // silently keep defaults
        }
    }

    // ── Leaderboard ──────────────────────────────────────────────
    async function loadLeaderboard() {
        let data;
        try {
            const res = await fetch(`${API_URL}/players/leaderboard`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('api');
            data = await res.json();
        } catch {
            document.getElementById('lbWeek').textContent = 'Erro ao carregar ranking.';
            document.getElementById('lbTableContainer').innerHTML =
                '<div class="lb-empty">Não foi possível carregar o leaderboard.</div>';
            return;
        }

        const { rankings, weekStart, weekEnd } = data;

        // Semana
        const fmt = d => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        document.getElementById('lbWeek').textContent =
            `SEMANA DE ${fmt(weekStart)} A ${fmt(weekEnd)}`;

        renderPodium(rankings.slice(0, 3));
        renderTable(rankings);
        scrollToMe(rankings);
    }

    // ── Pódio top 3 ─────────────────────────────────────────────
    function renderPodium(top) {
        const el = document.getElementById('lbPodium');
        // Pódio só com 3+ jogadores, senão fica esteticamente vazio
        if (top.length < 3) { el.style.display = 'none'; return; }

        el.innerHTML = top.map((r, i) => {
            const rankClass = `rank-${i + 1}`;
            const meClass   = r.isMe ? 'is-me' : '';
            return `
            <div class="podium-card ${rankClass} ${meClass}" data-cy="podium-card-${i + 1}">
                ${r.isMe ? '<div class="podium-me-badge">VOCÊ</div>' : ''}
                <div class="podium-medal">${MEDALS[i]}</div>
                <img class="podium-avatar" src="${r.avatar_url || DEFAULT_AVATAR}" alt="${escHtml(r.nome)}" onerror="this.src='${DEFAULT_AVATAR}'">
                <div class="podium-name" title="${escHtml(r.nome)}">${escHtml(r.nome)}</div>
                <div class="podium-faction">${r.faction || '—'} · Lvl ${r.level}</div>
                <div class="podium-xp">${r.weekly_xp.toLocaleString('pt-BR')} XP</div>
                <div class="podium-quests">${r.quests_count} missão(ões)</div>
                <div class="podium-base">${i + 1}</div>
            </div>`;
        }).join('');
    }

    // ── Tabela completa ──────────────────────────────────────────
    function renderTable(rankings) {
        const container = document.getElementById('lbTableContainer');

        if (!rankings.length) {
            container.innerHTML = '<div class="lb-empty">Nenhuma missão foi concluída esta semana ainda.</div>';
            return;
        }

        const maxXp = rankings[0]?.weekly_xp || 1;

        const rows = rankings.map(r => {
            const rankClass = r.rank === 1 ? 'gold' : r.rank === 2 ? 'silver' : r.rank === 3 ? 'bronze' : '';
            const meClass   = r.isMe ? 'lb-me-row' : '';
            const pct       = Math.round((r.weekly_xp / maxXp) * 100);
            const medal     = r.rank <= 3 ? MEDALS[r.rank - 1] : r.rank;

            return `
            <tr class="${meClass}" data-cy="lb-row-${r.rank}">
                <td><span class="lb-rank ${rankClass}">${medal}</span></td>
                <td>
                    <div class="lb-name-cell">
                        <img class="lb-avatar" src="${r.avatar_url || DEFAULT_AVATAR}" alt="" onerror="this.src='${DEFAULT_AVATAR}'">
                        <a href="perfil.html#${r.user_id}" class="lb-name-link" title="${escHtml(r.nome)}">${escHtml(r.nome)}</a>
                        <span class="lb-faction">${r.faction || ''}</span>
                        ${r.isMe ? '<span class="podium-me-badge" style="position:static;margin-left:6px;">VOCÊ</span>' : ''}
                    </div>
                </td>
                <td class="lb-xp-cell">
                    <div class="lb-xp-num">${r.weekly_xp.toLocaleString('pt-BR')} XP</div>
                    <div class="lb-xp-bar-track">
                        <div class="lb-xp-bar-fill" style="width:${pct}%"></div>
                    </div>
                </td>
                <td class="lb-quests">${r.quests_count}</td>
                <td class="lb-level">Lvl ${r.level}</td>
            </tr>`;
        }).join('');

        const notRanked = !rankings.some(r => r.isMe);
        const notRankedRow = notRanked ? `
        <tr>
            <td colspan="5" class="empty-state" style="padding:16px;letter-spacing:1px;border-top:2px dashed var(--surface-3);">
                ⚔️ Você ainda não está no ranking desta semana — complete missões para aparecer aqui!
            </td>
        </tr>` : '';

        container.innerHTML = `
        <table class="lb-table" data-cy="lb-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>AVENTUREIRO</th>
                    <th>XP SEMANAL</th>
                    <th>MISSÕES</th>
                    <th>NÍVEL</th>
                </tr>
            </thead>
            <tbody>${rows}${notRankedRow}</tbody>
        </table>`;
    }

    function scrollToMe(rankings) {
        const myRow = rankings.find(r => r.isMe);
        if (!myRow) return;
        const el = document.querySelector(`[data-cy="lb-row-${myRow.rank}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function escHtml(str) {
        return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Boot
    await Promise.all([loadTopBar(), loadLeaderboard()]);
    hideLoadingOverlay();
})();
