// ==========================================
// 0. CONFIGURAÇÃO E PROTEÇÃO DE ROTA
// ==========================================
const token = localStorage.getItem('guild_token');

if (!token) {
    window.location.href = 'login.html';
}


function renderAchievementsBadgesHtml(achievements = []) {
    const unlockedKeys = new Set(achievements.map(a => a.key));
    const badges = ALL_ACHIEVEMENTS.map(a => {
        const unlocked = unlockedKeys.has(a.key);
        const icon     = a.title.split(' ')[0];
        const name     = a.title.split(' ').slice(1).join(' ');
        return `
            <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;
                        background:${unlocked ? 'rgba(243,156,18,0.08)' : 'rgba(255,255,255,0.02)'};
                        border:1px solid ${unlocked ? '#f39c12' : '#2c3e50'};
                        border-radius:3px;opacity:${unlocked ? '1' : '0.4'};">
                <span style="font-size:16px;line-height:1;">${unlocked ? icon : '🔒'}</span>
                <div style="flex:1;">
                    <div style="font-size:8px;color:${unlocked ? '#f1c40f' : '#7f8c8d'};font-weight:bold;letter-spacing:1px;">${name}</div>
                    <div style="font-size:7px;color:#7f8c8d;">${a.desc}</div>
                </div>
                ${unlocked ? '<span style="font-size:9px;color:#27ae60;">✓</span>' : ''}
            </div>
        `;
    }).join('');

    return `
        <hr class="profile-divider">
        <div style="font-size:7px;color:#7f8c8d;letter-spacing:2px;margin-bottom:8px;">CONQUISTAS</div>
        <div style="display:flex;flex-direction:column;gap:6px;">${badges}</div>
    `;
}

let currentCoins   = 0;
let playerData     = {};
let cart           = [];
let cartTotalValue = 0;

document.addEventListener('DOMContentLoaded', async () => {
    await loadPlayerProfile();
    await loadCustomLoot();
    updateCartUI();
});

// ==========================================
// 1. CARREGAR E RENDERIZAR PERFIL DO JOGADOR
// ==========================================
async function loadPlayerProfile() {
    try {
        const response = await fetch(`${API_URL}/players/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const player = await response.json();
            currentCoins = player.coins || 0;

            playerData = {
                nome:             player.nome     || player.username,
                avatar_url:       player.avatar_url,
                level:            player.level    || 1,
                xp:               player.xp       || 0,
                coins:            currentCoins,
                faction:          player.faction  || '—',
                quests_completed: player.quests_completed || 0,
                achievements:     player.achievements     || [],
            };

            renderPlayerProfile();

        } else {
            localStorage.clear();
            window.location.href = 'login.html';
        }
    } catch (err) {
        console.error('Erro ao carregar perfil do jogador:', err);
        showToast('Erro ao sincronizar seu saldo com o servidor.', 'error');
    }
}

function renderPlayerProfile() {
    const card = document.getElementById('shopProfile');
    if (!card) return;

    const { nome, avatar_url, level, xp, coins, faction, quests_completed } = playerData;
    const xpMax = xpParaProximoNivel(level);
    const xpPct = Math.min(100, Math.round((xp / xpMax) * 100));

    const guildIcon = GUILD_ICONS[faction] || '🏰';

    card.innerHTML = `
        <div class="profile-avatar-wrap">
            <img class="profile-avatar" src="${avatar_url || 'assets/imgs/caneca_pixel.jpg'}" alt="Avatar">
            <div class="profile-level-badge">Lv.${level}</div>
        </div>

        <h2 class="profile-name">${nome}</h2>

        <div class="profile-guild-badge">${guildIcon} ${faction}</div>

        <div class="profile-xp-section">
            <div class="profile-xp-label">
                <span>XP</span>
                <span>${xp.toLocaleString('pt-BR')} / ${xpMax.toLocaleString('pt-BR')}</span>
            </div>
            <div class="profile-xp-track">
                <div class="profile-xp-fill" style="width: ${xpPct}%"></div>
            </div>
        </div>

        <hr class="profile-divider">

        <div class="profile-stat-row">
            <div class="profile-stat">
                <span class="profile-stat-icon">💰</span>
                <span class="profile-stat-value">${coins.toLocaleString('pt-BR')}</span>
                <span class="profile-stat-label">Gold</span>
            </div>
            <div class="profile-stat">
                <span class="profile-stat-icon">⚔️</span>
                <span class="profile-stat-value">${quests_completed}</span>
                <span class="profile-stat-label">Missões</span>
            </div>
        </div>

        ${renderAchievementsBadgesHtml(playerData.achievements)}
    `;
}

// ==========================================
// 2. CARREGAR VITRINE VIA API
// ==========================================
async function loadCustomLoot() {
    const itemsGrid = document.querySelector('.items-grid');
    if (!itemsGrid) return;

    try {
        const response = await fetch(`${API_URL}/loot`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const customLoot = await response.json();
            itemsGrid.innerHTML = '';

            customLoot.forEach((item, index) => {
                const shopItem = document.createElement('div');
                shopItem.className = 'shop-item';
                shopItem.setAttribute('data-cy',    `product-custom-${index}`);
                shopItem.setAttribute('data-price', item.price);
                shopItem.setAttribute('data-id',    item._id);

                shopItem.innerHTML = `
                    <div class="item-name" style="color: #f1c40f;">✨ ${item.name}</div>
                    <img src="${item.image || 'assets/imgs/caneca_pixel.jpg'}" alt="Img" class="item-img" style="border-color: #f1c40f;">
                    <div class="item-price">${item.price} 💰</div>
                    <div class="shop-item-lock-notice"></div>
                    <button class="btn-pixel btn-buy" data-cy="btn-add-custom-${index}" onclick="addToCart('${item._id}', '${item.name}', ${item.price})">Adicionar</button>
                `;

                itemsGrid.appendChild(shopItem);
            });

            applyAffordability(currentCoins);
        }
    } catch (err) {
        console.error('Erro ao carregar vitrine:', err);
        showToast('Não foi possível carregar o catálogo de itens.', 'error');
    }
}

// ==========================================
// B: AFFORDABILITY — bloqueia itens inacessíveis
// ==========================================
function applyAffordability(budget) {
    document.querySelectorAll('.shop-item').forEach(item => {
        const price  = parseInt(item.getAttribute('data-price'), 10);
        const btn    = item.querySelector('.btn-buy');
        const notice = item.querySelector('.shop-item-lock-notice');

        if (price > budget) {
            item.classList.add('locked');
            if (btn)    btn.disabled = true;
            if (notice) notice.textContent = `Faltam ${(price - budget).toLocaleString('pt-BR')} 💰`;
        } else {
            item.classList.remove('locked');
            if (btn)    btn.disabled = false;
            if (notice) notice.textContent = '';
        }
    });
}

// ==========================================
// 3. GERENCIAMENTO DO CARRINHO
// ==========================================
function addToCart(itemId, itemName, itemPrice) {
    const existing = cart.find(item => item.id === itemId);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ id: itemId, name: itemName, price: itemPrice, quantity: 1 });
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

    // Preview de saldo pós-compra
    const remaining = currentCoins - cartTotalValue;
    let preview = document.getElementById('cartBalancePreview');
    if (!preview) {
        preview = document.createElement('div');
        preview.id = 'cartBalancePreview';
        preview.className = 'cart-balance-preview';
        cartTotalElement.closest('.cart-total').insertAdjacentElement('afterend', preview);
    }

    if (cartTotalValue > 0) {
        preview.style.display = 'block';
        preview.className = `cart-balance-preview ${remaining >= 0 ? 'ok' : 'short'}`;
        preview.textContent = remaining >= 0
            ? `Saldo restante: ${remaining.toLocaleString('pt-BR')} 💰`
            : `Faltam ${Math.abs(remaining).toLocaleString('pt-BR')} 💰 para esta compra`;
    } else {
        preview.style.display = 'none';
    }

    // Atualiza affordability com saldo real descontado do carrinho
    applyAffordability(Math.max(0, remaining));
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
        const response = await fetch(`${API_URL}/players/checkout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                items: cart.map(item => ({ id: item.id, quantity: item.quantity }))
            })
        });

        const data = await response.json();

        if (response.ok) {
            currentCoins     = data.updatedCoins;
            playerData.coins = currentCoins;
            renderPlayerProfile();

            clearCart();
            applyAffordability(currentCoins);
            showToast('Compra realizada com sucesso! O RH enviará os itens 🎁');
        } else {
            showToast(`Falha no checkout: ${data.message || 'Erro inesperado'}`, 'error');
        }
    } catch (err) {
        console.error('Erro ao processar checkout:', err);
        showToast('Erro crítico de comunicação com o servidor.', 'error');
    }
}
