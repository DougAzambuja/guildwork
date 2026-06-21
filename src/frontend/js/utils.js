// ==========================================
// UTILITÁRIOS COMPARTILHADOS
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

function logout() {
    localStorage.removeItem('guild_role');
    localStorage.removeItem('guild_user');
    window.location.href = 'login.html';
}