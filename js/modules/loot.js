// Loot Manager Module - Ver 1.0

Object.assign(window.app, {
    lootProgress: {}, // itemID: currentCount

    renderLootManager() {
        const container = document.getElementById('loot-manager-area');
        if (!container) return;

        this.loadLootProgress();
        const requirements = this.getAggregatedRequirements();

        if (requirements.length === 0) {
            container.innerHTML = `
            <div class="py-20 text-center opacity-30">
                <i class="fa-solid fa-clipboard-check text-6xl mb-4"></i>
                <p class="text-lg font-bold">NO PENDING REQUIREMENTS</p>
                <p class="text-sm">All active tasks and hideout upgrades are supplied.</p>
            </div>`;
            return;
        }

        let html = `
        <div class="space-y-6 animate-fade-in">
            <!-- Summary Stats -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="glass-panel p-4 rounded bg-tarkov-orange/10 border-tarkov-orange/20">
                    <div class="text-[10px] text-gray-500 uppercase font-bold">Total Unique Items</div>
                    <div class="text-2xl font-bold text-white">${requirements.length}</div>
                </div>
                <div class="glass-panel p-4 rounded bg-black/40 border-gray-800">
                    <div class="text-[10px] text-gray-500 uppercase font-bold">Task Specific</div>
                    <div class="text-2xl font-bold text-tarkov-gold">${requirements.filter(r => r.sourceType === 'task').length}</div>
                </div>
                <div class="glass-panel p-4 rounded bg-black/40 border-gray-800">
                    <div class="text-[10px] text-gray-500 uppercase font-bold">Hideout Specific</div>
                    <div class="text-2xl font-bold text-tarkov-green">${requirements.filter(r => r.sourceType === 'hideout').length}</div>
                </div>
            </div>

            <!-- Loot Table -->
            <div class="glass-panel rounded overflow-hidden border border-gray-800">
                <table class="w-full text-left text-sm">
                    <thead class="bg-black/60 text-[10px] text-gray-500 uppercase tracking-wider border-b border-gray-800">
                        <tr>
                            <th class="px-4 py-3">Item Info</th>
                            <th class="px-4 py-3">Progress</th>
                            <th class="px-4 py-3">Destination</th>
                            <th class="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-800/50">
                        ${requirements.map(req => this.renderLootRow(req)).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;

        container.innerHTML = html;
    },

    renderLootRow(req) {
        const current = this.lootProgress[req.id] || 0;
        const remaining = Math.max(0, req.totalCount - current);
        const isDone = remaining === 0;

        const priceInfo = this.getBestPrice ? this.getBestPrice(req.id) : { price: 0, vendor: '---', source: 'unknown' };
        const priceFmt = priceInfo.price > 0 ? `₽${priceInfo.price.toLocaleString()}` : '---';
        const vendorClass = priceInfo.source === 'trader' ? 'text-tarkov-green' : (priceInfo.source === 'flea' ? 'text-tarkov-orange' : 'text-gray-500');

        return `
        <tr class="hover:bg-white/5 transition-colors ${isDone ? 'opacity-40 grayscale' : ''}">
            <td class="px-4 py-4">
                <div class="flex items-center gap-3">
                    <img src="${req.icon || ''}" class="w-8 h-8 object-contain bg-black/40 rounded border border-gray-700" onerror="this.style.display='none'">
                    <div>
                        <div class="font-bold text-gray-200">${req.name}</div>
                        <div class="flex flex-wrap items-center gap-2 mt-1">
                            <span class="font-mono text-xs text-tarkov-blue font-bold">${priceFmt}</span>
                            <span class="text-[9px] ${vendorClass} uppercase border border-gray-700 px-1 rounded">${priceInfo.vendor}</span>
                            ${req.fir ? '<span class="text-[9px] bg-tarkov-green/20 text-tarkov-green px-1 rounded border border-tarkov-green/30 font-bold">FIR</span>' : ''}
                        </div>
                    </div>
                </div>
            </td>
            <td class="px-4 py-4">
                <div class="flex items-center gap-3">
                    <div class="flex-1 min-w-[100px] h-1.5 bg-black/60 rounded-full overflow-hidden border border-gray-800">
                        <div class="h-full ${isDone ? 'bg-tarkov-green' : 'bg-tarkov-orange'} transition-all" style="width: ${(current / req.totalCount) * 100}%"></div>
                    </div>
                    <div class="text-xs font-mono text-gray-400">
                        <span class="${isDone ? 'text-tarkov-green' : 'text-white'}">${current}</span>/${req.totalCount}
                    </div>
                </div>
            </td>
            <td class="px-4 py-4">
                <div class="space-y-1">
                    ${req.sources.map(s => `
                        <div class="text-xs flex items-center gap-2">
                            <i class="fa-solid ${s.type === 'task' ? 'fa-scroll text-tarkov-gold' : 'fa-hammer text-tarkov-green'} opacity-70"></i>
                            <span class="text-gray-300">${s.name}</span>
                            <span class="text-tarkov-gold font-bold font-mono">x${s.count}</span>
                        </div>
                    `).join('')}
                </div>
            </td>
            <td class="px-4 py-4 text-right">
                <div class="flex justify-end gap-1">
                    <button onclick="app.updateLootCount('${req.id}', -1)" class="w-6 h-6 flex items-center justify-center bg-gray-800 rounded hover:bg-gray-700 text-gray-400">-</button>
                    <button onclick="app.updateLootCount('${req.id}', 1)" class="w-6 h-6 flex items-center justify-center bg-gray-800 rounded hover:bg-gray-700 text-white">+</button>
                    <button onclick="app.updateLootCount('${req.id}', ${req.totalCount - current})" class="ml-2 px-2 py-1 text-[9px] bg-tarkov-green/10 text-tarkov-green border border-tarkov-green/20 rounded hover:bg-tarkov-green/20">MAX</button>
                </div>
            </td>
        </tr>`;
    },

    getAggregatedRequirements() {
        const items = {}; // id -> { id, name, icon, fir, totalCount, sources: [{type, name, count}] }

        // 1. Scan Tasks (Active Only)
        this.data.tasks.forEach(t => {
            if (t.completed || !this.isTaskAvailable(t)) return;
            
            // Temporary map to aggregate items WITHIN this task
            const taskItems = {}; 

            t.objectives.forEach(obj => {
                if (obj.item && (obj.type === 'giveItem' || obj.type === 'findItem' || obj.type === 'handoverItem')) {
                    const id = obj.item.id;
                    // If multiple objectives for same item in one task, take the max count
                    if (!taskItems[id] || obj.count > taskItems[id].count) {
                        taskItems[id] = { 
                            id, 
                            name: obj.item.name, 
                            icon: obj.item.gridImageLink || obj.item.iconLink, 
                            fir: obj.foundInRaid || false, 
                            count: obj.count 
                        };
                    }
                }
            });

            // Add this task's unique requirements to the global list
            Object.values(taskItems).forEach(req => {
                if (!items[req.id]) {
                    items[req.id] = { id: req.id, name: req.name, icon: req.icon, fir: req.fir, totalCount: 0, sources: [], sourceType: 'task' };
                }
                items[req.id].totalCount += req.count;
                items[req.id].sources.push({ type: 'task', name: t.name, count: req.count });
                // If any objective for this item requires FIR, mark the whole requirement as FIR
                if (req.fir) items[req.id].fir = true;
            });
        });

        // 2. Scan Hideout (Next Level Only)
        this.data.hideoutStationsRaw.forEach(station => {
            const currentLevel = this.data.userHideoutLevels[station.id] || 0;
            const nextLevelData = station.levels.find(l => l.level === currentLevel + 1);
            
            if (nextLevelData) {
                // Check Requirements (Trader & Station)
                let isConstructible = true;

                // Trader Requirements Check
                if (nextLevelData.traderRequirements) {
                    for (const req of nextLevelData.traderRequirements) {
                        const userTraderLevel = this.data.config.traderLevels[req.trader.name] || 1;
                        if (userTraderLevel < req.level) {
                            isConstructible = false;
                            break;
                        }
                    }
                }

                // Station Requirements Check
                if (isConstructible && nextLevelData.stationLevelRequirements) {
                    for (const req of nextLevelData.stationLevelRequirements) {
                        const userStationLevel = this.data.userHideoutLevels[req.station.id] || 0;
                        if (userStationLevel < req.level) {
                            isConstructible = false;
                            break;
                        }
                    }
                }

                if (isConstructible && nextLevelData.itemRequirements) {
                    nextLevelData.itemRequirements.forEach(req => {
                        const id = req.item.id;
                        if (!items[id]) {
                            items[id] = { id, name: req.item.name, icon: req.item.iconLink, fir: false, totalCount: 0, sources: [], sourceType: 'hideout' };
                        } else if (items[id].sourceType === 'task') {
                            items[id].sourceType = 'mixed';
                        }
                        items[id].totalCount += req.count;
                        items[id].sources.push({ type: 'hideout', name: station.name, count: req.count });
                    });
                }
            }
        });

        return Object.values(items).sort((a, b) => b.totalCount - a.totalCount);
    },

    updateLootCount(itemId, delta) {
        if (!this.lootProgress[itemId]) this.lootProgress[itemId] = 0;
        this.lootProgress[itemId] = Math.max(0, this.lootProgress[itemId] + delta);
        this.saveLootProgress();
        this.renderLootManager();
    },

    loadLootProgress() {
        const saved = localStorage.getItem('lootCollectionProgress');
        this.lootProgress = saved ? JSON.parse(saved) : {};
    },

    saveLootProgress() {
        localStorage.setItem('lootCollectionProgress', JSON.stringify(this.lootProgress));
    }
});
