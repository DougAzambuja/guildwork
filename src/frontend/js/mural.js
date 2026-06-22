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
let activeTimers = {};

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

// async function updateServerGamification(xpGained, coinsGained) {
//     try {
//         // FIX: endpoint correto é /players/xp (POST)
//         const res = await fetch(`${API_URL}/players/xp`, {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json',
//                 'Authorization': `Bearer ${token}`
//             },
//             body: JSON.stringify({ xp: xpGained, coins: coinsGained })
//         });

//         if (res.ok) {
//             const updated = await res.json();

//             if (updated.level > playerData.level) {
//                 showToast(`🎉 LEVEL UP! Nível ${updated.level}!`);
//             }

//             playerData.xp    = updated.xp;
//             playerData.coins = updated.coins;
//             playerData.level = updated.level;
//             playerData.tasks      += 1;
//             playerData.farmedGold += coinsGained;

//             updateUI();
//         }
//     } catch (err) {
//         console.error('Erro ao sincronizar gamificação:', err);
//     }
// }

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
// async function completeQuest(element, xpGained, coinsGained) {
//     if (element.classList.contains('done')) return;
//     element.classList.add('done');
//     await updateServerGamification(xpGained, coinsGained);
//     showToast(`Quest Concluída! +${xpGained} XP`);
// }

// async function completeUrgentBug(element, baseXp, baseCoins) {
//     if (element.classList.contains('done')) return;

//     clearInterval(bugInterval);
//     element.classList.add('done');

//     const finalXp    = playerData.isCursed ? Math.floor(baseXp    / 2) : baseXp;
//     const finalCoins = playerData.isCursed ? Math.floor(baseCoins / 2) : baseCoins;

//     if (playerData.isCursed) {
//         const avatarEl    = document.getElementById('playerAvatar');
//         const xpBar       = document.getElementById('xpBar');
//         const xpContainer = document.getElementById('xpContainer');
//         if (avatarEl)    avatarEl.classList.remove('curse-critical');
//         if (xpBar)       xpBar.classList.remove('curse-critical');
//         if (xpContainer) xpContainer.classList.remove('curse-critical');

//         playerData.isCursed = false;
//         await setPlayerCurseState(false);
//         showToast('✨ Feitiço Quebrado!', 'error');
//     } else {
//         const avatarEl = document.getElementById('playerAvatar');
//         const xpBar    = document.getElementById('xpBar');
//         if (avatarEl) avatarEl.classList.remove('curse-warning');
//         if (xpBar)    xpBar.classList.remove('curse-warning');
//         showToast('⚔️ Bug esmagado no prazo! Recompensa Máxima!');
//     }

//     await updateServerGamification(finalXp, finalCoins);
//     const timerDisplay = document.getElementById('bugTimer');
//     if (timerDisplay) timerDisplay.innerText = 'RESOLVIDO';
// }

async function completeQuestOnServer(questId, csatScore = null) {
    try {
        const res = await fetch(`${API_URL}/quests/complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ questId, csatScore })
        });

        if (res.ok) {
            const data = await res.json();

            if (data.leveledUp) {
                showToast(`🎉 LEVEL UP! Nível ${data.updatedState.level}!`);
            }

            if (data.wasCursed) {
                playerData.isCursed = false;
                const avatarEl    = document.getElementById('playerAvatar');
                const xpBar       = document.getElementById('xpBar');
                const xpContainer = document.getElementById('xpContainer'); // Agora não escapa!
                
                if (avatarEl)    avatarEl.classList.remove('curse-critical', 'curse-warning');
                if (xpBar)       xpBar.classList.remove('curse-critical', 'curse-warning');
                if (xpContainer) xpContainer.classList.remove('curse-critical', 'curse-warning');
                
                showToast('✨ Feitiço Quebrado! Recompensas cortadas pela metade.', 'error');
            }

            // A Fonte da Verdade agora é o que o servidor devolveu
            playerData.xp    = data.updatedState.xp;
            playerData.coins = data.updatedState.coins;
            playerData.level = data.updatedState.level;
            playerData.tasks = data.updatedState.questsCompleted;
            playerData.farmedGold += data.coinsGained; 

            updateUI();
            return data; // Retorna os dados para o clique do card saber que deu certo
        } else {
            const err = await res.json();
            showToast(`Erro: ${err.message}`, 'error');
            return null;
        }
    } catch (err) {
        console.error('Erro ao completar quest:', err);
        return null;
    }
}

// ==========================================
// 5.5. MISSÃO DE SUPORTE (CSAT) — restaurada
// ==========================================
// async function completeSupportQuest(element, maxXp, coinsGained) {
//     if (element.classList.contains('done')) return;

//     const nota    = prompt('⭐ Qual foi a nota CSAT do cliente? (Digite um número de 1 a 5)');
//     const notaNum = parseInt(nota);

//     if (isNaN(notaNum) || notaNum < 1 || notaNum > 5) {
//         showToast('Nota inválida! Digite um número de 1 a 5.', 'error');
//         return;
//     }

//     element.classList.add('done');

//     // XP proporcional à nota: nota 5 = 100% do XP, nota 1 = 20%
//     const xpGained = Math.round(maxXp * (notaNum / 5));

//     await updateServerGamification(xpGained, coinsGained);

//     const feedbacks = {
//         5: '⭐⭐⭐⭐⭐ LENDÁRIO! Cliente encantado!',
//         4: '⭐⭐⭐⭐ Ótimo atendimento!',
//         3: '⭐⭐⭐ Missão cumprida.',
//         2: '⭐⭐ Pode melhorar...',
//         1: '⭐ Experiência ruim. Foco no próximo!'
//     };
//     showToast(`${feedbacks[notaNum]} +${xpGained} XP`);
// }

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
        
        // 1. Correção do Card Urgente (Ignora maiúsculas/minúsculas)
        const isUrgent = quest.type && quest.type.toLowerCase() === 'urgent';
        el.className = `quest-paper quest-jira ${isUrgent ? 'urgent' : ''}`;
        
        const isDone = completedIds.includes(quest._id);
        if (isDone) el.classList.add('done');

        // 2. O HTML do Cronômetro (Só aparece se tiver SLA e não estiver concluída)
        let timerHtml = '';
        if (quest.sla_seconds && !isDone) {
            timerHtml = `<div class="quest-timer" id="timer-${quest._id}">SLA: ${quest.sla_seconds}s</div>`;
        }

        // Mapeando os campos exatos do banco
        el.innerHTML = `
            <div class="quest-title">[${(quest.type || 'MISSÃO').toUpperCase()}]<br><br>${quest.title}</div>
            <div class="quest-meta">
                <span class="xp-reward">+${quest.xp_reward} XP</span>
                <span class="coin-reward">+${quest.coin_reward} 💰</span>
            </div>
            ${timerHtml} <div class="completed-stamp">FEITO</div>
        `;

        el.onclick = async function() {
            if (this.classList.contains('done')) return;
            
            const response = await completeQuestOnServer(quest._id);
            
            if (response) {
                this.classList.add('done');
                showToast(`Missão Cumprida! +${response.xpGained} XP`);
                completedIds.push(quest._id);
                localStorage.setItem('completed_quests', JSON.stringify(completedIds));
                
                // Para o cronômetro desta quest específica
                if (activeTimers[quest._id]) {
                    clearInterval(activeTimers[quest._id]);
                    const timerEl = this.querySelector('.quest-timer');
                    if (timerEl) {
                        timerEl.innerText = 'RESOLVIDO';
                        timerEl.style.color = '#2ecc71';
                        timerEl.style.borderColor = '#2ecc71';
                    }
                }
            }
        };

        // Adiciona no quadro
        board.insertBefore(el, board.firstChild);

        // 3. Dispara a máquina do tempo individual!
        if (quest.sla_seconds && !isDone) {
            startIndividualTimer(quest._id, quest.sla_seconds, el);
        }
    });
}

// A Máquina do Tempo Individual
function startIndividualTimer(questId, duration, questElement) {
    let timeLeft = duration;
    const timerDisplay = questElement.querySelector(`#timer-${questId}`);
    
    // Se já tinha um timer rodando pra essa quest, limpa para não duplicar
    if (activeTimers[questId]) clearInterval(activeTimers[questId]);

    activeTimers[questId] = setInterval(async () => {
        if (!timerDisplay) return;
        timeLeft--;

        if (timeLeft > 15) {
            timerDisplay.innerText = `SLA: ${timeLeft}s`;
        } else if (timeLeft > 0) {
            timerDisplay.innerText = `⚠️ CORRE! ${timeLeft}s`;
            timerDisplay.style.color = '#e67e22';
            timerDisplay.style.borderColor = '#e67e22';
            
            const avatarEl = document.getElementById('playerAvatar');
            if (avatarEl) avatarEl.classList.add('curse-warning');
        } else {
            // O Tempo Estourou!
            clearInterval(activeTimers[questId]);
            timerDisplay.innerText = '🚨 ESTOURADO!';
            timerDisplay.style.color = '#c0392b';
            timerDisplay.style.borderColor = '#c0392b';
            
            // Só aplica a maldição se o jogador já não estiver amaldiçoado
            if (!playerData.isCursed) {
                applyCurseVisuals();
                await setPlayerCurseState(true);
                showToast('🚨 MALDIÇÃO DO SLA! Resolva uma missão rápido!', 'error');
            }
        }
    }, 1000);
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