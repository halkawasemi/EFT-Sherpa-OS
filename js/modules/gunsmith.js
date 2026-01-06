// Gunsmith Logic

Object.assign(window.app, {
    setupGunsmith() {
        const select = document.getElementById('gs-weapon');
        if(!select) return;
        if (this.data.weapons.length === 0) { select.innerHTML = `<option value="">Waiting for Sync...</option>`; return; }
        const groups = this.data.weapons.reduce((g, w) => {
            const fam = w.shortName ? w.shortName.split(' ')[0] : 'Other';
            if (!g[fam]) g[fam] = [];
            g[fam].push(w);
            return g;
        }, {});
        let opts = `<option value="">Select Weapon...</option>`;
        for (const gn in groups) {
            opts += `<optgroup label="${gn}">`;
            groups[gn].forEach(w => opts += `<option value="${w.id}">${w.name}</option>`); 
            opts += `</optgroup>`;
        }
        select.innerHTML = opts;
        
        // Listener
        select.addEventListener('change', (e) => this.buildGun(e.target.value));
    },

    async buildGun(id) {
        if (!id) return;
        this.safeUpdateHTML('gs-builder-area', '<div class="flex justify-center py-10 opacity-50"><div class="loader"></div></div>');
        this.safeUpdateText('gs-stat-ergo', '-');
        this.safeUpdateText('gs-stat-recoil', '-');
        const query = `{ 
            items(ids: ["${id}"], lang: ja) {
                id name shortName description basePrice width height inspectImageLink gridImageLink
                properties { 
                    ... on ItemPropertiesWeapon { 
                        ergonomics recoilVertical recoilHorizontal fireRate caliber
                        defaultPreset { inspectImageLink gridImageLink } 
                        slots {
                            name
                            filters { allowedItems { id name shortName gridImageLink properties { ... on ItemPropertiesWeaponMod { ergonomics recoilModifier } } } }
                        }
                    }
                }
            }
        }`;
        const data = await this.fetchApiData(query);
        if (data && data.items && data.items.length > 0) {
            this.data.currentBuild = { baseWeapon: data.items[0], attachedParts: [] };
            this.renderGunBuilder(this.data.currentBuild);
        } else {
            this.showToast("Failed to load weapon details");
            this.safeUpdateHTML('gs-builder-area', '<div class="text-center text-red-500 py-10">Error loading weapon data</div>');
        }
    },

    disassemble() {
        if (!this.data.currentBuild) { this.showToast("Select a weapon first"); return; }
        this.data.currentBuild.attachedParts = [];
        this.renderGunBuilder(this.data.currentBuild);
        this.showToast("Weapon Disassembled");
    },

    isPurchasable(itemId) {
        // Market data required
        if (!this.data.itemFullPriceData) return false;
        
        const priceData = this.data.itemFullPriceData.get(itemId);
        if (!priceData || !priceData.buyFor) return false;

        // Check if any trader offer meets requirements
        return priceData.buyFor.some(offer => {
            if (offer.source === 'fleaMarket') return false; // Ignore flea for "Trader Build" logic
            
            const traderName = offer.vendor.name;
            const userLL = this.data.config.traderLevels[traderName] || 4;
            const llReq = offer.requirements.find(r => r.type === 'loyaltyLevel');
            const reqLevel = llReq ? llReq.value : 1;
            
            return userLL >= reqLevel;
        });
    },

    autoAssemble() {
        if (!this.data.currentBuild) { this.showToast("Select a weapon first"); return; }
        const targetErgo = parseFloat(document.getElementById('gs-target-ergo').value);
        const hasTarget = !isNaN(targetErgo);
        
        // Mode Check
        const limitToTraders = true; // For now, we default to "Trader Only" for smart builds. Could be a UI toggle later.

        this.showToast(hasTarget ? `Targeting Ergo ~${targetErgo} (Trader LL)...` : "Auto-Building (Max Ergo / Trader LL)...");
        
        const baseWeapon = this.data.currentBuild.baseWeapon;
        const slots = baseWeapon.properties?.slots || [];
        this.data.currentBuild.attachedParts = [];

        const getItems = (slot) => {
            if (!slot.filters) return [];
            let items = [];
            if (Array.isArray(slot.filters)) { items = slot.filters[0] && slot.filters[0].allowedItems ? slot.filters[0].allowedItems : []; }
            else if (slot.filters.allowedItems) items = slot.filters.allowedItems;
            
            if (!items || items.length === 0) return [];

            // Filter by Trader Level availability first
            const purchasableItems = items.filter(i => this.isPurchasable(i.id));
            
            // If purchasable items exist, use them. Otherwise fallback to all items (with warning/visual distinction ideally)
            // For strict mode, we prefer purchasable.
            return purchasableItems.length > 0 ? purchasableItems : items;
        };

        if (hasTarget) {
            const slotCandidates = slots.map(slot => {
                const items = getItems(slot);
                if (!items || items.length === 0) return { slotName: slot.name, items: [] };
                return { slotName: slot.name, items: items.sort((a, b) => (b.properties?.ergonomics || 0) - (a.properties?.ergonomics || 0)) };
            });
            const currentParts = slotCandidates.map(sc => sc.items[0]).filter(p => p); 
            const calcErgo = (parts) => {
                let e = baseWeapon.properties?.ergonomics || 0;
                parts.forEach(p => e += (p.properties?.ergonomics || 0));
                return e;
            };
            let currentTotal = calcErgo(currentParts);
            let improved = true;
            let loops = 0;
            while (improved && currentTotal > targetErgo && loops < 50) {
                improved = false;
                loops++;
                let bestSwap = null;
                let minDiff = Math.abs(currentTotal - targetErgo);
                for (let i = 0; i < slotCandidates.length; i++) {
                    const sc = slotCandidates[i];
                    const currentPart = currentParts.find(p => sc.items.includes(p)); 
                    if (!currentPart) continue; 
                    const currentIndex = sc.items.indexOf(currentPart); 
                    if (currentIndex + 1 < sc.items.length) {
                        const nextPart = sc.items[currentIndex + 1];
                        const ergoDiff = (currentPart.properties?.ergonomics || 0) - (nextPart.properties?.ergonomics || 0);
                        const newTotal = currentTotal - ergoDiff;
                        const diff = Math.abs(newTotal - targetErgo);
                        if (diff < minDiff) { minDiff = diff; bestSwap = { index: i, oldPart: currentPart, newPart: nextPart, newTotal: newTotal }; }
                    }
                }
                if (bestSwap) {
                    const oldIdx = currentParts.indexOf(bestSwap.oldPart);
                    if (oldIdx > -1) { currentParts[oldIdx] = bestSwap.newPart; currentTotal = bestSwap.newTotal; improved = true; }
                }
            }
            currentParts.forEach(p => {
                const candidate = slotCandidates.find(sc => sc.items.includes(p));
                if(candidate) { this.data.currentBuild.attachedParts.push({ slotName: candidate.slotName, part: p }); }
            });
        } else {
            slots.forEach(slot => {
                let items = getItems(slot);
                if (!items || items.length === 0) return;
                items.sort((a, b) => (b.properties?.ergonomics || 0) - (a.properties?.ergonomics || 0));
                const bestPart = items[0];
                if (bestPart) { this.data.currentBuild.attachedParts.push({ slotName: slot.name, part: bestPart }); }
            });
        }
        this.renderGunBuilder(this.data.currentBuild);
        this.showToast("Assembly Complete (Trader LL Checked)");
    },

    renderGunBuilder(build) {
        const item = build.baseWeapon;
        const props = item.properties || {};
        let ergo = props.ergonomics || 0;
        let recoil = props.recoilVertical || 0;
        let modSum = 0;
        build.attachedParts.forEach(ap => {
            const pProps = ap.part.properties || {};
            if(pProps.ergonomics) ergo += pProps.ergonomics;
            if(pProps.recoilModifier) modSum += pProps.recoilModifier;
        });
        const finalRecoil = recoil * (1 + (modSum / 100));
        this.safeUpdateText('gs-stat-ergo', Math.round(ergo));
        this.safeUpdateText('gs-stat-recoil', Math.round(finalRecoil));
        let imgUrl = item.properties?.defaultPreset?.inspectImageLink || item.inspectImageLink || item.gridImageLink || '';
        let caliber = props.caliber ? props.caliber.replace('Caliber', '') : 'Unknown';
        let html = `
            <div class="glass-panel p-4 md:p-6 rounded animate-fade-in relative overflow-hidden group">
                <div class="absolute -top-6 -right-6 text-9xl font-bold text-white opacity-[0.03] select-none pointer-events-none transition-transform group-hover:scale-110 duration-700">${item.shortName}</div>
                <div class="flex flex-col md:flex-row gap-6 items-start relative z-10">
                    <div class="w-full md:w-5/12">
                        <div class="bg-black/20 rounded-lg p-6 border border-gray-800 flex items-center justify-center min-h-[200px] relative">
                            <img src="${imgUrl}" loading="lazy" alt="${item.name}" class="w-full h-auto object-contain drop-shadow-2xl" onerror="this.src='https://via.placeholder.com/200x100?text=No+Image'">
                        </div>
                        <div class="mt-3 flex justify-between text-[10px] text-gray-500 font-mono px-1"><span>${item.width}x${item.height} CELLS</span><span>${caliber}</span></div>
                    </div>
                    <div class="w-full md:w-7/12 space-y-5">
                        <div>
                            <h3 class="text-xl md:text-2xl font-bold text-white leading-tight font-mono">${item.name}</h3>
                            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                                <div class="bg-[#0a0a0a] p-2 rounded border border-gray-800"><div class="text-[9px] text-gray-500">RPM</div><div class="text-tarkov-green font-mono font-bold">${props.fireRate || '-'}</div></div>
                                <div class="bg-[#0a0a0a] p-2 rounded border border-gray-800"><div class="text-[9px] text-gray-500">H. RECOIL</div><div class="text-gray-300 font-mono">${props.recoilHorizontal || '-'}</div></div>
                            </div>
                        </div>
                        <div class="border-t border-gray-800 pt-4">
                            <h4 class="text-xs text-gray-500 uppercase font-bold mb-2">Available Slots</h4>
                            <div class="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                                ${(props.slots || []).map(slot => {
                                    const attached = build.attachedParts.find(p => p.slotName === slot.name);
                                    return `<div class="bg-black/40 p-2 rounded border border-gray-800 flex justify-between items-center group/slot"><span class="text-xs text-gray-400 font-mono">${slot.name}</span><div class="flex items-center gap-2">${attached ? `<span class="text-tarkov-accent text-xs truncate max-w-[150px]" title="${attached.part.name}">${attached.part.name}</span><button class="text-red-500 hover:text-red-400" onclick="app.removePart('${slot.name}')"><i class="fa-solid fa-times"></i></button>` : `<button class="text-xs bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded text-gray-300" onclick='app.showParts("${slot.name}")'>Select Part</button>`}</div></div>`;
                                }).join('')}
                            </div>
                        </div>
                    </div>
                </div>
                <div id="gs-part-selector" class="hidden mt-4 border-t border-gray-700 pt-4 animate-fade-in scroll-mt-20"><div class="flex justify-between items-center mb-2"><h4 class="text-xs text-tarkov-accent uppercase font-bold">Select Part</h4><button onclick="document.getElementById('gs-part-selector').classList.add('hidden')" class="text-gray-500 hover:text-white"><i class="fa-solid fa-times"></i></button></div><div id="gs-part-list" class="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-60 overflow-y-auto custom-scrollbar"></div></div>
            </div>
        `;
        this.safeUpdateHTML('gs-builder-area', html);
    },

    showParts(slotName) {
        const container = document.getElementById('gs-part-selector');
        const list = document.getElementById('gs-part-list');
        const title = container.querySelector('h4'); 
        container.classList.remove('hidden');
        const slot = this.data.currentBuild.baseWeapon.properties.slots.find(s => s.name === slotName);
        if(title) title.innerText = `Select Part: ${slotName}`;
        let items = [];
        if (slot && slot.filters) {
            if (Array.isArray(slot.filters)) { items = slot.filters[0] ? slot.filters[0].allowedItems : []; } 
            else if (slot.filters.allowedItems) { items = slot.filters.allowedItems; }
        }
        if(!items || items.length === 0) {
            list.innerHTML = '<div class="col-span-full text-center text-gray-500 py-4">No compatible parts found for this slot.</div>';
            setTimeout(() => container.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
            return;
        }
        this.data.currentSlotCandidates = items;
        list.innerHTML = items.map(p => {
            const priceInfo = this.getBestPrice ? this.getBestPrice(p.id) : { price: 0, vendor: 'Unknown' };
            let borderColor = 'border-gray-800';
            let textColor = 'text-gray-400';
            let vendorBadge = '';
            let opacity = '';

            if (priceInfo.price > 0) {
                if (priceInfo.source === 'trader') {
                    borderColor = 'border-tarkov-green/30';
                    textColor = 'text-tarkov-green';
                    vendorBadge = `<span class="text-[9px] bg-tarkov-green/10 text-tarkov-green px-1 rounded absolute top-1 right-1 backdrop-blur-sm z-10">${priceInfo.vendor}</span>`;
                } else if (priceInfo.source === 'flea') {
                    borderColor = 'border-tarkov-orange/30';
                    textColor = 'text-tarkov-orange';
                    vendorBadge = `<span class="text-[9px] bg-tarkov-orange/10 text-tarkov-orange px-1 rounded absolute top-1 right-1 backdrop-blur-sm z-10">Flea</span>`;
                }
            } else {
                borderColor = 'border-red-900/30';
                textColor = 'text-red-500';
                opacity = 'opacity-60';
                vendorBadge = `<span class="text-[9px] bg-red-900/20 text-red-500 px-1 rounded absolute top-1 right-1 backdrop-blur-sm z-10">Locked</span>`;
            }

            return `
            <div class="relative bg-[#0f0f0f] border ${borderColor} p-2 rounded hover:border-tarkov-accent cursor-pointer flex flex-col items-center gap-1 group transition-all hover:bg-white/5 ${opacity}" onclick='app.attachPart("${slotName}", "${p.id}")' title="${p.name}">
                ${vendorBadge}
                <img src="${p.gridImageLink}" loading="lazy" alt="${p.name}" class="w-12 h-12 object-contain group-hover:scale-110 transition mt-3" onerror="this.style.opacity=0.3">
                <span class="text-[10px] ${textColor} text-center truncate w-full group-hover:text-white font-bold">${p.name}</span>
                <span class="text-[9px] text-gray-500 font-mono">${priceInfo.price > 0 ? '₽' + priceInfo.price.toLocaleString() : '---'}</span>
            </div>`;
        }).join('');
        setTimeout(() => { container.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 100);
    },

    attachPart(slotName, partId) {
        const part = this.data.currentSlotCandidates.find(p => p.id === partId);
        if (!part) return;
        this.data.currentBuild.attachedParts = this.data.currentBuild.attachedParts.filter(p => p.slotName !== slotName);
        this.data.currentBuild.attachedParts.push({ slotName, part });
        this.renderGunBuilder(this.data.currentBuild);
    },

    removePart(slotName) {
        this.data.currentBuild.attachedParts = this.data.currentBuild.attachedParts.filter(p => p.slotName !== slotName);
        this.renderGunBuilder(this.data.currentBuild);
    }
});