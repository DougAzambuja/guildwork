/**
 * notifications.js — Componente de sino de notificações.
 * Auto-injetável: inclua este script em qualquer página autenticada.
 * Injeta o sino dentro do elemento `.actions` da top-bar.
 */
(function () {
    'use strict';

    const POLL_INTERVAL = 30_000; // 30 segundos
    let pollTimer = null;

    // ==========================================
    // ESTILOS — injetados uma vez no <head>
    // ==========================================
    function injectStyles() {
        if (document.getElementById('notif-styles')) return;
        const style = document.createElement('style');
        style.id = 'notif-styles';
        style.textContent = `
            .notif-bell {
                position: relative;
                display: inline-flex;
                align-items: center;
            }
            .notif-btn {
                position: relative;
                padding: 6px 10px !important;
                font-size: 12px !important;
                cursor: pointer;
            }
            .notif-badge {
                position: absolute;
                top: -5px;
                right: -5px;
                background: #e74c3c;
                color: #fff;
                font-size: 7px;
                min-width: 16px;
                height: 16px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0 3px;
                pointer-events: none;
                font-family: 'Courier New', monospace;
                font-weight: bold;
            }
            .notif-dropdown {
                position: absolute;
                top: calc(100% + 8px);
                right: 0;
                width: 300px;
                background: #1a252f;
                border: 2px solid #2c3e50;
                z-index: 9998;
                max-height: 400px;
                display: flex;
                flex-direction: column;
                box-shadow: 0 4px 16px rgba(0,0,0,0.5);
            }
            .notif-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                border-bottom: 1px solid #2c3e50;
                background: #0d1b2a;
                flex-shrink: 0;
            }
            .notif-header-title {
                font-size: 7px;
                color: #7f8c8d;
                letter-spacing: 1px;
                font-family: 'Courier New', monospace;
            }
            .notif-read-all-btn {
                background: none;
                border: 1px solid #2980b9;
                color: #3498db;
                font-size: 7px;
                cursor: pointer;
                font-family: 'Courier New', monospace;
                padding: 3px 7px;
                letter-spacing: 0.5px;
            }
            .notif-read-all-btn:hover { background: #2980b9; color: #fff; }
            .notif-list {
                overflow-y: auto;
                flex: 1;
            }
            .notif-item {
                padding: 10px 12px;
                border-bottom: 1px solid #0d1b2a;
                cursor: pointer;
                transition: background 0.15s;
                border-left: 3px solid transparent;
            }
            .notif-item:hover { background: #0d1b2a; }
            .notif-item.unread { border-left-color: #3498db; }
            .notif-item.unread .notif-item-title { color: #ecf0f1; }
            .notif-item-title {
                font-size: 9px;
                color: #bdc3c7;
                margin-bottom: 3px;
                font-family: 'Courier New', monospace;
            }
            .notif-item-msg {
                font-size: 8px;
                color: #7f8c8d;
                line-height: 1.4;
                font-family: 'Courier New', monospace;
            }
            .notif-item-time {
                font-size: 7px;
                color: #4a6278;
                margin-top: 4px;
                font-family: 'Courier New', monospace;
            }
            .notif-empty {
                font-size: 8px;
                color: #7f8c8d;
                text-align: center;
                padding: 24px 16px;
                font-family: 'Courier New', monospace;
            }
            /* Ícone por tipo */
            .notif-type-quest_assigned  .notif-item-title::before { content: '⚔️ '; }
            .notif-type-level_up        .notif-item-title::before { content: '🎉 '; }
            .notif-type-sla_warning     .notif-item-title::before { content: '⏰ '; }
            .notif-type-achievement     .notif-item-title::before { content: '🏆 '; }
            .notif-type-admin_alert     .notif-item-title::before { content: '🚨 '; }
        `;
        document.head.appendChild(style);
    }

    // ==========================================
    // HTML DO SINO
    // ==========================================
    function createBellElement() {
        const wrap = document.createElement('div');
        wrap.className = 'notif-bell';
        wrap.innerHTML = `
            <button class="btn-pixel notif-btn" id="notifBtn" data-cy="btn-notifications" title="Notificações">
                🔔<span class="notif-badge" id="notifBadge" style="display:none;">0</span>
            </button>
            <div class="notif-dropdown" id="notifDropdown" style="display:none;" data-cy="notifications-dropdown">
                <div class="notif-header">
                    <span class="notif-header-title">NOTIFICAÇÕES</span>
                    <button class="notif-read-all-btn" id="notifReadAll" data-cy="btn-read-all-notifications">✓ Marcar lidas</button>
                </div>
                <div class="notif-list" id="notifList">
                    <div class="notif-empty">Carregando...</div>
                </div>
            </div>
        `;
        return wrap;
    }

    // ==========================================
    // RENDERIZAÇÃO
    // ==========================================
    function renderNotifications(data) {
        const badge    = document.getElementById('notifBadge');
        const list     = document.getElementById('notifList');
        if (!badge || !list) return;

        const { notifications = [], unread_count = 0 } = data;

        // Badge
        if (unread_count > 0) {
            badge.textContent  = unread_count > 99 ? '99+' : unread_count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }

        // Lista
        if (!notifications.length) {
            list.innerHTML = '<div class="notif-empty">Nenhuma notificação ainda.<br>Complete missões para ganhar conquistas! ⚔️</div>';
            return;
        }

        list.innerHTML = notifications.map(n => {
            const timeAgo = formatTimeAgo(n.createdAt);
            return `
                <div class="notif-item ${n.read ? '' : 'unread'} notif-type-${n.type}"
                     data-id="${n._id}"
                     data-cy="notification-item">
                    <div class="notif-item-title">${escapeHtml(n.title)}</div>
                    <div class="notif-item-msg">${escapeHtml(n.message)}</div>
                    <div class="notif-item-time">${timeAgo}</div>
                </div>
            `;
        }).join('');

        // Click em cada item: marcar como lido
        list.querySelectorAll('.notif-item').forEach(el => {
            el.addEventListener('click', () => {
                const id = el.dataset.id;
                markOneRead(id, el);
            });
        });
    }

    // ==========================================
    // API CALLS
    // ==========================================
    function getToken() { return localStorage.getItem('guild_token'); }
    function authHeaders() { return { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' }; }

    async function fetchNotifications() {
        if (!getToken()) return;
        try {
            const res  = await fetch(`${API_URL}/notifications`, { headers: authHeaders() });
            if (!res.ok) return;
            const data = await res.json();
            renderNotifications(data);
        } catch (_) { /* silencioso — não quebra a página */ }
    }

    async function markOneRead(id, el) {
        try {
            await fetch(`${API_URL}/notifications/${id}/read`, { method: 'PATCH', headers: authHeaders() });
            el.classList.remove('unread');
            // Atualiza badge
            const badge = document.getElementById('notifBadge');
            if (badge) {
                const current = parseInt(badge.textContent) || 0;
                const next    = Math.max(0, current - 1);
                badge.textContent   = next > 99 ? '99+' : next;
                badge.style.display = next > 0 ? 'flex' : 'none';
            }
        } catch (_) {}
    }

    async function markAllRead() {
        try {
            await fetch(`${API_URL}/notifications/read-all`, { method: 'PATCH', headers: authHeaders() });
            document.querySelectorAll('.notif-item.unread').forEach(el => el.classList.remove('unread'));
            const badge = document.getElementById('notifBadge');
            if (badge) badge.style.display = 'none';
        } catch (_) {}
    }

    // ==========================================
    // TOGGLE DROPDOWN
    // ==========================================
    function initToggle() {
        const btn      = document.getElementById('notifBtn');
        const dropdown = document.getElementById('notifDropdown');
        const readAll  = document.getElementById('notifReadAll');
        if (!btn || !dropdown) return;

        btn.addEventListener('click', e => {
            e.stopPropagation();
            const isOpen = dropdown.style.display !== 'none';
            dropdown.style.display = isOpen ? 'none' : 'flex';
            if (!isOpen) fetchNotifications();
        });

        readAll.addEventListener('click', e => {
            e.stopPropagation();
            markAllRead();
        });

        // Fecha ao clicar fora
        document.addEventListener('click', e => {
            if (!e.target.closest('.notif-bell')) {
                dropdown.style.display = 'none';
            }
        });
    }

    // ==========================================
    // POLLING
    // ==========================================
    function startPolling() {
        fetchNotifications(); // fetch imediato
        pollTimer = setInterval(fetchNotifications, POLL_INTERVAL);
    }

    // ==========================================
    // UTILITÁRIOS
    // ==========================================
    function formatTimeAgo(iso) {
        const diff = Date.now() - new Date(iso).getTime();
        const m = Math.floor(diff / 60000);
        if (m < 1)  return 'agora mesmo';
        if (m < 60) return `há ${m} min`;
        const h = Math.floor(m / 60);
        if (h < 24) return `há ${h}h`;
        const d = Math.floor(h / 24);
        return `há ${d}d`;
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ==========================================
    // INIT — aguarda DOM + token disponível
    // ==========================================
    function init() {
        if (!getToken()) return; // Não autenticado — não injeta nada

        injectStyles();

        const actionsEl = document.querySelector('.actions');
        if (!actionsEl) return;

        // Injeta antes do primeiro filho (antes do botão de logout)
        const bell = createBellElement();
        actionsEl.insertBefore(bell, actionsEl.firstChild);

        initToggle();
        startPolling();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
