/**
 * Club Finance App - Data Store & Logic
 */

const STORAGE_KEYS = {
    MEMBERS: 'cf_members',
    TRANSACTIONS: 'cf_transactions'
};

class DataStore {
    constructor() {
        this.members = JSON.parse(localStorage.getItem(STORAGE_KEYS.MEMBERS)) || [];
        this.transactions = JSON.parse(localStorage.getItem(STORAGE_KEYS.TRANSACTIONS)) || [];
    }

    save() {
        localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(this.members));
        localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(this.transactions));
    }

    addMember(member) {
        member.id = member.id || Date.now().toString();
        this.members.push(member);
        this.save();
        return member;
    }

    updateMember(id, updatedData) {
        const index = this.members.findIndex(m => m.id === id);
        if (index !== -1) {
            this.members[index] = { ...this.members[index], ...updatedData };
            this.save();
        }
    }

    addTransaction(tx) {
        tx.id = tx.id || Date.now().toString();
        this.transactions.push(tx);
        this.save();
        return tx;
    }

    updateTransaction(id, updatedData) {
        const index = this.transactions.findIndex(t => t.id === id);
        if (index !== -1) {
            this.transactions[index] = { ...this.transactions[index], ...updatedData };
            this.save();
        }
    }

    getBalance() {
        return this.transactions.reduce((acc, tx) => {
            return tx.type === 'income' ? acc + Number(tx.amount) : acc - Number(tx.amount);
        }, 0);
    }

    getStats() {
        const now = new Date();
        const yearStart = new Date(now.getFullYear(), 0, 1).getTime();

        const ytdIncome = this.transactions
            .filter(t => t.type === 'income' && new Date(t.date).getTime() >= yearStart)
            .reduce((sum, t) => sum + Number(t.amount), 0);

        const ytdExpense = this.transactions
            .filter(t => t.type === 'expense' && new Date(t.date).getTime() >= yearStart)
            .reduce((sum, t) => sum + Number(t.amount), 0);

        return {
            memberCount: this.members.length,
            balance: this.getBalance(),
            ytdIncome,
            ytdExpense
        };
    }
}

const app = {
    store: new DataStore(),
    currentView: 'dashboard',

    init() {
        console.log('App initializing...');
        try {
            this.bindNav();
            this.renderDashboard();
            this.updateStats();
            console.log('App ready');
        } catch (e) {
            console.error('Initialization failed', e);
        }
    },

    bindNav() {
        document.querySelectorAll('nav a').forEach(link => {
            link.onclick = (e) => {
                const view = link.id.replace('nav-', '');
                this.showView(view);
            };
        });
    },

    showView(viewName) {
        this.currentView = viewName;

        // Update Nav UI
        document.querySelectorAll('nav a').forEach(l => l.classList.remove('active'));
        document.getElementById(`nav-${viewName}`).classList.add('active');

        // Hide all views
        document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden'));

        // Show target view
        const target = document.getElementById(`view-${viewName}`);
        target.classList.remove('hidden');

        // Update title
        const titles = {
            dashboard: '首頁概覽',
            members: '社員明細表單',
            fees: '社費繳交明細',
            expenses: '支出明細表',
            reports: '年度收支報表'
        };
        document.getElementById('page-title').textContent = titles[viewName];

        // Specific render logic
        if (viewName === 'dashboard') this.renderDashboard();
        if (viewName === 'members') this.renderMembers();
        if (viewName === 'fees') this.renderFees();
        if (viewName === 'expenses') this.renderExpenses();
        if (viewName === 'reports') this.renderReports();
    },

    updateStats() {
        const stats = this.store.getStats();
        document.getElementById('stat-members-count').textContent = stats.memberCount;
        document.getElementById('stat-balance').textContent = `$${stats.balance.toLocaleString()}`;
        document.getElementById('stat-income').textContent = `$${stats.ytdIncome.toLocaleString()}`;
        document.getElementById('stat-expense').textContent = `$${stats.ytdExpense.toLocaleString()}`;
    },

    renderDashboard() {
        this.updateStats();
        const tbody = document.querySelector('#recent-transactions tbody');
        const recent = this.store.transactions.slice(-5).reverse();

        tbody.innerHTML = recent.map(tx => `
            <tr>
                <td>${tx.date}</td>
                <td><span style="color: ${tx.type === 'income' ? 'var(--accent)' : 'var(--danger)'}">${tx.type === 'income' ? '收入' : '支出'}</span></td>
                <td>${tx.item}</td>
                <td>$${Number(tx.amount).toLocaleString()}</td>
            </tr>
        `).join('') || '<tr><td colspan="4" style="text-align:center; color:var(--text-muted)">尚無近期交易資料</td></tr>';
    },

    // View Renders will be implemented in the next steps...
    renderMembers() {
        const container = document.getElementById('view-members');
        container.innerHTML = `
            <div class="card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem">
                    <h2>社員明細</h2>
                    <button class="btn btn-primary" onclick="app.showMemberModal()">+ 新增社員</button>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>姓名</th>
                                <th>學號/編號</th>
                                <th>部門/系級</th>
                                <th>狀態</th>
                                <th>加入日期</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.store.members.map(m => `
                                <tr>
                                    <td>${m.name}</td>
                                    <td>${m.studentId}</td>
                                    <td>${m.dept}</td>
                                    <td>${m.status}</td>
                                    <td>${m.joinDate}</td>
                                    <td>
                                        <button class="btn btn-ghost" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="app.showMemberModal('${m.id}')">編輯</button>
                                    </td>
                                </tr>
                            `).join('') || '<tr><td colspan="6" style="text-align:center">目前沒有社員資料</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    showMemberModal(memberId = null) {
        const modal = document.getElementById('modal-container');
        const content = document.getElementById('modal-content');
        const member = memberId ? this.store.members.find(m => m.id === memberId) : null;

        content.innerHTML = `
            <h2 style="margin-bottom:1.5rem">${member ? '編輯社員' : '新增社員'}</h2>
            <form id="form-member">
                <div class="form-group">
                    <label>姓名</label>
                    <input type="text" name="name" value="${member?.name || ''}" required>
                </div>
                <div class="form-grid">
                    <div class="form-group">
                        <label>學號/編號</label>
                        <input type="text" name="studentId" value="${member?.studentId || ''}" required>
                    </div>
                    <div class="form-group">
                        <label>部門/系級</label>
                        <input type="text" name="dept" value="${member?.dept || ''}">
                    </div>
                </div>
                <div class="form-group">
                    <label>狀態</label>
                    <select name="status">
                        <option value="在籍" ${member?.status === '在籍' ? 'selected' : ''}>在籍</option>
                        <option value="休學" ${member?.status === '休學' ? 'selected' : ''}>休學</option>
                        <option value="退社" ${member?.status === '退社' ? 'selected' : ''}>退社</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>加入日期</label>
                    <input type="date" name="joinDate" value="${member?.joinDate || new Date().toISOString().split('T')[0]}">
                </div>
                <div style="display:flex; gap:1rem; justify-content:flex-end; margin-top:1rem">
                    <button type="button" class="btn btn-ghost" onclick="app.closeModal()">取消</button>
                    <button type="submit" class="btn btn-primary">儲存</button>
                </div>
            </form>
        `;

        modal.classList.remove('hidden');

        document.getElementById('form-member').onsubmit = (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            if (memberId) {
                this.store.updateMember(memberId, data);
            } else {
                this.store.addMember(data);
            }
            this.closeModal();
            this.renderMembers();
        };
    },

    closeModal() {
        document.getElementById('modal-container').classList.add('hidden');
    },

    renderFees() {
        const container = document.getElementById('view-fees');
        container.innerHTML = `
            <div class="card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem">
                    <h2>社費繳交明細</h2>
                    <button class="btn btn-primary" onclick="app.showFeeModal()">+ 新增社費收款</button>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>日期</th>
                                <th>姓名</th>
                                <th>學期/項目</th>
                                <th>金額</th>
                                <th>備註</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.store.transactions.filter(t => t.type === 'income').map(t => `
                                <tr>
                                    <td>${t.date}</td>
                                    <td>${t.payer}</td>
                                    <td>${t.item}</td>
                                    <td style="color:var(--accent)">$${Number(t.amount).toLocaleString()}</td>
                                    <td>${t.note || '-'}</td>
                                    <td>
                                        <button class="btn btn-ghost" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="app.showFeeModal('${t.id}')">編輯</button>
                                    </td>
                                </tr>
                            `).join('') || '<tr><td colspan="6" style="text-align:center">尚無收款紀錄</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    showFeeModal(txId = null) {
        const modal = document.getElementById('modal-container');
        const content = document.getElementById('modal-content');
        const tx = txId ? this.store.transactions.find(t => t.id === txId) : null;

        const memberOptions = this.store.members.map(m => `
            <option value="${m.name}" ${tx?.payer === m.name ? 'selected' : ''}>${m.name} (${m.studentId})</option>
        `).join('');

        content.innerHTML = `
            <h2 style="margin-bottom:1.5rem">${tx ? '編輯收款紀錄' : '社費收款單'}</h2>
            <form id="form-fee">
                <div class="form-group">
                    <label>社員姓名</label>
                    <select name="payer" required>
                        <option value="">選擇社員...</option>
                        ${memberOptions}
                    </select>
                </div>
                <div class="form-grid">
                    <div class="form-group">
                        <label>日期</label>
                        <input type="date" name="date" value="${tx?.date || new Date().toISOString().split('T')[0]}" required>
                    </div>
                    <div class="form-group">
                        <label>學期/項目</label>
                        <input type="text" name="item" value="${tx?.item || ''}" placeholder="例：113-2 社費" required>
                    </div>
                </div>
                <div class="form-group">
                    <label>金額</label>
                    <input type="number" name="amount" value="${tx?.amount || ''}" required>
                </div>
                <div class="form-group">
                    <label>備註</label>
                    <textarea name="note" rows="2">${tx?.note || ''}</textarea>
                </div>
                <div style="display:flex; gap:1rem; justify-content:flex-end; margin-top:1rem">
                    <button type="button" class="btn btn-ghost" onclick="app.closeModal()">取消</button>
                    <button type="submit" class="btn btn-primary">確認儲存</button>
                </div>
            </form>
        `;

        modal.classList.remove('hidden');

        document.getElementById('form-fee').onsubmit = (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            data.type = 'income';
            if (txId) {
                this.store.updateTransaction(txId, data);
            } else {
                this.store.addTransaction(data);
            }
            this.closeModal();
            this.renderFees();
        };
    },

    renderExpenses() {
        const container = document.getElementById('view-expenses');
        container.innerHTML = `
            <div class="card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem">
                    <h2>支出明細表</h2>
                    <button class="btn btn-primary" onclick="app.showExpenseModal()">+ 新增支出單</button>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>日期</th>
                                <th>項目/名稱</th>
                                <th>對象</th>
                                <th>金額</th>
                                <th>備註</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.store.transactions.filter(t => t.type === 'expense').map(t => `
                                <tr>
                                    <td>${t.date}</td>
                                    <td>${t.item}</td>
                                    <td>${t.payer}</td>
                                    <td style="color:var(--danger)">$${Number(t.amount).toLocaleString()}</td>
                                    <td>${t.note || '-'}</td>
                                    <td>
                                        <button class="btn btn-ghost" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="app.showExpenseModal('${t.id}')">編輯</button>
                                    </td>
                                </tr>
                            `).join('') || '<tr><td colspan="6" style="text-align:center">尚無支出紀錄</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    showExpenseModal(txId = null) {
        const modal = document.getElementById('modal-container');
        const content = document.getElementById('modal-content');
        const tx = txId ? this.store.transactions.find(t => t.id === txId) : null;

        content.innerHTML = `
            <h2 style="margin-bottom:1.5rem">${tx ? '編輯支出紀錄' : '支出單'}</h2>
            <form id="form-expense">
                <div class="form-group">
                    <label>支出項目</label>
                    <input type="text" name="item" value="${tx?.item || ''}" required>
                </div>
                <div class="form-grid">
                    <div class="form-group">
                        <label>日期</label>
                        <input type="date" name="date" value="${tx?.date || new Date().toISOString().split('T')[0]}" required>
                    </div>
                    <div class="form-group">
                        <label>支付對象 / 廠商</label>
                        <input type="text" name="payer" value="${tx?.payer || ''}" required>
                    </div>
                </div>
                <div class="form-group">
                    <label>金額</label>
                    <input type="number" name="amount" value="${tx?.amount || ''}" required>
                </div>
                <div class="form-group">
                    <label>備註</label>
                    <textarea name="note" rows="2">${tx?.note || ''}</textarea>
                </div>
                <div style="display:flex; gap:1rem; justify-content:flex-end; margin-top:1rem">
                    <button type="button" class="btn btn-ghost" onclick="app.closeModal()">取消</button>
                    <button type="submit" class="btn btn-primary">確認儲存</button>
                </div>
            </form>
        `;

        modal.classList.remove('hidden');

        document.getElementById('form-expense').onsubmit = (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            data.type = 'expense';
            if (txId) {
                this.store.updateTransaction(txId, data);
            } else {
                this.store.addTransaction(data);
            }
            this.closeModal();
            this.renderExpenses();
        };
    },

    renderReports() {
        const container = document.getElementById('view-reports');
        const transactions = this.store.transactions;
        const years = [...new Set(transactions.map(t => new Date(t.date).getFullYear()))].sort().reverse();

        let reportHtml = '';

        if (years.length === 0) {
            reportHtml = '<p style="text-align:center; color:var(--text-muted)">尚無資料可產生成報表</p>';
        } else {
            years.forEach(year => {
                const yearTxs = transactions.filter(t => new Date(t.date).getFullYear() === year);
                const income = yearTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
                const expense = yearTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);

                reportHtml += `
                    <div class="card">
                        <h3>${year} 年度收支報表</h3>
                        <div class="stats-grid" style="margin-top:1rem; margin-bottom:1rem">
                            <div class="stat-card">
                                <h3>總收入</h3>
                                <div class="value" style="color:var(--accent)">$${income.toLocaleString()}</div>
                            </div>
                            <div class="stat-card">
                                <h3>總支出</h3>
                                <div class="value" style="color:var(--danger)">$${expense.toLocaleString()}</div>
                            </div>
                            <div class="stat-card">
                                <h3>年度盈餘</h3>
                                <div class="value">$${(income - expense).toLocaleString()}</div>
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        container.innerHTML = `
            <div style="margin-bottom:2rem">
                ${reportHtml}
            </div>
        `;
    }
};

window.onload = () => app.init();
