/**
 * Item Tracker Module
 * EFT-Sherpa-OS Extension
 */
const ItemTracker = {
    state: {
        tasks: [],
        completedItems: JSON.parse(localStorage.getItem('eft_tracker_completed') || '{}'),
        filterTrader: 'all',
        searchTerm: ''
    },

    async init() {
        this.renderLayout();
        await this.loadData();
        this.bindEvents();
    },

    async loadData() {
        const container = document.getElementById('tracker-content');
        container.innerHTML = '<div class="loader">Loading Task Items...</div>';

        // api.js の fetchQuery を利用 (既存の設計を継承)
        const query = `
        {
            tasks {
                id
                name
                trader { name }
                minPlayerLevel
                objectives {
                    id
                    type
                    ... on TaskObjectiveItem {
                        count
                        item { id name iconLink }
                        foundInRaid
                    }
                }
            }
        }`;

        try {
            const data = await API.fetchQuery(query);
            // アイテムが必要なタスクのみ抽出
            this.state.tasks = data.tasks.filter(t => t.objectives.some(o => o.item));
            this.render();
        } catch (error) {
            container.innerHTML = '<div class="error">Failed to load data from tarkov.dev</div>';
        }
    },

    renderLayout() {
        const main = document.getElementById('main-content');
        main.innerHTML = `
            <div class="module-header">
                <div class="search-bar">
                    <input type="text" id="tracker-search" placeholder="Search tasks or items..." value="${this.state.searchTerm}">
                </div>
                <div class="trader-filters" id="tracker-traders">
                    <!-- Traders will be injected here -->
                </div>
            </div>
            <div id="tracker-content" class="item-grid"></div>
        `;
    },

    render() {
        const container = document.getElementById('tracker-content');
        const traderContainer = document.getElementById('tracker-traders');
        
        // トレーダーフィルターの描画
        const traders = ["all", ...new Set(this.state.tasks.map(t => t.trader.name))];
        traderContainer.innerHTML = traders.map(t => `
            <button class="filter-btn ${this.state.filterTrader === t ? 'active' : ''}" data-trader="${t}">
                ${t.toUpperCase()}
            </button>
        `).join('');

        // タスクカードの描画
        const filteredTasks = this.state.tasks.filter(t => {
            const matchTrader = this.state.filterTrader === 'all' || t.trader.name === this.state.filterTrader;
            const matchSearch = t.name.toLowerCase().includes(this.state.searchTerm.toLowerCase()) ||
                                t.objectives.some(o => o.item?.name.toLowerCase().includes(this.state.searchTerm.toLowerCase()));
            return matchTrader && matchSearch;
        });

        container.innerHTML = filteredTasks.map(task => `
            <div class="task-card bg-zinc-900 border border-zinc-800 p-4 rounded">
                <div class="flex justify-between items-start border-b border-zinc-800 pb-2 mb-3">
                    <div>
                        <span class="text-[10px] text-zinc-500 uppercase">${task.trader.name}</span>
                        <h3 class="text-sm font-bold text-yellow-600">${task.name}</h3>
                    </div>
                </div>
                <div class="space-y-2">
                    ${task.objectives.filter(o => o.item).map(obj => {
                        const key = `${task.id}_${obj.id}`;
                        const isChecked = this.state.completedItems[key];
                        return `
                            <div class="item-row flex items-center gap-3 p-2 bg-black/30 rounded cursor-pointer hover:bg-black/50 ${isChecked ? 'opacity-30 grayscale' : ''}" 
                                 onclick="ItemTracker.toggleItem('${key}')">
                                <img src="${obj.item.iconLink}" class="w-8 h-8 bg-zinc-800 rounded">
                                <div class="flex-grow">
                                    <div class="text-[11px] font-medium">${obj.item.name}</div>
                                    <div class="text-[9px] text-zinc-500">
                                        Qty: ${obj.count} ${obj.foundInRaid ? '<span class="text-orange-500">[FiR]</span>' : ''}
                                    </div>
                                </div>
                                <div class="check-box w-4 h-4 border border-zinc-600 flex items-center justify-center">
                                    ${isChecked ? '<i class="fas fa-check text-[10px] text-yellow-600"></i>' : ''}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `).join('');
    },

    toggleItem(key) {
        if (this.state.completedItems[key]) {
            delete this.state.completedItems[key];
        } else {
            this.state.completedItems[key] = true;
        }
        localStorage.setItem('eft_tracker_completed', JSON.stringify(this.state.completedItems));
        this.render();
    },

    bindEvents() {
        document.getElementById('tracker-search').addEventListener('input', (e) => {
            this.state.searchTerm = e.target.value;
            this.render();
        });

        document.getElementById('tracker-traders').addEventListener('click', (e) => {
            if (e.target.dataset.trader) {
                this.state.filterTrader = e.target.dataset.trader;
                this.render();
            }
        });
    }
};