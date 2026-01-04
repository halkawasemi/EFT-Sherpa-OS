// Raid Briefing Module - Ver 1.0

Object.assign(window.app, {
    selectedMapId: null,

    renderRaidBriefing() {
        const container = document.getElementById('raid-briefing-area');
        if (!container) return;

        if (!this.data.maps || this.data.maps.length === 0) {
            container.innerHTML = `<div class="p-10 text-center text-gray-500">Awaiting Intelligence Sync...</div>`;
            return;
        }

        const currentMap = this.selectedMapId ? this.data.maps.find(m => m.id === this.selectedMapId) : null;

        let html = `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
            <!-- MAP SELECTOR & TACTICAL INFO -->
            <div class="lg:col-span-3 space-y-6">
                <section class="glass-panel p-4 rounded border border-gray-800">
                    <h3 class="text-[10px] text-tarkov-gold uppercase tracking-widest mb-4 flex items-center">
                        <i class="fa-solid fa-map-location-dot mr-2"></i>Select Theatre
                    </h3>
                    <select id="map-selector" class="w-full bg-black/50 border border-gray-700 text-gray-200 text-sm p-2 rounded focus:border-tarkov-gold outline-none" 
                            onchange="app.selectRaidMap(this.value)">
                        <option value="">-- Choose Map --</option>
                        ${this.data.maps.sort((a,b)=>a.name.localeCompare(b.name)).map(m => `
                            <option value="${m.id}" ${this.selectedMapId === m.id ? 'selected' : ''}>${m.name}</option>
                        `).join('')}
                    </select>
                </section>

                ${currentMap ? this.renderMapTacticalData(currentMap) : `
                    <div class="glass-panel p-6 text-center text-gray-600 border-dashed border-gray-800">
                        <i class="fa-solid fa-crosshairs text-3xl mb-2 opacity-20"></i>
                        <p class="text-[10px] uppercase">Awaiting Map Selection</p>
                    </div>
                `}
            </div>

            <!-- MISSION OBJECTIVES -->
            <div class="lg:col-span-6">
                ${currentMap ? this.renderMapObjectives(currentMap) : `
                    <div class="h-64 flex items-center justify-center bg-black/20 rounded border border-gray-900 border-dashed">
                        <p class="text-xs text-gray-600 font-mono italic">NO OBJECTIVES LOADED</p>
                    </div>
                `}
            </div>

            <!-- EXTRACTS & NOTES -->
            <div class="lg:col-span-3 space-y-6">
                ${currentMap ? this.renderMapExtras(currentMap) : ''}
            </div>
        </div>`;

        container.innerHTML = html;
    },

    selectRaidMap(id) {
        this.selectedMapId = id;
        this.renderRaidBriefing();
    },

    renderMapTacticalData(map) {
        return `
        <section class="glass-panel p-4 rounded border border-gray-800 space-y-4">
            <div class="flex justify-between items-end border-b border-gray-800 pb-2">
                <h2 class="text-xl font-bold text-gray-100">${map.name}</h2>
                <span class="text-[10px] text-gray-500 font-mono">ID: ${map.id}</span>
            </div>

            <div class="grid grid-cols-2 gap-2 text-center">
                <div class="bg-black/40 p-2 rounded">
                    <span class="text-[9px] text-gray-500 block uppercase">Duration</span>
                    <span class="text-sm font-bold text-tarkov-blue">${map.raidDuration} min</span>
                </div>
                <div class="bg-black/40 p-2 rounded">
                    <span class="text-[9px] text-gray-500 block uppercase">PMC Limit</span>
                    <span class="text-sm font-bold text-tarkov-gold">${map.players}</span>
                </div>
            </div>

            <div class="space-y-2">
                <h4 class="text-[10px] text-gray-500 uppercase flex items-center">
                    <i class="fa-solid fa-skull text-red-500 mr-2"></i>Hostile Entities
                </h4>
                ${map.bosses && map.bosses.length > 0 ? map.bosses.map(b => `
                    <div class="bg-red-950/10 border border-red-900/20 p-2 rounded">
                        <div class="flex justify-between items-center">
                            <span class="text-xs font-bold text-gray-200">${b.name}</span>
                            <span class="text-[10px] text-red-500 font-bold">${Math.round(b.spawnChance * 100)}%</span>
                        </div>
                        <div class="mt-1 flex flex-wrap gap-1">
                            ${b.spawnLocations.map(loc => `
                                <span class="text-[8px] bg-black/40 text-gray-400 px-1 rounded">${loc.name}</span>
                            `).join('')}
                        </div>
                    </div>
                `).join('') : '<p class="text-[10px] text-gray-600 italic">No boss data available</p>'}
            </div>

            <a href="${map.wiki}" target="_blank" class="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-tarkov-green/20 text-gray-300 hover:text-tarkov-green p-2 rounded text-xs transition-colors">
                <i class="fa-solid fa-map"></i> View Wiki Map
            </a>
        </section>`;
    },

    renderMapObjectives(map) {
        const tasks = this.data.tasks.filter(t => t.map && t.map.name === map.name && !t.completed && this.isTaskAvailable(t));
        
        return `
        <section class="glass-panel p-4 rounded border border-gray-800 h-full">
            <h3 class="text-[10px] text-tarkov-gold uppercase tracking-widest mb-4 flex justify-between items-center">
                <span><i class="fa-solid fa-list-check mr-2"></i>Active Objectives (${tasks.length})</span>
                <span class="text-gray-500 lowercase font-normal">Ready for Deployment</span>
            </h3>

            <div class="space-y-3 overflow-y-auto max-h-[700px] pr-2 custom-scrollbar">
                ${tasks.length > 0 ? tasks.map(t => `
                    <div class="bg-black/30 border border-gray-800 p-3 rounded hover:border-gray-700 transition-colors cursor-pointer" onclick="app.openTask('${t.id}')">
                        <div class="flex justify-between items-start mb-1">
                            <span class="text-xs font-bold text-gray-200">${t.name}</span>
                            <span class="text-[9px] px-1 bg-gray-800 text-tarkov-gold rounded">${t.trader.name}</span>
                        </div>
                        <p class="text-[10px] text-gray-500 leading-tight line-clamp-2">
                            ${t.objectives.map(o => o.description).join(' / ')}
                        </p>
                    </div>
                `).join('') : `
                    <div class="py-20 text-center opacity-30">
                        <i class="fa-solid fa-check-double text-4xl mb-2"></i>
                        <p class="text-sm">ALL CURRENT MISSIONS COMPLETE</p>
                        <p class="text-[10px] mt-2">Check Task Database for locked objectives</p>
                    </div>
                `}
            </div>
        </section>`;
    },

    renderMapExtras(map) {
        return `
        <section class="glass-panel p-4 rounded border border-gray-800">
            <h3 class="text-[10px] text-tarkov-gold uppercase tracking-widest mb-4">
                <i class="fa-solid fa-door-open mr-2"></i>Extraction Points
            </h3>
            <div class="grid grid-cols-1 gap-1 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                ${map.extracts && map.extracts.length > 0 ? map.extracts.map(ex => `
                    <div class="flex items-center gap-2 bg-black/40 p-2 rounded border border-gray-800/50 text-xs text-gray-300">
                        <i class="fa-solid fa-person-running text-tarkov-green opacity-70"></i>
                        <span class="truncate">${ex.name}</span>
                    </div>
                `).join('') : '<p class="text-[10px] text-gray-600 italic">No extraction data</p>'}
            </div>
        </section>

        <section class="glass-panel p-4 rounded border border-gray-800">
            <h3 class="text-[10px] text-tarkov-gold uppercase tracking-widest mb-4">
                <i class="fa-solid fa-pen-to-square mr-2"></i>Strategic Notes
            </h3>
            <textarea id="map-notes-${map.id}" 
                      class="w-full h-32 bg-black/50 border border-gray-800 rounded p-2 text-xs text-gray-300 outline-none focus:border-gray-600 font-mono"
                      placeholder="Enter tactical notes for ${map.name}..."
                      onchange="app.saveMapNote('${map.id}', this.value)">${this.loadMapNote(map.id)}</textarea>
            <div class="mt-2 text-[9px] text-gray-600 italic text-right">
                <i class="fa-solid fa-cloud-arrow-up mr-1"></i> Saved to local storage
            </div>
        </section>

        <section class="glass-panel p-4 rounded border border-gray-800">
            <h3 class="text-[10px] text-tarkov-gold uppercase tracking-widest mb-2">
                <i class="fa-solid fa-circle-info mr-2"></i>External Intel
            </h3>
            <div class="space-y-2">
                <button onclick="app.quickIntel('${map.name} 鍵')" class="w-full text-left bg-black/20 hover:bg-black/40 p-2 rounded text-[10px] text-gray-400 border border-gray-800 transition-colors">
                    <i class="fa-solid fa-key mr-2"></i>Key Spawn Points...
                </button>
            </div>
        </section>`;
    },

    saveMapNote(mapId, note) {
        const notes = JSON.parse(localStorage.getItem('mapNotes') || '{}');
        notes[mapId] = note;
        localStorage.setItem('mapNotes', JSON.stringify(notes));
        this.showToast(`Notes for ${mapId} updated`);
    },

    loadMapNote(mapId) {
        const notes = JSON.parse(localStorage.getItem('mapNotes') || '{}');
        return notes[mapId] || '';
    }
});
