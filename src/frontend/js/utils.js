// ==========================================
// UTILITÁRIOS COMPARTILHADOS (utils.js)
// ==========================================

// ── ENCOUNTER CONSTANTS ────────────────────────────────────────────────────
// Fonte única de verdade — usada por admin.js, admin-events.js,
// admin-sprint-board.js e mural.js.
const ENC_ICONS = {
    xp_bonus:       '✨', gold_bonus:     '💰',
    xp_penalty:     '💀', gold_penalty:   '💸',
    slow:           '🐌', luck:           '🍀',
    store_discount: '🏷️',
};
const ENC_LABELS = {
    xp_bonus:       'BÔNUS DE XP',       gold_bonus:     'BÔNUS DE GOLD',
    xp_penalty:     'PENALIDADE DE XP',   gold_penalty:   'PENALIDADE DE GOLD',
    slow:           'SLA REDUZIDO',        luck:           'SORTE ATIVA',
    store_discount: 'DESCONTO NA LOJA',
};
// Formato rico: { bg, border, text } — .text para cor inline, .border para borda,
// .bg para fundo de destaque. Fallback: ENC_COLORS.xp_bonus
const ENC_COLORS = {
    xp_bonus:       { bg: '#0a1a0a', border: '#27ae60', text: '#2ecc71' },
    gold_bonus:     { bg: '#0a0d0a', border: '#f1c40f', text: '#f1c40f' },
    xp_penalty:     { bg: '#1a0a0a', border: '#c0392b', text: '#e74c3c' },
    gold_penalty:   { bg: '#1a0d00', border: '#e67e22', text: '#e67e22' },
    slow:           { bg: '#0d0d1a', border: '#8e44ad', text: '#9b59b6' },
    luck:           { bg: '#0a1a10', border: '#1abc9c', text: '#1abc9c' },
    store_discount: { bg: '#1a1500', border: '#f39c12', text: '#f39c12' },
};

function xpParaProximoNivel(level) { return 200 * (level + 1) + 300; }

function dicebearUrl(seed, opts = {}) {
    const base = new URLSearchParams({
        seed: seed || 'adventurer',
        backgroundColor: opts.backgroundColor || '1a252f',
    });
    let url = `https://api.dicebear.com/9.x/pixel-art/svg?${base}`;
    const arrayKeys = [
        'skinColor', 'hair', 'hairColor',
        'eyes', 'eyesColor', 'mouth', 'mouthColor',
        'beard', 'glasses', 'glassesColor',
        'hat', 'hatColor', 'accessories', 'accessoriesColor',
        'clothing', 'clothingColor'
    ];
    for (const k of arrayKeys) {
        if (opts[k]) url += `&${k}[]=${opts[k]}`;
    }
    const intKeys = ['beardProbability', 'glassesProbability', 'hatProbability', 'accessoriesProbability'];
    for (const k of intKeys) {
        if (opts[k] !== undefined) url += `&${k}=${opts[k]}`;
    }
    return url;
}

// Hex values validated against api.dicebear.com/9.x/pixel-art/schema.json
const DICEBEAR_SKIN_COLORS = [
    { id: 'ffdbac', hex: '#ffdbac', label: 'Pálida' },
    { id: 'f5cfa0', hex: '#f5cfa0', label: 'Clara' },
    { id: 'e0b687', hex: '#e0b687', label: 'Bronzeada' },
    { id: 'b68655', hex: '#b68655', label: 'Morena' },
    { id: 'a26d3d', hex: '#a26d3d', label: 'Escura' },
    { id: '8d5524', hex: '#8d5524', label: 'Negra' },
];

const DICEBEAR_HAIR_COLORS = [
    { id: '28150a', hex: '#28150a', label: 'Preto' },
    { id: '603a14', hex: '#603a14', label: 'Castanho' },
    { id: '83623b', hex: '#83623b', label: 'Castanho Claro' },
    { id: 'cab188', hex: '#cab188', label: 'Loiro' },
    { id: 'bd1700', hex: '#bd1700', label: 'Ruivo' },
    { id: '009bbd', hex: '#009bbd', label: 'Azul' },
];

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

function hideLoadingOverlay() {
    const el = document.getElementById('loading-overlay');
    if (!el) return;
    el.classList.add('fade-out');
    setTimeout(() => el.remove(), 350);
}