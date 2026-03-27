/**
 * NaloDAO Treasury Dashboard
 * Displays real-time treasury data from Stellar blockchain
 */

console.log('=== Treasury Dashboard Loading ===');

// Configuration
const CONFIG = {
    // Use testnet for development
    network: 'TESTNET',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    
    // Treasury wallet address (replace with your actual testnet address)
    treasuryAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    
    // NALO token details (will be set up later)
    naloAsset: {
        code: 'NALO',
        issuer: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
    }
};

// Initialize Stellar SDK
const server = new StellarSdk.Horizon.Server(CONFIG.horizonUrl);

// Dashboard state
let connectedWallet = null;
let treasuryData = null;

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
    
    if (wasConnected === 'true' && savedKey) {
        console.log('Restoring wallet connection...');
        connectedWallet = savedKey;
        updateWalletButton(true);
        showDashboard();
    }
}

/**
 * Connect wallet
 */
async function connectWallet() {
    try {
        console.log('Connecting wallet...');
        
        // Check for Freighter
        if (typeof window.freighterApi === 'undefined') {
            alert('Please install Freighter wallet extension to connect.');
            window.open('https://www.freighter.app/', '_blank');
            return;
        }
        
        // Get public key
        const publicKey = await window.freighterApi.getPublicKey();
        console.log('Wallet connected:', publicKey);
        
        // Store connection
        connectedWallet = publicKey;
        sessionStorage.setItem('nalo_wallet_connected', 'true');
        sessionStorage.setItem('nalo_wallet_key', publicKey);
        
        // Update UI
        updateWalletButton(true);
        showDashboard();
        
    } catch (error) {
        console.error('Wallet connection failed:', error);
        alert('Failed to connect wallet. Please try again.');
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
}

/**
 * Load all dashboard data
 */
async function loadDashboardData() {
    console.log('Loading dashboard data...');
    
    try {
        // Load treasury data
        await loadTreasuryBalance();
        
        // Load user's NALO balance
        await loadUserBalance();
        
        // Load recent transactions
        await loadRecentTransactions();
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showError('Failed to load dashboard data. Please refresh the page.');
    }
}

/**
 * Load treasury balance
 */
async function loadTreasuryBalance() {
    try {
        console.log('Loading treasury balance...');
        
        // For demo purposes, use connected wallet as "treasury"
        // In production, this would be your actual multi-sig treasury address
        const accountToCheck = CONFIG.treasuryAddress.startsWith('GX') 
            ? connectedWallet 
            : CONFIG.treasuryAddress;
        
        const account = await server.loadAccount(accountToCheck);
        
        let xlmBalance = 0;
        let usdcBalance = 0;
        let totalValue = 0;
        
        // Parse balances
        account.balances.forEach(balance => {
            if (balance.asset_type === 'native') {
                xlmBalance = parseFloat(balance.balance);
                totalValue += xlmBalance * 0.10; // Assume $0.10 per XLM
            } else if (balance.asset_code === 'USDC') {
                usdcBalance = parseFloat(balance.balance);
                totalValue += usdcBalance;
            }
        });
        
        // Update UI
        document.getElementById('xlmBalance').textContent = xlmBalance.toFixed(2) + ' XLM';
        document.getElementById('usdcBalance').textContent = '$' + usdcBalance.toFixed(2);
        document.getElementById('totalValue').textContent = '$' + totalValue.toFixed(2);
        
        console.log('Treasury balance loaded:', { xlmBalance, usdcBalance, totalValue });
        
    } catch (error) {
        console.error('Error loading treasury balance:', error);
        document.getElementById('xlmBalance').textContent = 'Error';
        document.getElementById('usdcBalance').textContent = 'Error';
        document.getElementById('totalValue').textContent = 'Error';
    }
}

/**
 * Load user's NALO token balance
 */
async function loadUserBalance() {
    try {
        console.log('Loading user balance...');
        
        const account = await server.loadAccount(connectedWallet);
        
        // Look for NALO token
        let naloBalance = 0;
        account.balances.forEach(balance => {
            if (balance.asset_code === CONFIG.naloAsset.code && 
                balance.asset_issuer === CONFIG.naloAsset.issuer) {
                naloBalance = parseFloat(balance.balance);
            }
        });
        
        // Update UI
        document.getElementById('naloBalance').textContent = naloBalance.toFixed(2) + ' NALO';
        
        console.log('User NALO balance:', naloBalance);
        
    } catch (error) {
        console.error('Error loading user balance:', error);
        document.getElementById('naloBalance').textContent = '0.00 NALO';
    }
}

/**
 * Load recent transactions
 */
async function loadRecentTransactions() {
    try {
        console.log('Loading recent transactions...');
        
        const accountToCheck = CONFIG.treasuryAddress.startsWith('GX') 
            ? connectedWallet 
            : CONFIG.treasuryAddress;
        
        // Get transactions
        const transactions = await server.transactions()
            .forAccount(accountToCheck)
            .order('desc')
            .limit(10)
            .call();
        
        // Update transaction count
        document.getElementById('totalTransactions').textContent = transactions.records.length;
        
        // Display transactions
        displayTransactions(transactions.records);
        
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
function displayTransactions(transactions) {
    const tbody = document.getElementById('transactionsBody');
    tbody.innerHTML = '';
    
    if (transactions.length === 0) {
        document.getElementById('transactionsLoading').style.display = 'none';
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;">No transactions found</td></tr>';
        document.getElementById('transactionsTable').style.display = 'table';
        return;
    }
    
    transactions.forEach(tx => {
        const row = document.createElement('tr');
        
        // Date
        const date = new Date(tx.created_at);
        const dateCell = document.createElement('td');
        dateCell.textContent = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        row.appendChild(dateCell);
        
        // Type (simplified - would need to parse operations for real type)
        const typeCell = document.createElement('td');
        const typeSpan = document.createElement('span');
        typeSpan.className = 'tx-type incoming';
        typeSpan.textContent = 'Payment';
        typeCell.appendChild(typeSpan);
        row.appendChild(typeCell);
        
        // Amount (would need to parse operations for real amount)
        const amountCell = document.createElement('td');
        amountCell.className = 'tx-amount';
        amountCell.textContent = '---';
        row.appendChild(amountCell);
        
        // Asset
        const assetCell = document.createElement('td');
        assetCell.textContent = 'XLM';
        row.appendChild(assetCell);
        
        // Hash
        const hashCell = document.createElement('td');
        const hashLink = document.createElement('a');
        hashLink.href = `https://stellar.expert/explorer/testnet/tx/${tx.hash}`;
        hashLink.target = '_blank';
        hashLink.className = 'tx-hash';
        hashLink.textContent = tx.hash.substring(0, 8) + '...' + tx.hash.substring(tx.hash.length - 8);
        hashCell.appendChild(hashLink);
        row.appendChild(hashCell);
        
        tbody.appendChild(row);
    });
    
    // Show table, hide loading
    document.getElementById('transactionsLoading').style.display = 'none';
    document.getElementById('transactionsTable').style.display = 'table';
}

/**
 * Show error message
 */
function showError(message) {
    const errorDiv = document.getElementById('transactionsError');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

/**
 * Format number with commas
 */
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
} else {
    initDashboard();
}

console.log('=== Treasury Dashboard Script Loaded ===');
