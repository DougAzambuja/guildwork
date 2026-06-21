// ==========================================
// 0. PROTEÇÃO DE ROTA
// ==========================================

// Verifica se o usuário NÃO está logado
if (!localStorage.getItem('guild_role')) {
    window.location.href = 'login.html';
}

// ==========================================
// 0.5. NOME DINÂMICO E TOASTS (ALERTAS VISUAIS)
// ==========================================
const playerName = localStorage.getItem('guild_user') || 'Aventureiro Anônimo';
const playerNameElement = document.getElementById('playerName');
if (playerNameElement) playerNameElement.innerText = playerName;

// ==========================================
// 1. DADOS INICIAIS E ESTADO DO JOGADOR
// ==========================================
let currentCoins = parseInt(localStorage.getItem('guild_coins')) || 100;
document.getElementById('coinCount').innerText = currentCoins;

let cart = [];
let cartTotalValue = 0;

// ==========================================
// 1.5. CARREGAR ITENS DA FORJA (CUSTOM LOOT)
// ==========================================
function loadCustomLoot() {
    // Puxa a lista de itens que o Admin cadastrou (ou um array vazio se não tiver nada)
    const customLoot = JSON.parse(localStorage.getItem('guild_custom_loot')) || [];
    
    // Seleciona a vitrine no HTML
    const itemsGrid = document.querySelector('.items-grid');
    if (!itemsGrid) return;

    // Para cada item forjado, criamos um card na loja
    customLoot.forEach((item, index) => {
        const shopItem = document.createElement('div');
        shopItem.className = 'shop-item';
        // Adicionamos um data-cy dinâmico para os seus testes automatizados
        shopItem.setAttribute('data-cy', `product-custom-${index}`);

        // Desenhamos o HTML do produto novo
        shopItem.innerHTML = `
            <div class="item-name" style="color: #f1c40f;">✨ ${item.name}</div>
            <img src="${item.image}" alt="Img" class="item-img" style="border-color: #f1c40f;">
            <div class="item-price">${item.price} 💰</div>
            <button class="btn-pixel btn-buy" data-cy="btn-add-custom-${index}" onclick="addToCart('${item.name}', ${item.price})">Adicionar</button>
        `;

        // Colamos o novo produto no final da vitrine
        itemsGrid.appendChild(shopItem);
    });
}

// ==========================================
// 2. FUNÇÕES DO MARKETPLACE (CARRINHO)
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

function removeFromCart(index) {
    if (cart[index].quantity > 1) {
        cart[index].quantity -= 1;
    } else {
        cart.splice(index, 1);
    }
    updateCartUI();
}

function clearCart() {
    cart = [];
    updateCartUI();
}

// ==========================================
// 3. ATUALIZAÇÃO DA INTERFACE (UI)
// ==========================================
function updateCartUI() {
    const cartList = document.getElementById('cartList');
    const cartTotalElement = document.getElementById('cartTotal');
    
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
// 4. CHECKOUT
// ==========================================
function checkout() {
    if (cart.length === 0) {
        showToast("Seu carrinho está vazio! Adicione itens primeiro.", "error");
        return;
    }

    if (currentCoins >= cartTotalValue) {
        currentCoins -= cartTotalValue;
        localStorage.setItem('guild_coins', currentCoins);
        document.getElementById('coinCount').innerText = currentCoins;

        // Deduz do farmedGold para refletir no dashboard do admin
        let farmedGold = parseInt(localStorage.getItem('sprint_gold')) || 0;
        farmedGold = Math.max(0, farmedGold - cartTotalValue);
        localStorage.setItem('sprint_gold', farmedGold);
        
        clearCart(); 
        showToast("Compra realizada com sucesso! O RH enviará os itens.");
    } else {
        showToast(`Gold insuficiente! Faltam ${cartTotalValue - currentCoins} moedas. Faça mais Quests!`, "error");
    }
}

// Inicia a interface com os itens extras e carrinho vazio
loadCustomLoot();
updateCartUI();