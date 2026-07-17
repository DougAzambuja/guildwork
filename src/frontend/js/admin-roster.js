// ==========================================
// 0. PROTEÇÃO E INICIALIZAÇÃO
// ==========================================
const token = localStorage.getItem('guild_token');

document.addEventListener('DOMContentLoaded', () => {
    if (!token || localStorage.getItem('guild_role') !== 'admin') {
        window.location.href = 'login.html';
        return;
    }

    const adminName = localStorage.getItem('guild_user') || 'Mestre da Guilda';
    const nameEl    = document.getElementById('playerName');
    if (nameEl) nameEl.innerText = adminName;

    setupRegisterForm();
    renderUsersTable();

    document.getElementById('editUserForm').addEventListener('submit', submitEditUser);

    setInterval(refreshUsersBackground, 10000);
});

// ==========================================
// 1. RECRUTAR AVENTUREIRO
// ==========================================
function setupRegisterForm() {
    const form = document.getElementById('registerForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const guilda  = document.getElementById('regGuilda').value;
        const isAdmin = guilda === '__admin__';

        const userData = {
            username: document.getElementById('regUsername').value.trim(),
            nome:     document.getElementById('regNome').value.trim(),
            password: document.getElementById('regPassword').value,
            role:     isAdmin ? 'admin' : 'funcionario',
            faction:  isAdmin ? 'Produto' : guilda
        };

        try {
            const res = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(userData)
            });

            if (res.ok) {
                showToast(`Aventureiro "${userData.nome}" recrutado com sucesso!`);
                form.reset();
                await renderUsersTable();
            } else {
                const err = await res.json();
                showToast(err.message || 'Erro ao recrutar aventureiro.', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Erro de conexão com o servidor.', 'error');
        }
    });
}

// ==========================================
// 2. ROSTER + PAGINAÇÃO
// ==========================================
let allUsers      = [];
let usersPage     = 0;
const USERS_PER_PAGE = 10;

async function renderUsersTable() {
    try {
        const response = await fetch(`${API_URL}/admin/roster`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            allUsers  = await response.json();
            usersPage = 0;
            renderUsersPage();
        }
    } catch (err) {
        console.error('Erro ao buscar jogadores:', err);
    }
}

function renderUsersPage() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    const start = usersPage * USERS_PER_PAGE;
    const slice = allUsers.slice(start, start + USERS_PER_PAGE);

    const GUILD_ICONS = { Produto: '📦', Suporte: '🎧', 'Customer Service': '📣' };

    tbody.innerHTML = slice.map(p => {
        const guildaLabel = p.role === 'admin'
            ? '🏰 Mestre'
            : `${GUILD_ICONS[p.faction] || '🏰'} ${p.faction || '—'}`;

        return `
            <tr>
                <td><img src="${p.avatar_url || 'assets/imgs/caneca_pixel.jpg'}" style="width:32px; height:32px; border:2px solid #111; object-fit:cover;"></td>
                <td>${p.nome || p.username}<br><span style="color:#7f8c8d; font-size:8px;">@${p.username}</span></td>
                <td style="font-size:9px;">${guildaLabel}</td>
                <td>Lv.${p.level || 1} &mdash; ${p.xp || 0} XP</td>
                <td>${p.coins || 0} 💰</td>
                <td>${p.quests_completed || 0}</td>
                <td><span class="status-badge ${p.is_cursed ? 'cursed' : 'online'}">
                    ${p.is_cursed ? '🚨 Maldição' : '✅ OK'}
                </span></td>
                <td><button class="btn-pixel" style="font-size:8px;padding:4px 8px;" onclick="openEditUserModal('${p._id}')">Editar</button></td>
            </tr>
        `;
    }).join('');

    renderUsersPaginationControls();
}

function renderUsersPaginationControls() {
    const container  = document.getElementById('usersPagination');
    if (!container) return;

    const totalPages = Math.ceil(allUsers.length / USERS_PER_PAGE);
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    const start = usersPage * USERS_PER_PAGE + 1;
    const end   = Math.min(start + USERS_PER_PAGE - 1, allUsers.length);

    container.innerHTML = `
        <div class="pagination-row">
            <button class="btn-pixel" style="font-size:8px;padding:8px 12px;" onclick="goUsersPage(${usersPage - 1})" ${usersPage === 0 ? 'disabled' : ''}>← Anterior</button>
            <span class="pagination-info">Página ${usersPage + 1} de ${totalPages} &nbsp;|&nbsp; ${start}–${end} de ${allUsers.length}</span>
            <button class="btn-pixel" style="font-size:8px;padding:8px 12px;" onclick="goUsersPage(${usersPage + 1})" ${usersPage >= totalPages - 1 ? 'disabled' : ''}>Próxima →</button>
        </div>
    `;
}

window.goUsersPage = (page) => {
    const totalPages = Math.ceil(allUsers.length / USERS_PER_PAGE);
    if (page < 0 || page >= totalPages) return;
    usersPage = page;
    renderUsersPage();
};

async function refreshUsersBackground() {
    try {
        const response = await fetch(`${API_URL}/admin/roster`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            allUsers = await response.json();
            renderUsersPage();
        }
    } catch (err) { /* silencioso no background */ }
}

// ==========================================
// 3. MODAL DE EDIÇÃO DE USUÁRIO
// ==========================================
window.openEditUserModal = (userId) => {
    const user = allUsers.find(u => u._id === userId);
    if (!user) return;

    document.getElementById('editUserId').value       = userId;
    document.getElementById('editUserNome').value     = user.nome || '';
    document.getElementById('editUserPassword').value = '';

    const guildaSelect = document.getElementById('editUserGuilda');
    guildaSelect.value = user.role === 'admin' ? '__admin__' : (user.faction || 'Produto');

    document.getElementById('editUserModal').style.display = 'flex';
};

window.closeEditUserModal = () => {
    document.getElementById('editUserModal').style.display = 'none';
};

async function submitEditUser(e) {
    e.preventDefault();

    const userId  = document.getElementById('editUserId').value;
    const guilda  = document.getElementById('editUserGuilda').value;
    const isAdmin = guilda === '__admin__';
    const password = document.getElementById('editUserPassword').value;

    const payload = {
        nome:    document.getElementById('editUserNome').value.trim(),
        role:    isAdmin ? 'admin' : 'funcionario',
        faction: isAdmin ? 'Produto' : guilda,
    };
    if (password && password.trim().length >= 6) payload.password = password;

    try {
        const res = await fetch(`${API_URL}/admin/roster/${userId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            showToast('Aventureiro atualizado com sucesso!');
            closeEditUserModal();
            await renderUsersTable();
        } else {
            const err = await res.json();
            showToast(err.message || 'Erro ao salvar alterações.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Erro de conexão com o servidor.', 'error');
    }
}
