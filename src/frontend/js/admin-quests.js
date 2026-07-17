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
    renderAdminQuests();
    loadSprintsSelect();
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
        const select  = document.getElementById('questSprint');
        if (!select) return;

        const active = sprints.filter(s => s.status !== 'cancelled' && s.status !== 'completed');

        select.innerHTML = '<option value="">🗂️ Sem sprint (Backlog)</option>' +
            active.map(s => `<option value="${s._id}">[${STATUS_SPRINT_LABELS[s.status] || s.status}] ${s.name}</option>`).join('');
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
        const questData = {
            title:       document.getElementById('questTitle').value.trim(),
            type:        document.getElementById('questType').value,
            faction:     document.getElementById('questFaction').value,
            xp_reward:   parseInt(document.getElementById('questXp').value),
            coin_reward: parseInt(document.getElementById('questCoins').value),
            sla_seconds: document.getElementById('slaTime').value
                            ? parseInt(document.getElementById('slaTime').value)
                            : null,
            sprint_id:   sprintVal || null
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
                await renderAdminQuests();
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
// 2. TABELA DE QUESTS + PAGINAÇÃO
// ==========================================
const STATUS_LABELS = {
    todo:        { label: 'A Fazer',      color: '#2980b9' },
    in_progress: { label: 'Em Progresso', color: '#e67e22' },
    done:        { label: 'Concluída',    color: '#27ae60' }
};

let allQuests       = [];
let questPage       = 0;
const QUESTS_PER_PAGE = 10;

async function renderAdminQuests() {
    try {
        const response = await fetch(`${API_URL}/quests/all`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            allQuests = await response.json();
            questPage = 0;
            renderQuestPage();
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

function renderQuestPage() {
    const tableBody = document.getElementById('adminQuestsTableBody');
    if (!tableBody) return;

    const start = questPage * QUESTS_PER_PAGE;
    const slice = allQuests.slice(start, start + QUESTS_PER_PAGE);

    const FACTION_BADGE = { Produto: '📦', Suporte: '🎧', 'Customer Service': '📣' };

    tableBody.innerHTML = slice.map(q => {
        const st          = STATUS_LABELS[q.status] || STATUS_LABELS.todo;
        const assignee    = q.assigned_to ? (q.assigned_to.nome || q.assigned_to.username) : '—';
        const factionIcon = FACTION_BADGE[q.faction] || '🏰';
        const resetBtn    = (q.status === 'in_progress')
            ? `<button class="btn-pixel btn-delete" style="font-size:8px;padding:4px 8px;" onclick="resetQuest('${q._id}')">Resetar</button>`
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
            ? `<a href="admin-sprint-board.html?id=${q.sprint_id._id}" style="color:#3498db;font-size:8px;text-decoration:none;"
                 title="${q.sprint_id.name}">🏃 ${truncate(q.sprint_id.name, 14)}</a>`
            : '<span style="color:#4a5568;font-size:8px;">—</span>';

        return `
            <tr>
                <td>${q.title}</td>
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

    renderPaginationControls();
}

function renderPaginationControls() {
    const container  = document.getElementById('questPagination');
    if (!container) return;

    const totalPages = Math.ceil(allQuests.length / QUESTS_PER_PAGE);
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    const start = questPage * QUESTS_PER_PAGE + 1;
    const end   = Math.min(start + QUESTS_PER_PAGE - 1, allQuests.length);

    container.innerHTML = `
        <div class="pagination-row">
            <button class="btn-pixel" style="font-size:8px;padding:8px 12px;" onclick="goQuestPage(${questPage - 1})" ${questPage === 0 ? 'disabled' : ''}>← Anterior</button>
            <span class="pagination-info">Página ${questPage + 1} de ${totalPages} &nbsp;|&nbsp; ${start}–${end} de ${allQuests.length}</span>
            <button class="btn-pixel" style="font-size:8px;padding:8px 12px;" onclick="goQuestPage(${questPage + 1})" ${questPage >= totalPages - 1 ? 'disabled' : ''}>Próxima →</button>
        </div>
    `;
}

window.goQuestPage = (page) => {
    const totalPages = Math.ceil(allQuests.length / QUESTS_PER_PAGE);
    if (page < 0 || page >= totalPages) return;
    questPage = page;
    renderQuestPage();
};

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
            await renderAdminQuests();
        } else {
            const err = await res.json();
            showToast(err.message || 'Erro ao resetar quest.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Erro de conexão com o servidor.', 'error');
    }
};
