// ==========================================
// 0. PROTEÇÃO E INICIALIZAÇÃO
// ==========================================
const API_URL = 'http://localhost:3001/api';
const token   = localStorage.getItem('guild_token');

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

    setupLootForm();
    setupQuestForm();

    await renderInventory();
    await renderUsersTable();
    await renderAdminQuests();

    // Atualiza roster a cada 10 segundos
    setInterval(renderUsersTable, 10000);
}

// ==========================================
// 1. DASHBOARD E RELATÓRIOS
// ==========================================
function renderDashboardStats(players) {
    const totalGold = players.reduce((sum, p) => sum + (p.coins || 0), 0);
    const goldEl = document.getElementById('repTotalGold');
    if (goldEl) goldEl.innerText = totalGold.toString();

    const slaEl = document.getElementById('repSlaHealth');
    if (slaEl) slaEl.innerText = '85%';

    const performers = [...players]
        .sort((a, b) => (b.xp || 0) - (a.xp || 0))
        .slice(0, 3);

    const list = document.getElementById('topPerformersList');
    if (list) {
        list.innerHTML = performers.map(p => `
            <div class="top-performer-row">
                <span>${p.nome || p.username}</span>
                <span>${p.xp || 0} XP</span>
            </div>
        `).join('');
    }
}

// ==========================================
// 2. GERENCIAMENTO DE LOOT (CRUD VIA API)
// ==========================================
let currentInventory = [];

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
    const inventoryList = document.getElementById('inventoryList');
    if (!inventoryList) return;

    try {
        const response = await fetch(`${API_URL}/admin/loot`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            currentInventory = await response.json();

            inventoryList.innerHTML = currentInventory.map(item => `
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
        }
    } catch (err) {
        console.error('Erro ao buscar inventário:', err);
    }
}

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
// 3. FORJA DE QUESTS
// ==========================================
function setupQuestForm() {
    const questForm = document.getElementById('questForm');
    if (!questForm) return;

    questForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const questData = {
            title:       document.getElementById('questTitle').value.trim(),
            type:        document.getElementById('questType').value,
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
// 4. ROSTER E STATUS DOS JOGADORES
// ==========================================
async function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    try {
        // FIX: endpoint correto é /admin/roster
        const response = await fetch(`${API_URL}/admin/roster`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const players = await response.json();

            renderDashboardStats(players);

            tbody.innerHTML = players.map(p => `
                <tr>
                    <td><img src="${p.avatar_url || 'assets/imgs/caneca_pixel.jpg'}" style="width:30px; border-radius:4px; object-fit:cover;"></td>
                    <td>${p.nome || p.username}</td>
                    <td>Lv.${p.level || 1} — ${p.xp || 0} XP</td>
                    <td>${p.quests_completed || 0}</td>
                    <td><span class="status-badge ${p.is_cursed ? 'cursed' : 'online'}">
                        ${p.is_cursed ? '🚨 Maldição (Bug Aberto)' : '✅ Saudável'}
                    </span></td>
                </tr>
            `).join('');
        }
    } catch (err) {
        console.error('Erro ao buscar jogadores:', err);
    }
}

async function renderAdminQuests() {
    const tableBody = document.getElementById('adminQuestsTableBody');
    if (!tableBody) return;

    try {
        const response = await fetch(`${API_URL}/admin/quests`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const quests = await response.json();
            tableBody.innerHTML = quests.map(q => `
                <tr>
                    <td>${q.title}</td>
                    <td>${q.type}</td>
                    <td>${q.xp_reward}</td>
                    <td>${q.coin_reward}</td>
                    <td>${q.sla_seconds || 'Sem Limite'}</td>
                </tr>
            `).join('');
        }
    } catch (err) {
        console.error('Erro ao buscar quests do admin:', err);
    }
}

// Lembre-se de adicionar `await renderAdminQuests();` dentro do seu initAdminPanel() e após o form de criar quest dar sucesso!