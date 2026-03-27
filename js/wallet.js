/**
 * NaloDAO Wallet Manager
 * Handles Freighter wallet connection with mobile support and real-time balance display
 */

console.log('=== NaloDAO Wallet Manager Loading ===');

// Configuration
const CONFIG = {
    network: 'PUBLIC',
    freighterDownloadUrl: 'https://www.freighter.app/',
    freighterMobileUrl: 'https://www.freighter.app/mobile',
    horizonUrl: 'https://horizon.stellar.org',
    stellarExpertUrl: 'https://stellar.expert/explorer/public'
};

// State
let walletManager = {
    connected: false,
    publicKey: null,
    network: null,
    balances: []
};

/**
 * Detect if user is on mobile device
 */
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Detect if Freighter is installed
 */
function isFreighterInstalled() {
    return typeof window.freighterApi !== 'undefined';
}

/**
 * Initialize Wallet Manager
 */
function initWalletManager() {
    console.log('Initializing Wallet Manager...');
    console.log('Mobile device:', isMobileDevice());
    console.log('Freighter installed:', isFreighterInstalled());
    
    // Set up wallet button
    const walletBtn = document.getElementById('walletBtn');
    if (walletBtn) {
        walletBtn.onclick = handleWalletConnect;
    }
    
    // Set up connect button (for treasury page)
    const connectBtn = document.getElementById('connectBtn');
    if (connectBtn) {
        connectBtn.onclick = handleWalletConnect;
    }
    
    // Set up modal close button
    const closeBtn = document.querySelector('.close');
    if (closeBtn) {
        closeBtn.onclick = closeModal;
    }
    
    // Close modal when clicking outside
    const modal = document.getElementById('walletModal');
    if (modal) {
        window.onclick = function(event) {
            if (event.target === modal) {
                closeModal();
            }
        };
    }
    
    // Check for existing connection
    checkExistingConnection();
    
    console.log('✓ Wallet Manager initialized');
}

/**
 * Check for existing wallet connection
 */
async function checkExistingConnection() {
    const savedKey = sessionStorage.getItem('nalo_wallet_key');
    const wasConnected = sessionStorage.getItem('nalo_wallet_connected');
    
    if (wasConnected === 'true' && savedKey) {
        console.log('Restoring previous connection...');
        walletManager.connected = true;
        walletManager.publicKey = savedKey;
        walletManager.network = sessionStorage.getItem('nalo_wallet_network') || 'PUBLIC';
        updateWalletButton(true);
        
        // Load wallet balance
        await loadWalletBalance(savedKey);
        
        // Trigger treasury dashboard update if on treasury page
        if (typeof showDashboard === 'function') {
            console.log('Triggering treasury dashboard...');
            showDashboard();
        }
        if (typeof loadAllData === 'function') {
            console.log('Loading all treasury data...');
            loadAllData();
        }
    }
}

/**
 * Handle wallet connection
 */
async function handleWalletConnect() {
    console.log('Wallet connect clicked');
    
    // Check if already connected
    if (walletManager.connected) {
        showWalletDetails();
        return;
    }
    
    // Check if on mobile
    if (isMobileDevice()) {
        handleMobileConnection();
    } else {
        handleDesktopConnection();
    }
}

/**
 * Handle mobile wallet connection
 */
function handleMobileConnection() {
    console.log('Mobile connection flow');
    
    // Check if Freighter is installed
    if (!isFreighterInstalled()) {
        showMobileInstallPrompt();
        return;
    }
    
    // Attempt connection
    connectFreighterWallet();
}

/**
 * Handle desktop wallet connection
 */
function handleDesktopConnection() {
    console.log('Desktop connection flow');
    
    // Check if Freighter is installed
    if (!isFreighterInstalled()) {
        showDesktopInstallPrompt();
        return;
    }
    
    // Attempt connection
    connectFreighterWallet();
}

/**
 * Show mobile install prompt
 */
function showMobileInstallPrompt() {
    const modal = document.getElementById('walletModal');
    const status = document.getElementById('walletStatus');
    const details = document.getElementById('walletDetails');
    
    if (!modal || !status) return;
    
    // Hide details, show status
    if (details) details.style.display = 'none';
    status.style.display = 'block';
    
    status.innerHTML = `
        <div style="text-align: center; padding: 1rem;">
            <h3 style="color: var(--primary-green); margin-bottom: 1rem;">📱 Freighter Mobile Required</h3>
            <p style="margin-bottom: 1rem;">To connect your wallet on mobile, you need the Freighter mobile app.</p>
            <a href="${CONFIG.freighterMobileUrl}" 
               target="_blank" 
               rel="noopener noreferrer"
               style="display: inline-block; padding: 1rem 2rem; background: var(--accent-gold); color: var(--text-dark); text-decoration: none; border-radius: 50px; font-weight: 600; margin-bottom: 1rem;">
                Download Freighter Mobile
            </a>
            <p style="font-size: 0.9rem; color: #666;">
                After installing, return to this page and tap "Connect Wallet" again.
            </p>
        </div>
    `;
    
    modal.style.display = 'block';
}

/**
 * Show desktop install prompt
 */
function showDesktopInstallPrompt() {
    const modal = document.getElementById('walletModal');
    const status = document.getElementById('walletStatus');
    const details = document.getElementById('walletDetails');
    
    if (!modal || !status) return;
    
    // Hide details, show status
    if (details) details.style.display = 'none';
    status.style.display = 'block';
    
    status.innerHTML = `
        <div style="text-align: center; padding: 1rem;">
            <h3 style="color: var(--primary-green); margin-bottom: 1rem;">🔌 Freighter Extension Required</h3>
            <p style="margin-bottom: 1rem;">To connect your wallet, you need the Freighter browser extension.</p>
            <a href="${CONFIG.freighterDownloadUrl}" 
               target="_blank" 
               rel="noopener noreferrer"
               style="display: inline-block; padding: 1rem 2rem; background: var(--accent-gold); color: var(--text-dark); text-decoration: none; border-radius: 50px; font-weight: 600; margin-bottom: 1rem;">
                Install Freighter Extension
            </a>
            <p style="font-size: 0.9rem; color: #666;">
                After installing, refresh this page and click "Connect Wallet" again.
            </p>
        </div>
    `;
    
    modal.style.display = 'block';
}

/**
 * Connect to Freighter wallet
 */
async function connectFreighterWallet() {
    console.log('Attempting Freighter connection...');
    
    const modal = document.getElementById('walletModal');
    const status = document.getElementById('walletStatus');
    const details = document.getElementById('walletDetails');
    
    if (!modal || !status) return;
    
    // Hide details, show loading status
    if (details) details.style.display = 'none';
    status.style.display = 'block';
    
    status.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
            <div class="spinner"></div>
            <p style="margin-top: 1rem;">Connecting to Freighter...</p>
            <p style="font-size: 0.9rem; color: #666; margin-top: 0.5rem;">Please approve the connection in Freighter</p>
        </div>
    `;
    
    modal.style.display = 'block';
    
    try {
        // Get network
        const network = await window.freighterApi.getNetwork();
        console.log('Network:', network);
        
        // Warn if not on PUBLIC network
        if (network !== 'PUBLIC') {
            const switchNetwork = confirm(
                `Your Freighter wallet is set to ${network} network.\n\n` +
                `This site requires PUBLIC (mainnet) network.\n\n` +
                `Please switch to PUBLIC network in Freighter settings.\n\n` +
                `Continue anyway?`
            );
            
            if (!switchNetwork) {
                closeModal();
                return;
            }
        }
        
        // Get public key
        const publicKey = await window.freighterApi.getPublicKey();
        console.log('Connected:', publicKey);
        
        // Validate address
        if (!isValidStellarAddress(publicKey)) {
            throw new Error('Invalid Stellar address received');
        }
        
        // Store connection
        walletManager.connected = true;
        walletManager.publicKey = publicKey;
        walletManager.network = network;
        
        sessionStorage.setItem('nalo_wallet_connected', 'true');
        sessionStorage.setItem('nalo_wallet_key', publicKey);
        sessionStorage.setItem('nalo_wallet_network', network);
        
        // Load wallet balance
        await loadWalletBalance(publicKey);
        
        // Update UI
        updateWalletButton(true);
        showWalletDetails();
        
        // Trigger treasury dashboard update if on treasury page
        if (typeof showDashboard === 'function') {
            console.log('Triggering treasury dashboard...');
            showDashboard();
        }
        if (typeof loadAllData === 'function') {
            console.log('Loading all treasury data...');
            loadAllData();
        }
        
    } catch (error) {
        console.error('Connection failed:', error);
        
        let errorMessage = 'Failed to connect wallet. Please try again.';
        
        if (error.message.includes('User declined')) {
            errorMessage = 'Connection declined. Please approve the connection in Freighter.';
        } else if (error.message.includes('timeout')) {
            errorMessage = 'Connection timed out. Please make sure Freighter is unlocked.';
        }
        
        status.innerHTML = `
            <div style="text-align: center; padding: 1rem;">
                <h3 style="color: #dc3545; margin-bottom: 1rem;">❌ Connection Failed</h3>
                <p style="margin-bottom: 1rem;">${errorMessage}</p>
                <button onclick="closeModal()" style="padding: 0.75rem 1.5rem; background: var(--light-green); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                    Close
                </button>
            </div>
        `;
    }
}

/**
 * Load wallet balance from Stellar network
 */
async function loadWalletBalance(publicKey) {
    console.log('Loading wallet balance for:', publicKey);
    
    try {
        // Fetch account data from Horizon
        const response = await fetch(`${CONFIG.horizonUrl}/accounts/${publicKey}`);
        
        if (!response.ok) {
            throw new Error('Failed to load account data');
        }
        
        const accountData = await response.json();
        console.log('Account data loaded:', accountData);
        
        // Store balances
        walletManager.balances = accountData.balances || [];
        
        return accountData;
        
    } catch (error) {
        console.error('Failed to load wallet balance:', error);
        walletManager.balances = [];
        return null;
    }
}

/**
 * Validate Stellar address format
 */
function isValidStellarAddress(address) {
    return /^G[A-Z2-7]{55}$/.test(address);
}

/**
 * Show wallet details in modal
 */
function showWalletDetails() {
    const modal = document.getElementById('walletModal');
    const status = document.getElementById('walletStatus');
    const details = document.getElementById('walletDetails');
    const publicKeyEl = document.getElementById('publicKey');
    const networkEl = document.getElementById('network');
    
    if (!modal) return;
    
    // Hide status, show details
    if (status) status.style.display = 'none';
    if (details) {
        details.style.display = 'block';
        
        // Update wallet address
        if (publicKeyEl) {
            publicKeyEl.textContent = walletManager.publicKey;
        }
        
        // Update network
        if (networkEl) {
            networkEl.textContent = walletManager.network || 'PUBLIC';
        }
        
        // Add balance information
        const balanceInfo = document.createElement('div');
        balanceInfo.style.marginTop = '1rem';
        balanceInfo.style.padding = '1rem';
        balanceInfo.style.background = '#f0f0f0';
        balanceInfo.style.borderRadius = '8px';
        
        if (walletManager.balances.length > 0) {
            const xlmBalance = walletManager.balances.find(b => b.asset_type === 'native');
            const xlmAmount = xlmBalance ? parseFloat(xlmBalance.balance).toFixed(2) : '0.00';
            
            balanceInfo.innerHTML = `
                <p style="margin: 0.5rem 0;"><strong>💰 Balance:</strong></p>
                <p style="margin: 0.5rem 0; font-size: 1.2rem; color: var(--primary-green);">${xlmAmount} XLM</p>
                <p style="margin: 0.5rem 0; font-size: 0.85rem; color: #666;">≈ $${(xlmAmount * 0.12).toFixed(2)} USD</p>
                <p style="margin-top: 1rem; font-size: 0.85rem;">
                    <a href="${CONFIG.stellarExpertUrl}/account/${walletManager.publicKey}" 
                       target="_blank" 
                       rel="noopener noreferrer"
                       style="color: var(--light-green); text-decoration: none;">
                        View on Stellar Expert →
                    </a>
                </p>
            `;
        } else {
            balanceInfo.innerHTML = `
                <p style="margin: 0.5rem 0; color: #666;">Loading balance...</p>
            `;
        }
        
        // Check if balance info already exists, if not add it
        const existingBalanceInfo = details.querySelector('.balance-info');
        if (existingBalanceInfo) {
            existingBalanceInfo.replaceWith(balanceInfo);
        } else {
            balanceInfo.className = 'balance-info';
            details.appendChild(balanceInfo);
        }
    }
    
    // Show modal
    modal.style.display = 'block';
}

/**
 * Update wallet button state
 */
function updateWalletButton(connected) {
    const walletBtn = document.getElementById('walletBtn');
    if (!walletBtn) return;
    
    if (connected) {
        walletBtn.textContent = '✓ Connected';
        walletBtn.classList.add('wallet-connected');
    } else {
        walletBtn.textContent = 'Connect Wallet';
        walletBtn.classList.remove('wallet-connected');
    }
}

/**
 * Close modal
 */
function closeModal() {
    const modal = document.getElementById('walletModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Disconnect wallet
 */
function disconnectWallet() {
    walletManager.connected = false;
    walletManager.publicKey = null;
    walletManager.network = null;
    walletManager.balances = [];
    
    sessionStorage.removeItem('nalo_wallet_connected');
    sessionStorage.removeItem('nalo_wallet_key');
    sessionStorage.removeItem('nalo_wallet_network');
    
    updateWalletButton(false);
    closeModal();
    
    // Trigger treasury page update if applicable
    if (typeof showConnectPrompt === 'function') {
        showConnectPrompt();
    }
    
    console.log('Wallet disconnected');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWalletManager);
} else {
    initWalletManager();
}

console.log('=== Wallet Manager Script Loaded ===');
