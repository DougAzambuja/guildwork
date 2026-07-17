// ==========================================
// 0. PROTEÇÃO E ESTADO
// ==========================================
const token = localStorage.getItem('guild_token');

document.addEventListener('DOMContentLoaded', () => {
    if (!token || localStorage.getItem('guild_role') !== 'admin') {
        window.location.href = 'login.html';
        return;
    }
    const nameEl = document.getElementById('playerName');
    if (nameEl) nameEl.innerText = localStorage.getItem('guild_user') || 'Mestre da Guilda';
    initMetrics();
});

// ==========================================
// PALETA VALIDADA — Produto / Suporte / CS
// CVD passes: #3498db, #d35400, #8e44ad
// ==========================================
const FACTION_COLORS = {
    'Produto':          '#3498db',
    'Suporte':          '#d35400',
    'Customer Service': '#8e44ad',
    'Sem Facção':       '#636e72'
};
const SURFACE = '#0d1b2a';
const GRID    = '#1e2e3b';

// ==========================================
// 1. LOAD
// ==========================================
async function initMetrics() {
    try {
        const res = await fetch(`${API_URL}/metrics`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        requestAnimationFrame(() => {
            renderCurse(data.curse);
            renderEconomy(data.economy);
            renderSla(data.sla);
            renderCsat(data.csat);
        });
    } catch (err) {
        console.error('[Metrics]', err);
        showToast('Erro ao carregar métricas.', 'error');
    }
}

// ==========================================
// 2. CURSE
// ==========================================
function renderCurse(curse) {
    const { overall, by_faction, historical } = curse;

    // Tile: % de aventureiros amaldiçoados
    const rateEl = document.getElementById('curseOverallRate');
    if (rateEl) {
        rateEl.textContent = `${overall.rate}%`;
        rateEl.style.color = overall.rate === 0 ? '#27ae60' : overall.rate <= 20 ? '#e67e22' : '#e74c3c';
    }
    setText('curseOverallSub',  `${overall.cursed} de ${overall.total} aventureiros`);
    setText('curseTotalCursed', overall.cursed);
    setText('curseTotalSub',    `amaldiçoados no momento`);

    // Tile: histórico de conclusões
    if (historical) {
        setText('curseHistorical',    `${historical.cursed_completions}`);
        setText('curseHistoricalSub', `de ${historical.total_completions} conclusões (${historical.rate}%)`);
    }

    const factionEntries = Object.entries(by_faction);
    if (!factionEntries.length) {
        show('curseFactionEmpty');
        return;
    }

    const chartData = factionEntries.map(([name, d]) => {
        const tooltip = d.cursed_names && d.cursed_names.length
            ? `${name} — ${d.cursed}/${d.total} amaldiçoados: ${d.cursed_names.join(', ')}`
            : `${name} — ${d.rate}% (${d.cursed}/${d.total} aventureiros)`;
        return {
            label:   name,
            value:   d.rate,
            color:   statusColor(d.rate, 'curse'),
            tooltip
        };
    });

    drawHorizontalBars('curseFactionCanvas', chartData, { maxVal: 100, unit: '%', minH: 40 });
    renderLegend('curseLegend', factionEntries.map(([name]) => name));
}

// ==========================================
// 3. ECONOMY
// ==========================================
function renderEconomy(economy) {
    setText('econGoldIssued', `💰 ${(economy.gold_issued || 0).toLocaleString('pt-BR')}`);
    setText('econGoldHeld',   `💰 ${(economy.gold_held   || 0).toLocaleString('pt-BR')}`);

    const factionEntries = Object.entries(economy.by_faction || {});
    if (!factionEntries.length) {
        show('econFactionEmpty');
        return;
    }

    const maxVal = Math.max(...factionEntries.map(([, v]) => v), 1);
    const chartData = factionEntries.map(([name, earned]) => ({
        label:   name,
        value:   earned,
        color:   FACTION_COLORS[name] || '#636e72',
        tooltip: `${name} — 💰 ${earned.toLocaleString('pt-BR')} gold emitido`
    }));

    drawVerticalBars('econFactionCanvas', chartData, { maxVal, unit: ' g', h: 200 });
    renderLegend('econLegend', factionEntries.map(([name]) => name));
}

// ==========================================
// 4. SLA
// ==========================================
function renderSla(sla) {
    const { overall, by_faction } = sla;

    const pctColor = overall.compliance_pct >= 80 ? '#27ae60'
                   : overall.compliance_pct >= 50 ? '#e67e22'
                   : '#e74c3c';

    const pctEl = document.getElementById('slaOverallPct');
    if (pctEl) { pctEl.textContent = `${overall.compliance_pct}%`; pctEl.style.color = pctColor; }
    setText('slaOverallSub', `${overall.within_sla} de ${overall.total} dentro do SLA`);
    setText('slaTotal', overall.total);

    const factionEntries = Object.entries(by_faction);
    if (!factionEntries.length) {
        show('slaFactionEmpty');
        return;
    }

    const chartData = factionEntries.map(([name, d]) => ({
        label:   name,
        value:   d.compliance_pct,
        color:   statusColor(d.compliance_pct, 'compliance'),
        tooltip: `${name} — ${d.compliance_pct}% compliance (${d.within_sla}/${d.total})`
    }));

    drawHorizontalBars('slaFactionCanvas', chartData, { maxVal: 100, unit: '%', minH: 40 });
}

// ==========================================
// 5. CSAT
// ==========================================
function renderCsat(csat) {
    if (!csat.overall_avg) {
        show('csatTrendEmpty');
        setText('csatOverallAvg', '—');
        return;
    }

    const stars = '★'.repeat(Math.round(csat.overall_avg)) + '☆'.repeat(5 - Math.round(csat.overall_avg));
    setText('csatOverallAvg', `${csat.overall_avg}`);
    setText('csatOverallSub', `${stars} de 5.0`);

    if (csat.trend.length >= 2) {
        drawLineChart('csatTrendCanvas', csat.trend, { yMin: 1, yMax: 5, unit: '★', h: 200 });
    } else {
        show('csatTrendEmpty');
    }

    const chips = document.getElementById('csatFactionChips');
    if (chips) {
        const entries = Object.entries(csat.by_faction || {});
        chips.innerHTML = entries.length
            ? entries.map(([name, d]) => {
                const s = '★'.repeat(Math.round(d.avg)) + '☆'.repeat(5 - Math.round(d.avg));
                const icon = name === 'Produto' ? '📦' : name === 'Suporte' ? '🎧' : '📣';
                return `
                    <div class="csat-faction-chip">
                        <span class="chip-name">${icon} ${name}</span>
                        <span class="chip-score">${d.avg}</span>
                        <span class="chip-stars">${s}</span>
                        <span class="chip-count">${d.count} aval.</span>
                    </div>
                `;
            }).join('')
            : '<div style="font-size:8px;color:#7f8c8d;">Sem avaliações CSAT registradas.</div>';
    }
}

// ==========================================
// CHART — HORIZONTAL BARS
// by_faction bars: value 0–maxVal, rounded right end
// ==========================================
function drawHorizontalBars(canvasId, data, { maxVal = 100, unit = '%', minH = 36 }) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const wrapper = canvas.parentElement;
    const dpr     = window.devicePixelRatio || 1;
    const W       = Math.max(wrapper.clientWidth - 24, 200);

    const BAR_H   = 24;
    const ROW_GAP = 14;
    const LABEL_W = 130;
    const PAD_T   = 8;
    const PAD_B   = 8;
    const H       = Math.max(data.length * (BAR_H + ROW_GAP) + PAD_T + PAD_B, minH);

    canvas.width        = W * dpr;
    canvas.height       = H * dpr;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';

    const ctx  = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const plotW = W - LABEL_W - 48;
    const hitAreas = [];

    ctx.clearRect(0, 0, W, H);

    // vertical grid lines (recessive)
    ctx.strokeStyle = GRID;
    ctx.lineWidth   = 1;
    [0.25, 0.5, 0.75, 1].forEach(t => {
        const x = LABEL_W + plotW * t;
        ctx.beginPath();
        ctx.moveTo(x, PAD_T);
        ctx.lineTo(x, H - PAD_B);
        ctx.stroke();
    });

    data.forEach((d, i) => {
        const y    = PAD_T + i * (BAR_H + ROW_GAP);
        const barW = plotW * Math.min(d.value, maxVal) / maxVal;

        // label
        ctx.fillStyle    = '#bdc3c7';
        ctx.font         = '9px Courier New, monospace';
        ctx.textAlign    = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(d.label, LABEL_W - 6, y + BAR_H / 2);

        // bar background
        ctx.fillStyle = '#1a252f';
        ctx.fillRect(LABEL_W, y, plotW, BAR_H);

        // bar fill — rounded right end (dataviz spec: 4px)
        if (barW > 0) {
            ctx.fillStyle = d.color || '#3498db';
            ctx.beginPath();
            if (barW > 4) {
                ctx.moveTo(LABEL_W, y);
                ctx.lineTo(LABEL_W + barW - 4, y);
                ctx.arcTo(LABEL_W + barW, y, LABEL_W + barW, y + BAR_H, 4);
                ctx.arcTo(LABEL_W + barW, y + BAR_H, LABEL_W + barW - 4, y + BAR_H, 4);
                ctx.lineTo(LABEL_W, y + BAR_H);
            } else {
                ctx.rect(LABEL_W, y, barW, BAR_H);
            }
            ctx.closePath();
            ctx.fill();
        }

        // value label (right of bar or at end of track)
        const labelX = LABEL_W + Math.max(barW + 6, 6);
        ctx.fillStyle    = '#ecf0f1';
        ctx.font         = '9px Courier New, monospace';
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${d.value}${unit}`, labelX, y + BAR_H / 2);

        hitAreas.push({ x: LABEL_W, y, w: plotW, h: BAR_H, tooltip: d.tooltip || `${d.label}: ${d.value}${unit}` });
    });

    setupHoverTooltip(canvas, hitAreas);
}

// ==========================================
// CHART — VERTICAL BARS
// ==========================================
function drawVerticalBars(canvasId, data, { maxVal = 100, unit = '', h = 200 }) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const wrapper = canvas.parentElement;
    const dpr     = window.devicePixelRatio || 1;
    const W       = Math.max(wrapper.clientWidth - 24, 200);
    const H       = h;

    canvas.width        = W * dpr;
    canvas.height       = H * dpr;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const PAD_L    = 40;
    const PAD_R    = 16;
    const PAD_T    = 16;
    const PAD_B    = 32;
    const plotW    = W - PAD_L - PAD_R;
    const plotH    = H - PAD_T - PAD_B;
    const barW     = Math.max(plotW / data.length * 0.6, 12);
    const barGap   = plotW / data.length;
    const hitAreas = [];

    ctx.clearRect(0, 0, W, H);

    // horizontal grid lines (recessive)
    ctx.strokeStyle = GRID;
    ctx.lineWidth   = 1;
    [0.25, 0.5, 0.75, 1].forEach(t => {
        const y = PAD_T + plotH * (1 - t);
        ctx.beginPath();
        ctx.moveTo(PAD_L, y);
        ctx.lineTo(W - PAD_R, y);
        ctx.stroke();

        ctx.fillStyle    = '#636e72';
        ctx.font         = '7px Courier New, monospace';
        ctx.textAlign    = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(Math.round(maxVal * t) + unit, PAD_L - 4, y);
    });

    data.forEach((d, i) => {
        const bH   = plotH * Math.min(d.value, maxVal) / maxVal;
        const x    = PAD_L + i * barGap + (barGap - barW) / 2;
        const y    = PAD_T + plotH - bH;
        const fill = d.color || '#3498db';

        // bar fill — rounded top end (4px)
        ctx.fillStyle = fill;
        ctx.beginPath();
        if (bH > 4) {
            ctx.moveTo(x + 4, y);
            ctx.arcTo(x + barW, y, x + barW, y + 4, 4);
            ctx.lineTo(x + barW, y + bH);
            ctx.lineTo(x, y + bH);
            ctx.lineTo(x, y + 4);
            ctx.arcTo(x, y, x + 4, y, 4);
        } else {
            ctx.rect(x, y, barW, bH);
        }
        ctx.closePath();
        ctx.fill();

        // x-axis label
        ctx.fillStyle    = '#bdc3c7';
        ctx.font         = '8px Courier New, monospace';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(d.label.split(' ')[0], x + barW / 2, H - PAD_B + 6);

        // value above bar (selective label)
        if (d.value > 0) {
            ctx.fillStyle    = '#ecf0f1';
            ctx.font         = '8px Courier New, monospace';
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(d.value + unit, x + barW / 2, y - 2);
        }

        hitAreas.push({ x, y: PAD_T, w: barW, h: plotH, tooltip: d.tooltip || `${d.label}: ${d.value}${unit}` });
    });

    setupHoverTooltip(canvas, hitAreas);
}

// ==========================================
// CHART — LINE (CSAT TREND)
// ==========================================
function drawLineChart(canvasId, data, { yMin = 1, yMax = 5, unit = '', h = 200 }) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const wrapper = canvas.parentElement;
    const dpr     = window.devicePixelRatio || 1;
    const W       = Math.max(wrapper.clientWidth - 24, 200);
    const H       = h;

    canvas.width        = W * dpr;
    canvas.height       = H * dpr;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const PAD_L  = 40;
    const PAD_R  = 16;
    const PAD_T  = 16;
    const PAD_B  = 32;
    const plotW  = W - PAD_L - PAD_R;
    const plotH  = H - PAD_T - PAD_B;
    const range  = yMax - yMin;

    ctx.clearRect(0, 0, W, H);

    const toY = v => PAD_T + plotH * (1 - (v - yMin) / range);
    const toX = i => PAD_L + (i / Math.max(data.length - 1, 1)) * plotW;

    // grid + y-axis labels
    ctx.strokeStyle = GRID;
    ctx.lineWidth   = 1;
    for (let v = yMin; v <= yMax; v++) {
        const y = toY(v);
        ctx.beginPath();
        ctx.moveTo(PAD_L, y);
        ctx.lineTo(W - PAD_R, y);
        ctx.stroke();

        ctx.fillStyle    = '#636e72';
        ctx.font         = '7px Courier New, monospace';
        ctx.textAlign    = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(v + unit, PAD_L - 4, y);
    }

    // area fill under line
    ctx.beginPath();
    data.forEach((d, i) => {
        const x = toX(i), y = toY(d.avg);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.lineTo(toX(data.length - 1), PAD_T + plotH);
    ctx.lineTo(toX(0), PAD_T + plotH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, PAD_T, 0, PAD_T + plotH);
    grad.addColorStop(0, 'rgba(52,152,219,0.3)');
    grad.addColorStop(1, 'rgba(52,152,219,0.02)');
    ctx.fillStyle = grad;
    ctx.fill();

    // line (2px, #3498db)
    ctx.strokeStyle = '#3498db';
    ctx.lineWidth   = 2;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    data.forEach((d, i) => {
        const x = toX(i), y = toY(d.avg);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // dots (≥8px hit target, 4px visible radius)
    const hitAreas = [];
    data.forEach((d, i) => {
        const x = toX(i), y = toY(d.avg);

        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle   = '#3498db';
        ctx.fill();
        ctx.strokeStyle = SURFACE;
        ctx.lineWidth   = 2;
        ctx.stroke();

        // x-axis label (every other point if dense)
        if (data.length <= 10 || i % 2 === 0) {
            ctx.fillStyle    = '#7f8c8d';
            ctx.font         = '7px Courier New, monospace';
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(d.date, x, H - PAD_B + 4);
        }

        // direct label on last and max/min points only
        const isLast = i === data.length - 1;
        const vals   = data.map(p => p.avg);
        const isMax  = d.avg === Math.max(...vals);
        if (isLast || isMax) {
            ctx.fillStyle    = '#ecf0f1';
            ctx.font         = '8px Courier New, monospace';
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(d.avg + unit, x, y - 6);
        }

        hitAreas.push({ x: x - 12, y: y - 12, w: 24, h: 24, tooltip: `${d.date}: ${d.avg}${unit}` });
    });

    setupHoverTooltip(canvas, hitAreas);
}

// ==========================================
// TOOLTIP HOVER
// ==========================================
const tooltipEl = document.getElementById('metrics-tooltip');

function setupHoverTooltip(canvas, hitAreas) {
    canvas.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        const mx   = (e.clientX - rect.left) * (canvas.width / rect.width / (window.devicePixelRatio || 1));
        const my   = (e.clientY - rect.top)  * (canvas.height / rect.height / (window.devicePixelRatio || 1));

        const hit = hitAreas.find(a => mx >= a.x && mx <= a.x + a.w && my >= a.y && my <= a.y + a.h);
        if (hit && tooltipEl) {
            tooltipEl.textContent  = hit.tooltip;
            tooltipEl.style.left   = (e.clientX + 14) + 'px';
            tooltipEl.style.top    = (e.clientY - 32) + 'px';
            tooltipEl.style.display = 'block';
        } else if (tooltipEl) {
            tooltipEl.style.display = 'none';
        }
    });
    canvas.addEventListener('mouseleave', () => {
        if (tooltipEl) tooltipEl.style.display = 'none';
    });
}

window.addEventListener('resize', () => {
    requestAnimationFrame(initMetrics);
});

// ==========================================
// HELPERS
// ==========================================
function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function show(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'block';
}

function renderLegend(legendId, names) {
    const el = document.getElementById(legendId);
    if (!el) return;
    el.innerHTML = names.map(name => `
        <div class="legend-item">
            <div class="legend-dot" style="background:${FACTION_COLORS[name] || '#636e72'};"></div>
            <span>${name}</span>
        </div>
    `).join('');
}

// Status color: curse rate (high = bad) or compliance (high = good)
function statusColor(pct, mode) {
    if (mode === 'curse') {
        return pct === 0 ? '#27ae60' : pct <= 20 ? '#e67e22' : '#e74c3c';
    }
    // compliance — high is good
    return pct >= 80 ? '#27ae60' : pct >= 50 ? '#e67e22' : '#e74c3c';
}
