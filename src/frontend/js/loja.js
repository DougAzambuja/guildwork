// ==========================================
// 0. CONFIGURAÇÃO E PROTEÇÃO DE ROTA
// ==========================================
const API_URL = 'http://localhost:3001/api';
const token = localStorage.getItem('guild_token');

// Se não houver token ativo, bloqueia a renderização e redireciona
if (!token) {
    window.location.href = 'login.html';
}

let currentCoins = 0;
let cart = [];
let cartTotalValue = 0;

// Inicializa a interface carregando as informações do banco assincronamente
document.addEventListener('DOMContentLoaded', async () => {
    await loadPlayerProfile();
    await loadCustomLoot();
    updateCartUI();
});

// ==========================================
// 1. CARREGAR PERFIL DO JOGADOR (SALDO REAL)
// ==========================================
async function loadPlayerProfile() {
    try {
        // Busca os dados de gamificação do usuário logado através do Token
        const response = await fetch(`${API_URL}/players/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const player = await response.json();
            currentCoins = player.coins || 0;
            
            // Atualiza os contadores na tela com a fonte da verdade do MongoDB
            document.getElementById('coinCount').innerText = currentCoins;
            
            const playerNameElement = document.getElementById('playerName');
            if (playerNameElement) playerNameElement.innerText = player.nome || player.username;
            
            localStorage.setItem('guild_user', player.nome || player.username);
        } else {
            // Se o token for inválido ou estiver expirado, força o logout protetivo
            localStorage.clear();
            window.location.href = 'login.html';
        }
    } catch (err) {
        console.error("Erro ao carregar perfil do jogador:", err);
        showToast("Erro ao sincronizar seu saldo de moedas com o servidor.", "error");
    }
}

// ==========================================
// 2. CARREGAR VITRINE DA LOJA VIA API
// ==========================================
async function loadCustomLoot() {
    const itemsGrid = document.querySelector('.items-grid');
    if (!itemsGrid) return;

    try {
        // Consome os mesmos itens que o Administrador gerenciou no painel
        const response = await fetch(`${API_URL}/admin/inventory`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const customLoot = await response.json();
            
            // Limpa o grid estático para renderizar a resposta dinâmica do banco
            itemsGrid.innerHTML = '';

            customLoot.forEach((item, index) => {
                const shopItem = document.createElement('div');
                shopItem.className = 'shop-item';
                shopItem.setAttribute('data-cy', `product-custom-${index}`);

                shopItem.innerHTML = `
                    <div class="item-name" style="color: #f1c40f;">✨ ${item.name}</div>
                    <img src="${item.image || 'assets/imgs/caneca_pixel.jpg'}" alt="Img" class="item-img" style="border-color: #f1c40f;">
                    <div class="item-price">${item.price} 💰</div>
                    <button class="btn-pixel btn-buy" data-cy="btn-add-custom-${index}" onclick="addToCart('${item.name}', ${item.price})">Adicionar</button>
                `;

                itemsGrid.appendChild(shopItem);
            });
        }
    } catch (err) {
        console.error("Erro ao carregar vitrine:", err);
        showToast("Não foi possível carregar o catálogo de itens.", "error");
    }
}

// ==========================================
// 3. GERENCIAMENTO LOCAL DO CARRINHO
// ==========================================
function addToCart(itemName, itemPrice) {
    let existingItem = cart.find(item => item.name === itemName);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ name: itemName, price: itemPrice, quantity: 1 });
    }
    
    updateCartUI();
}

// Vinculado globalmente aos botões de remoção do carrinho
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
    const cartList = document.getElementById('cartList');
    const cartTotalElement = document.getElementById('cartTotal');
    if (!cartList || !cartTotalElement) return;
    
    cartList.innerHTML = ''; 
    cartTotalValue = 0;

    if (cart.length === 0) {
        cartList.innerHTML = '<i>Carrinho vazio...</i>';
    } else {
        cart.forEach((item, index) => {
            let itemSubtotal = item.price * item.quantity;
            cartTotalValue += itemSubtotal;
            
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
// 4. CHECKOUT SEGURO NO BACKEND
// ==========================================
async function checkout() {
    if (cart.length === 0) {
        showToast("Seu carrinho está vazio! Adicione itens primeiro.", "error");
        return;
    }

    // Validação preventiva no client-side
    if (currentCoins < cartTotalValue) {
        showToast(`Gold insuficiente! Faltam ${cartTotalValue - currentCoins} moedas. Faça mais Quests!`, "error");
        return;
    }

    try {
        // Envia a requisição de compra estruturada para processamento no servidor
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
            // Atualiza o estado da UI com o novo valor de moedas calculado e retornado pelo backend
            currentCoins = data.updatedCoins;
            document.getElementById('coinCount').innerText = currentCoins;

            clearCart(); 
            showToast("Compra realizada com sucesso! O RH enviará os itens 🎁");
        } else {
            showToast(`Falha no checkout: ${data.message || 'Erro inesperado'}`, "error");
        }
    } catch (err) {
        console.error("Erro ao processar transação de checkout:", err);
        showToast("Erro crítico de comunicação com a guilda.", "error");
    }
}