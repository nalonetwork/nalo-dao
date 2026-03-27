/**
 * NaloDAO Wallet Manager
 * Handles Freighter wallet connection with mobile support
 */

console.log('=== NaloDAO Wallet Manager Loading ===');

// Configuration
const CONFIG = {
    network: 'PUBLIC',
    freighterDownloadUrl: 'https://www.freighter.app/',
    freighterMobileUrl: 'https://www.freighter.app/mobile'
};

// State
let walletManager = {
    connected: false,
    publicKey: null,
    network: null
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
function checkExistingConnection() {
    const savedKey = sessionStorage.getItem('nalo_wallet_key');
    const wasConnected = sessionStorage.getItem('nalo_wallet_connected');
    
    if (wasConnected === 'true' && savedKey) {
        console.log('Restoring previous connection...');
        walletManager.connected = true;
        walletManager.publicKey = savedKey;
        updateWalletButton(true);
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
    
    if (!modal || !status) return;
    
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
    
    if (!modal || !status) return;
    
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
    
    if (!modal || !status) return;
    
    // Show loading
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
        
        // Update UI
        updateWalletButton(true);
        showWalletDetails();
        
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
    
    if (!modal || !status || !details) return;
    
    // Hide status, show details
    status.style.display = 'none';
    details.style.display = 'block';
    
    // Update details
    if (publicKeyEl) {
        publicKeyEl.textContent = walletManager.publicKey;
    }
    
    if (networkEl) {
        networkEl.textContent = walletManager.network || 'PUBLIC';
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
    
    sessionStorage.removeItem('nalo_wallet_connected');
    sessionStorage.removeItem('nalo_wallet_key');
    sessionStorage.removeItem('nalo_wallet_network');
    
    updateWalletButton(false);
    closeModal();
    
    console.log('Wallet disconnected');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWalletManager);
} else {
    initWalletManager();
}

console.log('=== Wallet Manager Script Loaded ===');
