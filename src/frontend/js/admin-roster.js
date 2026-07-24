// ==========================================
// 0. PROTEÇÃO E INICIALIZAÇÃO
// ==========================================
const token = localStorage.getItem('guild_token');

document.addEventListener('DOMContentLoaded', async () => {
    if (!token || localStorage.getItem('guild_role') !== 'admin') {
        window.location.href = 'login.html';
        return;
    }

    setupRegisterForm();
    setupEditForm();
    await renderUsersTable();
    hideLoadingOverlay();

    setInterval(refreshUsersBackground, 10000);
});

// ==========================================
// 1. MODAL DE RECRUTAMENTO
// ==========================================
window.openRecruitModal = () => {
    document.getElementById('registerForm').reset();
    document.getElementById('recruitModal').style.display = 'flex';
};

window.closeRecruitModal = () => {
    document.getElementById('recruitModal').style.display = 'none';
};

function setupRegisterForm() {
    const form = document.getElementById('registerForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const guilda  = document.getElementById('regGuilda').value;
        const isAdmin = guilda === '__admin__';

        const userData = {
            username:              document.getElementById('regUsername').value.trim(),
            nome:                  document.getElementById('regNome').value.trim(),
            password:              document.getElementById('regPassword').value,
            role:                  isAdmin ? 'admin' : 'funcionario',
            faction:               isAdmin ? 'Produto' : guilda,
            force_password_change: document.getElementById('regForcePasswordChange').checked,
        };

        try {
            const res = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(userData)
            });

            if (res.ok) {
                showToast(`Aventureiro "${userData.nome}" recrutado com sucesso!`);
                closeRecruitModal();
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
// 2. ROSTER + PAGINAÇÃO + BUSCA/FILTRO
// ==========================================
let allUsers      = [];
let filteredUsers = [];
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
            applyFilters();
        }
    } catch (err) {
        console.error('Erro ao buscar jogadores:', err);
    }
}

window.applyFilters = () => {
    const search = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
    const guilda = document.getElementById('filterGuilda')?.value || '';

    filteredUsers = allUsers.filter(u => {
        const matchSearch = !search ||
            (u.nome     || '').toLowerCase().includes(search) ||
            (u.username || '').toLowerCase().includes(search);

        const matchGuilda = !guilda ||
            (guilda === '__admin__' ? u.role === 'admin' : u.faction === guilda);

        return matchSearch && matchGuilda;
    });

    usersPage = 0;
    renderUsersPage();
};

function renderUsersPage() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    if (filteredUsers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-state" style="padding:24px">Nenhum membro encontrado.</td></tr>`;
        document.getElementById('usersPagination').innerHTML = '';
        return;
    }

    const start = usersPage * USERS_PER_PAGE;
    const slice = filteredUsers.slice(start, start + USERS_PER_PAGE);

    tbody.innerHTML = slice.map(p => {
        const crownMark   = p.is_guild_leader ? ' 👑' : '';
        const guildaLabel = p.role === 'admin'
            ? '🏰 Mestre'
            : `${GUILD_ICONS[p.faction] || '🏰'} ${p.faction || '—'}${crownMark}`;
        const forceTag = p.force_password_change
            ? `<span style="font-size:7px;color:#e67e22;display:block;margin-top:2px;">🔑 Troca pendente</span>`
            : '';

        return `
            <tr>
                <td><img src="${p.avatar_url || 'assets/imgs/caneca_pixel.jpg'}" style="width:32px;height:32px;border:2px solid #111;object-fit:cover;"></td>
                <td>${p.nome || p.username}<br><span style="color:#7f8c8d;font-size:8px;">@${p.username}</span>${forceTag}</td>
                <td style="font-size:9px;">${guildaLabel}</td>
                <td>Lv.${p.level || 1} &mdash; ${p.xp || 0} XP</td>
                <td>${p.coins || 0} 💰</td>
                <td>${p.quests_completed || 0}</td>
                <td><span class="status-badge ${p.is_cursed ? 'cursed' : 'online'}">
                    ${p.is_cursed ? '🚨 Maldição' : '✅ OK'}
                </span></td>
                <td><button class="btn-pixel btn-info" style="font-size:8px;padding:4px 8px;" data-cy="btn-edit-${p._id}" onclick="openEditUserModal('${p._id}')">Editar</button></td>
            </tr>
        `;
    }).join('');

    renderUsersPaginationControls();
}

function renderUsersPaginationControls() {
    const container  = document.getElementById('usersPagination');
    if (!container) return;

    const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    const start = usersPage * USERS_PER_PAGE + 1;
    const end   = Math.min(start + USERS_PER_PAGE - 1, filteredUsers.length);

    container.innerHTML = `
        <div class="pagination-row">
            <button class="btn-pixel" style="font-size:8px;padding:8px 12px;" onclick="goUsersPage(${usersPage - 1})" ${usersPage === 0 ? 'disabled' : ''}>← Anterior</button>
            <span class="pagination-info">Página ${usersPage + 1} de ${totalPages} &nbsp;|&nbsp; ${start}–${end} de ${filteredUsers.length}</span>
            <button class="btn-pixel" style="font-size:8px;padding:8px 12px;" onclick="goUsersPage(${usersPage + 1})" ${usersPage >= totalPages - 1 ? 'disabled' : ''}>Próxima →</button>
        </div>
    `;
}

window.goUsersPage = (page) => {
    const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);
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
            applyFilters();
        }
    } catch { /* silencioso */ }
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
    document.getElementById('editForcePasswordChange').checked = !!user.force_password_change;
    document.getElementById('editUserBirthDate').value = user.birth_date
        ? new Date(user.birth_date).toISOString().slice(0, 10)
        : '';

    const guildaSelect = document.getElementById('editUserGuilda');
    guildaSelect.value = user.role === 'admin' ? '__admin__' : (user.faction || 'Produto');

    document.getElementById('editUserModal').style.display = 'flex';
};

window.closeEditUserModal = () => {
    document.getElementById('editUserModal').style.display = 'none';
};

function setupEditForm() {
    document.getElementById('editUserForm').addEventListener('submit', submitEditUser);
}

async function submitEditUser(e) {
    e.preventDefault();

    const userId   = document.getElementById('editUserId').value;
    const guilda   = document.getElementById('editUserGuilda').value;
    const isAdmin  = guilda === '__admin__';
    const password = document.getElementById('editUserPassword').value;

    const birthVal = document.getElementById('editUserBirthDate').value;
    const payload = {
        nome:                  document.getElementById('editUserNome').value.trim(),
        role:                  isAdmin ? 'admin' : 'funcionario',
        faction:               isAdmin ? 'Produto' : guilda,
        force_password_change: document.getElementById('editForcePasswordChange').checked,
        birth_date:            birthVal || null,
    };
    if (password && password.trim().length >= 6) payload.password = password;

    try {
        const res = await fetch(`${API_URL}/admin/roster/${userId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
