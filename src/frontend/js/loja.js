// ==========================================
// 0. CONFIGURAÇÃO E PROTEÇÃO DE ROTA
// ==========================================
const API_URL = 'http://localhost:3001/api';
const token   = localStorage.getItem('guild_token');

if (!token) {
    window.location.href = 'login.html';
}

let currentCoins  = 0;
let cart          = [];
let cartTotalValue = 0;

document.addEventListener('DOMContentLoaded', async () => {
    await loadPlayerProfile();
    await loadCustomLoot();
    updateCartUI();
});

// ==========================================
// 1. CARREGAR PERFIL DO JOGADOR
// ==========================================
async function loadPlayerProfile() {
    try {
        // FIX: endpoint correto é /players/me
        const response = await fetch(`${API_URL}/players/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const player = await response.json();
            currentCoins = player.coins || 0;

            const coinEl = document.getElementById('coinCount');
            if (coinEl) coinEl.innerText = currentCoins;

            const nameEl = document.getElementById('playerName');
            if (nameEl) nameEl.innerText = player.nome || player.username;

        } else {
            // Token inválido — força logout
            localStorage.clear();
            window.location.href = 'login.html';
        }
    } catch (err) {
        console.error('Erro ao carregar perfil do jogador:', err);
        showToast('Erro ao sincronizar seu saldo com o servidor.', 'error');
    }
}

// ==========================================
// 2. CARREGAR VITRINE VIA API
// ==========================================
async function loadCustomLoot() {
    const itemsGrid = document.querySelector('.items-grid');
    if (!itemsGrid) return;

    try {
        // FIX: endpoint correto é /admin/loot
        const response = await fetch(`${API_URL}/admin/loot`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const customLoot = await response.json();

            // Limpa os itens estáticos do HTML e renderiza os do banco
            itemsGrid.innerHTML = '';

            customLoot.forEach((item, index) => {
                const shopItem = document.createElement('div');
                shopItem.className = 'shop-item';
                shopItem.setAttribute('data-cy', `product-custom-${index}`);

                shopItem.innerHTML = `
                    <div class="item-name" style="color: #f1c40f;">✨ ${item.name}</div>
                    <img src="${item.image_url || 'assets/imgs/caneca_pixel.jpg'}" alt="Img" class="item-img" style="border-color: #f1c40f;">
                    <div class="item-price">${item.price} 💰</div>
                    <button class="btn-pixel btn-buy" data-cy="btn-add-custom-${index}" onclick="addToCart('${item.name}', ${item.price})">Adicionar</button>
                `;

                itemsGrid.appendChild(shopItem);
            });
        }
    } catch (err) {
        console.error('Erro ao carregar vitrine:', err);
        showToast('Não foi possível carregar o catálogo de itens.', 'error');
    }
}

// ==========================================
// 3. GERENCIAMENTO DO CARRINHO
// ==========================================
function addToCart(itemName, itemPrice) {
    const existing = cart.find(item => item.name === itemName);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ name: itemName, price: itemPrice, quantity: 1 });
    }
    updateCartUI();
}

window.removeFromCart = (index) => {
    if (cart[index].quantity > 1) {
        cart[index].quantity -= 1;
    } else {
        cart.splice(index, 1);
    }
    updateCartUI();
};

function clearCart() {
    cart = [];
    updateCartUI();
}

function updateCartUI() {
    const cartList         = document.getElementById('cartList');
    const cartTotalElement = document.getElementById('cartTotal');
    if (!cartList || !cartTotalElement) return;

    cartList.innerHTML = '';
    cartTotalValue     = 0;

    if (cart.length === 0) {
        cartList.innerHTML = '<i>Carrinho vazio...</i>';
    } else {
        cart.forEach((item, index) => {
            const itemSubtotal = item.price * item.quantity;
            cartTotalValue    += itemSubtotal;

            const row = document.createElement('div');
            row.className = 'cart-item-row';
            row.innerHTML = `
                <div class="cart-item-info">
                    <span class="item-qtd">${item.quantity}x</span> ${item.name}
                </div>
                <div class="cart-item-actions">
                    <span>${itemSubtotal} 💰</span>
                    <button class="btn-remove" onclick="removeFromCart(${index})" title="Remover">-</button>
                </div>
            `;
            cartList.appendChild(row);
        });
    }

    cartTotalElement.innerText = cartTotalValue;
}

// ==========================================
// 4. CHECKOUT SEGURO VIA API
// ==========================================
async function checkout() {
    if (cart.length === 0) {
        showToast('Seu carrinho está vazio! Adicione itens primeiro.', 'error');
        return;
    }

    if (currentCoins < cartTotalValue) {
        showToast(`Gold insuficiente! Faltam ${cartTotalValue - currentCoins} moedas. Faça mais Quests!`, 'error');
        return;
    }

    try {
        // FIX: endpoint /players/checkout criado no backend
        const response = await fetch(`${API_URL}/players/checkout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                totalValue: cartTotalValue,
                items: cart
            })
        });

        const data = await response.json();

        if (response.ok) {
            currentCoins = data.updatedCoins;
            const coinEl = document.getElementById('coinCount');
            if (coinEl) coinEl.innerText = currentCoins;

            clearCart();
            showToast('Compra realizada com sucesso! O RH enviará os itens 🎁');
        } else {
            showToast(`Falha no checkout: ${data.message || 'Erro inesperado'}`, 'error');
        }
    } catch (err) {
        console.error('Erro ao processar checkout:', err);
        showToast('Erro crítico de comunicação com o servidor.', 'error');
    }
}