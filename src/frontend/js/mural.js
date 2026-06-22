// ==========================================
// 0. PROTEÇÃO DE ROTA E INICIALIZAÇÃO
// ==========================================
const API_URL = 'http://localhost:3001/api';
const token   = localStorage.getItem('guild_token');

if (!token || !localStorage.getItem('guild_role')) {
    window.location.href = 'login.html';
}

// ==========================================
// 1. VARIÁVEIS DE ESTADO
// ==========================================
const maxXP = 10000;

let playerData = {
    id:        null,
    xp:        0,
    coins:     0,
    level:     1,
    tasks:     0,
    farmedGold: 0, // rastrea gold ganho na sessão para a barra de objetivos
    isCursed:  false,
    name:      'Aventureiro',
    avatar:    'assets/imgs/caneca_pixel.jpg'
};

const targetTasks = 5;
const targetGold  = 150;
let bugInterval   = null;

document.addEventListener('DOMContentLoaded', async () => {
    await fetchPlayerState();
    syncJira();
});

// ==========================================
// 2. COMUNICAÇÃO COM A API
// ==========================================
async function fetchPlayerState() {
    try {
        // FIX: endpoint correto é /players/me
        const res = await fetch(`${API_URL}/players/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const data = await res.json();
            playerData = {
                id:         data._id,
                xp:         data.xp        || 0,
                coins:      data.coins      || 0,
                level:      data.level      || 1,
                tasks:      data.quests_completed || 0,
                farmedGold: 0,
                isCursed:   data.is_cursed  || false,
                name:       data.nome       || data.username,
                avatar:     data.avatar_url || 'assets/imgs/caneca_pixel.jpg'
            };

            updateUI();

            if (playerData.isCursed) {
                applyCurseVisuals();
            } else {
                startBugTimer();
            }

        } else {
            // Token inválido ou expirado — força logout
            localStorage.clear();
            window.location.href = 'login.html';
        }
    } catch (err) {
        console.error('Erro ao puxar dados do jogador:', err);
        showToast('Erro de conexão com o servidor.', 'error');
    }
}

async function updateServerGamification(xpGained, coinsGained) {
    try {
        // FIX: endpoint correto é /players/xp (POST)
        const res = await fetch(`${API_URL}/players/xp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ xp: xpGained, coins: coinsGained })
        });

        if (res.ok) {
            const updated = await res.json();

            if (updated.level > playerData.level) {
                showToast(`🎉 LEVEL UP! Nível ${updated.level}!`);
            }

            playerData.xp    = updated.xp;
            playerData.coins = updated.coins;
            playerData.level = updated.level;
            playerData.tasks      += 1;
            playerData.farmedGold += coinsGained;

            updateUI();
        }
    } catch (err) {
        console.error('Erro ao sincronizar gamificação:', err);
    }
}

// ==========================================
// 3. ATUALIZAÇÃO VISUAL (UI)
// ==========================================
function updateUI() {
    const xpPct = Math.min((playerData.xp / maxXP) * 100, 100);

    const xpBar = document.getElementById('xpBar');
    if (xpBar) xpBar.style.width = xpPct + '%';

    const coinEl = document.getElementById('coinCount');
    if (coinEl) coinEl.innerText = playerData.coins;

    const levelEl = document.getElementById('levelDisplay');
    if (levelEl) levelEl.innerText = `Lvl: ${playerData.level}`;

    const nameEl = document.getElementById('playerName');
    if (nameEl) nameEl.innerText = playerData.name;

    const avatarEl = document.getElementById('playerAvatar');
    if (avatarEl) avatarEl.src = playerData.avatar;

    updateObjectivesUI();
}

function updateObjectivesUI() {
    // Barra de tarefas
    const taskPct = Math.min((playerData.tasks / targetTasks) * 100, 100);
    const taskBar = document.getElementById('objTaskBar');
    if (taskBar) taskBar.style.width = taskPct + '%';
    const taskText = document.getElementById('objTaskText');
    if (taskText) taskText.innerText = `${playerData.tasks}/${targetTasks}`;

    // Barra de gold — restaurada
    const goldPct = Math.min((playerData.farmedGold / targetGold) * 100, 100);
    const goldBar = document.getElementById('objGoldBar');
    if (goldBar) goldBar.style.width = goldPct + '%';
    const goldText = document.getElementById('objGoldText');
    if (goldText) goldText.innerText = `${playerData.farmedGold}/${targetGold}`;
}

// ==========================================
// 4. MECÂNICA DE MALDIÇÃO DE SLA
// ==========================================
function startBugTimer() {
    let bugTimeLeft    = 30;
    const timerDisplay = document.getElementById('bugTimer');

    if (bugInterval) clearInterval(bugInterval);

    bugInterval = setInterval(async () => {
        if (!timerDisplay) return;
        bugTimeLeft--;

        if (bugTimeLeft > 15) {
            timerDisplay.innerText       = `SLA: ${bugTimeLeft}s`;
            timerDisplay.style.color     = '';
            timerDisplay.style.borderColor = '';
        } else if (bugTimeLeft > 0) {
            timerDisplay.innerText         = `⚠️ CORRE! ${bugTimeLeft}s`;
            timerDisplay.style.color       = '#e67e22';
            timerDisplay.style.borderColor = '#e67e22';
            const avatarEl = document.getElementById('playerAvatar');
            if (avatarEl) avatarEl.classList.add('curse-warning');
            const xpBar = document.getElementById('xpBar');
            if (xpBar) xpBar.classList.add('curse-warning');
        } else {
            clearInterval(bugInterval);
            timerDisplay.innerText = '🚨 SLA ESTOURADO!';
            applyCurseVisuals();
            await setPlayerCurseState(true);
            showToast('🚨 MALDIÇÃO DO SLA! Resolva o bug rápido!', 'error');
        }
    }, 1000);
}

function applyCurseVisuals() {
    playerData.isCursed = true;
    const avatarEl = document.getElementById('playerAvatar');
    const xpBar    = document.getElementById('xpBar');
    if (avatarEl) {
        avatarEl.classList.remove('curse-warning');
        avatarEl.classList.add('curse-critical');
    }
    if (xpBar) {
        xpBar.classList.remove('curse-warning');
        xpBar.classList.add('curse-critical');
    }
    const xpContainer = document.getElementById('xpContainer');
    if (xpContainer) xpContainer.classList.add('curse-critical');
}

async function setPlayerCurseState(state) {
    try {
        // FIX: body usa is_cursed (snake_case) igual ao modelo do banco
        await fetch(`${API_URL}/players/curse`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ is_cursed: state })
        });
    } catch (err) {
        console.error('Erro ao sincronizar estado de maldição:', err);
    }
}

// ==========================================
// 5. COMPLETAR QUESTS
// ==========================================
async function completeQuest(element, xpGained, coinsGained) {
    if (element.classList.contains('done')) return;
    element.classList.add('done');
    await updateServerGamification(xpGained, coinsGained);
    showToast(`Quest Concluída! +${xpGained} XP`);
}

async function completeUrgentBug(element, baseXp, baseCoins) {
    if (element.classList.contains('done')) return;

    clearInterval(bugInterval);
    element.classList.add('done');

    const finalXp    = playerData.isCursed ? Math.floor(baseXp    / 2) : baseXp;
    const finalCoins = playerData.isCursed ? Math.floor(baseCoins / 2) : baseCoins;

    if (playerData.isCursed) {
        const avatarEl    = document.getElementById('playerAvatar');
        const xpBar       = document.getElementById('xpBar');
        const xpContainer = document.getElementById('xpContainer');
        if (avatarEl)    avatarEl.classList.remove('curse-critical');
        if (xpBar)       xpBar.classList.remove('curse-critical');
        if (xpContainer) xpContainer.classList.remove('curse-critical');

        playerData.isCursed = false;
        await setPlayerCurseState(false);
        showToast('✨ Feitiço Quebrado!', 'error');
    } else {
        const avatarEl = document.getElementById('playerAvatar');
        const xpBar    = document.getElementById('xpBar');
        if (avatarEl) avatarEl.classList.remove('curse-warning');
        if (xpBar)    xpBar.classList.remove('curse-warning');
        showToast('⚔️ Bug esmagado no prazo! Recompensa Máxima!');
    }

    await updateServerGamification(finalXp, finalCoins);
    const timerDisplay = document.getElementById('bugTimer');
    if (timerDisplay) timerDisplay.innerText = 'RESOLVIDO';
}

// ==========================================
// 5.5. MISSÃO DE SUPORTE (CSAT) — restaurada
// ==========================================
async function completeSupportQuest(element, maxXp, coinsGained) {
    if (element.classList.contains('done')) return;

    const nota    = prompt('⭐ Qual foi a nota CSAT do cliente? (Digite um número de 1 a 5)');
    const notaNum = parseInt(nota);

    if (isNaN(notaNum) || notaNum < 1 || notaNum > 5) {
        showToast('Nota inválida! Digite um número de 1 a 5.', 'error');
        return;
    }

    element.classList.add('done');

    // XP proporcional à nota: nota 5 = 100% do XP, nota 1 = 20%
    const xpGained = Math.round(maxXp * (notaNum / 5));

    await updateServerGamification(xpGained, coinsGained);

    const feedbacks = {
        5: '⭐⭐⭐⭐⭐ LENDÁRIO! Cliente encantado!',
        4: '⭐⭐⭐⭐ Ótimo atendimento!',
        3: '⭐⭐⭐ Missão cumprida.',
        2: '⭐⭐ Pode melhorar...',
        1: '⭐ Experiência ruim. Foco no próximo!'
    };
    showToast(`${feedbacks[notaNum]} +${xpGained} XP`);
}

// ==========================================
// 6. INTEGRAÇÃO JIRA (mantém local pois simula API externa)
// ==========================================
async function syncJira() {
    const board = document.getElementById('questBoard');
    if (!board) {
        showToast('Erro: Quadro não encontrado!', 'error');
        return;
    }

    try {
        showToast('Sincronizando com a Forja...', 'info');
        
        // Buscando as missões REAIS criadas pelo Admin no banco de dados
        const response = await fetch(`${API_URL}/quests`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const quests = await response.json();
            renderJiraQuests(quests);
            showToast('Quests Sincronizadas com sucesso!');
        } else {
            showToast('Falha ao buscar pergaminhos.', 'error');
        }
    } catch (err) {
        console.error('Erro ao sincronizar quests:', err);
        showToast('O servidor não está respondendo.', 'error');
    }
}

function renderJiraQuests(quests) {
    const board = document.getElementById('questBoard');
    if (!board) return;

    // Limpa o quadro atual
    board.querySelectorAll('.quest-jira').forEach(el => el.remove());

    // Pega as quests que esse usuário já clicou em "Feito" nessa sessão para não repetir
    const completedIds = JSON.parse(localStorage.getItem('completed_quests')) || [];

    quests.forEach(quest => {
        const el = document.createElement('div');
        el.className = 'quest-paper quest-jira';
        
        const isDone = completedIds.includes(quest._id);
        if (isDone) el.classList.add('done');

        // Mapeando os campos exatos do seu banco de dados (xp_reward, coin_reward)
        el.innerHTML = `
            <div class="quest-title">[${quest.type || 'MISSÃO'}]<br><br>${quest.title}</div>
            <div class="quest-meta">
                <span class="xp-reward">+${quest.xp_reward} XP</span>
                <span class="coin-reward">+${quest.coin_reward} 💰</span>
            </div>
            <div class="completed-stamp">FEITO</div>
        `;

        el.onclick = async function() {
            if (this.classList.contains('done')) return;
            
            // Chama a sua função de completar quest que vai disparar XP e Gold pro Backend
            await completeQuest(this, quest.xp_reward, quest.coin_reward);
            
            // Marca visualmente
            this.classList.add('done');
            
            // Salva localmente para não renderizar como pendente se ele der F5
            completedIds.push(quest._id);
            localStorage.setItem('completed_quests', JSON.stringify(completedIds));
        };

        // Adiciona no quadro
        board.insertBefore(el, board.firstChild);
    });
}

// ==========================================
// 7. GESTÃO DE PERFIL (MODAL)
// ==========================================
let tempSelectedAvatar = '';

window.openProfileModal = () => {
    document.getElementById('profileModal').style.display = 'flex';
    document.getElementById('editProfileName').value = playerData.name;
    tempSelectedAvatar = playerData.avatar;
    document.getElementById('modalAvatarPreview').src = tempSelectedAvatar;
    document.querySelectorAll('.avatar-option').forEach(el => {
        el.classList.remove('selected');
        if (el.getAttribute('src') === playerData.avatar) el.classList.add('selected');
    });
};

window.closeProfileModal = () => {
    document.getElementById('profileModal').style.display = 'none';
};

window.selectAvatar = (url, element) => {
    tempSelectedAvatar = url;
    document.getElementById('modalAvatarPreview').src = url;
    document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
    if (element) element.classList.add('selected');
};

const editProfilePicEl = document.getElementById('editProfilePic');
if (editProfilePicEl) {
    editProfilePicEl.addEventListener('input', function(e) {
        const val = e.target.value.trim();
        if (val) {
            tempSelectedAvatar = val;
            document.getElementById('modalAvatarPreview').src = val;
            document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
        }
    });
}

const profileForm = document.getElementById('profileForm');
if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newName = document.getElementById('editProfileName').value.trim();
        const newPic  = document.getElementById('editProfilePic').value.trim() || tempSelectedAvatar;

        try {
            // FIX: endpoint correto é /players/me (PUT)
            const res = await fetch(`${API_URL}/players/me`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ nome: newName, avatar_url: newPic })
            });

            if (res.ok) {
                playerData.name   = newName;
                playerData.avatar = newPic;
                localStorage.setItem('guild_user', newName);
                updateUI();
                closeProfileModal();
                showToast('Perfil forjado com sucesso!');
            } else {
                showToast('Erro ao salvar perfil.', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Erro de conexão com o servidor.', 'error');
        }
    });
}