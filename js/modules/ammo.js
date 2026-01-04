// Ballistics Live Logic

Object.assign(window.app, {
    switchAmmoView(view) {
        this.data.ammoConfig.view = view;
        const btnChart = document.getElementById('av-chart');
        const btnList = document.getElementById('av-list');
        if(btnChart) btnChart.className = `px-3 py-1 text-xs rounded transition ${view === 'chart' ? 'bg-tarkov-border text-white' : 'text-gray-500 hover:text-white'}`;
        if(btnList) btnList.className = `px-3 py-1 text-xs rounded transition ${view === 'list' ? 'bg-tarkov-border text-white' : 'text-gray-500 hover:text-white'}`;
        
        const cContainer = document.getElementById('ammo-chart-container');
        if(cContainer) cContainer.classList.toggle('hidden', view !== 'chart');
        const lContainer = document.getElementById('ammo-list-container');
        if(lContainer) lContainer.classList.toggle('hidden', view !== 'list');
    },
    
    toggleAmmoFilterPanel() {
        const p = document.getElementById('ammo-filter-panel');
        if(p) p.classList.toggle('hidden');
    },

    renderAmmo() {
        if (!this.data.ammo || this.data.ammo.length === 0) return;
        const calibers = [...new Set(this.data.ammo.map(a => a.caliber))].sort();
        const select = document.getElementById('ammo-select');
        if (select && select.children.length <= 1) {
                calibers.forEach(cal => {
                const cleanCal = cal.replace('Caliber', '');
                const opt = document.createElement('option');
                opt.value = cal;
                opt.innerText = cleanCal;
                select.appendChild(opt);
            });
        }
        this.updateAmmoVisuals();
    },

    sortAmmo(key) {
        const conf = this.data.ammoConfig;
        if(conf.sortBy === key) conf.sortDesc = !conf.sortDesc;
        else { conf.sortBy = key; conf.sortDesc = true; }
        this.updateAmmoVisuals();
    },

    getFilteredAmmoData() {
        const conf = this.data.ammoConfig;
        let data = this.data.ammo.map(a => {
            const pd = a.priceData || { price: 0, source: 'unknown' };
            const isUnavailable = pd.source === 'unknown' || pd.price === 0;
            const isTrader = pd.source === 'trader';
            return { ...a, isUnavailable, isTrader };
        });

        if (conf.caliber !== 'all') data = data.filter(a => a.caliber === conf.caliber);

        if (conf.filters.hideUnavailable) data = data.filter(a => !a.isUnavailable);
        if (conf.filters.traderOnly) data = data.filter(a => a.isTrader);

        data.sort((a, b) => {
            let valA, valB;
            switch(conf.sortBy) {
                case 'name': valA = a.item.name; valB = b.item.name; break;
                case 'damage': valA = a.damage; valB = b.damage; break;
                case 'price': valA = (a.priceData?.price || 0); valB = (b.priceData?.price || 0); break;
                default: valA = a.penetrationPower; valB = b.penetrationPower; 
            }
            if(typeof valA === 'string') return conf.sortDesc ? valB.localeCompare(valA) : valA.localeCompare(valB);
            return conf.sortDesc ? valB - valA : valA - valB;
        });
        
        return data;
    },

    updateAmmoVisuals() {
        const filteredData = this.getFilteredAmmoData();
        this.renderAmmoList(filteredData);
        this.renderAmmoChart(filteredData);
    },

    renderAmmoList(data) {
        const tbody = document.getElementById('ammo-table-body');
        if(!tbody) return;
        tbody.innerHTML = data.map(a => {
            const pd = a.priceData || { price: 0, source: 'unknown', vendor: 'Unavailable' };
            const priceDisplay = pd.price > 0 ? `₽${pd.price.toLocaleString()}` : '<span class="text-gray-600 font-normal">N/A</span>';
            const sourceDisplay = pd.source === 'trader' ? `<span class="text-tarkov-green">${pd.vendor}</span>` : (pd.source === 'flea' ? '<span class="text-blue-400">Flea</span>' : '<span class="text-red-900">Unavailable</span>');
            
            return `
            <tr class="hover:bg-white/5 border-b border-gray-800">
                <td class="px-4 py-3 font-mono text-xs text-gray-300">
                    <span class="text-tarkov-accent font-bold">${a.item.shortName || a.item.name}</span><br>
                    <span class="text-[9px] text-gray-500">${a.caliber.replace('Caliber','')}
                </td>
                <td class="px-4 py-3 text-gray-400 font-mono">${a.damage}</td>
                <td class="px-4 py-3 font-bold font-mono ${a.penetrationPower > 40 ? 'text-red-400' : (a.penetrationPower > 30 ? 'text-yellow-500' : 'text-gray-500')}">${a.penetrationPower}</td>
                <td class="px-4 py-3 text-xs font-mono text-right">
                    <div class="font-bold text-white">${priceDisplay}</div>
                    <div class="text-[9px]">${sourceDisplay}</div>
                </td>
            </tr>
        `}).join('');
    },

    renderAmmoChart(data) {
        const ctx = document.getElementById('ammoChartCanvas');
        if (!ctx) return;
        if (this.ammoChart) this.ammoChart.destroy();

        const mode = this.data.ammoConfig.colorMode; 

        const caliberColors = {
            'Caliber556x45NATO': '#4ade80', // Green
            'Caliber762x39': '#ef4444',     // Red
            'Caliber545x39': '#f97316',     // Orange
            'Caliber762x51': '#3b82f6',     // Blue
            'Caliber762x54R': '#a855f7',    // Purple
            'Caliber9x19PARA': '#eab308',   // Yellow
            'Caliber46x30': '#06b6d4',      // Cyan
            'Caliber12g': '#ec4899',        // Pink
            'Caliber9x39': '#14b8a6',       // Teal
            'Caliber86x70': '#f43f5e',      // Rose (.338)
            'Caliber127x55': '#8b5cf6'      // Violet
        };

        const scatterData = data.map(a => ({
            x: a.damage,
            y: a.penetrationPower,
            name: a.item.shortName || a.item.name,
            priceData: a.priceData,
            fullData: a
        }));

        const getColor = (d) => {
            if (mode === 'caliber') {
                return caliberColors[d.fullData.caliber] || '#6b7280';
            } else if (mode === 'source') {
                const src = d.priceData?.source;
                if (src === 'trader') return '#4ade80'; // Green
                if (src === 'flea') return '#60a5fa'; // Blue
                return '#374151'; // Dark Grey (Unavailable)
            } else {
                // Penetration Mode
                const pen = d.y;
                if (pen >= 60) return '#ef4444'; 
                if (pen >= 50) return '#f97316'; 
                if (pen >= 40) return '#eab308'; 
                if (pen >= 30) return '#84cc16'; 
                return '#6b7280'; 
            }
        };

        const backgroundColors = scatterData.map(d => getColor(d));
        const pointRadii = scatterData.map(d => (mode === 'source' && d.priceData?.source === 'unknown') ? 4 : 6); 

        this.ammoChart = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Ammo Performance',
                    data: scatterData,
                    backgroundColor: backgroundColors,
                    pointRadius: pointRadii,
                    pointHoverRadius: 10,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(10, 10, 10, 0.95)',
                        titleColor: '#9a8c7d',
                        bodyColor: '#fff',
                        borderColor: '#333',
                        borderWidth: 1,
                        padding: 10,
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                const p = context.raw;
                                const pd = p.priceData || { price: 0, vendor: 'Unknown' };
                                const priceText = pd.price > 0 ? `₽${pd.price.toLocaleString()}` : 'N/A';
                                const cal = p.fullData.caliber.replace('Caliber', '');
                                
                                return [
                                    `[${p.name}]`,
                                    `Caliber: ${cal}`,
                                    `Pen: ${p.y}  /  Dmg: ${p.x}`,
                                    `----------------`,
                                    `Vendor: ${pd.vendor}`,
                                    `Price: ${priceText}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: { display: true, text: 'DAMAGE', color: '#666' },
                        grid: { color: '#333' },
                        ticks: { color: '#888' }
                    },
                    y: {
                        title: { display: true, text: 'PENETRATION', color: '#666' },
                        grid: { color: '#333' },
                        ticks: { color: '#888' },
                        min: 0,
                        max: 80
                    }
                }
            }
        });
    }
});