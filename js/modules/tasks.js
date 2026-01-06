// Task Database Logic

Object.assign(window.app, {
    processTaskMetaData() {
        // Manual Patch for Missing API Data
        const kappaManualList = ['Grenadier', 'The Punisher - Part 6', 'Test Drive - Part 1'];
        const lightkeeperManualList = [];

        this.data.tasks.forEach(t => {
            if (kappaManualList.includes(t.name)) t.kappaRequired = true;
            if (lightkeeperManualList.includes(t.name)) t.lightkeeperRequired = true;
        });

        const traderSet = new Set();
        const mapSet = new Set();
        this.data.tasks.forEach(t => {
            if(t.trader?.name) traderSet.add(t.trader.name);
            if(t.map?.name) mapSet.add(t.map.name);
        });
        const trSelect = document.getElementById('filter-trader');
        if(trSelect) trSelect.innerHTML = '<option value="all">全トレーダー</option>' + Array.from(traderSet).sort().map(t => `<option value="${t}">${t}</option>`).join('');
        const mapSelect = document.getElementById('filter-map');
        if(mapSelect) mapSelect.innerHTML = '<option value="all">全マップ</option>' + Array.from(mapSet).sort().map(m => `<option value="${m}">${m}</option>`).join('');
    },

    isTaskAvailable(t) {
        if (!t) return false;
        
        // 1. Level Check
        if (t.minPlayerLevel && this.data.config.playerLevel < t.minPlayerLevel) return false;

        // 2. Trader LL Check
        if (t.traderRequirements && t.traderRequirements.length > 0) {
            for (const req of t.traderRequirements) {
                const currentLL = this.data.config.traderLevels[req.trader.name] || 1;
                if (currentLL < req.level) return false;
            }
        }

        // 3. Prerequisite Tasks Check
        if (t.taskRequirements && t.taskRequirements.length > 0) {
            for (const req of t.taskRequirements) {
                const preTask = this.data.tasks.find(pt => pt.id === req.task.id);
                if (preTask && !preTask.completed) return false;
            }
        }

        return true;
    },

    renderTasks() {
        const searchInput = document.getElementById('task-search');
        const search = searchInput ? searchInput.value.toLowerCase() : '';
        const trader = document.getElementById('filter-trader')?.value || 'all';
        const map = document.getElementById('filter-map')?.value || 'all';
        const type = document.getElementById('filter-type')?.value || 'all';
        const statusFilter = document.getElementById('filter-status')?.value || 'active';
        const sortBy = document.getElementById('sort-by')?.value || 'minPlayerLevel';

        let filtered = this.data.tasks.filter(t => {
            const searchTargets = [ 
                t.name, 
                t.map?.name || '', 
                t.trader?.name || '', 
                ...(t.objectives?.map(o => o.description) || []), 
                ...(t.startRewards?.items?.map(i => i.item.name) || []), 
                ...(t.finishRewards?.items?.map(i => i.item.name) || []),
                ...(t.finishRewards?.offerUnlock?.map(u => u.item.name) || []),
                ...(t.finishRewards?.craftUnlock?.flatMap(c => c.rewardItems.map(r => r.item.name)) || []),
                (t.finishRewards?.offerUnlock?.length > 0 || t.finishRewards?.craftUnlock?.length > 0) ? 'unlock アンロック' : ''
            ].map(s => (s || '').toLowerCase());
            const mSearch = searchTargets.some(s => s.includes(search));
            const mTrader = trader === 'all' || t.trader?.name === trader;
            const mMap = map === 'all' || t.map?.name === map; 
            let mType = true;
            if (type === 'kappa') mType = t.kappaRequired;
            if (type === 'lightkeeper') mType = t.lightkeeperRequired;

            // Status Filtering
            const isAvailable = this.isTaskAvailable(t);
            let mStatus = true;
            if (statusFilter === 'active') mStatus = isAvailable && !t.completed;
            else if (statusFilter === 'completed') mStatus = t.completed;
            else if (statusFilter === 'all') mStatus = true;

            return mSearch && mTrader && mMap && mType && mStatus;
        });
        filtered.sort((a, b) => {
            let valA, valB;
            if (sortBy === 'trader') { valA = a.trader?.name || ''; valB = b.trader?.name || ''; } 
            else if (sortBy === 'name') { valA = a.name; valB = b.name; } 
            else { valA = a.minPlayerLevel || 0; valB = b.minPlayerLevel || 0; }
            if (typeof valA === 'string') return valA.localeCompare(valB);
            return valA - valB;
        });

        const list = document.getElementById('task-list');
        if (filtered.length === 0) { list.innerHTML = `<div class="text-center text-gray-500 py-10">No tasks match your criteria.</div>`; return; }

        list.innerHTML = filtered.slice(0, search ? 150 : 80).map(t => {
            const isAvailable = this.isTaskAvailable(t);
            let rewardsHtml = '';
            const processRew = (rew, type) => {
                if(!rew) return '';
                let html = '';
                if(rew.traderStanding) rew.traderStanding.forEach(r => html += `<li>${r.trader.name}: ${r.standing}</li>`);
                if(rew.items) rew.items.forEach(i => html += `<li class="flex items-center gap-2 mb-1"><img src="${i.item.gridImageLink || ''}" loading="lazy" class="w-5 h-5 object-contain bg-black/50 rounded" onerror="this.style.display='none'"><span>${i.item.name} x${i.count}</span></li>`);
                
                // Craft Unlocks
                if(rew.craftUnlock) rew.craftUnlock.forEach(c => {
                    const products = c.rewardItems.map(r => r.item.name).join(', ');
                    const icon = c.rewardItems[0]?.item.iconLink || '';
                    html += `<li class="flex items-center gap-2 mb-1 text-blue-400">
                                <i class="fa-solid fa-gears opacity-70"></i>
                                <img src="${icon}" loading="lazy" class="w-5 h-5 object-contain bg-black/50 rounded" onerror="this.style.display='none'">
                                <span>Unlock Craft: ${products} (${c.station.name} Lvl ${c.level})</span>
                             </li>`;
                });

                // Trader Unlocks (Purchase Offers)
                if(rew.offerUnlock) rew.offerUnlock.forEach(u => {
                    html += `<li class="flex items-center gap-2 mb-1 text-tarkov-gold">
                                <i class="fa-solid fa-cart-shopping opacity-70"></i>
                                <img src="${u.item.iconLink}" loading="lazy" class="w-5 h-5 object-contain bg-black/50 rounded" onerror="this.style.display='none'">
                                <span>Unlock Purchase: ${u.item.name} (${u.trader.name} LL${u.level})</span>
                             </li>`;
                });

                return html ? `<div class="mt-2"><h4 class="text-xs font-bold text-gray-500 uppercase">${type}</h4><ul class="list-none text-xs text-gray-400">${html}</ul></div>` : '';
            };
            rewardsHtml += processRew(t.startRewards, 'Start Rewards');
            rewardsHtml += processRew(t.finishRewards, 'Finish Rewards');
            
            let sherpaData = this.consts.sherpaIntelDB[t.name];
            let sherpaAdvice = "";
            if (sherpaData) {
                sherpaAdvice = sherpaData.desc || sherpaData;
                if(sherpaData.tips && sherpaData.tips.length > 0) { sherpaAdvice += `<ul class="list-none mt-2 space-y-1">${sherpaData.tips.map(tip => `<li class="text-xs text-blue-300"><i class="fa-solid fa-angle-right mr-1"></i>${tip}</li>`).join('')}</ul>`; }
            } else { sherpaAdvice = "No specific advice available."; }

            let lockReason = "";
            if (!isAvailable && !t.completed) {
                const reasons = [];
                if (t.minPlayerLevel && this.data.config.playerLevel < t.minPlayerLevel) reasons.push(`Lvl ${t.minPlayerLevel}`);
                if (t.traderRequirements) t.traderRequirements.forEach(r => {
                    if ((this.data.config.traderLevels[r.trader.name] || 1) < r.level) reasons.push(`${r.trader.name} LL${r.level}`);
                });
                if (t.taskRequirements) t.taskRequirements.forEach(r => {
                    const pt = this.data.tasks.find(x => x.id === r.task.id);
                    if (pt && !pt.completed) reasons.push(`Pre: ${pt.name}`);
                });
                lockReason = reasons.length > 0 ? `<div class="text-[10px] text-red-400/80 mt-1"><i class="fa-solid fa-lock mr-1"></i>Req: ${reasons.join(', ')}</div>` : "";
            }

            return `
            <div class="glass-panel rounded overflow-hidden border-l-2 ${t.completed ? 'border-tarkov-green opacity-60' : (!isAvailable ? 'border-red-900/50 opacity-50' : (t.kappaRequired ? 'border-tarkov-accent' : 'border-gray-600'))}">
                <button class="task-accordion-header w-full text-left p-3 flex flex-col sm:flex-row sm:items-center gap-2 cursor-pointer hover:bg-white/5" aria-expanded="false" data-task-id="${t.id}" onclick="app.toggleTaskAccordion(this)">
                    <input type="checkbox" class="form-checkbox h-4 w-4 text-tarkov-accent rounded border-gray-600 bg-gray-700 focus:ring-tarkov-accent" onclick="event.stopPropagation(); app.toggleTaskCompleted('${t.id}')" ${t.completed ? 'checked' : ''}>
                    <div class="flex-1">
                        <div class="text-[10px] text-gray-500 uppercase flex items-center gap-2"><span>${t.trader?.name}</span>${t.minPlayerLevel ? '<span class="bg-gray-800 px-1 rounded">Lvl '+t.minPlayerLevel+'</span>' : ''}</div>
                        <div class="font-bold text-sm ${t.completed ? 'text-gray-500 line-through' : 'text-gray-200'}">${t.name}</div>
                        <div class="text-xs text-gray-500"><i class="fa-solid fa-map-location-dot mr-1"></i>${t.map?.name || 'Any'}</div>
                        ${lockReason}
                    </div>
                    <div class="flex items-center gap-3 mt-2 sm:mt-0">
                        ${t.kappaRequired ? '<span class="px-2 py-0.5 bg-yellow-900/40 text-tarkov-accent text-[10px] font-bold rounded border border-yellow-800/50">KAPPA</span>' : ''}
                        ${t.lightkeeperRequired ? '<span class="px-2 py-0.5 bg-blue-900/40 text-blue-400 text-[10px] font-bold rounded border border-blue-800/50">LIGHTKEEPER</span>' : ''}
                        <i class="task-accordion-icon fa-solid fa-chevron-down transform transition-transform duration-300 ml-auto"></i>
                    </div>
                </button>
                <div class="task-accordion-content overflow-hidden max-h-0 transition-all duration-300 ease-in-out bg-black/20">
                    <div class="p-4 border-t border-gray-800 space-y-4">
                        <div><h3 class="text-xs font-bold text-gray-400 uppercase mb-2">Objectives</h3><ul class="list-disc pl-4 space-y-1 text-sm text-gray-300">${t.objectives?.map(o => `<li>${o.description}</li>`).join('') || '<li>Check wiki</li>'}</ul></div>
                        ${rewardsHtml}
                        <div class="bg-blue-900/10 border-l-4 border-blue-600 p-3">
                            <h3 class="text-xs font-bold text-blue-400 uppercase mb-1">Sherpa Advice</h3>
                            <div class="text-sm text-gray-300 leading-relaxed">${sherpaAdvice}</div>
                        </div>
                        <div class="pt-2"><a href="${t.wikiLink || '#'}" target="_blank" class="text-sm text-tarkov-accent hover:underline flex items-center gap-2">Wiki Link <i class="fa-solid fa-external-link-alt"></i></a></div>
                    </div>
                </div>
            </div>`;
        }).join('');
    },

    toggleTaskAccordion(header) {
        const content = header.nextElementSibling;
        const icon = header.querySelector('.task-accordion-icon');
        if (content.style.maxHeight) { 
            content.style.maxHeight = null; 
            icon.classList.remove('rotate-180');
            header.setAttribute('aria-expanded', 'false');
        } else { 
            content.style.maxHeight = content.scrollHeight + "px"; 
            icon.classList.add('rotate-180');
            header.setAttribute('aria-expanded', 'true');
        }
    },

    toggleTaskCompleted(taskId) {
        const idx = this.data.tasks.findIndex(t => t.id === taskId);
        if (idx !== -1) {
            this.data.tasks[idx].completed = !this.data.tasks[idx].completed;
            this.saveTaskCompletionStatus();
            this.calculateAllRequirements(); 
            this.renderTasks();
            if(typeof this.renderLootManager === 'function') this.renderLootManager();
            if(!document.getElementById('view-market').classList.contains('hidden')) { this.renderMarket(); }
        }
    },

    loadTaskCompletionStatus() {
        const key = this.getCompletionStorageKey();
        const s = localStorage.getItem(key);
        if (s) { 
            const map = JSON.parse(s); 
            this.data.tasks.forEach(t => t.completed = map[t.id] || false); 
        } else {
            // Reset completion if no data for this mode
            this.data.tasks.forEach(t => t.completed = false);
        }
    },
    
    saveTaskCompletionStatus() {
        const map = {}; 
        this.data.tasks.forEach(t => { if(t.completed) map[t.id] = true; });
        localStorage.setItem(this.getCompletionStorageKey(), JSON.stringify(map));
    },

    getCompletionStorageKey() {
        return `taskCompletionStatus_${this.data.config.gameMode || 'pve'}`;
    },

    openTask(taskId) {
        this.switchTab('tasks');
        
        // Reset filters to ensure the task is visible
        const searchInput = document.getElementById('task-search');
        if(searchInput) searchInput.value = '';
        
        const traderFilter = document.getElementById('filter-trader');
        if(traderFilter) traderFilter.value = 'all';
        
        const mapFilter = document.getElementById('filter-map');
        if(mapFilter) mapFilter.value = 'all';

        // Render tasks first
        this.renderTasks();

        // Find and expand the task
        setTimeout(() => {
            const header = document.querySelector(`.task-accordion-header[data-task-id="${taskId}"]`);
            if (header) {
                // Scroll to the task
                header.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Expand if not already expanded
                if (header.getAttribute('aria-expanded') !== 'true') {
                    this.toggleTaskAccordion(header);
                }
                // Highlight effect
                header.parentElement.classList.add('border-tarkov-gold');
                setTimeout(() => header.parentElement.classList.remove('border-tarkov-gold'), 2000);
            } else {
                this.showToast("Task not found or filtered out.");
            }
        }, 300); // Slight delay to allow DOM update
    }
});