// ==========================================
// 0. PROTEÇÃO E INICIALIZAÇÃO
// ==========================================
const token = localStorage.getItem('guild_token');

const truncate = (str, max) => str && str.length > max ? str.slice(0, max) + '…' : (str || '');

document.addEventListener('DOMContentLoaded', () => {
    if (!token || localStorage.getItem('guild_role') !== 'admin') {
        window.location.href = 'login.html';
        return;
    }

    const adminName = localStorage.getItem('guild_user') || 'Mestre da Guilda';
    const nameEl    = document.getElementById('playerName');
    if (nameEl) nameEl.innerText = adminName;

    setupQuestForm();
    initFilterBar();
    loadSprintsSelect();
    renderAdminQuests(1);
});

// ==========================================
// 1. FORJA DE QUESTS — SELECT DE SPRINTS
// ==========================================
const STATUS_SPRINT_LABELS = {
    planning:  'Planning',
    active:    '⚡ Ativa',
    completed: 'Concluída',
    cancelled: 'Cancelada'
};

async function loadSprintsSelect() {
    try {
        const res = await fetch(`${API_URL}/sprints`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;

        const sprints = await res.json();
        const active  = sprints.filter(s => s.status !== 'cancelled' && s.status !== 'completed');

        const forgeOpts = '<option value="">🗂️ Sem sprint (Backlog)</option>' +
            active.map(s => `<option value="${s._id}">[${STATUS_SPRINT_LABELS[s.status] || s.status}] ${s.name}</option>`).join('');

        const forgeSelect = document.getElementById('questSprint');
        if (forgeSelect) forgeSelect.innerHTML = forgeOpts;

        const filterSelect = document.getElementById('filterSprint');
        if (filterSelect) {
            filterSelect.innerHTML = '<option value="">Todas as Sprints</option>' +
                '<option value="backlog">🗂️ Backlog</option>' +
                sprints.map(s => `<option value="${s._id}">${s.name}</option>`).join('');
        }
    } catch (err) {
        console.error('Erro ao carregar sprints:', err);
    }
}

// ==========================================
// 2. FORJA DE QUESTS
// ==========================================
function setupQuestForm() {
    const questForm = document.getElementById('questForm');
    if (!questForm) return;

    questForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const sprintVal = document.getElementById('questSprint')?.value;
        const labelsRaw = document.getElementById('questLabels')?.value || '';
        const questData = {
            title:       document.getElementById('questTitle').value.trim(),
            type:        document.getElementById('questType').value,
            faction:     document.getElementById('questFaction').value,
            xp_reward:   parseInt(document.getElementById('questXp').value),
            coin_reward: parseInt(document.getElementById('questCoins').value),
            sla_seconds: document.getElementById('slaTime').value
                            ? parseInt(document.getElementById('slaTime').value)
                            : null,
            sprint_id:   sprintVal || null,
            labels:      labelsRaw.split(',').map(l => l.trim()).filter(Boolean)
        };

        try {
            const res = await fetch(`${API_URL}/quests`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(questData)
            });

            if (res.ok) {
                showToast('Quest forjada com sucesso!');
                questForm.reset();
                await renderAdminQuests(1);
            } else {
                const err = await res.json();
                showToast(`Erro: ${err.message}`, 'error');
            }
        } catch (err) {
            console.error('Erro ao forjar quest:', err);
            showToast('Erro de conexão com o servidor.', 'error');
        }
    });
}

// ==========================================
// 3. BARRA DE FILTROS
// ==========================================
let _searchDebounceTimer = null;

function initFilterBar() {
    const searchEl  = document.getElementById('filterSearch');
    const factionEl = document.getElementById('filterFaction');
    const statusEl  = document.getElementById('filterStatus');
    const sprintEl  = document.getElementById('filterSprint');
    const limitEl   = document.getElementById('filterLimit');

    if (searchEl) {
        searchEl.addEventListener('input', () => {
            clearTimeout(_searchDebounceTimer);
            _searchDebounceTimer = setTimeout(() => renderAdminQuests(1), 300);
        });
    }

    [factionEl, statusEl, sprintEl, limitEl].forEach(el => {
        if (el) el.addEventListener('change', () => renderAdminQuests(1));
    });
}

function buildQueryParams(page) {
    const params = new URLSearchParams();
    params.set('page',  String(page));
    params.set('limit', document.getElementById('filterLimit')?.value || '10');

    const search  = document.getElementById('filterSearch')?.value.trim();
    const faction = document.getElementById('filterFaction')?.value;
    const status  = document.getElementById('filterStatus')?.value;
    const sprint  = document.getElementById('filterSprint')?.value;

    if (search)  params.set('search',    search);
    if (faction) params.set('faction',   faction);
    if (status)  params.set('status',    status);
    if (sprint)  params.set('sprint_id', sprint);

    return params;
}

// ==========================================
// 4. TABELA DE QUESTS + PAGINAÇÃO SERVER-SIDE
// ==========================================
const STATUS_LABELS = {
    todo:        { label: 'A Fazer',      color: '#2980b9' },
    in_progress: { label: 'Em Progresso', color: '#e67e22' },
    done:        { label: 'Concluída',    color: '#27ae60' }
};

async function renderAdminQuests(page = 1) {
    try {
        const params   = buildQueryParams(page);
        const response = await fetch(`${API_URL}/quests/all?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const { quests, total, page: currentPage, limit } = await response.json();
            renderQuestPage(quests);
            renderPaginationControls(total, limit, currentPage);
        }
    } catch (err) {
        console.error('Erro ao buscar quests:', err);
    }
}

function formatAdminSla(seconds) {
    if (seconds >= 3600) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return m > 0 ? `${h}h${m}m` : `${h}h`;
    }
    if (seconds >= 60) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return s > 0 ? `${m}m${s}s` : `${m}m`;
    }
    return `${seconds}s`;
}

function renderQuestPage(quests) {
    const tableBody = document.getElementById('adminQuestsTableBody');
    if (!tableBody) return;

    if (!quests.length) {
        tableBody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:#7f8c8d;padding:20px;">Nenhuma quest encontrada.</td></tr>';
        return;
    }

    const FACTION_BADGE = { Produto: '📦', Suporte: '🎧', 'Customer Service': '📣' };

    tableBody.innerHTML = quests.map(q => {
        const st          = STATUS_LABELS[q.status] || STATUS_LABELS.todo;
        const assignee    = q.assigned_to ? (q.assigned_to.nome || q.assigned_to.username) : '—';
        const factionIcon = FACTION_BADGE[q.faction] || '🏰';
        const resetBtn    = (q.status === 'in_progress')
            ? `<button class="btn-pixel btn-delete" style="font-size:8px;padding:4px 8px;" data-cy="btn-reset-quest" onclick="resetQuest('${q._id}')">Resetar</button>`
            : '—';

        let slaDisplay = '—';
        if (q.sla_seconds && q.status === 'in_progress' && q.started_at) {
            const elapsed   = (Date.now() - new Date(q.started_at).getTime()) / 1000;
            const remaining = Math.max(0, q.sla_seconds - Math.floor(elapsed));
            const pct       = remaining / q.sla_seconds;
            const color     = pct <= 0 ? '#e74c3c' : pct <= 0.25 ? '#e67e22' : '#27ae60';
            const label     = remaining <= 0 ? '🚨 ESTOURADO' : formatAdminSla(remaining);
            slaDisplay = `<span style="color:${color}; font-size:9px;">${label}</span>`;
        } else if (q.sla_seconds) {
            slaDisplay = `<span style="color:#7f8c8d; font-size:9px;">${formatAdminSla(q.sla_seconds)}</span>`;
        }

        const sprintInfo = q.sprint_id
            ? `<a href="admin-sprint-board.html?id=${q.sprint_id._id}" style="color:#3498db;font-size:8px;text-decoration:none;" title="${q.sprint_id.name}">🏃 ${truncate(q.sprint_id.name, 14)}</a>`
            : '<span style="color:#4a5568;font-size:8px;">—</span>';

        const labelBadges = (q.labels || []).length
            ? ' ' + q.labels.map(l => `<span style="background:#2c3e50;color:#bdc3c7;font-size:7px;padding:1px 5px;border-radius:2px;">${l}</span>`).join(' ')
            : '';

        return `
            <tr>
                <td>${q.title}${labelBadges}</td>
                <td>${q.type || 'normal'}</td>
                <td style="font-size:9px;">${factionIcon} ${q.faction || 'Produto'}</td>
                <td>${sprintInfo}</td>
                <td>${q.xp_reward}</td>
                <td>${q.coin_reward}</td>
                <td>${slaDisplay}</td>
                <td><span class="status-badge" style="background:${st.color};padding:3px 8px;font-size:8px;">${st.label}</span></td>
                <td>${assignee}</td>
                <td>${resetBtn}</td>
            </tr>
        `;
    }).join('');
}

function renderPaginationControls(total, limit, page) {
    const row = document.getElementById('questPaginationRow');
    if (!row) return;

    const totalPages = Math.ceil(total / limit);

    if (totalPages <= 1) {
        row.style.display = 'none';
        return;
    }

    const start = (page - 1) * limit + 1;
    const end   = Math.min(start + limit - 1, total);

    row.style.display = 'flex';

    const prevBtn   = document.getElementById('btnQuestPrev');
    const nextBtn   = document.getElementById('btnQuestNext');
    const pageInfo  = document.getElementById('paginationPageInfo');
    const countInfo = document.getElementById('paginationCountInfo');

    if (prevBtn) {
        prevBtn.disabled = page <= 1;
        prevBtn.onclick  = () => goQuestPage(page - 1);
    }
    if (nextBtn) {
        nextBtn.disabled = page >= totalPages;
        nextBtn.onclick  = () => goQuestPage(page + 1);
    }
    if (pageInfo)  pageInfo.textContent  = `Página ${page} de ${totalPages}`;
    if (countInfo) countInfo.textContent = `${start}–${end} de ${total}`;
}

window.goQuestPage = (page) => renderAdminQuests(page);

window.resetQuest = async (questId) => {
    if (!confirm('Resetar esta quest para "A Fazer" e desatribuir o aventureiro?')) return;

    try {
        const res = await fetch(`${API_URL}/quests/${questId}/assign`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ userId: null })
        });

        if (res.ok) {
            showToast('Quest resetada com sucesso.');
            await renderAdminQuests(1);
        } else {
            const err = await res.json();
            showToast(err.message || 'Erro ao resetar quest.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Erro de conexão com o servidor.', 'error');
    }
};
