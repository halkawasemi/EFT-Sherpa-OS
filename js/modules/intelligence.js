// Intelligence Unit Module - Ver 1.0 (Refined)

Object.assign(window.app, {
    renderIntelligence() {
        const input = document.getElementById('intel-search');
        const query = input ? input.value.toLowerCase().trim() : '';
        const resultsArea = document.getElementById('intel-results-area');
        
        if (!resultsArea) return;
        if (query.length < 2) {
            resultsArea.innerHTML = `
                <div class="flex flex-col items-center justify-center py-20 text-gray-600 opacity-30">
                    <i class="fa-solid fa-satellite-dish text-6xl mb-4"></i>
                    <p class="font-mono text-sm tracking-widest">AWAITING INPUT...</p>
                </div>`;
            return;
        }

        // Search in various data sources
        const item = this.data.marketItems.find(i => 
            i.name.toLowerCase().includes(query) || 
            (i.shortName && i.shortName.toLowerCase().includes(query))
        );

        const ammo = this.data.ammo.find(a => 
            a.item.name.toLowerCase().includes(query) || 
            a.item.shortName.toLowerCase().includes(query)
        );

        const relatedTasks = this.data.tasks.filter(t => 
            t.name.toLowerCase().includes(query) || 
            t.objectives.some(o => o.description.toLowerCase().includes(query))
        ).slice(0, 3);

        // System Keywords (Enhanced)
        const sysKeywords = ['patch', 'update', 'wipe', 'maintenance', 'event', 'boss', 'goons', 'server', 'status', 'down', 'パッチ', 'メンテ', 'イベント', 'ワイプ', 'ボス', 'サーバー', '落ちた', '重い'];
        const isSysQuery = sysKeywords.some(k => query.includes(k));

        if (!item && !ammo && relatedTasks.length === 0) {
            if (isSysQuery) {
                this.generateSystemReport(query);
                return;
            }

            resultsArea.innerHTML = `
                <div class="glass-panel p-6 rounded border border-red-900/30 text-center">
                    <i class="fa-solid fa-triangle-exclamation text-red-500 mb-2"></i>
                    <p class="text-gray-400 font-mono text-sm">NO RELEVANT INTELLIGENCE FOUND FOR: "${query.toUpperCase()}"</p>
                    
                    <!-- Fallback to External Search -->
                    <div class="mt-4 pt-4 border-t border-gray-800">
                        <p class="text-xs text-gray-500 mb-3">Initiate broad spectrum external scan?</p>
                        ${this.generateExternalIntelHTML(query)}
                    </div>
                </div>`;
            return;
        }

        this.generateIntelReport(item, ammo, relatedTasks, query);
    },

    generateSystemReport(query) {
        const resultsArea = document.getElementById('intel-results-area');
        
        // URLs
        const officialUrlV1 = this.buildSearchUrl(query, 'official', 'v1.0');
        const realtimeUrl = "https://status.escapefromtarkov.com/"; // Direct link for maximum reliability
        const communityRealtimeUrl = this.buildSearchUrl(query, 'community', '24h');
        
        let html = `
        <div class="space-y-6 animate-fade-in pb-10">
            <!-- HEADER -->
            <div class="flex justify-between items-center bg-tarkov-accent/10 p-2 border-l-4 border-tarkov-accent rounded-r">
                <span class="text-[10px] font-bold text-tarkov-accent tracking-tighter uppercase"><i class="fa-solid fa-tower-broadcast mr-1"></i> System Alert Detected</span>
                <span class="text-[9px] text-gray-500 font-mono">${new Date().toISOString()}</span>
            </div>

            <section class="intel-section">
                <h3 class="intel-label"><i class="fa-solid fa-quote-left mr-2"></i>状況要約</h3>
                <p class="text-sm text-gray-200 leading-relaxed">
                    システムキーワード "<strong>${query.toUpperCase()}</strong>" を検出。
                    サーバー状態の確認および直近のコミュニティ報告を表示します。
                </p>
            </section>

            <section class="intel-section">
                <h3 class="intel-label"><i class="fa-solid fa-network-wired mr-2"></i>推奨アクション</h3>
                <div class="bg-black/30 p-4 rounded border border-gray-800 text-center">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <a href="${officialUrlV1}" target="_blank" class="intel-search-btn border-tarkov-blue text-tarkov-blue hover:bg-tarkov-blue/10 py-4">
                            <i class="fa-solid fa-flag text-2xl mb-2"></i>
                            <span class="text-sm font-bold">LATEST NEWS (Ver 1.0+)</span>
                            <span class="text-[9px] opacity-70 mt-1">Official Patch Notes & Events</span>
                        </a>
                        <a href="${realtimeUrl}" target="_blank" class="intel-search-btn border-red-500 text-red-500 hover:bg-red-900/10 py-4">
                            <i class="fa-solid fa-server text-2xl mb-2"></i>
                            <span class="text-sm font-bold">OFFICIAL STATUS</span>
                            <span class="text-[9px] opacity-70 mt-1">Direct to status.escapefromtarkov.com</span>
                        </a>
                        <a href="${communityRealtimeUrl}" target="_blank" class="intel-search-btn border-tarkov-gold text-tarkov-gold hover:bg-tarkov-gold/10 py-4 md:col-span-2">
                            <i class="fa-brands fa-reddit-alien text-2xl mb-2"></i>
                            <span class="text-sm font-bold">COMMUNITY LIVE (24h)</span>
                            <span class="text-[9px] opacity-70 mt-1">Realtime Player Reports & Issues</span>
                        </a>
                    </div>
                </div>
            </section>
        </div>`;
        
        resultsArea.innerHTML = html;
    },

    quickIntel(query) {
        const input = document.getElementById('intel-search');
        if (input) {
            input.value = query;
            this.switchTab('intelligence');
            this.renderIntelligence();
        }
    },

    generateIntelReport(item, ammo, tasks, query) {
        const resultsArea = document.getElementById('intel-results-area');
        
        let html = `
        <div class="space-y-6 animate-fade-in pb-10">
            <!-- HEADER -->
            <div class="flex justify-between items-center bg-tarkov-accent/10 p-2 border-l-4 border-tarkov-accent rounded-r">
                <span class="text-[10px] font-bold text-tarkov-accent tracking-tighter uppercase"><i class="fa-solid fa-shield-halved mr-1"></i> Knowledge Integrity Verified</span>
                <span class="text-[9px] text-gray-500 font-mono">${new Date().toISOString()}</span>
            </div>`;

        // 1. 【要約】 (Internal Data)
        let summaryText = "";
        if (item) {
            summaryText = `${item.name}は、市場価格約₽${(item.avg24hPrice||0).toLocaleString()}で取引されています。`;
            if (item.reqData?.active) summaryText += " 現在、タスクまたは隠れ家で必要とされています。";
        } else if (tasks.length > 0) {
            summaryText = `関連する${tasks.length}件のタスクが検出されました。`;
        } else {
            summaryText = `指定されたキーワード "${query}" に関する情報を解析中...`;
        }

        html += `
            <section class="intel-section">
                <h3 class="intel-label"><i class="fa-solid fa-quote-left mr-2"></i>内部データ分析</h3>
                <p class="text-sm text-gray-200 leading-relaxed">${summaryText}</p>
            </section>`;

        // 2. 【詳細分析】 (Internal Data)
        let analysisHtml = "";
        if (item) {
            const bestPrice = this.getBestPrice(item.id);
            analysisHtml += `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-black/30 p-3 rounded border border-gray-800">
                    <h4 class="text-[10px] text-gray-500 uppercase mb-2">Market Data</h4>
                    <div class="flex justify-between items-end">
                        <span class="text-xs text-gray-400">Current Price</span>
                        <span class="text-lg font-mono font-bold text-tarkov-blue">₽${(item.avg24hPrice||0).toLocaleString()}</span>
                    </div>
                    <div class="flex justify-between items-end mt-1">
                        <span class="text-[10px] text-gray-500">Best Source</span>
                        <span class="text-[10px] text-tarkov-green font-bold">${bestPrice.vendor}</span>
                    </div>
                </div>`;
            
            if (ammo) {
                const penColor = this.getPenColor(ammo.penetrationPower);
                analysisHtml += `
                <div class="bg-black/30 p-3 rounded border border-gray-800">
                    <h4 class="text-[10px] text-gray-500 uppercase mb-2">Ballistics Info</h4>
                    <div class="grid grid-cols-2 gap-2">
                        <div><span class="text-[9px] text-gray-500 block">DAMAGE</span><span class="text-sm font-bold text-white">${ammo.damage}</span></div>
                        <div><span class="text-[9px] text-gray-500 block">PENETRATION</span><span class="text-sm font-bold ${penColor}">${ammo.penetrationPower}</span></div>
                    </div>
                </div>`;
            }
            analysisHtml += `</div>`;
        }

        if (tasks.length > 0) {
            analysisHtml += `<div class="mt-4 space-y-2">`;
            tasks.forEach(t => {
                analysisHtml += `
                <div class="bg-black/20 p-2 rounded border border-gray-800 flex justify-between items-center">
                    <div>
                        <span class="text-xs font-bold text-tarkov-gold">${t.name}</span>
                        <span class="text-[9px] text-gray-500 ml-2">(${t.trader.name})</span>
                    </div>
                    <span class="text-[9px] px-1 bg-gray-800 text-gray-400 rounded">Map: ${t.map ? t.map.name : 'Multiple'}</span>
                </div>`;
            });
            analysisHtml += `</div>`;
        }

        if (analysisHtml) {
            html += `
                <section class="intel-section">
                    <h3 class="intel-label"><i class="fa-solid fa-chart-line mr-2"></i>詳細データ</h3>
                    <div class="space-y-2">${analysisHtml}</div>
                </section>`;
        }

        // 3. 【SHERPAアドバイス】 (Internal Logic)
        let adviceText = "";
        if (item) {
            if (item.reqData?.remaining.task > 0 || item.reqData?.remaining.hideout > 0) {
                adviceText = `現在、タスク/隠れ家で必要です。売却せず確保してください。`;
            } else if (item.avg24hPrice > 50000) {
                adviceText = `市場価格が高騰中。余剰分はフリーマーケットで売却を推奨。`;
            } else {
                adviceText = `特筆すべき需要なし。スタッシュ整理のため売却を検討してください。`;
            }
        }
        
        if (adviceText) {
             html += `
            <section class="intel-section">
                <h3 class="intel-label text-tarkov-accent"><i class="fa-solid fa-user-shield mr-2"></i>SHERPAアドバイス</h3>
                <div class="bg-tarkov-accent/5 p-4 rounded border-l-2 border-tarkov-accent text-sm italic text-gray-300">
                    "${adviceText}"
                </div>
            </section>`;
        }

        // 4. 【外部インテリジェンス (External Intel Ops)】
        html += this.generateExternalIntelHTML(query);

        html += `</div>`; // End of container

        resultsArea.innerHTML = html;
    },

    generateExternalIntelHTML(query) {
        // Build URLs with High Precision Filters
        const wikiUrl = this.buildSearchUrl(query, 'wiki');
        const officialUrl = this.buildSearchUrl(query, 'official');
        const communityUrl = this.buildSearchUrl(query, 'community');

        return `
            <section class="intel-section mt-6 pt-4 border-t border-gray-700/50">
                <h3 class="intel-label text-gray-400"><i class="fa-solid fa-globe mr-2"></i>EXTERNAL INTEL OPS (HIGH PRECISION)</h3>
                
                <div class="bg-black/40 p-4 rounded border border-gray-800 mt-2">
                    <div class="flex items-center justify-between mb-3">
                        <p class="text-[10px] text-gray-500 uppercase tracking-wider">
                            <i class="fa-solid fa-filter mr-1"></i> Active Filters
                        </p>
                        <div class="flex gap-2">
                            <span class="text-[9px] bg-tarkov-accent/20 text-tarkov-accent px-2 py-0.5 rounded border border-tarkov-accent/30">VER 1.0+ (After 2025-11)</span>
                            <span class="text-[9px] bg-blue-900/20 text-blue-400 px-2 py-0.5 rounded border border-blue-900/30">TRUSTED SOURCES</span>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <!-- WIKI -->
                        <a href="${wikiUrl}" target="_blank" class="intel-search-btn group border-gray-700 hover:border-tarkov-green hover:bg-tarkov-green/5 p-3 rounded transition-all duration-300 text-left">
                            <div class="flex items-center mb-1">
                                <i class="fa-solid fa-book-open text-tarkov-green mr-2 group-hover:scale-110 transition-transform"></i>
                                <span class="text-sm font-bold text-gray-200 group-hover:text-tarkov-green">TACTICAL DATA</span>
                            </div>
                            <span class="text-[10px] text-gray-500 block pl-6">Official Wiki (EN/JP)</span>
                        </a>

                        <!-- OFFICIAL -->
                        <a href="${officialUrl}" target="_blank" class="intel-search-btn group border-gray-700 hover:border-tarkov-blue hover:bg-tarkov-blue/5 p-3 rounded transition-all duration-300 text-left">
                            <div class="flex items-center mb-1">
                                <i class="fa-brands fa-twitter text-tarkov-blue mr-2 group-hover:scale-110 transition-transform"></i>
                                <span class="text-sm font-bold text-gray-200 group-hover:text-tarkov-blue">OFFICIAL STATUS</span>
                            </div>
                            <span class="text-[10px] text-gray-500 block pl-6">BSG News & Patch Notes</span>
                        </a>

                        <!-- COMMUNITY -->
                        <a href="${communityUrl}" target="_blank" class="intel-search-btn group border-gray-700 hover:border-tarkov-gold hover:bg-tarkov-gold/5 p-3 rounded transition-all duration-300 text-left">
                            <div class="flex items-center mb-1">
                                <i class="fa-brands fa-reddit-alien text-tarkov-gold mr-2 group-hover:scale-110 transition-transform"></i>
                                <span class="text-sm font-bold text-gray-200 group-hover:text-tarkov-gold">COMMUNITY LIVE</span>
                            </div>
                            <span class="text-[10px] text-gray-500 block pl-6">Reddit & Verification</span>
                        </a>
                    </div>
                </div>
            </section>
        `;
    },

    buildSearchUrl(keyword, type, timeFilter = 'v1.0') {
        const base = "https://www.google.com/search?q=";
        let sites = "";
        // Strict date filter
        const dateFilter = "after:2025-11-14"; 

        // 1. Site Selection
        switch(type) {
            case 'official':
                sites = "site:twitter.com/bstategames OR site:escapefromtarkov.com";
                break;
            case 'wiki':
                sites = "site:escapefromtarkov.fandom.com OR site:wikiwiki.jp/eft/";
                break;
            case 'community':
                sites = "site:reddit.com/r/EscapefromTarkov OR site:tarkov.help";
                break;
            case 'status':
                sites = "site:status.escapefromtarkov.com OR site:twitter.com/bstategames OR site:downdetector.com/status/escape-from-tarkov/";
                break;
        }

        // 2. Multilingual Keyword Expansion
        const termMap = {
            'パッチ': 'patch', 'メンテ': 'maintenance', 'ワイプ': 'wipe',
            'イベント': 'event', 'ボス': 'boss', '弾薬': 'ammo', '弾': 'ammo',
            '武器': 'weapon', '鍵': 'key', 'タスク': 'task', '隠れ家': 'hideout',
            'サーバー': 'server', '落ちた': 'down', '重い': 'lag'
        };

        let finalKeyword = `"${keyword}"`; // Default: Exact match

        // If JP keyword found, append EN term: ("パッチ" OR "patch")
        for (const [jp, en] of Object.entries(termMap)) {
            if (keyword.includes(jp)) {
                finalKeyword = `("${keyword}" OR "${en}")`;
                break; // Apply first match only to avoid complexity
            }
        }

        // 3. Time Filter Logic
        let timeQuery = "";
        let urlParams = "";

        if (timeFilter === 'v1.0') {
            timeQuery = ` ${dateFilter}`; 
        } else if (timeFilter === '24h') {
            urlParams = "&tbs=qdr:d"; // Last 24 hours param for Google
        }
        
        const query = encodeURIComponent(`${sites} ${finalKeyword}${timeQuery}`);
        return `${base}${query}${urlParams}`;
    },

    getPenColor(pen) {
        if (pen >= 50) return 'text-red-500';
        if (pen >= 40) return 'text-orange-500';
        if (pen >= 30) return 'text-yellow-500';
        return 'text-tarkov-green';
    }
});