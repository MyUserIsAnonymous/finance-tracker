class FinancialTracker {
    constructor() {
        this.loadData();
        
        // Initialize PWA features
        this.initPWA();
    }

    loadData() {
        this.transactions = JSON.parse(localStorage.getItem('transactions')) || [];
        this.budgets = JSON.parse(localStorage.getItem('budgets')) || {
            'groceries': 300,
            'dining': 200,
            'entertainment': 150,
            'transportation': 100
        };
        
        // Load PWA settings
        this.pwaSettings = JSON.parse(localStorage.getItem('pwaSettings')) || {
            notifications: true,
            offlineMode: true,
            autoSync: false
        };
    }

    saveData() {
        localStorage.setItem('transactions', JSON.stringify(this.transactions));
        localStorage.setItem('budgets', JSON.stringify(this.budgets));
        localStorage.setItem('pwaSettings', JSON.stringify(this.pwaSettings));
        
        // PWA: Save timestamp for sync detection
        localStorage.setItem('lastSync', Date.now().toString());
    }

    // ============ PWA INITIALIZATION ============
    initPWA() {
        // Request notification permission
        if (this.pwaSettings.notifications && Notification.permission === "default") {
            setTimeout(() => {
                this.requestNotificationPermission();
            }, 2000);
        }
        
        // Check if running as installed PWA
        this.checkPWAStatus();
        
        // Setup online/offline handlers
        this.setupNetworkHandlers();
    }
    
    requestNotificationPermission() {
        if (confirm("Enable notifications for budget alerts and updates?")) {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    console.log("✅ Notifications enabled");
                    this.showNotification("Finance Tracker", "Notifications enabled! You'll get budget alerts.");
                }
            });
        }
    }
    
    checkPWAStatus() {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                           window.navigator.standalone === true;
        
        if (isStandalone) {
            console.log("📱 Running as installed PWA");
            document.title = "💰 Finance Tracker (App)";
            
            // Show PWA badge
            if ('setAppBadge' in navigator) {
                navigator.setAppBadge(this.transactions.length % 10);
            }
        }
    }
    
    setupNetworkHandlers() {
        window.addEventListener('online', () => {
            this.showStatusMessage("✅ Back online - changes saved", "online");
            
            // Try to sync if needed
            if (this.pwaSettings.autoSync) {
                this.syncData();
            }
        });
        
        window.addEventListener('offline', () => {
            this.showStatusMessage("⚡ Working offline - data saved locally", "offline");
        });
    }
    
    showStatusMessage(message, type) {
        const statusDiv = document.createElement('div');
        statusDiv.textContent = message;
        statusDiv.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 10px 20px;
            border-radius: 5px;
            color: white;
            z-index: 1000;
            font-size: 14px;
            animation: slideIn 0.3s ease;
            ${type === 'online' ? 'background: #10b981;' : 'background: #f59e0b;'}
        `;
        
        document.body.appendChild(statusDiv);
        setTimeout(() => statusDiv.remove(), 3000);
    }
    // ============================================

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
        
        // PWA: Show notification
        if (this.pwaSettings.notifications && Notification.permission === "granted") {
            this.showNotification(
                type === 'income' ? '💰 Income Added' : '💸 Expense Logged',
                `${category}: $${amount}`
            );
        }
        
        // PWA: Update app badge
        this.updateAppBadge();
        
        return transaction;
    }

    setBudget(category, amount) {
        this.budgets[category] = parseFloat(amount);
        this.saveData();
        this.updateUI();
        
        // PWA: Show notification
        if (this.pwaSettings.notifications && Notification.permission === "granted") {
            this.showNotification('📊 Budget Updated', `${category}: $${amount} budget set`);
        }
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
            
            // PWA: Budget alerts
            if (this.pwaSettings.notifications) {
                this.checkBudgetAlerts(category, spent, budget);
            }
        });
        return status;
    }
    
    // ============ PWA BUDGET ALERTS ============
    checkBudgetAlerts(category, spent, budget) {
        // Only show once per day per category
        const alertKey = `alert_${category}_${new Date().toDateString()}`;
        if (localStorage.getItem(alertKey)) return;
        
        if (spent > budget * 0.9 && spent <= budget) {
            // Budget almost exceeded (90%)
            this.showBudgetAlert(category, spent, budget, 'warning');
            localStorage.setItem(alertKey, 'true');
        } else if (spent > budget) {
            // Budget exceeded
            this.showBudgetAlert(category, spent, budget, 'exceeded');
            localStorage.setItem(alertKey, 'true');
        }
    }
    
    showBudgetAlert(category, spent, budget, type) {
        const messages = {
            warning: `⚠️ ${category} budget almost used! ($${spent.toFixed(2)} / $${budget.toFixed(2)})`,
            exceeded: `🚨 ${category} budget exceeded! ($${spent.toFixed(2)} / $${budget.toFixed(2)})`
        };
        
        // Show browser notification if allowed
        if (this.pwaSettings.notifications && Notification.permission === "granted") {
            this.showNotification('📊 Budget Alert', messages[type]);
        }
        
        // Show in-app alert with green theme
        const alertDiv = document.createElement('div');
        alertDiv.className = `card ${type === 'exceeded' ? 'alert' : ''}`;
        alertDiv.style.cssText = `
            background: ${type === 'exceeded' ? '#fee2e2' : '#fffbeb'};
            border-left: 4px solid ${type === 'exceeded' ? '#ef4444' : '#f59e0b'};
            margin: 10px 0;
            animation: slideIn 0.3s ease;
        `;
        alertDiv.innerHTML = `
            <strong>${type === 'exceeded' ? '🚨' : '⚠️'} ${category}</strong>
            <p>${messages[type]}</p>
            <button onclick="this.parentElement.remove()" style="background:#10b981;color:white;padding:5px 10px;border:none;border-radius:3px;cursor:pointer;">
                Dismiss
            </button>
        `;
        
        const container = document.querySelector('.container');
        if (container && !document.querySelector(`[data-alert="${category}"]`)) {
            alertDiv.setAttribute('data-alert', category);
            container.insertBefore(alertDiv, container.children[2]); // Insert after first card
        }
    }
    
    showNotification(title, body) {
        if (Notification.permission === "granted") {
            new Notification(title, {
                body: body,
                icon: 'icon-192.png',
                badge: 'icon-192.png',
                tag: 'finance-tracker',
                renotify: true,
                silent: false
            });
        }
    }
    
    updateAppBadge() {
        if ('setAppBadge' in navigator) {
            // Show transaction count badge
            const count = this.transactions.length % 10;
            if (count > 0) {
                navigator.setAppBadge(count);
            } else {
                navigator.clearAppBadge();
            }
        }
    }
    
    syncData() {
        // Placeholder for future cloud sync
        console.log('Syncing data...');
        // This would sync with a backend server if you add one later
    }
    // ===========================================

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
        
        // PWA: Show confirmation
        this.showStatusMessage('✅ CSV exported successfully!', 'online');
    }

    clearAllData() {
        if (confirm('Are you sure you want to clear all data? This cannot be undone!')) {
            localStorage.clear();
            this.loadData();
            this.updateUI();
            
            // PWA: Clear badge
            if ('clearAppBadge' in navigator) {
                navigator.clearAppBadge();
            }
            
            this.showStatusMessage('🗑️ All data cleared', 'offline');
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
        
        // PWA: Update install button if needed
        this.updateInstallButton();
    }
    
    // ============ PWA INSTALL BUTTON ============
    updateInstallButton() {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
        const installContainer = document.getElementById('installContainer');
        
        if (installContainer && !isStandalone) {
            // Check if PWA is installable but not installed
            if (window.deferredPrompt && installContainer.style.display === 'none') {
                installContainer.style.display = 'block';
            }
        }
    }
}

// Initialize tracker
const tracker = new FinancialTracker();
tracker.updateUI();

// ============ PWA INSTALL HANDLERS ============
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    window.deferredPrompt = deferredPrompt; // Make available globally
    
    // Show custom install button
    const installContainer = document.getElementById('installContainer');
    if (installContainer) {
        installContainer.style.display = 'block';
    }
    
    // Also add to tracker for access
    tracker.deferredPrompt = deferredPrompt;
    
    console.log('📱 PWA ready to install');
});

function installApp() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User installed the app');
                const installContainer = document.getElementById('installContainer');
                if (installContainer) {
                    installContainer.innerHTML = 
                        '<p style="color:#10b981;padding:10px;background:#d1fae5;border-radius:5px;">✅ App installed! Check your home screen.</p>';
                }
            }
            deferredPrompt = null;
            window.deferredPrompt = null;
        });
    }
}
// ==============================================

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

// ============ PWA SETTINGS FUNCTIONS ============
function toggleNotifications() {
    tracker.pwaSettings.notifications = !tracker.pwaSettings.notifications;
    tracker.saveData();
    
    if (tracker.pwaSettings.notifications && Notification.permission === "default") {
        tracker.requestNotificationPermission();
    }
    
    tracker.showStatusMessage(
        tracker.pwaSettings.notifications ? '🔔 Notifications enabled' : '🔕 Notifications disabled',
        'online'
    );
}

function toggleOfflineMode() {
    tracker.pwaSettings.offlineMode = !tracker.pwaSettings.offlineMode;
    tracker.saveData();
    
    tracker.showStatusMessage(
        tracker.pwaSettings.offlineMode ? '⚡ Offline mode enabled' : '🌐 Offline mode disabled',
        tracker.pwaSettings.offlineMode ? 'offline' : 'online'
    );
}

// Add CSS animation for alerts
if (!document.querySelector('#pwa-animations')) {
    const style = document.createElement('style');
    style.id = 'pwa-animations';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}
