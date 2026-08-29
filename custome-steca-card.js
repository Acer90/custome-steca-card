// Custom Lovelace card for visualizing Steca inverter flows.
// Drop into www/community/babenschneider/custome_steca_card.js and add as a resource.
// Usage example:
// type: custom:custome-steca-card
// mode_entity: sensor.steca_1_modus
// charge_entity: sensor.steca_1_ladestatus
// charge_ac_entity: sensor.steca_1_ladestatus_ac
// charge_solar_entity: sensor.steca_1_ladestatus_solar
// load_entity: sensor.steca_1_last_status
// pv_power_entity: sensor.steca_1_pv_ladeleistung
// ac_power_entity: sensor.steca_1_ac_wirkleistung

class CustomeStecaCard extends HTMLElement {
	static getConfigElement() {
		return document.createElement('custome-steca-card-editor');
	}

	static getStubConfig() {
		return { mode_entity: 'sensor.steca_1_modus' };
	}

	setConfig(config) {
		if (!config.mode_entity) {
			throw new Error('mode_entity is required');
		}
		const setupList = Array.isArray(config.setup_entities)
			? config.setup_entities
			: (config.setup_entities ?? config.setup_entity ?? '')
				.toString()
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean);
		const setupGroups = this._normalizeSetupGroups(
			config.setup_groups ?? config.setup_categories ?? config.setup_sections,
			setupList
		);
		this._config = {
			title: config.title ?? 'Schema',
			mode_entity: config.mode_entity,
			charge_entity: config.charge_entity ?? 'sensor.steca_1_ladestatus',
			charge_ac_entity: config.charge_ac_entity ?? 'sensor.steca_1_ladestatus_ac',
			charge_solar_entity: config.charge_solar_entity ?? 'sensor.steca_1_ladestatus_solar',
			load_entity: config.load_entity ?? 'sensor.steca_1_last_status',
			pv_power_entity: config.pv_power_entity ?? 'sensor.steca_1_pv_ladeleistung',
			ac_power_entity: config.ac_power_entity ?? 'sensor.steca_1_ac_wirkleistung',
			grid_power_entity: config.grid_power_entity ?? '',
			battery_soc_entity: config.battery_soc_entity ?? '',
			battery_ah_entity: config.battery_ah_entity ?? '',
			battery_ah_max_entity: config.battery_ah_max_entity ?? '',
			battery_power_entity: config.battery_power_entity ?? '',
			battery_discharge_entity: config.battery_discharge_entity ?? 'sensor.steca_1_batterie_entladestrom',
			battery_charge_entity: config.battery_charge_entity ?? 'sensor.steca_1_batterie_ladestrom',
			battery_voltage_lr_entity: config.battery_voltage_lr_entity ?? 'sensor.steca_1_batteriespannung_lr',
			battery_voltage_wr_entity: config.battery_voltage_wr_entity ?? 'sensor.steca_1_batteriespannung_wr',
			setup_popup: config.setup_popup ?? config.setup_bubble ?? '',
			setup_entities: setupList,
			setup_groups: setupGroups,
		};
		this._root = this.attachShadow({ mode: 'open' });
		this._ensureRendered();
		this._setupNodeActions();
		this._updateUI();
	}

	set hass(hass) {
		this._hass = hass;
		if (this._root && this.isConnected) this._updateUI();
	}

	disconnectedCallback() {
		this._closeSetupOverlay();
	}

	getCardSize() {
		return 4;
	}

	_entityState(entityId, defaultValue = null) {
		if (!this._hass || !entityId) return defaultValue;
		const stateObj = this._hass.states[entityId];
		return stateObj ? stateObj.state : defaultValue;
	}

	_stateObj(entityId) {
		if (!this._hass || !entityId) return null;
		return this._hass.states?.[entityId] ?? null;
	}

	_callService(domain, service, data) {
		if (!this._hass?.callService) return;
		try {
			this._hass.callService(domain, service, data);
		} catch (e) {
			// ignore
		}
	}

	_toNumber(entityId, defaultValue = 0) {
		const val = this._entityState(entityId, null);
		const num = Number(val);
		return Number.isFinite(num) ? num : defaultValue;
	}

	_normalizeEntityList(value) {
		if (!value) return [];
		if (Array.isArray(value)) {
			return value.map((s) => String(s).trim()).filter(Boolean);
		}
		return String(value)
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
	}

	_normalizeSetupGroups(rawGroups, fallbackEntities = []) {
		const normalizeGroup = (g) => {
			if (!g || typeof g !== 'object') return null;
			const title = (g.title ?? g.name ?? '').toString();
			const entities = this._normalizeEntityList(g.entities ?? g.entity ?? g.items);
			const childrenRaw = g.groups ?? g.subgroups ?? g.children;
			const groups = Array.isArray(childrenRaw)
				? childrenRaw.map(normalizeGroup).filter(Boolean)
				: [];
			if (!title && entities.length === 0 && groups.length === 0) return null;
			return { title, entities, groups };
		};

		const input = Array.isArray(rawGroups) ? rawGroups : [];
		const normalized = input.map(normalizeGroup).filter(Boolean);
		if (normalized.length) return normalized;
		const fallback = this._normalizeEntityList(fallbackEntities);
		return fallback.length ? [{ title: '', entities: fallback, groups: [] }] : [];
	}

	_countSetupItems(input) {
		if (!input) return 0;
		if (Array.isArray(input) && input.length && typeof input[0] === 'string') return input.filter(Boolean).length;
		const groups = Array.isArray(input) ? input : [];
		let count = 0;
		const walk = (g) => {
			if (!g) return;
			count += Array.isArray(g.entities) ? g.entities.filter(Boolean).length : 0;
			(g.groups || []).forEach(walk);
		};
		groups.forEach(walk);
		return count;
	}

	_ensureRendered() {
		if (this._rendered) return;
		this._root.innerHTML = `
			<style>
				:host {
					display: block;
					--card-bg: transparent;
					--tile-bg: var(--ha-card-background, var(--card-background-color, rgba(0,0,0,1)));
					--accent: var(--accent-color, rgba(29, 211, 176, 1));
					--accent-soft: var(--accent-color, rgba(29, 211, 176, 1));
					--grid: #00a2ff;
					--solar: #f7c948;
					--battery: #38c172;
					--off: #6b7280;
					--danger: #ef4444;
					--text: #e5e7eb;
					--text_black: #000000;
					font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
				}
				.card {
					position: relative;
					background: var(--card-bg);
					color: var(--text);
					border-radius: 16px;
					overflow: hidden;
					padding: 16px;
					box-shadow: 0 10px 30px rgba(0,0,0,0.35);
				}
				.glass {
					position: relative;
					backdrop-filter: blur(6px);
					background: rgba(0, 0, 0, 0.35);
					border-radius: 12px;
					padding: 12px;
				}
				.header {
					display: flex;
					justify-content: space-between;
					align-items: baseline;
					margin-bottom: 8px;
				}
				.title {
					font-size: 18px;
					font-weight: 700;
					letter-spacing: 0.02em;
				}
				.mode {
					font-size: 13px;
					padding: 4px 10px;
					border-radius: 999px;
					background: var(--accent-soft);
					color: var(--text_black);
					text-transform: uppercase;
					letter-spacing: 0.08em;
				}
				.grid {
					position: relative;
					display: grid;
					grid-template-areas:
						'top top top'
						'left center right'
						'bottom bottom bottom';
					grid-template-columns: 1fr 1fr 1fr;
					grid-template-rows: auto 1fr auto;
					gap: 12px;
					min-height: 320px;
					align-items: center;
				}
				.node {
					display: flex;
					flex-direction: column;
					align-items: center;
					gap: 4px;
					text-shadow: 0 2px 6px rgba(0,0,0,0.35);
					pointer-events: none;
				}
				.node > * { pointer-events: auto; }
				.node .label { font-size: 13px; opacity: 0.9; }
				.node .value { font-size: 20px; font-weight: 700; }
				.node.clickable { cursor: pointer; }
				.node.clickable:active { transform: translateY(1px); }
				.node.active .icon { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-soft); }
				.node .meta { font-size: 12px; opacity: 0.82; }
				.icon {
					width: 52px;
					height: 52px;
					border-radius: 14px;
					display: grid;
					place-items: center;
					background: var(--tile-bg);
					border: 1px solid rgba(255,255,255,0.08);
				}
				.icon svg { width: 26px; height: 26px; stroke-width: 1.7; position: relative; z-index: 1; }
				.icon.battery-icon { position: relative; overflow: hidden; }
				.center { grid-area: center; align-self: stretch; justify-self: stretch; position: relative; }
				.circle { position: absolute; inset: 10% 12%; border: 2px dashed rgba(255,255,255,0.12); border-radius: 50%; pointer-events: none; }
				.flow { position: absolute; inset: 0; pointer-events: none; z-index: 1; }
				.node { position: relative; z-index: 2; }
				.center-icon { z-index: 2; }
				.flow-segment { position: absolute; width: 2px; height: 34%; transform-origin: 50% 0%; opacity: 0.15; }
				.flow-segment.active { opacity: 0.9; }
				.flow-segment.reverse .flow-line, .flow-segment.reverse .flow-dot { animation-direction: reverse; }
				.flow-line { width: 2px; height: 100%; background: linear-gradient(var(--grid), transparent); animation: pulse var(--flow-duration, 2s) ease-in-out infinite; opacity: 0.75; }
				.flow-dot { position: absolute; left: 50%; width: 10px; height: 10px; border-radius: 50%; background: var(--grid); box-shadow: 0 0 16px rgba(0,162,255,0.8); transform: translate(-50%, -50%); animation: travelY var(--flow-duration, 2.2s) linear infinite; }
				.center-icon { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 78px; height: 78px; border-radius: 22px; background: none; border: none; display: grid; place-items: center; gap: 4px; color: var(--text); box-shadow: 0 10px 30px rgba(0,0,0,0.35); }
				.center-icon .mode { padding: 6px 12px; min-width: 0; text-align: center; }
				.summary { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; margin-top: 12px; font-size: 13px; }
				.soc { margin-top: 12px; display: grid; gap: 6px; }
				.soc-header { display: flex; justify-content: space-between; font-size: 13px; opacity: 0.9; }
				.soc-bar { position: relative; width: 100%; height: 12px; border-radius: 999px; background: rgba(255,255,255,0.08); overflow: hidden; border: 1px solid rgba(255,255,255,0.08); }
				.soc-fill { position: absolute; inset: 0; border-radius: 999px; background: linear-gradient(90deg, var(--accent), var(--accent-soft)); transition: width 0.3s ease; }
				.setup-btn {
					position: absolute;
					top: 8px;
					right: 8px;
					display: flex;
					flex-direction: column;
					align-items: center;
					gap: 6px;
					padding: 0;
					border: 0;
					background: transparent;
					color: var(--text);
					cursor: pointer;
					z-index: 11;
				}
				.setup-btn:active { transform: translateY(1px); }
				.setup-icon {
					width: 52px;
					height: 52px;
					border-radius: 14px;
					display: grid;
					place-items: center;
					background: var(--tile-bg);
					border: 1px solid rgba(255,255,255,0.08);
					backdrop-filter: blur(4px);
				}
				.setup-icon svg { width: 26px; height: 26px; stroke-width: 1.7; pointer-events: none; }
				.setup-text { font-size: 13px; opacity: 0.9; text-shadow: 0 2px 6px rgba(0,0,0,0.35); }
				.setup-btn:active { transform: translateY(1px); }
				.setup-panel {
					position: fixed;
					top: 50%;
					left: 50%;
					transform: translate(-50%, -50%);
					min-width: min(520px, calc(100vw - 32px));
					max-width: calc(100vw - 32px);
					max-height: calc(100vh - 32px);
					overflow: auto;
					background: rgba(0,0,0,0.6);
					backdrop-filter: blur(6px);
					border: 1px solid rgba(255,255,255,0.14);
					border-radius: 12px;
					padding: 8px;
					box-shadow: 0 10px 30px rgba(0,0,0,0.4);
					display: none;
					z-index: 1000;
				}
				.setup-row {
					display: grid;
					grid-template-columns: 1fr auto;
					align-items: center;
					gap: 10px;
					padding: 8px 10px;
					border-radius: 10px;
					cursor: pointer;
					border: 1px solid rgba(255,255,255,0.1);
					background: rgba(255,255,255,0.05);
					color: var(--text);
					margin-bottom: 6px;
					transition: background 0.15s ease, border-color 0.15s ease;
				}
				.setup-row:last-child { margin-bottom: 0; }
				.setup-row:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.2); }
				.setup-name { font-size: 13px; }
				.setup-value { font-size: 13px; opacity: 0.9; }
				@keyframes travelY { 0% { top: 0%; opacity: 0; } 20% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
				@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
				@media (max-width: 480px) { .grid { min-height: 260px; } .value { font-size: 17px; } }
			</style>
			<div class="card">
				<div class="header">
					<div class="title" id="title"></div>
					<div class="mode" id="mode-pill"></div>
				</div>
				<div class="glass">
					<button class="setup-btn" id="setup-btn" title="Setup">
						<div class="setup-icon">${this._icon('settings')}</div>
						<div class="setup-text">Setup</div>
					</button>
					<div class="setup-panel" id="setup-panel"></div>
					<div class="grid">
						<div class="flow" id="flow-layer">
							${this._flowSegment('top')}
							${this._flowSegment('left')}
							${this._flowSegment('right')}
							${this._flowSegment('bottom')}
						</div>
						<div class="node" id="grid-node" style="grid-area: top;">
							<div class="label">Netz</div>
							<div class="icon" style="color: var(--grid)">${this._icon('flash')}</div>
							<div class="value" id="grid-power">0 W</div>
						</div>
						<div class="node" id="pv-node" style="grid-area: left; margin-top: 10px;">
							<div class="label">Solar</div>
							<div class="icon" style="color: var(--solar)">${this._icon('sun')}</div>
							<div class="value" id="pv-power">0 W</div>
						</div>
						<div class="center">
							<div class="circle"></div>
							<div class="center-icon"><div class="mode center-mode" id="mode-center"></div></div>
						</div>
						<div class="node" id="ac-node" style="grid-area: right; margin-top: 10px;">
							<div class="label">AC Output</div>
							<div class="icon" style="color: var(--accent-soft)">${this._icon('ac')}</div>
							<div class="value" id="ac-power">0 W</div>
						</div>
						<div class="node" id="batt-node" style="grid-area: bottom;">
							<div class="label">Batterie</div>
							<div class="icon battery-icon" id="batt-icon" style="color: var(--battery)">
								${this._icon('battery')}
							</div>
							<div class="value" id="batt-power">0 W</div>
							<div class="meta" id="batt-ah">-</div>
						</div>
					</div>
					<div class="soc">
						<div class="soc-header"><span>SoC</span><span id="soc-value">0%</span></div>
						<div class="soc-bar"><div class="soc-fill" id="soc-fill" style="width:0%"></div></div>
					</div>
				</div>
			</div>
		`;
		this._rendered = true;
		this._cacheRefs();
		this._setupNodeActions();
		this._updateUI();
	}

	_flowSegment(direction) {
		const pos = {
			top: 'left:50%; top:0; transform: translate(-50%, 0) rotate(0deg);',
			bottom: 'left:50%; bottom:0; transform: translate(-50%, 0) rotate(180deg);',
			left: 'top:50%; left:0; transform: translate(0, -50%) rotate(-90deg);',
			right: 'top:50%; right:0; transform: translate(0, -50%) rotate(90deg);',
		}[direction];
		return `
			<div class="flow-segment" data-dir="${direction}" style="${pos}">
				<div class="flow-line"></div>
				<div class="flow-dot"></div>
			</div>
		`;
	}

	_cacheRefs() {
		const qs = (sel) => this._root.querySelector(sel);
		this._els = {
			title: qs('#title'),
			modePill: qs('#mode-pill'),
			modeCenter: qs('#mode-center'),
			gridEl: qs('.grid'),
			circleEl: qs('.center .circle'),
			setupBtn: qs('#setup-btn'),
			setupPanel: qs('#setup-panel'),
			pvNode: qs('#pv-node'),
			pvIcon: qs('#pv-node .icon'),
			pvValue: qs('#pv-power'),
			gridNode: qs('#grid-node'),
			gridIcon: qs('#grid-node .icon'),
			gridValue: qs('#grid-power'),
			acNode: qs('#ac-node'),
			acIcon: qs('#ac-node .icon'),
			acValue: qs('#ac-power'),
			battNode: qs('#batt-node'),
			battIcon: qs('#batt-node .icon'),
			battValue: qs('#batt-power'),
			battIconFill: qs('#batt-icon-fill'),
			battAh: qs('#batt-ah'),
			socFill: qs('#soc-fill'),
			socValue: qs('#soc-value'),
			flows: {
				top: qs('.flow-segment[data-dir="top"]'),
				left: qs('.flow-segment[data-dir="left"]'),
				right: qs('.flow-segment[data-dir="right"]'),
				bottom: qs('.flow-segment[data-dir="bottom"]'),
			},
		};
	}

	_setupNodeActions() {
		if (!this._els) return;
		const cfg = this._config || {};
		this._applyNodeClick(this._els.pvNode, cfg.pv_power_entity);
		this._applyNodeClick(this._els.gridNode, cfg.grid_power_entity);
		this._applyNodeClick(this._els.acNode, cfg.ac_power_entity);
		const battEntity = cfg.battery_power_entity || cfg.battery_charge_entity || cfg.battery_discharge_entity;
		this._applyNodeClick(this._els.battNode, battEntity);
		this._applySetupButton(cfg.setup_popup);
	}

	_applySetupButton(popupPath) {
		const btn = this._els?.setupBtn;
		if (!btn) return;
		const hasPopup = Boolean((popupPath || '').trim());
		btn.style.display = hasPopup ? 'inline-flex' : 'none';
		btn.onclick = hasPopup
			? (ev) => {
				ev.stopPropagation();
				this._navigate(popupPath.trim());
			}
			: null;
	}

	_navigate(path) {
		if (!path) return;
		const target = String(path).trim();
		if (!target) return;
		if (this._hass?.navigate) {
			try {
				this._hass.navigate(target);
				return;
			} catch (e) {
				// fallback below
			}
		}
		this.dispatchEvent(new CustomEvent('hass-navigate', {
			detail: { path: target },
			bubbles: true,
			composed: true,
		}));
		if (target.startsWith('#')) {
			window.location.hash = target;
		}
	}

	_buildSetupPanel(entitiesOrGroups) {
		const btn = this._els?.setupBtn;
		const panel = this._els?.setupPanel;
		if (!btn || !panel) return;
		const list = Array.isArray(entitiesOrGroups) ? entitiesOrGroups : [];
		btn.style.display = this._countSetupItems(list) ? 'inline-flex' : 'none';
		panel.style.display = 'none';
		btn.onclick = (ev) => {
			ev.stopPropagation();
			if (this._setupOverlayEl) {
				this._closeSetupOverlay();
				return;
			}
			this._openSetupOverlay(list);
		};
	}

	_openSetupOverlay(entitiesOrGroups) {
		const input = Array.isArray(entitiesOrGroups) ? entitiesOrGroups : [];
		const list = input.length && typeof input[0] === 'string'
			? [{ title: '', entities: input.filter(Boolean), groups: [] }]
			: this._normalizeSetupGroups(input, []);
		if (!this._countSetupItems(list)) return;
		this._closeSetupOverlay();

		const overlay = document.createElement('div');
		overlay.className = 'steca-setup-overlay';
		overlay.style.cssText = [
			'position:fixed',
			'inset:0',
			'background:rgba(0,0,0,0.45)',
			'backdrop-filter:blur(2px)',
			'z-index:9999',
			'display:flex',
			'align-items:center',
			'justify-content:center',
		].join(';');

		const modal = document.createElement('div');
		modal.className = 'steca-setup-modal';
		modal.style.cssText = [
			'width:min(520px, calc(100vw - 32px))',
			'max-height:calc(100vh - 32px)',
			'overflow:auto',
			'background:rgba(0,0,0,0.75)',
			'border:1px solid rgba(255,255,255,0.14)',
			'border-radius:12px',
			'padding:10px',
			'box-shadow:0 10px 30px rgba(0,0,0,0.45)',
			'color:#e5e7eb',
			'font-family:Segoe UI, system-ui, -apple-system, sans-serif',
		].join(';');

		const header = document.createElement('div');
		header.className = 'steca-setup-header';
		header.style.cssText = [
			'display:flex',
			'align-items:baseline',
			'justify-content:space-between',
			'gap:10px',
			'padding:4px 4px 10px 4px',
			'margin-bottom:6px',
			'border-bottom:1px solid rgba(255,255,255,0.10)',
		].join(';');

		const headerTitle = document.createElement('div');
		headerTitle.className = 'steca-setup-title';
		headerTitle.style.cssText = 'font-size:15px;font-weight:700;letter-spacing:0.02em;';
		const cfgTitle = this._config?.title ?? '';
		headerTitle.textContent = cfgTitle ? `Setup - ${cfgTitle}` : 'Setup';

		header.appendChild(headerTitle);
		modal.appendChild(header);

		const renderGroupTitle = (title, level) => {
			if (!title) return;
			const h = document.createElement('div');
			h.textContent = title;
			h.style.cssText = [
				'margin:10px 4px 8px 4px',
				`padding-left:${Math.max(0, level) * 10}px`,
				`font-size:${level === 0 ? 13 : 12}px`,
				'font-weight:700',
				'letter-spacing:0.02em',
				'opacity:0.9',
				'border-top:1px solid rgba(255,255,255,0.08)',
			].join(';');
			modal.appendChild(h);
		};

		const renderEntityRow = (entityId) => {
			const row = document.createElement('div');
			row.style.cssText = [
				'display:grid',
				'grid-template-columns:1fr auto',
				'gap:10px',
				'align-items:center',
				'padding:10px 12px',
				'border-radius:10px',
				'cursor:default',
				'border:1px solid rgba(255,255,255,0.10)',
				'background:rgba(255,255,255,0.06)',
				'margin-bottom:8px',
			].join(';');
			row.dataset.entity = entityId;

			const name = document.createElement('div');
			name.textContent = this._friendlyName(entityId);
			name.style.cssText = 'font-size:13px;';

			const controlWrap = document.createElement('div');
			controlWrap.style.cssText = 'display:flex;align-items:center;gap:8px;justify-content:flex-end;';

			const st = this._stateObj(entityId);
			const domain = (entityId || '').split('.')[0];
			const state = st?.state ?? '-';
			const attrs = st?.attributes ?? {};
			const unit = attrs.unit_of_measurement;

			const styleControl = (el) => {
				el.style.cssText = [
					'font-size:13px',
					'color:#e5e7eb',
					'background:rgba(255,255,255,0.06)',
					'border:1px solid rgba(255,255,255,0.14)',
					'border-radius:10px',
					'padding:8px 10px',
					'outline:none',
				].join(';');
			};

			if (domain === 'input_select' || domain === 'select') {
				const sel = document.createElement('select');
				sel.dataset.entity = entityId;
				sel.dataset.controlType = 'select';
				styleControl(sel);
				sel.style.minWidth = '170px';
				// Ensure readability across browsers (some ignore background on <select>)
				sel.style.cssText += [
					'background:rgba(0,0,0,0.55)',
					'color:#e5e7eb',
					'border-color:rgba(255,255,255,0.18)',
					'appearance:none',
					'-webkit-appearance:none',
					'-moz-appearance:none',
					'padding-right:32px',
				].join(';') + ';';
				const options = Array.isArray(attrs.options) ? attrs.options : [];
				options.forEach((opt) => {
					const o = document.createElement('option');
					o.value = opt;
					o.textContent = opt;
					o.style.cssText = 'background:rgba(0,0,0,0.92);color:#e5e7eb;';
					sel.appendChild(o);
				});
				sel.value = String(state);
				sel.addEventListener('change', () => {
					this._callService(domain, 'select_option', { entity_id: entityId, option: sel.value });
				});
				controlWrap.appendChild(sel);
			} else if (domain === 'input_number' || domain === 'number') {
				const btnMinus = document.createElement('button');
				btnMinus.type = 'button';
				btnMinus.textContent = '-';
				styleControl(btnMinus);
				btnMinus.style.cssText += ';padding:8px 12px;min-width:38px;cursor:pointer;';

				const input = document.createElement('input');
				input.type = 'number';
				input.inputMode = 'decimal';
				input.dataset.entity = entityId;
				input.dataset.controlType = 'number';
				styleControl(input);
				input.style.width = '120px';
				if (attrs.min !== undefined) input.min = String(attrs.min);
				if (attrs.max !== undefined) input.max = String(attrs.max);
				if (attrs.step !== undefined) input.step = String(attrs.step);
				input.value = String(state ?? '');

				const btnPlus = document.createElement('button');
				btnPlus.type = 'button';
				btnPlus.textContent = '+';
				styleControl(btnPlus);
				btnPlus.style.cssText += ';padding:8px 12px;min-width:38px;cursor:pointer;';

				const clamp = (val) => {
					let v = val;
					const min = attrs.min !== undefined ? Number(attrs.min) : null;
					const max = attrs.max !== undefined ? Number(attrs.max) : null;
					if (Number.isFinite(min) && v < min) v = min;
					if (Number.isFinite(max) && v > max) v = max;
					return v;
				};

				const getStep = () => {
					const s = attrs.step !== undefined ? Number(attrs.step) : Number(input.step);
					return Number.isFinite(s) && s > 0 ? s : 1;
				};

				const commit = () => {
					const value = Number(input.value);
					if (!Number.isFinite(value)) return;
					const clamped = clamp(value);
					input.value = String(clamped);
					this._callService(domain, 'set_value', { entity_id: entityId, value: clamped });
				};

				const nudge = (dir) => {
					const cur = Number(input.value);
					const base = Number.isFinite(cur) ? cur : Number(state);
					const step = getStep();
					const next = clamp((Number.isFinite(base) ? base : 0) + dir * step);
					input.value = String(next);
					// Debounce service calls so rapid clicks only send the final value
					this._numberStepDebounce = this._numberStepDebounce || {};
					const prev = this._numberStepDebounce[entityId];
					if (prev?.t) window.clearTimeout(prev.t);
					this._numberStepDebounce[entityId] = {
						v: next,
						t: window.setTimeout(() => {
							const last = this._numberStepDebounce?.[entityId];
							if (!last) return;
							this._callService(domain, 'set_value', { entity_id: entityId, value: last.v });
						}, 100),
					};
				};

				btnMinus.addEventListener('click', (ev) => { ev.preventDefault(); nudge(-1); });
				btnPlus.addEventListener('click', (ev) => { ev.preventDefault(); nudge(1); });
				input.addEventListener('change', commit);
				input.addEventListener('keydown', (ev) => {
					if (ev.key === 'Enter') {
						ev.preventDefault();
						input.blur();
						commit();
					}
				});

				controlWrap.appendChild(btnMinus);
				controlWrap.appendChild(input);
				controlWrap.appendChild(btnPlus);
				if (unit) {
					const u = document.createElement('span');
					u.textContent = unit;
					u.style.cssText = 'font-size:13px;opacity:0.85;';
					controlWrap.appendChild(u);
				}
			} else if (domain === 'input_boolean' || domain === 'switch') {
				const wrap = document.createElement('label');
				wrap.style.cssText = [
					'display:inline-flex',
					'align-items:center',
					'gap:10px',
					'cursor:pointer',
					'user-select:none',
				].join(';');

				const checkbox = document.createElement('input');
				checkbox.type = 'checkbox';
				checkbox.dataset.entity = entityId;
				checkbox.dataset.controlType = 'toggle';
				checkbox.checked = state === 'on' || state === 'true' || state === true;
				checkbox.style.cssText = 'position:absolute;opacity:0;width:0;height:0;';

				const track = document.createElement('span');
				track.dataset.toggleTrack = '1';
				track.style.cssText = [
					'position:relative',
					'width:40px',
					'height:22px',
					'border-radius:999px',
					'background:rgba(255,255,255,0.10)',
					'border:1px solid rgba(255,255,255,0.18)',
					'box-sizing:border-box',
					'transition:background 120ms ease, border-color 120ms ease',
				].join(';');

				const thumb = document.createElement('span');
				thumb.dataset.toggleThumb = '1';
				thumb.style.cssText = [
					'position:absolute',
					'top:2px',
					'left:2px',
					'width:18px',
					'height:18px',
					'border-radius:999px',
					'background:rgba(255,255,255,0.55)',
					'box-shadow:0 6px 16px rgba(0,0,0,0.35)',
					'transition:transform 120ms ease, background 120ms ease',
				].join(';');
				track.appendChild(thumb);

				wrap.appendChild(checkbox);
				wrap.appendChild(track);
				controlWrap.appendChild(wrap);

				this._updateSetupToggleVisual(checkbox);
				checkbox.addEventListener('change', () => {
					this._updateSetupToggleVisual(checkbox);
					this._callService(domain, checkbox.checked ? 'turn_on' : 'turn_off', { entity_id: entityId });
				});
			} else if (domain === 'button') {
				const btn = document.createElement('button');
				btn.type = 'button';
				btn.textContent = 'Ausführen';
				btn.dataset.entity = entityId;
				btn.dataset.controlType = 'button';
				styleControl(btn);
				btn.style.cursor = 'pointer';
				btn.addEventListener('click', (ev) => {
					ev.preventDefault();
					this._callService('button', 'press', { entity_id: entityId });
				});
				controlWrap.appendChild(btn);
			} else {
				const val = document.createElement('div');
				val.dataset.entity = entityId;
				val.dataset.controlType = 'value';
				val.textContent = unit ? `${state} ${unit}` : String(state);
				val.style.cssText = 'font-size:13px;opacity:0.9;';
				controlWrap.appendChild(val);
				// fallback: tap row opens HA more-info
				row.style.cursor = 'pointer';
				row.addEventListener('click', (ev) => {
					const t = ev.target;
					if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'BUTTON')) return;
					ev.stopPropagation();
					this._openMoreInfo(entityId);
				});
			}

			row.appendChild(name);
			row.appendChild(controlWrap);

			modal.appendChild(row);
		};

		const renderGroup = (group, level = 0) => {
			if (!group) return;
			renderGroupTitle(group.title, level);
			(group.entities || []).forEach((entityId) => renderEntityRow(entityId));
			(group.groups || []).forEach((g) => renderGroup(g, level + 1));
		};

		list.forEach((g) => renderGroup(g, 0));
		if (modal.lastChild) {
			modal.lastChild.style.marginBottom = '0';
		}

		overlay.appendChild(modal);
		overlay.addEventListener('click', () => this._closeSetupOverlay());
		modal.addEventListener('click', (ev) => ev.stopPropagation());
		document.body.appendChild(overlay);
		this._setupOverlayEl = overlay;
		this._refreshSetupOverlay();
	}

	_closeSetupOverlay() {
		if (this._setupOverlayEl) {
			this._setupOverlayEl.remove();
			this._setupOverlayEl = null;
		}
	}

	_applyNodeClick(el, entityId) {
		if (!el) return;
		const hasEntity = Boolean(entityId);
		el.classList.toggle('clickable', hasEntity);
		el.onclick = hasEntity ? () => this._openMoreInfo(entityId) : null;
	}

	_updateUI() {
		if (!this._rendered) { this._ensureRendered(); return; }
		const cfg = this._config;
		const mode = this._entityState(cfg.mode_entity, 'Unbekannt');
		const load = this._entityState(cfg.load_entity, 'aus');
		const pvPower = this._toNumber(cfg.pv_power_entity, 0);
		const acPower = this._toNumber(cfg.ac_power_entity, 0);
		const gridPower = this._toNumber(cfg.grid_power_entity, 0);
		const battSocRaw = this._toNumber(cfg.battery_soc_entity, 0);
		const battSoc = Math.max(0, Math.min(100, battSocRaw));
		const battAhCurrent = this._toNumber(cfg.battery_ah_entity, 0);
		const battAhMax = this._toNumber(cfg.battery_ah_max_entity, 0);
		const battDischargeA = this._toNumber(cfg.battery_discharge_entity, 0);
		const battChargeA = this._toNumber(cfg.battery_charge_entity, 0);
		const battVoltWr = this._toNumber(cfg.battery_voltage_wr_entity, 0);
		const battVoltLr = this._toNumber(cfg.battery_voltage_lr_entity, 0);
		const battVolt = battVoltWr > 0 ? battVoltWr : battVoltLr;
		const battCurrent = battChargeA - battDischargeA; // positive = Laden
		const battPowerDerived = battVolt * battCurrent;
		const battPower = cfg.battery_power_entity
			? this._toNumber(cfg.battery_power_entity, battPowerDerived)
			: battPowerDerived;

		const { title, modePill, modeCenter, pvNode, gridNode, acNode, battNode, pvValue, gridValue, acValue, battValue, battIconFill, battAh, socFill, socValue, flows } = this._els;
		if (title) title.textContent = cfg.title ?? 'Schema';
		if (modePill) modePill.textContent = mode;
		if (modeCenter) modeCenter.textContent = mode;
		if (pvValue) pvValue.textContent = `${pvPower.toFixed(0)} W`;
		if (gridValue) gridValue.textContent = `${gridPower.toFixed(0)} W`;
		if (acValue) acValue.textContent = `${acPower.toFixed(0)} W`;
		if (battValue) battValue.textContent = `${battPower.toFixed(0)} W`;
		// Active highlight when power magnitude exceeds 10W
		if (pvNode) pvNode.classList.toggle('active', Math.abs(pvPower) > 10);
		if (gridNode) gridNode.classList.toggle('active', Math.abs(gridPower) > 10);
		if (acNode) acNode.classList.toggle('active', Math.abs(acPower) > 10);
		if (battNode) battNode.classList.toggle('active', Math.abs(battPower) > 10);
		if (battIconFill) {
			// Battery SVG inner fill is 14.4 units wide in the 24x24 viewBox
			const w = Math.max(0, Math.min(14.4, (14.4 * battSoc) / 100));
			battIconFill.setAttribute('width', w.toFixed(2));
		}
		if (battAh) {
			const maxText = battAhMax > 0 ? `${battAhMax.toFixed(0)} Ah` : '-';
			const curText = battAhCurrent >= 0 ? `${battAhCurrent.toFixed(0)} Ah` : '-';
			battAh.textContent = `${curText} / ${maxText}`;
		}
		if (socFill) socFill.style.width = `${battSoc.toFixed(0)}%`;
		if (socValue) socValue.textContent = `${battSoc.toFixed(0)}%`;
		this._layoutFlows();
		this._updateSetupPanel(cfg.setup_entities || []);
		this._refreshSetupOverlay();

		// All flows animate from center -> node (force reverse due to rotation math)
		// Swapped: left <-> right
		this._setFlow(flows?.left, pvPower, true);
		this._setFlow(flows?.top, gridPower, true);
		this._setFlow(flows?.right, acPower, false);
		this._setFlow(flows?.bottom, battPower, battPower < 0);
	}

	_updateSetupToggleVisual(checkbox) {
		if (!checkbox) return;
		const wrap = checkbox.parentElement;
		if (!wrap) return;
		const track = wrap.querySelector('[data-toggle-track]');
		const thumb = wrap.querySelector('[data-toggle-thumb]');
		if (!track || !thumb) return;
		const on = Boolean(checkbox.checked);
		track.style.background = on ? 'rgba(29, 211, 176, 0.28)' : 'rgba(255,255,255,0.10)';
		track.style.borderColor = on ? 'rgba(29, 211, 176, 0.60)' : 'rgba(255,255,255,0.18)';
		thumb.style.transform = on ? 'translateX(16px)' : 'translateX(0px)';
		thumb.style.background = on ? '#1dd3b0' : 'rgba(255,255,255,0.55)';
	}

	_layoutFlows() {
		const { gridEl, circleEl, pvIcon, acIcon, gridIcon, battIcon, flows } = this._els || {};
		const leftSeg = flows?.left;
		const rightSeg = flows?.right;
		const topSeg = flows?.top;
		const bottomSeg = flows?.bottom;
		if (!gridEl || !circleEl || !leftSeg || !rightSeg || !topSeg || !bottomSeg) return;
		if (!pvIcon || !acIcon || !gridIcon || !battIcon) return;

		const gridRect = gridEl.getBoundingClientRect();
		const circleRect = circleEl.getBoundingClientRect();
		const pvRect = pvIcon.getBoundingClientRect();
		const acRect = acIcon.getBoundingClientRect();
		const gridIconRect = gridIcon.getBoundingClientRect();
		const battIconRect = battIcon.getBoundingClientRect();
		if (!gridRect.width || !gridRect.height) return;

		const circleCx = (circleRect.left + circleRect.width / 2) - gridRect.left;
		const circleCy = (circleRect.top + circleRect.height / 2) - gridRect.top;

		const iconCenter = (rect) => ({
			x: (rect.left + rect.width / 2) - gridRect.left,
			y: (rect.top + rect.height / 2) - gridRect.top,
		});

		const placeSegment = (seg, endRect) => {
			const start = { x: circleCx, y: circleCy };
			const end = iconCenter(endRect);
			const dx = end.x - start.x;
			const dy = end.y - start.y;
			const len = Math.max(0, Math.hypot(dx, dy));
			const angle = Math.atan2(dx, dy) * (180 / Math.PI);
			const angleRounded = Math.round(angle / 5) * 5;
			seg.style.left = `${start.x}px`;
			seg.style.top = `${start.y}px`;
			seg.style.right = '';
			seg.style.bottom = '';
			seg.style.height = `${len}px`;
			seg.style.transformOrigin = '50% 0%';
			seg.style.transform = `translate(-50%, 0) rotate(${angleRounded.toFixed(0)}deg)`;
		};

		// Swapped: left <-> right
		placeSegment(leftSeg, acRect);
		placeSegment(rightSeg, pvRect);
		placeSegment(topSeg, gridIconRect);
		placeSegment(bottomSeg, battIconRect);
	}

	_refreshSetupOverlay() {
		const overlay = this._setupOverlayEl;
		if (!overlay) return;
		overlay.querySelectorAll('[data-control-type][data-entity]').forEach((el) => {
			const entityId = el.dataset.entity;
			const type = el.dataset.controlType;
			const st = this._stateObj(entityId);
			if (!st) return;
			const state = st.state;
			const attrs = st.attributes || {};
			const unit = attrs.unit_of_measurement;

			if (type === 'number') {
				if (document.activeElement === el) return;
				el.value = String(state ?? '');
				if (attrs.min !== undefined) el.min = String(attrs.min);
				if (attrs.max !== undefined) el.max = String(attrs.max);
				if (attrs.step !== undefined) el.step = String(attrs.step);
			}
			if (type === 'select') {
				const options = Array.isArray(attrs.options) ? attrs.options : [];
				const existing = Array.from(el.options).map((o) => o.value);
				if (options.length && existing.join('|') !== options.join('|')) {
					el.innerHTML = '';
					options.forEach((opt) => {
						const o = document.createElement('option');
						o.value = opt;
						o.textContent = opt;
						o.style.cssText = 'background:rgba(0,0,0,0.92);color:#e5e7eb;';
						el.appendChild(o);
					});
				}
				el.value = String(state ?? '');
			}
			if (type === 'toggle') {
				el.checked = state === 'on' || state === 'true' || state === true;
				this._updateSetupToggleVisual(el);
			}
			if (type === 'value') {
				el.textContent = unit ? `${state} ${unit}` : String(state);
			}
		});

		overlay.querySelectorAll('[data-entity]').forEach((row) => {
			if (!(row instanceof HTMLElement)) return;
			const entityId = row.dataset.entity;
			const nameEl = row.firstElementChild;
			if (nameEl) nameEl.textContent = this._friendlyName(entityId);
		});
	}

	_setFlow(el, power, reverse) {
		if (!el) return;
		el._flowMeta = el._flowMeta || { duration: 0, dotCount: 0, nextAt: 0, pending: null };
		const abs = Math.abs(power);
		if (abs < 1) {
			el.classList.remove('active', 'reverse');
			el.style.removeProperty('--flow-duration');
			el.style.opacity = '0';
			const lineQuiet = el.querySelector('.flow-line');
			const dotQuiet = el.querySelector('.flow-dot');
			[lineQuiet, dotQuiet].forEach((node) => {
				if (!node) return;
				node.style.animationDuration = '';
			});
			if (el._flowMeta?.pending?.t) {
				window.clearTimeout(el._flowMeta.pending.t);
			}
			el._flowMeta = { duration: 0, dotCount: 0, nextAt: 0, pending: null };
			return;
		}
		el.style.opacity = '';
		el.classList.add('active');
		el.classList.toggle('reverse', Boolean(reverse));
		const clamped = Math.min(5000, abs);
		const ratio = clamped / 5000; // 0 -> stopped, 1 -> fastest
		const duration = 2.4 - ratio * (2.4 - 0.6);
		el.style.setProperty('--flow-duration', `${duration.toFixed(2)}s`);
		const dotCount = 1 + Math.floor(ratio * 4);
		const meta = el._flowMeta;
		const needsRebuild = meta.duration !== duration || meta.dotCount !== dotCount;
		const applyRebuild = () => {
			const line = el.querySelector('.flow-line');
			if (line) line.style.animationDuration = `${duration.toFixed(2)}s`;
			el.querySelectorAll('.flow-dot').forEach((node) => node.remove());
			for (let i = 0; i < dotCount; i += 1) {
				const dot = document.createElement('div');
				dot.className = 'flow-dot';
				dot.style.animationDuration = `${duration.toFixed(2)}s`;
				const delay = (duration * i) / dotCount;
				dot.style.animationDelay = `-${delay.toFixed(2)}s`;
				el.appendChild(dot);
			}
			meta.duration = duration;
			meta.dotCount = dotCount;
			meta.nextAt = (window.performance?.now?.() ?? Date.now()) + duration * 1000;
			meta.pending = null;
		};

		if (!needsRebuild) return;
		const now = window.performance?.now?.() ?? Date.now();
		if (meta.nextAt && now < meta.nextAt) {
			if (meta.pending?.t) window.clearTimeout(meta.pending.t);
			const wait = Math.max(0, meta.nextAt - now);
			meta.pending = {
				t: window.setTimeout(() => applyRebuild(), wait),
				v: { duration, dotCount },
			};
		} else {
			applyRebuild();
		}
	}

	_updateSetupPanel(entities) {
		const panel = this._els?.setupPanel;
		if (!panel) return;
		const list = Array.isArray(entities) ? entities.filter(Boolean) : [];
		panel.querySelectorAll('.setup-row').forEach((row) => {
			const id = row.dataset.entity;
			if (!list.includes(id)) return;
			const nameEl = row.querySelector('.setup-name');
			const valEl = row.querySelector('.setup-value');
			if (nameEl) nameEl.textContent = this._friendlyName(id);
			if (valEl) {
				const state = this._entityState(id, '-');
				const unit = this._hass?.states?.[id]?.attributes?.unit_of_measurement;
				valEl.textContent = unit ? `${state} ${unit}` : state;
			}
		});
	}

	_friendlyName(entityId) {
		if (!entityId) return '';
		const st = this._hass?.states?.[entityId];
		return st?.attributes?.friendly_name || entityId;
	}

	_openMoreInfo(entityId) {
		if (!entityId) return;
		this.dispatchEvent(new CustomEvent('hass-more-info', {
			detail: { entityId },
			bubbles: true,
			composed: true,
		}));
	}

	_icon(name) {
		const stroke = 'currentColor';
		switch (name) {
			case 'flash':
				return `<svg viewBox="0 0 24 24" fill="none" stroke="${stroke}"><path d="M13 2 L4 14 H11 L11 22 L20 10 H13 Z"/></svg>`;
			case 'sun':
				return `<svg viewBox="0 0 24 24" fill="none" stroke="${stroke}"><circle cx="12" cy="12" r="4"/><path d="M12 2 V5 M12 19 V22 M4.22 4.22 L6.34 6.34 M17.66 17.66 L19.78 19.78 M2 12 H5 M19 12 H22 M4.22 19.78 L6.34 17.66 M17.66 6.34 L19.78 4.22"/></svg>`;
			case 'battery':
				return `<svg viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-linecap="round" stroke-linejoin="round">
					<defs>
						<clipPath id="battery-body-clip">
							<rect x="3.8" y="7.8" width="14.4" height="8.4" rx="1.6" />
						</clipPath>
					</defs>
					<!-- fill (width is updated by JS) -->
					<rect id="batt-icon-fill" x="3.8" y="7.8" width="0" height="8.4" rx="1.6" fill="currentColor" opacity="0.35" clip-path="url(#battery-body-clip)" />
					<!-- outline -->
					<rect x="3" y="7" width="16" height="10" rx="2" />
					<path d="M21 10 V14" />
				</svg>`;
			case 'ac':
				return `<svg viewBox="0 0 24 24" fill="none" stroke="${stroke}"><path d="M4 12 H20"/><path d="M8 6 L12 12 L8 18"/><path d="M16 6 L12 12 L16 18"/></svg>`;
			case 'inverter':
				return `<svg viewBox="0 0 24 24" fill="none" stroke="${stroke}"><rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9 8 H15"/><path d="M9 12 H15"/><path d="M9 16 H15"/></svg>`;
			case 'settings':
				return `<svg viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-linecap="round" stroke-linejoin="round">
					<g>
						<!-- teeth -->
						<rect x="11" y="1.6" width="2" height="4.2" rx="1" />
						<rect x="11" y="1.6" width="2" height="4.2" rx="1" transform="rotate(45 12 12)" />
						<rect x="11" y="1.6" width="2" height="4.2" rx="1" transform="rotate(90 12 12)" />
						<rect x="11" y="1.6" width="2" height="4.2" rx="1" transform="rotate(135 12 12)" />
						<rect x="11" y="1.6" width="2" height="4.2" rx="1" transform="rotate(180 12 12)" />
						<rect x="11" y="1.6" width="2" height="4.2" rx="1" transform="rotate(225 12 12)" />
						<rect x="11" y="1.6" width="2" height="4.2" rx="1" transform="rotate(270 12 12)" />
						<rect x="11" y="1.6" width="2" height="4.2" rx="1" transform="rotate(315 12 12)" />
						<!-- gear body -->
						<circle cx="12" cy="12" r="7.2" />
						<circle cx="12" cy="12" r="2.8" />
					</g>
				</svg>`;
			default:
				return '';
		}
	}
}

if (!customElements.get('custome-steca-card')) {
	customElements.define('custome-steca-card', CustomeStecaCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
	type: 'custome-steca-card',
	name: 'Custome Steca Card',
	description: 'Visualisiert den Lade- und AC-Status des Steca Wechselrichters',
	preview: true,
	editor: 'custome-steca-card-editor',
});

class CustomeStecaCardEditor extends HTMLElement {
	connectedCallback() {
		this._maybeRender();
	}

	setConfig(config) {
		this._config = {
			title: config.title ?? 'Schema',
			mode_entity: config.mode_entity ?? '',
			charge_entity: config.charge_entity ?? 'sensor.steca_1_ladestatus',
			charge_ac_entity: config.charge_ac_entity ?? 'sensor.steca_1_ladestatus_ac',
			charge_solar_entity: config.charge_solar_entity ?? 'sensor.steca_1_ladestatus_solar',
			load_entity: config.load_entity ?? 'sensor.steca_1_last_status',
			pv_power_entity: config.pv_power_entity ?? 'sensor.steca_1_pv_ladeleistung',
			ac_power_entity: config.ac_power_entity ?? 'sensor.steca_1_ac_wirkleistung',
			grid_power_entity: config.grid_power_entity ?? '',
			battery_soc_entity: config.battery_soc_entity ?? '',
			battery_ah_entity: config.battery_ah_entity ?? '',
			battery_ah_max_entity: config.battery_ah_max_entity ?? '',
			battery_power_entity: config.battery_power_entity ?? '',
			battery_discharge_entity: config.battery_discharge_entity ?? 'sensor.steca_1_batterie_entladestrom',
			battery_charge_entity: config.battery_charge_entity ?? 'sensor.steca_1_batterie_ladestrom',
			battery_voltage_lr_entity: config.battery_voltage_lr_entity ?? 'sensor.steca_1_batteriespannung_lr',
			battery_voltage_wr_entity: config.battery_voltage_wr_entity ?? 'sensor.steca_1_batteriespannung_wr',
			setup_popup: config.setup_popup ?? config.setup_bubble ?? '',
			setup_entity: config.setup_entity ?? '',
		};
		this._maybeRender();
	}

	set hass(hass) {
		this._hass = hass;
		this._maybeRender();
	}

	async _maybeRender() {
		if (!this.isConnected || !this._config) return;
		// Render UI even without hass so the editor shows; then enhance pickers once hass exists
		this._render();
		if (this._hass) {
			await this._ensurePickerReady();
			this._applyPickerState();
		}
	}

	_render() {
		if (!this.isConnected || !this._config) return;
		this.innerHTML = `
			<style>
				.editor-grid { display: grid; gap: 10px; }
				.row { display: grid; grid-template-columns: 180px 1fr; align-items: center; gap: 8px; }
				.row label { font-size: 13px; color: var(--primary-text-color); }
				.row .field { width: 100%; }
				.editor-grid input,
				ha-entity-picker { width: 100%; box-sizing: border-box; padding: 8px; border-radius: 8px; border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color); }
			</style>
			<div class="editor-grid">
				${this._renderText('Titel', 'title')}
				${this._renderEntity('Mode Entity', 'mode_entity')}
				${this._renderEntity('Ladestatus', 'charge_entity')}
				${this._renderEntity('Ladestatus AC', 'charge_ac_entity')}
				${this._renderEntity('Ladestatus Solar', 'charge_solar_entity')}
				${this._renderEntity('Last Status', 'load_entity')}
				${this._renderEntity('PV Leistung (W)', 'pv_power_entity', ['sensor'])}
				${this._renderEntity('AC Leistung (W)', 'ac_power_entity', ['sensor'])}
				${this._renderEntity('Netzleistung (W)', 'grid_power_entity', ['sensor'])}
				${this._renderEntity('Batt SoC (%)', 'battery_soc_entity', ['sensor'])}
				${this._renderEntity('Batt Kapazität Ist (Ah)', 'battery_ah_entity', ['sensor'])}
				${this._renderEntity('Batt Kapazität Max (Ah)', 'battery_ah_max_entity', ['sensor'])}
				${this._renderEntity('Batt Leistung (W)', 'battery_power_entity', ['sensor'])}
				${this._renderEntity('Batt Entladestrom (A)', 'battery_discharge_entity', ['sensor'])}
				${this._renderEntity('Batt Ladestrom (A)', 'battery_charge_entity', ['sensor'])}
				${this._renderEntity('Batt Spannung LR (V)', 'battery_voltage_lr_entity', ['sensor'])}
				${this._renderEntity('Batt Spannung WR (V)', 'battery_voltage_wr_entity', ['sensor'])}
				${this._renderText('Setup Popup (navigate)', 'setup_popup')}
				${this._renderEntity('Setup Entity', 'setup_entity')}
			</div>
		`;
		this.querySelectorAll('input').forEach((el) => {
			el.addEventListener('input', (ev) => this._valueChanged(ev));
		});
		this.querySelectorAll('ha-entity-picker').forEach((el) => {
			this._setupPicker(el);
			el.addEventListener('value-changed', (ev) => this._valueChanged(ev));
		});
	}

	_renderText(label, key) {
		const val = this._config?.[key] ?? '';
		return `
			<div class="row">
				<label>${label}</label>
				<div class="field"><input data-key="${key}" value="${val}" /></div>
			</div>
		`;
	}

	_renderEntity(label, key, includeDomains = ['sensor']) {
		const val = this._config?.[key] ?? '';
		const domainsAttr = includeDomains.join(',');
		return `
			<div class="row">
				<label>${label}</label>
				<div class="field">
					<ha-entity-picker
						data-key="${key}"
						data-include-domains="${domainsAttr}"
						value="${val}"
						allow-custom-entity
					></ha-entity-picker>
				</div>
			</div>
		`;
	}

	_valueChanged(ev) {
		const target = ev.target;
		if (!target || !target.dataset) return;
		const key = target.dataset.key;
		const value = ev.detail && ev.detail.value !== undefined ? ev.detail.value : target.value;
		if (this._config[key] === value) return;
		const newConfig = { ...this._config };
		if (value === '') {
			delete newConfig[key];
		} else {
			newConfig[key] = value;
		}
		this._config = newConfig;
		this._fireConfigChanged();
	}

	_fireConfigChanged() {
		this.dispatchEvent(new CustomEvent('config-changed', {
			detail: { config: this._config },
			bubbles: true,
			composed: true,
		}));
	}

	_applyPickerState() {
		this.querySelectorAll('ha-entity-picker').forEach((el) => this._setupPicker(el));
	}

	_setupPicker(el) {
		if (!el) return;
		if (this._hass) el.hass = this._hass;
		const domains = el.dataset?.includeDomains;
		if (domains) el.includeDomains = domains.split(',');
		const val = this._config?.[el.dataset?.key] ?? '';
		el.value = val;
	}

	async _ensurePickerReady() {
		if (customElements.get('ha-entity-picker')) return true;
		if (window.loadCardHelpers) {
			try {
				await window.loadCardHelpers();
			} catch (e) {
				// ignore
			}
		}
		if (customElements.get('ha-entity-picker')) return true;
		try {
			await customElements.whenDefined('ha-entity-picker');
			return true;
		} catch (e) {
			return false;
		}
	}

}

if (!customElements.get('custome-steca-card-editor')) {
	customElements.define('custome-steca-card-editor', CustomeStecaCardEditor);
}
