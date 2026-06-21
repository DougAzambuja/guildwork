// js/login.js

// ==========================================
// FUNÇÃO UNIVERSAL DE ALERTAS (TOASTS)
// ==========================================
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `pixel-toast ${type === 'error' ? 'error' : ''}`;
    toast.innerHTML = message;
    
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// ==========================================
// MOTOR DE AUTENTICAÇÃO
// ==========================================
document.getElementById('loginForm').addEventListener('submit', function(event) {
    event.preventDefault();

    const usernameInput = document.getElementById('username').value.trim().toLowerCase();
    const passwordInput = document.getElementById('password').value;

    const mockDB = {
        'admin': { 
            senha: 'admin', 
            role: 'admin', 
            nome: 'Mestre da Guilda',
            // Chave única que vai prefixar todos os dados deste usuário
            // ex: 'player_admin_xp', 'player_admin_level', etc.
            storageKey: 'player_admin'
        },
        'funcionario': { 
            senha: '123', 
            role: 'adventurer', 
            nome: 'Aventureiro QA',
            storageKey: 'player_funcionario'
        }
    };

    const usuarioLogado = mockDB[usernameInput];

    if (usuarioLogado && usuarioLogado.senha === passwordInput) {

        // Dados de sessão (igual antes)
        localStorage.setItem('guild_role', usuarioLogado.role);
        localStorage.setItem('guild_user', usuarioLogado.nome);

        // ← NOVO: grava qual usuário está ativo
        // É isso que o mural.js vai usar para saber qual chave de dados ler
        localStorage.setItem('guild_active_user', usuarioLogado.storageKey);

        // ← NOVO: salva o nome do funcionário com chave própria
        // Assim o admin consegue ler 'guild_user_funcionario' sem confundir
        // com o 'guild_user' genérico que é sobrescrito a cada login
        localStorage.setItem(
            `guild_user_${usernameInput}`,
            usuarioLogado.nome
        );

        if (usuarioLogado.role === 'admin') {
            showToast(`⚔️ Bem-vindo, ${usuarioLogado.nome}! Abrindo os portões do castelo...`);
            setTimeout(() => { 
                window.location.href = 'admin.html'; 
            }, 1500);
        } else {
            showToast(`🛡️ Login com sucesso! Preparando suas missões...`);
            setTimeout(() => { 
                window.location.href = 'index.html'; 
            }, 1500);
        }

    } else {
        showToast('❌ Falha na autenticação: Usuário ou senha incorretos! Tente "admin" ou "funcionario".', 'error');
    }
});