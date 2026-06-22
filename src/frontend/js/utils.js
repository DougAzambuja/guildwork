// ==========================================
// UTILITÁRIOS COMPARTILHADOS (utils.js)
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
    // O comando clear() garante a destruição do 'guild_token', 'guild_role' 
    // e qualquer outro cache de segurança que o backend tenha enviado.
    localStorage.clear();
    
    // Redireciona para os portões do castelo
    window.location.href = 'login.html';
}