// Generator unlock costs
const GENERATOR_COSTS = {
    generator1: 1000,
    generator2: 1000,
    generator3: 10000
};

// Manual generation tracking
let manualGenerationHistory = []; // Array of timestamps for manual generation events
let pressedKeys = new Set(); // Track which keys are currently pressed

// Game state
let gameState = {
    messages: 0,
    fractionalMessages: 0, // Accumulated fractional messages
    settings: {
        numberFormat: 'full' // 'full', 'abbreviated', 'scientific'
    },
    upgrades: {
        manualGenerationMultiplier: 0 // Level of manual generation multiplier upgrade
    },
    generators: {
        unlocked: [], // Array of unlocked generator IDs
        generator1: {
            bots: 0, // Number of auto-typer bots
            efficiency: 1.0 // Efficiency multiplier per bot
        }
    }
};

// Load settings from localStorage
function loadSettings() {
    const saved = localStorage.getItem('gameSettings');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            gameState.settings = { ...gameState.settings, ...parsed };
        } catch (e) {
            console.error('Failed to load settings:', e);
        }
    }
}

// Save settings to localStorage
function saveSettings() {
    localStorage.setItem('gameSettings', JSON.stringify(gameState.settings));
}

// Server and channel data
const servers = {
    home: {
        name: 'Home',
        channels: {
            manual: { name: 'manual-generation', content: 'Manual generation content goes here' },
            stats: { name: 'stats', content: 'Game statistics will be displayed here' }
        }
    },
    generator1: {
        name: 'Auto-Typer Bot',
        locked: true,
        channels: {
            main: { name: 'bot-control', content: 'Auto-Typer Bot control panel' },
            upgrades: { name: 'bot-upgrades', content: 'Upgrade your bots' }
        }
    },
    generator2: {
        name: 'Generator 2',
        channels: {
            upgrade1: { name: 'upgrade-1', content: 'Generator 2 upgrades' },
            upgrade2: { name: 'upgrade-2', content: 'More Generator 2 upgrades' }
        }
    },
    generator3: {
        name: 'Generator 3',
        channels: {
            upgrade1: { name: 'upgrade-1', content: 'Generator 3 upgrades' },
            upgrade2: { name: 'upgrade-2', content: 'More Generator 3 upgrades' }
        }
    },
    upgrades: {
        name: 'Global Upgrades',
        channels: {
            global1: { name: 'global-upgrade-1', content: 'Global upgrade options' },
            global2: { name: 'global-upgrade-2', content: 'More global upgrades' }
        }
    },
    settings: {
        name: 'Settings',
        channels: {
            general: { name: 'general', content: 'General game settings' },
            audio: { name: 'audio', content: 'Audio settings' },
            about: { name: 'about', content: 'About the game' }
        }
    }
};

let currentServer = 'home';
let currentChannel = 'manual';

// Check if a generator is unlocked
function isGeneratorUnlocked(generatorId) {
    return gameState.generators.unlocked.includes(generatorId);
}

// Get the next lockable generator
function getNextLockableGenerator() {
    const generatorOrder = ['generator1', 'generator2', 'generator3'];
    for (const genId of generatorOrder) {
        if (!isGeneratorUnlocked(genId)) {
            return genId;
        }
    }
    return null;
}

// Render server sidebar
function renderServerSidebar() {
    const sidebar = document.getElementById('server-sidebar');
    if (!sidebar) return;
    
    sidebar.innerHTML = '';
    
    // Always show home
    const homeIcon = createServerIcon('home', 'home', true);
    sidebar.appendChild(homeIcon);
    
    // Always show upgrades
    const upgradesIcon = createServerIcon('upgrades', 'UP', false);
    sidebar.appendChild(upgradesIcon);
    
    // Show unlocked generators + next lockable
    const generatorOrder = ['generator1', 'generator2', 'generator3'];
    let foundNextLocked = false;
    
    for (const genId of generatorOrder) {
        const isUnlocked = isGeneratorUnlocked(genId);
        const isNextLocked = !foundNextLocked && !isUnlocked;
        
        if (isUnlocked || isNextLocked) {
            const server = servers[genId];
            const icon = createServerIcon(genId, server.name.charAt(0).toUpperCase(), false, !isUnlocked);
            sidebar.appendChild(icon);
            
            if (isNextLocked) {
                foundNextLocked = true;
            }
        }
    }
    
    // Divider before settings
    const divider = document.createElement('div');
    divider.className = 'server-divider';
    sidebar.appendChild(divider);
    
    // Always show settings
    const settingsIcon = createServerIcon('settings', 'settings', false);
    sidebar.appendChild(settingsIcon);
    
    // Re-setup click handlers
    setupServerIcons();
}

// Create a server icon element
function createServerIcon(serverId, label, isHome, isLocked = false) {
    const icon = document.createElement('div');
    icon.className = `server-icon ${isLocked ? 'locked' : ''}`;
    icon.dataset.server = serverId;
    
    if (isHome) {
        icon.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
            </svg>
        `;
    } else if (serverId === 'settings') {
        icon.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5a3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97c0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.4-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1c0 .33.03.65.07.97L2.46 14.6c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66Z"/>
            </svg>
        `;
    } else {
        if (isLocked) {
            icon.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                </svg>
            `;
        } else {
            icon.innerHTML = `<span>${label}</span>`;
        }
    }
    
    return icon;
}

// Unlock a generator
function unlockGenerator(generatorId) {
    if (isGeneratorUnlocked(generatorId)) return false;
    
    const cost = GENERATOR_COSTS[generatorId];
    const totalMessages = gameState.messages + (gameState.fractionalMessages || 0);
    
    if (totalMessages >= cost) {
        // Deduct cost
        if (gameState.fractionalMessages >= cost) {
            gameState.fractionalMessages -= cost;
        } else {
            const remaining = cost - gameState.fractionalMessages;
            gameState.fractionalMessages = 0;
            gameState.messages -= remaining;
        }
        
        // Unlock generator
        gameState.generators.unlocked.push(generatorId);
        
        // Initialize generator if needed
        if (!gameState.generators[generatorId]) {
            gameState.generators[generatorId] = {
                bots: 0,
                efficiency: 1.0
            };
        }
        
        autoSave();
        updateCurrencyDisplay();
        renderServerSidebar();
        return true;
    }
    return false;
}

// Get generator production rate (messages per second)
function getGeneratorProduction(generatorId) {
    if (!isGeneratorUnlocked(generatorId)) return 0;
    
    const gen = gameState.generators[generatorId];
    if (!gen) return 0;
    
    // Each bot produces 0.1 messages per second, multiplied by efficiency
    return (gen.bots || 0) * 0.1 * (gen.efficiency || 1.0);
}

// Mobile menu state
let mobileMenuOpen = false;

// Toggle mobile menu
function toggleMobileMenu() {
    mobileMenuOpen = !mobileMenuOpen;
    const sidebar = document.getElementById('left-sidebar-container');
    const overlay = document.getElementById('mobile-overlay');
    
    if (sidebar) {
        if (mobileMenuOpen) {
            sidebar.classList.add('mobile-open');
        } else {
            sidebar.classList.remove('mobile-open');
        }
    }
    
    if (overlay) {
        if (mobileMenuOpen) {
            overlay.classList.add('active');
        } else {
            overlay.classList.remove('active');
        }
    }
}

// Close mobile menu
function closeMobileMenu() {
    if (mobileMenuOpen) {
        mobileMenuOpen = false;
        const sidebar = document.getElementById('left-sidebar-container');
        const overlay = document.getElementById('mobile-overlay');
        
        if (sidebar) {
            sidebar.classList.remove('mobile-open');
        }
        if (overlay) {
            overlay.classList.remove('active');
        }
    }
}

// Initialize the app
function init() {
    loadSettings();
    loadGameState();
    renderServerSidebar();
    setupChannelItems();
    setupMobileMenu();
    loadServer(currentServer);
    updateCurrencyDisplay();
    
    // Passive generation loop (runs 10 times per second for smooth updates)
    setInterval(() => {
        let totalProduction = 0;
        
        // Calculate production from all unlocked generators
        const generatorOrder = ['generator1', 'generator2', 'generator3'];
        for (const genId of generatorOrder) {
            if (isGeneratorUnlocked(genId)) {
                totalProduction += getGeneratorProduction(genId);
            }
        }
        
        // Add production (divided by 10 since we run 10 times per second)
        if (totalProduction > 0) {
            gameState.fractionalMessages = (gameState.fractionalMessages || 0) + (totalProduction / 10);
            
            // Convert whole parts to messages
            const wholePart = Math.floor(gameState.fractionalMessages);
            if (wholePart > 0) {
                gameState.messages += wholePart;
                gameState.fractionalMessages -= wholePart;
            }
        }
        
        // Always update display to show decimal changes and rate updates
        updateCurrencyDisplay();
    }, 100);
    
    // Auto-save every 30 seconds
    setInterval(autoSave, 30000);
}

// Get manual generation rate (based on recent activity)
function getManualGenerationRate() {
    const now = Date.now();
    const windowMs = 2000; // 2 second window
    
    // Remove old events outside the window
    manualGenerationHistory = manualGenerationHistory.filter(timestamp => now - timestamp < windowMs);
    
    if (manualGenerationHistory.length === 0) {
        return 0;
    }
    
    // Calculate rate: number of events in window / window duration in seconds
    const multiplier = getManualGenerationMultiplier();
    const eventsPerSecond = manualGenerationHistory.length / (windowMs / 1000);
    return eventsPerSecond * multiplier;
}

// Get total messages per second (including manual generation)
function getTotalMessagesPerSecond() {
    let total = 0;
    
    // Add generator production
    const generatorOrder = ['generator1', 'generator2', 'generator3'];
    for (const genId of generatorOrder) {
        if (isGeneratorUnlocked(genId)) {
            total += getGeneratorProduction(genId);
        }
    }
    
    // Add actual manual generation rate
    total += getManualGenerationRate();
    
    return total;
}

// Update currency display
function updateCurrencyDisplay() {
    const totalMessages = gameState.messages + (gameState.fractionalMessages || 0);
    const msgPerSec = getTotalMessagesPerSecond();
    
    // Desktop currency display (in sidebar)
    const currencyValue = document.getElementById('currency-value');
    if (currencyValue) {
        currencyValue.textContent = formatNumber(totalMessages, 2);
    }
    
    const currencyRate = document.getElementById('currency-rate');
    if (currencyRate) {
        currencyRate.textContent = `${formatNumber(msgPerSec, 2)} msg/s`;
    }
    
    // Mobile currency display (in header)
    const mobileCurrencyValue = document.getElementById('mobile-currency-value');
    if (mobileCurrencyValue) {
        mobileCurrencyValue.textContent = formatNumber(totalMessages, 2);
    }
    
    const mobileCurrencyRate = document.getElementById('mobile-currency-rate');
    if (mobileCurrencyRate) {
        mobileCurrencyRate.textContent = `${formatNumber(msgPerSec, 2)} msg/s`;
    }
}

// Format number based on settings
function formatNumber(num, decimals = 0) {
    // Zero is always just "0"
    if (num === 0) return '0';
    
    const format = gameState.settings.numberFormat;
    
    // Format with specified decimal places
    const formatWithDecimals = (value, dec) => {
        if (dec === 0) {
            return Math.floor(value).toString();
        }
        return value.toFixed(dec);
    };
    
    if (format === 'abbreviated') {
        if (num < 1000) return formatWithDecimals(num, decimals);
        if (num < 1000000) return (num / 1000).toFixed(2).replace(/\.?0+$/, '') + 'K';
        if (num < 1000000000) return (num / 1000000).toFixed(2).replace(/\.?0+$/, '') + 'M';
        if (num < 1000000000000) return (num / 1000000000).toFixed(2).replace(/\.?0+$/, '') + 'B';
        return (num / 1000000000000).toFixed(2).replace(/\.?0+$/, '') + 'T';
    } else if (format === 'scientific') {
        return num.toExponential(2);
    } else {
        // Full format with commas and decimals
        const formatted = formatWithDecimals(num, decimals);
        const parts = formatted.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return parts.join('.');
    }
}

// Setup server icon click handlers
function setupServerIcons() {
    const serverIcons = document.querySelectorAll('.server-icon');
    serverIcons.forEach(icon => {
        icon.addEventListener('click', () => {
            const serverId = icon.dataset.server;
            if (serverId) {
                loadServer(serverId);
                // Close mobile menu on mobile after selecting server
                if (window.innerWidth <= 768) {
                    closeMobileMenu();
                }
            }
        });
    });
}

// Setup mobile menu
function setupMobileMenu() {
    const menuButton = document.getElementById('mobile-menu-button');
    const overlay = document.getElementById('mobile-overlay');
    
    if (menuButton) {
        menuButton.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMobileMenu();
        });
    }
    
    if (overlay) {
        overlay.addEventListener('click', () => {
            closeMobileMenu();
        });
    }
}

// Setup channel item click handlers
function setupChannelItems() {
    document.addEventListener('click', (e) => {
        const channelItem = e.target.closest('.channel-item');
        if (channelItem) {
            const channelId = channelItem.dataset.channel;
            if (channelId) {
                loadChannel(channelId);
                // Close mobile menu on mobile after selecting channel
                if (window.innerWidth <= 768) {
                    closeMobileMenu();
                }
            }
        }
    });
}

// Load a server and update the UI
function loadServer(serverId) {
    if (!servers[serverId]) return;
    
    // Check if generator is locked
    if (servers[serverId].locked && !isGeneratorUnlocked(serverId)) {
        // Show unlock prompt
        showUnlockPrompt(serverId);
        return;
    }
    
    currentServer = serverId;
    const server = servers[serverId];
    
    // Update active server icon
    document.querySelectorAll('.server-icon').forEach(icon => {
        icon.classList.remove('active');
        if (icon.dataset.server === serverId) {
            icon.classList.add('active');
        }
    });
    
    // Update server name
    document.getElementById('server-name').textContent = server.name;
    
    // Update channel list
    const channelList = document.getElementById('channel-list');
    channelList.innerHTML = '';
    
    // Check if this is the home or settings server (no hashtags or category headers)
    const isHomeServer = serverId === 'home' || serverId === 'settings';
    
    // Add channels
    const channelIds = Object.keys(server.channels);
    channelIds.forEach((channelId, index) => {
        // Only add category header for non-home servers
        if (!isHomeServer && (index === 0 || index % 3 === 0)) {
            const category = document.createElement('div');
            category.className = 'channel-category';
            category.textContent = 'CHANNELS';
            channelList.appendChild(category);
        }
        
        const channelItem = document.createElement('div');
        channelItem.className = 'channel-item';
        if (channelId === currentChannel && currentServer === serverId) {
            channelItem.classList.add('active');
        }
        channelItem.dataset.channel = channelId;
        
        // Only add hash for non-home servers
        if (!isHomeServer) {
            const hash = document.createElement('span');
            hash.className = 'channel-hash';
            hash.textContent = '#';
            channelItem.appendChild(hash);
        }
        
        const name = document.createElement('span');
        name.textContent = server.channels[channelId].name;
        
        channelItem.appendChild(name);
        channelList.appendChild(channelItem);
    });
    
    // Load first channel if current channel doesn't exist in this server
    if (!server.channels[currentChannel]) {
        currentChannel = channelIds[0];
    }
    
    loadChannel(currentChannel);
}

// Load a channel and update the content
function loadChannel(channelId) {
    if (!servers[currentServer] || !servers[currentServer].channels[channelId]) return;
    
    currentChannel = channelId;
    const channel = servers[currentServer].channels[channelId];
    
    // Update active channel item
    document.querySelectorAll('.channel-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.channel === channelId) {
            item.classList.add('active');
        }
    });
    
    // Update channel title (with hash for non-home/settings servers)
    const channelTitleElement = document.querySelector('.channel-title');
    const channelTitle = document.getElementById('current-channel');
    const isHomeServer = currentServer === 'home' || currentServer === 'settings';
    
    // Remove existing hash if any
    const existingHash = channelTitleElement.querySelector('.channel-hash');
    if (existingHash) {
        existingHash.remove();
    }
    
    // Add hash for non-home servers
    if (!isHomeServer) {
        const hash = document.createElement('span');
        hash.className = 'channel-hash';
        hash.textContent = '#';
        channelTitleElement.insertBefore(hash, channelTitle);
    }
    
    channelTitle.textContent = channel.name;
    
    // Update content body
    const contentBody = document.getElementById('content-body');
    
    // Special layout for manual generation channel
    if (channelId === 'manual' && currentServer === 'home') {
        const multiplier = getManualGenerationMultiplier();
        const avgMessages = multiplier.toFixed(2);
        const messageText = multiplier > 1.00 ? 'Messages' : 'Message';
        contentBody.innerHTML = `
            <div class="manual-generation-content">
                <div class="manual-generation-info">
                    <h2>Type to Generate Messages</h2>
                    <p>Start typing in the chat box below to generate messages. Each character generates ${avgMessages} ${messageText}!</p>
                </div>
            </div>
            <div class="chat-input-container">
                <div class="chat-input-wrapper">
                    <input type="text" class="chat-input" id="manual-input" placeholder="Type here to generate messages..." autocomplete="off" />
                    <button class="send-button" id="send-button" title="Click to generate messages">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                        </svg>
                    </button>
                    <div class="chat-input-popup-container" id="popup-container"></div>
                </div>
            </div>
        `;
        
        // Setup manual generation input
        setupManualGeneration();
    } else if (channelId === 'main' && currentServer === 'generator1') {
        // Auto-Typer Bot main channel
        const gen = gameState.generators.generator1 || { bots: 0, efficiency: 1.0 };
        const production = getGeneratorProduction('generator1');
        const totalMessages = gameState.messages + (gameState.fractionalMessages || 0);
        
        contentBody.innerHTML = `
            <div class="generator-content">
                <div class="generator-info">
                    <h2>Auto-Typer Bot</h2>
                    <p>Automatically generates messages for you. Each bot produces 0.1 messages per second.</p>
                </div>
                <div class="generator-stats">
                    <div class="generator-stat">
                        <span class="stat-label">Active Bots:</span>
                        <span class="stat-value">${gen.bots || 0}</span>
                    </div>
                    <div class="generator-stat">
                        <span class="stat-label">Efficiency:</span>
                        <span class="stat-value">${((gen.efficiency || 1.0) * 100).toFixed(0)}%</span>
                    </div>
                    <div class="generator-stat">
                        <span class="stat-label">Production Rate:</span>
                        <span class="stat-value">${production.toFixed(2)} msg/s</span>
                    </div>
                </div>
            </div>
        `;
    } else if (channelId === 'upgrades' && currentServer === 'generator1') {
        // Auto-Typer Bot upgrades
        const gen = gameState.generators.generator1 || { bots: 0, efficiency: 1.0 };
        const botCost = getBotCost(gen.bots || 0);
        const efficiencyCost = getEfficiencyUpgradeCost(gen.efficiency || 1.0);
        const totalMessages = gameState.messages + (gameState.fractionalMessages || 0);
        const canAffordBot = totalMessages >= botCost;
        const canAffordEfficiency = totalMessages >= efficiencyCost;
        
        contentBody.innerHTML = `
            <div class="upgrade-content">
                <div class="upgrade-item">
                    <div class="upgrade-header">
                        <h3 class="upgrade-title">Buy Auto-Typer Bot</h3>
                    </div>
                    <p class="upgrade-description">Purchase a new bot to automatically generate messages. Each bot produces 0.1 messages per second.</p>
                    <div class="upgrade-stats">
                        <div class="upgrade-stat">
                            <span class="stat-label">Current Bots:</span>
                            <span class="stat-value">${gen.bots || 0}</span>
                        </div>
                    </div>
                    <button class="upgrade-button ${canAffordBot ? '' : 'disabled'}" id="buy-bot" ${!canAffordBot ? 'disabled' : ''}>
                        <span class="upgrade-button-text">Purchase Bot</span>
                        <span class="upgrade-button-cost">${formatNumber(botCost, 2)} Messages</span>
                    </button>
                </div>
                
                <div class="upgrade-item">
                    <div class="upgrade-header">
                        <h3 class="upgrade-title">Bot Efficiency</h3>
                    </div>
                    <p class="upgrade-description">Increase the efficiency of all your bots, making them produce more messages per second.</p>
                    <div class="upgrade-stats">
                        <div class="upgrade-stat">
                            <span class="stat-label">Current Efficiency:</span>
                            <span class="stat-value">${((gen.efficiency || 1.0) * 100).toFixed(0)}%</span>
                        </div>
                    </div>
                    <button class="upgrade-button ${canAffordEfficiency ? '' : 'disabled'}" id="upgrade-efficiency" ${!canAffordEfficiency ? 'disabled' : ''}>
                        <span class="upgrade-button-text">Upgrade Efficiency</span>
                        <span class="upgrade-button-cost">${formatNumber(efficiencyCost, 2)} Messages</span>
                    </button>
                </div>
            </div>
        `;
        
        // Setup upgrade handlers
        const buyBotBtn = document.getElementById('buy-bot');
        if (buyBotBtn) {
            buyBotBtn.addEventListener('click', () => {
                purchaseBot('generator1');
            });
        }
        
        const upgradeEfficiencyBtn = document.getElementById('upgrade-efficiency');
        if (upgradeEfficiencyBtn) {
            upgradeEfficiencyBtn.addEventListener('click', () => {
                upgradeBotEfficiency('generator1');
            });
        }
    } else if (channelId === 'global1' && currentServer === 'upgrades') {
        // Global upgrades channel 1
        const multiplierLevel = gameState.upgrades.manualGenerationMultiplier || 0;
        const currentMultiplier = getManualGenerationMultiplier();
        const upgradeCost = getManualGenerationUpgradeCost(multiplierLevel);
        const canAfford = gameState.messages >= upgradeCost;
        
        contentBody.innerHTML = `
            <div class="upgrade-content">
                <div class="upgrade-item">
                    <div class="upgrade-header">
                        <h3 class="upgrade-title">Manual Generation Boost</h3>
                        <div class="upgrade-level">Level ${multiplierLevel}</div>
                    </div>
                    <p class="upgrade-description">Increases messages generated per click by 10% per level.</p>
                    <div class="upgrade-stats">
                        <div class="upgrade-stat">
                            <span class="stat-label">Current Multiplier:</span>
                            <span class="stat-value">${(currentMultiplier * 100).toFixed(0)}%</span>
                        </div>
                        <div class="upgrade-stat">
                            <span class="stat-label">Average Messages Per Click:</span>
                            <span class="stat-value">${getMessagesPerClick().toFixed(1)}</span>
                        </div>
                    </div>
                    <button class="upgrade-button ${canAfford ? '' : 'disabled'}" id="buy-manual-multiplier" ${!canAfford ? 'disabled' : ''}>
                        <span class="upgrade-button-text">Purchase Upgrade</span>
                        <span class="upgrade-button-cost">${formatNumber(upgradeCost)} Messages</span>
                    </button>
                </div>
            </div>
        `;
        
        // Setup upgrade purchase handler
        const buyButton = document.getElementById('buy-manual-multiplier');
        if (buyButton) {
            buyButton.addEventListener('click', () => {
                purchaseManualGenerationUpgrade();
            });
        }
    } else if (channelId === 'general' && currentServer === 'settings') {
        // Settings general channel
        contentBody.innerHTML = `
            <div class="settings-content">
                <div class="settings-section">
                    <h3 class="settings-title">Number Format</h3>
                    <p class="settings-description">Choose how numbers are displayed throughout the game.</p>
                    <div class="settings-options">
                        <label class="settings-option">
                            <input type="radio" name="numberFormat" value="full" ${gameState.settings.numberFormat === 'full' ? 'checked' : ''}>
                            <span>Full Number (1,567,668)</span>
                        </label>
                        <label class="settings-option">
                            <input type="radio" name="numberFormat" value="abbreviated" ${gameState.settings.numberFormat === 'abbreviated' ? 'checked' : ''}>
                            <span>Abbreviated (1.56M)</span>
                        </label>
                        <label class="settings-option">
                            <input type="radio" name="numberFormat" value="scientific" ${gameState.settings.numberFormat === 'scientific' ? 'checked' : ''}>
                            <span>Scientific Notation (1.57e+6)</span>
                        </label>
                    </div>
                    <div class="settings-preview">
                        <span class="settings-preview-label">Preview:</span>
                        <span class="settings-preview-value" id="format-preview">${formatNumber(1567668)}</span>
                    </div>
                </div>
                
                <div class="settings-section">
                    <h3 class="settings-title">Game Data</h3>
                    <p class="settings-description">Manage your save data.</p>
                    <div class="settings-buttons">
                        <button class="settings-button" id="export-save">Export Save</button>
                        <button class="settings-button" id="import-save">Import Save</button>
                        <button class="settings-button danger" id="reset-game">Reset Game</button>
                    </div>
                </div>
            </div>
        `;
        setupSettingsHandlers();
    } else if (channelId === 'about' && currentServer === 'settings') {
        contentBody.innerHTML = `
            <div class="settings-content">
                <div class="settings-section">
                    <h3 class="settings-title">About</h3>
                    <p class="settings-description">Idle Chat - An idle game with a Discord-inspired interface.</p>
                    <p class="settings-description">Build and manage your servers to generate messages!</p>
                </div>
            </div>
        `;
    } else {
        contentBody.innerHTML = `
            <div class="welcome-message">
                <h2>${channel.name}</h2>
                <p>${channel.content}</p>
                <p style="margin-top: 20px; color: #8e9297;">This is a placeholder. Game content will be added here.</p>
            </div>
        `;
    }
}

// Simple encryption/decryption for save files
const ENCRYPTION_KEY = 'idle-chat-2025-secure-key';

function encryptSaveData(data) {
    const jsonString = JSON.stringify(data);
    let encrypted = '';
    for (let i = 0; i < jsonString.length; i++) {
        const charCode = jsonString.charCodeAt(i);
        const keyChar = ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
        encrypted += String.fromCharCode(charCode ^ keyChar);
    }
    // Base64 encode
    return btoa(encrypted);
}

function decryptSaveData(encryptedData) {
    try {
        // Base64 decode
        const decoded = atob(encryptedData);
        let decrypted = '';
        for (let i = 0; i < decoded.length; i++) {
            const charCode = decoded.charCodeAt(i);
            const keyChar = ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
            decrypted += String.fromCharCode(charCode ^ keyChar);
        }
        return JSON.parse(decrypted);
    } catch (e) {
        throw new Error('Invalid save file format');
    }
}

// Auto-save game state
function autoSave() {
    localStorage.setItem('gameState', JSON.stringify(gameState));
}

// Load game state from localStorage
function loadGameState() {
    const saved = localStorage.getItem('gameState');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            gameState = { ...gameState, ...parsed };
            // Ensure settings exist
            if (!gameState.settings) {
                gameState.settings = { numberFormat: 'full' };
            }
            // Ensure upgrades exist
            if (!gameState.upgrades) {
                gameState.upgrades = { manualGenerationMultiplier: 0 };
            }
            // Ensure fractionalMessages exists
            if (gameState.fractionalMessages === undefined) {
                gameState.fractionalMessages = 0;
            }
            // Ensure generators exist
            if (!gameState.generators) {
                gameState.generators = { unlocked: [] };
            }
            if (!gameState.generators.unlocked) {
                gameState.generators.unlocked = [];
            }
            // Initialize generator1 if unlocked
            if (isGeneratorUnlocked('generator1') && !gameState.generators.generator1) {
                gameState.generators.generator1 = { bots: 0, efficiency: 1.0 };
            }
        } catch (e) {
            console.error('Failed to load game state:', e);
        }
    }
}

// Show unlock prompt for locked generator
function showUnlockPrompt(generatorId) {
    const server = servers[generatorId];
    const cost = GENERATOR_COSTS[generatorId];
    const totalMessages = gameState.messages + (gameState.fractionalMessages || 0);
    const canAfford = totalMessages >= cost;
    
    const contentBody = document.getElementById('content-body');
    contentBody.innerHTML = `
        <div class="unlock-prompt">
            <div class="unlock-content">
                <h2>🔒 ${server.name}</h2>
                <p>This generator is locked. Unlock it to start generating messages automatically!</p>
                <div class="unlock-info">
                    <div class="unlock-stat">
                        <span class="stat-label">Unlock Cost:</span>
                        <span class="stat-value">${formatNumber(cost, 2)} Messages</span>
                    </div>
                    <div class="unlock-stat">
                        <span class="stat-label">Your Messages:</span>
                        <span class="stat-value ${canAfford ? '' : 'insufficient'}">${formatNumber(totalMessages, 2)} Messages</span>
                    </div>
                </div>
                <button class="unlock-button ${canAfford ? '' : 'disabled'}" id="unlock-generator" ${!canAfford ? 'disabled' : ''}>
                    Unlock ${server.name}
                </button>
            </div>
        </div>
    `;
    
    const unlockBtn = document.getElementById('unlock-generator');
    if (unlockBtn) {
        unlockBtn.addEventListener('click', () => {
            if (unlockGenerator(generatorId)) {
                loadServer(generatorId);
            } else {
                // Refresh the prompt to update costs
                showUnlockPrompt(generatorId);
            }
        });
    }
}

// Get bot cost (increases with each bot)
function getBotCost(currentBots) {
    // First bot costs 1000, each additional bot costs 1.5x more
    return Math.floor(1000 * Math.pow(1.5, currentBots));
}

// Get efficiency upgrade cost
function getEfficiencyUpgradeCost(currentEfficiency) {
    // Each upgrade increases efficiency by 10%, cost increases exponentially
    const level = Math.floor((currentEfficiency - 1.0) / 0.1);
    return Math.floor(1000 * Math.pow(1.5, level));
}

// Purchase a bot
function purchaseBot(generatorId) {
    if (!isGeneratorUnlocked(generatorId)) return;
    
    const gen = gameState.generators[generatorId];
    if (!gen) return;
    
    const cost = getBotCost(gen.bots || 0);
    const totalMessages = gameState.messages + (gameState.fractionalMessages || 0);
    
    if (totalMessages >= cost) {
        // Deduct cost
        if (gameState.fractionalMessages >= cost) {
            gameState.fractionalMessages -= cost;
        } else {
            const remaining = cost - gameState.fractionalMessages;
            gameState.fractionalMessages = 0;
            gameState.messages -= remaining;
        }
        
        gen.bots = (gen.bots || 0) + 1;
        autoSave();
        updateCurrencyDisplay();
        loadChannel(currentChannel); // Refresh UI
    }
}

// Upgrade bot efficiency
function upgradeBotEfficiency(generatorId) {
    if (!isGeneratorUnlocked(generatorId)) return;
    
    const gen = gameState.generators[generatorId];
    if (!gen) return;
    
    const cost = getEfficiencyUpgradeCost(gen.efficiency || 1.0);
    const totalMessages = gameState.messages + (gameState.fractionalMessages || 0);
    
    if (totalMessages >= cost) {
        // Deduct cost
        if (gameState.fractionalMessages >= cost) {
            gameState.fractionalMessages -= cost;
        } else {
            const remaining = cost - gameState.fractionalMessages;
            gameState.fractionalMessages = 0;
            gameState.messages -= remaining;
        }
        
        gen.efficiency = (gen.efficiency || 1.0) + 0.1;
        autoSave();
        updateCurrencyDisplay();
        loadChannel(currentChannel); // Refresh UI
    }
}

// Get manual generation multiplier
function getManualGenerationMultiplier() {
    const level = gameState.upgrades.manualGenerationMultiplier || 0;
    // Each level gives +10% (1.0, 1.1, 1.2, 1.3, ...)
    return 1.0 + (level * 0.1);
}

// Get messages generated per click (average)
function getMessagesPerClick() {
    return getManualGenerationMultiplier();
}

// Generate a message (used by both typing and clicking)
function generateMessage() {
    const multiplier = getManualGenerationMultiplier();
    
    // Track manual generation event
    manualGenerationHistory.push(Date.now());
    
    // Add fractional messages
    gameState.fractionalMessages = (gameState.fractionalMessages || 0) + multiplier;
    
    // Convert whole parts to messages to prevent precision issues
    // But keep fractional part for display
    const wholePart = Math.floor(gameState.fractionalMessages);
    if (wholePart > 0) {
        gameState.messages += wholePart;
        gameState.fractionalMessages -= wholePart;
    }
    
    updateCurrencyDisplay();
    autoSave();
    
    const popupContainer = document.getElementById('popup-container');
    if (popupContainer) {
        // Show the multiplier value with 1 decimal place
        const displayText = `+${multiplier.toFixed(1)}`;
        showPopup(popupContainer, displayText);
    }
}

// Setup manual generation input handler
function setupManualGeneration() {
    const input = document.getElementById('manual-input');
    const sendButton = document.getElementById('send-button');
    const popupContainer = document.getElementById('popup-container');
    
    if (!input || !popupContainer) return;
    
    // Handle input events (works better on mobile)
    let lastInputTime = 0;
    input.addEventListener('input', (e) => {
        const now = Date.now();
        const inputValue = input.value;
        
        // Only process if there's new input and enough time has passed (prevents rapid fire)
        if (inputValue.length > 0 && now - lastInputTime > 50) {
            lastInputTime = now;
            
            // Generate message for each character
            for (let i = 0; i < inputValue.length; i++) {
                generateMessage();
            }
            
            // Clear input
            input.value = '';
        }
        
        e.preventDefault();
    });
    
    // Also handle keydown for desktop (backup)
    input.addEventListener('keydown', (e) => {
        // Prevent default behavior and clear input
        e.preventDefault();
        input.value = '';
        
        // Only count printable characters (not special keys)
        // Only generate if this key wasn't already pressed (prevents key repeat)
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && !pressedKeys.has(e.key)) {
            pressedKeys.add(e.key);
            generateMessage();
        }
    });
    
    input.addEventListener('keyup', (e) => {
        // Remove key from pressed set when released
        pressedKeys.delete(e.key);
    });
    
    input.addEventListener('paste', (e) => {
        e.preventDefault();
        input.value = '';
    });
    
    // Send button click handler
    if (sendButton) {
        sendButton.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Prevent input blur
        });
        
        sendButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            generateMessage();
            // Don't refocus to avoid flashing
        });
    }
    
    // Focus the input when channel loads
    setTimeout(() => {
        input.focus();
    }, 100);
}

// Show popup number animation
function showPopup(container, text) {
    const popup = document.createElement('div');
    popup.className = 'message-popup';
    popup.textContent = text;
    
    // Random horizontal position (between 20px and 80% of container width)
    const containerWidth = container.offsetWidth || 200;
    const maxLeft = Math.max(containerWidth - 60, 20);
    const randomLeft = Math.random() * (maxLeft - 20) + 20;
    popup.style.left = randomLeft + 'px';
    
    container.appendChild(popup);
    
    // Trigger animation
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            popup.classList.add('animate');
        });
    });
    
    // Fade out
    setTimeout(() => {
        popup.classList.add('fade-out');
    }, 400);
    
    // Remove after animation
    setTimeout(() => {
        popup.remove();
    }, 1000);
}

// Setup settings handlers
function setupSettingsHandlers() {
    // Number format radio buttons
    const formatRadios = document.querySelectorAll('input[name="numberFormat"]');
    formatRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                gameState.settings.numberFormat = e.target.value;
                saveSettings();
                updateCurrencyDisplay();
                // Update preview
                const preview = document.getElementById('format-preview');
                if (preview) {
                    preview.textContent = formatNumber(1567668);
                }
            }
        });
    });
    
    // Export save
    const exportBtn = document.getElementById('export-save');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            // Save current state before exporting
            autoSave();
            // Encrypt the save data
            const encryptedData = encryptSaveData(gameState);
            const saveData = JSON.stringify({
                version: '1.0',
                data: encryptedData
            }, null, 2);
            const blob = new Blob([saveData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'idle-chat-save.json';
            a.click();
            URL.revokeObjectURL(url);
        });
    }
    
    // Import save
    const importBtn = document.getElementById('import-save');
    if (importBtn) {
        importBtn.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'application/json';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        try {
                            const fileContent = JSON.parse(event.target.result);
                            
                            // Check if it's the new encrypted format
                            let imported;
                            if (fileContent.data && fileContent.version) {
                                // New encrypted format
                                imported = decryptSaveData(fileContent.data);
                            } else {
                                // Try to decrypt as if it's just encrypted data (backwards compatibility)
                                try {
                                    imported = decryptSaveData(event.target.result);
                                } catch (e) {
                                    // If decryption fails, try as plain JSON (old format)
                                    imported = fileContent;
                                }
                            }
                            
                            gameState = { ...gameState, ...imported };
                            // Ensure settings exist
                            if (!gameState.settings) {
                                gameState.settings = { numberFormat: 'full' };
                            }
                            // Ensure upgrades exist
                            if (!gameState.upgrades) {
                                gameState.upgrades = { manualGenerationMultiplier: 0 };
                            }
                            // Ensure fractionalMessages exists
                            if (gameState.fractionalMessages === undefined) {
                                gameState.fractionalMessages = 0;
                            }
                            // Ensure generators exist
                            if (!gameState.generators) {
                                gameState.generators = { unlocked: [] };
                            }
                            if (!gameState.generators.unlocked) {
                                gameState.generators.unlocked = [];
                            }
                            // Initialize generator1 if unlocked
                            if (isGeneratorUnlocked('generator1') && !gameState.generators.generator1) {
                                gameState.generators.generator1 = { bots: 0, efficiency: 1.0 };
                            }
                            saveSettings();
                            updateCurrencyDisplay();
                            renderServerSidebar();
                            alert('Save imported successfully!');
                            // Reload current channel to refresh UI
                            loadChannel(currentChannel);
                        } catch (err) {
                            alert('Failed to import save: Invalid or corrupted save file.');
                        }
                    };
                    reader.readAsText(file);
                }
            };
            input.click();
        });
    }
    
    // Reset game
    const resetBtn = document.getElementById('reset-game');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to reset your game? This cannot be undone!')) {
                gameState.messages = 0;
                gameState.fractionalMessages = 0;
                gameState.settings = {
                    numberFormat: 'full'
                };
                gameState.upgrades = {
                    manualGenerationMultiplier: 0
                };
                gameState.generators = {
                    unlocked: [],
                    generator1: { bots: 0, efficiency: 1.0 }
                };
                localStorage.removeItem('gameSettings');
                localStorage.removeItem('gameState');
                saveSettings();
                updateCurrencyDisplay();
                renderServerSidebar();
                alert('Game reset!');
                loadChannel(currentChannel);
            }
        });
    }
}

// Get manual generation upgrade cost
function getManualGenerationUpgradeCost(level) {
    // Base cost 50, increases by 1.5x per level
    // Level 0: 50, Level 1: 75, Level 2: 112.5, Level 3: 168.75, etc.
    return Math.floor(50 * Math.pow(1.5, level));
}

// Purchase manual generation upgrade
function purchaseManualGenerationUpgrade() {
    const currentLevel = gameState.upgrades.manualGenerationMultiplier || 0;
    const cost = getManualGenerationUpgradeCost(currentLevel);
    
    if (gameState.messages >= cost) {
        gameState.messages -= cost;
        gameState.upgrades.manualGenerationMultiplier = (gameState.upgrades.manualGenerationMultiplier || 0) + 1;
        autoSave();
        updateCurrencyDisplay();
        
        // Reload the channel to update the UI
        loadChannel(currentChannel);
    }
}

// Initialize on page load
init();

