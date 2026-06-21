// ==========================================
// 0. PROTEÇÃO DE ROTA E LOGOUT
// ==========================================
if (!localStorage.getItem('guild_role')) {
    window.location.href = 'login.html';
}

// ==========================================
// 1. VARIÁVEIS DO JOGADOR E METAS
// ==========================================

// Chave única do perfil logado — declarada PRIMEIRO pois é usada por todo o arquivo
// Exemplos de valor: 'player_funcionario', 'player_admin'
const activeUser = localStorage.getItem('guild_active_user') || 'player_default';

const maxXP = 10000;
let currentXP      = parseInt(localStorage.getItem(`${activeUser}_xp`))    || 4500;
let currentCoins   = parseInt(localStorage.getItem(`${activeUser}_coins`))  || 100;
let completedTasks = parseInt(localStorage.getItem(`${activeUser}_tasks`))  || 0;
let farmedGold     = parseInt(localStorage.getItem(`${activeUser}_gold`))   || 0;
let currentLevel   = parseInt(localStorage.getItem(`${activeUser}_level`))  || 1;

const targetTasks = 5;
const targetGold  = 150;

// ==========================================
// 0.5. PERFIL DINÂMICO E AVATAR
// ==========================================
let playerName = localStorage.getItem('guild_user') || 'Aventureiro Anônimo';
const playerNameElement   = document.getElementById('playerName');
const playerAvatarElement = document.getElementById('playerAvatar');

if (playerNameElement)   playerNameElement.innerText = playerName;

let playerPic = localStorage.getItem('guild_avatar') || 'assets/imgs/caneca_pixel.jpg';
if (playerAvatarElement) playerAvatarElement.src = playerPic;

let tempSelectedAvatar = playerPic;

function openProfileModal() {
    document.getElementById('profileModal').style.display = 'flex';
    document.getElementById('editProfileName').value = playerName;
    document.getElementById('editProfilePic').value = '';
    tempSelectedAvatar = playerPic;
    document.getElementById('modalAvatarPreview').src = tempSelectedAvatar;
    document.querySelectorAll('.avatar-option').forEach(el => {
        el.classList.remove('selected');
        if (el.getAttribute('src') === playerPic) el.classList.add('selected');
    });
}

function closeProfileModal() {
    document.getElementById('profileModal').style.display = 'none';
}

function selectAvatar(url, element) {
    tempSelectedAvatar = url;
    document.getElementById('modalAvatarPreview').src = url;
    document.getElementById('editProfilePic').value = '';
    document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
    if (element) element.classList.add('selected');
}

const editProfilePicElement = document.getElementById('editProfilePic');
if (editProfilePicElement) {
    editProfilePicElement.addEventListener('input', function(e) {
        const val = e.target.value.trim();
        if (val !== '') {
            tempSelectedAvatar = val;
            document.getElementById('modalAvatarPreview').src = val;
            document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
        }
    });
}

const profileFormElement = document.getElementById('profileForm');
if (profileFormElement) {
    profileFormElement.addEventListener('submit', function(event) {
        event.preventDefault();
        playerName = document.getElementById('editProfileName').value.trim();
        playerPic  = tempSelectedAvatar;

        // Chave genérica — usada pelo cabeçalho de todas as telas
        localStorage.setItem('guild_user',   playerName);
        localStorage.setItem('guild_avatar', playerPic);

        // Chave com ID do usuário — usada pelo admin.js para ler o perfil correto no roster
        // activeUser ex: 'player_funcionario' → userId ex: 'funcionario'
        const userId = activeUser.replace('player_', '');
        localStorage.setItem(`guild_user_${userId}`,   playerName);
        localStorage.setItem(`guild_avatar_${userId}`, playerPic);

        if (playerNameElement)   playerNameElement.innerText = playerName;
        if (playerAvatarElement) playerAvatarElement.src     = playerPic;
        closeProfileModal();
        showToast("Perfil forjado com sucesso!");
    });
}

// ==========================================
// 1.5. MECÂNICA DE XP PASSIVO
// ==========================================

// Taxa baseada no nível real do jogador:
// Nível 1-2 = Júnior (taxa 5), Nível 3-4 = Pleno (taxa 10), Nível 5+ = Sênior (taxa 15)
const seniorityLevel = Math.min(Math.ceil(currentLevel / 2), 3);
const passiveXpRate  = 5 * seniorityLevel;

function checkLevelUp() {
    if (currentXP >= maxXP) {
        currentXP    -= maxXP;
        currentLevel += 1;
        // Usa chave prefixada para não misturar com outros usuários
        localStorage.setItem(`${activeUser}_level`, currentLevel);
        showToast(`🎉 LEVEL UP! Você alcançou o nível ${currentLevel}!`);
    }
}

setInterval(() => {
    if (currentXP < maxXP) {
        currentXP += passiveXpRate;
        if (currentXP > maxXP) currentXP = maxXP;
        localStorage.setItem(`${activeUser}_xp`, currentXP);
        checkLevelUp();
        updateUI();
    }
}, 10000);

// ==========================================
// 1.8. ENGINE DA MALDIÇÃO DE SLA
// ==========================================
let bugTimeLeft = 30;
let isCursed    = false;

let bugInterval = setInterval(() => {
    const timerDisplay = document.getElementById('bugTimer');
    if (!timerDisplay) { clearInterval(bugInterval); return; }

    bugTimeLeft--;

    if (bugTimeLeft > 15) {
        timerDisplay.innerText = `SLA: ${bugTimeLeft}s`;
    }
    else if (bugTimeLeft <= 15 && bugTimeLeft > 0) {
        timerDisplay.innerText         = `⚠️ CORRE! ${bugTimeLeft}s`;
        timerDisplay.style.color       = "#e67e22";
        timerDisplay.style.borderColor = "#e67e22";
        if (playerAvatarElement) playerAvatarElement.classList.add('curse-warning');
        document.getElementById('xpBar').classList.add('curse-warning');
    }
    else {
        clearInterval(bugInterval);
        isCursed = true;

        // Chave prefixada — garante que o estado de maldição pertence ao usuário correto
        // e não contamina o painel do admin
        localStorage.setItem(`${activeUser}_is_cursed`, 'true');

        timerDisplay.innerText = `🚨 SLA ESTOURADO!`;
        document.getElementById('urgentBugCard').style.backgroundColor = "#95a5a6";
        document.getElementById('bugXpText').innerText  = "+250 XP";
        document.getElementById('bugCoinText').innerText = "+25 💰";

        if (playerAvatarElement) {
            playerAvatarElement.classList.remove('curse-warning');
            playerAvatarElement.classList.add('curse-critical');
        }
        document.getElementById('xpContainer').classList.add('curse-critical');
        document.getElementById('xpBar').classList.remove('curse-warning');
        document.getElementById('xpBar').classList.add('curse-critical');

        showToast("🚨 MALDIÇÃO DO SLA! Resolva o bug!", "error");
    }
}, 1000);

// ==========================================
// 1.9. RESTAURAR ESTADO DE MALDIÇÃO AO CARREGAR
// ==========================================
function restoreCurseState() {
    // Lê a chave prefixada do usuário ativo
    const cursed = localStorage.getItem(`${activeUser}_is_cursed`) === 'true';
    if (!cursed) return;

    isCursed = true;

    if (playerAvatarElement) {
        playerAvatarElement.classList.remove('curse-warning');
        playerAvatarElement.classList.add('curse-critical');
    }

    const xpContainer  = document.getElementById('xpContainer');
    const xpBar        = document.getElementById('xpBar');
    const timerDisplay = document.getElementById('bugTimer');

    if (xpContainer) xpContainer.classList.add('curse-critical');
    if (xpBar) {
        xpBar.classList.remove('curse-warning');
        xpBar.classList.add('curse-critical');
    }
    if (timerDisplay) timerDisplay.innerText = '🚨 SLA ESTOURADO!';

    // Para o intervalo pois o SLA já estourou — não faz sentido continuar contando
    clearInterval(bugInterval);
}

// ==========================================
// 2. ATUALIZAÇÃO DA INTERFACE (UI)
// ==========================================
function updateUI() {
    const xpPercentage = Math.min((currentXP / maxXP) * 100, 100);

    const xpBar = document.getElementById('xpBar');
    if (xpBar) xpBar.style.width = xpPercentage + '%';

    document.getElementById('coinCount').innerText = currentCoins;

    const levelDisplay = document.getElementById('levelDisplay');
    if (levelDisplay) levelDisplay.innerText = `Lvl: ${currentLevel}`;

    updateObjectivesUI();
}

function updateObjectivesUI() {
    let taskPct = Math.min((completedTasks / targetTasks) * 100, 100);
    const taskBar = document.getElementById('objTaskBar');
    if (taskBar) taskBar.style.width = taskPct + '%';
    if (document.getElementById('objTaskText'))
        document.getElementById('objTaskText').innerText = `${completedTasks}/${targetTasks}`;

    let goldPct = Math.min((farmedGold / targetGold) * 100, 100);
    const goldBar = document.getElementById('objGoldBar');
    if (goldBar) goldBar.style.width = goldPct + '%';
    if (document.getElementById('objGoldText'))
        document.getElementById('objGoldText').innerText = `${farmedGold}/${targetGold}`;
}

// ==========================================
// 3. AÇÕES DO MURAL
// ==========================================
function completeQuest(element, xpGained, coinsGained) {
    if (element.classList.contains('done')) return;
    element.classList.add('done');

    currentXP      += xpGained;
    currentCoins   += coinsGained;
    completedTasks += 1;
    farmedGold     += coinsGained;

    checkLevelUp();

    localStorage.setItem(`${activeUser}_xp`,     currentXP);
    localStorage.setItem(`${activeUser}_coins`,  currentCoins);
    localStorage.setItem(`${activeUser}_tasks`,  completedTasks);
    localStorage.setItem(`${activeUser}_gold`,   farmedGold);

    updateUI();
    showToast(`Quest Concluída! +${xpGained} XP`);
}

function completeUrgentBug(element, baseXp, baseCoins) {
    if (element.classList.contains('done')) return;
    clearInterval(bugInterval);
    element.classList.add('done');

    let finalXp    = isCursed ? baseXp    / 2 : baseXp;
    let finalCoins = isCursed ? baseCoins / 2 : baseCoins;

    if (isCursed) {
        if (playerAvatarElement) playerAvatarElement.classList.remove('curse-critical');
        document.getElementById('xpContainer').classList.remove('curse-critical');
        document.getElementById('xpBar').classList.remove('curse-critical');

        isCursed = false;
        // Remove com a chave prefixada correta
        localStorage.removeItem(`${activeUser}_is_cursed`);

        showToast("✨ Feitiço Quebrado!", "error");
    } else {
        if (playerAvatarElement) playerAvatarElement.classList.remove('curse-warning');
        document.getElementById('xpBar').classList.remove('curse-warning');
        showToast("⚔️ Incrível! Recompensa máxima!");
    }

    currentXP      += finalXp;
    currentCoins   += finalCoins;
    completedTasks += 1;
    farmedGold     += finalCoins;

    localStorage.setItem(`${activeUser}_xp`,    currentXP);
    localStorage.setItem(`${activeUser}_coins`, currentCoins);
    localStorage.setItem(`${activeUser}_tasks`, completedTasks);
    localStorage.setItem(`${activeUser}_gold`,  farmedGold);

    localStorage.removeItem('bug_start_time');

    document.getElementById('bugTimer').innerText = "RESOLVIDO";
    updateUI();
}

// ==========================================
// 3.5. MISSÃO DE SUPORTE (CSAT)
// ==========================================
function completeSupportQuest(element, maxXp, coinsGained) {
    if (element.classList.contains('done')) return;

    const nota    = prompt("⭐ Qual foi a nota CSAT do cliente? (Digite um número de 1 a 5)");
    const notaNum = parseInt(nota);

    if (isNaN(notaNum) || notaNum < 1 || notaNum > 5) {
        showToast("Nota inválida! Digite um número de 1 a 5.", "error");
        return;
    }

    element.classList.add('done');

    // XP proporcional à nota: nota 5 = 100% do XP, nota 1 = 20%
    const xpGained = Math.round(maxXp * (notaNum / 5));

    currentXP      += xpGained;
    currentCoins   += coinsGained;
    completedTasks += 1;
    farmedGold     += coinsGained;

    checkLevelUp();

    localStorage.setItem(`${activeUser}_xp`,    currentXP);
    localStorage.setItem(`${activeUser}_coins`, currentCoins);
    localStorage.setItem(`${activeUser}_tasks`, completedTasks);
    localStorage.setItem(`${activeUser}_gold`,  farmedGold);

    updateUI();

    const feedbacks = {
        5: "⭐⭐⭐⭐⭐ LENDÁRIO! Cliente encantado!",
        4: "⭐⭐⭐⭐ Ótimo atendimento!",
        3: "⭐⭐⭐ Missão cumprida.",
        2: "⭐⭐ Pode melhorar...",
        1: "⭐ Experiência ruim. Foco no próximo!"
    };
    showToast(`${feedbacks[notaNum]} +${xpGained} XP`);
}

// ==========================================
// 4. INTEGRAÇÃO JIRA (SYNC)
// ==========================================
function syncJira() {
    const board = document.getElementById('questBoard');
    if (!board) {
        showToast("Erro: Quadro não encontrado!", "error");
        return;
    }

    const newQuest = {
        id:    Date.now(), // ID único por timestamp — evita colisões
        title: "Criar massa de dados de teste",
        xp:    200,
        coins: 20,
        done:  false
    };

    // jira_quests não é prefixado — pertence à sprint, não ao jogador
    const jiraQuests = JSON.parse(localStorage.getItem('jira_quests')) || [];
    jiraQuests.push(newQuest);
    localStorage.setItem('jira_quests', JSON.stringify(jiraQuests));

    renderJiraQuests();
    showToast("Nova Quest sincronizada do Jira!");
}

function renderJiraQuests() {
    const board = document.getElementById('questBoard');
    if (!board) return;

    // Remove as quests Jira já renderizadas para evitar duplicação
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
            <div class="completed-stamp" data-cy="quest-completed-stamp">FEITO</div>
        `;

        el.onclick = function() {
            completeJiraQuest(this, quest.id, quest.xp, quest.coins);
        };

        board.insertBefore(el, board.firstChild);
    });
}

function completeJiraQuest(element, questId, xpGained, coinsGained) {
    if (element.classList.contains('done')) return;
    element.classList.add('done');

    const jiraQuests = JSON.parse(localStorage.getItem('jira_quests')) || [];
    const quest      = jiraQuests.find(q => q.id === questId);
    if (quest) {
        quest.done = true;
        localStorage.setItem('jira_quests', JSON.stringify(jiraQuests));
    }

    currentXP      += xpGained;
    currentCoins   += coinsGained;
    completedTasks += 1;
    farmedGold     += coinsGained;

    checkLevelUp();

    localStorage.setItem(`${activeUser}_xp`,    currentXP);
    localStorage.setItem(`${activeUser}_coins`, currentCoins);
    localStorage.setItem(`${activeUser}_tasks`, completedTasks);
    localStorage.setItem(`${activeUser}_gold`,  farmedGold);

    updateUI();
    showToast(`Quest Concluída! +${xpGained} XP`);
}

// ==========================================
// 5. INICIALIZAÇÃO
// ==========================================
updateUI();
renderJiraQuests();
restoreCurseState();
