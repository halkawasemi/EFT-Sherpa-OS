// Core Application Logic & Data Structure

window.app = {
    data: { 
        tasks: [], 
        ammo: [], 
        traders: [],
        maps: [],
        weapons: [], 
        currentBuild: null,
        currentSlotCandidates: [],
        marketItems: [],
        itemPriceMap: new Map(), 
        itemFullPriceData: new Map(), 
        hideoutMap: new Map(),
        acquisitionMap: new Map(),
        crafts: [],
        craftMap: new Map(),
        hideoutStationsRaw: [],
        userHideoutLevels: {},
        wishlist: new Set(),
        marketConfig: {
            category: 'all',
            station: 'all',
            tab: 'items',
            filters: { task: false, hideout: false, barter: false, craft: false },
            craftFilters: { task: false, hideout: false, barter: false, craft: false }
        },
        ammoConfig: {
            view: 'chart',
            caliber: 'all',
            colorMode: 'penetration',
            filters: { hideUnavailable: false, traderOnly: false },
            sortBy: 'penetration',
            sortDesc: true
        },
        config: {
            gameMode: 'pve', 
            playerLevel: 15,
            traderLevels: {
                'Prapor': 1,
                'Therapist': 1,
                'Skier': 1,
                'Peacekeeper': 1,
                'Mechanic': 1,
                'Ragman': 1,
                'Jaeger': 1,
                'Ref': 1
            }
        },
        ammoPriceCache: new Map(),
        injectorPresets: [], 
        injectorItems: [],
    },
    
    ammoChart: null,
    currentEditingPreset: null,

    consts: {
        typeMapping: { 'barter': ['barter'], 'keys': ['keys'], 'provisions': ['provisions'], 'ammo': ['ammo'], 'mods': ['mods', 'suppressor'], 'container': ['container'], 'wear': ['armor', 'helmet', 'glasses', 'headphones', 'rig', 'backpack'] },
        globalTypes: ['barter', 'keys', 'ammo', 'provisions', 'mods', 'suppressor', 'container', 'armor', 'helmet', 'glasses', 'headphones', 'rig', 'backpack', 'gun', 'meds'],
        tradersList: ['Prapor', 'Therapist', 'Skier', 'Peacekeeper', 'Mechanic', 'Ragman', 'Jaeger', 'Ref'],
        sherpaIntelDB: {
            "Delivery from the Past": {
                desc: "Factoryは夜間推奨。Customsで回収後、一度スタッシュに戻りクエスト倉庫にアイテムを移すこと。",
                tips: ["夜間Factoryは懐中電灯を持参", "Praporsの手紙は脱出不要"]
            }
        },
        injectorLoadouts: {
            "boss": {
                title: "💀 COMBAT (Boss/PvP)",
                desc: "ボス討伐・急な接敵用。出血・骨折・HP減少に即座に対応。",
                warning: "水分・エネルギー消費に注意。",
                items: ["Propital", "eTG-change", "Zagustin"]
            },
            "marathon": {
                title: "🏃 MARATHON (Rotation)",
                desc: "長距離移動用。スタミナ回復と上限をブースト。",
                warning: "SJ6とTrimadolは重複可能。",
                items: ["SJ6 TGLabs", "Trimadol", "L1"]
            },
            "loot": {
                title: "🎒 HEAVY LOOT (MULE)",
                desc: "重量制限無視。戦車バッテリーや重装備回収用。",
                warning: "M.U.L.E.使用中は被ダメージ+9%。",
                items: ["M.U.L.E.", "SJ6 TGLabs", "Propital"]
            },
            "budget": {
                title: "💰 BUDGET (Standard)",
                desc: "タスク・普段使い用。最低限の鎮痛とリジェネ。",
                warning: "コストパフォーマンス優先。",
                items: ["Propital", "Morphine"]
            },
            "night": {
                title: "🌙 NIGHT (Scav Hunt)",
                desc: "夜間用。知覚強化と体温低下(サーマル対策)。",
                warning: "SJ12は餓死防止にも有効。",
                items: ["SJ12 TGLabs", "SJ1 TGLabs"]
            }
        }
    },
    
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                if (typeof func === 'function') {
                    func.apply(this, args);
                }
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    async init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.runInit());
        } else {
            this.runInit();
        }
    },

    async runInit() {
        this.loadConfig(); 
        this.renderConfigUI();
        this.setupListeners();
        this.loadHideoutStatus();
        this.loadWishlist();
        this.safeUpdateText('market-result-count', "Waiting for Sync...");
        this.fetchLiveStats();
        this.fetchWeaponData();
    },
    
    loadConfig() {
        const saved = localStorage.getItem('sherpa_config');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                this.data.config.gameMode = parsed.gameMode || 'pve';
                this.data.config.playerLevel = parseInt(parsed.playerLevel) || 1;
                if(parsed.traderLevels) {
                    this.data.config.traderLevels = { ...this.data.config.traderLevels, ...parsed.traderLevels };
                }
            } catch(e) { console.error("Config load error", e); }
        }
        
        // Update Header UI
        const lvlInput = document.getElementById('header-player-level');
        if(lvlInput) lvlInput.value = this.data.config.playerLevel;
    },

    saveConfig() {
        localStorage.setItem('sherpa_config', JSON.stringify(this.data.config));
    },

    updatePlayerLevel(val) {
        let level = parseInt(val);
        if(isNaN(level) || level < 1) level = 1;
        if(level > 100) level = 100;
        
        this.data.config.playerLevel = level;
        this.saveConfig();
        
        // Synchronize UI
        const hInput = document.getElementById('header-player-level');
        const sInput = document.getElementById('settings-player-level');
        if(hInput) hInput.value = level;
        if(sInput) sInput.value = level;
        
        // Trigger updates dependent on player level
        if(typeof this.renderTasks === 'function') this.renderTasks();
        if(typeof this.renderCrafts === 'function') this.renderCrafts();
        if(typeof this.renderRaidBriefing === 'function') this.renderRaidBriefing();
        this.showToast(`Player Level synchronized: ${level}`);
    },

    renderConfigUI() {
        // Player Level
        const level = this.data.config.playerLevel || 1;
        const sInput = document.getElementById('settings-player-level');
        if(sInput) sInput.value = level;
        
        const hInput = document.getElementById('header-player-level');
        if(hInput) hInput.value = level;

        // Game Mode
        const mode = this.data.config.gameMode || 'pve';
        const radio = document.querySelector(`input[name="gameMode"][value="${mode}"]`);
        if(radio) radio.checked = true;

        // Traders
        const grid = document.getElementById('settings-trader-grid');
        if (grid) {
            grid.innerHTML = this.consts.tradersList.map(t => {
                const lvl = this.data.config.traderLevels[t] || 1;
                return `
                <div class="bg-black/40 p-3 rounded border border-gray-700 flex flex-col gap-2">
                    <div class="flex justify-between items-center">
                        <span class="text-sm font-bold text-gray-300">${t}</span>
                        <span class="text-xs text-tarkov-accent font-mono">LL${lvl}</span>
                    </div>
                    <div class="trader-level-selector">
                        <select onchange="app.updateTraderLevel('${t}', this.value)" class="w-full bg-black border border-gray-600 rounded text-xs py-1 text-white focus:border-tarkov-accent">
                            <option value="1" ${lvl==1?'selected':''}>Level 1</option>
                            <option value="2" ${lvl==2?'selected':''}>Level 2</option>
                            <option value="3" ${lvl==3?'selected':''}>Level 3</option>
                            <option value="4" ${lvl==4?'selected':''}>Level 4 (MAX)</option>
                        </select>
                    </div>
                </div>`;
            }).join('');
        }
    },
    safeUpdateText(id, value) { const el = document.getElementById(id); if (el) el.innerText = value; },
    safeUpdateHTML(id, html) { const el = document.getElementById(id); if (el) el.innerHTML = html; },
    
    showToast(msg) {
        const t = document.getElementById('toast');
        document.getElementById('toast-msg').innerText = msg;
        t.classList.remove('opacity-0', 'pointer-events-none');
        t.classList.add('animate-bounce');
        setTimeout(() => { t.classList.add('opacity-0', 'pointer-events-none'); t.classList.remove('animate-bounce'); }, 2500);
    },

    switchTab(id) {
        ['dashboard', 'tasks', 'gunsmith', 'hideout', 'ammo', 'market', 'wishlist', 'settings', 'loadout', 'intelligence', 'raid', 'loot'].forEach(t => document.getElementById(`view-${t}`)?.classList.add('hidden'));
        const targetView = document.getElementById(`view-${id}`);
        if (targetView) targetView.classList.remove('hidden');

        document.querySelectorAll('.nav-btn-desktop').forEach(b => {
            const active = b.dataset.target === id;
            b.classList.toggle('bg-tarkov-border', active);
            b.classList.toggle('text-tarkov-accent', active);
            b.classList.toggle('border-tarkov-accent', active);
            b.classList.toggle('border-transparent', !active);
        });
        document.querySelectorAll('.nav-btn-mobile').forEach(b => {
            const active = b.dataset.target === id;
            b.classList.toggle('mobile-nav-active', active);
            b.classList.toggle('text-gray-500', !active);
        });

        // Trigger Render for specific tabs
        const renderMethod = {
            'market': 'renderMarket',
            'crafts': 'renderCrafts',
            'tasks': 'renderTasks',
            'hideout': 'renderHideout',
            'ammo': 'renderAmmo',
            'gunsmith': 'renderGunsmith',
            'loadout': 'renderLoadout',
            'intelligence': 'renderIntelligence',
            'raid': 'renderRaidBriefing',
            'wishlist': 'renderWishlist',
            'loot': 'renderLootManager'
        }[id];

        if (renderMethod && typeof this[renderMethod] === 'function') {
            this[renderMethod]();
        }

        document.getElementById('main-content').scrollTop = 0;
    },

    switchSettingsTab(tab) {
        // Hide all contents
        document.querySelectorAll('.settings-tab-content').forEach(c => c.classList.add('hidden'));
        // Show target
        const target = document.getElementById(`settings-tab-${tab}`);
        if(target) target.classList.remove('hidden');

        // Update Buttons
        document.querySelectorAll('.settings-nav-tab').forEach(b => {
            const isActive = b.dataset.tab === tab;
            b.classList.toggle('active', isActive);
            b.classList.toggle('text-tarkov-accent', isActive);
            b.classList.toggle('border-tarkov-accent', isActive);
            b.classList.toggle('bg-tarkov-accent/10', isActive);
            b.classList.toggle('text-gray-500', !isActive);
            b.classList.toggle('border-transparent', !isActive);
        });
    },

    setupListeners() {
        const syncBtn = document.getElementById('sync-btn');
        if(syncBtn) syncBtn.addEventListener('click', () => this.fetchLiveStats());

        document.querySelectorAll('.nav-btn-desktop, .nav-btn-mobile, .nav-btn-shortcut').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.currentTarget.dataset.target));
        });

        // Settings Tabs
        document.querySelectorAll('.settings-nav-tab').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchSettingsTab(e.currentTarget.dataset.tab));
        });

        // Module listeners will be attached by their respective render/init methods if needed, 
        // or we can centralize them here. For now, we'll keep the v0.63 structure where possible.
        
        // Market Tabs
        document.querySelectorAll('.market-nav-tab').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchMarketTab(e.currentTarget.dataset.tab));
        });

        // Filters
        document.querySelectorAll('.filter-toggle-btn').forEach(btn => {
            if(btn.id.includes('filter-craft-')) {
                    btn.addEventListener('click', (e) => this.toggleCraftFilter(e.currentTarget.dataset.filter));
            } else {
                    btn.addEventListener('click', (e) => this.toggleMarketFilter(e.currentTarget.dataset.filter));
            }
        });

        // Settings
        document.querySelectorAll('input[name="gameMode"]').forEach(radio => {
            radio.addEventListener('change', (e) => this.updateGameMode(e.target.value));
        });
        
        // Ammo
        const avChart = document.getElementById('av-chart');
        if(avChart) avChart.addEventListener('click', () => this.switchAmmoView('chart'));
        
        const avList = document.getElementById('av-list');
        if(avList) avList.addEventListener('click', () => this.switchAmmoView('list'));

        const ammoSelect = document.getElementById('ammo-select');
        if(ammoSelect) {
            ammoSelect.addEventListener('change', (e) => {
                this.data.ammoConfig.caliber = e.target.value;
                this.updateAmmoVisuals();
            });
        }
        
        const ammoColor = document.getElementById('ammo-color-mode');
        if(ammoColor) ammoColor.addEventListener('change', (e) => { this.data.ammoConfig.colorMode = e.target.value; this.updateAmmoVisuals(); });

        const afHide = document.getElementById('af-hide-unavail');
        if(afHide) afHide.addEventListener('change', (e) => { this.data.ammoConfig.filters.hideUnavailable = e.target.checked; this.updateAmmoVisuals(); });
        
        const afTrader = document.getElementById('af-trader-only');
        if(afTrader) afTrader.addEventListener('change', (e) => { this.data.ammoConfig.filters.traderOnly = e.target.checked; this.updateAmmoVisuals(); });

        // Gunsmith
        const gsDisassemble = document.getElementById('gs-disassemble');
        if(gsDisassemble) gsDisassemble.addEventListener('click', () => this.disassemble());

        const gsAuto = document.getElementById('gs-auto');
        if(gsAuto) gsAuto.addEventListener('click', () => this.autoAssemble());

        // Loadout Search
        const injectorSearchInput = document.getElementById('injector-picker-search');
        if(injectorSearchInput) injectorSearchInput.addEventListener('input', this.debounce(() => this.renderInjectorPickerList(), 300));

        // Search Inputs
        const searchRenderers = {
            'task-search': 'renderTasks',
            'market-search': 'renderMarket',
            'craft-search': 'renderCrafts',
            'intel-search': 'renderIntelligence'
        };

        for (const [id, rendererName] of Object.entries(searchRenderers)) {
            const el = document.getElementById(id);
            if (el) {
                // Ensure the method exists on 'this' (the app object)
                if (typeof this[rendererName] === 'function') {
                    // Correctly bind 'this' and pass to debounce
                    el.addEventListener('input', this.debounce(this[rendererName].bind(this), 300));
                } else {
                    console.warn(`Renderer method '${rendererName}' not found for input '${id}'`);
                }
            }
        }

        // Task Filters
        ['filter-trader', 'filter-map', 'filter-type', 'filter-status', 'sort-by'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.addEventListener('change', () => this.renderTasks());
        });
        
        // Category Buttons
        document.querySelectorAll('#market-category-filters button').forEach(b => b.addEventListener('click', (e) => {
            document.querySelectorAll('#market-category-filters button').forEach(bb => bb.classList.remove('active', 'text-white'));
            e.target.classList.add('active', 'text-white');
            this.data.marketConfig.category = e.target.dataset.type;
            this.renderMarket();
        }));
        document.querySelectorAll('#craft-filters button').forEach(b => b.addEventListener('click', (e) => {
            document.querySelectorAll('#craft-filters button').forEach(bb => bb.classList.remove('active', 'text-white'));
            e.target.classList.add('active', 'text-white');
            this.data.marketConfig.station = e.target.dataset.station;
            this.renderCrafts();
        }));
    }
};