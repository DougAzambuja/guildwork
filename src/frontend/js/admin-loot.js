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

    setupLootForm();
    renderInventory();

    document.getElementById('editLootForm').addEventListener('submit', submitEditLoot);
});

// ==========================================
// 1. FORJA DE LOOT
// ==========================================
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
            const response = await fetch(`${API_URL}/loot`, {
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

// ==========================================
// 2. ESTOQUE + PAGINAÇÃO
// ==========================================
let currentInventory     = [];
let inventoryPage        = 0;
const INVENTORY_PER_PAGE = 10;

async function renderInventory() {
    try {
        const response = await fetch(`${API_URL}/loot`, {
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

// ==========================================
// 3. MODAL DE EDIÇÃO
// ==========================================
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

async function submitEditLoot(e) {
    e.preventDefault();

    const updatedData = {
        name:  document.getElementById('editLootName').value.trim(),
        price: parseInt(document.getElementById('editLootPrice').value)
    };

    try {
        const response = await fetch(`${API_URL}/loot/${currentEditId}`, {
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
}

window.deleteLoot = async (itemId) => {
    if (!confirm('Tem certeza que deseja destruir este item?')) return;

    try {
        const response = await fetch(`${API_URL}/loot/${itemId}`, {
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
