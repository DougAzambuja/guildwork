// ==========================================
// 0. PROTEÇÃO E INICIALIZAÇÃO
// ==========================================
const token = localStorage.getItem('guild_token');

document.addEventListener('DOMContentLoaded', () => {
    if (!token || localStorage.getItem('guild_role') !== 'admin') {
        window.location.href = 'login.html';
        return;
    }
    initAdminPanel();
});

async function initAdminPanel() {
    const adminName = localStorage.getItem('guild_user') || 'Mestre da Guilda';
    const nameEl    = document.getElementById('playerName');
    if (nameEl) nameEl.innerText = adminName;

    setupTabs();
    setupLootForm();
    setupQuestForm();
    setupRegisterForm();

    await renderInventory();
    await renderUsersTable();
    await renderAdminQuests();

    setInterval(refreshUsersBackground, 10000);
}

// ==========================================
// 1. TABS
// ==========================================
function setupTabs() {
    const tabs   = document.querySelectorAll('.admin-tab');
    const panels = document.querySelectorAll('.admin-tab-panel');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t   => t.classList.remove('active'));
            panels.forEach(p => p.classList.remove('active'));

            tab.classList.add('active');
            const target = document.getElementById(`tab-${tab.dataset.tab}`);
            if (target) target.classList.add('active');
        });
    });
}

// ==========================================
// 2. DASHBOARD E RELATÓRIOS
// ==========================================
function renderDashboardStats(players) {
    // — Métricas globais —
    const totalGold = players.reduce((sum, p) => sum + (p.coins || 0), 0);
    const goldEl = document.getElementById('repTotalGold');
    if (goldEl) goldEl.innerText = totalGold.toLocaleString('pt-BR');

    const cursed   = players.filter(p => p.is_cursed).length;
    const slaScore = players.length > 0
        ? Math.round(((players.length - cursed) / players.length) * 100)
        : 100;
    const slaEl = document.getElementById('repSlaHealth');
    if (slaEl) slaEl.innerText = `${slaScore}%`;

    // — Top Performers —
    const performers = [...players]
        .sort((a, b) => (b.xp || 0) - (a.xp || 0))
        .slice(0, 3);

    const medals = ['🥇', '🥈', '🥉'];
    const list   = document.getElementById('topPerformersList');
    if (list) {
        list.innerHTML = performers.length
            ? performers.map((p, i) => `
                <div style="display:flex; justify-content:space-between; font-size:9px; padding:6px 0; border-bottom:1px solid #34495e;">
                    <span>${medals[i]} ${p.nome || p.username}</span>
                    <span style="color:#f1c40f;">${(p.xp || 0).toLocaleString('pt-BR')} XP</span>
                </div>
            `).join('')
            : '<div style="font-size:8px;color:#7f8c8d;">Nenhum aventureiro ainda.</div>';
    }

    // — Desempenho das Facções —
    const factions = {};
    players.forEach(p => {
        const key = p.faction || 'Sem Facção';
        if (!factions[key]) factions[key] = { members: 0, xp: 0, coins: 0, quests: 0 };
        factions[key].members++;
        factions[key].xp     += p.xp              || 0;
        factions[key].coins  += p.coins            || 0;
        factions[key].quests += p.quests_completed || 0;
    });

    const FACTION_ICONS = { Produto: '📦', Suporte: '🎧', 'Customer Service': '📣', 'Sem Facção': '❓' };
    const grid = document.getElementById('factionsGrid');
    if (grid) {
        const entries = Object.entries(factions);
        grid.innerHTML = entries.length
            ? entries.map(([name, data]) => `
                <div class="faction-card">
                    <h3 class="faction-name">${FACTION_ICONS[name] || '🏰'} ${name}</h3>
                    <div style="font-size:9px; display:flex; flex-direction:column; gap:6px;">
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:#bdc3c7;">Membros</span>
                            <span style="color:#fff;">${data.members}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:#bdc3c7;">XP Total</span>
                            <span style="color:#2ecc71;">${data.xp.toLocaleString('pt-BR')}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:#bdc3c7;">Gold Total</span>
                            <span style="color:#f1c40f;">💰 ${data.coins.toLocaleString('pt-BR')}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:#bdc3c7;">Missões</span>
                            <span style="color:#3498db;">${data.quests}</span>
                        </div>
                    </div>
                </div>
            `).join('')
            : '<div style="font-size:8px;color:#7f8c8d;padding:10px;">Nenhum aventureiro recrutado ainda.</div>';
    }
}

// ==========================================
// 3. GERENCIAMENTO DE LOOT (CRUD VIA API)
// ==========================================
let currentInventory  = [];
let inventoryPage     = 0;
const INVENTORY_PER_PAGE = 10;

function setupLootForm() {
    const lootForm = document.getElementById('lootForm');
    if (!lootForm) return;

    lootForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const newItem = {
            name:      document.getElementById('lootName').value.trim(),
            price:     parseInt(document.getElementById('lootPrice').value),
            image_url: document.getElementById('lootImage').value
        };

        try {
            // FIX: endpoint correto é /admin/loot
            const response = await fetch(`${API_URL}/admin/loot`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(newItem)
            });

            if (response.ok) {
                lootForm.reset();
                showToast(`Item "${newItem.name}" forjado!`);
                await renderInventory();
            } else {
                const error = await response.json();
                showToast(`Erro: ${error.message}`, 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Erro ao forjar item. Servidor offline?', 'error');
        }
    });
}

async function renderInventory() {
    try {
        const response = await fetch(`${API_URL}/admin/loot`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            currentInventory = await response.json();
            inventoryPage    = 0;
            renderInventoryPage();
        }
    } catch (err) {
        console.error('Erro ao buscar inventário:', err);
    }
}

function renderInventoryPage() {
    const inventoryList = document.getElementById('inventoryList');
    if (!inventoryList) return;

    const start = inventoryPage * INVENTORY_PER_PAGE;
    const slice = currentInventory.slice(start, start + INVENTORY_PER_PAGE);

    inventoryList.innerHTML = slice.map(item => `
        <div class="inventory-item">
            <div class="inventory-item-info">
                <img src="${item.image || 'assets/imgs/caneca_pixel.jpg'}" alt="Img" style="width:30px; margin-right:10px;">
                <div>${item.name} - ${item.price} 💰</div>
            </div>
            <div class="inventory-actions">
                <button class="btn-pixel" onclick="openEditModal('${item._id}')">Editar</button>
                <button class="btn-pixel" style="background:#e74c3c" onclick="deleteLoot('${item._id}')">Excluir</button>
            </div>
        </div>
    `).join('');

    renderInventoryPaginationControls();
}

function renderInventoryPaginationControls() {
    const container  = document.getElementById('inventoryPagination');
    if (!container) return;

    const totalPages = Math.ceil(currentInventory.length / INVENTORY_PER_PAGE);
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    const start = inventoryPage * INVENTORY_PER_PAGE + 1;
    const end   = Math.min(start + INVENTORY_PER_PAGE - 1, currentInventory.length);

    container.innerHTML = `
        <div class="pagination-row">
            <button class="btn-pixel" style="font-size:8px;padding:8px 12px;" onclick="goInventoryPage(${inventoryPage - 1})" ${inventoryPage === 0 ? 'disabled' : ''}>← Anterior</button>
            <span class="pagination-info">Página ${inventoryPage + 1} de ${totalPages} &nbsp;|&nbsp; ${start}–${end} de ${currentInventory.length}</span>
            <button class="btn-pixel" style="font-size:8px;padding:8px 12px;" onclick="goInventoryPage(${inventoryPage + 1})" ${inventoryPage >= totalPages - 1 ? 'disabled' : ''}>Próxima →</button>
        </div>
    `;
}

window.goInventoryPage = (page) => {
    const totalPages = Math.ceil(currentInventory.length / INVENTORY_PER_PAGE);
    if (page < 0 || page >= totalPages) return;
    inventoryPage = page;
    renderInventoryPage();
};

let currentEditId = null;

window.openEditModal = (itemId) => {
    const item = currentInventory.find(i => i._id === itemId);
    if (!item) return;
    currentEditId = itemId;
    document.getElementById('editLootName').value  = item.name;
    document.getElementById('editLootPrice').value = item.price;
    document.getElementById('editLootModal').style.display = 'flex';
};

window.closeEditModal = () => {
    document.getElementById('editLootModal').style.display = 'none';
    currentEditId = null;
};

document.getElementById('editLootForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const updatedData = {
        name:  document.getElementById('editLootName').value.trim(),
        price: parseInt(document.getElementById('editLootPrice').value)
    };

    try {
        // FIX: endpoint correto é /admin/loot/:id
        const response = await fetch(`${API_URL}/admin/loot/${currentEditId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updatedData)
        });

        if (response.ok) {
            showToast('Item atualizado com sucesso!');
            closeEditModal();
            await renderInventory();
        } else {
            showToast('Falha ao atualizar o item.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Erro ao comunicar com o servidor.', 'error');
    }
});

window.deleteLoot = async (itemId) => {
    if (!confirm('Tem certeza que deseja destruir este item?')) return;

    try {
        // FIX: endpoint correto é /admin/loot/:id
        const response = await fetch(`${API_URL}/admin/loot/${itemId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            showToast('Item destruído!', 'error');
            await renderInventory();
        } else {
            showToast('Erro ao tentar destruir item.', 'error');
        }
    } catch (err) {
        console.error(err);
    }
};

// ==========================================
// 4. FORJA DE QUESTS
// ==========================================
function setupQuestForm() {
    const questForm = document.getElementById('questForm');
    if (!questForm) return;

    questForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const questData = {
            title:       document.getElementById('questTitle').value.trim(),
            type:        document.getElementById('questType').value,
            faction:     document.getElementById('questFaction').value,
            xp_reward:   parseInt(document.getElementById('questXp').value),
            coin_reward: parseInt(document.getElementById('questCoins').value),
            sla_seconds: document.getElementById('slaTime').value
                            ? parseInt(document.getElementById('slaTime').value)
                            : null
        };

        try {
            // Rota que criamos no backend
            const res = await fetch(`${API_URL}/admin/quests`, {
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
                
                // 🚀 ADICIONE ESTA LINHA AQUI:
                // Atualiza a tabela na mesma hora que forja!
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
// 5. ROSTER, RECRUTAR E STATUS DOS JOGADORES
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
            renderDashboardStats(allUsers);
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

async function refreshUsersBackground() {
    try {
        const response = await fetch(`${API_URL}/admin/roster`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            allUsers = await response.json();
            renderDashboardStats(allUsers);
            renderUsersPage(); // mantém usersPage atual
        }
    } catch (err) { /* silencioso no background */ }
}

window.goUsersPage = (page) => {
    const totalPages = Math.ceil(allUsers.length / USERS_PER_PAGE);
    if (page < 0 || page >= totalPages) return;
    usersPage = page;
    renderUsersPage();
};

// — Edição de usuário —
window.openEditUserModal = (userId) => {
    const user = allUsers.find(u => u._id === userId);
    if (!user) return;

    document.getElementById('editUserId').value       = userId;
    document.getElementById('editUserNome').value     = user.nome || '';
    document.getElementById('editUserPassword').value = '';

    const guildaSelect = document.getElementById('editUserGuilda');
    if (user.role === 'admin') {
        guildaSelect.value = '__admin__';
    } else {
        guildaSelect.value = user.faction || 'Produto';
    }

    document.getElementById('editUserModal').style.display = 'flex';
};

window.closeEditUserModal = () => {
    document.getElementById('editUserModal').style.display = 'none';
};

document.getElementById('editUserForm').addEventListener('submit', async (e) => {
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
});

function setupRegisterForm() {
    const form = document.getElementById('registerForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const guilda = document.getElementById('regGuilda').value;
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
// 6. PERGAMINHOS FORJADOS (QUESTS + PAGINAÇÃO)
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
        const response = await fetch(`${API_URL}/admin/quests`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            allQuests = await response.json();
            questPage = 0;
            renderQuestPage();
        }
    } catch (err) {
        console.error('Erro ao buscar quests do admin:', err);
    }
}

function renderQuestPage() {
    const tableBody = document.getElementById('adminQuestsTableBody');
    if (!tableBody) return;

    const start  = questPage * QUESTS_PER_PAGE;
    const slice  = allQuests.slice(start, start + QUESTS_PER_PAGE);

    const FACTION_BADGE = { Produto: '📦', Suporte: '🎧', 'Customer Service': '📣' };

    tableBody.innerHTML = slice.map(q => {
        const st          = STATUS_LABELS[q.status] || STATUS_LABELS.todo;
        const assignee    = q.assigned_to ? (q.assigned_to.nome || q.assigned_to.username) : '—';
        const factionIcon = FACTION_BADGE[q.faction] || '🏰';
        const resetBtn    = (q.status === 'in_progress')
            ? `<button class="btn-pixel btn-delete" style="font-size:8px;padding:4px 8px;" onclick="resetQuest('${q._id}')">Resetar</button>`
            : '—';

        return `
            <tr>
                <td>${q.title}</td>
                <td>${q.type || 'normal'}</td>
                <td style="font-size:9px;">${factionIcon} ${q.faction || 'Produto'}</td>
                <td>${q.xp_reward}</td>
                <td>${q.coin_reward}</td>
                <td>${q.sla_seconds || '—'}</td>
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
        const res = await fetch(`${API_URL}/admin/quests/${questId}/assign`, {
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