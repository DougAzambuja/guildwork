// ==========================================
// 0. PROTEÇÃO E INICIALIZAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('guild_role') !== 'admin') {
        window.location.href = 'login.html';
        return;
    }
    initAdminPanel();
});

function initAdminPanel() {
    const adminName = localStorage.getItem('guild_user') || 'Mestre da Guilda';
    const nameEl = document.getElementById('playerName');
    if (nameEl) nameEl.innerText = adminName;
    
    setupLootForm();
    renderDashboard();
    renderInventory();
    renderUsersTable();

    setInterval(renderUsersTable, 5000);
}

// ==========================================
// 1. DASHBOARD E RELATÓRIOS
// ==========================================
function renderDashboard() {
    // Lê os dados do funcionário pela chave correta
    const funcionarioKey = 'player_funcionario';
    const storedGold = parseInt(localStorage.getItem(`${funcionarioKey}_gold`)) || 0;
    
    const goldEl = document.getElementById('repTotalGold');
    const slaEl  = document.getElementById('repSlaHealth');

    if (goldEl) goldEl.innerText = (storedGold + 1250).toString();
    if (slaEl)  slaEl.innerText  = "85%";

    const performers = [
        {
            name: localStorage.getItem('guild_user_funcionario') || 'Aventureiro QA',
            xp: parseInt(localStorage.getItem(`${funcionarioKey}_xp`)) || 0
        },
        { name: "Dev Sênior", xp: 8200 }
    ].sort((a, b) => b.xp - a.xp);

    const list = document.getElementById('topPerformersList');
    if (list) {
        list.innerHTML = performers.map(p => `
            <div class="top-performer-row">
                <span>${p.name}</span>
                <span>${p.xp} XP</span>
            </div>
        `).join('');
    }
}
// ==========================================
// 2. GERENCIAMENTO DE LOOT (CRUD COM MODAL)
// ==========================================
function setupLootForm() {
    const lootForm = document.getElementById('lootForm');
    if (!lootForm) return;

    lootForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const item = {
            name: document.getElementById('lootName').value.trim(),
            price: parseInt(document.getElementById('lootPrice').value),
            image: document.getElementById('lootImage').value
        };

        let customLoot = JSON.parse(localStorage.getItem('guild_custom_loot')) || [];
        customLoot.push(item);
        localStorage.setItem('guild_custom_loot', JSON.stringify(customLoot));
        
        lootForm.reset();
        showToast(`Item "${item.name}" forjado!`);
        renderInventory();
    });
}

function renderInventory() {
    const inventoryList = document.getElementById('inventoryList');
    if (!inventoryList) return;
    const customLoot = JSON.parse(localStorage.getItem('guild_custom_loot')) || [];
    
    inventoryList.innerHTML = customLoot.map((item, index) => `
        <div class="inventory-item">
            <div class="inventory-item-info">
                <img src="${item.image}" alt="Img" style="width:30px; margin-right:10px;">
                <div>${item.name} - ${item.price} 💰</div>
            </div>
            <div class="inventory-actions">
                <button class="btn-pixel" onclick="openEditModal(${index})">Editar</button>
                <button class="btn-pixel" style="background:#e74c3c" onclick="deleteLoot(${index})">Excluir</button>
            </div>
        </div>
    `).join('');
}

// Logica do Modal de Edição
let currentEditIndex = -1;

window.openEditModal = (index) => {
    const customLoot = JSON.parse(localStorage.getItem('guild_custom_loot')) || [];
    const item = customLoot[index];
    currentEditIndex = index;
    
    document.getElementById('editLootName').value = item.name;
    document.getElementById('editLootPrice').value = item.price;
    document.getElementById('editLootModal').style.display = 'flex';
};

window.closeEditModal = () => {
    document.getElementById('editLootModal').style.display = 'none';
};

document.getElementById('editLootForm').addEventListener('submit', (e) => {
    e.preventDefault();
    let customLoot = JSON.parse(localStorage.getItem('guild_custom_loot')) || [];
    
    customLoot[currentEditIndex].name = document.getElementById('editLootName').value;
    customLoot[currentEditIndex].price = parseInt(document.getElementById('editLootPrice').value);
    
    localStorage.setItem('guild_custom_loot', JSON.stringify(customLoot));
    showToast('Item atualizado!');
    closeEditModal();
    renderInventory();
});

window.deleteLoot = (index) => {
    let customLoot = JSON.parse(localStorage.getItem('guild_custom_loot')) || [];
    customLoot.splice(index, 1);
    localStorage.setItem('guild_custom_loot', JSON.stringify(customLoot));
    renderInventory();
};

// ==========================================
// 3. ROSTER E STATUS
// ==========================================
function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    // Lê os dados do funcionário com a chave correta — sem misturar com o admin
    const funcionarioKey  = 'player_funcionario';
    const isCursed        = localStorage.getItem(`${funcionarioKey}_is_cursed`) === 'true';
    const funcionarioName = localStorage.getItem('guild_user_funcionario') || 'Aventureiro QA';
    const funcionarioPic  = localStorage.getItem('guild_avatar_funcionario') || 'assets/imgs/caneca_pixel.jpg';
    const funcionarioXP   = parseInt(localStorage.getItem(`${funcionarioKey}_xp`))    || 0;
    const funcionarioLv   = parseInt(localStorage.getItem(`${funcionarioKey}_level`)) || 1;
    const funcionarioQts  = parseInt(localStorage.getItem(`${funcionarioKey}_tasks`)) || 0;

    const users = [
        {
            name: funcionarioName,
            pic: funcionarioPic,
            xp: funcionarioXP,
            level: funcionarioLv,
            quests: funcionarioQts,
            status: isCursed ? 'cursed' : 'online',
            statusText: isCursed ? '🚨 Maldição (Bug Aberto)' : '✅ Saudável'
        },
        {
            name: "Dev Sênior",
            pic: "assets/imgs/mouse_pixel.jpg",
            xp: 8200,
            level: 5,
            quests: 12,
            status: 'online',
            statusText: '✅ Saudável'
        }
    ];

    tbody.innerHTML = users.map(u => `
        <tr>
            <td><img src="${u.pic}" style="width:30px; border-radius:4px; object-fit:cover;"></td>
            <td>${u.name}</td>
            <td>Lv.${u.level} — ${u.xp} XP</td>
            <td>${u.quests}</td>
            <td><span class="status-badge ${u.status}">${u.statusText}</span></td>
        </tr>
    `).join('');
}
