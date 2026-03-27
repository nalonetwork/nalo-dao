/**
 * NaloDAO Treasury Manager
 * Handles treasury data loading and display
 */

console.log('=== NaloDAO Treasury Manager Loading ===');

// Configuration
const TREASURY_CONFIG = {
    // Replace with your actual treasury address
    treasuryAddress: 'GCZYLNGU4CA5NAWBAVTHMZH4JKXRCHLGO5CBFZXZRGDIGVQOHFKTI3JY',
    horizonUrl: 'https://horizon.stellar.org',
    stellarExpertUrl: 'https://stellar.expert/explorer/public'
};

// State
let treasuryData = {
    balances: [],
    transactions: [],
    loaded: false
};

/**
 * Initialize Treasury Dashboard
 */
function initTreasuryDashboard() {
    console.log('Initializing Treasury Dashboard...');
    
    // Check if wallet is connected
    const isConnected = sessionStorage.getItem('nalo_wallet_connected') === 'true';
    
    if (isConnected) {
        showDashboard();
        loadTreasuryData();
    } else {
        showConnectPrompt();
    }
    
    // Set up connect button
    const connectBtn = document.getElementById('connectBtn');
    if (connectBtn) {
        connectBtn.onclick = handleWalletConnect;
    }
    
    console.log('✓ Treasury Dashboard initialized');
}

/**
 * Show connect prompt
 */
function showConnectPrompt() {
    const connectPrompt = document.getElementById('connectPrompt');
    const dashboardContent = document.getElementById('dashboardContent');
    
    if (connectPrompt) connectPrompt.style.display = 'block';
    if (dashboardContent) dashboardContent.style.display = 'none';
}

/**
 * Show dashboard
 */
function showDashboard() {
    const connectPrompt = document.getElementById('connectPrompt');
    const dashboardContent = document.getElementById('dashboardContent');
    
    if (connectPrompt) connectPrompt.style.display = 'none';
    if (dashboardContent) dashboardContent.style.display = 'block';
    
    // Display treasury address
    const treasuryAddressEl = document.getElementById('treasuryAddress');
    if (treasuryAddressEl) {
        treasuryAddressEl.textContent = TREASURY_CONFIG.treasuryAddress;
    }
}

/**
 * Load treasury data from Stellar
 */
async function loadTreasuryData() {
    console.log('Loading treasury data...');
    
    try {
        // Initialize Stellar Server
        const server = new StellarSdk.Server(TREASURY_CONFIG.horizonUrl);
        
        // Load account data
        const account = await server.loadAccount(TREASURY_CONFIG.treasuryAddress);
        console.log('Account loaded:', account);
        
        // Update balances
        updateBalances(account.balances);
        
        // Load transactions
        const transactions = await server.transactions()
            .forAccount(TREASURY_CONFIG.treasuryAddress)
            .order('desc')
            .limit(10)
            .call();
        
        console.log('Transactions loaded:', transactions);
        updateTransactions(transactions.records);
        
        treasuryData.loaded = true;
        
    } catch (error) {
        console.error('Failed to load treasury data:', error);
        showError('Failed to load treasury data. Please try again.');
    }
}

/**
 * Update balances display
 */
function updateBalances(balances) {
    console.log('Updating balances:', balances);
    
    // Find XLM balance
    const xlmBalance = balances.find(b => b.asset_type === 'native');
    const xlmAmount = xlmBalance ? parseFloat(xlmBalance.balance) : 0;
    
    // Update stats
    const totalBalanceEl = document.getElementById('totalBalance');
    const xlmBalanceEl = document.getElementById('xlmBalance');
    const totalAssetsEl = document.getElementById('totalAssets');
    
    if (totalBalanceEl) {
        // Approximate USD value (you'd want to fetch real price)
        const usdValue = (xlmAmount * 0.12).toFixed(2);
        totalBalanceEl.textContent = `$${usdValue}`;
    }
    
    if (xlmBalanceEl) {
        xlmBalanceEl.textContent = xlmAmount.toFixed(2);
    }
    
    if (totalAssetsEl) {
        totalAssetsEl.textContent = balances.length;
    }
    
    // Update assets table
    const assetsContent = document.getElementById('assetsContent');
    if (!assetsContent) return;
    
    if (balances.length === 0) {
        assetsContent.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">💰</div>
                <p>No assets found in treasury</p>
            </div>
        `;
        return;
    }
    
    let tableHTML = `
        <table class="assets-table">
            <thead>
                <tr>
                    <th>Asset</th>
                    <th>Balance</th>
                    <th>Type</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    balances.forEach(balance => {
        const assetName = balance.asset_type === 'native' ? 'Stellar Lumens' : balance.asset_code;
        const assetCode = balance.asset_type === 'native' ? 'XLM' : balance.asset_code;
        const amount = parseFloat(balance.balance).toFixed(7);
        const type = balance.asset_type === 'native' ? 'Native' : 'Custom';
        
        tableHTML += `
            <tr>
                <td>
                    <div class="asset-name">${assetName}</div>
                    <div class="asset-code">${assetCode}</div>
                </td>
                <td>${amount}</td>
                <td>${type}</td>
            </tr>
        `;
    });
    
    tableHTML += `
            </tbody>
        </table>
    `;
    
    assetsContent.innerHTML = tableHTML;
}

/**
 * Update transactions display
 */
function updateTransactions(transactions) {
    console.log('Updating transactions:', transactions);
    
    // Update transaction count
    const totalTransactionsEl = document.getElementById('totalTransactions');
    if (totalTransactionsEl) {
        totalTransactionsEl.textContent = transactions.length;
    }
    
    // Update transactions table
    const transactionsContent = document.getElementById('transactionsContent');
    if (!transactionsContent) return;
    
    if (transactions.length === 0) {
        transactionsContent.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📜</div>
                <p>No transactions found</p>
            </div>
        `;
        return;
    }
    
    let tableHTML = `
        <table class="transactions-table">
            <thead>
                <tr>
                    <th>Type</th>
                    <th>Hash</th>
                    <th>Date</th>
                    <th>Operations</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    transactions.forEach(tx => {
        const date = new Date(tx.created_at).toLocaleDateString();
        const hash = tx.hash.substring(0, 8) + '...';
        const type = tx.successful ? 'payment' : 'create';
        const operations = tx.operation_count;
        
        tableHTML += `
            <tr>
                <td><span class="tx-type ${type}">${type}</span></td>
                <td>
                    <a href="${TREASURY_CONFIG.stellarExpertUrl}/tx/${tx.hash}" 
                       target="_blank" 
                       rel="noopener noreferrer"
                       class="tx-hash">
                        ${hash}
                    </a>
                </td>
                <td>${date}</td>
                <td>${operations}</td>
            </tr>
        `;
    });
    
    tableHTML += `
            </tbody>
        </table>
    `;
    
    transactionsContent.innerHTML = tableHTML;
}

/**
 * Show error message
 */
function showError(message) {
    const assetsContent = document.getElementById('assetsContent');
    const transactionsContent = document.getElementById('transactionsContent');
    
    const errorHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">⚠️</div>
            <p>${message}</p>
        </div>
    `;
    
    if (assetsContent) assetsContent.innerHTML = errorHTML;
    if (transactionsContent) transactionsContent.innerHTML = errorHTML;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTreasuryDashboard);
} else {
    initTreasuryDashboard();
}

// Listen for wallet connection events
window.addEventListener('storage', function(e) {
    if (e.key === 'nalo_wallet_connected') {
        if (e.newValue === 'true') {
            showDashboard();
            loadTreasuryData();
        } else {
            showConnectPrompt();
        }
    }
});

console.log('=== Treasury Manager Script Loaded ===');
