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
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = 'login.html';
}