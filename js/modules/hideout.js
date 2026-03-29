// Hideout Manager Logic

Object.assign(window.app, {
    renderHideout() {
        const grid = document.getElementById('hideout-grid');
        if(!grid) return;
        
        const stations = this.data.hideoutStationsRaw;
        if (!stations || stations.length === 0) { grid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-10">Waiting for Data...</div>'; return; }

        stations.sort((a, b) => a.name.localeCompare(b.name));
        grid.innerHTML = '';
        
        let totalStations = stations.length;
        let maxLevelSum = 0;
        let currentLevelSum = 0;

        stations.forEach(station => {
            const savedLevel = this.data.userHideoutLevels[station.id] || 0;
            const maxLevel = Math.max(...station.levels.map(l => l.level));
            maxLevelSum += maxLevel;
            currentLevelSum += savedLevel;
            
            const nextLevel = savedLevel + 1;
            const nextLevelData = station.levels.find(l => l.level === nextLevel);
            const isMaxed = savedLevel >= maxLevel;

            let reqHtml = '';
            if (isMaxed) {
                reqHtml = `<div class="text-tarkov-green text-xs font-bold text-center py-4 bg-green-900/10 rounded border border-green-900/30">MAX LEVEL REACHED</div>`;
            } else if (nextLevelData) {
                const items = nextLevelData.itemRequirements.map(req => `<div class="flex items-center gap-2 bg-[#111] p-1.5 rounded border border-[#333]"><img src="${req.item.iconLink}" loading="lazy" alt="${req.item.name}" class="w-6 h-6 object-contain bg-[#222] rounded" onerror="this.style.display='none'"><div class="min-w-0 flex-1"><div class="text-[10px] text-gray-300 truncate">${req.item.name}</div><div class="text-[9px] text-gray-500">x${req.count}</div></div></div>`).join('');
                reqHtml = `<div class="space-y-1 mt-2 mb-1"><div class="text-[9px] text-gray-500 uppercase">Requirements for Lv${nextLevel}</div><div class="grid grid-cols-2 gap-1">${items}</div></div>`;
            } else { reqHtml = `<div class="text-gray-500 text-xs text-center py-4">Data not available</div>`; }

            const card = document.createElement('div');
            card.className = `tarkov-panel rounded p-3 border ${isMaxed ? 'border-tarkov-green/30' : 'border-tarkov-border'} flex flex-col`;
            card.innerHTML = `<div class="flex justify-between items-center mb-3"><h3 class="font-bold text-sm ${isMaxed ? 'text-tarkov-green' : 'text-gray-200'} truncate pr-2">${station.name}</h3><div class="flex items-center gap-1 bg-[#111] rounded p-1 border border-[#333]"><button class="hideout-level-btn" onclick="app.updateHideoutLevel('${station.id}', -1)" ${savedLevel <= 0 ? 'disabled' : ''}>-</button><span class="w-8 text-center font-mono font-bold ${isMaxed ? 'text-tarkov-green' : 'text-white'}">${savedLevel}</span><button class="hideout-level-btn" onclick="app.updateHideoutLevel('${station.id}', 1)" ${isMaxed ? 'disabled' : ''}>+</button></div></div><div class="flex-1">${reqHtml}</div>`;
            grid.appendChild(card);
        });

        const progress = totalStations > 0 ? Math.round((currentLevelSum / maxLevelSum) * 100) : 0;
        this.safeUpdateHTML('dash-hideout-count', `${progress}%`);
        document.getElementById('hideout-progress-text').innerText = `${progress}% Completed`;
        document.getElementById('hideout-progress-bar').style.width = `${progress}%`;
    },

    updateHideoutLevel(stationId, change) {
        const stations = this.data.hideoutStationsRaw;
        const station = stations.find(s => s.id === stationId);
        if (!station) return;
        const maxLevel = Math.max(...station.levels.map(l => l.level));
        let current = this.data.userHideoutLevels[stationId] || 0;
        let next = current + change;
        if (next < 0) next = 0;
        if (next > maxLevel) next = maxLevel;
        this.data.userHideoutLevels[stationId] = next;
        this.saveHideoutStatus();
        this.calculateAllRequirements(); 
        this.renderHideout();
        this.renderMarket();
    },

    loadHideoutStatus() { const s = localStorage.getItem('userHideoutLevels'); if (s) { try { this.data.userHideoutLevels = JSON.parse(s); } catch (e) { this.data.userHideoutLevels = {}; } } },
    saveHideoutStatus() { localStorage.setItem('userHideoutLevels', JSON.stringify(this.data.userHideoutLevels)); }
});