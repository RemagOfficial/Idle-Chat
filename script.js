// Generator unlock costs
const GENERATOR_COSTS = {
    generator1: 1000,
    generator2: 1000,
    generator3: 10000
};

// Manual generation tracking
let manualGenerationHistory = []; // Array of timestamps for manual generation events
let pressedKeys = new Set(); // Track which keys are currently pressed
let statsUpdateInterval = null; // Interval for updating stats display

// Game state
let gameState = {
    messages: 0,
    fractionalMessages: 0, // Accumulated fractional messages
    lifetimeMessages: 0, // Total messages ever generated (including spent)
    playtime: 0, // Total playtime in milliseconds
    sessionStartTime: Date.now(), // When current session started
    settings: {
        numberFormat: 'full' // 'full', 'abbreviated', 'scientific'
    },
    upgrades: {
        manualGenerationMultiplier: 0, // Level of manual generation multiplier upgrade
        autoGenerationBoost: 0, // Global boost to all generators
        messageMultiplier: 0, // Global multiplier to all message generation
        costEfficiency: 0 // Reduces all upgrade costs
    },
    generators: {
        unlocked: [], // Array of unlocked generator IDs
        generator1: {
            bots: 0, // Number of auto-typer bots
            efficiency: 1.0, // Efficiency multiplier per bot
            botSpeed: 0, // Bot speed upgrade level (increases msg/s per bot)
            autoBuy: false // Auto-buy bots when affordable
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
let lastChannelsByServer = {}; // Track last opened channel per server (session only)

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
    
    let baseProduction = 0;
    
    if (generatorId === 'generator1') {
        // Base: 1.0 msg/s per bot, +0.1 per bot speed level
        const msgPerBot = 1.0 + ((gen.botSpeed || 0) * 0.1);
        baseProduction = (gen.bots || 0) * msgPerBot * (gen.efficiency || 1.0);
    }
    
    // Apply global auto-generation boost (compounding)
    const boostLevel = gameState.upgrades.autoGenerationBoost || 0;
    const boostMultiplier = Math.pow(1.1, boostLevel); // Each level multiplies by 1.1
    
    return baseProduction * boostMultiplier;
}

// Get global message multiplier
function getGlobalMessageMultiplier() {
    const multiplierLevel = gameState.upgrades.messageMultiplier || 0;
    // Each level multiplies by 1.05 (compounding: 1.0, 1.05, 1.1025, 1.1576, ...)
    return Math.pow(1.05, multiplierLevel);
}

// Get cost reduction multiplier
function getCostReductionMultiplier() {
    const efficiencyLevel = gameState.upgrades.costEfficiency || 0;
    const reduction = Math.min(efficiencyLevel * 0.05, 0.5); // -5% per level, max 50%
    return 1.0 - reduction;
}

// Format playtime
function formatPlaytime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const totalHours = Math.floor(totalMinutes / 60);
    const days = totalHours / 24;
    
    // If 24 hours or more, show as days with 2 decimal places
    if (days >= 1) {
        return `${days.toFixed(2)} Days`;
    }
    
    // Otherwise show as hours:minutes:seconds
    const hours = totalHours;
    const minutes = totalMinutes % 60;
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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
    
    // Initialize session start time if not already set
    if (!gameState.sessionStartTime) {
        gameState.sessionStartTime = Date.now();
    }
    
    renderServerSidebar();
    setupChannelItems();
    setupMobileMenu();
    loadServer(currentServer);
    updateCurrencyDisplay();
    
    // Track last playtime update
    let lastPlaytimeUpdate = Date.now();
    
    // Passive generation loop (runs 10 times per second for smooth updates)
    setInterval(() => {
        // Update playtime based on actual elapsed time
        const currentTime = Date.now();
        const elapsed = currentTime - lastPlaytimeUpdate;
        gameState.playtime = (gameState.playtime || 0) + elapsed;
        lastPlaytimeUpdate = currentTime;
        
        let totalProduction = 0;
        
        // Calculate production from all unlocked generators
        const generatorOrder = ['generator1', 'generator2', 'generator3'];
        for (const genId of generatorOrder) {
            if (isGeneratorUnlocked(genId)) {
                totalProduction += getGeneratorProduction(genId);
            }
        }
        
        // Apply global message multiplier to production
        const globalMultiplier = getGlobalMessageMultiplier();
        totalProduction *= globalMultiplier;
        
        // Add production (divided by 10 since we run 10 times per second)
        if (totalProduction > 0) {
            gameState.fractionalMessages = (gameState.fractionalMessages || 0) + (totalProduction / 10);
            
            // Convert whole parts to messages
            const wholePart = Math.floor(gameState.fractionalMessages);
            if (wholePart > 0) {
                gameState.messages += wholePart;
                gameState.lifetimeMessages = (gameState.lifetimeMessages || 0) + wholePart;
                gameState.fractionalMessages -= wholePart;
            }
        }
        
        // Auto-buy bots if enabled
        if (isGeneratorUnlocked('generator1')) {
            const gen = gameState.generators.generator1;
            if (gen && gen.autoBuy) {
                const totalMessages = gameState.messages + (gameState.fractionalMessages || 0);
                const botCost = Math.floor(getBotCost(gen.bots || 0) * getCostReductionMultiplier());
                if (totalMessages >= botCost) {
                    purchaseBot('generator1');
                }
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
    // Only include manual multiplier here, global multiplier is applied separately
    const manualMultiplier = getManualGenerationMultiplier();
    const globalMultiplier = getGlobalMessageMultiplier();
    const eventsPerSecond = manualGenerationHistory.length / (windowMs / 1000);
    return eventsPerSecond * manualMultiplier * globalMultiplier;
}

// Get total messages per second (including manual generation)
function getTotalMessagesPerSecond() {
    let total = 0;
    
    // Add generator production (already includes auto-generation boost)
    const generatorOrder = ['generator1', 'generator2', 'generator3'];
    for (const genId of generatorOrder) {
        if (isGeneratorUnlocked(genId)) {
            total += getGeneratorProduction(genId);
        }
    }
    
    // Apply global message multiplier to generator production
    const globalMultiplier = getGlobalMessageMultiplier();
    total *= globalMultiplier;
    
    // Add actual manual generation rate (already includes both multipliers)
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
    
    // Load channel: prefer saved channel for this server, then current channel, then first channel
    let channelToLoad = null;
    
    // Check if we have a saved channel for this server
    if (lastChannelsByServer[serverId] && server.channels[lastChannelsByServer[serverId]]) {
        channelToLoad = lastChannelsByServer[serverId];
    }
    // Otherwise, check if current channel exists in this server
    else if (server.channels[currentChannel]) {
        channelToLoad = currentChannel;
    }
    // Otherwise, use first channel
    else {
        channelToLoad = channelIds[0];
    }
    
    currentChannel = channelToLoad;
    loadChannel(currentChannel);
}

// Load a channel and update the content
function loadChannel(channelId) {
    if (!servers[currentServer] || !servers[currentServer].channels[channelId]) return;
    
    // Clear stats update interval if switching away from stats
    if (statsUpdateInterval && currentChannel === 'stats' && channelId !== 'stats') {
        clearInterval(statsUpdateInterval);
        statsUpdateInterval = null;
    }
    
    currentChannel = channelId;
    
    // Save this channel as the last opened channel for this server
    lastChannelsByServer[currentServer] = channelId;
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
        const gen = gameState.generators.generator1 || { bots: 0, efficiency: 1.0, botSpeed: 0, autoBuy: false };
        const production = getGeneratorProduction('generator1');
        const msgPerBot = 1.0 + ((gen.botSpeed || 0) * 0.1);
        const totalMessages = gameState.messages + (gameState.fractionalMessages || 0);
        
        contentBody.innerHTML = `
            <div class="generator-content">
                <div class="generator-info">
                    <h2>Auto-Typer Bot</h2>
                    <p>Automatically generates messages for you. Each bot produces ${msgPerBot.toFixed(2)} messages per second.</p>
                </div>
                <div class="generator-stats">
                    <div class="generator-stat">
                        <span class="stat-label">Active Bots:</span>
                        <span class="stat-value">${gen.bots || 0}</span>
                    </div>
                    <div class="generator-stat">
                        <span class="stat-label">Bot Speed:</span>
                        <span class="stat-value">Level ${gen.botSpeed || 0}</span>
                    </div>
                    <div class="generator-stat">
                        <span class="stat-label">Efficiency:</span>
                        <span class="stat-value">${((gen.efficiency || 1.0) * 100).toFixed(0)}%</span>
                    </div>
                    <div class="generator-stat">
                        <span class="stat-label">Auto-Buy:</span>
                        <span class="stat-value">${gen.autoBuy ? 'Enabled' : 'Disabled'}</span>
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
        const gen = gameState.generators.generator1 || { bots: 0, efficiency: 1.0, botSpeed: 0, autoBuy: false };
        const botCost = Math.floor(getBotCost(gen.bots || 0) * getCostReductionMultiplier());
        const efficiencyCost = Math.floor(getEfficiencyUpgradeCost(gen.efficiency || 1.0) * getCostReductionMultiplier());
        const botSpeedCost = Math.floor(getBotSpeedCost(gen.botSpeed || 0) * getCostReductionMultiplier());
        const autoBuyCost = 5000;
        const totalMessages = gameState.messages + (gameState.fractionalMessages || 0);
        const canAffordBot = totalMessages >= botCost;
        const canAffordEfficiency = totalMessages >= efficiencyCost;
        const canAffordBotSpeed = totalMessages >= botSpeedCost;
        const canAffordAutoBuy = totalMessages >= autoBuyCost && !gen.autoBuy;
        
        contentBody.innerHTML = `
            <div class="upgrade-content">
                <div class="upgrade-item">
                    <div class="upgrade-header">
                        <h3 class="upgrade-title">Buy Auto-Typer Bot</h3>
                    </div>
                    <p class="upgrade-description">Purchase a new bot to automatically generate messages. Each bot produces 1.0 messages per second.</p>
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
                
                <div class="upgrade-item">
                    <div class="upgrade-header">
                        <h3 class="upgrade-title">Bot Speed</h3>
                        <div class="upgrade-level">Level ${gen.botSpeed || 0}</div>
                    </div>
                    <p class="upgrade-description">Increases the base messages per second each bot produces by 0.1 per level.</p>
                    <div class="upgrade-stats">
                        <div class="upgrade-stat">
                            <span class="stat-label">Current Speed:</span>
                            <span class="stat-value">${(1.0 + ((gen.botSpeed || 0) * 0.1)).toFixed(2)} msg/s per bot</span>
                        </div>
                    </div>
                    <button class="upgrade-button ${canAffordBotSpeed ? '' : 'disabled'}" id="upgrade-bot-speed" ${!canAffordBotSpeed ? 'disabled' : ''}>
                        <span class="upgrade-button-text">Upgrade Bot Speed</span>
                        <span class="upgrade-button-cost">${formatNumber(botSpeedCost, 2)} Messages</span>
                    </button>
                </div>
                
                <div class="upgrade-item">
                    <div class="upgrade-header">
                        <h3 class="upgrade-title">Auto-Buy Bots</h3>
                    </div>
                    <p class="upgrade-description">Automatically purchase bots when you have enough messages. Can be toggled on/off.</p>
                    <div class="upgrade-stats">
                        <div class="upgrade-stat">
                            <span class="stat-label">Status:</span>
                            <span class="stat-value">${gen.autoBuy ? 'Enabled' : 'Disabled'}</span>
                        </div>
                    </div>
                    ${gen.autoBuy ? `
                        <button class="upgrade-button" id="toggle-auto-buy">
                            <span class="upgrade-button-text">Disable Auto-Buy</span>
                        </button>
                    ` : `
                        <button class="upgrade-button ${canAffordAutoBuy ? '' : 'disabled'}" id="buy-auto-buy" ${!canAffordAutoBuy ? 'disabled' : ''}>
                            <span class="upgrade-button-text">Enable Auto-Buy</span>
                            <span class="upgrade-button-cost">${formatNumber(autoBuyCost, 2)} Messages</span>
                        </button>
                    `}
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
        
        const upgradeBotSpeedBtn = document.getElementById('upgrade-bot-speed');
        if (upgradeBotSpeedBtn) {
            upgradeBotSpeedBtn.addEventListener('click', () => {
                upgradeBotSpeed('generator1');
            });
        }
        
        const buyAutoBuyBtn = document.getElementById('buy-auto-buy');
        if (buyAutoBuyBtn) {
            buyAutoBuyBtn.addEventListener('click', () => {
                purchaseAutoBuy('generator1');
            });
        }
        
        const toggleAutoBuyBtn = document.getElementById('toggle-auto-buy');
        if (toggleAutoBuyBtn) {
            toggleAutoBuyBtn.addEventListener('click', () => {
                toggleAutoBuy('generator1');
            });
        }
    } else if (channelId === 'global1' && currentServer === 'upgrades') {
        // Global upgrades channel 1
        const multiplierLevel = gameState.upgrades.manualGenerationMultiplier || 0;
        const currentMultiplier = getManualGenerationMultiplier();
        const upgradeCost = Math.floor(getManualGenerationUpgradeCost(multiplierLevel) * getCostReductionMultiplier());
        const totalMessages = gameState.messages + (gameState.fractionalMessages || 0);
        const canAfford = totalMessages >= upgradeCost;
        
        const autoBoostLevel = gameState.upgrades.autoGenerationBoost || 0;
        const autoBoostCost = Math.floor(getAutoGenerationBoostCost(autoBoostLevel) * getCostReductionMultiplier());
        const canAffordAutoBoost = totalMessages >= autoBoostCost;
        
        const messageMultiplierLevel = gameState.upgrades.messageMultiplier || 0;
        const messageMultiplierCost = Math.floor(getMessageMultiplierCost(messageMultiplierLevel) * getCostReductionMultiplier());
        const canAffordMessageMultiplier = totalMessages >= messageMultiplierCost;
        
        const costEfficiencyLevel = gameState.upgrades.costEfficiency || 0;
        const costEfficiencyCost = Math.floor(getCostEfficiencyCost(costEfficiencyLevel) * getCostReductionMultiplier());
        const canAffordCostEfficiency = totalMessages >= costEfficiencyCost;
        const costReduction = Math.min(costEfficiencyLevel * 5, 50);
        
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
                        <span class="upgrade-button-cost">${formatNumber(upgradeCost, 2)} Messages</span>
                    </button>
                </div>
                
                <div class="upgrade-item">
                    <div class="upgrade-header">
                        <h3 class="upgrade-title">Auto-Generation Boost</h3>
                        <div class="upgrade-level">Level ${autoBoostLevel}</div>
                    </div>
                    <p class="upgrade-description">Increases all generator production by 10% per level.</p>
                    <div class="upgrade-stats">
                        <div class="upgrade-stat">
                            <span class="stat-label">Current Boost:</span>
                            <span class="stat-value">+${(autoBoostLevel * 10).toFixed(0)}%</span>
                        </div>
                    </div>
                    <button class="upgrade-button ${canAffordAutoBoost ? '' : 'disabled'}" id="buy-auto-boost" ${!canAffordAutoBoost ? 'disabled' : ''}>
                        <span class="upgrade-button-text">Purchase Upgrade</span>
                        <span class="upgrade-button-cost">${formatNumber(autoBoostCost, 2)} Messages</span>
                    </button>
                </div>
                
                <div class="upgrade-item">
                    <div class="upgrade-header">
                        <h3 class="upgrade-title">Message Multiplier</h3>
                        <div class="upgrade-level">Level ${messageMultiplierLevel}</div>
                    </div>
                    <p class="upgrade-description">Increases all message generation (manual and auto) by 5% per level.</p>
                    <div class="upgrade-stats">
                        <div class="upgrade-stat">
                            <span class="stat-label">Current Multiplier:</span>
                            <span class="stat-value">+${(messageMultiplierLevel * 5).toFixed(0)}%</span>
                        </div>
                    </div>
                    <button class="upgrade-button ${canAffordMessageMultiplier ? '' : 'disabled'}" id="buy-message-multiplier" ${!canAffordMessageMultiplier ? 'disabled' : ''}>
                        <span class="upgrade-button-text">Purchase Upgrade</span>
                        <span class="upgrade-button-cost">${formatNumber(messageMultiplierCost, 2)} Messages</span>
                    </button>
                </div>
                
                <div class="upgrade-item">
                    <div class="upgrade-header">
                        <h3 class="upgrade-title">Cost Efficiency</h3>
                        <div class="upgrade-level">Level ${costEfficiencyLevel}</div>
                    </div>
                    <p class="upgrade-description">Reduces all upgrade costs by 5% per level (max 50% reduction).</p>
                    <div class="upgrade-stats">
                        <div class="upgrade-stat">
                            <span class="stat-label">Current Reduction:</span>
                            <span class="stat-value">-${costReduction.toFixed(0)}%</span>
                        </div>
                    </div>
                    <button class="upgrade-button ${canAffordCostEfficiency ? '' : 'disabled'}" id="buy-cost-efficiency" ${!canAffordCostEfficiency ? 'disabled' : ''}>
                        <span class="upgrade-button-text">Purchase Upgrade</span>
                        <span class="upgrade-button-cost">${formatNumber(costEfficiencyCost, 2)} Messages</span>
                    </button>
                </div>
            </div>
        `;
        
        // Setup upgrade purchase handlers
        const buyManualButton = document.getElementById('buy-manual-multiplier');
        if (buyManualButton) {
            buyManualButton.addEventListener('click', () => {
                purchaseManualGenerationUpgrade();
            });
        }
        
        const buyAutoBoostButton = document.getElementById('buy-auto-boost');
        if (buyAutoBoostButton) {
            buyAutoBoostButton.addEventListener('click', () => {
                purchaseAutoGenerationBoost();
            });
        }
        
        const buyMessageMultiplierButton = document.getElementById('buy-message-multiplier');
        if (buyMessageMultiplierButton) {
            buyMessageMultiplierButton.addEventListener('click', () => {
                purchaseMessageMultiplier();
            });
        }
        
        const buyCostEfficiencyButton = document.getElementById('buy-cost-efficiency');
        if (buyCostEfficiencyButton) {
            buyCostEfficiencyButton.addEventListener('click', () => {
                purchaseCostEfficiency();
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
    } else if (channelId === 'stats' && currentServer === 'home') {
        // Stats channel
        const totalMessages = gameState.messages + (gameState.fractionalMessages || 0);
        const lifetimeMessages = gameState.lifetimeMessages || 0;
        const playtime = formatPlaytime(gameState.playtime || 0);
        const msgPerSecond = getTotalMessagesPerSecond();
        
        // Get upgrade buffs (compounding multipliers)
        const manualGenLevel = gameState.upgrades.manualGenerationMultiplier || 0;
        const manualGenMultiplier = getManualGenerationMultiplier();
        const manualGenBuff = ((manualGenMultiplier - 1.0) * 100).toFixed(1);
        
        const autoBoostLevel = gameState.upgrades.autoGenerationBoost || 0;
        const autoBoostMultiplier = Math.pow(1.1, autoBoostLevel);
        const autoBoostBuff = ((autoBoostMultiplier - 1.0) * 100).toFixed(1);
        
        const messageMultiplierLevel = gameState.upgrades.messageMultiplier || 0;
        const messageMultiplierMultiplier = getGlobalMessageMultiplier();
        const messageMultiplierBuff = ((messageMultiplierMultiplier - 1.0) * 100).toFixed(1);
        
        const costEfficiencyLevel = gameState.upgrades.costEfficiency || 0;
        const costEfficiencyBuff = Math.min(costEfficiencyLevel * 5, 50).toFixed(0);
        
        // Generator stats
        let generatorStatsHtml = '';
        if (isGeneratorUnlocked('generator1')) {
            const gen = gameState.generators.generator1 || {};
            const production = getGeneratorProduction('generator1');
            generatorStatsHtml = `
                <div class="stats-section">
                    <h3 class="stats-section-title">Auto-Typer Bot</h3>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-label">Active Bots:</span>
                            <span class="stat-value">${gen.bots || 0}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Bot Speed:</span>
                            <span class="stat-value">Level ${gen.botSpeed || 0}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Efficiency:</span>
                            <span class="stat-value">${((gen.efficiency || 1.0) * 100).toFixed(0)}%</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Production Rate:</span>
                            <span class="stat-value">${formatNumber(production, 2)} msg/s</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        contentBody.innerHTML = `
            <div class="stats-content">
                <div class="stats-section">
                    <h3 class="stats-section-title">General Statistics</h3>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-label">Current Messages:</span>
                            <span class="stat-value">${formatNumber(totalMessages, 2)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Lifetime Messages:</span>
                            <span class="stat-value">${formatNumber(lifetimeMessages, 2)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Messages per Second:</span>
                            <span class="stat-value">${formatNumber(msgPerSecond, 2)} msg/s</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Playtime:</span>
                            <span class="stat-value" id="playtime-display">${playtime}</span>
                        </div>
                    </div>
                </div>
                
                <div class="stats-section">
                    <h3 class="stats-section-title">Active Upgrades</h3>
                    <div class="stats-grid">
                        ${manualGenLevel > 0 ? `
                        <div class="stat-item">
                            <span class="stat-label">Manual Generation:</span>
                            <span class="stat-value">+${manualGenBuff}%</span>
                        </div>
                        ` : ''}
                        ${autoBoostLevel > 0 ? `
                        <div class="stat-item">
                            <span class="stat-label">Auto-Generation Boost:</span>
                            <span class="stat-value">+${autoBoostBuff}%</span>
                        </div>
                        ` : ''}
                        ${messageMultiplierLevel > 0 ? `
                        <div class="stat-item">
                            <span class="stat-label">Message Multiplier:</span>
                            <span class="stat-value">+${messageMultiplierBuff}%</span>
                        </div>
                        ` : ''}
                        ${costEfficiencyLevel > 0 ? `
                        <div class="stat-item">
                            <span class="stat-label">Cost Efficiency:</span>
                            <span class="stat-value">-${costEfficiencyBuff}%</span>
                        </div>
                        ` : ''}
                        ${manualGenLevel === 0 && autoBoostLevel === 0 && messageMultiplierLevel === 0 && costEfficiencyLevel === 0 ? `
                        <div class="stat-item">
                            <span class="stat-label" style="color: #72767d;">No active upgrades</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                ${generatorStatsHtml}
            </div>
        `;
        
        // Update playtime display every second
        if (statsUpdateInterval) {
            clearInterval(statsUpdateInterval);
        }
        statsUpdateInterval = setInterval(() => {
            const playtimeDisplay = document.getElementById('playtime-display');
            if (playtimeDisplay) {
                playtimeDisplay.textContent = formatPlaytime(gameState.playtime || 0);
            }
        }, 1000);
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
            // Ensure lifetimeMessages exists
            if (gameState.lifetimeMessages === undefined) {
                gameState.lifetimeMessages = gameState.messages || 0;
            }
            // Ensure playtime exists
            if (gameState.playtime === undefined) {
                gameState.playtime = 0;
            }
            // Ensure sessionStartTime exists
            if (!gameState.sessionStartTime) {
                gameState.sessionStartTime = Date.now();
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
                gameState.generators.generator1 = { bots: 0, efficiency: 1.0, botSpeed: 0, autoBuy: false };
            }
            // Ensure generator1 has all properties
            if (gameState.generators.generator1) {
                if (gameState.generators.generator1.botSpeed === undefined) {
                    gameState.generators.generator1.botSpeed = 0;
                }
                if (gameState.generators.generator1.autoBuy === undefined) {
                    gameState.generators.generator1.autoBuy = false;
                }
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
    // Fixed cost per bot (doesn't increase)
    return 1000;
}

// Get efficiency upgrade cost
function getEfficiencyUpgradeCost(currentEfficiency) {
    // Each upgrade increases efficiency by 10%, cost increases more slowly
    const level = Math.floor((currentEfficiency - 1.0) / 0.1);
    return Math.floor(500 * Math.pow(1.2, level));
}

// Get bot speed upgrade cost
function getBotSpeedCost(currentLevel) {
    // Base cost 250, increases more slowly (1.2x per level)
    return Math.floor(250 * Math.pow(1.2, currentLevel));
}

// Get auto-generation boost cost
function getAutoGenerationBoostCost(currentLevel) {
    // Base cost 500, increases more slowly (1.2x per level)
    return Math.floor(500 * Math.pow(1.2, currentLevel));
}

// Get message multiplier cost
function getMessageMultiplierCost(currentLevel) {
    // Base cost 1000, increases more slowly (1.2x per level)
    return Math.floor(1000 * Math.pow(1.2, currentLevel));
}

// Get cost efficiency cost
function getCostEfficiencyCost(currentLevel) {
    // Base cost 2000, increases more slowly (1.2x per level)
    return Math.floor(2000 * Math.pow(1.2, currentLevel));
}

// Purchase a bot
function purchaseBot(generatorId) {
    if (!isGeneratorUnlocked(generatorId)) return;
    
    const gen = gameState.generators[generatorId];
    if (!gen) return;
    
    const cost = Math.floor(getBotCost(gen.bots || 0) * getCostReductionMultiplier());
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
    
    const cost = Math.floor(getEfficiencyUpgradeCost(gen.efficiency || 1.0) * getCostReductionMultiplier());
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
    // Each level multiplies by 1.1 (compounding: 1.0, 1.1, 1.21, 1.331, ...)
    return Math.pow(1.1, level);
}

// Get messages generated per click (average)
function getMessagesPerClick() {
    return getManualGenerationMultiplier();
}

// Generate a message (used by both typing and clicking)
function generateMessage() {
    const manualMultiplier = getManualGenerationMultiplier();
    const globalMultiplier = getGlobalMessageMultiplier();
    const totalMultiplier = manualMultiplier * globalMultiplier;
    
    // Track manual generation event
    manualGenerationHistory.push(Date.now());
    
    // Add fractional messages (with global multiplier)
    gameState.fractionalMessages = (gameState.fractionalMessages || 0) + totalMultiplier;
    
    // Convert whole parts to messages to prevent precision issues
    // But keep fractional part for display
    const wholePart = Math.floor(gameState.fractionalMessages);
    if (wholePart > 0) {
        gameState.messages += wholePart;
        gameState.lifetimeMessages = (gameState.lifetimeMessages || 0) + wholePart;
        gameState.fractionalMessages -= wholePart;
    }
    
    updateCurrencyDisplay();
    autoSave();
    
    const popupContainer = document.getElementById('popup-container');
    if (popupContainer) {
        // Show the multiplier value with 1 decimal place
        const displayText = `+${totalMultiplier.toFixed(1)}`;
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
    let isPasting = false;
    input.addEventListener('input', (e) => {
        const now = Date.now();
        const inputValue = input.value;
        
        // If pasting, only generate 1 message (handled in paste event)
        if (isPasting) {
            input.value = '';
            e.preventDefault();
            return;
        }
        
        // Only process if there's new input and enough time has passed (prevents rapid fire)
        if (inputValue.length > 0 && now - lastInputTime > 50) {
            lastInputTime = now;
            
            // Limit to 1 character per input event to prevent paste lag
            if (inputValue.length === 1) {
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
        isPasting = true;
        
        // Paste only generates 1 message (game is about typing, not pasting)
        generateMessage();
        
        // Clear input
        input.value = '';
        
        // Reset paste flag after a short delay
        setTimeout(() => {
            isPasting = false;
        }, 100);
    });
    
    // Send button click handler
    if (sendButton) {
        sendButton.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Prevent input blur
        });
        
        sendButton.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Prevent keyboard on mobile
        });
        
        sendButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Blur input to close keyboard on mobile
            if (input) {
                input.blur();
            }
            
            generateMessage();
        });
        
        sendButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Blur input to close keyboard on mobile
            if (input) {
                input.blur();
            }
            
            generateMessage();
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
                                gameState.generators.generator1 = { bots: 0, efficiency: 1.0, botSpeed: 0, autoBuy: false };
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
                gameState.lifetimeMessages = 0;
                gameState.playtime = 0;
                gameState.sessionStartTime = Date.now();
                gameState.settings = {
                    numberFormat: 'full'
                };
                gameState.upgrades = {
                    manualGenerationMultiplier: 0,
                    autoGenerationBoost: 0,
                    messageMultiplier: 0,
                    costEfficiency: 0
                };
                gameState.generators = {
                    unlocked: [],
                    generator1: { bots: 0, efficiency: 1.0, botSpeed: 0, autoBuy: false }
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
    // Base cost 50, increases more slowly (1.2x per level)
    // Level 0: 50, Level 1: 60, Level 2: 72, Level 3: 86.4, etc.
    return Math.floor(50 * Math.pow(1.2, level));
}

// Purchase manual generation upgrade
function purchaseManualGenerationUpgrade() {
    const currentLevel = gameState.upgrades.manualGenerationMultiplier || 0;
    const cost = Math.floor(getManualGenerationUpgradeCost(currentLevel) * getCostReductionMultiplier());
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
        
        gameState.upgrades.manualGenerationMultiplier = (gameState.upgrades.manualGenerationMultiplier || 0) + 1;
        autoSave();
        updateCurrencyDisplay();
        
        // Reload the channel to update the UI
        loadChannel(currentChannel);
    }
}

// Purchase auto-generation boost
function purchaseAutoGenerationBoost() {
    const currentLevel = gameState.upgrades.autoGenerationBoost || 0;
    const cost = Math.floor(getAutoGenerationBoostCost(currentLevel) * getCostReductionMultiplier());
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
        
        gameState.upgrades.autoGenerationBoost = (gameState.upgrades.autoGenerationBoost || 0) + 1;
        autoSave();
        updateCurrencyDisplay();
        loadChannel(currentChannel);
    }
}

// Purchase message multiplier
function purchaseMessageMultiplier() {
    const currentLevel = gameState.upgrades.messageMultiplier || 0;
    const cost = Math.floor(getMessageMultiplierCost(currentLevel) * getCostReductionMultiplier());
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
        
        gameState.upgrades.messageMultiplier = (gameState.upgrades.messageMultiplier || 0) + 1;
        autoSave();
        updateCurrencyDisplay();
        loadChannel(currentChannel);
    }
}

// Purchase cost efficiency
function purchaseCostEfficiency() {
    const currentLevel = gameState.upgrades.costEfficiency || 0;
    const cost = Math.floor(getCostEfficiencyCost(currentLevel) * getCostReductionMultiplier());
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
        
        gameState.upgrades.costEfficiency = (gameState.upgrades.costEfficiency || 0) + 1;
        autoSave();
        updateCurrencyDisplay();
        loadChannel(currentChannel);
    }
}

// Upgrade bot speed
function upgradeBotSpeed(generatorId) {
    if (!isGeneratorUnlocked(generatorId)) return;
    
    const gen = gameState.generators[generatorId];
    if (!gen) return;
    
    const currentLevel = gen.botSpeed || 0;
    const cost = Math.floor(getBotSpeedCost(currentLevel) * getCostReductionMultiplier());
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
        
        gen.botSpeed = (gen.botSpeed || 0) + 1;
        autoSave();
        updateCurrencyDisplay();
        loadChannel(currentChannel);
    }
}

// Purchase auto-buy
function purchaseAutoBuy(generatorId) {
    if (!isGeneratorUnlocked(generatorId)) return;
    
    const gen = gameState.generators[generatorId];
    if (!gen || gen.autoBuy) return;
    
    const cost = 5000;
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
        
        gen.autoBuy = true;
        autoSave();
        updateCurrencyDisplay();
        loadChannel(currentChannel);
    }
}

// Toggle auto-buy
function toggleAutoBuy(generatorId) {
    if (!isGeneratorUnlocked(generatorId)) return;
    
    const gen = gameState.generators[generatorId];
    if (!gen) return;
    
    gen.autoBuy = !gen.autoBuy;
    autoSave();
    loadChannel(currentChannel);
}

// Initialize on page load
init();

