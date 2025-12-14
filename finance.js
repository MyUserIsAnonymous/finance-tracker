class FinancialTracker {
    constructor() {
        this.loadData();
    }

    loadData() {
        this.transactions = JSON.parse(localStorage.getItem('transactions')) || [];
        this.budgets = JSON.parse(localStorage.getItem('budgets')) || {
            'groceries': 300,
            'dining': 200,
            'entertainment': 150,
            'transportation': 100
        };
    }

    saveData() {
        localStorage.setItem('transactions', JSON.stringify(this.transactions));
        localStorage.setItem('budgets', JSON.stringify(this.budgets));
    }

    addTransaction(type, category, description, amount) {
        const transaction = {
            id: Date.now(),
            date: new Date().toISOString().split('T')[0],
            type,
            category,
            description,
            amount: parseFloat(amount)
        };
        this.transactions.push(transaction);
        this.saveData();
        this.updateUI();
        return transaction;
    }

    setBudget(category, amount) {
        this.budgets[category] = parseFloat(amount);
        this.saveData();
        this.updateUI();
    }

    getCurrentMonthTransactions() {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        return this.transactions.filter(t => {
            const date = new Date(t.date);
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        });
    }

    getBalance() {
        const currentMonth = this.getCurrentMonthTransactions();
        const income = currentMonth.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const expenses = currentMonth.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        return income - expenses;
    }

    getCategorySpending() {
        const currentMonth = this.getCurrentMonthTransactions();
        const spending = {};
        currentMonth.forEach(t => {
            if (t.type === 'expense') {
                spending[t.category] = (spending[t.category] || 0) + t.amount;
            }
        });
        return spending;
    }

    checkBudgets() {
        const spending = this.getCategorySpending();
        const status = {};
        Object.keys(this.budgets).forEach(category => {
            const spent = spending[category] || 0;
            const budget = this.budgets[category];
            status[category] = {
                spent,
                budget,
                remaining: budget - spent,
                percentage: (spent / budget * 100) || 0,
                overBudget: spent > budget
            };
        });
        return status;
    }

    exportToCSV() {
        const headers = ['Date', 'Type', 'Category', 'Description', 'Amount'];
        const rows = this.transactions.map(t => [
            t.date,
            t.type,
            t.category,
            t.description,
            t.amount.toFixed(2)
        ]);
        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'transactions.csv';
        a.click();
    }

    clearAllData() {
        if (confirm('Are you sure you want to clear all data? This cannot be undone!')) {
            localStorage.clear();
            this.loadData();
            this.updateUI();
        }
    }

    updateUI() {
        // Update balance
        const balance = this.getBalance();
        document.getElementById('balance').textContent = `$${balance.toFixed(2)}`;
        document.getElementById('balance').className = balance >= 0 ? 'positive' : 'negative';

        // Update expenses and income
        const currentMonth = this.getCurrentMonthTransactions();
        const expenses = currentMonth.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        const income = currentMonth.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        document.getElementById('expenses').textContent = `$${expenses.toFixed(2)}`;
        document.getElementById('income').textContent = `$${income.toFixed(2)}`;

        // Update budget status
        const budgetStatus = this.checkBudgets();
        const budgetHTML = Object.entries(budgetStatus).map(([category, status]) => `
            <div class="card ${status.overBudget ? 'alert' : ''}" style="margin: 10px 0;">
                <strong>${category}</strong>
                <div>Spent: $${status.spent.toFixed(2)} / Budget: $${status.budget.toFixed(2)}</div>
                <div>Remaining: $${status.remaining.toFixed(2)}</div>
                <div class="progress-bar">
                    <div class="progress-fill ${status.overBudget ? 'over-budget' : ''}" 
                         style="width: ${Math.min(status.percentage, 100)}%">
                    </div>
                </div>
            </div>
        `).join('');
        document.getElementById('budgetStatus').innerHTML = budgetHTML;

        // Update recent transactions
        const recentTransactions = this.transactions.slice(-10).reverse();
        const transactionsHTML = recentTransactions.map(t => `
            <div style="padding: 10px; border-bottom: 1px solid #eee;">
                <span style="color: ${t.type === 'income' ? '#10b981' : '#ef4444'}">
                    ${t.type === 'income' ? '+' : '-'}$${t.amount.toFixed(2)}
                </span>
                <strong>${t.category}</strong>: ${t.description}
                <small style="color: #666;">${t.date}</small>
            </div>
        `).join('');
        document.getElementById('transactions').innerHTML = transactionsHTML;
    }
}

// Initialize tracker
const tracker = new FinancialTracker();
tracker.updateUI();

// Functions for HTML buttons
function addTransaction() {
    const type = document.getElementById('type').value;
    const category = document.getElementById('category').value;
    const description = document.getElementById('description').value;
    const amount = document.getElementById('amount').value;

    if (!category || !description || !amount || amount <= 0) {
        alert('Please fill in all fields with valid values');
        return;
    }

    tracker.addTransaction(type, category, description, amount);
    
    // Clear inputs
    document.getElementById('description').value = '';
    document.getElementById('amount').value = '';
}

function setBudget() {
    const category = document.getElementById('budgetCategory').value;
    const amount = document.getElementById('budgetAmount').value;

    if (!category || !amount || amount <= 0) {
        alert('Please enter valid budget category and amount');
        return;
    }

    tracker.setBudget(category, amount);
    document.getElementById('budgetCategory').value = '';
    document.getElementById('budgetAmount').value = '';
}

function exportData() {
    tracker.exportToCSV();
}

function clearData() {
    tracker.clearAllData();
}
