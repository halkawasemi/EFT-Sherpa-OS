// Loadout Manager Logic (Injectors)

Object.assign(window.app, {
    async loadInjectorPresets() {
        const s = localStorage.getItem('injectorPresets');
        if (s) {
            try { this.data.injectorPresets = JSON.parse(s); } 
            catch (e) { console.error("Loadout Load Error", e); this.data.injectorPresets = []; }
        }
        this.renderPresetBar();
    },

    saveInjectorPresets() {
        localStorage.setItem('injectorPresets', JSON.stringify(this.data.injectorPresets));
        this.renderPresetBar();
    },
    
    refreshPresetPrices() {
        let updated = false;
        this.data.injectorPresets.forEach(preset => {
            preset.injectors.forEach(inj => {
                if (inj.id) {
                    const newPriceData = this.getBestPrice(inj.id);
                    if (newPriceData.price !== inj.priceData?.price || newPriceData.source !== inj.priceData?.source) {
                        inj.priceData = newPriceData;
                        updated = true;
                    }
                }
            });
        });

        if (updated) {
            this.saveInjectorPresets();
            if (this.currentEditingPreset && !this.currentEditingPreset.isDefault) {
                const freshPreset = this.data.injectorPresets.find(p => p.id === this.currentEditingPreset.id);
                if (freshPreset) {
                    this.currentEditingPreset.injectors = JSON.parse(JSON.stringify(freshPreset.injectors));
                    this.renderLoadoutWorkspace();
                }
            }
            console.log("Preset prices updated via Sync");
        }
    },

    renderPresetBar() {
        const bar = document.getElementById('injector-preset-bar');
        if (!bar) return;

        bar.innerHTML = '';

        // 0. New Preset Button (Custom)
        const customBtn = document.createElement('button');
        customBtn.className = "flex-none w-12 h-20 rounded border-2 border-dashed border-gray-700 hover:border-tarkov-accent flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-tarkov-accent transition-colors";
        customBtn.onclick = () => this.newInjectorPreset();
        customBtn.innerHTML = `<i class="fa-solid fa-plus text-lg"></i><span class="text-[8px] uppercase font-bold">New</span>`;

        // 1. Default Presets
        Object.keys(this.consts.injectorLoadouts).forEach(key => {
            const def = this.consts.injectorLoadouts[key];
            const btn = document.createElement('button');
            btn.className = `injector-btn rounded p-2 min-w-[100px] text-center shrink-0 flex flex-col items-center justify-center gap-1 bg-[#111] ${this.currentEditingPreset?.id === key ? 'active' : ''}`;
            btn.onclick = () => this.selectPreset(key, true);
            
            let icon = 'fa-syringe';
            if(key === 'boss') icon = 'fa-skull text-red-500';
            else if(key === 'marathon') icon = 'fa-person-running text-blue-400';
            else if(key === 'loot') icon = 'fa-weight-hanging text-yellow-500';
            else if(key === 'budget') icon = 'fa-piggy-bank text-green-400';
            else if(key === 'night') icon = 'fa-moon text-purple-400';

            btn.innerHTML = `<i class="fa-solid ${icon} text-xl"></i><span class="text-[10px] font-bold text-gray-300 uppercase">${key}</span>`;
            bar.appendChild(btn);
        });

        const sep = document.createElement('div');
        sep.className = "w-px bg-gray-700 mx-1 shrink-0";
        bar.appendChild(sep);

        // 2. User Presets
        this.data.injectorPresets.forEach(p => {
            const btn = document.createElement('button');
            btn.className = `injector-btn rounded p-2 min-w-[100px] text-center shrink-0 flex flex-col items-center justify-center gap-1 bg-[#111] border-dashed border-gray-600 ${this.currentEditingPreset?.id === p.id ? 'active' : ''}`;
            btn.onclick = () => this.selectPreset(p.id, false);
            btn.innerHTML = `<i class="fa-solid fa-user-astronaut text-gray-400 text-xl"></i><span class="text-[10px] font-bold text-gray-300 truncate max-w-[80px]">${p.name}</span>`;
            bar.appendChild(btn);
        });

        bar.appendChild(customBtn);
    },

    selectPreset(id, isDefault) {
        if (isDefault) {
            const def = this.consts.injectorLoadouts[id];
            this.currentEditingPreset = {
                id: id,
                name: def.title,
                description: def.desc,
                warning: def.warning,
                isDefault: true,
                injectors: def.items.map(name => {
                    const item = this.data.injectorItems.find(i => i.name.includes(name) || (i.shortName && i.shortName.includes(name)));
                    const icon = item?.iconLink || 'https://via.placeholder.com/40x40?text=NO+IMG'; 
                    const itemId = item?.id || null;
                    const shortName = item?.shortName || name;
                    const priceData = item ? this.getBestPrice(item.id) : { price: 0, source: 'unknown', vendor: 'Unknown' };

                    return { id: itemId, name: name, shortName: shortName, iconLink: icon, priceData: priceData, count: 1 };
                })
            };
        } else {
            const userP = this.data.injectorPresets.find(p => p.id === id);
            if(userP) {
                this.currentEditingPreset = JSON.parse(JSON.stringify(userP));
                this.currentEditingPreset.isDefault = false;
                this.currentEditingPreset.injectors.forEach(inj => {
                    if(!inj.count) inj.count = 1; 
                    if(inj.id) {
                        const item = this.data.injectorItems.find(i => i.id === inj.id);
                        inj.iconLink = item?.iconLink || 'https://via.placeholder.com/40x40?text=NO+IMG';
                        inj.priceData = this.getBestPrice(inj.id);
                    } else {
                        inj.iconLink = 'https://via.placeholder.com/40x40?text=NO+IMG';
                        inj.priceData = { price: 0, source: 'unknown', vendor: 'Unknown' };
                    }
                });
            }
        }

        this.renderLoadoutWorkspace();
        this.renderPresetBar();
    },

    newInjectorPreset() {
        this.currentEditingPreset = {
            id: Date.now().toString(),
            name: 'New Preset',
            description: '',
            injectors: [],
            isDefault: false
        };
        this.renderLoadoutWorkspace();
        this.renderPresetBar();
    },

    createCustomFromCurrent() {
        if(!this.currentEditingPreset) return;
        const newPreset = JSON.parse(JSON.stringify(this.currentEditingPreset));
        newPreset.id = Date.now().toString();
        newPreset.name = `Copy of ${newPreset.name}`;
        newPreset.isDefault = false;
        delete newPreset.warning; 
        
        this.data.injectorPresets.push(newPreset);
        this.saveInjectorPresets();
        this.selectPreset(newPreset.id, false);
        this.showToast("Preset copied! You can now edit it.");
    },

    saveCurrentPreset() {
        if (!this.currentEditingPreset || this.currentEditingPreset.isDefault) return;
        
        const nameInput = document.getElementById('preset-editor-name');
        const descInput = document.getElementById('preset-editor-desc');
        
        this.currentEditingPreset.name = nameInput.value || "Untitled";
        this.currentEditingPreset.description = descInput.value || "";

        const idx = this.data.injectorPresets.findIndex(p => p.id === this.currentEditingPreset.id);
        if (idx > -1) this.data.injectorPresets[idx] = this.currentEditingPreset;
        else this.data.injectorPresets.push(this.currentEditingPreset);

        this.saveInjectorPresets();
        this.showToast("Preset saved successfully.");
    },

    deleteCurrentPreset() {
        if (!this.currentEditingPreset || this.currentEditingPreset.isDefault) return;
        if (!confirm("Delete this preset?")) return;

        this.data.injectorPresets = this.data.injectorPresets.filter(p => p.id !== this.currentEditingPreset.id);
        this.saveInjectorPresets();
        this.currentEditingPreset = null;
        this.renderLoadoutWorkspace();
        this.showToast("Preset deleted.");
    },

    renderLoadoutWorkspace() {
        const ws = document.getElementById('loadout-workspace');
        const ph = document.getElementById('loadout-placeholder');
        
        if (!this.currentEditingPreset) {
            ws.classList.add('hidden');
            ph.classList.remove('hidden');
            return;
        }

        ws.classList.remove('hidden');
        ph.classList.add('hidden');

        // Header
        const nameInp = document.getElementById('preset-editor-name');
        const descInp = document.getElementById('preset-editor-desc');
        const warningBox = document.getElementById('preset-warning');
        const btnSave = document.getElementById('btn-save-preset');
        const btnDelete = document.getElementById('btn-delete-preset');

        nameInp.value = this.currentEditingPreset.name;
        descInp.value = this.currentEditingPreset.description || '';
        
        const isDef = this.currentEditingPreset.isDefault;
        nameInp.disabled = isDef;
        descInp.disabled = isDef;
        btnSave.style.display = isDef ? 'none' : 'block';
        btnDelete.style.display = isDef ? 'none' : 'block';

        if(this.currentEditingPreset.warning) {
            warningBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1"></i>${this.currentEditingPreset.warning}`;
            warningBox.classList.remove('hidden');
        } else {
            warningBox.classList.add('hidden');
        }

        this.renderInjectorGrid();
        this.renderPresetItemsList();
    },

    renderInjectorGrid() {
        const grid = document.getElementById('injector-grid-display');
        grid.innerHTML = '';
        
        const flatItems = [];
        this.currentEditingPreset.injectors.forEach((item, index) => {
            for(let i=0; i < (item.count || 1); i++) {
                flatItems.push({ ...item, originalIndex: index });
            }
        });

        for (let i = 0; i < 9; i++) {
            const item = flatItems[i];
            const cell = document.createElement('div');
            cell.className = 'injector-grid-cell group';
            
            if (item && item.iconLink) { 
                cell.innerHTML = `
                    <img src="${item.iconLink}" class="w-10 h-10 object-contain drop-shadow-md">
                    ${!this.currentEditingPreset.isDefault ? `<div class="remove-overlay" onclick="app.updateInjectorQuantity(${item.originalIndex}, -1)"><i class="fa-solid fa-minus text-white"></i></div>` : ''}
                `;
            } else {
                cell.innerHTML = `<i class="fa-solid fa-plus text-gray-800 text-xl group-hover:text-gray-600 transition"></i>`;
                if (!this.currentEditingPreset.isDefault) {
                    cell.style.cursor = 'pointer';
                    cell.onclick = () => this.showInjectorPicker();
                }
            }
            grid.appendChild(cell);
        }
    },

    renderPresetItemsList() {
        const list = document.getElementById('preset-items-list');
        const costEl = document.getElementById('preset-total-cost');
        list.innerHTML = '';

        let total = 0;
        this.currentEditingPreset.injectors.forEach((item, idx) => {
            const count = item.count || 1;
            const price = item.priceData?.price || 0;
            const subtotal = price * count;
            total += subtotal;
            const vendor = item.priceData?.vendor || 'Unknown';
            const isTrader = item.priceData?.source === 'trader';

            const row = document.createElement('div');
            row.className = 'flex justify-between items-center bg-black/40 p-2 rounded border border-gray-800 hover:border-gray-600 transition';
            
            const qtyControls = !this.currentEditingPreset.isDefault ? `
                <div class="flex items-center gap-1 bg-black/50 rounded border border-gray-700 ml-2">
                    <button class="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded-l" onclick="app.updateInjectorQuantity(${idx}, -1)">-</button>
                    <span class="text-xs font-mono w-4 text-center text-tarkov-gold">${count}</span>
                    <button class="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded-r" onclick="app.updateInjectorQuantity(${idx}, 1)">+</button>
                </div>
            ` : `<span class="text-xs font-mono ml-2 text-gray-500">x${count}</span>`;

            row.innerHTML = `
                <div class="flex items-center gap-3">
                    <img src="${item.iconLink}" class="w-8 h-8 bg-[#111] rounded object-contain border border-gray-800">
                    <div>
                        <div class="flex items-center">
                            <div class="text-sm font-bold text-gray-200">${item.shortName || item.name}</div>
                            ${qtyControls}
                        </div>
                        <div class="text-[10px] ${isTrader ? 'text-tarkov-green' : 'text-blue-400'}">${vendor}</div>
                    </div>
                </div>
                <div class="text-right">
                        <div class="text-sm font-mono text-tarkov-green">₽${subtotal.toLocaleString()}</div>
                        <div class="text-[9px] text-gray-500">@ ₽${price.toLocaleString()}</div>
                </div>
            `;
            list.appendChild(row);
        });

        if (this.currentEditingPreset.injectors.length === 0) {
            list.innerHTML = '<div class="text-center text-gray-500 py-4 text-xs">No injectors added.</div>';
        }

        costEl.innerText = `₽${total.toLocaleString()}`;
    },

    addInjectorToPreset(injectorId) {
        if (!this.currentEditingPreset || this.currentEditingPreset.isDefault) {
            this.showToast("Cannot edit default preset. Copy it first.");
            return;
        }
        
        const usedSlots = this.currentEditingPreset.injectors.reduce((acc, cur) => acc + (cur.count || 1), 0);
        if (usedSlots >= 9) {
            this.showToast("Case is full (Max 9 slots).");
            return;
        }

        const existingIdx = this.currentEditingPreset.injectors.findIndex(i => i.id === injectorId);
        
        if (existingIdx > -1) {
            this.currentEditingPreset.injectors[existingIdx].count++;
        } else {
            const injector = this.data.injectorItems.find(i => i.id === injectorId);
            if (!injector) return;

            this.currentEditingPreset.injectors.push({
                id: injector.id,
                name: injector.name,
                shortName: injector.shortName,
                iconLink: injector.iconLink,
                priceData: injector.priceData,
                count: 1
            });
        }

        this.renderLoadoutWorkspace();
        this.hideInjectorPicker();
    },

    updateInjectorQuantity(index, change) {
            if (!this.currentEditingPreset || this.currentEditingPreset.isDefault) return;
            
            const item = this.currentEditingPreset.injectors[index];
            if(!item) return;

            const newCount = (item.count || 1) + change;

            if (newCount <= 0) {
                this.currentEditingPreset.injectors.splice(index, 1);
            } else {
                if (change > 0) {
                    const usedSlots = this.currentEditingPreset.injectors.reduce((acc, cur) => acc + (cur.count || 1), 0);
                    if (usedSlots >= 9) {
                        this.showToast("Case is full (Max 9 slots).");
                        return;
                    }
                }
                item.count = newCount;
            }
            this.renderLoadoutWorkspace();
    },

    removeInjectorFromCurrentPreset(index) {
        if (!this.currentEditingPreset || this.currentEditingPreset.isDefault) return;
        this.currentEditingPreset.injectors.splice(index, 1);
        this.renderLoadoutWorkspace();
    },

    showInjectorPicker() {
        if (!this.currentEditingPreset || this.currentEditingPreset.isDefault) {
            if(this.currentEditingPreset?.isDefault) this.showToast("Cannot edit default preset. Click 'Save as New' first.");
            return;
        }
        document.getElementById('injector-picker-modal')?.classList.remove('hidden');
        document.getElementById('injector-picker-search').value = '';
        this.renderInjectorPickerList();
    },

    hideInjectorPicker() {
        document.getElementById('injector-picker-modal')?.classList.add('hidden');
    },

    renderInjectorPickerList() {
        const searchInput = document.getElementById('injector-picker-search');
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        const listContainer = document.getElementById('injector-picker-list');
        if (!listContainer) return;

        const filteredInjectors = this.data.injectorItems.filter(item =>
            item.name?.toLowerCase().includes(searchTerm) || item.shortName?.toLowerCase().includes(searchTerm)
        ).sort((a,b) => a.name.localeCompare(b.name));

        listContainer.innerHTML = filteredInjectors.map(item => {
            const price = item.priceData?.price > 0 ? `₽${item.priceData.price.toLocaleString()}` : 'N/A';
            const source = item.priceData?.vendor || 'Unknown';
            return `
                <button class="flex items-center gap-3 p-2 w-full text-left bg-black/40 hover:bg-white/5 rounded transition border border-gray-800 mb-1" onclick="app.addInjectorToPreset('${item.id}')">
                    <img src="${item.iconLink}" loading="lazy" alt="${item.shortName}" class="w-8 h-8 object-contain bg-[#222] rounded" onerror="this.style.display='none'">
                    <div>
                        <div class="text-sm text-white font-bold">${item.name}</div>
                        <div class="text-[10px] text-gray-400">Price: ${price} (${source})</div>
                    </div>
                </button>
            `;
        }).join('');
    }
});