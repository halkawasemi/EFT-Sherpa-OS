// Task Database Logic

Object.assign(window.app, {
    expandedTasks: new Set(),
    activeInputId: null,

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
                if(rew.experience) html += `<li class="flex items-center gap-2 mb-1 text-tarkov-accent"><i class="fa-solid fa-star opacity-70"></i><span>${rew.experience} XP</span></li>`;
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
            
            const renderObjectives = () => {
                if (!t.objectives || t.objectives.length === 0) return '<li>Check wiki</li>';
                return t.objectives.map((o, idx) => {
                    const prog = (t.objectiveProgress && t.objectiveProgress[o.id || idx]) || { completed: false, count: 0 };
                    
                    // Count Fallback: If o.count is missing, try to extract from description
                    let requiredCount = o.count || 1;
                    if (!o.count && o.description) {
                        const match = o.description.match(/(\d+)\s*(PMC|Scav|Operat|kill|Eliminate|hand in|x)/i) || o.description.match(/(Eliminate|Kill|Hand in)\s+(\d+)/i);
                        if (match) {
                            const num = parseInt(match[1]) || parseInt(match[2]);
                            if (num) requiredCount = num;
                        }
                    }

                    const isCompleted = prog.completed || (t.completed);
                    
                    return `
                    <li class="flex items-start gap-3 p-2 rounded hover:bg-white/5 transition-colors group" onclick="event.stopPropagation()">
                        <input type="checkbox" 
                               class="mt-1 form-checkbox h-4 w-4 text-tarkov-accent rounded border-gray-600 bg-gray-700 focus:ring-tarkov-accent" 
                               onclick="event.stopPropagation(); app.toggleObjectiveProgress('${t.id}', '${o.id || idx}')" 
                               ${isCompleted ? 'checked' : ''}>
                        <div class="flex-1 min-w-0" onclick="event.stopPropagation()">
                            <div class="text-sm ${isCompleted ? 'text-gray-500 line-through' : 'text-gray-300'}">${o.description}</div>
                            ${requiredCount > 1 || (o.type === 'item' || o.type === 'playerKills' || o.type === 'bossKills' || (o.description && (o.description.includes('Eliminate') || o.description.includes('Kill')))) ? `
                            <div class="flex items-center gap-2 mt-1" onclick="event.stopPropagation()">
                                <div class="flex items-center bg-black/40 rounded border border-gray-700 px-1" onclick="event.stopPropagation()">
                                    <input type="number" 
                                           id="obj-input-${t.id}-${o.id || idx}"
                                           class="w-12 bg-transparent border-none text-[10px] text-tarkov-accent focus:ring-0 p-0 text-center" 
                                           value="${prog.count || 0}" 
                                           min="0" max="${requiredCount}"
                                           onchange="app.updateObjectiveCount('${t.id}', '${o.id || idx}', this.value)"
                                           onfocus="app.activeInputId = this.id"
                                           onblur="setTimeout(() => { if(app.activeInputId === 'obj-input-${t.id}-${o.id || idx}') app.activeInputId = null; }, 100);"
                                           onclick="event.stopPropagation()">
                                    <span class="text-[10px] text-gray-500 mr-1">/ ${requiredCount}</span>
                                </div>
                                <div class="h-1 flex-1 bg-gray-800 rounded-full overflow-hidden">
                                    <div class="h-full bg-tarkov-accent/50 transition-all duration-300" style="width: ${(Math.min(prog.count || 0, requiredCount) / requiredCount) * 100}%"></div>
                                </div>
                            </div>
                            ` : ''}
                        </div>
                    </li>`;
                }).join('');
            };

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
                <div class="task-accordion-header w-full text-left p-3 flex flex-col sm:flex-row sm:items-center gap-2 cursor-pointer hover:bg-white/5" aria-expanded="false" data-task-id="${t.id}" onclick="app.toggleTaskAccordion(this)">
                    <div class="flex items-center gap-2 shrink-0" onclick="event.stopPropagation()">
                        <input type="checkbox" class="form-checkbox h-4 w-4 text-tarkov-accent rounded border-gray-600 bg-gray-700 focus:ring-tarkov-accent" onclick="event.stopPropagation(); app.toggleTaskCompleted('${t.id}')" ${t.completed ? 'checked' : ''}>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="text-[10px] text-gray-500 uppercase flex items-center gap-2"><span>${t.trader?.name}</span>${t.minPlayerLevel ? '<span class="bg-gray-800 px-1 rounded">Lvl '+t.minPlayerLevel+'</span>' : ''}</div>
                        <div class="font-bold text-sm truncate ${t.completed ? 'text-gray-500 line-through' : 'text-gray-200'}">${t.name}</div>
                        <div class="text-xs text-gray-500"><i class="fa-solid fa-map-location-dot mr-1"></i>${t.map?.name || 'Any'}</div>
                        ${lockReason}
                    </div>
                    <div class="flex items-center gap-3 mt-2 sm:mt-0 ml-auto shrink-0">
                        ${t.kappaRequired ? '<span class="px-2 py-0.5 bg-yellow-900/40 text-tarkov-accent text-[10px] font-bold rounded border border-yellow-800/50">KAPPA</span>' : ''}
                        ${t.lightkeeperRequired ? '<span class="px-2 py-0.5 bg-blue-900/40 text-blue-400 text-[10px] font-bold rounded border border-blue-800/50">LIGHTKEEPER</span>' : ''}
                        <i class="task-accordion-icon fa-solid fa-chevron-down transform transition-transform duration-300"></i>
                    </div>
                </div>
                <div class="task-accordion-content overflow-hidden max-h-0 transition-all duration-300 ease-in-out bg-black/20" onclick="event.stopPropagation()">
                    <div class="p-4 border-t border-gray-800 space-y-4">
                        <div><h3 class="text-xs font-bold text-gray-400 uppercase mb-2">Objectives</h3><ul class="list-none space-y-2 text-sm text-gray-300">${renderObjectives()}</ul></div>
                        ${rewardsHtml}
                        <div class="bg-blue-900/10 border-l-4 border-blue-600 p-3">
                            <h3 class="text-xs font-bold text-blue-400 uppercase mb-1">Sherpa Advice</h3>
                            <div class="text-sm text-gray-300 leading-relaxed">${sherpaAdvice}</div>
                        </div>
                        <div class="pt-2" onclick="event.stopPropagation()">
                            <a href="${t.wikiLink || '#'}" target="_blank" class="text-sm text-tarkov-accent hover:underline flex items-center gap-2" onclick="event.stopPropagation()">Wiki Link <i class="fa-solid fa-external-link-alt"></i></a>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');

        // 状態の復元 (アコーディオン開閉)
        if (this.expandedTasks && this.expandedTasks.size > 0) {
            this.expandedTasks.forEach(id => {
                const header = list.querySelector(`.task-accordion-header[data-task-id="${id}"]`);
                if (header) {
                    const content = header.nextElementSibling;
                    const icon = header.querySelector('.task-accordion-icon');
                    content.style.maxHeight = content.scrollHeight + "px";
                    icon.classList.add('rotate-180');
                    header.setAttribute('aria-expanded', 'true');
                }
            });
        }

        // 状態の復元 (入力フィールドのフォーカス)
        if (this.activeInputId) {
            const el = document.getElementById(this.activeInputId);
            if (el) el.focus();
        }
    },

    toggleTaskAccordion(header) {
        const content = header.nextElementSibling;
        const icon = header.querySelector('.task-accordion-icon');
        const taskId = header.getAttribute('data-task-id');

        if (content.style.maxHeight) { 
            content.style.maxHeight = null; 
            icon.classList.remove('rotate-180');
            header.setAttribute('aria-expanded', 'false');
            if (this.expandedTasks) this.expandedTasks.delete(taskId);
        } else { 
            content.style.maxHeight = content.scrollHeight + "px"; 
            icon.classList.add('rotate-180');
            header.setAttribute('aria-expanded', 'true');
            if (!this.expandedTasks) this.expandedTasks = new Set();
            this.expandedTasks.add(taskId);
        }
    },

    toggleTaskCompleted(taskId) {
        const idx = this.data.tasks.findIndex(t => t.id === taskId);
        if (idx !== -1) {
            const t = this.data.tasks[idx];
            t.completed = !t.completed;
            
            // If task is completed, mark all objectives as completed (visual sync)
            if (t.completed && t.objectives) {
                if (!t.objectiveProgress) t.objectiveProgress = {};
                t.objectives.forEach((o, i) => {
                    const id = o.id || i;
                    if (!t.objectiveProgress[id]) t.objectiveProgress[id] = { completed: true, count: o.count || 1 };
                    else t.objectiveProgress[id].completed = true;
                });
            }

            this.saveTaskCompletionStatus();
            this.calculateAllRequirements(); 
            this.renderTasks();
            if(typeof this.renderLootManager === 'function') this.renderLootManager();
            if(!document.getElementById('view-market').classList.contains('hidden')) { this.renderMarket(); }
        }
    },

    toggleObjectiveProgress(taskId, objId) {
        const t = this.data.tasks.find(x => x.id === taskId);
        if (!t) return;
        
        if (!t.objectiveProgress) t.objectiveProgress = {};
        if (!t.objectiveProgress[objId]) {
            const obj = t.objectives.find((o, i) => (o.id || i) == objId);
            t.objectiveProgress[objId] = { completed: true, count: obj ? (obj.count || 1) : 1 };
        } else {
            t.objectiveProgress[objId].completed = !t.objectiveProgress[objId].completed;
        }
        
        // If all objectives are completed, maybe don't auto-complete task, let user decide
        // but we should save and re-render
        this.saveTaskCompletionStatus();
        this.renderTasks();
    },

    updateObjectiveCount(taskId, objId, count) {
        const t = this.data.tasks.find(x => x.id === taskId);
        if (!t) return;
        
        const nCount = parseInt(count) || 0;
        if (!t.objectiveProgress) t.objectiveProgress = {};
        if (!t.objectiveProgress[objId]) {
            t.objectiveProgress[objId] = { completed: false, count: nCount };
        } else {
            t.objectiveProgress[objId].count = nCount;
        }
        
        // Auto-check if count reached required
        const obj = t.objectives.find((o, i) => (o.id || i) == objId);
        if (obj && nCount >= (obj.count || 1)) {
            t.objectiveProgress[objId].completed = true;
        }

        this.saveTaskCompletionStatus();
        this.renderTasks();
    },

    loadTaskCompletionStatus() {
        const key = this.getCompletionStorageKey();
        const s = localStorage.getItem(key);
        const map = s ? JSON.parse(s) : {};
        
        this.data.tasks.forEach(t => {
            const saved = map[t.id];
            if (saved === undefined) {
                t.completed = false;
                t.objectiveProgress = {};
            } else if (typeof saved === 'boolean') {
                // Legacy support
                t.completed = saved;
                t.objectiveProgress = {};
            } else {
                t.completed = saved.completed || false;
                t.objectiveProgress = saved.objectives || {};
            }
        });
    },
    
    saveTaskCompletionStatus() {
        const map = {}; 
        this.data.tasks.forEach(t => { 
            if (t.completed || (t.objectiveProgress && Object.keys(t.objectiveProgress).length > 0)) {
                map[t.id] = {
                    completed: t.completed,
                    objectives: t.objectiveProgress || {}
                };
            }
        });
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