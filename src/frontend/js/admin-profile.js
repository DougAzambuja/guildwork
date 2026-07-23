// admin-profile.js — lógica da tela de perfil do admin
(function () {
    let currentUsername = '';
    let _dicebearOpts = { skinColor: '', hairColor: '' };
    let _dicebearPreviewSeed = '';

    window.openDicebearCustomizerAdmin = function () {
        openDicebearCustomizer(_dicebearPreviewSeed, _dicebearOpts, function (newSeed, newOpts, url) {
            _dicebearPreviewSeed = newSeed;
            _dicebearOpts = newOpts;
            document.getElementById('inputAvatarUrl').value = url;
            const tmp = new Image();
            tmp.onload = () => { document.getElementById('avatarPreview').src = url; };
            tmp.src = url;
        });
    };

    function isLocalAvatar(url) {
        return !url || url.startsWith('assets/');
    }

    function resolvedAvatar(url, username) {
        return isLocalAvatar(url) ? dicebearUrl(username) : url;
    }

    async function loadProfile() {
        const token = localStorage.getItem('guild_token');
        if (!token) { window.location.href = 'login.html'; return; }

        try {
            const res = await fetch(`${API_URL}/players/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Não autorizado');
            const user = await res.json();

            currentUsername = user.username || '';
            if (user.avatar_url && user.avatar_url.includes('api.dicebear.com')) {
                try {
                    _dicebearPreviewSeed = new URL(user.avatar_url).searchParams.get('seed') || currentUsername;
                } catch (_) {
                    _dicebearPreviewSeed = currentUsername;
                }
            } else {
                _dicebearPreviewSeed = currentUsername;
            }

            document.getElementById('currentNome').textContent    = user.nome || user.username;
            document.getElementById('currentUsername').textContent = '@' + currentUsername;
            // TC-04: admin não tem guilda — exibe papel ao invés de faction
            const factionEl = document.getElementById('currentFaction');
            if (user.role === 'admin') {
                factionEl.textContent = '👑 Administrador';
            } else {
                factionEl.textContent = user.faction ? `Guilda: ${user.faction}` : '';
            }

            const avatarSrc = resolvedAvatar(user.avatar_url, currentUsername);
            document.getElementById('currentAvatar').src  = avatarSrc;
            document.getElementById('avatarPreview').src  = avatarSrc;
            // Não pré-preenche a URL se for um caminho local (mostra DiceBear gerado)
            document.getElementById('inputAvatarUrl').value = isLocalAvatar(user.avatar_url) ? '' : (user.avatar_url || '');
            document.getElementById('inputNome').value      = user.nome || '';

        } catch (e) {
            showToast('❌ Erro ao carregar perfil.', 'error');
        }
    }

    window.previewAvatar = function (url) {
        const preview = document.getElementById('avatarPreview');
        preview.src = url.trim() ? url.trim() : dicebearUrl(currentUsername);
    };

    // TC-05: cada clique gera um seed diferente → avatar diferente
    window.useDicebear = function () {
        const randomSuffix = Math.random().toString(36).slice(2, 7);
        _dicebearPreviewSeed = currentUsername + '_' + randomSuffix;
        const url = dicebearUrl(_dicebearPreviewSeed, _dicebearOpts);
        document.getElementById('inputAvatarUrl').value = url;
        document.getElementById('avatarPreview').src    = url;
    };

    function setFieldError(id, hasError) {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.borderColor = hasError ? '#e74c3c' : '';
    }

    function clearPasswordErrors() {
        ['inputCurrentPassword', 'inputNewPassword', 'inputConfirmPassword'].forEach(id => setFieldError(id, false));
    }

    window.saveProfile = async function () {
        const token = localStorage.getItem('guild_token');
        const nome            = document.getElementById('inputNome').value.trim();
        const avatar_url      = document.getElementById('inputAvatarUrl').value.trim();
        const currentPassword = document.getElementById('inputCurrentPassword').value;
        const newPassword     = document.getElementById('inputNewPassword').value;
        const confirmPassword = document.getElementById('inputConfirmPassword').value;

        clearPasswordErrors();

        // TC-09: validação com destaque visual nos campos
        if (newPassword && newPassword !== confirmPassword) {
            setFieldError('inputNewPassword', true);
            setFieldError('inputConfirmPassword', true);
            showToast('❌ As senhas não coincidem.', 'error');
            return;
        }
        if (newPassword && !currentPassword) {
            setFieldError('inputCurrentPassword', true);
            showToast('❌ Informe a senha atual.', 'error');
            return;
        }

        const body = { nome, avatar_url };
        if (newPassword) {
            body.currentPassword = currentPassword;
            body.newPassword     = newPassword;
        }

        try {
            const res = await fetch(`${API_URL}/players/me`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
            const data = await res.json();

            if (!res.ok) {
                // Senha atual incorreta → destaca o campo
                if (data.message && data.message.includes('incorreta')) {
                    setFieldError('inputCurrentPassword', true);
                }
                showToast(`❌ ${data.message}`, 'error');
                return;
            }

            localStorage.setItem('guild_user',   data.nome || data.username);
            const savedAvatar = resolvedAvatar(data.avatar_url, currentUsername);
            localStorage.setItem('guild_avatar', isLocalAvatar(data.avatar_url) ? '' : (data.avatar_url || ''));

            document.getElementById('currentNome').textContent = data.nome || data.username;
            document.getElementById('currentAvatar').src = savedAvatar;
            document.getElementById('avatarPreview').src  = savedAvatar;

            document.getElementById('inputCurrentPassword').value = '';
            document.getElementById('inputNewPassword').value     = '';
            document.getElementById('inputConfirmPassword').value = '';

            showToast('✔ Perfil atualizado com sucesso!');

            // Atualiza header ao vivo
            const headerAvatar = document.querySelector('[data-cy="admin-avatar"]');
            if (headerAvatar) headerAvatar.src = savedAvatar;
            const headerName = document.getElementById('playerName');
            if (headerName) headerName.textContent = data.nome || data.username;

        } catch (e) {
            showToast('❌ Erro ao salvar perfil.', 'error');
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadProfile);
    } else {
        loadProfile();
    }
})();
