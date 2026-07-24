// Injeta o HTML do modal de eventos compartilhado entre admin.html e admin-sprint-board.html.
// A lógica JS (encShow*, encSubmitTrigger, etc.) permanece em cada página/script respectivo.
(function () {
    const html = `
    <div id="encounterModal" data-cy="encounter-modal"
         style="display:none; position:fixed; inset:0; background:rgba(0,0,0,.8); z-index:var(--z-encounter); align-items:flex-start; justify-content:center; padding-top:48px; overflow-y:auto;"
         onclick="if(event.target===this)closeEncounterModal()">
        <div style="background:#1a252f; border:2px solid #8e44ad; width:100%; max-width:520px; margin:0 16px 48px; box-sizing:border-box;">

            <!-- HEADER -->
            <div style="display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:2px solid #2c3e50;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <button id="encBtnBack" data-cy="btn-enc-back" onclick="encShowLibrary()"
                            style="display:none; background:transparent; border:none; color:#8e44ad; font-size:14px; cursor:pointer; padding:0;">&#8592;</button>
                    <span id="encModalTitle" style="font-family:'Press Start 2P',cursive; font-size:10px; color:#e056fd;">&#9889; EVENTOS</span>
                </div>
                <button onclick="closeEncounterModal()" style="background:transparent; border:none; color:#7f8c8d; font-size:14px; cursor:pointer;">&#10005;</button>
            </div>

            <!-- VIEW: BIBLIOTECA -->
            <div id="encViewLibrary" style="padding:20px;">
                <div id="encTemplateList" data-cy="encounter-template-list">
                    <div class="empty-state">Carregando biblioteca...</div>
                </div>
                <button class="btn-pixel btn-neutral" data-cy="btn-enc-new-template" onclick="encShowCreate()"
                        style="width:100%; margin-top:12px; font-size:7px; padding:9px;">
                    + Criar Novo Evento
                </button>
            </div>

            <!-- VIEW: CRIAR TEMPLATE -->
            <div id="encViewCreate" style="display:none; padding:20px;">
                <form id="encCreateForm" data-cy="form-enc-create" onsubmit="encSubmitCreate(event)">
                    <label style="display:block; font-size:8px; color:#bdc3c7; margin-bottom:4px;">T&#205;TULO *</label>
                    <input id="encTplTitle" data-cy="input-enc-tpl-title" type="text" required
                           class="pixel-input-dark"
                           style="font-size:8px; padding:7px 9px; margin-bottom:12px;"
                           placeholder="Ex: Semana Dourada">

                    <label style="display:block; font-size:8px; color:#bdc3c7; margin-bottom:4px;">DESCRI&#199;&#195;O</label>
                    <input id="encTplDesc" data-cy="input-enc-tpl-desc" type="text"
                           class="pixel-input-dark"
                           style="font-size:8px; padding:7px 9px; margin-bottom:12px;"
                           placeholder="Detalhes do evento (opcional)">

                    <div style="display:flex; gap:12px; margin-bottom:12px;">
                        <div style="flex:1;">
                            <label style="display:block; font-size:8px; color:#bdc3c7; margin-bottom:4px;">EFEITO *</label>
                            <select id="encTplKind" data-cy="select-enc-tpl-kind" required
                                    class="pixel-input-dark pixel-input-gold"
                                    style="font-size:7px; padding:7px 6px;">
                                <option value="xp_bonus">&#10024; B&#244;nus de XP</option>
                                <option value="gold_bonus">&#128176; B&#244;nus de Gold</option>
                                <option value="xp_penalty">&#128128; Penalidade de XP</option>
                                <option value="gold_penalty">&#128184; Penalidade de Gold</option>
                                <option value="luck">&#127808; Sorte (2x XP)</option>
                                <option value="slow">&#128012; Lentid&#227;o (SLA)</option>
                                <option value="store_discount">&#127991;&#65039; Desconto na Loja</option>
                            </select>
                        </div>
                        <div style="flex:1;">
                            <label style="display:block; font-size:8px; color:#bdc3c7; margin-bottom:4px;">VALOR (%) *</label>
                            <input id="encTplValue" data-cy="input-enc-tpl-value" type="number" required min="1" max="100" value="50"
                                   class="pixel-input-dark"
                                   style="font-size:8px; padding:7px 9px;">
                        </div>
                    </div>

                    <div style="display:flex; gap:12px; margin-bottom:20px;">
                        <div style="flex:1;">
                            <label style="display:block; font-size:8px; color:#bdc3c7; margin-bottom:4px;">DURA&#199;&#195;O PADR&#195;O (h) *</label>
                            <input id="encTplDuration" data-cy="input-enc-tpl-duration" type="number" required min="1" max="168" value="2"
                                   class="pixel-input-dark"
                                   style="font-size:8px; padding:7px 9px;">
                        </div>
                        <div style="flex:1;">
                            <label style="display:block; font-size:8px; color:#bdc3c7; margin-bottom:4px;">ESCOPO PADR&#195;O</label>
                            <select id="encTplScope" data-cy="select-enc-tpl-scope"
                                    class="pixel-input-dark pixel-input-gold"
                                    style="font-size:7px; padding:7px 6px;">
                                <option value="global">&#127760; Global</option>
                                <option value="faction">&#127984; Fac&#231;&#227;o</option>
                            </select>
                        </div>
                    </div>

                    <div style="display:flex; gap:8px; justify-content:flex-end;">
                        <button type="button" class="btn-pixel btn-muted" onclick="encShowLibrary()"
                                style="font-size:7px; padding:7px 12px; border:none; box-shadow:none; cursor:pointer;">Cancelar</button>
                        <button type="submit" class="btn-pixel btn-success" data-cy="btn-enc-save-template"
                                style="font-size:7px; padding:7px 12px; border:none; box-shadow:none; cursor:pointer;">&#128190; Salvar</button>
                    </div>
                </form>
            </div>

            <!-- VIEW: ACIONAR -->
            <div id="encViewTrigger" style="display:none; padding:20px;">
                <div id="encTriggerInfo" style="background:#0d1b2a; border:1px solid #8e44ad; padding:12px; margin-bottom:16px;"></div>

                <label style="display:block; font-size:8px; color:#bdc3c7; margin-bottom:4px;">DURA&#199;&#195;O (horas)</label>
                <input id="encTriggerDuration" data-cy="input-enc-trigger-duration" type="number" min="1" max="168"
                       class="pixel-input-dark"
                       style="font-size:8px; padding:7px 9px; margin-bottom:12px;">

                <label style="display:block; font-size:8px; color:#bdc3c7; margin-bottom:4px;">ESCOPO</label>
                <select id="encTriggerScope" data-cy="select-enc-trigger-scope"
                        class="pixel-input-dark pixel-input-gold"
                        style="font-size:7px; padding:7px 6px; margin-bottom:12px;"
                        onchange="encToggleFaction()">
                    <option value="global">&#127760; Global</option>
                    <option value="faction">&#127984; Fac&#231;&#227;o espec&#237;fica</option>
                </select>

                <div id="encTriggerFactionWrap" style="display:none; margin-bottom:16px;">
                    <label style="display:block; font-size:8px; color:#bdc3c7; margin-bottom:4px;">FAC&#199;&#195;O</label>
                    <select id="encTriggerFaction" data-cy="select-enc-trigger-faction"
                            class="pixel-input-dark pixel-input-gold"
                            style="font-size:7px; padding:7px 6px;">
                        <option value="Produto">&#128230; Produto</option>
                        <option value="Suporte">&#127911; Suporte</option>
                        <option value="Customer Service">&#128227; Customer Service</option>
                    </select>
                </div>

                <div style="display:flex; gap:8px; justify-content:flex-end;">
                    <button type="button" class="btn-pixel btn-muted" onclick="encShowLibrary()"
                            style="font-size:7px; padding:7px 12px; border:none; box-shadow:none; cursor:pointer;">Cancelar</button>
                    <button type="button" class="btn-pixel btn-special" data-cy="btn-enc-confirm-trigger" onclick="encSubmitTrigger()"
                            style="font-size:7px; padding:7px 12px; border:none; box-shadow:none; cursor:pointer;">&#9889; Acionar!</button>
                </div>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
})();
