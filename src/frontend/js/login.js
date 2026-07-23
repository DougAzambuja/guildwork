// js/login.js
// ==========================================
// MOTOR DE AUTENTICAÇÃO REAL (API BASE)
// ==========================================
document.getElementById('loginForm').addEventListener('submit', async function(event) {
    event.preventDefault();

    const usernameInput = document.getElementById('username').value.trim().toLowerCase();
    const passwordInput = document.getElementById('password').value;

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: usernameInput, password: passwordInput })
        });

        const data = await response.json();

        if (response.ok) {
            // Salva o token JWT para as próximas requisições protegidas
            localStorage.setItem('guild_token',    data.token);
            localStorage.setItem('guild_role',     data.user.role);
            localStorage.setItem('guild_user',     data.user.nome);
            localStorage.setItem('guild_username', data.user.username);
            const rawAvatar = data.user.avatar_url || '';
            const isLocalPath = rawAvatar.startsWith('assets/');
            localStorage.setItem('guild_avatar', isLocalPath ? '' : rawAvatar);

            localStorage.setItem('guild_active_user',            `player_${usernameInput}`);
            localStorage.setItem(`guild_user_${usernameInput}`,  data.user.nome);

            if (data.requiresPasswordChange) {
                showToast('🔑 Bem-vindo! Por segurança, defina uma nova senha antes de continuar.');
                setTimeout(() => { window.location.href = 'change-password.html'; }, 1800);
                return;
            }

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