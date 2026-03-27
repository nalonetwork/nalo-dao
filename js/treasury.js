/**
 * NaloDAO Treasury Manager
 * Handles treasury data loading and display with wallet integration
 */

console.log('=== NaloDAO Treasury Manager Loading ===');

// Configuration
const TREASURY_CONFIG = {
    // NaloDAO Treasury Address
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

let userWalletData = {
    publicKey: null,
    balances: [],
    loaded: false
};

/**
 * Initialize Treasury Dashboard
 */
function initTreasuryDashboard() {
    console.log('Initializing Treasury Dashboard...');
    
    // Check if wallet is connected
    const isConnected = sessionStorage.getItem('nalo_wallet_connected') === 'true';
    const savedKey = sessionStorage.getItem('nalo_wallet_key');
    
    if (isConnected && savedKey) {
        console.log('Wallet connected, loading dashboard...');
        userWalletData.publicKey = savedKey;
        showDashboard();
        loadAllData();
    } else {
        console.log('No wallet connected, showing prompt...');
        showConnectPrompt();
    }
    
    console.log('✓ Treasury Dashboard initialized');
}

/**
 * Load all data (treasury + user wallet)
 */
async function loadAllData() {
    console.log('Loading all data...');
    
    // Load treasury data
    await loadTreasuryData();
    
    // Load user wallet data if connected
    if (userWalletData.publicKey) {
        await loadUserWalletData();
    }
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
 * Load user wallet data
 */
async function loadUserWalletData() {
    console.log('Loading user wallet data for:', userWalletData.publicKey);
    
    try {
        const response = await fetch(`${TREASURY_CONFIG.horizonUrl}/accounts/${userWalletData.publicKey}`);
        
        if (!response.ok) {
            throw new Error('Failed to load user wallet data');
        }
        
        const accountData = await response.json();
        console.log('User wallet data loaded:', accountData);
        
        userWalletData.balances = accountData.balances || [];
        userWalletData.loaded = true;
        
        // Update user wallet display
        updateUserWalletDisplay();
        
    } catch (error) {
        console.error('Failed to load user wallet data:', error);
        userWalletData.balances = [];
        userWalletData.loaded = false;
    }
}

/**
 * Update user wallet display
 */
function updateUserWalletDisplay() {
    console.log('Updating user wallet display');
    
    // Find XLM balance
    const xlmBalance = userWalletData.balances.find(b => b.asset_type === 'native');
    const xlmAmount = xlmBalance ? parseFloat(xlmBalance.balance) : 0;
    
    // Create or update user wallet section
    let userWalletSection = document.getElementById('userWalletSection');
    
    if (!userWalletSection) {
        // Create new section
        userWalletSection = document.createElement('div');
        userWalletSection.id = 'userWalletSection';
        userWalletSection.className = 'assets-section';
        userWalletSection.style.marginBottom = '2rem';
        
        // Insert before treasury assets section
        const assetsSection = document.querySelector('.assets-section');
        if (assetsSection && assetsSection.parentNode) {
            assetsSection.parentNode.insertBefore(userWalletSection, assetsSection);
        }
    }
    
    // Build HTML
    let html = `
        <div class="section-header">
            <h2>💼 Your Wallet</h2>
        </div>
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 2rem; border-radius: 10px; margin-bottom: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                <div>
                    <p style="font-size: 0.9rem; opacity: 0.9; margin-bottom: 0.5rem;">Connected Wallet</p>
                    <p style="font-family: monospace; font-size: 0.85rem; word-break: break-all;">${userWalletData.publicKey}</p>
                </div>
                <div style="text-align: right;">
                    <p style="font-size: 0.9rem; opacity: 0.9; margin-bottom: 0.5rem;">Balance</p>
                    <p style="font-size: 2rem; font-weight: bold;">${xlmAmount.toFixed(2)} XLM</p>
                    <p style="font-size: 0.9rem; opacity: 0.9;">≈ $${(xlmAmount * 0.12).toFixed(2)} USD</p>
                </div>
            </div>
            <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.2);">
                <a href="${TREASURY_CONFIG.stellarExpertUrl}/account/${userWalletData.publicKey}" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   style="color: white; text-decoration: none; opacity: 0.9; font-size: 0.9rem;">
                    View on Stellar Expert →
                </a>
            </div>
        </div>
    `;
    
    // Add assets table if user has multiple assets
    if (userWalletData.balances.length > 1) {
        html += `
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
        
        userWalletData.balances.forEach(balance => {
            const assetName = balance.asset_type === 'native' ? 'Stellar Lumens' : balance.asset_code;
            const assetCode = balance.asset_type === 'native' ? 'XLM' : balance.asset_code;
            const amount = parseFloat(balance.balance).toFixed(7);
            const type = balance.asset_type === 'native' ? 'Native' : 'Custom';
            
            html += `
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
        
        html += `
                </tbody>
            </table>
        `;
    }
    
    userWalletSection.innerHTML = html;
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
        console.log('Treasury account loaded:', account);
        
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
 * Update balances display (Treasury)
 */
function updateBalances(balances) {
    console.log('Updating treasury balances:', balances);
    
    // Find XLM balance
    const xlmBalance = balances.find(b => b.asset_type === 'native');
    const xlmAmount = xlmBalance ? parseFloat(xlmBalance.balance) : 0;
    
    // Update stats
    const totalBalanceEl = document.getElementById('totalBalance');
    const xlmBalanceEl = document.getElementById('xlmBalance');
    const totalAssetsEl = document.getElementById('totalAssets');
    
    if (totalBalanceEl) {
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
            <button onclick="loadTreasuryData()" style="margin-top: 1rem; padding: 0.75rem 1.5rem; background: var(--light-green); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                Try Again
            </button>
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

// Listen for wallet connection events from other tabs/windows
window.addEventListener('storage', function(e) {
    if (e.key === 'nalo_wallet_connected') {
        if (e.newValue === 'true') {
            const savedKey = sessionStorage.getItem('nalo_wallet_key');
            if (savedKey) {
                userWalletData.publicKey = savedKey;
                showDashboard();
                loadAllData();
            }
        } else {
            showConnectPrompt();
        }
    }
});

console.log('=== Treasury Manager Script Loaded ===');
