/**
 * NaloDAO Wallet Manager
 * Handles Freighter wallet connection and management
 */

console.log('=== NaloDAO Wallet Manager Loading ===');

const WalletManager = {
    // State
    modal: null,
    walletBtn: null,
    closeBtn: null,
    walletStatus: null,
    walletDetails: null,
    connectedKey: null,
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
    lastActivity: Date.now(),
    
    /**
     * Initialize the wallet manager
     */
    init() {
        console.log('Initializing Wallet Manager...');
        
        // Get DOM elements
        this.modal = document.getElementById('walletModal');
        this.walletBtn = document.getElementById('walletBtn');
        this.closeBtn = document.querySelector('.close');
        this.walletStatus = document.getElementById('walletStatus');
        this.walletDetails = document.getElementById('walletDetails');
        
        if (!this.modal || !this.walletBtn) {
            console.error('Required DOM elements not found');
            return;
        }
        
        // Set up event listeners
        this.walletBtn.onclick = () => this.openModal();
        this.closeBtn.onclick = () => this.closeModal();
        window.onclick = (e) => {
            if (e.target === this.modal) this.closeModal();
        };
        
        // Check for existing connection
        this.checkExistingConnection();
        
        // Start session monitoring
        this.startSessionMonitoring();
        
        console.log('✓ Wallet Manager initialized');
    },
    
    /**
     * Open the wallet modal
     */
    async openModal() {
        this.modal.style.display = 'block';
        if (!this.connectedKey) {
            await this.connect();
        }
    },
    
    /**
     * Close the wallet modal
     */
    closeModal() {
        this.modal.style.display = 'none';
    },
    
    /**
     * Show status message in modal
     */
    showStatus(html) {
        this.walletStatus.innerHTML = html;
        this.walletStatus.style.display = 'block';
        this.walletDetails.style.display = 'none';
    },
    
    /**
     * Show connected wallet details
     */
    showConnected(publicKey) {
        this.walletStatus.style.display = 'none';
        this.walletDetails.style.display = 'block';
        document.getElementById('publicKey').textContent = publicKey;
        this.walletBtn.textContent = '✓ Connected';
        this.walletBtn.classList.add('wallet-connected');
        
        // Add disconnect button if not exists
        if (!document.getElementById('disconnectBtn')) {
            const btn = document.createElement('button');
            btn.id = 'disconnectBtn';
            btn.className = 'action-btn';
            btn.style.background = '#d32f2f';
            btn.textContent = 'Disconnect Wallet';
            btn.onclick = () => this.disconnect();
            this.walletDetails.appendChild(btn);
        }
    },
    
    /**
     * Detect Freighter wallet with multiple methods
     */
    async detectFreighter(maxAttempts = 20, delay = 500) {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            console.log(`Detection attempt ${attempt + 1}/${maxAttempts}`);
            
            // Try multiple detection methods
            if (typeof window.freighterApi !== 'undefined') {
                console.log('✓ Found window.freighterApi');
                return window.freighterApi;
            }
            
            if (typeof window.freighter !== 'undefined') {
                console.log('✓ Found window.freighter');
                return window.freighter;
            }
            
            if (typeof freighterApi !== 'undefined') {
                console.log('✓ Found global freighterApi');
                return freighterApi;
            }
            
            // Wait before next attempt
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        console.log('✗ Freighter not detected after max attempts');
        return null;
    },
    
    /**
     * Connect to Freighter wallet
     */
    async connect() {
        try {
            console.log('Starting wallet connection...');
            
            // Show loading state
            this.showStatus(`
                <div style="text-align: center; padding: 2rem;">
                    <div class="spinner" style="margin: 0 auto 1rem;"></div>
                    <p style="font-size: 1.1rem; margin-bottom: 1rem;">
                        🔍 Detecting Freighter wallet...
                    </p>
                    <p style="font-size: 0.9rem; color: #666;">
                        Please wait a moment...
                    </p>
                </div>
            `);
            
            // Detect Freighter
            const freighterAPI = await this.detectFreighter();
            
            if (!freighterAPI) {
                console.error('Freighter not detected');
                this.showNotInstalledMessage();
                return;
            }
            
            console.log('Freighter detected, requesting connection...');
            
            // Show connection request message
            this.showStatus(`
                <div style="text-align: center; padding: 2rem;">
                    <p style="color: #4caf50; font-weight: 600; font-size: 1.1rem; margin-bottom: 1rem;">
                        ✓ Freighter Detected!
                    </p>
                    <p style="color: #ff9800; margin-bottom: 1rem;">
                        🔐 Opening Freighter...
                    </p>
                    <p style="font-size: 0.85rem; color: #666;">
                        Please approve the connection in the Freighter popup
                    </p>
                </div>
            `);
            
            // Request public key (triggers Freighter popup)
            const publicKey = await freighterAPI.getPublicKey();
            
            console.log('Public key received:', publicKey);
            
            // Validate public key format
            if (!this.isValidStellarAddress(publicKey)) {
                throw new Error('Invalid public key format received');
            }
            
            // Store connection
            this.connectedKey = publicKey;
            this.lastActivity = Date.now();
            sessionStorage.setItem('nalo_wallet_connected', 'true');
            sessionStorage.setItem('nalo_wallet_key', publicKey);
            
            // Update UI
            this.showConnected(publicKey);
            
            console.log('✓ Wallet connected successfully');
            
        } catch (error) {
            console.error('Connection error:', error);
            this.showConnectionError(error);
        }
    },
    
    /**
     * Disconnect wallet
     */
    disconnect() {
        console.log('Disconnecting wallet...');
        
        this.connectedKey = null;
        this.lastActivity = Date.now();
        sessionStorage.removeItem('nalo_wallet_connected');
        sessionStorage.removeItem('nalo_wallet_key');
        
        this.walletBtn.textContent = 'Connect Wallet';
        this.walletBtn.classList.remove('wallet-connected');
        
        this.showStatus(`
            <p style="color: #4caf50; text-align: center; padding: 2rem; font-size: 1.1rem;">
                ✓ Wallet Disconnected Successfully
            </p>
        `);
        
        setTimeout(() => this.closeModal(), 1500);
    },
    
    /**
     * Check for existing connection in session
     */
    checkExistingConnection() {
        const wasConnected = sessionStorage.getItem('nalo_wallet_connected');
        const savedKey = sessionStorage.getItem('nalo_wallet_key');
        
        if (wasConnected === 'true' && savedKey && this.isValidStellarAddress(savedKey)) {
            console.log('Restoring previous connection...');
            this.connectedKey = savedKey;
            this.walletBtn.textContent = '✓ Connected';
            this.walletBtn.classList.add('wallet-connected');
        }
    },
    
    /**
     * Start monitoring user activity for session timeout
     */
    startSessionMonitoring() {
        // Check for timeout every minute
        setInterval(() => {
            if (this.connectedKey && Date.now() - this.lastActivity > this.sessionTimeout) {
                console.log('Session timeout - disconnecting wallet');
                this.disconnect();
                alert('Your wallet session has expired due to inactivity. Please reconnect.');
            }
        }, 60000);
        
        // Update activity on user interaction
        ['click', 'keypress', 'scroll', 'mousemove'].forEach(event => {
            document.addEventListener(event, () => {
                if (this.connectedKey) {
                    this.lastActivity = Date.now();
                }
            }, { passive: true });
        });
    },
    
    /**
     * Validate Stellar address format
     */
    isValidStellarAddress(address) {
        return /^G[A-Z2-7]{55}$/.test(address);
    },
    
    /**
     * Show "not installed" message
     */
    showNotInstalledMessage() {
        this.showStatus(`
            <div style="padding: 1.5rem;">
                <p style="color: #d32f2f; font-weight: 600; font-size: 1.1rem; margin-bottom: 1rem;">
                    ⚠️ Freighter Wallet Not Detected
                </p>
                <p style="margin-bottom: 1rem;">
                    Freighter wallet extension is required to connect to NaloDAO.
                </p>
                <div style="background: #f5f5f5; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                    <p style="font-weight: 600; margin-bottom: 0.5rem;">Installation Steps:</p>
                    <ol style="text-align: left; margin-left: 1.5rem; line-height: 2;">
                        <li>Click "Install Freighter" below</li>
                        <li>Add the extension to your browser</li>
                        <li>Create or import a Stellar wallet</li>
                        <li>Return here and click "Connect Wallet"</li>
                    </ol>
                </div>
                <a href="https://www.freighter.app/" target="_blank" rel="noopener noreferrer" 
                   class="action-btn" style="text-decoration: none; display: block; text-align: center;">
                   Install Freighter Wallet
                </a>
                <button onclick="location.reload()" class="action-btn" 
                        style="background: var(--accent-gold); color: var(--text-dark);">
                    I've Installed It - Refresh Page
                </button>
            </div>
        `);
    },
    
    /**
     * Show connection error message
     */
    showConnectionError(error) {
        let errorMsg = 'Connection Failed';
        let errorDetails = error.message;
        
        if (error.message.includes('User declined') || error.message.includes('rejected')) {
            errorMsg = 'Connection Declined';
            errorDetails = 'You declined the connection request in Freighter.';
        } else if (error.message.includes('timeout')) {
            errorMsg = 'Connection Timeout';
            errorDetails = 'The connection request timed out. Please try again.';
        }
        
        this.showStatus(`
            <div style="padding: 1.5rem;">
                <p style="color: #d32f2f; font-weight: 600; font-size: 1.1rem; margin-bottom: 0.5rem;">
                    ❌ ${errorMsg}
                </p>
                <p style="font-size: 0.9rem; color: #666; margin-bottom: 1rem;">
                    ${errorDetails}
                </p>
                <button onclick="WalletManager.connect()" class="action-btn">
                    Try Again
                </button>
            </div>
        `);
    },
    
    /**
     * Get connected public key
     */
    getPublicKey() {
        if (!this.connectedKey) {
            throw new Error('Wallet not connected');
        }
        return this.connectedKey;
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => WalletManager.init(), 500);
    });
} else {
    setTimeout(() => WalletManager.init(), 500);
}

// Expose to window for debugging and external access
window.WalletManager = WalletManager;

console.log('=== Wallet Manager Script Loaded ===');
console.log('Debug: Run WalletManager.connect() in console to test');
