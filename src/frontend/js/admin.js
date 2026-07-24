// ==========================================
// 0. PROTEÇÃO E INICIALIZAÇÃO
// ==========================================
const token = localStorage.getItem('guild_token');

document.addEventListener('DOMContentLoaded', () => {
    if (!token || localStorage.getItem('guild_role') !== 'admin') {
        window.location.href = 'login.html';
        return;
    }
    initDashboard();
});

async function initDashboard() {
    await loadDashboard();
    hideLoadingOverlay();
    setInterval(loadDashboard, 30000);
}

async function loadDashboard() {
    try {
        const [rosterRes, sprintsRes] = await Promise.all([
            fetch(`${API_URL}/admin/roster`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${API_URL}/sprints`,       { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (rosterRes.ok)  renderDashboardStats(await rosterRes.json());
        if (sprintsRes.ok) populateDashSprintSelector(await sprintsRes.json());
    } catch (err) {
        console.error('Erro ao carregar dashboard:', err);
    }
}

// ==========================================
// 1. DASHBOARD — SPRINT
// ==========================================
const HEALTH_LABELS = {
    on_track: { label: '✅ NO RITMO',  color: '#27ae60' },
    at_risk:  { label: '⚠️ EM RISCO',  color: '#e67e22' },
    behind:   { label: '🚨 ATRASADA',  color: '#e74c3c' }
};
const STATUS_SPRINT_LABELS_DASH = {
    active:    '⚡',
    planning:  '📋',
    completed: '✅',
    cancelled: '❌'
};
const FACTION_ICONS_DASH = { Produto: '📦', Suporte: '🎧', 'Customer Service': '📣' };

function populateDashSprintSelector(sprints) {
    const section = document.getElementById('dashSprintSection');
    const select  = document.getElementById('dashSprintSelect');
    if (!section || !select) return;

    if (!sprints || sprints.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    select.innerHTML = sprints.map(s =>
        `<option value="${s._id}">${STATUS_SPRINT_LABELS_DASH[s.status] || ''} ${s.name}</option>`
    ).join('');

    // Prefere a sprint ativa; senão a primeira da lista
    const active = sprints.find(s => s.status === 'active');
    const defaultId = active ? String(active._id) : String(sprints[0]._id);
    select.value = defaultId;

    loadDashSprintData(defaultId);
}

async function loadDashSprintData(sprintId) {
    try {
        const res = await fetch(`${API_URL}/sprints/${sprintId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) renderActiveSprint(await res.json());
    } catch (err) {
        console.error('Erro ao carregar sprint do dashboard:', err);
    }
}

window.onDashSprintChange = (sprintId) => {
    if (sprintId) loadDashSprintData(sprintId);
};

function renderActiveSprint(data) {
    if (!data || !data.sprint) return;

    const { sprint, metrics, by_faction } = data;

    const health = HEALTH_LABELS[metrics.health_score] || HEALTH_LABELS.on_track;
    const badge  = document.getElementById('dashSprintHealth');
    if (badge) {
        badge.textContent      = health.label;
        badge.style.background = health.color;
        badge.style.display    = 'inline-block';
    }

    const link = document.getElementById('dashSprintBoardLink');
    if (link) {
        link.href = `admin-sprint-board.html?id=${sprint._id}`;
        link.onclick = (e) => {
            e.preventDefault();
            sessionStorage.setItem('admin_board_sprint_id', sprint._id);
            window.location.href = link.href;
        };
    }

    const fmt = d => new Date(d).toLocaleDateString('pt-BR');
    document.getElementById('dashSprintName').textContent     = sprint.name;
    document.getElementById('dashSprintPeriod').textContent   = `${fmt(sprint.start_date)} → ${fmt(sprint.end_date)}`;
    document.getElementById('dashSprintDaysLeft').textContent = `${metrics.days_remaining}d`;
    document.getElementById('dashSprintQuests').textContent   = `${metrics.done_quests}/${metrics.total_quests} concluídas`;
    document.getElementById('dashSprintPct').textContent      = `${metrics.completion_pct}%`;
    document.getElementById('dashSprintBar').style.width      = `${metrics.completion_pct}%`;

    const factionsEl = document.getElementById('dashSprintFactions');
    if (factionsEl) {
        const entries = Object.entries(by_faction || {});
        factionsEl.innerHTML = entries.length
            ? entries.map(([name, d]) => {
                const pct = d.total > 0 ? Math.round((d.done / d.total) * 100) : 0;
                return `
                    <div style="background:#0d1b2a; border:1px solid #2c3e50; padding:8px 10px; min-width:120px; flex:1;">
                        <div style="font-size:8px; color:#f1c40f; margin-bottom:4px;">${FACTION_ICONS_DASH[name] || '🏰'} ${name}</div>
                        <div style="font-size:8px; color:#bdc3c7;">${d.done}/${d.total} quests</div>
                        <div style="background:#1a252f; height:4px; margin-top:5px; border-radius:2px; overflow:hidden;">
                            <div style="height:100%; width:${pct}%; background:${pct === 100 ? '#27ae60' : pct >= 50 ? '#e67e22' : '#e74c3c'};"></div>
                        </div>
                    </div>
                `;
            }).join('')
            : '<div style="font-size:7px;color:#7f8c8d;">Sem facções mapeadas.</div>';
    }
}

// ==========================================
// 2. DASHBOARD — MÉTRICAS E FACÇÕES
// ==========================================
function renderDashboardStats(players) {
    const totalGold = players.reduce((sum, p) => sum + (p.coins || 0), 0);
    const goldEl = document.getElementById('repTotalGold');
    if (goldEl) goldEl.innerText = totalGold.toLocaleString('pt-BR');

    const cursed   = players.filter(p => p.is_cursed).length;
    const slaScore = players.length > 0
        ? Math.round(((players.length - cursed) / players.length) * 100)
        : 100;
    const slaEl = document.getElementById('repSlaHealth');
    if (slaEl) slaEl.innerText = `${slaScore}%`;

    const performers = [...players]
        .sort((a, b) => (b.xp || 0) - (a.xp || 0))
        .slice(0, 3);

    const medals = ['🥇', '🥈', '🥉'];
    const list   = document.getElementById('topPerformersList');
    if (list) {
        list.innerHTML = performers.length
            ? performers.map((p, i) => `
                <div style="display:flex; justify-content:space-between; font-size:9px; padding:6px 0; border-bottom:1px solid #34495e;">
                    <span>${medals[i]} ${p.nome || p.username}</span>
                    <span style="color:#f1c40f;">${(p.xp || 0).toLocaleString('pt-BR')} XP</span>
                </div>
            `).join('')
            : '<div class="empty-state" style="text-align:left">Nenhum aventureiro ainda.</div>';
    }

    const factions = {};
    players.forEach(p => {
        const key = p.faction || 'Sem Facção';
        if (!factions[key]) factions[key] = { members: 0, xp: 0, coins: 0, quests: 0 };
        factions[key].members++;
        factions[key].xp     += p.xp              || 0;
        factions[key].coins  += p.coins            || 0;
        factions[key].quests += p.quests_completed || 0;
    });

    const FACTION_ICONS = { Produto: '📦', Suporte: '🎧', 'Customer Service': '📣', 'Sem Facção': '❓' };
    const grid = document.getElementById('factionsGrid');
    if (grid) {
        const entries = Object.entries(factions);
        grid.innerHTML = entries.length
            ? entries.map(([name, data]) => `
                <div class="faction-card">
                    <h3 class="faction-name">${FACTION_ICONS[name] || '🏰'} ${name}</h3>
                    <div style="font-size:9px; display:flex; flex-direction:column; gap:6px;">
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:#bdc3c7;">Membros</span>
                            <span style="color:#fff;">${data.members}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:#bdc3c7;">XP Total</span>
                            <span style="color:#2ecc71;">${data.xp.toLocaleString('pt-BR')}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:#bdc3c7;">Gold Total</span>
                            <span style="color:#f1c40f;">💰 ${data.coins.toLocaleString('pt-BR')}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:#bdc3c7;">Missões</span>
                            <span style="color:#3498db;">${data.quests}</span>
                        </div>
                    </div>
                </div>
            `).join('')
            : '<div class="empty-state" style="padding:10px">Nenhum aventureiro recrutado ainda.</div>';
    }
}

// ==========================================
// 3. MODAL — EVENTOS (BIBLIOTECA DE TEMPLATES)
// ==========================================
let _encCurrentTplId = null;

function openEncounterModal() {
    const modal = document.getElementById('encounterModal');
    if (!modal) return;
    encShowLibrary();
    modal.style.display = 'flex';
}

function closeEncounterModal() {
    const modal = document.getElementById('encounterModal');
    if (modal) modal.style.display = 'none';
}

function encShowLibrary() {
    document.getElementById('encViewLibrary').style.display = 'block';
    document.getElementById('encViewCreate').style.display  = 'none';
    document.getElementById('encViewTrigger').style.display = 'none';
    document.getElementById('encBtnBack').style.display     = 'none';
    document.getElementById('encModalTitle').textContent    = '⚡ EVENTOS';
    encLoadTemplates();
}

function encShowCreate(tpl) {
    document.getElementById('encViewLibrary').style.display = 'none';
    document.getElementById('encViewCreate').style.display  = 'block';
    document.getElementById('encViewTrigger').style.display = 'none';
    document.getElementById('encBtnBack').style.display     = 'inline-block';
    document.getElementById('encModalTitle').textContent    = tpl ? '✏️ EDITAR TEMPLATE' : '+ NOVO EVENTO';
    _encCurrentTplId = tpl ? tpl._id : null;
    document.getElementById('encCreateForm').reset();
    if (tpl) {
        document.getElementById('encTplTitle').value    = tpl.title;
        document.getElementById('encTplDesc').value     = tpl.description || '';
        document.getElementById('encTplKind').value     = tpl.effect_kind;
        document.getElementById('encTplValue').value    = Math.round(tpl.default_value * 100);
        document.getElementById('encTplDuration').value = tpl.default_duration;
        document.getElementById('encTplScope').value    = tpl.scope_type;
    }
}

function encShowTrigger(tpl) {
    document.getElementById('encViewLibrary').style.display = 'none';
    document.getElementById('encViewCreate').style.display  = 'none';
    document.getElementById('encViewTrigger').style.display = 'block';
    document.getElementById('encBtnBack').style.display     = 'inline-block';
    document.getElementById('encModalTitle').textContent    = '⚡ ACIONAR EVENTO';
    _encCurrentTplId = tpl._id;
    const icon  = ENC_ICONS[tpl.effect_kind]  || '⚡';
    const label = ENC_LABELS[tpl.effect_kind] || tpl.effect_kind;
    const color = (ENC_COLORS[tpl.effect_kind] || ENC_COLORS.xp_bonus).text;
    document.getElementById('encTriggerInfo').innerHTML = `
        <div style="font-size:9px;color:#e056fd;margin-bottom:6px;">${icon} ${tpl.title}</div>
        ${tpl.description ? `<div style="font-size:7px;color:#bdc3c7;margin-bottom:8px;">${tpl.description}</div>` : ''}
        <div style="font-size:7px;color:${color};">${label} · ${Math.round(tpl.default_value * 100)}% · padrão ${tpl.default_duration}h</div>`;
    document.getElementById('encTriggerDuration').value = tpl.default_duration;
    document.getElementById('encTriggerScope').value    = tpl.scope_type;
    encToggleFaction();
}

function encToggleFaction() {
    const scope = document.getElementById('encTriggerScope').value;
    document.getElementById('encTriggerFactionWrap').style.display = scope === 'faction' ? 'block' : 'none';
}

async function encLoadTemplates() {
    const container = document.getElementById('encTemplateList');
    container.innerHTML = '<div class="empty-state" style="padding:12px 0">Carregando...</div>';
    try {
        const res  = await fetch(`${API_URL}/event-templates`, { headers: { 'Authorization': `Bearer ${token}` } });
        const list = await res.json();
        if (!list.length) {
            container.innerHTML = '<div class="empty-state" style="padding:12px 0">Nenhum template criado ainda.</div>';
            return;
        }
        container.innerHTML = list.map(tpl => {
            const icon  = ENC_ICONS[tpl.effect_kind]  || '⚡';
            const label = ENC_LABELS[tpl.effect_kind] || tpl.effect_kind;
            const color = (ENC_COLORS[tpl.effect_kind] || ENC_COLORS.xp_bonus).text;
            return `<div style="display:flex;align-items:center;gap:8px;padding:9px 10px;background:#0d1b2a;border:1px solid #2c3e50;margin-bottom:6px;">
                <span style="font-size:13px;">${icon}</span>
                <div style="flex:1;min-width:0;">
                    <div style="font-size:8px;color:#ecf0f1;margin-bottom:2px;">${tpl.title}</div>
                    <div style="font-size:7px;color:${color};">${label} · ${Math.round(tpl.default_value*100)}% · ${tpl.default_duration}h · ${tpl.scope_type==='global'?'🌐 Global':'🏰 Facção'}</div>
                </div>
                <button class="btn-pixel btn-special" onclick="encShowTrigger(${JSON.stringify(tpl).replace(/"/g,'&quot;')})" data-cy="btn-enc-trigger-${tpl._id}"
                        style="font-size:6px;padding:5px 8px;">⚡</button>
                <button class="btn-pixel btn-neutral" onclick="encShowCreate(${JSON.stringify(tpl).replace(/"/g,'&quot;')})" data-cy="btn-enc-edit-${tpl._id}"
                        style="font-size:6px;padding:5px 8px;">✏️</button>
                <button class="btn-pixel btn-danger" onclick="encDeleteTemplate('${tpl._id}')" data-cy="btn-enc-delete-${tpl._id}"
                        style="font-size:6px;padding:5px 8px;">🗑️</button>
            </div>`;
        }).join('');
    } catch { container.innerHTML = '<div style="font-size:8px;color:#e74c3c;padding:12px 0;text-align:center;">Erro ao carregar biblioteca.</div>'; }
}

async function encSubmitCreate(event) {
    event.preventDefault();
    const body = {
        title:            document.getElementById('encTplTitle').value.trim(),
        description:      document.getElementById('encTplDesc').value.trim(),
        effect_kind:      document.getElementById('encTplKind').value,
        default_value:    Number(document.getElementById('encTplValue').value) / 100,
        default_duration: Number(document.getElementById('encTplDuration').value),
        scope_type:       document.getElementById('encTplScope').value,
    };
    const url    = _encCurrentTplId ? `${API_URL}/event-templates/${_encCurrentTplId}` : `${API_URL}/event-templates`;
    const method = _encCurrentTplId ? 'PATCH' : 'POST';
    try {
        const res = await fetch(url, {
            method,
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
        });
        if (!res.ok) { const e = await res.json(); showToast(e.message || 'Erro ao salvar.', 'error'); return; }
        showToast(_encCurrentTplId ? 'Template atualizado!' : 'Template criado!', 'success');
        encShowLibrary();
    } catch { showToast('Erro de conexão.', 'error'); }
}

async function encDeleteTemplate(id) {
    if (!confirm('Excluir este template de evento?')) return;
    try {
        const res = await fetch(`${API_URL}/event-templates/${id}`, {
            method:  'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) { showToast('Erro ao excluir template.', 'error'); return; }
        showToast('Template excluído.', 'success');
        encLoadTemplates();
    } catch { showToast('Erro de conexão.', 'error'); }
}

async function encSubmitTrigger() {
    const scope    = document.getElementById('encTriggerScope').value;
    const duration = Number(document.getElementById('encTriggerDuration').value);
    const body     = { template_id: _encCurrentTplId, type: scope, duration_hours: duration };
    if (scope === 'faction') body.affected_faction = document.getElementById('encTriggerFaction').value;
    try {
        const res = await fetch(`${API_URL}/encounters/trigger`, {
            method:  'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
        });
        if (!res.ok) { const e = await res.json(); showToast(e.message || 'Erro ao acionar evento.', 'error'); return; }
        closeEncounterModal();
        showToast('⚡ Evento acionado com sucesso!', 'success');
    } catch { showToast('Erro de conexão ao acionar evento.', 'error'); }
}
