// change-password.js
const token = localStorage.getItem('guild_token');

if (!token) {
    window.location.replace('login.html');
} else {
    document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword     = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (newPassword !== confirmPassword) {
            showToast('❌ As senhas não coincidem.', 'error');
            return;
        }

        if (newPassword.length < 6) {
            showToast('❌ A nova senha deve ter pelo menos 6 caracteres.', 'error');
            return;
        }

        try {
            const res = await fetch(`${API_URL}/players/me`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const data = await res.json();

            if (res.ok) {
                showToast('✅ Senha alterada com sucesso! Redirecionando...');
                const role = localStorage.getItem('guild_role');
                setTimeout(() => {
                    window.location.href = role === 'admin' ? 'admin.html' : 'index.html';
                }, 1800);
            } else {
                showToast(`❌ ${data.message || 'Erro ao alterar senha.'}`, 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('❌ Erro de conexão com o servidor.', 'error');
        }
    });
}
