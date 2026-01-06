// API & Data Fetching Module

Object.assign(window.app, {
    async fetchApiData(query) {
        try {
            const cleanQuery = query.replace(new RegExp("[\r\n]+", "g"), ' ').replace(new RegExp("\\s{2,}", "g"), ' ').trim();
            const res = await fetch('https://api.tarkov.dev/graphql', {
                method: 'POST', 
                headers: { 
                    'Content-Type': 'application/json', 
                    'Accept': 'application/json' 
                }, 
                body: JSON.stringify({ query: cleanQuery })
            });
            
            if (!res.ok) throw new Error(`HTTP Status ${res.status}`);
            const json = await res.json();
            if (json.errors) {
                console.error("API Errors:", json.errors);
                const errorMsg = json.errors.map(e => e.message).join('; ');
                
                if (json.data) {
                    this.showToast("Warning: Partial Data Loaded");
                    console.warn("Returning partial data despite errors:", errorMsg);
                    return json.data;
                }
                
                throw new Error(errorMsg);
            }
            if (json.data) return json.data;
            throw new Error("No data in response");
        } catch (e) {
            console.error("API Fetch Error:", e);
            this.showToast("Connection Error: " + e.message);
            this.safeUpdateHTML('dash-status', `<span class="text-red-500">ERROR</span>`);
            return null;
        }
    },

    async fetchLiveStats() {
        const btn = document.getElementById('sync-btn');
        const original = btn ? btn.innerHTML : '';
        if(btn) {
            btn.innerHTML = `<span class="loader"></span>`;
            btn.disabled = true;
        }

        const modeLabel = this.data.config.gameMode === 'pve' ? 'PvE Zone' : 'PvP Mode';
        const modeColor = this.data.config.gameMode === 'pve' ? 'bg-tarkov-green text-black' : 'bg-red-600 text-white';
        const badge = document.getElementById('header-mode-badge');
        if(badge) {
            badge.className = `text-[10px] px-1 rounded ml-1 align-top transition-colors ${modeColor}`;
            badge.innerText = this.data.config.gameMode === 'pve' ? 'PvE' : 'PvP';
        }

        this.showToast(`Syncing Data (${modeLabel})...`);
        this.safeUpdateHTML('dash-status', `<span class="text-yellow-500">INITIALIZING...</span>`);

        try {
            const taskQuery = `{ 
                tasks(limit: 1000, lang: ja) { 
                    id name minPlayerLevel kappaRequired map { name } trader { name } wikiLink lightkeeperRequired
                    taskRequirements { task { id name } }
                    traderRequirements { trader { name } level }
                    objectives { 
                        id 
                        type 
                        description 
                        ... on TaskObjectiveItem {
                            count
                            foundInRaid
                            item { id name iconLink gridImageLink }
                        }
                    }
                    startRewards { traderStanding { trader { name } standing } items { item { name shortName gridImageLink } count } } 
                    finishRewards { 
                        traderStanding { trader { name } standing } 
                        items { item { name shortName gridImageLink } count } 
                        craftUnlock { id station { name } level rewardItems { item { name iconLink } } }
                        offerUnlock { id trader { name } level item { name iconLink } }
                    }
                }
                ammo(limit: 200, lang: en) { item { id name shortName } caliber damage penetrationPower armorDamage }
                maps(lang: ja) {
                    id
                    name
                    wiki
                    raidDuration
                    players
                    extracts {
                        name
                    }
                    bosses {
                        name
                        spawnChance
                        spawnLocations {
                            name
                            chance
                        }
                    }
                }
            }`;
            
            const taskData = await this.fetchApiData(taskQuery);
            if (taskData) {
                if (typeof this.loadTaskCompletionStatus === 'function') {
                    this.loadTaskCompletionStatus();
                } else {
                    console.warn("loadTaskCompletionStatus is not defined. Skipping task status loading.");
                }

                const savedStatus = JSON.parse(localStorage.getItem(this.getCompletionStorageKey()) || '{}');
                
                if (taskData.tasks) {
                    this.data.tasks = taskData.tasks.map(t => ({...t, completed: !!savedStatus[t.id]}));
                    this.safeUpdateText('dash-task-count', this.data.tasks.length);
                } else {
                     console.warn("No tasks returned from API");
                     this.data.tasks = [];
                }

                if (taskData.ammo) {
                    this.data.ammo = taskData.ammo.sort((a, b) => b.penetrationPower - a.penetrationPower);
                }

                if (taskData.maps) {
                    this.data.maps = taskData.maps || [];
                }

                if (typeof this.processTaskMetaData === 'function') this.processTaskMetaData();
                if (typeof this.renderTasks === 'function') this.renderTasks();
            }

            await this.fetchMarketDataFull();
            
            this.bindAmmoPrices();
            this.renderAmmo();
            this.loadInjectorPresets();
            this.refreshPresetPrices();

            this.safeUpdateHTML('dash-status', `<span class="${this.data.config.gameMode === 'pve' ? 'text-green-400' : 'text-red-400'}">ONLINE (${this.data.config.gameMode === 'pve' ? 'PvE' : 'PvP'})</span>`);
            this.showToast("System Fully Synchronized");

        } catch (e) {
            console.error(e);
            this.showToast("Partial Sync Fail");
            this.safeUpdateHTML('dash-status', `<span class="text-red-500">SYNC ERROR</span>`);
        }
        
        if(btn) {
            btn.innerHTML = original;
            btn.disabled = false;
        }
    },

    async fetchMarketDataFull() {
        const gameMode = this.data.config.gameMode;
        
        // 1. Hideout
        try {
            const hideoutQuery = `{ hideoutStations(lang: ja) { id name levels { level itemRequirements { count item { id name iconLink } } stationLevelRequirements { station { id } level } traderRequirements { trader { name } level } } } }`;
            const hideoutData = await this.fetchApiData(hideoutQuery);
            if (hideoutData) {
                this.data.hideoutStationsRaw = hideoutData.hideoutStations;
                this.data.hideoutMap.clear();
                hideoutData.hideoutStations.forEach(s => s.levels.forEach(l => l.itemRequirements.forEach(r => {
                    if (!r || !r.item) return;
                    if (!this.data.hideoutMap.has(r.item.id)) this.data.hideoutMap.set(r.item.id, []);
                    this.data.hideoutMap.get(r.item.id).push({ stationId: s.id, stationName: s.name, level: l.level, count: r.count });
                })));
                this.renderHideout();
            }
        } catch(e) { console.error("Hideout Fetch Error:", e); }

        // 2. Barters
        try {
            const barterQuery = `{ barters(lang: ja) { trader { name } level requiredItems { count item { name iconLink } } rewardItems { item { id } } } }`;
            const barterData = await this.fetchApiData(barterQuery);
            if (barterData) {
                this.data.acquisitionMap.clear();
                barterData.barters.forEach(b => b.rewardItems.forEach(r => {
                    if (!r || !r.item) return;
                    if (!this.data.acquisitionMap.has(r.item.id)) this.data.acquisitionMap.set(r.item.id, []);
                    this.data.acquisitionMap.get(r.item.id).push({ traderName: b.trader.name, level: b.level, ingredients: b.requiredItems });
                }));
            }
        } catch(e) { console.error("Barter Fetch Error:", e); }

        // 3. Market Items (Critical)
        try {
            const marketQuery = `{ 
                items(gameMode: ${gameMode}, limit: 5000, offset: 0, types: [${this.consts.globalTypes.join(', ')}], lang: ja) {
                    id name shortName avg24hPrice low24hPrice high24hPrice changeLast48hPercent wikiLink types iconLink gridImageLink description
                    sellFor { price source } 
                    buyFor { price source vendor { name } requirements { type value } }
                    usedInTasks { id name trader { name } wikiLink }
                    bartersFor { trader { name } level rewardItems { item { name } } }
                }
            }`;
            const marketRes = await this.fetchApiData(marketQuery);
            if (marketRes) {
                this.data.marketItems = marketRes.items.filter(i => i.avg24hPrice > 0 || (i.buyFor && i.buyFor.length > 0)).sort((a, b) => b.avg24hPrice - a.avg24hPrice);
                this.data.itemPriceMap.clear();
                this.data.itemFullPriceData.clear(); 

                this.data.marketItems.forEach(i => {
                    this.data.itemFullPriceData.set(i.id, {
                        avg24hPrice: i.avg24hPrice,
                        buyFor: i.buyFor || []
                    });
                    this.data.itemPriceMap.set(i.id, i.avg24hPrice);
                });
                
                this.data.injectorItems = this.data.marketItems
                    .filter(i => i.types.includes('meds'))
                    .map(i => {
                        const bestPrice = this.getBestPrice(i.id);
                        return { ...i, priceData: bestPrice };
                    })
                    .sort((a,b) => a.name.localeCompare(b.name));
                
                this.safeUpdateText('dash-market-count', this.data.marketItems.length);
            }
        } catch(e) { 
            console.error("Market Items Fetch Error:", e); 
            this.showToast("Critical: Market Data Failed");
        }

        // 4. Crafts
        try {
            const craftQuery = `{ 
                crafts(lang: ja) {
                    station { name } level duration
                    requiredItems { count item { id name shortName iconLink } }
                    rewardItems { count item { id name shortName iconLink } }
                }
            }`;
            const craftRes = await this.fetchApiData(craftQuery);
            if (craftRes) {
                this.data.craftMap.clear();
                this.data.crafts = craftRes.crafts.filter(c => c.requiredItems && c.rewardItems).map(c => {
                    const cost = c.requiredItems.reduce((acc, req) => {
                        if (!req || !req.item) return acc;
                        const bestPrice = this.getBestPrice(req.item.id);
                        return acc + (bestPrice.price * req.count);
                    }, 0);
                    
                    const rev = c.rewardItems.reduce((a, r) => {
                        if (!r || !r.item) return a;
                        return a + ((this.data.itemPriceMap.get(r.item.id) || 0) * r.count);
                    }, 0);

                    const profit = (rev * 0.9) - cost;
                    
                    c.requiredItems.forEach(req => {
                        if (!req || !req.item) return;
                        if(!this.data.craftMap.has(req.item.id)) this.data.craftMap.set(req.item.id, []);
                        this.data.craftMap.get(req.item.id).push({ type: 'ingredient', profit, station: c.station.name, level: c.level, products: c.rewardItems.filter(r => r && r.item) });
                    });
                    return { ...c, cost, profit };
                }).sort((a, b) => b.profit - a.profit);
            }
        } catch(e) { console.error("Craft Fetch Error:", e); }
        
        this.calculateAllRequirements();
        this.renderMarket();
        this.renderCrafts();
        this.renderWishlist();
    },

    getBestPrice(itemId) {
        const data = this.data.itemFullPriceData.get(itemId);
        if (!data) return { price: 0, source: 'unknown', vendor: 'Unknown' };

        let bestPrice = 999999999;
        let source = 'unknown';
        let vendor = 'Unavailable';

        // Check Flea
        if (data.avg24hPrice > 0) {
            bestPrice = data.avg24hPrice;
            source = 'flea';
            vendor = 'Flea Market';
        }

        // Check Traders
        if (data.buyFor) {
            data.buyFor.forEach(offer => {
                if (offer.source === 'fleaMarket') return; 
                
                const traderName = offer.vendor.name;
                const userLL = this.data.config.traderLevels[traderName] || 4; 
                
                const llReq = offer.requirements.find(r => r.type === 'loyaltyLevel');
                const reqLevel = llReq ? llReq.value : 1;

                if (userLL >= reqLevel) {
                    if (offer.price < bestPrice) {
                        bestPrice = offer.price;
                        source = 'trader';
                        vendor = `${traderName} LL${reqLevel}`;
                    }
                }
            });
        }
        
        if (bestPrice === 999999999) {
            bestPrice = 0;
            source = 'unknown';
            vendor = 'Unavailable';
        }

        return { price: bestPrice, source, vendor };
    },

    bindAmmoPrices() {
        this.data.ammo.forEach(a => {
            let priceInfo = this.getBestPrice(a.item.id);
            if (priceInfo.price === 0 || priceInfo.source === 'unknown') {
                const match = this.data.marketItems.find(mi => mi.name === a.item.name || mi.shortName === a.item.shortName);
                if (match) {
                    priceInfo = this.getBestPrice(match.id);
                }
            }
            a.priceData = priceInfo;
        });
    },

    async fetchWeaponData() {
        const query = `{ items(types: [gun], lang: ja) { id name shortName types } }`;
        const data = await this.fetchApiData(query);
        if (data && data.items) {
            this.data.weapons = data.items.filter((v,i,a)=>a.findIndex(t=>(t.id === v.id))===i).sort((a, b) => a.name.localeCompare(b.name));
            this.setupGunsmith();
        }
    }
});
