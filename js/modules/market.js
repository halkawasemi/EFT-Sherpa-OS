// Market, Craft, Wishlist & Config Logic

Object.assign(window.app, {
    // --- Config ---
    loadConfig() {
        const saved = localStorage.getItem('eft_sherpa_config');
        if(saved) {
            try {
                const parsed = JSON.parse(saved);
                this.data.config = { ...this.data.config, ...parsed };
            } catch(e) { console.error("Config Load Error", e); }
        }
    },
    saveConfig() {
        localStorage.setItem('eft_sherpa_config', JSON.stringify(this.data.config));
    },
    updateGameMode(mode) {
        if(this.data.config.gameMode === mode) return;
        this.data.config.gameMode = mode;
        this.saveConfig();
        this.fetchLiveStats();
    },
    updateTraderLevel(trader, level) {
        this.data.config.traderLevels[trader] = parseInt(level);
        this.saveConfig();
        this.recalcCrafts();
        this.renderMarket(); 
        this.renderCrafts();
        this.bindAmmoPrices();
        this.renderAmmo();
    },
    
    // --- Market & Craft ---
    calculateAllRequirements() {
        this.data.marketItems.forEach(item => {
            item.reqData = { 
                total: { task: 0, hideout: 0 },
                remaining: { task: 0, hideout: 0 },
                active: false
            };
            if(item.usedInTasks) {
                item.usedInTasks.forEach(t => {
                    const taskInfo = this.data.tasks.find(tk => tk.id === t.id);
                    const count = 1; 
                    item.reqData.total.task += count;
                    if(taskInfo && !taskInfo.completed) {
                        item.reqData.remaining.task += count;
                    }
                });
            }
            const hReqs = this.data.hideoutMap.get(item.id);
            if(hReqs) {
                hReqs.forEach(h => {
                    item.reqData.total.hideout += h.count;
                    const curLvl = this.data.userHideoutLevels[h.stationId] || 0;
                    if(h.level > curLvl) {
                        item.reqData.remaining.hideout += h.count;
                    }
                });
            }
            if(item.reqData.remaining.task > 0 || item.reqData.remaining.hideout > 0) {
                item.reqData.active = true;
            }
        });
    },

    recalcCrafts() {
        this.data.crafts = this.data.crafts.map(c => {
            const cost = c.requiredItems.reduce((acc, req) => {
                const bestPrice = this.getBestPrice(req.item.id);
                return acc + (bestPrice.price * req.count);
            }, 0);
            const rev = c.rewardItems.reduce((a, r) => a + ((this.data.itemPriceMap.get(r.item.id) || 0) * r.count), 0);
            const profit = (rev * 0.9) - cost;
            return { ...c, cost, profit };
        }).sort((a, b) => b.profit - a.profit);
    },

    switchMarketTab(tab) {
        this.data.marketConfig.tab = tab;
        const tabItems = document.getElementById('mt-items');
        const tabCrafts = document.getElementById('mt-crafts');
        if(tabItems) {
            tabItems.className = `market-nav-tab ${tab === 'items' ? 'active' : ''}`;
            tabItems.setAttribute('aria-selected', tab === 'items');
        }
        if(tabCrafts) {
            tabCrafts.className = `market-nav-tab ${tab === 'crafts' ? 'active' : ''}`;
            tabCrafts.setAttribute('aria-selected', tab === 'crafts');
        }
        const viewItems = document.getElementById('subview-items');
        if(viewItems) viewItems.classList.toggle('hidden', tab !== 'items');
        const viewCrafts = document.getElementById('subview-crafts');
        if(viewCrafts) viewCrafts.classList.toggle('hidden', tab !== 'crafts');
    },

    toggleMarketFilter(type) {
        this.data.marketConfig.filters[type] = !this.data.marketConfig.filters[type];
        const btn = document.getElementById(`filter-req-${type}`);
        if(btn) btn.classList.toggle('active', this.data.marketConfig.filters[type]);
        this.renderMarket();
    },

    toggleCraftFilter(type) {
        this.data.marketConfig.craftFilters[type] = !this.data.marketConfig.craftFilters[type];
        const btn = document.getElementById(`filter-craft-req-${type}`);
        if(btn) btn.classList.toggle('active', this.data.marketConfig.craftFilters[type]);
        this.renderCrafts();
    },

    renderMarket() {
        const searchInput = document.getElementById('market-search');
        const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const cat = this.data.marketConfig.category;
        const filters = this.data.marketConfig.filters; 
        
        let results = this.data.marketItems;

        if (search.length > 0) {
            results = results.filter(i => i.name.toLowerCase().includes(search) || (i.shortName && i.shortName.toLowerCase().includes(search)));
        } else if (cat !== 'all') {
            const types = this.consts.typeMapping[cat];
            if (types) results = results.filter(i => i.types.some(t => types.includes(t)));
        }
        
        if (filters.task) results = results.filter(i => i.reqData?.remaining?.task > 0);
        if (filters.hideout) results = results.filter(i => i.reqData?.remaining?.hideout > 0);
        if (filters.barter) results = results.filter(i => i.bartersFor && i.bartersFor.length > 0);
        if (filters.craft) results = results.filter(i => this.data.craftMap.has(i.id));

        const grid = document.getElementById('market-grid');
        if(!grid) return;
        grid.innerHTML = '';
        const display = results.slice(0, 50); 
        this.safeUpdateText('market-result-count', `${results.length} RESULTS`);

        if (display.length === 0) { grid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-10">NO DATA FOUND</div>'; return; }

        display.forEach(item => {
            const priceFmt = (item.avg24hPrice || 0).toLocaleString();
            const lowPrice = item.low24hPrice ? item.low24hPrice.toLocaleString() : '---';
            const highPrice = item.high24hPrice ? item.high24hPrice.toLocaleString() : '---';
            const isWish = this.data.wishlist.has(item.id);

            const req = item.reqData || { total: {task:0, hideout:0}, remaining: {task:0, hideout:0} };
            const isTaskRem = req.remaining.task > 0;
            const isHideRem = req.remaining.hideout > 0;
            
            const barters = item.bartersFor || [];
            const craftUses = this.data.craftMap.get(item.id) || [];
            const isBarter = barters.length > 0;
            const isCraft = craftUses.length > 0;

            let badges = '';
            if(req.total.task > 0) {
                const css = isTaskRem ? 'req-quest' : 'req-done';
                badges += `<span class="req-badge ${css}"><i class="fa-solid fa-scroll"></i> TASK</span>`;
            }
            if(req.total.hideout > 0) {
                const css = isHideRem ? 'req-hideout' : 'req-done';
                badges += `<span class="req-badge ${css}"><i class="fa-solid fa-hammer"></i> HIDEOUT</span>`;
            }
            if(isBarter) badges += `<span class="req-badge req-barter"><i class="fa-solid fa-right-left"></i> BARTER</span>`;
            if(isCraft) badges += `<span class="req-badge req-craft"><i class="fa-solid fa-wrench"></i> CRAFT</span>`;

            const card = document.createElement('button');
            card.className = 'market-card w-full text-left tarkov-panel rounded p-3 relative group touch-manipulation cursor-pointer border border-tarkov-border hover:border-tarkov-blue transition';
            card.onclick = function(e) { 
                if(e.target.closest('.wishlist-star')) return;
                this.classList.toggle('expanded'); 
                const expanded = this.classList.contains('expanded');
                this.setAttribute('aria-expanded', expanded);
            };
            card.setAttribute('aria-expanded', 'false');

            let craftIndicator = '';
            if(isCraft) {
                const maxProfit = Math.max(...craftUses.map(c => c.profit));
                const pClass = maxProfit > 0 ? 'text-tarkov-green' : (maxProfit < 0 ? 'text-tarkov-red' : 'text-gray-500');
                craftIndicator = `<div class="text-[10px] mt-1"><i class="fa-solid fa-chart-pie mr-1"></i>Craft Profit: <span class="${pClass}">₽${Math.round(maxProfit).toLocaleString()}</span></div>`;
            }
            
            let reqMatrix = '';
            if(req.total.task > 0 || req.total.hideout > 0) {
                reqMatrix = `
                <div class="bg-black/40 rounded p-1 border border-gray-800 text-[10px] min-w-[120px]">
                    <div class="flex justify-between px-2 text-gray-500 mb-1"><span>TYPE</span><span>REM / TOT</span></div>
                    ${req.total.task > 0 ? `<div class="flex justify-between px-2 py-0.5 ${isTaskRem ? 'text-tarkov-gold font-bold' : 'text-gray-600 line-through'}"><span>TASK</span><span>${req.remaining.task} / ${req.total.task}</span></div>` : ''}
                    ${req.total.hideout > 0 ? `<div class="flex justify-between px-2 py-0.5 ${isHideRem ? 'text-tarkov-green font-bold' : 'text-gray-600 line-through'}"><span>HIDE</span><span>${req.remaining.hideout} / ${req.total.hideout}</span></div>` : ''}
                </div>`;
            }

            let taskListHtml = '';
            if (item.usedInTasks && item.usedInTasks.length > 0) {
                taskListHtml = item.usedInTasks.map(t => {
                    const tInfo = this.data.tasks.find(tk => tk.id === t.id);
                    const isDone = tInfo ? tInfo.completed : false;
                    const nameContent = t.wikiLink ? `<a href="${t.wikiLink}" target="_blank" class="hover:text-tarkov-accent hover:underline" onclick="event.stopPropagation()">${t.name}</a>` : t.name;
                    return `<div class="flex justify-between items-center py-1 border-b border-[#333] last:border-0 ${isDone ? 'text-gray-600' : 'text-gray-300'}"><span class="truncate pr-2 ${isDone ? 'line-through' : ''}">${nameContent}<span class="text-[9px] text-gray-500">(${t.trader.name})</span></span><span class="text-[9px] font-bold ${isDone ? 'text-gray-700' : 'text-tarkov-gold'}">${isDone ? 'DONE' : 'REQ'}</span></div>`;
                }).join('');
            }

            let hideoutListHtml = '';
            const hReqs = this.data.hideoutMap.get(item.id);
            if (hReqs && hReqs.length > 0) {
                hideoutListHtml = hReqs.map(h => {
                    const curLvl = this.data.userHideoutLevels[h.stationId] || 0;
                    const isDone = h.level <= curLvl;
                    return `<div class="flex justify-between items-center py-1 border-b border-[#333] last:border-0 ${isDone ? 'text-gray-600' : 'text-gray-300'}"><span class="truncate pr-2 ${isDone ? 'line-through' : ''}">${h.stationName} <span class="text-[9px] text-gray-500">(Lv${h.level})</span></span><span class="text-[9px] font-bold ${isDone ? 'text-gray-700' : 'text-tarkov-green'}">x${h.count}</span></div>`;
                }).join('');
            }

            let acquisitionHtml = '';
            const barterOffers = this.data.acquisitionMap.get(item.id) || [];
            barterOffers.forEach(offer => {
                const userLL = this.data.config.traderLevels[offer.traderName] || 4;
                const isLocked = offer.level > userLL;
                const lockedClass = isLocked ? 'opacity-50 grayscale border-red-900/50' : '';
                const lockedBadge = isLocked ? `<span class="text-red-500 font-bold ml-2 text-[9px] border border-red-500 px-1 rounded">LL LOCKED</span>` : '';
                const traderClass = isLocked ? 'text-red-500' : 'text-tarkov-green';

                const ingredients = offer.ingredients.map(ing => `<div class="flex items-center gap-1 bg-[#222] px-1.5 py-0.5 rounded border border-[#444]"><span class="text-[10px] text-gray-300">${ing.item.name}</span><span class="text-[10px] text-tarkov-gold font-bold">x${ing.count}</span></div>`).join('');
                acquisitionHtml += `<div class="bg-[#111] p-2 rounded border border-[#333] mb-2 last:mb-0 ${lockedClass}"><div class="text-[10px] text-gray-500 uppercase mb-1 flex items-center">TRADER: <span class="${traderClass} ml-1 mr-1">${offer.traderName} (LL${offer.level})</span> ${lockedBadge}</div><div class="flex flex-wrap gap-1">${ingredients}</div></div>`;
            });

            let usedInBarterHtml = '';
            if (item.bartersFor && item.bartersFor.length > 0) {
                const list = item.bartersFor.map(b => {
                    const rewards = b.rewardItems.map(r => r.item.name).join(', ');
                    return `<div class="flex justify-between items-center py-1 border-b border-[#333] last:border-0 text-gray-300"><span class="truncate pr-2 text-xs">${rewards}</span><span class="text-[10px] text-gray-500 whitespace-nowrap">${b.trader.name} LL${b.level}</span></div>`;
                }).join('');
                usedInBarterHtml = `<div class="mt-2 bg-[#0f0f0f] border border-[#333] rounded overflow-hidden"><div class="px-2 py-1 bg-[#1a1a1a] border-b border-[#333] flex items-center gap-2"><i class="fa-solid fa-right-left text-[#c084fc]"></i> <span class="font-bold text-[#c084fc] text-xs">USED IN BARTER</span></div><div class="p-2 space-y-1">${list}</div></div>`;
            }

            let usedInCraftHtml = '';
            if (craftUses && craftUses.length > 0) {
                const list = craftUses.map(c => {
                    const products = c.products.map(p => p.item.name).join(', ');
                    return `<div class="flex justify-between items-center py-1 border-b border-[#333] last:border-0 text-gray-300"><span class="truncate pr-2 text-xs">${products}</span><span class="text-[10px] text-gray-500 whitespace-nowrap">${c.station} Lv${c.level}</span></div>`;
                }).join('');
                usedInCraftHtml = `<div class="mt-2 bg-[#0f0f0f] border border-[#333] rounded overflow-hidden"><div class="px-2 py-1 bg-[#1a1a1a] border-b border-[#333] flex items-center gap-2"><i class="fa-solid fa-wrench text-[#60a5fa]"></i> <span class="font-bold text-[#60a5fa] text-xs">USED IN CRAFT</span></div><div class="p-2 space-y-1">${list}</div></div>`;
            }

            card.innerHTML = `
                <div class="flex gap-4 items-center">
                    <div class="w-12 h-12 bg-[#111] border border-[#333] flex items-center justify-center rounded shrink-0 overflow-hidden relative"><img src="${item.iconLink}" loading="lazy" alt="${item.name}" class="w-10 h-10 object-contain absolute" onerror="this.style.display='none'"></div>
                    <div class="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                        <div class="md:col-span-5"><h3 class="font-bold text-tarkov-gold text-sm truncate">${item.name}</h3><div class="mt-1 flex flex-wrap gap-1">${badges}</div></div>
                        <div class="md:col-span-3 text-right md:text-left"><div class="text-sm font-bold font-mono text-tarkov-blue">₽${priceFmt}</div><div class="text-[10px] ${item.changeLast48hPercent >= 0 ? 'text-tarkov-green' : 'text-tarkov-red'}">${item.changeLast48hPercent}% (24h)</div>${craftIndicator}</div>
                        <div class="md:col-span-4 flex justify-end items-center gap-3">${reqMatrix}<i class="fa-solid fa-star text-lg wishlist-star ${isWish ? 'active' : 'text-gray-700'}" onclick="app.toggleWishlist('${item.id}')"></i></div>
                    </div>
                </div>
                <div class="detail-section text-xs text-gray-400 cursor-auto">
                        <div class="grid grid-cols-2 gap-2 mb-3 bg-black/40 p-2 rounded border border-gray-800 text-center"><div><span class="text-[10px] text-gray-500 block">LOW (24h)</span><span class="text-gray-300 font-mono">₽${lowPrice}</span></div><div><span class="text-[10px] text-gray-500 block">HIGH (24h)</span><span class="text-gray-300 font-mono">₽${highPrice}</span></div></div>
                    <div class="space-y-2">
                        ${acquisitionHtml ? `<div class="mt-2"><h4 class="text-xs font-bold text-blue-400 uppercase mb-1 flex items-center gap-2"><i class="fa-solid fa-cart-shopping"></i> ACQUISITION (TRADERS)</h4><div class="space-y-1">${acquisitionHtml}</div></div>` : ''}
                        ${usedInBarterHtml}
                        ${usedInCraftHtml}
                        ${taskListHtml ? `<div class="bg-[#0f0f0f] border border-[#333] rounded overflow-hidden"><div class="px-2 py-1 bg-[#1a1a1a] border-b border-[#333] flex items-center gap-2"><i class="fa-solid fa-scroll text-tarkov-gold"></i> <span class="font-bold text-tarkov-gold">TASKS</span></div><div class="p-2 space-y-1">${taskListHtml}</div></div>` : ''}
                        ${hideoutListHtml ? `<div class="bg-[#0f0f0f] border border-[#333] rounded overflow-hidden"><div class="px-2 py-1 bg-[#1a1a1a] border-b border-[#333] flex items-center gap-2"><i class="fa-solid fa-dungeon text-tarkov-green"></i> <span class="font-bold text-tarkov-green">HIDEOUT</span></div><div class="p-2 space-y-1">${hideoutListHtml}</div></div>` : ''}
                    </div>
                    <div class="mt-4 flex justify-center bg-black/20 p-2 rounded border border-[#333]"><img src="${item.gridImageLink}" loading="lazy" alt="${item.name} grid image" class="max-w-full max-h-32 object-contain drop-shadow-lg" onerror="this.style.display='none'"></div>
                    <div class="text-center italic text-gray-600 pt-2 mt-2 border-t border-gray-800">Tap to close details</div>
                </div>
            `;
            grid.appendChild(card);
        });
    },

    renderCrafts() {
        const grid = document.getElementById('crafts-grid');
        if(!grid) return;
        grid.innerHTML = '';
        
        const searchInput = document.getElementById('craft-search');
        const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const st = this.data.marketConfig.station;
        const filters = this.data.marketConfig.craftFilters;

        let results = this.data.crafts;

        if (st !== 'all') results = results.filter(c => c.station.name.includes(st));

        if (search.length > 0) {
            results = results.filter(c => {
                const rewardMatch = c.rewardItems.some(r => r && r.item && (r.item.name.toLowerCase().includes(search) || (r.item.shortName && r.item.shortName.toLowerCase().includes(search))));
                const ingredientMatch = c.requiredItems.some(req => req && req.item && (req.item.name.toLowerCase().includes(search) || (req.item.shortName && req.item.shortName.toLowerCase().includes(search))));
                return rewardMatch || ingredientMatch;
            });
        }

        if (filters.task || filters.hideout || filters.barter || filters.craft) {
            results = results.filter(c => {
                return c.rewardItems.some(r => {
                    if (!r || !r.item) return false;
                    const marketItem = this.data.marketItems.find(mi => mi.id === r.item.id);
                    if (!marketItem) return false;
                    const req = marketItem.reqData || { remaining: { task: 0, hideout: 0 } };
                    const taskMatch = filters.task && req.remaining.task > 0;
                    const hideoutMatch = filters.hideout && req.remaining.hideout > 0;
                    const barterMatch = filters.barter && (marketItem.bartersFor && marketItem.bartersFor.length > 0);
                    const craftMatch = filters.craft && this.data.craftMap.has(marketItem.id);
                    if (filters.task && !taskMatch) return false;
                    if (filters.hideout && !hideoutMatch) return false;
                    if (filters.barter && !barterMatch) return false;
                    if (filters.craft && !craftMatch) return false;
                    return true;
                });
            });
        }

        this.safeUpdateText('craft-result-count', `${results.length} RECIPES`);
        if(results.length === 0) { grid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-10">NO CRAFTS FOUND</div>'; return; }

        results.slice(0, 50).forEach(craft => {
            const profitFmt = Math.round(craft.profit).toLocaleString();
            const costFmt = Math.round(craft.cost).toLocaleString();
            
            const mainReward = craft.rewardItems[0];
            let reqBadges = '';
            if (mainReward && mainReward.item) {
                const mItem = this.data.marketItems.find(mi => mi.id === mainReward.item.id);
                if(mItem) {
                    const req = mItem.reqData;
                    if(req && req.remaining.task > 0) reqBadges += `<span class="req-badge req-quest"><i class="fa-solid fa-scroll"></i></span>`;
                    if(req && req.remaining.hideout > 0) reqBadges += `<span class="req-badge req-hideout"><i class="fa-solid fa-hammer"></i></span>`;
                }
            }

            const rewards = craft.rewardItems.map(r => {
                if(!r || !r.item) return '';
                return `<div class="flex items-center gap-2 mb-1"><img src="${r.item.iconLink}" loading="lazy" alt="${r.item.name}" class="w-6 h-6 bg-[#222] rounded" onerror="this.style.display='none'"><span class="text-tarkov-gold font-bold text-xs truncate">${r.item.name} x${r.count}</span> ${reqBadges}</div>`;
            }).join('');
            
            // Detailed Requirements rendering with source info
            const reqs = craft.requiredItems.map(r => {
                if(!r || !r.item) return '';
                const bestPrice = this.getBestPrice(r.item.id);
                const sourceClass = bestPrice.source === 'trader' ? 'cost-source-trader' : 'cost-source-flea';
                const vendorText = bestPrice.source === 'trader' ? `<i class="fa-solid fa-shop"></i> ${bestPrice.vendor}` : `<i class="fa-solid fa-people-arrows"></i> Flea`;
                
                return `
                <div class="flex justify-between items-center text-[10px] text-gray-400 border-b border-[#222] py-1 last:border-0">
                    <div class="flex items-center gap-2 truncate flex-1">
                        <span>${r.item.name}</span>
                        <span class="text-gray-600">x${r.count}</span>
                    </div>
                    <div class="text-right">
                        <span class="block ${sourceClass}">${vendorText}</span>
                        <span class="font-mono text-[9px]">₽${(bestPrice.price * r.count).toLocaleString()}</span>
                    </div>
                </div>`;
            }).join('');

            const card = document.createElement('div');
            card.className = 'tarkov-panel rounded p-3 flex flex-col relative border-l-4 ' + (craft.profit >= 0 ? 'border-l-green-600' : 'border-l-red-600');
            card.innerHTML = `<div class="flex justify-between items-start mb-2"><span class="text-[10px] uppercase font-bold text-gray-500 tracking-wider">${craft.station.name} Lv${craft.level}</span><div class="text-right"><span class="block text-xs text-gray-500">PROFIT</span><span class="font-bold font-mono text-lg ${craft.profit >= 0 ? 'profit-pos' : 'profit-neg'}">₽${profitFmt}</span></div></div><div class="mb-3">${rewards}</div><div class="bg-[#111] p-2 rounded border border-[#333]"><div class="flex justify-between text-[10px] text-gray-500 mb-1 border-b border-[#333] pb-1"><span>INGREDIENTS (Best Source)</span><span>COST: ₽${costFmt}</span></div><div class="max-h-32 overflow-y-auto custom-scrollbar">${reqs}</div></div>`;
            grid.appendChild(card);
        });
    },

    // --- Wishlist ---
    loadWishlist() { const s = localStorage.getItem('userWishlist'); if (s) { try { this.data.wishlist = new Set(JSON.parse(s)); } catch(e) { this.data.wishlist = new Set(); } } },
    saveWishlist() { localStorage.setItem('userWishlist', JSON.stringify([...this.data.wishlist])); },
    toggleWishlist(id) {
        if (this.data.wishlist.has(id)) this.data.wishlist.delete(id);
        else this.data.wishlist.add(id);
        this.saveWishlist();
        this.renderMarket();
        this.renderWishlist();
    },
    renderWishlist() {
        const grid = document.getElementById('wishlist-grid');
        if(!grid) return;
        const countEl = document.getElementById('wishlist-count');
        
        if(this.data.wishlist.size === 0) {
            grid.innerHTML = '<div class="text-center text-gray-500 py-10">No items in wishlist. Add items from Market.</div>';
            countEl.innerText = "0 Items";
            return;
        }

        const items = this.data.marketItems.filter(i => this.data.wishlist.has(i.id));
        countEl.innerText = `${items.length} Items`;
        
        grid.innerHTML = '';
        items.forEach(item => {
            const priceFmt = item.avg24hPrice.toLocaleString();
            const lowPrice = item.low24hPrice ? item.low24hPrice.toLocaleString() : '---';
            const highPrice = item.high24hPrice ? item.high24hPrice.toLocaleString() : '---';

            const card = document.createElement('div');
            card.className = 'tarkov-panel rounded p-3 flex items-center justify-between border border-tarkov-border hover:border-tarkov-gold transition';
            card.innerHTML = `
                <div class="flex items-center gap-3">
                    <img src="${item.iconLink}" loading="lazy" alt="${item.name}" class="w-10 h-10 bg-black rounded border border-gray-800" onerror="this.style.display='none'">
                    <div>
                        <h3 class="font-bold text-tarkov-gold text-sm">${item.name}</h3>
                        <div class="text-[10px] text-gray-500">
                            Min: ₽${lowPrice} / Max: ₽${highPrice}
                        </div>
                    </div>
                </div>
                <div class="text-right flex items-center gap-4">
                    <div>
                        <div class="text-[9px] text-gray-500 uppercase">AVG PRICE</div>
                        <div class="text-lg font-bold font-mono text-tarkov-blue">₽${priceFmt}</div>
                    </div>
                    <button onclick="app.toggleWishlist('${item.id}')" class="text-red-500 hover:text-red-400 p-2"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            `;
            grid.appendChild(card);
        });
    }
});