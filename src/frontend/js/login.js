// js/login.js
// ==========================================
// MOTOR DE AUTENTICAÇÃO REAL (API BASE)
// ==========================================
document.getElementById('loginForm').addEventListener('submit', async function(event) {
    event.preventDefault();

    const usernameInput = document.getElementById('username').value.trim().toLowerCase();
    const passwordInput = document.getElementById('password').value;

    try {
        // Envia os dados digitados para a API no backend
        const response = await fetch('http://localhost:3001/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: usernameInput,
                password: passwordInput
            })
        });

        const data = await response.json();

        // Se o backend responder com sucesso (Status 200-299)
        if (response.ok) {
            // Guardamos o Token JWT gerado pelo backend para as próximas requisições protegidas
            localStorage.setItem('guild_token', data.token);
            
            // Adaptamos o retorno do banco para manter a compatibilidade com o frontend atual
            localStorage.setItem('guild_role', data.user.role); // ex: 'admin' ou 'adventurer'
            localStorage.setItem('guild_user', data.user.name); // Nome de exibição
            
            // Armazena identificadores específicos para controle de chaves do usuário ativo
            localStorage.setItem('guild_active_user', `player_${usernameInput}`);
            localStorage.setItem(`guild_user_${usernameInput}`, data.user.name);

            // Fluxo de redirecionamento baseado no privilégio do usuário retornado pelo banco
            if (data.user.role === 'admin') {
                showToast(`⚔️ Bem-vindo, ${data.user.name}! Abrindo os portões do castelo...`);
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
            // Se o backend retornar erro (Ex: senha incorreta, usuário não existe), exibe a mensagem da API
            showToast(`❌ Erro: ${data.message || 'Falha na autenticação.'}`, 'error');
        }

    } catch (error) {
        console.error('Erro ao conectar com a API:', error);
        showToast('❌ O servidor da Guilda está inacessível. Verifique se o backend está rodando.', 'error');
    }
});