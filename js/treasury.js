/**
 * NaloDAO Treasury Dashboard
 * Displays real-time balance from connected Freighter wallet
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
        
        // Parse balances
        let xlmBalance = 0;
        let usdcBalance = 0;
        let naloBalance = 0;
        let totalValue = 0;
        let otherAssets = [];
        
        accountData.balances.forEach(balance => {
            const amount = parseFloat(balance.balance);
            
            if (balance.asset_type === 'native') {
                // XLM (native asset)
                xlmBalance = amount;
                totalValue += amount * 0.10; // Assume $0.10 per XLM for demo
            } else {
                // Custom assets
                const assetCode = balance.asset_code;
                const assetIssuer = balance.asset_issuer;
                
                // Check for USDC
                if (assetCode === 'USDC' && CONFIG.knownAssets.USDC.includes(assetIssuer)) {
                    usdcBalance = amount;
                    totalValue += amount;
                }
                // Check for USDT
                else if (assetCode === 'USDT' && CONFIG.knownAssets.USDT.includes(assetIssuer)) {
                    totalValue += amount;
                    otherAssets.push({ code: assetCode, balance: amount });
                }
                // Check for NALO token
                else if (assetCode === CONFIG.naloAsset.code && assetIssuer === CONFIG.naloAsset.issuer) {
                    naloBalance = amount;
                }
                // Other assets
                else {
                    otherAssets.push({ code: assetCode, balance: amount });
                }
            }
        });
        
        // Update UI
        document.getElementById('xlmBalance').textContent = formatNumber(xlmBalance.toFixed(2)) + ' XLM';
        document.getElementById('usdcBalance').textContent = '$' + formatNumber(usdcBalance.toFixed(2));
        document.getElementById('totalValue').textContent = '$' + formatNumber(totalValue.toFixed(2));
        document.getElementById('naloBalance').textContent = formatNumber(naloBalance.toFixed(2)) + ' NALO';
        
        // Log other assets if any
        if (otherAssets.length > 0) {
            console.log('Other assets found:', otherAssets);
        }
        
        console.log('Balances updated:', { xlmBalance, usdcBalance, naloBalance, totalValue });
        
    } catch (error) {
        console.error('Error loading account data:', error);
        throw error;
    }
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
        let txAmount = '---';
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
                txType = 'Trustline';
                txAsset = op.asset_code || 'XLM';
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
