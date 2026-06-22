// js/login.js
// ==========================================
// MOTOR DE AUTENTICAÇÃO REAL (API BASE)
// ==========================================
document.getElementById('loginForm').addEventListener('submit', async function(event) {
    event.preventDefault();

    const usernameInput = document.getElementById('username').value.trim().toLowerCase();
    const passwordInput = document.getElementById('password').value;

    try {
        const response = await fetch('http://localhost:3001/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: usernameInput, password: passwordInput })
        });

        const data = await response.json();

        if (response.ok) {
            // Salva o token JWT para as próximas requisições protegidas
            localStorage.setItem('guild_token', data.token);
            localStorage.setItem('guild_role',  data.user.role);

            // FIX: backend retorna 'nome', não 'name'
            localStorage.setItem('guild_user', data.user.nome);

            // Chaves com prefixo de usuário para o admin conseguir ler separado
            localStorage.setItem('guild_active_user',            `player_${usernameInput}`);
            localStorage.setItem(`guild_user_${usernameInput}`,  data.user.nome);

            if (data.user.role === 'admin') {
                showToast(`⚔️ Bem-vindo, ${data.user.nome}! Abrindo os portões do castelo...`);
                setTimeout(() => { window.location.href = 'admin.html'; }, 1500);
            } else {
                showToast(`🛡️ Login com sucesso! Preparando suas missões...`);
                setTimeout(() => { window.location.href = 'index.html'; }, 1500);
            }

        } else {
            showToast(`❌ Erro: ${data.message || 'Falha na autenticação.'}`, 'error');
        }

    } catch (error) {
        console.error('Erro ao conectar com a API:', error);
        showToast('❌ O servidor da Guilda está inacessível. Verifique se o backend está rodando.', 'error');
    }
});