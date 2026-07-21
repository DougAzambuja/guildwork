// ==========================================
// UTILITÁRIOS COMPARTILHADOS (utils.js)
// ==========================================

function xpParaProximoNivel(level) { return 200 * (level + 1) + 300; }

const GUILD_ICONS = { Produto: '📦', Suporte: '🎧', 'Customer Service': '📣' };

const ALL_ACHIEVEMENTS = [
    { key: 'first_quest', title: '🎖️ Aventureiro Estreante', desc: '1 missão concluída'  },
    { key: 'quests_5',   title: '⚔️ Guerreiro Dedicado',    desc: '5 missões concluídas' },
    { key: 'quests_10',  title: '🛡️ Veterano da Guilda',    desc: '10 missões concluídas'},
    { key: 'quests_25',  title: '👑 Herói Lendário',         desc: '25 missões concluídas'},
    { key: 'quests_50',  title: '🌟 Mestre das Missões',     desc: '50 missões concluídas'},
];

const CURSE_CONFIG = {
    sla_breach: { icon: '💀', label: 'Maldição do Atraso',       color: '#e74c3c', penalty: 'XP reduzido pela metade nesta entrega.',           cure: 'Conclua qualquer missão para quebrar a maldição.' },
    abandoned:  { icon: '👻', label: 'Maldição do Abandono',     color: '#8e44ad', penalty: 'Gold reduzido pela metade nesta entrega.',          cure: 'Conclua qualquer missão para quebrar a maldição.' },
    csat_low:   { icon: '💔', label: 'Maldição da Insatisfação', color: '#e67e22', penalty: 'XP e Gold reduzidos. Missões urgentes bloqueadas.', cure: 'Conclua uma quest de Suporte com CSAT ≥ 4★.'      },
};

// Aplica/remove o efeito visual de maldição (tom verde) no avatar do jogador — usado
// em toda tela que mostra o próprio avatar, não só no board (mural.js já tem sua
// própria lógica mais completa com curse-warning e não usa este helper).
function applyCurseAvatarClass(el, isCursed) {
    if (!el) return;
    el.classList.toggle('curse-avatar', !!isCursed);
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `pixel-toast ${type === 'error' ? 'error' : ''}`;
    toast.innerHTML = message;
    
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

function logout() {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = 'login.html';
}