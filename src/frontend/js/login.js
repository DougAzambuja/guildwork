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

            // CORREÇÃO: O Back-end envia a chave como 'name' (que recebe o valor de 'nome' do banco)
            const displayName = data.user.name || data.user.username;
            localStorage.setItem('guild_user', displayName);

            // Chaves com prefixo de usuário para o admin conseguir ler separado
            localStorage.setItem('guild_active_user',            `player_${usernameInput}`);
            localStorage.setItem(`guild_user_${usernameInput}`,  displayName);

            if (data.user.role === 'admin') {
                showToast(`⚔️ Bem-vindo, ${displayName}! Abrindo os portões do castelo...`);
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