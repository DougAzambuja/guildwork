const ENC_ICONS = {
    xp_bonus: '✨', gold_bonus: '💰', xp_penalty: '💀',
    gold_penalty: '💸', slow: '🐌', luck: '🍀', store_discount: '🏷️',
};
const ENC_LABELS = {
    xp_bonus: 'Bônus de XP', gold_bonus: 'Bônus de Gold',
    xp_penalty: 'Penalidade XP', gold_penalty: 'Penalidade Gold',
    slow: 'Lentidão', luck: 'Sorte', store_discount: 'Desconto na Loja',
};
const ENC_COLORS = {
    xp_bonus: '#2ecc71', gold_bonus: '#f1c40f', xp_penalty: '#e74c3c',
    gold_penalty: '#e67e22', slow: '#9b59b6', luck: '#1abc9c', store_discount: '#f39c12',
};

let _currentTplId  = null;
let _triggerMode   = 'duration';  // declarado aqui para garantir hoisting antes de qualquer chamada

// ── PANELS ──────────────────────────────────────────────────────────────────

function showIdle() {
    document.getElementById('panelIdle').style.display    = '';
    document.getElementById('panelForm').style.display    = 'none';
    document.getElementById('panelTrigger').style.display = 'none';
    _currentTplId = null;
}

function showCreateForm(tpl) {
    document.getElementById('panelIdle').style.display    = 'none';
    document.getElementById('panelForm').style.display    = '';
    document.getElementById('panelTrigger').style.display = 'none';

    _currentTplId = tpl?._id || null;
    document.getElementById('panelFormTitle').textContent = tpl ? '✏️ EDITAR TEMPLATE' : '+ NOVO TEMPLATE';
    document.getElementById('tplTitle').value    = tpl?.title             || '';
    document.getElementById('tplDesc').value     = tpl?.description       || '';
    document.getElementById('tplKind').value     = tpl?.effect_kind       || 'xp_bonus';
    document.getElementById('tplValue').value    = tpl ? Math.round(tpl.default_value * 100) : 50;
    document.getElementById('tplDuration').value = tpl?.default_duration  || 2;
    document.getElementById('tplScope').value    = tpl?.scope_type        || 'global';
}

function showTriggerPanel(tpl) {
    document.getElementById('panelIdle').style.display    = 'none';
    document.getElementById('panelForm').style.display    = 'none';
    document.getElementById('panelTrigger').style.display = '';

    _currentTplId = tpl._id;
    const pct   = Math.round(tpl.default_value * 100);
    const color = ENC_COLORS[tpl.effect_kind] || '#888';
    const icon  = ENC_ICONS[tpl.effect_kind]  || '🎲';
    const label = ENC_LABELS[tpl.effect_kind] || tpl.effect_kind;

    document.getElementById('triggerPreview').innerHTML = `
        <div style="font-size:9px;color:#8e44ad;letter-spacing:1px;margin-bottom:6px;">TEMPLATE SELECIONADO</div>
        <div style="font-size:12px;color:#fff;margin-bottom:6px;">${icon} ${tpl.title}</div>
        <div style="font-size:10px;color:${color};">${label} · ${pct}%</div>
        ${tpl.description ? `<div style="font-size:10px;color:#7f8c8d;margin-top:6px;">${tpl.description}</div>` : ''}
    `;

    // Campos modo Duração
    document.getElementById('triggerDuration').value  = tpl.default_duration || 2;
    document.getElementById('triggerStartMode').value = 'now';
    document.getElementById('triggerStartAtWrap').style.display = 'none';
    document.getElementById('triggerStartAt').value   = '';

    // Campos modo Período — pré-preenche com agora + duração padrão
    const now = new Date();
    const end = new Date(now.getTime() + (tpl.default_duration || 2) * 3_600_000);
    document.getElementById('triggerPeriodStart').value = _toDatetimeLocal(now);
    document.getElementById('triggerPeriodEnd').value   = _toDatetimeLocal(end);
    _updateDurationPreview(); // força exibição do preview ao abrir

    // Escopo
    document.getElementById('triggerScope').value = tpl.scope_type;
    document.getElementById('triggerFactionWrap').style.display = tpl.scope_type === 'faction' ? '' : 'none';

    // Aplica modo padrão por último (garante estado visual correto)
    setTriggerMode('duration');
}

function setTriggerMode(mode) {
    _triggerMode = mode;
    document.getElementById('triggerModeDuration').style.display = mode === 'duration' ? '' : 'none';
    document.getElementById('triggerModePeriod').style.display   = mode === 'period'   ? '' : 'none';
    document.getElementById('modeBtnDuration').style.background  = mode === 'duration' ? '#8e44ad' : '#2c3e50';
    document.getElementById('modeBtnDuration').style.color       = mode === 'duration' ? '#fff'    : '#7f8c8d';
    document.getElementById('modeBtnPeriod').style.background    = mode === 'period'   ? '#8e44ad' : '#2c3e50';
    document.getElementById('modeBtnPeriod').style.color         = mode === 'period'   ? '#fff'    : '#7f8c8d';
}

function toggleFactionSelect() {
    const scope = document.getElementById('triggerScope').value;
    document.getElementById('triggerFactionWrap').style.display = scope === 'faction' ? '' : 'none';
}

function toggleStartAt() {
    const mode = document.getElementById('triggerStartMode').value;
    document.getElementById('triggerStartAtWrap').style.display = mode === 'scheduled' ? '' : 'none';
}

function _toDatetimeLocal(date) {
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function _updateDurationPreview() {
    const startRaw = document.getElementById('triggerPeriodStart').value;
    const endRaw   = document.getElementById('triggerPeriodEnd').value;
    const preview  = document.getElementById('triggerDurationPreview');
    if (!preview) return;
    if (!startRaw || !endRaw) { preview.textContent = ''; return; }
    const diffMs = new Date(endRaw) - new Date(startRaw);
    if (diffMs <= 0) { preview.textContent = '→ término antes do início'; preview.style.color = '#e74c3c'; return; }
    const h = Math.floor(diffMs / 3_600_000);
    const m = Math.round((diffMs % 3_600_000) / 60_000);
    preview.style.color = '#7f8c8d';
    preview.textContent = `Duração calculada: ${h}h${m > 0 ? ` ${m}m` : ''}`;
}

// ── TEMPLATES ────────────────────────────────────────────────────────────────

async function loadTemplates() {
    const token = localStorage.getItem('guild_token');
    try {
        const res = await fetch(`${API_URL}/event-templates`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const templates = await res.json();
        renderTemplates(templates);
    } catch {
        document.getElementById('templateList').innerHTML =
            '<div style="font-size:8px;color:#e74c3c;text-align:center;padding:16px 0;">Erro ao carregar templates.</div>';
    }
}

function renderTemplates(templates) {
    const el = document.getElementById('templateList');
    if (!templates.length) {
        el.innerHTML = '<div style="font-size:10px;color:#7f8c8d;text-align:center;padding:16px 0;">Nenhum template criado ainda.</div>';
        return;
    }
    el.innerHTML = templates.map(tpl => {
        const pct   = Math.round(tpl.default_value * 100);
        const color = ENC_COLORS[tpl.effect_kind] || '#888';
        const icon  = ENC_ICONS[tpl.effect_kind]  || '🎲';
        const scope = tpl.scope_type === 'global' ? '🌐 Global' : '🏰 Facção';
        const encoded = JSON.stringify(tpl).replace(/"/g, '&quot;');
        return `
        <div class="tpl-card" data-cy="tpl-card-${tpl._id}">
            <span style="font-size:16px;">${icon}</span>
            <div class="tpl-card-body">
                <div class="tpl-card-title">${tpl.title}</div>
                <div class="tpl-card-meta" style="color:${color};">${ENC_LABELS[tpl.effect_kind] || tpl.effect_kind} · ${pct}% · ${tpl.default_duration}h · ${scope}</div>
            </div>
            <div class="tpl-actions">
                <button class="tpl-btn" data-cy="btn-trigger-${tpl._id}"
                        style="background:#8e44ad;"
                        onclick='showTriggerPanel(${encoded})'>⚡</button>
                <button class="tpl-btn" data-cy="btn-edit-${tpl._id}"
                        style="background:#f1c40f;color:#1a252f;"
                        onclick='showCreateForm(${encoded})'>✏️</button>
                <button class="tpl-btn" data-cy="btn-delete-${tpl._id}"
                        style="background:#e74c3c;"
                        onclick="deleteTemplate('${tpl._id}')">🗑️</button>
            </div>
        </div>`;
    }).join('');
}

async function submitTemplate(event) {
    event.preventDefault();
    const token = localStorage.getItem('guild_token');
    const payload = {
        title:            document.getElementById('tplTitle').value.trim(),
        description:      document.getElementById('tplDesc').value.trim(),
        effect_kind:      document.getElementById('tplKind').value,
        default_value:    Number(document.getElementById('tplValue').value) / 100,
        default_duration: Number(document.getElementById('tplDuration').value),
        scope_type:       document.getElementById('tplScope').value,
    };

    const url    = _currentTplId ? `${API_URL}/event-templates/${_currentTplId}` : `${API_URL}/event-templates`;
    const method = _currentTplId ? 'PATCH' : 'POST';

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const err = await res.json();
            showToast(err.message || 'Erro ao salvar template.', 'error');
            return;
        }
        showToast(_currentTplId ? 'Template atualizado!' : 'Template criado!', 'success');
        showIdle();
        loadTemplates();
    } catch {
        showToast('Erro de conexão.', 'error');
    }
}

async function deleteTemplate(id) {
    if (!confirm('Remover este template da biblioteca?')) return;
    const token = localStorage.getItem('guild_token');
    try {
        const res = await fetch(`${API_URL}/event-templates/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) { showToast('Erro ao remover template.', 'error'); return; }
        showToast('Template removido.', 'success');
        if (_currentTplId === id) showIdle();
        loadTemplates();
    } catch {
        showToast('Erro de conexão.', 'error');
    }
}

// ── ACTIVE ENCOUNTERS ────────────────────────────────────────────────────────

async function loadActiveEncounters() {
    const token = localStorage.getItem('guild_token');
    try {
        const res = await fetch(`${API_URL}/encounters/active`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        renderActiveEncounters(Array.isArray(data) ? data : []);
    } catch {
        document.getElementById('activeEventsList').innerHTML =
            '<div style="font-size:8px;color:#e74c3c;text-align:center;padding:8px 0;">Erro ao carregar eventos ativos.</div>';
    }
}

function renderActiveEncounters(encounters) {
    const el = document.getElementById('activeEventsList');
    if (!encounters.length) {
        el.innerHTML = '<div style="font-size:10px;color:#7f8c8d;text-align:center;padding:12px 0;">Nenhum evento ativo no momento.</div>';
        return;
    }
    const now = new Date();
    el.innerHTML = encounters.map(enc => {
        const kind  = enc.effect?.kind || '';
        const color = ENC_COLORS[kind] || '#888';
        const icon  = ENC_ICONS[kind]  || '🎲';
        const label = ENC_LABELS[kind] || kind;
        const title = enc.title || label;
        const pct   = enc.effect?.value ? Math.round(enc.effect.value * 100) : null;
        const endsAt = enc.active_until ? new Date(enc.active_until).toLocaleString('pt-BR') : '—';
        const scope  = enc.affected_faction ? `🏰 ${enc.affected_faction}` : '🌐 Global';

        const isScheduled = enc.start_at && new Date(enc.start_at) > now;
        const startsAt = isScheduled ? new Date(enc.start_at).toLocaleString('pt-BR') : null;
        const encoded = JSON.stringify(enc).replace(/"/g, '&quot;');

        return `
        <div class="active-event-card" style="border-color:${color};background:${color}20;" data-cy="active-event-${enc._id}">
            <span style="font-size:20px;line-height:1;">${icon}</span>
            <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
                    <span style="font-size:11px;color:#ecf0f1;">${title}</span>
                    ${isScheduled ? `<span style="font-size:8px;background:#f39c12;color:#1a252f;padding:2px 6px;letter-spacing:1px;">AGENDADO</span>` : ''}
                </div>
                <div style="font-size:10px;color:${color};margin-bottom:3px;">${label}${pct !== null ? ` · ${pct}%` : ''}</div>
                <div style="font-size:9px;color:#7f8c8d;">
                    ${isScheduled ? `início ${startsAt} · ` : ''}${scope} · até ${endsAt}
                </div>
            </div>
            <div class="tpl-actions">
                <button class="tpl-btn" data-cy="btn-edit-enc-${enc._id}"
                        style="background:#f1c40f;color:#1a252f;"
                        onclick='openEditEncounterModal(${encoded})'>✏️</button>
                <button class="tpl-btn" data-cy="btn-deactivate-${enc._id}"
                        style="background:#e74c3c;"
                        onclick="deactivateEncounter('${enc._id}')">✕</button>
            </div>
        </div>`;
    }).join('');
}

// ── EDIT ENCOUNTER MODAL ─────────────────────────────────────────────────────

let _editingEncounterId = null;

function openEditEncounterModal(enc) {
    _editingEncounterId = enc._id;

    const kind  = enc.effect?.kind || '';
    const color = ENC_COLORS[kind] || '#888';
    const icon  = ENC_ICONS[kind]  || '🎲';
    const label = ENC_LABELS[kind] || kind;
    const pct   = enc.effect?.value ? Math.round(enc.effect.value * 100) : null;

    document.getElementById('editEncounterInfo').innerHTML = `
        <div style="font-size:12px;margin-bottom:6px;">${icon} <span style="color:#ecf0f1;">${enc.title || label}</span></div>
        <div style="font-size:10px;color:${color};">${label}${pct !== null ? ` · ${pct}%` : ''}</div>
    `;

    const untilInput = document.getElementById('editEncounterUntil');
    if (enc.active_until) {
        const d = new Date(enc.active_until);
        // datetime-local needs format YYYY-MM-DDTHH:mm
        untilInput.value = d.toISOString().slice(0, 16);
    }

    const modal = document.getElementById('editEncounterModal');
    modal.style.display = 'flex';
}

function closeEditEncounterModal() {
    document.getElementById('editEncounterModal').style.display = 'none';
    _editingEncounterId = null;
}

async function submitEditEncounter() {
    if (!_editingEncounterId) return;
    const untilRaw = document.getElementById('editEncounterUntil').value;
    if (!untilRaw) { showToast('Defina o novo horário de término.', 'error'); return; }
    if (new Date(untilRaw) <= new Date()) { showToast('O horário de término deve ser no futuro.', 'error'); return; }

    const token = localStorage.getItem('guild_token');
    try {
        const res = await fetch(`${API_URL}/encounters/${_editingEncounterId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ active_until: new Date(untilRaw).toISOString() }),
        });
        if (!res.ok) { showToast('Erro ao salvar.', 'error'); return; }
        showToast('Evento atualizado!', 'success');
        closeEditEncounterModal();
        loadActiveEncounters();
    } catch {
        showToast('Erro de conexão.', 'error');
    }
}

async function deactivateEncounter(id) {
    const token = localStorage.getItem('guild_token');
    try {
        const res = await fetch(`${API_URL}/encounters/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) { showToast('Erro ao desativar evento.', 'error'); return; }
        showToast('Evento desativado.', 'success');
        loadActiveEncounters();
    } catch {
        showToast('Erro de conexão.', 'error');
    }
}

// ── TRIGGER ──────────────────────────────────────────────────────────────────

async function submitTrigger() {
    if (!_currentTplId) return;
    const token   = localStorage.getItem('guild_token');
    const scope   = document.getElementById('triggerScope').value;
    const faction = document.getElementById('triggerFaction').value;

    let duration_hours, start_at = null;

    if (_triggerMode === 'duration') {
        duration_hours = Number(document.getElementById('triggerDuration').value);
        if (!duration_hours || duration_hours <= 0) {
            showToast('Defina a duração do evento.', 'error'); return;
        }
        const startMode = document.getElementById('triggerStartMode').value;
        if (startMode === 'scheduled') {
            const startRaw = document.getElementById('triggerStartAt').value;
            if (!startRaw) { showToast('Defina a data e hora de início.', 'error'); return; }
            if (new Date(startRaw) <= new Date()) { showToast('O horário de início deve ser no futuro.', 'error'); return; }
            start_at = new Date(startRaw).toISOString();
        }
    } else {
        const startRaw = document.getElementById('triggerPeriodStart').value;
        const endRaw   = document.getElementById('triggerPeriodEnd').value;
        if (!startRaw || !endRaw) { showToast('Defina início e término do evento.', 'error'); return; }
        const startDate = new Date(startRaw);
        const endDate   = new Date(endRaw);
        if (endDate <= startDate) { showToast('O término deve ser após o início.', 'error'); return; }
        duration_hours = (endDate - startDate) / 3_600_000;
        if (startDate > new Date()) start_at = startDate.toISOString();
    }

    const payload = { template_id: _currentTplId, type: scope, duration_hours, start_at };
    if (scope === 'faction') payload.affected_faction = faction;

    try {
        const res = await fetch(`${API_URL}/encounters/trigger`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const err = await res.json();
            showToast(err.message || 'Erro ao acionar evento.', 'error');
            return;
        }
        showToast('⚡ Evento acionado com sucesso!', 'success');
        showIdle();
        loadActiveEncounters();
    } catch {
        showToast('Erro de conexão.', 'error');
    }
}

// ── INIT ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('guild_token') || localStorage.getItem('guild_role') !== 'admin') {
        window.location.href = 'login.html';
        return;
    }
    hideLoadingOverlay();
    loadActiveEncounters();
    loadTemplates();

    document.getElementById('editEncounterModal').addEventListener('click', e => {
        if (e.target === e.currentTarget) closeEditEncounterModal();
    });
});
