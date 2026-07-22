// dicebear-customizer.js — Modal de customização de avatar DiceBear Pixel Art v9
(function () {
    const SAMPLE_SEED = 'sample_preview';

    const CATS = [
        {
            id: 'skinColor', label: 'Pele', icon: '🎨', type: 'colors-only',
            colors: ['ffdbac','f5cfa0','eac393','e0b687','cb9e6e','b68655','a26d3d','8d5524']
        },
        {
            id: 'hair', label: 'Cabelo', icon: '💇', type: 'variants',
            variants: [
                'short01','short02','short03','short04','short05','short06',
                'short07','short08','short09','short10','short11','short12',
                'short13','short14','short15','short16','short17','short18',
                'short19','short20','short21','short22','short23','short24',
                'long01','long02','long03','long04','long05','long06','long07',
                'long08','long09','long10','long11','long12','long13','long14',
                'long15','long16','long17','long18','long19','long20','long21'
            ],
            colorKey: 'hairColor',
            colors: ['28150a','603a14','83623b','a78961','cab188','611c17','612616','009bbd','bd1700','91cb15']
        },
        {
            id: 'eyes', label: 'Olhos', icon: '👁️', type: 'variants',
            variants: ['variant01','variant02','variant03','variant04','variant05','variant06',
                       'variant07','variant08','variant09','variant10','variant11','variant12'],
            colorKey: 'eyesColor',
            colors: ['76778b','697b94','647b90','5b7c8b','588387','876658']
        },
        {
            id: 'mouth', label: 'Boca', icon: '😄', type: 'variants',
            variants: [
                'happy01','happy02','happy03','happy04','happy05','happy06','happy07',
                'happy08','happy09','happy10','happy11','happy12','happy13',
                'sad01','sad02','sad03','sad04','sad05','sad06','sad07','sad08','sad09','sad10'
            ],
            colorKey: 'mouthColor',
            colors: ['d29985','c98276','e35d6a','de0f0d']
        },
        {
            id: 'beard', label: 'Barba', icon: '🧔', type: 'variants-toggle',
            variants: ['variant01','variant02','variant03','variant04','variant05','variant06','variant07','variant08'],
            probabilityKey: 'beardProbability'
        },
        {
            id: 'glasses', label: 'Óculos', icon: '🕶️', type: 'variants-toggle',
            variants: ['dark01','dark02','dark03','dark04','dark05','dark06','dark07',
                       'light01','light02','light03','light04','light05','light06','light07'],
            colorKey: 'glassesColor',
            colors: ['4b4b4b','323232','191919','43677d','5f705c','a04b5d'],
            probabilityKey: 'glassesProbability'
        },
        {
            id: 'hat', label: 'Chapéu', icon: '🎩', type: 'variants-toggle',
            variants: ['variant01','variant02','variant03','variant04','variant05',
                       'variant06','variant07','variant08','variant09','variant10'],
            colorKey: 'hatColor',
            colors: ['2e1e05','2663a3','989789','3d8a6b','cc6192','614f8a','a62116'],
            probabilityKey: 'hatProbability'
        },
        {
            id: 'clothing', label: 'Roupa', icon: '👕', type: 'variants',
            variants: Array.from({ length: 23 }, (_, i) => `variant${String(i + 1).padStart(2, '0')}`),
            colorKey: 'clothingColor',
            colors: ['5bc0de','428bca','03396c','88d8b0','44c585','00b159','ff6f69','d11141','ae0001','ffeead','ffd969','ffc425']
        },
        {
            id: 'accessories', label: 'Acess.', icon: '💎', type: 'variants-toggle',
            variants: ['variant01','variant02','variant03','variant04'],
            colorKey: 'accessoriesColor',
            colors: ['daa520','ffd700','fafad2','d3d3d3','a9a9a9'],
            probabilityKey: 'accessoriesProbability'
        }
    ];

    const COLOR_LABELS = {
        hairColor: 'Cor do Cabelo', eyesColor: 'Cor dos Olhos', mouthColor: 'Cor da Boca',
        glassesColor: 'Cor dos Óculos', hatColor: 'Cor do Chapéu',
        clothingColor: 'Cor da Roupa', accessoriesColor: 'Cor dos Acessórios'
    };

    let _seed = '';
    let _opts = {};
    let _activeTab = 0;
    let _applyFn = null;

    function thumbUrl(cat, variant) {
        const extra = { [cat.id]: variant };
        if (cat.probabilityKey) extra[cat.probabilityKey] = 100;
        return dicebearUrl(SAMPLE_SEED, extra);
    }

    function currentUrl() { return dicebearUrl(_seed, _opts); }

    function updatePreviewImg() {
        const img = document.getElementById('dcust-preview-img');
        if (img) img.src = currentUrl();
    }

    function colorSwatchesHtml(colorKey, colors) {
        if (!colorKey || !colors) return '';
        return `
            <div class="dcust-color-label">${COLOR_LABELS[colorKey] || 'Cor'}</div>
            <div class="dcust-swatches">
                ${colors.map(c => `
                    <div class="dcust-swatch${_opts[colorKey] === c ? ' sel' : ''}"
                         style="background:#${c}"
                         onclick="dcustPickColor('${colorKey}','${c}')"
                         title="#${c}"
                         data-cy="swatch-${colorKey}-${c}"></div>
                `).join('')}
            </div>`;
    }

    function renderContent() {
        const cat = CATS[_activeTab];

        if (cat.type === 'colors-only') {
            return `
                <div class="dcust-color-label">Tom de Pele</div>
                <div class="dcust-swatches">
                    ${cat.colors.map(c => `
                        <div class="dcust-swatch${_opts.skinColor === c ? ' sel' : ''}"
                             style="background:#${c}"
                             onclick="dcustPickColor('skinColor','${c}')"
                             title="#${c}"
                             data-cy="swatch-skinColor-${c}"></div>
                    `).join('')}
                </div>`;
        }

        const isToggleCat = cat.type === 'variants-toggle';
        const isOn = !isToggleCat || _opts[cat.probabilityKey] === 100;

        const toggleHtml = isToggleCat ? `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
                <button class="dcust-toggle${isOn ? '' : ' off'}"
                        onclick="dcustToggleCat()"
                        data-cy="toggle-${cat.id}">
                    ${isOn ? 'ON' : 'OFF'}
                </button>
                <span class="dcust-color-label" style="margin:0;">${cat.label.toUpperCase()}</span>
            </div>` : '';

        const useScroll = cat.variants.length > 12;
        const gridHtml = `
            <div class="dcust-grid-wrap${useScroll ? ' dcust-grid-wrap--scroll' : ''}">
                <div class="dcust-grid${useScroll ? ' dcust-grid--scroll' : ''}">
                    ${cat.variants.map(v => `
                        <div class="dcust-thumb${_opts[cat.id] === v ? ' sel' : ''}"
                             onclick="dcustPickVariant('${v}')"
                             title="${v}"
                             data-cy="thumb-${cat.id}-${v}">
                            <img src="${thumbUrl(cat, v)}"
                                 width="52" height="52"
                                 style="image-rendering:pixelated;display:block;"
                                 alt="${v}" loading="lazy">
                        </div>
                    `).join('')}
                </div>
            </div>`;

        return toggleHtml + gridHtml + colorSwatchesHtml(cat.colorKey, cat.colors);
    }

    function renderTabs() {
        return CATS.map((c, i) => `
            <button class="dcust-tab${i === _activeTab ? ' active' : ''}"
                    onclick="dcustSetTab(${i})"
                    data-cy="tab-${c.id}">
                ${c.icon} ${c.label}
            </button>
        `).join('');
    }

    function renderModal() {
        const el = document.getElementById('dcust-modal');
        if (!el) return;
        el.innerHTML = `
            <div class="dcust-backdrop" onclick="dcustClose()" data-cy="dcust-backdrop"></div>
            <div class="dcust-box">
                <div class="dcust-header">
                    <span class="dcust-title">⚡ PERSONALIZAR AVATAR</span>
                    <button class="dcust-close-btn" onclick="dcustClose()" data-cy="btn-dcust-close">✕</button>
                </div>
                <div class="dcust-body">
                    <div class="dcust-sidebar">
                        <img id="dcust-preview-img"
                             src="${currentUrl()}"
                             width="136" height="136"
                             style="image-rendering:pixelated;border:3px solid #f1c40f;display:block;"
                             alt="Preview"
                             data-cy="dcust-preview">
                        <button class="dcust-random-btn" onclick="dcustRandomSeed()" data-cy="btn-dcust-random">
                            🔀 Novo Rosto
                        </button>
                    </div>
                    <div class="dcust-panel">
                        <div class="dcust-tabs" id="dcust-tabs">${renderTabs()}</div>
                        <div class="dcust-content" id="dcust-content">${renderContent()}</div>
                    </div>
                </div>
                <div class="dcust-footer">
                    <button class="dcust-apply-btn" onclick="dcustApply()" data-cy="btn-dcust-apply">
                        ✔ USAR ESTE AVATAR
                    </button>
                </div>
            </div>`;
    }

    function refreshContent() {
        const el = document.getElementById('dcust-content');
        if (el) el.innerHTML = renderContent();
        updatePreviewImg();
    }

    // ── Public API ──────────────────────────────────────────────────────────────

    window.openDicebearCustomizer = function (seed, opts, onApply) {
        _seed    = seed || 'adventurer';
        _opts    = Object.assign({}, opts || {});
        _activeTab = 0;
        _applyFn = onApply;

        let el = document.getElementById('dcust-modal');
        if (!el) {
            el = document.createElement('div');
            el.id = 'dcust-modal';
            el.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;';
            document.body.appendChild(el);
            _injectStyles();
        }
        document.body.style.overflow = 'hidden';
        renderModal();
    };

    window.dcustClose = function () {
        const el = document.getElementById('dcust-modal');
        if (el) el.remove();
        document.body.style.overflow = '';
    };

    window.dcustSetTab = function (idx) {
        _activeTab = idx;
        const tabs = document.getElementById('dcust-tabs');
        if (tabs) tabs.innerHTML = renderTabs();
        const content = document.getElementById('dcust-content');
        if (content) content.innerHTML = renderContent();
    };

    window.dcustPickVariant = function (variant) {
        const cat = CATS[_activeTab];
        if (_opts[cat.id] === variant) {
            delete _opts[cat.id];
            if (cat.probabilityKey) delete _opts[cat.probabilityKey];
        } else {
            _opts[cat.id] = variant;
            if (cat.probabilityKey) _opts[cat.probabilityKey] = 100;
        }
        refreshContent();
    };

    window.dcustPickColor = function (colorKey, val) {
        if (_opts[colorKey] === val) delete _opts[colorKey];
        else _opts[colorKey] = val;
        refreshContent();
    };

    window.dcustToggleCat = function () {
        const cat = CATS[_activeTab];
        if (!cat.probabilityKey) return;
        if (_opts[cat.probabilityKey] === 100) {
            _opts[cat.probabilityKey] = 0;
            delete _opts[cat.id];
        } else {
            _opts[cat.probabilityKey] = 100;
        }
        refreshContent();
    };

    window.dcustRandomSeed = function () {
        _seed = 'rnd_' + Math.random().toString(36).slice(2, 9);
        updatePreviewImg();
    };

    window.dcustApply = function () {
        if (_applyFn) _applyFn(_seed, _opts, currentUrl());
        dcustClose();
    };

    // ── Styles ──────────────────────────────────────────────────────────────────

    function _injectStyles() {
        if (document.getElementById('dcust-styles')) return;
        const s = document.createElement('style');
        s.id = 'dcust-styles';
        s.textContent = `
            .dcust-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.8);}
            .dcust-box{
                position:relative;background:#1a252f;border:4px solid #111;
                box-shadow:8px 8px 0 rgba(0,0,0,.6);width:700px;
                max-width:calc(100vw - 24px);
                height:490px;max-height:calc(100vh - 24px);
                display:flex;flex-direction:column;overflow:hidden;
                font-family:'Press Start 2P',cursive;
            }
            .dcust-header{
                display:flex;justify-content:space-between;align-items:center;
                padding:10px 16px;background:#0d1520;border-bottom:3px solid #2c3e50;flex-shrink:0;
            }
            .dcust-title{font-size:11px;color:#f1c40f;letter-spacing:2px;}
            .dcust-close-btn{
                font-family:'Press Start 2P',cursive;font-size:9px;padding:4px 8px;
                background:none;border:1px solid #7f8c8d;color:#7f8c8d;cursor:pointer;
            }
            .dcust-close-btn:hover{border-color:#e74c3c;color:#e74c3c;}
            .dcust-body{display:flex;flex:1;overflow:hidden;min-height:0;}
            .dcust-sidebar{
                width:172px;flex-shrink:0;display:flex;flex-direction:column;
                align-items:center;justify-content:center;gap:14px;
                padding:16px;background:#0d1520;border-right:2px solid #2c3e50;
            }
            .dcust-random-btn{
                font-family:'Press Start 2P',cursive;font-size:8px;padding:10px 14px;
                background:#2c3e50;color:#3498db;border:2px solid #3498db;cursor:pointer;white-space:nowrap;
            }
            .dcust-random-btn:hover{background:#3498db;color:#fff;}
            .dcust-panel{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;}
            .dcust-tabs{
                display:flex;flex-wrap:wrap;gap:3px;padding:8px 10px;
                background:#0d1520;border-bottom:2px solid #2c3e50;flex-shrink:0;
            }
            .dcust-tab{
                font-family:'Press Start 2P',cursive;font-size:8px;padding:8px 10px;
                background:#1a252f;color:#95a5a6;border:2px solid #2c3e50;cursor:pointer;
                white-space:nowrap;line-height:1;
            }
            .dcust-tab.active{background:#2c3e50;color:#f1c40f;border-color:#f1c40f;}
            .dcust-tab:hover:not(.active){background:#2c3e50;color:#ecf0f1;border-color:#95a5a6;}
            .dcust-content{flex:1;overflow-y:auto;padding:10px 12px;min-height:0;}
            .dcust-grid-wrap{
                height:200px;overflow:hidden;flex-shrink:0;margin-bottom:12px;
            }
            .dcust-grid-wrap--scroll{overflow-x:auto;overflow-y:hidden;}
            .dcust-grid-wrap--scroll::-webkit-scrollbar{height:8px;}
            .dcust-grid-wrap--scroll::-webkit-scrollbar-track{background:#0d1520;border-top:1px solid #2c3e50;}
            .dcust-grid-wrap--scroll::-webkit-scrollbar-thumb{background:#3498db;}
            .dcust-grid-wrap--scroll::-webkit-scrollbar-thumb:hover{background:#5dade2;}
            .dcust-grid{
                display:grid;
                grid-template-columns:repeat(4,1fr);
                grid-auto-rows:64px;
                gap:4px;
            }
            .dcust-grid--scroll{
                grid-template-columns:unset;
                grid-template-rows:repeat(3,64px);
                grid-auto-flow:column;
                grid-auto-columns:calc(25% - 3px);
                min-width:100%;
            }
            .dcust-thumb{
                border:2px solid #2c3e50;cursor:pointer;background:#0d1520;
                display:flex;align-items:center;justify-content:center;transition:border-color .1s;
            }
            .dcust-thumb:hover{border-color:#95a5a6;}
            .dcust-thumb.sel{border-color:#f1c40f;box-shadow:0 0 0 1px #f1c40f;}
            .dcust-color-label{font-size:6px;color:#7f8c8d;letter-spacing:1px;margin-bottom:6px;}
            .dcust-swatches{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px;}
            .dcust-swatch{width:22px;height:22px;cursor:pointer;border:2px solid #2c3e50;box-sizing:border-box;}
            .dcust-swatch:hover,.dcust-swatch.sel{outline:2px solid #3498db;outline-offset:1px;}
            .dcust-toggle{
                font-family:'Press Start 2P',cursive;font-size:7px;padding:4px 8px;
                background:#27ae60;color:#fff;border:2px solid #27ae60;cursor:pointer;
            }
            .dcust-toggle.off{background:#2c3e50;color:#7f8c8d;border-color:#7f8c8d;}
            .dcust-footer{padding:10px 16px;background:#0d1520;border-top:3px solid #2c3e50;flex-shrink:0;}
            .dcust-apply-btn{
                font-family:'Press Start 2P',cursive;font-size:8px;padding:9px;
                background:#27ae60;color:#fff;border:none;cursor:pointer;width:100%;
            }
            .dcust-apply-btn:hover{background:#2ecc71;}
        `;
        document.head.appendChild(s);
    }
})();
