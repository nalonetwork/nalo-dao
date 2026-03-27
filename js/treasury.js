/**
 * NaloDAO Treasury Dashboard
 * Displays complete account balance from connected Freighter wallet
 */

console.log('=== Treasury Dashboard Loading ===');

// Configuration
const CONFIG = {
    // Use testnet for development
    network: 'TESTNET',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    
    // NALO token details (update when token is issued)
    naloAsset: {
        code: 'NALO',
        issuer: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
    },
    
    // Known stablecoin issuers on testnet
    knownAssets: {
        'USDC': ['GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'],
        'USDT': ['GCQTGZQQ5G4PTM2GL7CDIFKUBIPEC52BROAQIAPW53XBRJVN6ZJVTG6V']
    },
    
    // Asset price estimates (for demo - in production, fetch from price API)
    assetPrices: {
        'XLM': 0.10,
        'USDC': 1.00,
        'USDT': 1.00,
        'BTC': 70000.00,
        'ETH': 3500.00
    }
};

// Initialize Stellar SDK
const server = new StellarSdk.Horizon.Server(CONFIG.horizonUrl);

// Dashboard state
let connectedWallet = null;
let accountData = null;
let refreshInterval = null;

/**
 * Initialize dashboard
 */
async function initDashboard() {
    console.log('Initializing treasury dashboard...');
    
    // Set up wallet button
    const walletBtn = document.getElementById('walletBtn');
    walletBtn.onclick = connectWallet;
    
    // Check for existing wallet connection
    checkExistingConnection();
}

/**
 * Check for existing wallet connection
 */
function checkExistingConnection() {
    const savedKey = sessionStorage.getItem('nalo_wallet_key');
    const wasConnected = sessionStorage.getItem('nalo_wallet_connected');
    
    if (wasConnected === 'true' && savedKey && isValidStellarAddress(savedKey)) {
        console.log('Restoring wallet connection...');
        connectedWallet = savedKey;
        updateWalletButton(true);
        showDashboard();
    }
}

/**
 * Validate Stellar address format
 */
function isValidStellarAddress(address) {
    return /^G[A-Z2-7]{55}$/.test(address);
}

/**
 * Connect wallet
 */
async function connectWallet() {
    try {
        console.log('Connecting wallet...');
        
        // Check for Freighter
        if (typeof window.freighterApi === 'undefined') {
            alert('Please install Freighter wallet extension to connect.\n\nVisit: https://www.freighter.app/');
            window.open('https://www.freighter.app/', '_blank');
            return;
        }
        
        // Get public key
        const publicKey = await window.freighterApi.getPublicKey();
        console.log('Wallet connected:', publicKey);
        
        // Validate address
        if (!isValidStellarAddress(publicKey)) {
            throw new Error('Invalid Stellar address received from wallet');
        }
        
        // Store connection
        connectedWallet = publicKey;
        sessionStorage.setItem('nalo_wallet_connected', 'true');
        sessionStorage.setItem('nalo_wallet_key', publicKey);
        
        // Update UI
        updateWalletButton(true);
        showDashboard();
        
    } catch (error) {
        console.error('Wallet connection failed:', error);
        
        let errorMsg = 'Failed to connect wallet. Please try again.';
        if (error.message.includes('User declined')) {
            errorMsg = 'Connection declined. Please approve the connection in Freighter.';
        }
        
        alert(errorMsg);
    }
}

/**
 * Update wallet button state
 */
function updateWalletButton(connected) {
    const walletBtn = document.getElementById('walletBtn');
    if (connected) {
        walletBtn.textContent = '✓ Connected';
        walletBtn.classList.add('wallet-connected');
    } else {
        walletBtn.textContent = 'Connect Wallet';
        walletBtn.classList.remove('wallet-connected');
    }
}

/**
 * Show dashboard content
 */
function showDashboard() {
    document.getElementById('connectPrompt').style.display = 'none';
    document.getElementById('dashboardContent').style.display = 'block';
    
    // Display connected wallet address
    document.getElementById('connectedAddress').textContent = connectedWallet;
    
    // Load dashboard data
    loadDashboardData();
    
    // Set up auto-refresh every 30 seconds
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    refreshInterval = setInterval(() => {
        console.log('Auto-refreshing dashboard data...');
        loadDashboardData();
    }, 30000);
}

/**
 * Load all dashboard data
 */
async function loadDashboardData() {
    console.log('Loading dashboard data for wallet:', connectedWallet);
    
    try {
        // Load account data
        await loadAccountData();
        
        // Load recent transactions
        await loadRecentTransactions();
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        
        if (error.response && error.response.status === 404) {
            showError('This wallet has not been activated on the Stellar network yet. You need to fund it with at least 1 XLM to activate it.');
        } else {
            showError('Failed to load dashboard data. Please refresh the page or try again later.');
        }
    }
}

/**
 * Load account data from Stellar
 */
async function loadAccountData() {
    try {
        console.log('Loading account data...');
        
        // Load account from Stellar
        accountData = await server.loadAccount(connectedWallet);
        
        console.log('Account data loaded:', accountData);
        
        // Parse all balances
        let xlmBalance = 0;
        let totalValue = 0;
        let allAssets = [];
        
        accountData.balances.forEach(balance => {
            const amount = parseFloat(balance.balance);
            
            if (balance.asset_type === 'native') {
                // XLM (native asset)
                xlmBalance = amount;
                const xlmValue = amount * (CONFIG.assetPrices.XLM || 0.10);
                totalValue += xlmValue;
                
                allAssets.push({
                    code: 'XLM',
                    issuer: 'Native',
                    balance: amount,
                    value: xlmValue,
                    type: 'native',
                    limit: null
                });
            } else {
                // Custom assets
                const assetCode = balance.asset_code;
                const assetIssuer = balance.asset_issuer;
                const assetLimit = balance.limit ? parseFloat(balance.limit) : null;
                
                // Estimate value
                let assetValue = 0;
                if (CONFIG.assetPrices[assetCode]) {
                    assetValue = amount * CONFIG.assetPrices[assetCode];
                    totalValue += assetValue;
                }
                
                allAssets.push({
                    code: assetCode,
                    issuer: assetIssuer,
                    balance: amount,
                    value: assetValue,
                    type: 'custom',
                    limit: assetLimit
                });
            }
        });
        
        // Sort assets: XLM first, then by balance value
        allAssets.sort((a, b) => {
            if (a.type === 'native') return -1;
            if (b.type === 'native') return 1;
            return b.value - a.value;
        });
        
        // Update summary stats
        const usdcAsset = allAssets.find(a => a.code === 'USDC');
        const naloAsset = allAssets.find(a => a.code === CONFIG.naloAsset.code);
        
        document.getElementById('xlmBalance').textContent = formatNumber(xlmBalance.toFixed(2)) + ' XLM';
        document.getElementById('usdcBalance').textContent = '$' + formatNumber((usdcAsset?.balance || 0).toFixed(2));
        document.getElementById('totalValue').textContent = '$' + formatNumber(totalValue.toFixed(2));
        document.getElementById('naloBalance').textContent = formatNumber((naloAsset?.balance || 0).toFixed(2)) + ' NALO';
        document.getElementById('totalAssets').textContent = allAssets.length;
        
        // Display all assets in detailed view
        displayAllAssets(allAssets);
        
        console.log('Account data processed:', { 
            totalAssets: allAssets.length, 
            totalValue, 
            xlmBalance 
        });
        
    } catch (error) {
        console.error('Error loading account data:', error);
        throw error;
    }
}

/**
 * Display all assets in detailed table
 */
function displayAllAssets(assets) {
    const tbody = document.getElementById('assetsTableBody');
    tbody.innerHTML = '';
    
    if (assets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #666;">No assets found in this wallet.</td></tr>';
        return;
    }
    
    assets.forEach(asset => {
        const row = document.createElement('tr');
        
        // Asset Code
        const codeCell = document.createElement('td');
        const codeDiv = document.createElement('div');
        codeDiv.style.display = 'flex';
        codeDiv.style.alignItems = 'center';
        codeDiv.style.gap = '0.5rem';
        
        const assetIcon = document.createElement('span');
        assetIcon.style.fontSize = '1.5rem';
        assetIcon.textContent = getAssetIcon(asset.code);
        
        const assetName = document.createElement('strong');
        assetName.textContent = asset.code;
        
        codeDiv.appendChild(assetIcon);
        codeDiv.appendChild(assetName);
        codeCell.appendChild(codeDiv);
        row.appendChild(codeCell);
        
        // Balance
        const balanceCell = document.createElement('td');
        balanceCell.className = 'asset-balance';
        balanceCell.textContent = formatNumber(asset.balance.toFixed(7));
        row.appendChild(balanceCell);
        
        // Value (USD)
        const valueCell = document.createElement('td');
        valueCell.className = 'asset-value';
        if (asset.value > 0) {
            valueCell.textContent = '$' + formatNumber(asset.value.toFixed(2));
        } else {
            valueCell.textContent = '—';
            valueCell.style.color = '#999';
        }
        row.appendChild(valueCell);
        
        // Type
        const typeCell = document.createElement('td');
        const typeSpan = document.createElement('span');
        typeSpan.className = 'asset-type-badge';
        typeSpan.textContent = asset.type === 'native' ? 'Native' : 'Custom';
        typeSpan.style.background = asset.type === 'native' ? '#d4edda' : '#d1ecf1';
        typeSpan.style.color = asset.type === 'native' ? '#155724' : '#0c5460';
        typeCell.appendChild(typeSpan);
        row.appendChild(typeCell);
        
        // Issuer
        const issuerCell = document.createElement('td');
        if (asset.type === 'native') {
            issuerCell.textContent = 'Stellar Network';
            issuerCell.style.color = '#666';
        } else {
            const issuerLink = document.createElement('a');
            issuerLink.href = `https://stellar.expert/explorer/testnet/account/${asset.issuer}`;
            issuerLink.target = '_blank';
            issuerLink.rel = 'noopener noreferrer';
            issuerLink.className = 'issuer-link';
            issuerLink.textContent = asset.issuer.substring(0, 8) + '...' + asset.issuer.substring(asset.issuer.length - 8);
            issuerCell.appendChild(issuerLink);
        }
        row.appendChild(issuerCell);
        
        tbody.appendChild(row);
    });
    
    // Show the assets section
    document.getElementById('assetsSection').style.display = 'block';
}

/**
 * Get emoji icon for asset
 */
function getAssetIcon(assetCode) {
    const icons = {
        'XLM': '⭐',
        'USDC': '💵',
        'USDT': '💵',
        'BTC': '₿',
        'ETH': 'Ξ',
        'NALO': '🪙'
    };
    return icons[assetCode] || '🔷';
}

/**
 * Load recent transactions
 */
async function loadRecentTransactions() {
    try {
        console.log('Loading recent transactions...');
        
        // Get transactions
        const transactions = await server.transactions()
            .forAccount(connectedWallet)
            .order('desc')
            .limit(10)
            .call();
        
        console.log('Transactions loaded:', transactions.records.length);
        
        // Update transaction count
        document.getElementById('totalTransactions').textContent = transactions.records.length;
        
        // Get operations for each transaction to show details
        const transactionsWithDetails = await Promise.all(
            transactions.records.map(async (tx) => {
                try {
                    const operations = await server.operations()
                        .forTransaction(tx.id)
                        .call();
                    return { tx, operations: operations.records };
                } catch (error) {
                    console.error('Error loading operations for tx:', tx.id, error);
                    return { tx, operations: [] };
                }
            })
        );
        
        // Display transactions
        displayTransactions(transactionsWithDetails);
        
    } catch (error) {
        console.error('Error loading transactions:', error);
        document.getElementById('transactionsLoading').style.display = 'none';
        document.getElementById('transactionsError').style.display = 'block';
        document.getElementById('transactionsError').textContent = 
            'Failed to load transactions. Please try again later.';
    }
}

/**
 * Display transactions in table
 */
function displayTransactions(transactionsWithDetails) {
    const tbody = document.getElementById('transactionsBody');
    tbody.innerHTML = '';
    
    // Hide loading
    document.getElementById('transactionsLoading').style.display = 'none';
    
    if (transactionsWithDetails.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #666;">No transactions found. This wallet has not made any transactions yet.</td></tr>';
        document.getElementById('transactionsTable').style.display = 'table';
        return;
    }
    
    transactionsWithDetails.forEach(({ tx, operations }) => {
        const row = document.createElement('tr');
        
        // Date
        const date = new Date(tx.created_at);
        const dateCell = document.createElement('td');
        dateCell.textContent = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        row.appendChild(dateCell);
        
        // Type and Amount from operations
        let txType = 'Unknown';
        let txAmount = '—';
        let txAsset = 'XLM';
        
        if (operations.length > 0) {
            const op = operations[0]; // Use first operation
            
            if (op.type === 'payment') {
                txType = op.to === connectedWallet ? 'Received' : 'Sent';
                txAmount = parseFloat(op.amount).toFixed(2);
                txAsset = op.asset_type === 'native' ? 'XLM' : op.asset_code;
            } else if (op.type === 'create_account') {
                txType = 'Account Created';
                txAmount = parseFloat(op.starting_balance).toFixed(2);
            } else if (op.type === 'change_trust') {
                txType = 'Trustline Added';
                txAsset = op.asset_code || 'XLM';
                txAmount = '—';
            } else if (op.type === 'manage_buy_offer' || op.type === 'manage_sell_offer') {
                txType = 'Trade';
            } else {
                txType = op.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            }
        }
        
        // Type
        const typeCell = document.createElement('td');
        const typeSpan = document.createElement('span');
        typeSpan.className = 'tx-type ' + (txType === 'Received' ? 'incoming' : 'outgoing');
        typeSpan.textContent = txType;
        typeCell.appendChild(typeSpan);
        row.appendChild(typeCell);
        
        // Amount
        const amountCell = document.createElement('td');
        amountCell.className = 'tx-amount';
        amountCell.textContent = txAmount;
        row.appendChild(amountCell);
        
        // Asset
        const assetCell = document.createElement('td');
        assetCell.textContent = txAsset;
        row.appendChild(assetCell);
        
        // Hash with link to Stellar Expert
        const hashCell = document.createElement('td');
        const hashLink = document.createElement('a');
        hashLink.href = `https://stellar.expert/explorer/testnet/tx/${tx.hash}`;
        hashLink.target = '_blank';
        hashLink.rel = 'noopener noreferrer';
        hashLink.className = 'tx-hash';
        hashLink.textContent = tx.hash.substring(0, 8) + '...' + tx.hash.substring(tx.hash.length - 8);
        hashCell.appendChild(hashLink);
        row.appendChild(hashCell);
        
        tbody.appendChild(row);
    });
    
    // Show table
    document.getElementById('transactionsTable').style.display = 'table';
}

/**
 * Show error message
 */
function showError(message) {
    const errorDiv = document.getElementById('transactionsError');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
    
    // Also show in stats
    document.getElementById('xlmBalance').textContent = 'Not Activated';
    document.getElementById('usdcBalance').textContent = 'Not Activated';
    document.getElementById('totalValue').textContent = 'Not Activated';
    document.getElementById('naloBalance').textContent = '0.00 NALO';
    document.getElementById('totalAssets').textContent = '0';
}

/**
 * Format number with commas
 */
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Cleanup on page unload
 */
window.addEventListener('beforeunload', () => {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
} else {
    initDashboard();
}

console.log('=== Treasury Dashboard Script Loaded ===');
