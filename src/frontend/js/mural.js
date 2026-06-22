// ==========================================
// 0. PROTEÇÃO DE ROTA E INICIALIZAÇÃO
// ==========================================
const API_URL = 'http://localhost:3001/api';
const token = localStorage.getItem('guild_token');

if (!token || !localStorage.getItem('guild_role')) {
    window.location.href = 'login.html';
}

// ==========================================
// 1. VARIÁVEIS DE ESTADO
// ==========================================
const maxXP = 10000;
let playerData = {
    id: null,
    xp: 0,
    coins: 0,
    level: 1,
    tasks: 0,
    isCursed: false,
    name: 'Aventureiro',
    avatar: 'assets/imgs/caneca_pixel.jpg'
};

const targetTasks = 5;
const targetGold  = 150;
let bugInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
    await fetchPlayerState();
    renderJiraQuests();
});

// ==========================================
// 2. COMUNICAÇÃO COM A API
// ==========================================
async function fetchPlayerState() {
    try {
        const res = await fetch(`${API_URL}/players/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            const data = await res.json();
            playerData = {
                id: data._id,
                xp: data.xp || 0,
                coins: data.coins || 0,
                level: data.level || 1,
                tasks: data.quests_completed || 0,
                isCursed: data.is_cursed || false,
                name: data.nome || data.username,
                avatar: data.avatar_url || 'assets/imgs/caneca_pixel.jpg'
            };
            updateUI();
            
            // Inicia o timer do Bug *apenas se* o banco disser que ele ainda não está amaldiçoado
            if (playerData.isCursed) {
                applyCurseVisuals();
            } else {
                startBugTimer();
            }

        } else {
            console.error("Falha na autenticação do mural.");
        }
    } catch (err) {
        console.error("Erro ao puxar dados:", err);
    }
}

async function updateServerGamification(xpGained, coinsGained) {
    try {
        // Envia o incremento para o backend
        const res = await fetch(`${API_URL}/players/gamification`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ xp: xpGained, coins: coinsGained })
        });
        
        if (res.ok) {
            const updatedData = await res.json();
            // Verifica se o servidor retornou um level up!
            if (updatedData.level > playerData.level) {
                showToast(`🎉 LEVEL UP! Nível ${updatedData.level}!`);
            }
            playerData.xp = updatedData.xp;
            playerData.coins = updatedData.coins;
            playerData.level = updatedData.level;
            playerData.tasks += 1;
            updateUI();
        }
    } catch (err) {
        console.error("Erro ao sincronizar gamificação:", err);
    }
}

// ==========================================
// 3. ATUALIZAÇÃO VISUAL (UI)
// ==========================================
function updateUI() {
    const xpPercentage = Math.min((playerData.xp / maxXP) * 100, 100);
    
    const xpBar = document.getElementById('xpBar');
    if (xpBar) xpBar.style.width = xpPercentage + '%';
    
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
    let taskPct = Math.min((playerData.tasks / targetTasks) * 100, 100);
    const taskBar = document.getElementById('objTaskBar');
    if (taskBar) taskBar.style.width = taskPct + '%';
}

// ==========================================
// 4. MECÂNICA DE MALDIÇÃO DE SLA (O BUG)
// ==========================================
function startBugTimer() {
    let bugTimeLeft = 30; // 30 Segundos
    const timerDisplay = document.getElementById('bugTimer');
    
    if (bugInterval) clearInterval(bugInterval);

    bugInterval = setInterval(async () => {
        if (!timerDisplay) return;
        bugTimeLeft--;

        if (bugTimeLeft > 15) {
            timerDisplay.innerText = `SLA: ${bugTimeLeft}s`;
        } else if (bugTimeLeft <= 15 && bugTimeLeft > 0) {
            timerDisplay.innerText = `⚠️ CORRE! ${bugTimeLeft}s`;
            timerDisplay.style.color = "#e67e22";
        } else {
            clearInterval(bugInterval);
            timerDisplay.innerText = `🚨 SLA ESTOURADO!`;
            applyCurseVisuals();
            
            // Avisa o servidor que o jogador falhou no SLA
            await setPlayerCurseState(true);
            showToast("🚨 MALDIÇÃO DO SLA! Resolva o bug rápido!", "error");
        }
    }, 1000);
}

function applyCurseVisuals() {
    playerData.isCursed = true;
    const avatarEl = document.getElementById('playerAvatar');
    const xpBar = document.getElementById('xpBar');
    
    if (avatarEl) avatarEl.classList.add('curse-critical');
    if (xpBar) xpBar.classList.add('curse-critical');
}

async function setPlayerCurseState(state) {
    try {
        await fetch(`${API_URL}/players/curse`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ isCursed: state })
        });
    } catch (err) {
        console.error("Erro de SLA Sync", err);
    }
}

// ==========================================
// 5. COMPLETAR QUESTS NO MURAL
// ==========================================
async function completeQuest(element, xpGained, coinsGained) {
    if (element.classList.contains('done')) return;
    element.classList.add('done');
    
    // Dispara a recompensa pro servidor
    await updateServerGamification(xpGained, coinsGained);
    showToast(`Quest Concluída! +${xpGained} XP`);
}

async function completeUrgentBug(element, baseXp, baseCoins) {
    if (element.classList.contains('done')) return;
    
    clearInterval(bugInterval);
    element.classList.add('done');

    // Se ele estava amaldiçoado, ele ganha apenas metade da recompensa!
    let finalXp = playerData.isCursed ? Math.floor(baseXp / 2) : baseXp;
    let finalCoins = playerData.isCursed ? Math.floor(baseCoins / 2) : baseCoins;

    if (playerData.isCursed) {
        // Quebra a maldição visual
        const avatarEl = document.getElementById('playerAvatar');
        const xpBar = document.getElementById('xpBar');
        if (avatarEl) avatarEl.classList.remove('curse-critical');
        if (xpBar) xpBar.classList.remove('curse-critical');
        
        playerData.isCursed = false;
        await setPlayerCurseState(false); // Avisa o DB que ele se curou
        showToast("✨ Feitiço Quebrado!", "error");
    } else {
        showToast("⚔️ Bug esmagado no prazo! Recompensa Máxima!");
    }

    await updateServerGamification(finalXp, finalCoins);
    document.getElementById('bugTimer').innerText = "RESOLVIDO";
}

// ==========================================
// 6. INTEGRAÇÃO JIRA E CSAT
// ==========================================
// Mantive o Jira local temporariamente pois ele simula a plataforma externa.
function syncJira() {
    const board = document.getElementById('questBoard');
    if (!board) return;
    
    const newQuest = {
        id: Date.now(),
        title: "Validar massa de dados da Sprint",
        xp: 200,
        coins: 20,
        done: false
    };

    const jiraQuests = JSON.parse(localStorage.getItem('jira_quests')) || [];
    jiraQuests.push(newQuest);
    localStorage.setItem('jira_quests', JSON.stringify(jiraQuests));

    renderJiraQuests();
    showToast("Quest do Jira Sincronizada!");
}

function renderJiraQuests() {
    const board = document.getElementById('questBoard');
    if (!board) return;

    board.querySelectorAll('.quest-jira').forEach(el => el.remove());
    const jiraQuests = JSON.parse(localStorage.getItem('jira_quests')) || [];

    jiraQuests.forEach(quest => {
        const el = document.createElement('div');
        el.className = 'quest-paper quest-jira';
        if (quest.done) el.classList.add('done');

        el.innerHTML = `
            <div class="quest-title">[JIRA SYNC]<br><br>${quest.title}</div>
            <div class="quest-meta">
                <span class="xp-reward">+${quest.xp} XP</span>
                <span class="coin-reward">+${quest.coins} 💰</span>
            </div>
            <div class="completed-stamp">FEITO</div>
        `;

        el.onclick = function() {
            if (!this.classList.contains('done')) {
                completeQuest(this, quest.xp, quest.coins);
                quest.done = true;
                localStorage.setItem('jira_quests', JSON.stringify(jiraQuests));
            }
        };

        board.insertBefore(el, board.firstChild);
    });
}

// ==========================================
// 7. GESTÃO DE PERFIL (MODAL E AVATAR VIA API)
// ==========================================
let tempSelectedAvatar = '';

window.openProfileModal = () => {
    document.getElementById('profileModal').style.display = 'flex';
    document.getElementById('editProfileName').value = playerData.name;
    tempSelectedAvatar = playerData.avatar;
    document.getElementById('modalAvatarPreview').src = tempSelectedAvatar;
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

const profileForm = document.getElementById('profileForm');
if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newName = document.getElementById('editProfileName').value.trim();
        const newPic = document.getElementById('editProfilePic').value.trim() || tempSelectedAvatar;

        try {
            const res = await fetch(`${API_URL}/players/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ nome: newName, avatar_url: newPic })
            });

            if (res.ok) {
                playerData.name = newName;
                playerData.avatar = newPic;
                updateUI();
                closeProfileModal();
                showToast("Perfil forjado com sucesso no banco!");
            } else {
                showToast("Erro ao salvar perfil.", "error");
            }
        } catch (err) {
            console.error(err);
            showToast("Erro de conexão com o banco.", "error");
        }
    });
}