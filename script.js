// Generator unlock costs
const GENERATOR_COSTS = {
    generator1: 1000,
    generator2: 10000, // 10x generator1
    generator3: 100000 // 10x generator2
};

// Manual generation tracking
let manualGenerationHistory = []; // Array of timestamps for manual generation events
let pressedKeys = new Set(); // Track which keys are currently pressed
let statsUpdateInterval = null; // Interval for updating stats display
let manualCharacterCount = 0; // Track characters typed for message generation (1 message per 10 chars)

// Game state
let gameState = {
    messages: 0,
    fractionalMessages: 0, // Accumulated fractional messages
    lifetimeMessages: 0, // Total messages ever generated (including spent)
    playtime: 0, // Total playtime in milliseconds
    sessionStartTime: Date.now(), // When current session started
    settings: {
        numberFormat: 'full', // 'full', 'abbreviated', 'scientific'
        backgroundColor: '#36393f', // Default Discord dark gray
        accentColor: '#5865f2' // Default Discord blue
    },
    upgrades: {
        manualGenerationMultiplier: 0, // Level of manual generation multiplier upgrade
        autoGenerationBoost: 0, // Global boost to all generators
        messageMultiplier: 0, // Global multiplier to all message generation
        costEfficiency: 0 // Reduces all upgrade costs
    },
    research: {
        globalBoostPurchased: false, // Center node: +100% production to all sources (costs 10 points)
        manualProduction: 0, // Manual generation production buff (max 5)
        botProduction: 0, // Bot (generator1) production buff (max 5)
        cascadeProduction: 0 // Cascade (generator2) production buff (max 5)
    },
    generators: {
        unlocked: [], // Array of unlocked generator IDs
        generator1: {
            bots: 0, // Number of auto-typer bots
            efficiency: 1.0, // Efficiency multiplier per bot
            botSpeed: 0, // Bot speed upgrade level (increases msg/s per bot)
            autoBuy: false, // Auto-buy bots when affordable
            autoBuyPurchased: false, // Whether auto-buy has been purchased
            autoBuyDelayLevel: 0, // Level of auto-buy delay reduction upgrade
            prestigeLevel: 0 // Number of times this generator has been prestiged
        },
        generator2: {
            cascades: 0, // Number of message cascades (generates based on generator1 bots)
            cascadeEfficiency: 0.1, // Percentage of generator1 production per cascade (10% base)
            autoBuy: false, // Auto-buy cascades when affordable
            autoBuyPurchased: false, // Whether auto-buy has been purchased
            autoBuyDelayLevel: 0, // Level of auto-buy delay reduction upgrade
            prestigeLevel: 0 // Number of times this generator has been prestiged
        }
    }
};

// Load settings from localStorage
function loadSettings() {
    const saved = localStorage.getItem('gameSettings');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            // Merge saved settings, preserving color settings if they exist
            gameState.settings = { 
                ...gameState.settings, 
                ...parsed,
                // Preserve color settings if they were saved
                backgroundColor: parsed.backgroundColor || gameState.settings.backgroundColor || '#36393f',
                accentColor: parsed.accentColor || gameState.settings.accentColor || '#5865f2'
            };
        } catch (e) {
            console.error('Failed to load settings:', e);
        }
    }
    // Ensure color settings exist with defaults
    if (!gameState.settings.backgroundColor) {
        gameState.settings.backgroundColor = '#36393f';
    }
    if (!gameState.settings.accentColor) {
        gameState.settings.accentColor = '#5865f2';
    }
}

// Save settings to localStorage
function saveSettings() {
    // Ensure color settings are included before saving
    if (!gameState.settings.backgroundColor) {
        gameState.settings.backgroundColor = '#36393f';
    }
    if (!gameState.settings.accentColor) {
        gameState.settings.accentColor = '#5865f2';
    }
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
            general: { name: 'general', content: 'Server upgrades and management' }
        }
    },
    generator2: {
        name: 'Message Cascade',
        locked: true,
        channels: {
            general: { name: 'general', content: 'Cascade upgrades and management' }
        }
    },
    generator3: {
        name: 'Research Lab',
        locked: true,
        channels: {
            research: { name: 'research-tree', content: 'Research upgrades and technology' }
        }
    },
    upgrades: {
        name: 'Global Upgrades',
        channels: {
            global1: { name: 'global-upgrade-1', content: 'Global upgrade options' }
        }
    },
    settings: {
        name: 'Settings',
        channels: {
            general: { name: 'general', content: 'General game settings' },
            changelog: { name: 'changelog', content: 'Game changelog and updates' },
            about: { name: 'about', content: 'About the game' }
        }
    }
};

let currentServer = 'home';
let currentChannel = 'manual';
let lastChannelsByServer = {}; // Track last opened channel per server (session only)

// Random server names for generators
const SERVER_NAMES = [
    'Gaming Paradise', 'Tech Hub', 'Chill Zone', 'Gamer Central', 'Pixel Party',
    'Digital Den', 'Code Club', 'Game Masters', 'Retro Gaming', 'Pro Gamers',
    'Elite Squad', 'Victory Lane', 'Game Station', 'Arcade Heroes', 'Pixel Perfect',
    'Digital Realm', 'Gaming Universe', 'The Nexus', 'Cyber Space', 'Game World',
    'Battle Station', 'Player Hub', 'Gaming Empire', 'The Arena', 'Game Lab',
    'Digital Domain', 'Pro League', 'Game Central', 'The Guild', 'Champions HQ'
];

// Get server name for a generator (stored name or default)
function getGeneratorServerName(generatorId) {
    if (!servers[generatorId]) return '';
    
    // Check if generator is unlocked and has a stored name
    if (isGeneratorUnlocked(generatorId) && gameState.generators[generatorId]?.name) {
        return gameState.generators[generatorId].name;
    }
    
    // Return default name from servers object
    return servers[generatorId].name;
}

// Assign a random server name to a generator
function assignRandomServerName(generatorId) {
    // Initialize generator object if it doesn't exist (for preview names)
    if (!gameState.generators[generatorId]) {
        gameState.generators[generatorId] = {};
    }
    
    const gen = gameState.generators[generatorId];
    if (!gen) return;
    
    // Only assign if it doesn't already have a name (preserves preview name)
    if (!gen.name) {
        // Get names already used to avoid duplicates
        const usedNames = new Set();
        ['generator1', 'generator2', 'generator3'].forEach(genId => {
            if (genId !== generatorId && gameState.generators[genId]?.name) {
                usedNames.add(gameState.generators[genId].name);
            }
        });
        
        // Get available names
        const availableNames = SERVER_NAMES.filter(name => !usedNames.has(name));
        
        // Pick a random one
        if (availableNames.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableNames.length);
            gen.name = availableNames[randomIndex];
        } else {
            // Fallback if all names are used (shouldn't happen with only 3 generators)
            gen.name = SERVER_NAMES[Math.floor(Math.random() * SERVER_NAMES.length)];
        }
    }
}

// Get or generate a preview name for a locked generator (stores it for later use)
function getPreviewServerName(generatorId) {
    // This will create the generator object and assign a name if it doesn't exist
    assignRandomServerName(generatorId);
    
    // Return the name (will be generated if it doesn't exist)
    return gameState.generators[generatorId]?.name || servers[generatorId].name;
}

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
    
    // Divider after home
    const homeDivider = document.createElement('div');
    homeDivider.className = 'server-divider';
    sidebar.appendChild(homeDivider);
    
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
            const serverName = getGeneratorServerName(genId);
            const icon = createServerIcon(genId, serverName.charAt(0).toUpperCase(), false, !isUnlocked);
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
        icon.innerHTML = `<img src="assets/logo.png" alt="Home" class="home-logo" />`;
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
        
        // Preserve preview name if it exists
        const existingName = gameState.generators[generatorId]?.name;
        
        // Initialize generator if needed
        if (!gameState.generators[generatorId]) {
            if (generatorId === 'generator1') {
                gameState.generators[generatorId] = {
                    bots: 1, // Give 1 free bot when unlocking
                    efficiency: 1.0,
                    botSpeed: 0,
                    autoBuy: false,
                    autoBuyPurchased: false,
                    autoBuyDelayLevel: 0,
                    prestigeLevel: 0
                };
            } else if (generatorId === 'generator2') {
                gameState.generators[generatorId] = {
                    cascades: 0,
                    cascadeEfficiency: 0.1,
                    autoBuy: false,
                    autoBuyPurchased: false,
                    autoBuyDelayLevel: 0,
                    prestigeLevel: 0
                };
            } else if (generatorId === 'generator3') {
                // Initialize research state
                if (!gameState.research) {
                    gameState.research = {
                        globalBoostPurchased: false,
                        manualProduction: 0,
                        botProduction: 0,
                        cascadeProduction: 0
                    };
                }
                gameState.generators[generatorId] = {}; // No generator-specific data needed
            } else {
                gameState.generators[generatorId] = {
                    bots: 0,
                    efficiency: 1.0
                };
            }
        } else if (generatorId === 'generator1') {
            // If generator already exists but has 0 bots, give the free bot
            if (gameState.generators[generatorId].bots === 0) {
                gameState.generators[generatorId].bots = 1;
            }
            // Ensure prestigeLevel exists
            if (gameState.generators[generatorId].prestigeLevel === undefined) {
                gameState.generators[generatorId].prestigeLevel = 0;
            }
        }
        
        // Restore preview name if it existed
        if (existingName) {
            gameState.generators[generatorId].name = existingName;
        }
        
        // Assign random server name if it doesn't have one (may already have one from preview)
        assignRandomServerName(generatorId);
        
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
        // Base: 1.0 msg/s per bot, multiplies by 1.1 per bot speed level (compounding)
        const msgPerBot = 1.0 * Math.pow(1.1, gen.botSpeed || 0);
        baseProduction = (gen.bots || 0) * msgPerBot * (gen.efficiency || 1.0);
        
        // Apply global auto-generation boost (compounding) - only for generator1
        const boostLevel = gameState.upgrades.autoGenerationBoost || 0;
        const boostMultiplier = Math.pow(1.1, boostLevel); // Each level multiplies by 1.1
        baseProduction = baseProduction * boostMultiplier;
        
        // Apply research multiplier
        return baseProduction * getResearchBotMultiplier();
    } else if (generatorId === 'generator2') {
        // Cascades generate messages based on generator1's production
        // Each cascade generates 10% of generator1's base production per second
        // We need to get generator1's production WITHOUT the global boost to avoid double-counting
        const gen1 = gameState.generators.generator1;
        if (!gen1 || !isGeneratorUnlocked('generator1')) return 0;
        
        // Calculate generator1's base production (without global auto-generation boost)
        // Base: 1.0 msg/s per bot, multiplies by 1.1 per bot speed level (compounding)
        const msgPerBot = 1.0 * Math.pow(1.1, gen1.botSpeed || 0);
        const gen1BaseProduction = (gen1.bots || 0) * msgPerBot * (gen1.efficiency || 1.0);
        
        // Each cascade multiplies generator1's base production by cascadeEfficiency (default 0.1 = 10%)
        const cascadeEfficiency = gen.cascadeEfficiency || 0.1;
        baseProduction = (gen.cascades || 0) * gen1BaseProduction * cascadeEfficiency;
        
        // Apply global auto-generation boost to cascades too
        const boostLevel = gameState.upgrades.autoGenerationBoost || 0;
        const boostMultiplier = Math.pow(1.1, boostLevel);
        baseProduction = baseProduction * boostMultiplier;
        
        // Apply research multiplier
        return baseProduction * getResearchCascadeMultiplier();
    }
    
    return baseProduction;
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

// Get current research points (based on current messages)
function getResearchPoints() {
    const totalMessages = gameState.messages + (gameState.fractionalMessages || 0);
    return totalMessages / 10000; // 1 research point per 10,000 messages
}

// Get research upgrade cost (aggressive scaling)
function getResearchUpgradeCost(currentLevel) {
    // Aggressive scaling: 10, 25, 50, 100, 200
    const costs = [10, 25, 50, 100, 200];
    return costs[currentLevel] || 200;
}

// Get research multiplier for manual generation
function getResearchManualMultiplier() {
    if (!gameState.research) return 1.0;
    const globalBoost = gameState.research.globalBoostPurchased ? 2.0 : 1.0; // +100% = 2.0x
    const manualLevel = gameState.research.manualProduction || 0;
    const manualMultiplier = 1.0 + (manualLevel * 0.5); // +50% per level
    return globalBoost * manualMultiplier;
}

// Get research multiplier for bot production
function getResearchBotMultiplier() {
    if (!gameState.research) return 1.0;
    const globalBoost = gameState.research.globalBoostPurchased ? 2.0 : 1.0; // +100% = 2.0x
    const botLevel = gameState.research.botProduction || 0;
    const botMultiplier = 1.0 + (botLevel * 0.5); // +50% per level
    return globalBoost * botMultiplier;
}

// Get research multiplier for cascade production
function getResearchCascadeMultiplier() {
    if (!gameState.research) return 1.0;
    const globalBoost = gameState.research.globalBoostPurchased ? 2.0 : 1.0; // +100% = 2.0x
    const cascadeLevel = gameState.research.cascadeProduction || 0;
    const cascadeMultiplier = 1.0 + (cascadeLevel * 0.5); // +50% per level
    return globalBoost * cascadeMultiplier;
}

// Purchase global boost research upgrade
function purchaseGlobalBoost() {
    if (!isGeneratorUnlocked('generator3')) return;
    
    const research = gameState.research || {};
    if (research.globalBoostPurchased) return; // Already purchased
    
    const cost = 10;
    const researchPoints = getResearchPoints();
    
    if (researchPoints >= cost) {
        // Research points are based on messages, so we need to spend 10 * 10000 = 100,000 messages
        const messageCost = cost * 10000;
        const totalMessages = gameState.messages + (gameState.fractionalMessages || 0);
        
        if (totalMessages >= messageCost) {
            // Deduct messages
            if (gameState.fractionalMessages >= messageCost) {
                gameState.fractionalMessages -= messageCost;
            } else {
                const remaining = messageCost - gameState.fractionalMessages;
                gameState.fractionalMessages = 0;
                gameState.messages -= remaining;
            }
            
            // Ensure research object exists
            if (!gameState.research) {
                gameState.research = { globalBoostPurchased: false, manualProduction: 0, botProduction: 0, cascadeProduction: 0 };
            }
            
            gameState.research.globalBoostPurchased = true;
            autoSave();
            updateCurrencyDisplay();
            
            // Refresh UI if on research channel
            if (currentServer === 'generator3' && currentChannel === 'research') {
                loadChannel('research');
            }
        }
    }
}

// Upgrade research production (manual, bot, or cascade)
function upgradeResearchProduction(type) {
    if (!isGeneratorUnlocked('generator3')) return;
    
    const research = gameState.research || {};
    
    // Ensure research object exists
    if (!gameState.research) {
        gameState.research = { globalBoostPurchased: false, manualProduction: 0, botProduction: 0, cascadeProduction: 0 };
    }
    
    // Check if global boost is purchased (required for branch upgrades)
    if (!research.globalBoostPurchased) return;
    
    let currentLevel = 0;
    let propertyName = '';
    
    if (type === 'manual') {
        currentLevel = research.manualProduction || 0;
        propertyName = 'manualProduction';
    } else if (type === 'bot') {
        currentLevel = research.botProduction || 0;
        propertyName = 'botProduction';
    } else if (type === 'cascade') {
        currentLevel = research.cascadeProduction || 0;
        propertyName = 'cascadeProduction';
    } else {
        return; // Invalid type
    }
    
    // Check max level
    if (currentLevel >= 5) return;
    
    const cost = getResearchUpgradeCost(currentLevel);
    const researchPoints = getResearchPoints();
    
    if (researchPoints >= cost) {
        // Research points are based on messages, so we need to spend cost * 10000 messages
        const messageCost = cost * 10000;
        const totalMessages = gameState.messages + (gameState.fractionalMessages || 0);
        
        if (totalMessages >= messageCost) {
            // Deduct messages
            if (gameState.fractionalMessages >= messageCost) {
                gameState.fractionalMessages -= messageCost;
            } else {
                const remaining = messageCost - gameState.fractionalMessages;
                gameState.fractionalMessages = 0;
                gameState.messages -= remaining;
            }
            
            // Upgrade
            gameState.research[propertyName] = currentLevel + 1;
            autoSave();
            updateCurrencyDisplay();
            
            // Refresh UI if on research channel
            if (currentServer === 'generator3' && currentChannel === 'research') {
                loadChannel('research');
            }
        }
    }
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
    
    // Apply colors after settings are loaded
    applyColors();
    
    renderServerSidebar();
    setupChannelItems();
    setupMobileMenu();
    loadServer(currentServer);
    updateCurrencyDisplay();
    
    // Track last playtime update
    let lastPlaytimeUpdate = Date.now();
    let lastUpgradeUIUpdate = 0; // Track last upgrade UI update
    let lastAutoBuyTime = 0; // Track last auto-buy purchase time (generator1)
    let lastGenerator2AutoBuyTime = 0; // Track last auto-buy purchase time (generator2)
    
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
        
        // Auto-buy bots if enabled (with delay)
        if (isGeneratorUnlocked('generator1')) {
            const gen = gameState.generators.generator1;
            if (gen && gen.autoBuy) {
                const totalMessages = gameState.messages + (gameState.fractionalMessages || 0);
                const botCost = Math.floor(getBotCost(gen.bots || 0) * getCostReductionMultiplier());
                const delay = getAutoBuyDelay(gen.autoBuyDelayLevel || 0);
                const now = Date.now();
                
                if (totalMessages >= botCost && (now - lastAutoBuyTime) >= (delay * 1000)) {
                    purchaseBot('generator1');
                    lastAutoBuyTime = now;
                }
            }
        }
        
        // Always update display to show decimal changes and rate updates
        updateCurrencyDisplay();
        
        // Update upgrade button states periodically if on an upgrade channel (every 500ms to avoid too frequent updates)
        const isUpgradeChannel = (currentServer === 'generator1' && currentChannel === 'general') || 
                                 (currentServer === 'generator2' && currentChannel === 'general') ||
                                 (currentServer === 'upgrades' && currentChannel === 'global1') ||
                                 (currentServer === 'generator3' && currentChannel === 'research');
        if (isUpgradeChannel) {
            const now = Date.now();
            if (!lastUpgradeUIUpdate || now - lastUpgradeUIUpdate > 500) {
                lastUpgradeUIUpdate = now;
                updateUpgradeButtonStates();
            }
        }
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

// Update upgrade button states without recreating DOM
function updateUpgradeButtonStates() {
    const totalMessages = gameState.messages + (gameState.fractionalMessages || 0);
    
    if (currentServer === 'generator1' && currentChannel === 'general') {
        // Generator 1 upgrades
        const gen = gameState.generators.generator1 || { bots: 0, efficiency: 1.0, botSpeed: 0, autoBuy: false, autoBuyPurchased: false, autoBuyDelayLevel: 0 };
        
        // Buy Bot button
        const buyBotBtn = document.getElementById('buy-bot');
        if (buyBotBtn) {
            const currentBots = gen.bots || 0;
            const maxLevels = getGenerator1MaxLevels();
            const isMaxBots = currentBots >= maxLevels.bots;
            if (isMaxBots) {
                buyBotBtn.disabled = true;
                buyBotBtn.classList.add('disabled');
                const costSpan = buyBotBtn.querySelector('.upgrade-button-cost');
                if (costSpan) costSpan.textContent = 'Max Level';
            } else {
                // Calculate cost: if they have 1 bot (the free one), next bot costs 1000 (bot #0 cost)
                const costBots = currentBots === 1 ? 0 : currentBots;
                const botCost = Math.floor(getBotCost(costBots) * getCostReductionMultiplier());
                const canAfford = totalMessages >= botCost;
                buyBotBtn.disabled = !canAfford;
                buyBotBtn.classList.toggle('disabled', !canAfford);
                const costSpan = buyBotBtn.querySelector('.upgrade-button-cost');
                if (costSpan) costSpan.textContent = `${formatNumber(botCost, 2)} Messages`;
            }
        }
        
        // Efficiency button
        const efficiencyBtn = document.getElementById('upgrade-efficiency');
        if (efficiencyBtn) {
            const currentEfficiency = gen.efficiency || 1.0;
            const currentLevel = Math.floor(Math.log(currentEfficiency / 1.0) / Math.log(1.1));
            const maxLevels = getGenerator1MaxLevels();
            const isMaxLevel = currentLevel >= maxLevels.efficiency;
            if (isMaxLevel) {
                efficiencyBtn.disabled = true;
                efficiencyBtn.classList.add('disabled');
                const costSpan = efficiencyBtn.querySelector('.upgrade-button-cost');
                if (costSpan) costSpan.textContent = 'Max Level';
            } else {
                const efficiencyCost = Math.floor(getEfficiencyUpgradeCost(currentEfficiency) * getCostReductionMultiplier());
                const canAfford = totalMessages >= efficiencyCost;
                efficiencyBtn.disabled = !canAfford;
                efficiencyBtn.classList.toggle('disabled', !canAfford);
                const costSpan = efficiencyBtn.querySelector('.upgrade-button-cost');
                if (costSpan) costSpan.textContent = `${formatNumber(efficiencyCost, 2)} Messages`;
            }
        }
        
        // Bot Speed button
        const botSpeedBtn = document.getElementById('upgrade-bot-speed');
        if (botSpeedBtn) {
            const currentLevel = gen.botSpeed || 0;
            const maxLevels = getGenerator1MaxLevels();
            const isMaxLevel = currentLevel >= maxLevels.botSpeed;
            if (isMaxLevel) {
                botSpeedBtn.disabled = true;
                botSpeedBtn.classList.add('disabled');
                const costSpan = botSpeedBtn.querySelector('.upgrade-button-cost');
                if (costSpan) costSpan.textContent = 'Max Level';
            } else {
                const botSpeedCost = Math.floor(getBotSpeedCost(currentLevel) * getCostReductionMultiplier());
                const canAfford = totalMessages >= botSpeedCost;
                botSpeedBtn.disabled = !canAfford;
                botSpeedBtn.classList.toggle('disabled', !canAfford);
                const costSpan = botSpeedBtn.querySelector('.upgrade-button-cost');
                if (costSpan) costSpan.textContent = `${formatNumber(botSpeedCost, 2)} Messages`;
            }
        }
        
        // Auto-Buy Delay button
        const autoBuyDelayBtn = document.getElementById('upgrade-auto-buy-delay');
        if (autoBuyDelayBtn) {
            const autoBuyDelayLevel = gen.autoBuyDelayLevel || 0;
            const maxLevel = getMaxAutoBuyDelayLevel();
            const isMaxLevel = autoBuyDelayLevel >= maxLevel;
            if (isMaxLevel) {
                autoBuyDelayBtn.disabled = true;
                autoBuyDelayBtn.classList.add('disabled');
                const costSpan = autoBuyDelayBtn.querySelector('.upgrade-button-cost');
                if (costSpan) costSpan.textContent = 'Max Level';
            } else {
                const autoBuyDelayCost = Math.floor(getAutoBuyDelayCost(autoBuyDelayLevel) * getCostReductionMultiplier());
                const canAfford = totalMessages >= autoBuyDelayCost;
                autoBuyDelayBtn.disabled = !canAfford;
                autoBuyDelayBtn.classList.toggle('disabled', !canAfford);
                const costSpan = autoBuyDelayBtn.querySelector('.upgrade-button-cost');
                if (costSpan) costSpan.textContent = `${formatNumber(autoBuyDelayCost, 2)} Messages`;
            }
        }
        
        // Update stat displays that might have changed
        // Update bot count stat
        const botsStat = Array.from(document.querySelectorAll('.upgrade-stat')).find(stat => 
            stat.querySelector('.stat-label')?.textContent === 'Current Bots:'
        );
        if (botsStat) {
            const valueSpan = botsStat.querySelector('.stat-value');
            if (valueSpan) valueSpan.textContent = formatNumber(gen.bots || 0, 0);
        }
        
        // Update efficiency stat
        const efficiencyStat = Array.from(document.querySelectorAll('.upgrade-stat')).find(stat => 
            stat.querySelector('.stat-label')?.textContent === 'Current Efficiency:'
        );
        if (efficiencyStat) {
            const valueSpan = efficiencyStat.querySelector('.stat-value');
            if (valueSpan) valueSpan.textContent = `${formatNumber((gen.efficiency || 1.0) * 100, 0)}%`;
        }
        
        // Update efficiency level display
        const efficiencyLevelDisplay = document.querySelector('#upgrade-efficiency')?.closest('.upgrade-item')?.querySelector('.upgrade-level');
        if (efficiencyLevelDisplay) {
            const currentEfficiency = gen.efficiency || 1.0;
            const efficiencyLevel = Math.floor(Math.log(currentEfficiency / 1.0) / Math.log(1.1));
            efficiencyLevelDisplay.textContent = `Level ${efficiencyLevel}`;
        }
        
        // Update bot speed stat
        const botSpeedStat = Array.from(document.querySelectorAll('.upgrade-stat')).find(stat => 
            stat.querySelector('.stat-label')?.textContent === 'Current Speed:'
        );
        if (botSpeedStat) {
            const valueSpan = botSpeedStat.querySelector('.stat-value');
            if (valueSpan) valueSpan.textContent = `${formatNumber(1.0 * Math.pow(1.1, gen.botSpeed || 0), 2)} msg/s per bot`;
        }
        
        // Update bot speed level display
        const botSpeedLevelDisplay = document.querySelector('#upgrade-bot-speed')?.closest('.upgrade-item')?.querySelector('.upgrade-level');
        if (botSpeedLevelDisplay) {
            const botSpeedLevel = gen.botSpeed || 0;
            botSpeedLevelDisplay.textContent = `Level ${botSpeedLevel}`;
        }
        
        // Update bot description (messages per second per bot)
        const botDescription = document.querySelector('#buy-bot')?.closest('.upgrade-item')?.querySelector('.upgrade-description');
        if (botDescription) {
            // Calculate msg per bot with all upgrades (speed, efficiency, auto-gen boost, message multiplier)
            const baseMsgPerBot = 1.0 * Math.pow(1.1, gen.botSpeed || 0);
            const withEfficiency = baseMsgPerBot * (gen.efficiency || 1.0);
            const autoBoostLevel = gameState.upgrades.autoGenerationBoost || 0;
            const autoBoostMultiplier = Math.pow(1.1, autoBoostLevel);
            const messageMultiplierLevel = gameState.upgrades.messageMultiplier || 0;
            const messageMultiplier = Math.pow(1.05, messageMultiplierLevel);
            const finalMsgPerBot = withEfficiency * autoBoostMultiplier * messageMultiplier;
            botDescription.textContent = `Purchase a new bot to automatically generate messages. Each bot produces ${formatNumber(finalMsgPerBot, 2)} messages per second (after upgrades).`;
        }
        
        // Update auto-buy status
        const autoBuyStatusStat = Array.from(document.querySelectorAll('.upgrade-stat')).find(stat => 
            stat.querySelector('.stat-label')?.textContent === 'Status:'
        );
        if (autoBuyStatusStat && autoBuyStatusStat.closest('.upgrade-item')?.querySelector('.upgrade-title')?.textContent === 'Auto-Buy Bots') {
            const valueSpan = autoBuyStatusStat.querySelector('.stat-value');
            if (valueSpan) valueSpan.textContent = gen.autoBuy ? 'Enabled' : 'Disabled';
        }
        
        // Update auto-buy delay stat
        const autoBuyDelayStat = Array.from(document.querySelectorAll('.upgrade-stat')).find(stat => 
            stat.querySelector('.stat-label')?.textContent === 'Current Delay:'
        );
        if (autoBuyDelayStat) {
            const valueSpan = autoBuyDelayStat.querySelector('.stat-value');
            const delay = getAutoBuyDelay(gen.autoBuyDelayLevel || 0);
            if (valueSpan) valueSpan.textContent = `${formatNumber(delay, 1)}s`;
        }
        
        // Update auto-buy delay level display
        const autoBuyDelayLevelDisplay = document.querySelector('#upgrade-auto-buy-delay')?.closest('.upgrade-item')?.querySelector('.upgrade-level');
        if (autoBuyDelayLevelDisplay) {
            const autoBuyDelayLevel = gen.autoBuyDelayLevel || 0;
            const maxLevel = getMaxAutoBuyDelayLevel();
            const isMaxLevel = autoBuyDelayLevel >= maxLevel;
            autoBuyDelayLevelDisplay.textContent = isMaxLevel ? 'Max Level' : `Level ${autoBuyDelayLevel}`;
        }
        
        // Update auto-buy delay description
        const autoBuyDelayItem = document.querySelector('#upgrade-auto-buy-delay')?.closest('.upgrade-item');
        if (autoBuyDelayItem) {
            const autoBuyDelayDescription = autoBuyDelayItem.querySelector('.upgrade-description');
            if (autoBuyDelayDescription) {
                const delay = getAutoBuyDelay(gen.autoBuyDelayLevel || 0);
                autoBuyDelayDescription.textContent = `Reduces the delay between auto-buy purchases. Current delay: ${formatNumber(delay, 1)}s`;
            }
        }
        
        // Auto-Buy button (update purchase button state and toggle button visibility)
        const buyAutoBuyBtn = document.getElementById('buy-auto-buy');
        const toggleAutoBuyBtn = document.getElementById('toggle-auto-buy');
        
        if (gen.autoBuyPurchased) {
            // If purchased, show toggle button and hide purchase button
            if (buyAutoBuyBtn) {
                buyAutoBuyBtn.style.display = 'none';
            }
            if (toggleAutoBuyBtn) {
                toggleAutoBuyBtn.style.display = 'block';
                const buttonText = toggleAutoBuyBtn.querySelector('.upgrade-button-text');
                if (buttonText) {
                    buttonText.textContent = gen.autoBuy ? 'Disable Auto-Buy' : 'Enable Auto-Buy';
                }
            }
        } else {
            // If not purchased, show purchase button and hide toggle button
            if (toggleAutoBuyBtn) {
                toggleAutoBuyBtn.style.display = 'none';
            }
            if (buyAutoBuyBtn) {
                buyAutoBuyBtn.style.display = 'block';
                const autoBuyCost = 5000;
                const canAfford = totalMessages >= autoBuyCost;
                buyAutoBuyBtn.disabled = !canAfford;
                buyAutoBuyBtn.classList.toggle('disabled', !canAfford);
                const costSpan = buyAutoBuyBtn.querySelector('.upgrade-button-cost');
                if (costSpan) costSpan.textContent = `${formatNumber(autoBuyCost, 2)} Messages`;
            }
        }
        
        // Prestige button (always exists now)
        const prestigeBtn = document.getElementById('prestige-generator1');
        if (prestigeBtn) {
            const allMaxed = isGenerator1AllMaxed();
            const prestigeCost = getPrestigeCost('generator1');
            const canAfford = totalMessages >= prestigeCost;
            const shouldEnable = allMaxed && canAfford;
            
            prestigeBtn.disabled = !shouldEnable;
            prestigeBtn.classList.toggle('disabled', !shouldEnable);
            
            const costSpan = prestigeBtn.querySelector('.upgrade-button-cost');
            if (costSpan) {
                costSpan.textContent = allMaxed ? `${formatNumber(prestigeCost, 2)} Messages` : 'Max All Upgrades';
            }
        }
    } else if (currentServer === 'generator3' && currentChannel === 'research') {
        // Research Tree channel - update research points display and button states
        const researchPoints = getResearchPoints();
        const research = gameState.research || { globalBoostPurchased: false, manualProduction: 0, botProduction: 0, cascadeProduction: 0 };
        
        // Update research points display
        const researchPointsHeader = document.querySelector('.research-tree-container h2');
        if (researchPointsHeader) {
            researchPointsHeader.textContent = `Research Points: ${formatNumber(researchPoints, 2)}`;
        }
        
        // Center node: Global Boost
        const globalBoostPurchased = research.globalBoostPurchased || false;
        const globalBoostCost = 10;
        const canAffordGlobalBoost = !globalBoostPurchased && researchPoints >= globalBoostCost;
        
        // Update global boost button
        const globalBoostBtn = document.getElementById('purchase-global-boost');
        if (globalBoostBtn && !globalBoostPurchased) {
            globalBoostBtn.disabled = !canAffordGlobalBoost;
            if (!canAffordGlobalBoost) {
                globalBoostBtn.classList.add('disabled');
            } else {
                globalBoostBtn.classList.remove('disabled');
            }
        }
        
        // Manual Production branch
        const manualLevel = research.manualProduction || 0;
        const isMaxManual = manualLevel >= 5;
        const manualCost = isMaxManual ? 0 : getResearchUpgradeCost(manualLevel);
        const canAffordManual = !isMaxManual && researchPoints >= manualCost && globalBoostPurchased;
        
        // Update manual production button
        const manualProductionBtn = document.getElementById('upgrade-manual-production');
        if (manualProductionBtn && !isMaxManual && globalBoostPurchased) {
            manualProductionBtn.disabled = !canAffordManual;
            if (!canAffordManual) {
                manualProductionBtn.classList.add('disabled');
            } else {
                manualProductionBtn.classList.remove('disabled');
            }
            const costSpan = manualProductionBtn.querySelector('.upgrade-button-cost');
            if (costSpan) {
                costSpan.textContent = `${manualCost} Research Points`;
            }
        }
        
        // Bot Production branch
        const botLevel = research.botProduction || 0;
        const isMaxBot = botLevel >= 5;
        const botCost = isMaxBot ? 0 : getResearchUpgradeCost(botLevel);
        const canAffordBot = !isMaxBot && researchPoints >= botCost && globalBoostPurchased;
        
        // Update bot production button
        const botProductionBtn = document.getElementById('upgrade-bot-production');
        if (botProductionBtn && !isMaxBot && globalBoostPurchased) {
            botProductionBtn.disabled = !canAffordBot;
            if (!canAffordBot) {
                botProductionBtn.classList.add('disabled');
            } else {
                botProductionBtn.classList.remove('disabled');
            }
            const costSpan = botProductionBtn.querySelector('.upgrade-button-cost');
            if (costSpan) {
                costSpan.textContent = `${botCost} Research Points`;
            }
        }
        
        // Cascade Production branch
        const cascadeLevel = research.cascadeProduction || 0;
        const isMaxCascade = cascadeLevel >= 5;
        const cascadeCost = isMaxCascade ? 0 : getResearchUpgradeCost(cascadeLevel);
        const canAffordCascade = !isMaxCascade && researchPoints >= cascadeCost && globalBoostPurchased;
        
        // Update cascade production button
        const cascadeProductionBtn = document.getElementById('upgrade-cascade-production');
        if (cascadeProductionBtn && !isMaxCascade && globalBoostPurchased) {
            cascadeProductionBtn.disabled = !canAffordCascade;
            if (!canAffordCascade) {
                cascadeProductionBtn.classList.add('disabled');
            } else {
                cascadeProductionBtn.classList.remove('disabled');
            }
            const costSpan = cascadeProductionBtn.querySelector('.upgrade-button-cost');
            if (costSpan) {
                costSpan.textContent = `${cascadeCost} Research Points`;
            }
        }
    } else if (currentServer === 'upgrades' && currentChannel === 'global1') {
        // Global upgrades
        // Manual Generation Multiplier
        const manualMultiplierBtn = document.getElementById('buy-manual-multiplier');
        if (manualMultiplierBtn) {
            const multiplierLevel = gameState.upgrades.manualGenerationMultiplier || 0;
            const isMaxLevel = multiplierLevel >= GLOBAL_UPGRADE_MAX_LEVELS.manualGenerationMultiplier;
            if (isMaxLevel) {
                manualMultiplierBtn.disabled = true;
                manualMultiplierBtn.classList.add('disabled');
                const costSpan = manualMultiplierBtn.querySelector('.upgrade-button-cost');
                if (costSpan) costSpan.textContent = 'Max Level';
            } else {
                const upgradeCost = Math.floor(getManualGenerationUpgradeCost(multiplierLevel) * getCostReductionMultiplier());
                const canAfford = totalMessages >= upgradeCost;
                manualMultiplierBtn.disabled = !canAfford;
                manualMultiplierBtn.classList.toggle('disabled', !canAfford);
                const costSpan = manualMultiplierBtn.querySelector('.upgrade-button-cost');
                if (costSpan) costSpan.textContent = `${formatNumber(upgradeCost, 2)} Messages`;
            }
        }
        
        // Auto-Generation Boost
        const autoBoostBtn = document.getElementById('buy-auto-boost');
        if (autoBoostBtn) {
            const autoBoostLevel = gameState.upgrades.autoGenerationBoost || 0;
            const isMaxLevel = autoBoostLevel >= GLOBAL_UPGRADE_MAX_LEVELS.autoGenerationBoost;
            if (isMaxLevel) {
                autoBoostBtn.disabled = true;
                autoBoostBtn.classList.add('disabled');
                const costSpan = autoBoostBtn.querySelector('.upgrade-button-cost');
                if (costSpan) costSpan.textContent = 'Max Level';
            } else {
                const autoBoostCost = Math.floor(getAutoGenerationBoostCost(autoBoostLevel) * getCostReductionMultiplier());
                const canAfford = totalMessages >= autoBoostCost;
                autoBoostBtn.disabled = !canAfford;
                autoBoostBtn.classList.toggle('disabled', !canAfford);
                const costSpan = autoBoostBtn.querySelector('.upgrade-button-cost');
                if (costSpan) costSpan.textContent = `${formatNumber(autoBoostCost, 2)} Messages`;
            }
        }
    } else if (currentServer === 'upgrades' && currentChannel === 'global1') {
        // Global upgrades
        // Message Multiplier
        const messageMultiplierBtn = document.getElementById('buy-message-multiplier');
        if (messageMultiplierBtn) {
            const messageMultiplierLevel = gameState.upgrades.messageMultiplier || 0;
            const isMaxLevel = messageMultiplierLevel >= GLOBAL_UPGRADE_MAX_LEVELS.messageMultiplier;
            if (isMaxLevel) {
                messageMultiplierBtn.disabled = true;
                messageMultiplierBtn.classList.add('disabled');
                const costSpan = messageMultiplierBtn.querySelector('.upgrade-button-cost');
                if (costSpan) costSpan.textContent = 'Max Level';
            } else {
                const messageMultiplierCost = Math.floor(getMessageMultiplierCost(messageMultiplierLevel) * getCostReductionMultiplier());
                const canAfford = totalMessages >= messageMultiplierCost;
                messageMultiplierBtn.disabled = !canAfford;
                messageMultiplierBtn.classList.toggle('disabled', !canAfford);
                const costSpan = messageMultiplierBtn.querySelector('.upgrade-button-cost');
                if (costSpan) costSpan.textContent = `${formatNumber(messageMultiplierCost, 2)} Messages`;
            }
        }
        
        // Cost Efficiency
        const costEfficiencyBtn = document.getElementById('buy-cost-efficiency');
        if (costEfficiencyBtn) {
            const costEfficiencyLevel = gameState.upgrades.costEfficiency || 0;
            const isMaxLevel = costEfficiencyLevel >= GLOBAL_UPGRADE_MAX_LEVELS.costEfficiency;
            if (isMaxLevel) {
                costEfficiencyBtn.disabled = true;
                costEfficiencyBtn.classList.add('disabled');
                const costSpan = costEfficiencyBtn.querySelector('.upgrade-button-cost');
                if (costSpan) costSpan.textContent = 'Max Level';
            } else {
                const costEfficiencyCost = Math.floor(getCostEfficiencyCost(costEfficiencyLevel) * getCostReductionMultiplier());
                const canAfford = totalMessages >= costEfficiencyCost;
                costEfficiencyBtn.disabled = !canAfford;
                costEfficiencyBtn.classList.toggle('disabled', !canAfford);
                const costSpan = costEfficiencyBtn.querySelector('.upgrade-button-cost');
                if (costSpan) costSpan.textContent = `${formatNumber(costEfficiencyCost, 2)} Messages`;
            }
        }
    } else if (currentServer === 'generator2' && currentChannel === 'general') {
        // Generator 2 upgrades
        const gen2 = gameState.generators.generator2 || { cascades: 0, cascadeEfficiency: 0.1, autoBuy: false, autoBuyPurchased: false, autoBuyDelayLevel: 0 };
        const gen1 = gameState.generators.generator1 || { bots: 0 };
        const gen1Bots = gen1.bots || 0;
        const hasGen1Bot = gen1Bots >= 1;
        
        // Get generator1 server name
        const gen1ServerName = isGeneratorUnlocked('generator1') ? getGeneratorServerName('generator1') : 'Generator 1';
        
        // Buy Cascade button
        const buyCascadeBtn = document.getElementById('buy-cascade');
        if (buyCascadeBtn) {
            // Always check current state (recalculate in case it changed)
            const currentCascades = gen2.cascades || 0;
            const maxLevels = getGenerator2MaxLevels();
            const isMaxCascades = currentCascades >= maxLevels.cascades;
            
            if (isMaxCascades) {
                buyCascadeBtn.disabled = true;
                buyCascadeBtn.setAttribute('disabled', 'disabled');
                buyCascadeBtn.classList.add('disabled');
                const costSpan = buyCascadeBtn.querySelector('.upgrade-button-cost');
                if (costSpan) costSpan.textContent = 'Max Level';
            } else {
                // Recalculate for non-max case
                const messageCost = Math.floor(getCascadeCost(currentCascades) * getCostReductionMultiplier());
                const canAfford = hasGen1Bot && totalMessages >= messageCost;
                
                buyCascadeBtn.disabled = !canAfford;
                if (!canAfford) {
                    buyCascadeBtn.setAttribute('disabled', 'disabled');
                } else {
                    buyCascadeBtn.removeAttribute('disabled');
                }
                buyCascadeBtn.classList.toggle('disabled', !canAfford);
                
                const costSpan = buyCascadeBtn.querySelector('.upgrade-button-cost');
                if (costSpan) {
                    if (!hasGen1Bot) {
                        costSpan.textContent = `Need 1 Bot from ${gen1ServerName}`;
                    } else {
                        costSpan.textContent = `${formatNumber(messageCost, 2)} Messages + 1 Bot`;
                    }
                }
            }
            
            // Update stats
            const cascadeStat = Array.from(document.querySelectorAll('.upgrade-stat')).find(stat => 
                stat.querySelector('.stat-label')?.textContent === 'Current Cascades:'
            );
            if (cascadeStat) {
                const valueSpan = cascadeStat.querySelector('.stat-value');
                if (valueSpan) {
                    // Re-read current cascades to ensure it's up to date
                    const updatedCascades = gen2.cascades || 0;
                    valueSpan.textContent = formatNumber(updatedCascades, 0);
                }
            }
            
                    // Update bot stat label and value - check all upgrade stats to find the right one
                    const allStats = Array.from(document.querySelectorAll('.upgrade-stat'));
                    for (const stat of allStats) {
                        const label = stat.querySelector('.stat-label')?.textContent;
                        if (label && label.includes('Bots Available')) {
                            const labelSpan = stat.querySelector('.stat-label');
                            const valueSpan = stat.querySelector('.stat-value');
                            if (labelSpan) labelSpan.textContent = `${gen1ServerName} Bots Available:`;
                            if (valueSpan) {
                                valueSpan.textContent = formatNumber(gen1Bots, 0);
                                valueSpan.classList.toggle('insufficient', !hasGen1Bot);
                            }
                            break;
                        }
                    }
            
            // Update production stats
            const gen1Production = getGeneratorProduction('generator1');
            const cascadeProduction = getGeneratorProduction('generator2');
            const productionStat = Array.from(document.querySelectorAll('.upgrade-stat')).find(stat => 
                stat.querySelector('.stat-label')?.textContent === 'Total Cascade Production:'
            );
            if (productionStat) {
                const valueSpan = productionStat.querySelector('.stat-value');
                if (valueSpan) valueSpan.textContent = `${formatNumber(cascadeProduction, 2)} msg/s`;
            }
            
            // Update description
            const cascadeItem = buyCascadeBtn.closest('.upgrade-item');
            if (cascadeItem) {
                const description = cascadeItem.querySelector('.upgrade-description');
                if (description) {
                    const cascadeEfficiency = gen2.cascadeEfficiency || 0.1;
                    const efficiencyPercent = cascadeEfficiency * 100;
                    const productionPerCascade = currentCascades > 0 ? cascadeProduction / currentCascades : (gen1Production * cascadeEfficiency);
                    description.textContent = `Purchase a message cascade that generates messages based on your Auto-Typer Bot production. Each cascade generates ${formatNumber(productionPerCascade, 2)} messages per second (${formatNumber(efficiencyPercent, 1)}% of ${gen1ServerName}'s production). Requires 1 bot from ${gen1ServerName}.`;
                }
            }
        }
        
        // Cascade Efficiency button
        const efficiencyBtn = document.getElementById('upgrade-cascade-efficiency');
        if (efficiencyBtn) {
            const cascadeEfficiency = gen2.cascadeEfficiency || 0.1;
            const efficiencyLevel = Math.floor(Math.log(cascadeEfficiency / 0.1) / Math.log(1.1));
            const maxLevels = getGenerator2MaxLevels();
            const isMaxLevel = efficiencyLevel >= maxLevels.cascadeEfficiency;
            if (isMaxLevel) {
                efficiencyBtn.disabled = true;
                efficiencyBtn.classList.add('disabled');
                const costSpan = efficiencyBtn.querySelector('.upgrade-button-cost');
                if (costSpan) costSpan.textContent = 'Max Level';
            } else {
                const efficiencyCost = Math.floor(getCascadeEfficiencyUpgradeCost(cascadeEfficiency) * getCostReductionMultiplier());
                const canAfford = totalMessages >= efficiencyCost;
                efficiencyBtn.disabled = !canAfford;
                if (!canAfford) {
                    efficiencyBtn.classList.add('disabled');
                } else {
                    efficiencyBtn.classList.remove('disabled');
                }
                const costSpan = efficiencyBtn.querySelector('.upgrade-button-cost');
                if (costSpan) costSpan.textContent = `${formatNumber(efficiencyCost, 2)} Messages`;
            }
            
            // Update efficiency level display
            const efficiencyLevelDisplay = efficiencyBtn.closest('.upgrade-item')?.querySelector('.upgrade-level');
            if (efficiencyLevelDisplay) {
                efficiencyLevelDisplay.textContent = `Level ${efficiencyLevel}`;
            }
            
            // Update efficiency stat
            const efficiencyStat = Array.from(document.querySelectorAll('.upgrade-stat')).find(stat => 
                stat.querySelector('.stat-label')?.textContent === 'Current Efficiency:'
            );
            if (efficiencyStat) {
                const valueSpan = efficiencyStat.querySelector('.stat-value');
                if (valueSpan) {
                    const efficiencyPercent = (cascadeEfficiency * 100);
                    valueSpan.textContent = `${formatNumber(efficiencyPercent, 1)}%`;
                }
            }
        }
        
        // Auto-Buy Delay button
        const autoBuyDelayBtn = document.getElementById('upgrade-generator2-auto-buy-delay');
        if (autoBuyDelayBtn) {
            // Always read fresh from gameState
            const autoBuyDelayLevel = gen2.autoBuyDelayLevel || 0;
            const maxLevels = getGenerator2MaxLevels();
            const isMaxLevel = autoBuyDelayLevel >= maxLevels.autoBuyDelay;
            
            if (isMaxLevel) {
                autoBuyDelayBtn.disabled = true;
                autoBuyDelayBtn.setAttribute('disabled', 'disabled');
                autoBuyDelayBtn.classList.add('disabled');
                const costSpan = autoBuyDelayBtn.querySelector('.upgrade-button-cost');
                if (costSpan) costSpan.textContent = 'Max Level';
            } else {
                const autoBuyDelayCost = Math.floor(getGenerator2AutoBuyDelayCost(autoBuyDelayLevel) * getCostReductionMultiplier());
                const canAfford = totalMessages >= autoBuyDelayCost;
                autoBuyDelayBtn.disabled = !canAfford;
                if (!canAfford) {
                    autoBuyDelayBtn.setAttribute('disabled', 'disabled');
                } else {
                    autoBuyDelayBtn.removeAttribute('disabled');
                }
                autoBuyDelayBtn.classList.toggle('disabled', !canAfford);
                const costSpan = autoBuyDelayBtn.querySelector('.upgrade-button-cost');
                if (costSpan) costSpan.textContent = `${formatNumber(autoBuyDelayCost, 2)} Messages`;
            }
            
            // Update delay level display - always read fresh
            const delayLevelDisplay = autoBuyDelayBtn.closest('.upgrade-item')?.querySelector('.upgrade-level');
            if (delayLevelDisplay) {
                const currentDelayLevel = gen2.autoBuyDelayLevel || 0;
                const maxLevels = getGenerator2MaxLevels();
                const isMaxLevel = currentDelayLevel >= maxLevels.autoBuyDelay;
                delayLevelDisplay.textContent = isMaxLevel ? 'Max Level' : `Level ${currentDelayLevel}`;
            }
            
            // Update delay stat - always read fresh
            const delayStat = Array.from(document.querySelectorAll('.upgrade-stat')).find(stat => 
                stat.querySelector('.stat-label')?.textContent === 'Current Delay:'
            );
            if (delayStat) {
                const valueSpan = delayStat.querySelector('.stat-value');
                if (valueSpan) {
                    const currentDelayLevel = gen2.autoBuyDelayLevel || 0;
                    const delay = getAutoBuyDelay(currentDelayLevel);
                    valueSpan.textContent = `${formatNumber(delay, 1)}s`;
                }
            }
            
            // Update delay description - always read fresh
            const delayItem = autoBuyDelayBtn.closest('.upgrade-item');
            if (delayItem) {
                const description = delayItem.querySelector('.upgrade-description');
                if (description) {
                    const currentDelayLevel = gen2.autoBuyDelayLevel || 0;
                    const delay = getAutoBuyDelay(currentDelayLevel);
                    description.textContent = `Reduces the delay between auto-buy purchases. Current delay: ${formatNumber(delay, 1)}s`;
                }
            }
        }
        
        // Auto-Buy button (update purchase button state and toggle button visibility)
        const buyAutoBuyBtn = document.getElementById('buy-generator2-auto-buy');
        const toggleAutoBuyBtn = document.getElementById('toggle-generator2-auto-buy');
        
        if (gen2.autoBuyPurchased) {
            // If purchased, show toggle button and hide purchase button
            if (buyAutoBuyBtn) {
                buyAutoBuyBtn.style.display = 'none';
            }
            if (toggleAutoBuyBtn) {
                toggleAutoBuyBtn.style.display = 'block';
                const buttonText = toggleAutoBuyBtn.querySelector('.upgrade-button-text');
                if (buttonText) {
                    buttonText.textContent = gen2.autoBuy ? 'Disable Auto-Buy' : 'Enable Auto-Buy';
                }
            }
        } else {
            // If not purchased, show purchase button and hide toggle button
            if (toggleAutoBuyBtn) {
                toggleAutoBuyBtn.style.display = 'none';
            }
            if (buyAutoBuyBtn) {
                buyAutoBuyBtn.style.display = 'block';
                const autoBuyCost = 50000;
                const canAfford = totalMessages >= autoBuyCost;
                buyAutoBuyBtn.disabled = !canAfford;
                buyAutoBuyBtn.classList.toggle('disabled', !canAfford);
            }
        }
        
        // Prestige button
        const prestigeBtn = document.getElementById('prestige-generator2');
        if (prestigeBtn) {
            const allMaxed = isGenerator2AllMaxed();
            const prestigeCost = getPrestigeCost('generator2');
            const canAfford = totalMessages >= prestigeCost;
            const shouldEnable = allMaxed && canAfford;
            
            prestigeBtn.disabled = !shouldEnable;
            if (!shouldEnable) {
                prestigeBtn.classList.add('disabled');
            } else {
                prestigeBtn.classList.remove('disabled');
            }
            
            const costSpan = prestigeBtn.querySelector('.upgrade-button-cost');
            if (costSpan) {
                costSpan.textContent = allMaxed ? `${formatNumber(prestigeCost, 2)} Messages` : 'Max All Upgrades';
            }
            
            // Update prestige level display
            const prestigeItem = prestigeBtn.closest('.upgrade-item');
            if (prestigeItem) {
                const prestigeLevelDisplay = prestigeItem.querySelector('.upgrade-level');
                if (prestigeLevelDisplay) {
                    const prestigeLevel = gen2.prestigeLevel || 0;
                    if (prestigeLevel > 0) {
                        prestigeLevelDisplay.textContent = `Prestige ${prestigeLevel}`;
                        prestigeLevelDisplay.style.display = 'block';
                    } else {
                        prestigeLevelDisplay.style.display = 'none';
                    }
                }
                
                // Update prestige level stat
                const prestigeLevelStat = Array.from(prestigeItem.querySelectorAll('.upgrade-stat')).find(stat => {
                    const label = stat.querySelector('.stat-label')?.textContent;
                    return label && label === 'Prestige Level:';
                });
                if (prestigeLevelStat) {
                    const valueSpan = prestigeLevelStat.querySelector('.stat-value');
                    if (valueSpan) {
                        valueSpan.textContent = gen2.prestigeLevel || 0;
                    }
                }
                
                // Update current max levels stat
                const maxLevelsStat = Array.from(prestigeItem.querySelectorAll('.upgrade-stat')).find(stat => {
                    const label = stat.querySelector('.stat-label')?.textContent;
                    return label && label === 'Current Max Levels:';
                });
                if (maxLevelsStat) {
                    const valueSpan = maxLevelsStat.querySelector('.stat-value');
                    if (valueSpan) {
                        const maxLevels = getGenerator2MaxLevels();
                        valueSpan.textContent = `Cascades: ${maxLevels.cascades}, Efficiency: ${maxLevels.cascadeEfficiency}, Delay: ${maxLevels.autoBuyDelay}`;
                    }
                }
                
                // Update requirement stat visibility
                const requirementStat = Array.from(prestigeItem.querySelectorAll('.upgrade-stat')).find(stat => {
                    const label = stat.querySelector('.stat-label')?.textContent;
                    return label && label.trim() === 'Requirement:';
                });
                if (requirementStat) {
                    requirementStat.style.display = allMaxed ? 'none' : 'block';
                }
                
                // Update opacity based on allMaxed
                if (allMaxed) {
                    prestigeItem.style.opacity = '1';
                } else {
                    prestigeItem.style.opacity = '0.6';
                }
            }
        }
    }
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
                // Don't close menu on server click - only close on channel click or overlay click
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
    
    // Update server name (use stored name for generators, default for others)
    const displayName = (serverId.startsWith('generator')) ? getGeneratorServerName(serverId) : server.name;
    document.getElementById('server-name').textContent = displayName;
    
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
    let savedChannel = lastChannelsByServer[serverId];
    // Migration: if saved channel is 'main' or 'upgrades' for generator1, use 'general'
    if (serverId === 'generator1' && (savedChannel === 'main' || savedChannel === 'upgrades')) {
        savedChannel = 'general';
    }
    if (savedChannel && server.channels[savedChannel]) {
        channelToLoad = savedChannel;
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
        const manualMultiplier = getManualGenerationMultiplier();
        const globalMultiplier = getGlobalMessageMultiplier();
        const totalMultiplier = manualMultiplier * globalMultiplier;
        const avgMessages = formatNumber(totalMultiplier, 2);
        const messageText = totalMultiplier > 1.00 ? 'Messages' : 'Message';
        contentBody.innerHTML = `
            <div class="manual-generation-content">
                <div class="manual-generation-info">
                    <h2>Type to Generate Messages</h2>
                    <p>Start typing in the chat box below to generate messages. Each character generates ${avgMessages} ${messageText}!</p>
                </div>
                <div class="messages-container" id="messages-container">
                    <!-- Messages will appear here -->
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
        
        // Reset character count when loading the channel
        manualCharacterCount = 0;
        
        // Setup manual generation input
        setupManualGeneration();
        
        // Setup messages container
        setupMessagesContainer();
    } else if (channelId === 'general' && currentServer === 'generator1') {
        // Auto-Typer Bot upgrades
        const gen = gameState.generators.generator1 || { bots: 0, efficiency: 1.0, botSpeed: 0, autoBuy: false, autoBuyPurchased: false, autoBuyDelayLevel: 0 };
        const currentBots = gen.bots || 0;
        const maxLevels = getGenerator1MaxLevels();
        const isMaxBots = currentBots >= maxLevels.bots;
        const botCost = isMaxBots ? 0 : Math.floor(getBotCost(currentBots) * getCostReductionMultiplier());
        const currentEfficiency = gen.efficiency || 1.0;
        const efficiencyLevel = Math.floor(Math.log(currentEfficiency / 1.0) / Math.log(1.1));
        const isMaxEfficiency = efficiencyLevel >= maxLevels.efficiency;
        const efficiencyCost = isMaxEfficiency ? 0 : Math.floor(getEfficiencyUpgradeCost(currentEfficiency) * getCostReductionMultiplier());
        const botSpeedLevel = gen.botSpeed || 0;
        const isMaxBotSpeed = botSpeedLevel >= maxLevels.botSpeed;
        const botSpeedCost = isMaxBotSpeed ? 0 : Math.floor(getBotSpeedCost(botSpeedLevel) * getCostReductionMultiplier());
        const autoBuyCost = 5000;
        const autoBuyDelayLevel = gen.autoBuyDelayLevel || 0;
        const maxDelayLevel = getMaxAutoBuyDelayLevel();
        const isMaxDelayLevel = autoBuyDelayLevel >= maxDelayLevel;
        const autoBuyDelayCost = isMaxDelayLevel ? 0 : Math.floor(getAutoBuyDelayCost(autoBuyDelayLevel) * getCostReductionMultiplier());
        const autoBuyDelay = getAutoBuyDelay(autoBuyDelayLevel);
        const totalMessages = gameState.messages + (gameState.fractionalMessages || 0);
        const canAffordBot = !isMaxBots && totalMessages >= botCost;
        const canAffordEfficiency = !isMaxEfficiency && totalMessages >= efficiencyCost;
        const canAffordBotSpeed = !isMaxBotSpeed && totalMessages >= botSpeedCost;
        const canAffordAutoBuy = totalMessages >= autoBuyCost && !gen.autoBuyPurchased;
        const canAffordAutoBuyDelay = !isMaxDelayLevel && totalMessages >= autoBuyDelayCost;
        
        contentBody.innerHTML = `
            <div class="upgrade-content">
                <div class="upgrade-item">
                    <div class="upgrade-header">
                        <h3 class="upgrade-title">Buy Auto-Typer Bot</h3>
                    </div>
                    <p class="upgrade-description">Purchase a new bot to automatically generate messages. Each bot produces ${formatNumber((1.0 * Math.pow(1.1, gen.botSpeed || 0)) * (gen.efficiency || 1.0) * Math.pow(1.1, gameState.upgrades.autoGenerationBoost || 0) * Math.pow(1.05, gameState.upgrades.messageMultiplier || 0), 2)} messages per second (after upgrades).</p>
                    <div class="upgrade-stats">
                        <div class="upgrade-stat">
                            <span class="stat-label">Current Bots:</span>
                            <span class="stat-value">${formatNumber(gen.bots || 0, 0)}</span>
                        </div>
                    </div>
                    <button class="upgrade-button ${canAffordBot && !isMaxBots ? '' : 'disabled'}" id="buy-bot" ${!canAffordBot || isMaxBots ? 'disabled' : ''}>
                        <span class="upgrade-button-text">Purchase Bot</span>
                        <span class="upgrade-button-cost">${isMaxBots ? 'Max Level' : `${formatNumber(botCost, 2)} Messages`}</span>
                    </button>
                </div>
                
                <div class="upgrade-item">
                    <div class="upgrade-header">
                        <h3 class="upgrade-title">Bot Efficiency</h3>
                        <div class="upgrade-level">Level ${efficiencyLevel}</div>
                    </div>
                    <p class="upgrade-description">Increase the efficiency of all your bots by 10% per upgrade (compounding).</p>
                    <div class="upgrade-stats">
                        <div class="upgrade-stat">
                            <span class="stat-label">Current Efficiency:</span>
                            <span class="stat-value">${formatNumber((gen.efficiency || 1.0) * 100, 0)}%</span>
                        </div>
                    </div>
                    <button class="upgrade-button ${canAffordEfficiency && !isMaxEfficiency ? '' : 'disabled'}" id="upgrade-efficiency" ${!canAffordEfficiency || isMaxEfficiency ? 'disabled' : ''}>
                        <span class="upgrade-button-text">Upgrade Efficiency</span>
                        <span class="upgrade-button-cost">${isMaxEfficiency ? 'Max Level' : `${formatNumber(efficiencyCost, 2)} Messages`}</span>
                    </button>
                </div>
                
                <div class="upgrade-item">
                    <div class="upgrade-header">
                        <h3 class="upgrade-title">Bot Speed</h3>
                        <div class="upgrade-level">Level ${gen.botSpeed || 0}</div>
                    </div>
                    <p class="upgrade-description">Increases the base messages per second each bot produces by 10% per level (compounding).</p>
                    <div class="upgrade-stats">
                        <div class="upgrade-stat">
                            <span class="stat-label">Current Speed:</span>
                            <span class="stat-value">${formatNumber(1.0 * Math.pow(1.1, gen.botSpeed || 0), 2)} msg/s per bot</span>
                        </div>
                    </div>
                    <button class="upgrade-button ${canAffordBotSpeed && !isMaxBotSpeed ? '' : 'disabled'}" id="upgrade-bot-speed" ${!canAffordBotSpeed || isMaxBotSpeed ? 'disabled' : ''}>
                        <span class="upgrade-button-text">Upgrade Bot Speed</span>
                        <span class="upgrade-button-cost">${isMaxBotSpeed ? 'Max Level' : `${formatNumber(botSpeedCost, 2)} Messages`}</span>
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
                    ${gen.autoBuyPurchased ? `
                        <button class="upgrade-button" id="toggle-auto-buy">
                            <span class="upgrade-button-text">${gen.autoBuy ? 'Disable' : 'Enable'} Auto-Buy</span>
                        </button>
                    ` : `
                        <button class="upgrade-button ${canAffordAutoBuy ? '' : 'disabled'}" id="buy-auto-buy" ${!canAffordAutoBuy ? 'disabled' : ''}>
                            <span class="upgrade-button-text">Purchase Auto-Buy</span>
                            <span class="upgrade-button-cost">${formatNumber(autoBuyCost, 2)} Messages</span>
                        </button>
                    `}
                </div>
                
                <div class="upgrade-item">
                    <div class="upgrade-header">
                        <h3 class="upgrade-title">Auto-Buy Speed</h3>
                        <div class="upgrade-level">${isMaxDelayLevel ? 'Max Level' : `Level ${autoBuyDelayLevel}`}</div>
                    </div>
                    <p class="upgrade-description">Reduces the delay between auto-buy purchases. Current delay: ${formatNumber(autoBuyDelay, 1)}s</p>
                    <div class="upgrade-stats">
                        <div class="upgrade-stat">
                            <span class="stat-label">Current Delay:</span>
                            <span class="stat-value">${formatNumber(autoBuyDelay, 1)}s</span>
                        </div>
                    </div>
                    ${isMaxDelayLevel ? `
                        <button class="upgrade-button disabled" disabled>
                            <span class="upgrade-button-text">Max Level Reached</span>
                        </button>
                    ` : `
                        <button class="upgrade-button ${canAffordAutoBuyDelay ? '' : 'disabled'}" id="upgrade-auto-buy-delay" ${!canAffordAutoBuyDelay ? 'disabled' : ''}>
                            <span class="upgrade-button-text">Upgrade Auto-Buy Speed</span>
                            <span class="upgrade-button-cost">${formatNumber(autoBuyDelayCost, 2)} Messages</span>
                        </button>
                    `}
                </div>
                
                <div class="upgrade-item" style="border: 2px solid var(--accent-color); background-color: var(--bg-medium); ${!isGenerator1AllMaxed() ? 'opacity: 0.6;' : ''}">
                    <div class="upgrade-header">
                        <h3 class="upgrade-title">🌟 Prestige Server</h3>
                        ${gen.prestigeLevel > 0 ? `<div class="upgrade-level">Prestige ${gen.prestigeLevel}</div>` : ''}
                    </div>
                    <p class="upgrade-description">Reset all upgrades for this generator and increase all max levels by 10. This allows you to progress further!</p>
                    <div class="upgrade-stats">
                        <div class="upgrade-stat">
                            <span class="stat-label">Prestige Level:</span>
                            <span class="stat-value">${gen.prestigeLevel || 0}</span>
                        </div>
                        <div class="upgrade-stat">
                            <span class="stat-label">Current Max Levels:</span>
                            <span class="stat-value">Bots: ${maxLevels.bots}, Efficiency: ${maxLevels.efficiency}, Speed: ${maxLevels.botSpeed}, Delay: ${maxLevels.autoBuyDelay}</span>
                        </div>
                        ${!isGenerator1AllMaxed() ? `
                        <div class="upgrade-stat">
                            <span class="stat-label" style="color: var(--text-muted);">Requirement:</span>
                            <span class="stat-value" style="color: var(--text-muted);">Max all upgrades to prestige</span>
                        </div>
                        ` : ''}
                    </div>
                    ${(() => {
                        const prestigeCost = getPrestigeCost('generator1');
                        const canAffordPrestige = totalMessages >= prestigeCost;
                        const allMaxed = isGenerator1AllMaxed();
                        return `
                            <button class="upgrade-button ${(allMaxed && canAffordPrestige) ? '' : 'disabled'}" id="prestige-generator1" ${(!allMaxed || !canAffordPrestige) ? 'disabled' : ''}>
                                <span class="upgrade-button-text">Prestige Server</span>
                                <span class="upgrade-button-cost">${allMaxed ? `${formatNumber(prestigeCost, 2)} Messages` : 'Max All Upgrades'}</span>
                            </button>
                        `;
                    })()}
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
        
        const upgradeAutoBuyDelayBtn = document.getElementById('upgrade-auto-buy-delay');
        if (upgradeAutoBuyDelayBtn) {
            upgradeAutoBuyDelayBtn.addEventListener('click', () => {
                upgradeAutoBuyDelay('generator1');
            });
        }
        
        const prestigeBtn = document.getElementById('prestige-generator1');
        if (prestigeBtn) {
            prestigeBtn.addEventListener('click', () => {
                if (prestigeGenerator('generator1')) {
                    // Prestige successful - UI will refresh automatically
                }
            });
        }
    } else if (channelId === 'general' && currentServer === 'generator2') {
        // Message Cascade upgrades
        const gen2 = gameState.generators.generator2 || { cascades: 0, cascadeEfficiency: 0.1, autoBuy: false, autoBuyPurchased: false, autoBuyDelayLevel: 0 };
        const gen1 = gameState.generators.generator1 || { bots: 0 };
        const currentCascades = gen2.cascades || 0;
        const gen1Bots = gen1.bots || 0;
        
        // Get generator1 server name
        const gen1ServerName = isGeneratorUnlocked('generator1') ? getGeneratorServerName('generator1') : 'Generator 1';
        
        // Calculate costs and requirements
        const maxLevels = getGenerator2MaxLevels();
        const isMaxCascades = currentCascades >= maxLevels.cascades;
        const messageCost = isMaxCascades ? 0 : Math.floor(getCascadeCost(currentCascades) * getCostReductionMultiplier());
        const totalMessages = gameState.messages + (gameState.fractionalMessages || 0);
        const hasGen1Bot = gen1Bots >= 1;
        const canAffordCascade = !isMaxCascades && hasGen1Bot && totalMessages >= messageCost;
        
        // Calculate production rate
        const gen1Production = getGeneratorProduction('generator1');
        const cascadeProduction = getGeneratorProduction('generator2');
        const cascadeEfficiency = gen2.cascadeEfficiency || 0.1;
        const efficiencyPercent = cascadeEfficiency * 100;
        const productionPerCascade = currentCascades > 0 ? cascadeProduction / currentCascades : (gen1Production * cascadeEfficiency);
        
        // Cascade efficiency upgrade
        const efficiencyLevel = Math.floor(Math.log(cascadeEfficiency / 0.1) / Math.log(1.1));
        const isMaxEfficiency = efficiencyLevel >= maxLevels.cascadeEfficiency;
        const efficiencyCost = isMaxEfficiency ? 0 : Math.floor(getCascadeEfficiencyUpgradeCost(cascadeEfficiency) * getCostReductionMultiplier());
        const canAffordEfficiency = !isMaxEfficiency && totalMessages >= efficiencyCost;
        
        // Auto-buy
        const autoBuyCost = 50000;
        const canAffordAutoBuy = totalMessages >= autoBuyCost && !gen2.autoBuyPurchased;
        const autoBuyDelayLevel = gen2.autoBuyDelayLevel || 0;
        const maxDelayLevel = getGenerator2MaxLevels().autoBuyDelay;
        const isMaxDelayLevel = autoBuyDelayLevel >= maxDelayLevel;
        const autoBuyDelayCost = isMaxDelayLevel ? 0 : Math.floor(getGenerator2AutoBuyDelayCost(autoBuyDelayLevel) * getCostReductionMultiplier());
        const canAffordAutoBuyDelay = !isMaxDelayLevel && totalMessages >= autoBuyDelayCost;
        const autoBuyDelay = getAutoBuyDelay(autoBuyDelayLevel);
        
        contentBody.innerHTML = `
            <div class="upgrade-content">
                <div class="upgrade-item">
                    <div class="upgrade-header">
                        <h3 class="upgrade-title">Buy Message Cascade</h3>
                    </div>
                    <p class="upgrade-description">Purchase a message cascade that generates messages based on your Auto-Typer Bot production. Each cascade generates ${formatNumber(productionPerCascade, 2)} messages per second (${formatNumber(efficiencyPercent, 1)}% of ${gen1ServerName}'s production). Requires 1 bot from ${gen1ServerName}.</p>
                    <div class="upgrade-stats">
                        <div class="upgrade-stat">
                            <span class="stat-label">Current Cascades:</span>
                            <span class="stat-value">${formatNumber(currentCascades, 0)}</span>
                        </div>
                        <div class="upgrade-stat">
                            <span class="stat-label">${gen1ServerName} Bots Available:</span>
                            <span class="stat-value ${hasGen1Bot ? '' : 'insufficient'}">${formatNumber(gen1Bots, 0)}</span>
                        </div>
                        <div class="upgrade-stat">
                            <span class="stat-label">Total Cascade Production:</span>
                            <span class="stat-value">${formatNumber(cascadeProduction, 2)} msg/s</span>
                        </div>
                    </div>
                    <button class="upgrade-button ${canAffordCascade && !isMaxCascades ? '' : 'disabled'}" id="buy-cascade" ${!canAffordCascade || isMaxCascades ? 'disabled' : ''}>
                        <span class="upgrade-button-text">Purchase Cascade</span>
                        <span class="upgrade-button-cost">${isMaxCascades ? 'Max Level' : !hasGen1Bot ? `Need 1 Bot from ${gen1ServerName}` : `${formatNumber(messageCost, 2)} Messages + 1 Bot`}</span>
                    </button>
                </div>
                
                <div class="upgrade-item">
                    <div class="upgrade-header">
                        <h3 class="upgrade-title">Cascade Efficiency</h3>
                        <div class="upgrade-level">Level ${efficiencyLevel}</div>
                    </div>
                    <p class="upgrade-description">Increases the percentage of ${gen1ServerName}'s production each cascade generates by 10% per upgrade (compounding).</p>
                    <div class="upgrade-stats">
                        <div class="upgrade-stat">
                            <span class="stat-label">Current Efficiency:</span>
                            <span class="stat-value">${formatNumber(efficiencyPercent, 1)}%</span>
                        </div>
                    </div>
                    <button class="upgrade-button ${canAffordEfficiency && !isMaxEfficiency ? '' : 'disabled'}" id="upgrade-cascade-efficiency" ${!canAffordEfficiency || isMaxEfficiency ? 'disabled' : ''}>
                        <span class="upgrade-button-text">Upgrade Cascade Efficiency</span>
                        <span class="upgrade-button-cost">${isMaxEfficiency ? 'Max Level' : `${formatNumber(efficiencyCost, 2)} Messages`}</span>
                    </button>
                </div>
                
                <div class="upgrade-item">
                    <div class="upgrade-header">
                        <h3 class="upgrade-title">Auto-Buy Cascades</h3>
                    </div>
                    <p class="upgrade-description">Automatically purchase cascades when you have enough messages and bots. Can be toggled on/off.</p>
                    <div class="upgrade-stats">
                        <div class="upgrade-stat">
                            <span class="stat-label">Status:</span>
                            <span class="stat-value">${gen2.autoBuy ? 'Enabled' : 'Disabled'}</span>
                        </div>
                    </div>
                    ${gen2.autoBuyPurchased ? `
                        <button class="upgrade-button" id="toggle-generator2-auto-buy">
                            <span class="upgrade-button-text">${gen2.autoBuy ? 'Disable' : 'Enable'} Auto-Buy</span>
                        </button>
                    ` : `
                        <button class="upgrade-button ${canAffordAutoBuy ? '' : 'disabled'}" id="buy-generator2-auto-buy" ${!canAffordAutoBuy ? 'disabled' : ''}>
                            <span class="upgrade-button-text">Purchase Auto-Buy</span>
                            <span class="upgrade-button-cost">${formatNumber(autoBuyCost, 2)} Messages</span>
                        </button>
                    `}
                </div>
                
                <div class="upgrade-item">
                    <div class="upgrade-header">
                        <h3 class="upgrade-title">Auto-Buy Speed</h3>
                        <div class="upgrade-level">${isMaxDelayLevel ? 'Max Level' : `Level ${autoBuyDelayLevel}`}</div>
                    </div>
                    <p class="upgrade-description">Reduces the delay between auto-buy purchases. Current delay: ${formatNumber(autoBuyDelay, 1)}s</p>
                    <div class="upgrade-stats">
                        <div class="upgrade-stat">
                            <span class="stat-label">Current Delay:</span>
                            <span class="stat-value">${formatNumber(autoBuyDelay, 1)}s</span>
                        </div>
                    </div>
                    ${isMaxDelayLevel ? `
                        <button class="upgrade-button disabled" disabled>
                            <span class="upgrade-button-text">Max Level Reached</span>
                        </button>
                    ` : `
                        <button class="upgrade-button ${canAffordAutoBuyDelay ? '' : 'disabled'}" id="upgrade-generator2-auto-buy-delay" ${!canAffordAutoBuyDelay ? 'disabled' : ''}>
                            <span class="upgrade-button-text">Upgrade Auto-Buy Speed</span>
                            <span class="upgrade-button-cost">${formatNumber(autoBuyDelayCost, 2)} Messages</span>
                        </button>
                    `}
                </div>
                
                <div class="upgrade-item" style="border: 2px solid var(--accent-color); background-color: var(--bg-medium); ${!isGenerator2AllMaxed() ? 'opacity: 0.6;' : ''}">
                    <div class="upgrade-header">
                        <h3 class="upgrade-title">🌟 Prestige Server</h3>
                        ${gen2.prestigeLevel > 0 ? `<div class="upgrade-level">Prestige ${gen2.prestigeLevel}</div>` : ''}
                    </div>
                    <p class="upgrade-description">Reset all upgrades for this generator and increase all max levels by 10. This allows you to progress further!</p>
                    <div class="upgrade-stats">
                        <div class="upgrade-stat">
                            <span class="stat-label">Prestige Level:</span>
                            <span class="stat-value">${gen2.prestigeLevel || 0}</span>
                        </div>
                        <div class="upgrade-stat">
                            <span class="stat-label">Current Max Levels:</span>
                            <span class="stat-value">Cascades: ${maxLevels.cascades}, Efficiency: ${maxLevels.cascadeEfficiency}, Delay: ${maxLevels.autoBuyDelay}</span>
                        </div>
                        ${!isGenerator2AllMaxed() ? `
                        <div class="upgrade-stat">
                            <span class="stat-label" style="color: var(--text-muted);">Requirement:</span>
                            <span class="stat-value" style="color: var(--text-muted);">Max all upgrades to prestige</span>
                        </div>
                        ` : ''}
                    </div>
                    ${(() => {
                        const prestigeCost = getPrestigeCost('generator2');
                        const canAffordPrestige = totalMessages >= prestigeCost;
                        const allMaxed = isGenerator2AllMaxed();
                        return `
                            <button class="upgrade-button ${(allMaxed && canAffordPrestige) ? '' : 'disabled'}" id="prestige-generator2" ${(!allMaxed || !canAffordPrestige) ? 'disabled' : ''}>
                                <span class="upgrade-button-text">Prestige Server</span>
                                <span class="upgrade-button-cost">${allMaxed ? `${formatNumber(prestigeCost, 2)} Messages` : 'Max All Upgrades'}</span>
                            </button>
                        `;
                    })()}
                </div>
            </div>
        `;
        
        // Setup upgrade handlers
        const buyCascadeBtn = document.getElementById('buy-cascade');
        if (buyCascadeBtn) {
            buyCascadeBtn.addEventListener('click', () => {
                purchaseCascade();
            });
        }
        
        const upgradeEfficiencyBtn = document.getElementById('upgrade-cascade-efficiency');
        if (upgradeEfficiencyBtn) {
            upgradeEfficiencyBtn.addEventListener('click', () => {
                upgradeCascadeEfficiency();
            });
        }
        
        const buyAutoBuyBtn = document.getElementById('buy-generator2-auto-buy');
        if (buyAutoBuyBtn) {
            buyAutoBuyBtn.addEventListener('click', () => {
                purchaseGenerator2AutoBuy();
            });
        }
        
        const toggleAutoBuyBtn = document.getElementById('toggle-generator2-auto-buy');
        if (toggleAutoBuyBtn) {
            toggleAutoBuyBtn.addEventListener('click', () => {
                toggleGenerator2AutoBuy();
            });
        }
        
        const upgradeAutoBuyDelayBtn = document.getElementById('upgrade-generator2-auto-buy-delay');
        if (upgradeAutoBuyDelayBtn) {
            upgradeAutoBuyDelayBtn.addEventListener('click', () => {
                upgradeGenerator2AutoBuyDelay();
            });
        }
        
        const prestigeBtn = document.getElementById('prestige-generator2');
        if (prestigeBtn) {
            prestigeBtn.addEventListener('click', () => {
                if (prestigeGenerator('generator2')) {
                    // Prestige successful - UI will refresh automatically
                }
            });
        }
    } else if (currentServer === 'generator3' && channelId === 'research') {
        // Research Tree channel
        const researchPoints = getResearchPoints();
        const research = gameState.research || { globalBoostPurchased: false, manualProduction: 0, botProduction: 0, cascadeProduction: 0 };
        
        // Center node: Global Boost
        const globalBoostPurchased = research.globalBoostPurchased || false;
        const globalBoostCost = 10;
        const canAffordGlobalBoost = !globalBoostPurchased && researchPoints >= globalBoostCost;
        
        // Manual Production branch
        const manualLevel = research.manualProduction || 0;
        const isMaxManual = manualLevel >= 5;
        const manualCost = isMaxManual ? 0 : getResearchUpgradeCost(manualLevel);
        const canAffordManual = !isMaxManual && researchPoints >= manualCost;
        const manualMultiplier = 1.0 + (manualLevel * 0.5); // +50% per level
        const manualBoost = globalBoostPurchased ? (manualMultiplier * 2.0) : manualMultiplier;
        
        // Bot Production branch
        const botLevel = research.botProduction || 0;
        const isMaxBot = botLevel >= 5;
        const botCost = isMaxBot ? 0 : getResearchUpgradeCost(botLevel);
        const canAffordBot = !isMaxBot && researchPoints >= botCost;
        const botMultiplier = 1.0 + (botLevel * 0.5); // +50% per level
        const botBoost = globalBoostPurchased ? (botMultiplier * 2.0) : botMultiplier;
        
        // Cascade Production branch
        const cascadeLevel = research.cascadeProduction || 0;
        const isMaxCascade = cascadeLevel >= 5;
        const cascadeCost = isMaxCascade ? 0 : getResearchUpgradeCost(cascadeLevel);
        const canAffordCascade = !isMaxCascade && researchPoints >= cascadeCost;
        const cascadeMultiplier = 1.0 + (cascadeLevel * 0.5); // +50% per level
        const cascadeBoost = globalBoostPurchased ? (cascadeMultiplier * 2.0) : cascadeMultiplier;
        
        contentBody.innerHTML = `
            <div class="research-tree-container">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h2 style="margin: 0 0 10px 0;">Research Points: ${formatNumber(researchPoints, 2)}</h2>
                    <p style="color: var(--text-muted); margin: 0;">1 Research Point = 10,000 Messages</p>
                </div>
                
                <div class="research-tree">
                    <!-- Center Node: Global Boost -->
                    <div class="research-node research-node-center ${!globalBoostPurchased && !canAffordGlobalBoost ? 'disabled-node' : ''} ${globalBoostPurchased ? 'purchased-node unlocked' : ''}" id="research-node-global">
                        <div class="research-node-content upgrade-item">
                            <div class="upgrade-header">
                                <h3 class="upgrade-title">⚡ Global Production Boost</h3>
                                ${globalBoostPurchased ? '<div class="upgrade-level">Purchased</div>' : ''}
                            </div>
                            <p class="upgrade-description">Increase production from all sources by 100%. This upgrade affects manual generation, bots, and cascades.</p>
                            <div class="upgrade-stats">
                                <div class="upgrade-stat">
                                    <span class="stat-label">Status:</span>
                                    <span class="stat-value">${globalBoostPurchased ? 'Active (+100%)' : 'Not Purchased'}</span>
                                </div>
                            </div>
                            ${globalBoostPurchased ? `
                                <button class="upgrade-button disabled" disabled>
                                    <span class="upgrade-button-text">Already Purchased</span>
                                </button>
                            ` : `
                                <button class="upgrade-button ${canAffordGlobalBoost ? '' : 'disabled'}" id="purchase-global-boost" ${!canAffordGlobalBoost ? 'disabled' : ''}>
                                    <span class="upgrade-button-text">Purchase Global Boost</span>
                                    <span class="upgrade-button-cost">${globalBoostCost} Research Points</span>
                                </button>
                            `}
                        </div>
                    </div>
                    
                    
                    <!-- Branch Nodes -->
                    <div class="research-branches ${globalBoostPurchased ? 'unlocked' : ''}">
                        <!-- Manual Production -->
                        <div class="research-node research-node-branch ${!globalBoostPurchased ? 'disabled-node' : 'unlocked'}" id="research-node-manual">
                            <div class="research-node-content upgrade-item">
                                <div class="upgrade-header">
                                    <h3 class="upgrade-title">Manual Production</h3>
                                    <div class="upgrade-level">${isMaxManual ? 'Max Level' : `Level ${manualLevel}/5`}</div>
                                </div>
                                <p class="upgrade-description">Increase manual generation production by 50% per level.</p>
                                <div class="upgrade-stats">
                                    <div class="upgrade-stat">
                                        <span class="stat-label">Current Boost:</span>
                                        <span class="stat-value">+${formatNumber((manualMultiplier - 1.0) * 100, 1)}%</span>
                                    </div>
                                </div>
                                ${!globalBoostPurchased ? `
                                    <button class="upgrade-button disabled" disabled>
                                        <span class="upgrade-button-text">Requires Global Boost</span>
                                    </button>
                                ` : isMaxManual ? `
                                    <button class="upgrade-button disabled" disabled>
                                        <span class="upgrade-button-text">Max Level Reached</span>
                                    </button>
                                ` : `
                                    <button class="upgrade-button ${canAffordManual ? '' : 'disabled'}" id="upgrade-manual-production" ${!canAffordManual ? 'disabled' : ''}>
                                        <span class="upgrade-button-text">Upgrade Manual Production</span>
                                        <span class="upgrade-button-cost">${manualCost} Research Points</span>
                                    </button>
                                `}
                            </div>
                        </div>
                        
                        <!-- Bot Production -->
                        <div class="research-node research-node-branch ${!globalBoostPurchased ? 'disabled-node' : 'unlocked'}" id="research-node-bot">
                            <div class="research-node-content upgrade-item">
                                <div class="upgrade-header">
                                    <h3 class="upgrade-title">Bot Production</h3>
                                    <div class="upgrade-level">${isMaxBot ? 'Max Level' : `Level ${botLevel}/5`}</div>
                                </div>
                                <p class="upgrade-description">Increase bot production by 50% per level.</p>
                                <div class="upgrade-stats">
                                    <div class="upgrade-stat">
                                        <span class="stat-label">Current Boost:</span>
                                        <span class="stat-value">+${formatNumber((botMultiplier - 1.0) * 100, 1)}%</span>
                                    </div>
                                </div>
                                ${!globalBoostPurchased ? `
                                    <button class="upgrade-button disabled" disabled>
                                        <span class="upgrade-button-text">Requires Global Boost</span>
                                    </button>
                                ` : isMaxBot ? `
                                    <button class="upgrade-button disabled" disabled>
                                        <span class="upgrade-button-text">Max Level Reached</span>
                                    </button>
                                ` : `
                                    <button class="upgrade-button ${canAffordBot ? '' : 'disabled'}" id="upgrade-bot-production" ${!canAffordBot ? 'disabled' : ''}>
                                        <span class="upgrade-button-text">Upgrade Bot Production</span>
                                        <span class="upgrade-button-cost">${botCost} Research Points</span>
                                    </button>
                                `}
                            </div>
                        </div>
                        
                        <!-- Cascade Production -->
                        <div class="research-node research-node-branch ${!globalBoostPurchased ? 'disabled-node' : 'unlocked'}" id="research-node-cascade">
                            <div class="research-node-content upgrade-item">
                                <div class="upgrade-header">
                                    <h3 class="upgrade-title">Cascade Production</h3>
                                    <div class="upgrade-level">${isMaxCascade ? 'Max Level' : `Level ${cascadeLevel}/5`}</div>
                                </div>
                                <p class="upgrade-description">Increase cascade production by 50% per level.</p>
                                <div class="upgrade-stats">
                                    <div class="upgrade-stat">
                                        <span class="stat-label">Current Boost:</span>
                                        <span class="stat-value">+${formatNumber((cascadeMultiplier - 1.0) * 100, 1)}%</span>
                                    </div>
                                </div>
                                ${!globalBoostPurchased ? `
                                    <button class="upgrade-button disabled" disabled>
                                        <span class="upgrade-button-text">Requires Global Boost</span>
                                    </button>
                                ` : isMaxCascade ? `
                                    <button class="upgrade-button disabled" disabled>
                                        <span class="upgrade-button-text">Max Level Reached</span>
                                    </button>
                                ` : `
                                    <button class="upgrade-button ${canAffordCascade ? '' : 'disabled'}" id="upgrade-cascade-production" ${!canAffordCascade ? 'disabled' : ''}>
                                        <span class="upgrade-button-text">Upgrade Cascade Production</span>
                                        <span class="upgrade-button-cost">${cascadeCost} Research Points</span>
                                    </button>
                                `}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Setup research upgrade handlers
        const globalBoostBtn = document.getElementById('purchase-global-boost');
        if (globalBoostBtn) {
            globalBoostBtn.addEventListener('click', () => {
                purchaseGlobalBoost();
            });
        }
        
        const manualProductionBtn = document.getElementById('upgrade-manual-production');
        if (manualProductionBtn) {
            manualProductionBtn.addEventListener('click', () => {
                upgradeResearchProduction('manual');
            });
        }
        
        const botProductionBtn = document.getElementById('upgrade-bot-production');
        if (botProductionBtn) {
            botProductionBtn.addEventListener('click', () => {
                upgradeResearchProduction('bot');
            });
        }
        
        const cascadeProductionBtn = document.getElementById('upgrade-cascade-production');
        if (cascadeProductionBtn) {
            cascadeProductionBtn.addEventListener('click', () => {
                upgradeResearchProduction('cascade');
            });
        }
    } else if (channelId === 'global1' && currentServer === 'upgrades') {
        // Global upgrades channel 1
        const multiplierLevel = gameState.upgrades.manualGenerationMultiplier || 0;
        const isMaxManualMultiplier = multiplierLevel >= GLOBAL_UPGRADE_MAX_LEVELS.manualGenerationMultiplier;
        const currentMultiplier = getManualGenerationMultiplier();
        const upgradeCost = isMaxManualMultiplier ? 0 : Math.floor(getManualGenerationUpgradeCost(multiplierLevel) * getCostReductionMultiplier());
        const totalMessages = gameState.messages + (gameState.fractionalMessages || 0);
        const canAfford = !isMaxManualMultiplier && totalMessages >= upgradeCost;
        
        const autoBoostLevel = gameState.upgrades.autoGenerationBoost || 0;
        const isMaxAutoBoost = autoBoostLevel >= GLOBAL_UPGRADE_MAX_LEVELS.autoGenerationBoost;
        const autoBoostCost = isMaxAutoBoost ? 0 : Math.floor(getAutoGenerationBoostCost(autoBoostLevel) * getCostReductionMultiplier());
        const canAffordAutoBoost = !isMaxAutoBoost && totalMessages >= autoBoostCost;
        
        const messageMultiplierLevel = gameState.upgrades.messageMultiplier || 0;
        const isMaxMessageMultiplier = messageMultiplierLevel >= GLOBAL_UPGRADE_MAX_LEVELS.messageMultiplier;
        const messageMultiplierCost = isMaxMessageMultiplier ? 0 : Math.floor(getMessageMultiplierCost(messageMultiplierLevel) * getCostReductionMultiplier());
        const canAffordMessageMultiplier = !isMaxMessageMultiplier && totalMessages >= messageMultiplierCost;
        
        const costEfficiencyLevel = gameState.upgrades.costEfficiency || 0;
        const isMaxCostEfficiency = costEfficiencyLevel >= GLOBAL_UPGRADE_MAX_LEVELS.costEfficiency;
        const costEfficiencyCost = isMaxCostEfficiency ? 0 : Math.floor(getCostEfficiencyCost(costEfficiencyLevel) * getCostReductionMultiplier());
        const canAffordCostEfficiency = !isMaxCostEfficiency && totalMessages >= costEfficiencyCost;
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
                            <span class="stat-value">+${formatNumber((currentMultiplier - 1) * 100, 0)}%</span>
                        </div>
                        <div class="upgrade-stat">
                            <span class="stat-label">Average Messages Per Click:</span>
                            <span class="stat-value">${formatNumber(getManualGenerationMultiplier() * getGlobalMessageMultiplier(), 1)}</span>
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
                            <span class="stat-value">+${formatNumber(autoBoostLevel * 10, 0)}%</span>
                        </div>
                    </div>
                    <button class="upgrade-button ${canAffordAutoBoost && !isMaxAutoBoost ? '' : 'disabled'}" id="buy-auto-boost" ${!canAffordAutoBoost || isMaxAutoBoost ? 'disabled' : ''}>
                        <span class="upgrade-button-text">Purchase Upgrade</span>
                        <span class="upgrade-button-cost">${isMaxAutoBoost ? 'Max Level' : `${formatNumber(autoBoostCost, 2)} Messages`}</span>
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
                            <span class="stat-value">+${formatNumber(messageMultiplierLevel * 5, 0)}%</span>
                        </div>
                    </div>
                    <button class="upgrade-button ${canAffordMessageMultiplier && !isMaxMessageMultiplier ? '' : 'disabled'}" id="buy-message-multiplier" ${!canAffordMessageMultiplier || isMaxMessageMultiplier ? 'disabled' : ''}>
                        <span class="upgrade-button-text">Purchase Upgrade</span>
                        <span class="upgrade-button-cost">${isMaxMessageMultiplier ? 'Max Level' : `${formatNumber(messageMultiplierCost, 2)} Messages`}</span>
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
                            <span class="stat-value">-${formatNumber(costReduction, 0)}%</span>
                        </div>
                    </div>
                    <button class="upgrade-button ${canAffordCostEfficiency && !isMaxCostEfficiency ? '' : 'disabled'}" id="buy-cost-efficiency" ${!canAffordCostEfficiency || isMaxCostEfficiency ? 'disabled' : ''}>
                        <span class="upgrade-button-text">Purchase Upgrade</span>
                        <span class="upgrade-button-cost">${isMaxCostEfficiency ? 'Max Level' : `${formatNumber(costEfficiencyCost, 2)} Messages`}</span>
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
                    <h3 class="settings-title">UI Colors</h3>
                    <p class="settings-description">Customize the appearance of the game.</p>
                    <div class="color-controls">
                        <div class="color-control">
                            <label class="color-label">Background Color:</label>
                            <div class="color-input-wrapper">
                                <input type="color" id="bg-color-picker" value="${gameState.settings.backgroundColor || '#36393f'}" class="color-picker">
                                <input type="text" id="bg-color-text" value="${gameState.settings.backgroundColor || '#36393f'}" class="color-text" maxlength="7">
                            </div>
                        </div>
                        <div class="color-control">
                            <label class="color-label">Accent Color:</label>
                            <div class="color-input-wrapper">
                                <input type="color" id="accent-color-picker" value="${gameState.settings.accentColor || '#5865f2'}" class="color-picker">
                                <input type="text" id="accent-color-text" value="${gameState.settings.accentColor || '#5865f2'}" class="color-text" maxlength="7">
                            </div>
                        </div>
                        <div class="color-presets">
                            <label class="color-label">Presets:</label>
                            <div class="preset-buttons">
                                <button class="preset-button" data-preset="default">Default</button>
                                <button class="preset-button" data-preset="green">Green</button>
                                <button class="preset-button" data-preset="purple">Purple</button>
                                <button class="preset-button" data-preset="red">Red</button>
                                <button class="preset-button" data-preset="orange">Orange</button>
                                <button class="preset-button" data-preset="pink">Pink</button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="settings-section">
                    <h3 class="settings-title">Game Data</h3>
                    <p class="settings-description">Manage your save data.</p>
                    <div class="settings-buttons">
                        <button class="settings-button save-button" id="export-save">Export Save</button>
                        <button class="settings-button save-button" id="import-save">Import Save</button>
                        <button class="settings-button danger" id="reset-game">Reset Game</button>
                    </div>
                </div>
                
                <div class="settings-section">
                    <h3 class="settings-title">Debug Tools</h3>
                    <p class="settings-description">Testing and development tools.</p>
                    <div class="settings-buttons">
                        <button class="settings-button" id="debug-add-messages" style="background-color: #5865f2;">Add 10,000 Messages</button>
                    </div>
                </div>
            </div>
        `;
        setupSettingsHandlers();
    } else if (channelId === 'changelog' && currentServer === 'settings') {
        contentBody.innerHTML = `
            <div class="settings-content">
                <div class="settings-section">
                    <h3 class="settings-title">Changelog</h3>
                    <p class="settings-description">View updates and changes made to the game.</p>
                    <div class="changelog-container" id="changelog-container">
                        <!-- Changelog entries will be displayed here -->
                    </div>
                </div>
            </div>
        `;
        renderChangelog();
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
        const manualGenBuff = formatNumber(((manualGenMultiplier - 1.0) * 100), 1);
        
        const autoBoostLevel = gameState.upgrades.autoGenerationBoost || 0;
        const autoBoostMultiplier = Math.pow(1.1, autoBoostLevel);
        const autoBoostBuff = formatNumber(((autoBoostMultiplier - 1.0) * 100), 1);
        
        const messageMultiplierLevel = gameState.upgrades.messageMultiplier || 0;
        const messageMultiplierMultiplier = getGlobalMessageMultiplier();
        const messageMultiplierBuff = formatNumber(((messageMultiplierMultiplier - 1.0) * 100), 1);
        
        const costEfficiencyLevel = gameState.upgrades.costEfficiency || 0;
        const costEfficiencyBuff = formatNumber(Math.min(costEfficiencyLevel * 5, 50), 0);
        
        // Server prestige stats
        let serversStatsHtml = '';
        const unlockedGenerators = gameState.generators.unlocked || [];
        if (unlockedGenerators.length > 0) {
            let serverItemsHtml = '';
            const generatorOrder = ['generator1', 'generator2', 'generator3'];
            generatorOrder.forEach(genId => {
                if (isGeneratorUnlocked(genId)) {
                    const serverName = getGeneratorServerName(genId);
                    const gen = gameState.generators[genId] || {};
                    const prestigeLevel = gen.prestigeLevel || 0;
                    serverItemsHtml += `
                        <div class="stat-item">
                            <span class="stat-label">${serverName}:</span>
                            <span class="stat-value">Prestige ${prestigeLevel}</span>
                        </div>
                    `;
                }
            });
            
            if (serverItemsHtml) {
                serversStatsHtml = `
                    <div class="stats-section">
                        <h3 class="stats-section-title">Servers</h3>
                        <div class="stats-grid">
                            ${serverItemsHtml}
                        </div>
                    </div>
                `;
            }
        }
        
        // Generator stats
        let generatorStatsHtml = '';
        if (isGeneratorUnlocked('generator1')) {
            const gen = gameState.generators.generator1 || {};
            const production = getGeneratorProduction('generator1');
            generatorStatsHtml += `
                <div class="stats-section">
                    <h3 class="stats-section-title">Auto-Typer Bot</h3>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-label">Active Bots:</span>
                            <span class="stat-value">${formatNumber(gen.bots || 0, 0)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Bot Speed:</span>
                            <span class="stat-value">Level ${gen.botSpeed || 0}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Efficiency:</span>
                            <span class="stat-value">${formatNumber((gen.efficiency || 1.0) * 100, 0)}%</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Production Rate:</span>
                            <span class="stat-value">${formatNumber(production * getGlobalMessageMultiplier(), 2)} msg/s</span>
                        </div>
                    </div>
                </div>
            `;
        }
        if (isGeneratorUnlocked('generator2')) {
            const gen2 = gameState.generators.generator2 || {};
            const production = getGeneratorProduction('generator2');
            generatorStatsHtml += `
                <div class="stats-section">
                    <h3 class="stats-section-title">Message Cascade</h3>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-label">Active Cascades:</span>
                            <span class="stat-value">${formatNumber(gen2.cascades || 0, 0)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Production Rate:</span>
                            <span class="stat-value">${formatNumber(production * getGlobalMessageMultiplier(), 2)} msg/s</span>
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
                
                ${serversStatsHtml}
                
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
            // Ensure research exists
            if (!gameState.research) {
                gameState.research = {
                    globalBoostPurchased: false,
                    manualProduction: 0,
                    botProduction: 0,
                    cascadeProduction: 0
                };
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
                gameState.generators.generator1 = { bots: 0, efficiency: 1.0, botSpeed: 0, autoBuy: false, autoBuyPurchased: false, autoBuyDelayLevel: 0, prestigeLevel: 0 };
            }
            // Ensure prestigeLevel exists for existing saves
            if (gameState.generators.generator1 && gameState.generators.generator1.prestigeLevel === undefined) {
                gameState.generators.generator1.prestigeLevel = 0;
            }
            // Assign names to unlocked generators if they don't have one (for existing saves)
            ['generator1', 'generator2', 'generator3'].forEach(genId => {
                if (isGeneratorUnlocked(genId)) {
                    assignRandomServerName(genId);
                }
            });
            // Assign names to unlocked generators if they don't have one (for existing saves)
            ['generator1', 'generator2', 'generator3'].forEach(genId => {
                if (isGeneratorUnlocked(genId)) {
                    assignRandomServerName(genId);
                }
            });
            // Ensure generator1 has all properties
            if (gameState.generators.generator1) {
                if (gameState.generators.generator1.botSpeed === undefined) {
                    gameState.generators.generator1.botSpeed = 0;
                }
                if (gameState.generators.generator1.autoBuy === undefined) {
                    gameState.generators.generator1.autoBuy = false;
                }
                if (gameState.generators.generator1.autoBuyPurchased === undefined) {
                    gameState.generators.generator1.autoBuyPurchased = false;
                }
                if (gameState.generators.generator1.autoBuyDelayLevel === undefined) {
                    gameState.generators.generator1.autoBuyDelayLevel = 0;
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
    
    // Get preview name (this stores it so it will be used when unlocking)
    const previewName = getPreviewServerName(generatorId);
    
    const contentBody = document.getElementById('content-body');
    contentBody.innerHTML = `
        <div class="unlock-prompt">
            <div class="unlock-content">
                <h2>🔒 ${previewName}</h2>
                <p>This server is locked. Unlock it to start generating messages automatically!</p>
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
                    Unlock ${previewName}
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

// Base max levels for Generator 1 (before prestige)
const GENERATOR1_BASE_MAX_LEVELS = {
    bots: 50,
    efficiency: 10,
    botSpeed: 10,
    autoBuyDelay: 10
};

// Base max levels for Generator 2 (before prestige)
const GENERATOR2_BASE_MAX_LEVELS = {
    cascades: 50,
    cascadeEfficiency: 10,
    autoBuyDelay: 10
};

// Get max levels for Generator 1 based on prestige level
function getGenerator1MaxLevels() {
    const prestigeLevel = (gameState.generators.generator1?.prestigeLevel || 0);
    return {
        bots: GENERATOR1_BASE_MAX_LEVELS.bots + (prestigeLevel * 10),
        efficiency: GENERATOR1_BASE_MAX_LEVELS.efficiency + (prestigeLevel * 10),
        botSpeed: GENERATOR1_BASE_MAX_LEVELS.botSpeed + (prestigeLevel * 10),
        autoBuyDelay: GENERATOR1_BASE_MAX_LEVELS.autoBuyDelay + (prestigeLevel * 10)
    };
}

// Get max levels for Generator 2 based on prestige level
function getGenerator2MaxLevels() {
    const prestigeLevel = (gameState.generators.generator2?.prestigeLevel || 0);
    return {
        cascades: GENERATOR2_BASE_MAX_LEVELS.cascades + (prestigeLevel * 10),
        cascadeEfficiency: GENERATOR2_BASE_MAX_LEVELS.cascadeEfficiency + (prestigeLevel * 10),
        autoBuyDelay: GENERATOR2_BASE_MAX_LEVELS.autoBuyDelay + (prestigeLevel * 10)
    };
}

// Max levels for Global Upgrades
const GLOBAL_UPGRADE_MAX_LEVELS = {
    manualGenerationMultiplier: 25,
    autoGenerationBoost: 10,
    messageMultiplier: 10,
    costEfficiency: 10
};

// Get bot cost (increases with each bot)
function getBotCost(currentBots) {
    // Slow scaling: 1.05x per bot
    // Base cost 1000, so bot #0 = 1000, bot #1 = 1050, bot #2 = 1102.5, etc.
    // Note: The free bot from unlocking doesn't count for cost scaling
    return Math.floor(1000 * Math.pow(1.05, currentBots));
}

// Get cascade cost (for generator2)
function getCascadeCost(currentCascades) {
    // Message cost: first one costs 10,000, then scales by 1.05x (same as bots)
    // Base message cost 10,000, so cascade #0 = 10,000, cascade #1 = 10,500, etc.
    return Math.floor(10000 * Math.pow(1.05, currentCascades));
}

// Get cascade efficiency upgrade cost (for generator2)
function getCascadeEfficiencyUpgradeCost(currentEfficiency) {
    // Each upgrade increases efficiency by 10% (0.1 -> 0.11 -> 0.121, etc.)
    // Base cost 10000 (10x generator1 efficiency upgrade), increases by 1.2x per level
    // Calculate level from efficiency: efficiency = 0.1 * (1.1 ^ level)
    const level = Math.floor(Math.log(currentEfficiency / 0.1) / Math.log(1.1));
    return Math.floor(10000 * Math.pow(1.2, level));
}

// Get generator2 auto-buy delay upgrade cost
function getGenerator2AutoBuyDelayCost(currentLevel) {
    // Base cost 10000 (10x generator1), increases by 1.2x per level
    return Math.floor(10000 * Math.pow(1.2, currentLevel));
}

// Get cascade efficiency upgrade cost (for generator2)
function getCascadeEfficiencyUpgradeCost(currentEfficiency) {
    // Each upgrade increases efficiency by 10% (0.1 -> 0.11 -> 0.121, etc.)
    // Base cost 10000 (10x generator1 efficiency upgrade), increases by 1.2x per level
    // Calculate level from efficiency: efficiency = 0.1 * (1.1 ^ level)
    const level = Math.floor(Math.log(currentEfficiency / 0.1) / Math.log(1.1));
    return Math.floor(10000 * Math.pow(1.2, level));
}

// Get generator2 auto-buy delay upgrade cost
function getGenerator2AutoBuyDelayCost(currentLevel) {
    // Base cost 10000 (10x generator1), increases by 1.2x per level
    return Math.floor(10000 * Math.pow(1.2, currentLevel));
}

// Purchase a cascade (generator2)
function purchaseCascade() {
    if (!isGeneratorUnlocked('generator2')) return;
    
    const gen2 = gameState.generators.generator2;
    const gen1 = gameState.generators.generator1;
    if (!gen2 || !gen1) return;
    
    // Check max cascade limit
    const currentCascades = gen2.cascades || 0;
    const maxLevels = getGenerator2MaxLevels();
    if (currentCascades >= maxLevels.cascades) {
        return; // Already at max
    }
    
    // Check if generator1 has bots available to sacrifice
    const gen1Bots = gen1.bots || 0;
    if (gen1Bots < 1) {
        return; // Need at least 1 bot from generator1
    }
    
    // Calculate message cost
    const messageCost = Math.floor(getCascadeCost(currentCascades) * getCostReductionMultiplier());
    const totalMessages = gameState.messages + (gameState.fractionalMessages || 0);
    
    if (totalMessages >= messageCost) {
        // Deduct 1 bot from generator1
        gen1.bots = gen1Bots - 1;
        
        // Deduct message cost
        if (gameState.fractionalMessages >= messageCost) {
            gameState.fractionalMessages -= messageCost;
        } else {
            const remaining = messageCost - gameState.fractionalMessages;
            gameState.fractionalMessages = 0;
            gameState.messages -= remaining;
        }
        
        // Add 1 cascade
        gen2.cascades = currentCascades + 1;
        autoSave();
        updateCurrencyDisplay();
        
        // Only refresh UI if on generator2 channel
        if (currentServer === 'generator2' && currentChannel === 'general') {
            updateUpgradeButtonStates();
        }
        // Also refresh generator1 channel if open (to show updated bot count)
        if (currentServer === 'generator1' && currentChannel === 'general') {
            updateUpgradeButtonStates();
        }
    }
}

// Upgrade cascade efficiency (generator2)
function upgradeCascadeEfficiency() {
    if (!isGeneratorUnlocked('generator2')) return;
    
    const gen2 = gameState.generators.generator2;
    if (!gen2) return;
    
    // Check max level limit
    const currentEfficiency = gen2.cascadeEfficiency || 0.1;
    const level = Math.floor(Math.log(currentEfficiency / 0.1) / Math.log(1.1));
    const maxLevels = getGenerator2MaxLevels();
    if (level >= maxLevels.cascadeEfficiency) {
        return; // Already at max
    }
    
    const cost = Math.floor(getCascadeEfficiencyUpgradeCost(currentEfficiency) * getCostReductionMultiplier());
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
        
        // Increase efficiency by 10% (multiply by 1.1)
        gen2.cascadeEfficiency = currentEfficiency * 1.1;
        autoSave();
        updateCurrencyDisplay();
        
        // Refresh UI if on generator2 channel - update button states and reload for description changes
        if (currentServer === 'generator2' && currentChannel === 'general') {
            updateUpgradeButtonStates();
            // Also reload to update description with new percentage
            setTimeout(() => loadChannel('general'), 50);
        } else {
            updateUpgradeButtonStates();
        }
    }
}

// Purchase auto-buy for generator2
function purchaseGenerator2AutoBuy() {
    if (!isGeneratorUnlocked('generator2')) return;
    
    const gen2 = gameState.generators.generator2;
    if (!gen2 || gen2.autoBuyPurchased) return;
    
    const cost = 50000; // 10x generator1's auto-buy cost
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
        
        gen2.autoBuyPurchased = true;
        gen2.autoBuy = true; // Enable by default when purchased
        autoSave();
        updateCurrencyDisplay();
        
        // Refresh UI if on generator2 channel to show toggle button
        if (currentServer === 'generator2' && currentChannel === 'general') {
            loadChannel('general');
        } else {
            updateUpgradeButtonStates();
        }
    }
}

// Toggle auto-buy for generator2
function toggleGenerator2AutoBuy() {
    if (!isGeneratorUnlocked('generator2')) return;
    
    const gen2 = gameState.generators.generator2;
    if (!gen2) return;
    
    gen2.autoBuy = !gen2.autoBuy;
    autoSave();
    
    // Only refresh UI if on generator2 channel
    if (currentServer === 'generator2' && currentChannel === 'general') {
        // Update the toggle button text immediately
        const toggleBtn = document.getElementById('toggle-generator2-auto-buy');
        if (toggleBtn) {
            const buttonText = toggleBtn.querySelector('.upgrade-button-text');
            if (buttonText) {
                buttonText.textContent = gen2.autoBuy ? 'Disable Auto-Buy' : 'Enable Auto-Buy';
            }
        }
        
        // Update the status stat immediately
        const autoBuyStat = Array.from(document.querySelectorAll('.upgrade-stat')).find(stat => {
            const label = stat.querySelector('.stat-label')?.textContent;
            return label && label === 'Status:';
        });
        if (autoBuyStat) {
            const valueSpan = autoBuyStat.querySelector('.stat-value');
            if (valueSpan) {
                valueSpan.textContent = gen2.autoBuy ? 'Enabled' : 'Disabled';
            }
        }
        
        // Update all other button states
        updateUpgradeButtonStates();
    }
}

// Check if generator2 is all maxed (for prestige)
function isGenerator2AllMaxed() {
    if (!isGeneratorUnlocked('generator2')) return false;
    
    const gen2 = gameState.generators.generator2;
    if (!gen2) return false;
    
    const maxLevels = getGenerator2MaxLevels();
    
    // Check cascades
    if ((gen2.cascades || 0) < maxLevels.cascades) return false;
    
    // Check cascade efficiency
    const cascadeEfficiency = gen2.cascadeEfficiency || 0.1;
    const efficiencyLevel = Math.floor(Math.log(cascadeEfficiency / 0.1) / Math.log(1.1));
    if (efficiencyLevel < maxLevels.cascadeEfficiency) return false;
    
    // Check auto-buy delay
    if ((gen2.autoBuyDelayLevel || 0) < maxLevels.autoBuyDelay) return false;
    
    // Check auto-buy is purchased
    if (!gen2.autoBuyPurchased) return false;
    
    return true;
}

// Upgrade auto-buy delay for generator2
function upgradeGenerator2AutoBuyDelay() {
    if (!isGeneratorUnlocked('generator2')) return;
    
    const gen2 = gameState.generators.generator2;
    if (!gen2) return;
    
    // Check max level limit
    const autoBuyDelayLevel = gen2.autoBuyDelayLevel || 0;
    const maxLevels = getGenerator2MaxLevels();
    if (autoBuyDelayLevel >= maxLevels.autoBuyDelay) {
        return; // Already at max
    }
    
    const cost = Math.floor(getGenerator2AutoBuyDelayCost(autoBuyDelayLevel) * getCostReductionMultiplier());
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
        
        gen2.autoBuyDelayLevel = autoBuyDelayLevel + 1;
        autoSave();
        updateCurrencyDisplay();
        
        // Only refresh UI if on generator2 channel
        if (currentServer === 'generator2' && currentChannel === 'general') {
            // Force immediate update
            updateUpgradeButtonStates();
            
            // Also force update of level display directly
            const autoBuyDelayBtn = document.getElementById('upgrade-generator2-auto-buy-delay');
            if (autoBuyDelayBtn) {
                const delayLevelDisplay = autoBuyDelayBtn.closest('.upgrade-item')?.querySelector('.upgrade-level');
                if (delayLevelDisplay) {
                    const currentDelayLevel = gen2.autoBuyDelayLevel || 0;
                    const maxLevels = getGenerator2MaxLevels();
                    const isMaxLevel = currentDelayLevel >= maxLevels.autoBuyDelay;
                    delayLevelDisplay.textContent = isMaxLevel ? 'Max Level' : `Level ${currentDelayLevel}`;
                }
                
                // Update delay stat
                const delayStat = Array.from(document.querySelectorAll('.upgrade-stat')).find(stat => 
                    stat.querySelector('.stat-label')?.textContent === 'Current Delay:'
                );
                if (delayStat) {
                    const valueSpan = delayStat.querySelector('.stat-value');
                    if (valueSpan) {
                        const delay = getAutoBuyDelay(gen2.autoBuyDelayLevel || 0);
                        valueSpan.textContent = `${formatNumber(delay, 1)}s`;
                    }
                }
                
                // Update delay description
                const delayItem = autoBuyDelayBtn.closest('.upgrade-item');
                if (delayItem) {
                    const description = delayItem.querySelector('.upgrade-description');
                    if (description) {
                        const delay = getAutoBuyDelay(gen2.autoBuyDelayLevel || 0);
                        description.textContent = `Reduces the delay between auto-buy purchases. Current delay: ${formatNumber(delay, 1)}s`;
                    }
                }
            }
        }
    }
}

// Get efficiency upgrade cost
function getEfficiencyUpgradeCost(currentEfficiency) {
    // Each upgrade multiplies efficiency by 1.1 (compounding)
    // Calculate level from efficiency: efficiency = 1.0 * (1.1 ^ level)
    // level = log(efficiency / 1.0) / log(1.1)
    const level = Math.floor(Math.log(currentEfficiency / 1.0) / Math.log(1.1));
    return Math.floor(500 * Math.pow(1.2, level));
}

// Get bot speed upgrade cost
function getBotSpeedCost(currentLevel) {
    // Base cost 250, increases more slowly (1.2x per level)
    return Math.floor(250 * Math.pow(1.2, currentLevel));
}

// Get auto-buy delay (in seconds)
function getAutoBuyDelay(level) {
    // Starts at 5 seconds, reduces more slowly, minimum 0.1s
    // Formula: 5 * (0.85 ^ level), capped at 0.1
    return Math.max(0.1, 5 * Math.pow(0.85, level));
}

// Get max auto-buy delay level (when delay reaches 0.1s)
function getMaxAutoBuyDelayLevel() {
    // For Generator 1, use the max level from getGenerator1MaxLevels()
    if (currentServer === 'generator1') {
        return getGenerator1MaxLevels().autoBuyDelay;
    }
    // For other generators (future)
    return 21;
}

// Check if all Generator 1 upgrades are maxed (required for prestige)
function isGenerator1AllMaxed() {
    const gen = gameState.generators.generator1;
    if (!gen) return false;
    
    const maxLevels = getGenerator1MaxLevels();
    
    // Check bots
    if ((gen.bots || 0) < maxLevels.bots) return false;
    
    // Check efficiency
    const efficiencyLevel = Math.floor(Math.log((gen.efficiency || 1.0) / 1.0) / Math.log(1.1));
    if (efficiencyLevel < maxLevels.efficiency) return false;
    
    // Check bot speed
    if ((gen.botSpeed || 0) < maxLevels.botSpeed) return false;
    
    // Check auto-buy delay
    if ((gen.autoBuyDelayLevel || 0) < maxLevels.autoBuyDelay) return false;
    
    // Check auto-buy is purchased
    if (!gen.autoBuyPurchased) return false;
    
    return true;
}

// Calculate prestige cost for a generator
function getPrestigeCost(generatorId) {
    if (generatorId === 'generator1') {
        const baseCost = GENERATOR_COSTS.generator1; // 1000
        const prestigeLevel = gameState.generators.generator1?.prestigeLevel || 0;
        
        if (prestigeLevel === 0) {
            // First prestige: 100x unlock cost
            return baseCost * 100;
        } else {
            // Subsequent prestiges: 100x previous prestige cost
            // Previous cost = baseCost * (100 ^ prestigeLevel)
            // New cost = baseCost * (100 ^ (prestigeLevel + 1))
            return baseCost * Math.pow(100, prestigeLevel + 1);
        }
    } else if (generatorId === 'generator2') {
        const baseCost = GENERATOR_COSTS.generator2; // 10000
        const prestigeLevel = gameState.generators.generator2?.prestigeLevel || 0;
        
        if (prestigeLevel === 0) {
            // First prestige: 100x unlock cost
            return baseCost * 100;
        } else {
            // Subsequent prestiges: 100x previous prestige cost
            // Previous cost = baseCost * (100 ^ prestigeLevel)
            // New cost = baseCost * (100 ^ (prestigeLevel + 1))
            return baseCost * Math.pow(100, prestigeLevel + 1);
        }
    }
    return Infinity; // Other generators not implemented yet
}

// Prestige a generator
function prestigeGenerator(generatorId) {
    if (generatorId === 'generator1') {
        // Check if all upgrades are maxed
        if (!isGenerator1AllMaxed()) return false;
        
        const cost = getPrestigeCost('generator1');
        const totalMessages = gameState.messages + (gameState.fractionalMessages || 0);
        
        if (totalMessages < cost) return false;
        
        // Deduct cost
        if (gameState.fractionalMessages >= cost) {
            gameState.fractionalMessages -= cost;
        } else {
            const remaining = cost - gameState.fractionalMessages;
            gameState.fractionalMessages = 0;
            gameState.messages -= remaining;
        }
        
        const gen = gameState.generators.generator1;
        
        // Reset all upgrades
        gen.bots = 0;
        gen.efficiency = 1.0;
        gen.botSpeed = 0;
        gen.autoBuy = false;
        gen.autoBuyPurchased = false;
        gen.autoBuyDelayLevel = 0;
        
        // Increase prestige level (this automatically increases max levels via getGenerator1MaxLevels)
        gen.prestigeLevel = (gen.prestigeLevel || 0) + 1;
        
        autoSave();
        updateCurrencyDisplay();
        
        // Refresh UI if on generator1 general channel
        if (currentServer === 'generator1' && currentChannel === 'general') {
            loadChannel('general');
        }
        
        return true;
    } else if (generatorId === 'generator2') {
        // Check if all upgrades are maxed
        if (!isGenerator2AllMaxed()) return false;
        
        const cost = getPrestigeCost('generator2');
        const totalMessages = gameState.messages + (gameState.fractionalMessages || 0);
        
        if (totalMessages < cost) return false;
        
        // Deduct cost
        if (gameState.fractionalMessages >= cost) {
            gameState.fractionalMessages -= cost;
        } else {
            const remaining = cost - gameState.fractionalMessages;
            gameState.fractionalMessages = 0;
            gameState.messages -= remaining;
        }
        
        const gen2 = gameState.generators.generator2;
        
        // Reset all upgrades
        gen2.cascades = 0;
        gen2.cascadeEfficiency = 0.1;
        gen2.autoBuy = false;
        gen2.autoBuyPurchased = false;
        gen2.autoBuyDelayLevel = 0;
        
        // Increase prestige level (this automatically increases max levels via getGenerator2MaxLevels)
        gen2.prestigeLevel = (gen2.prestigeLevel || 0) + 1;
        
        autoSave();
        updateCurrencyDisplay();
        
        // Refresh UI if on generator2 general channel
        if (currentServer === 'generator2' && currentChannel === 'general') {
            loadChannel('general');
        }
        
        return true;
    }
    return false;
}

// Get auto-buy delay upgrade cost
function getAutoBuyDelayCost(currentLevel) {
    // Base cost 1000, increases more slowly (1.2x per level)
    return Math.floor(1000 * Math.pow(1.2, currentLevel));
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
    
    // Check max bot limit
    const currentBots = gen.bots || 0;
    const maxLevels = getGenerator1MaxLevels();
    if (generatorId === 'generator1' && currentBots >= maxLevels.bots) {
        return; // Already at max
    }
    
    // Calculate cost: if they have 1 bot (the free one), next bot costs 1000 (bot #0 cost)
    // Otherwise, use the normal cost scaling
    const costBots = currentBots === 1 ? 0 : currentBots;
    const cost = Math.floor(getBotCost(costBots) * getCostReductionMultiplier());
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
        
        gen.bots = currentBots + 1;
        autoSave();
        updateCurrencyDisplay();
        
        // Only refresh UI if on upgrades channel
        if (currentServer === 'generator1' && currentChannel === 'general') {
            updateUpgradeButtonStates();
        }
        // Otherwise, just update currency (no UI refresh needed)
    }
}

// Upgrade bot efficiency
function upgradeBotEfficiency(generatorId) {
    if (!isGeneratorUnlocked(generatorId)) return;
    
    const gen = gameState.generators[generatorId];
    if (!gen) return;
    
    // Check max level limit for Generator 1
    if (generatorId === 'generator1') {
        const currentEfficiency = gen.efficiency || 1.0;
        // Calculate level from efficiency: efficiency = 1.0 * (1.1 ^ level)
        const currentLevel = Math.floor(Math.log(currentEfficiency / 1.0) / Math.log(1.1));
        const maxLevels = getGenerator1MaxLevels();
        if (currentLevel >= maxLevels.efficiency) {
            return; // Already at max
        }
    }
    
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
        
        // Multiply efficiency by 1.1 (compounding: +10% of current value)
        gen.efficiency = (gen.efficiency || 1.0) * 1.1;
        autoSave();
        updateCurrencyDisplay();
        
        // Only refresh UI if on upgrades channel
        if (currentServer === 'generator1' && currentChannel === 'general') {
            updateUpgradeButtonStates();
        }
        // Otherwise, just update currency (no UI refresh needed)
    }
}

// Get manual generation multiplier
function getManualGenerationMultiplier() {
    const level = gameState.upgrades.manualGenerationMultiplier || 0;
    // Each level multiplies by 1.1 (compounding: 1.0, 1.1, 1.21, 1.331, ...)
    const baseMultiplier = Math.pow(1.1, level);
    // Apply research multiplier
    return baseMultiplier * getResearchManualMultiplier();
}

// Random usernames and avatars for fake messages
const FAKE_USERNAMES = [
    '@Alex_Player', '@SamGamer123', '@JordanX', '@Casey_Pro', '@RileyGaming', '@MorganYT', 
    '@TaylorStreams', '@Quinn_2024', '@AveryGamer', '@BlakePlays', '@Cameron_OG', '@DakotaPro', 
    '@EmeryGaming', '@FinleyYT', '@HarperStreams', '@Hayden_Player', '@IndigoGamer', '@JadenX', 
    '@KaiPlays', '@Logan_Pro', '@NovaGaming', '@PhoenixYT', '@Shadow_Player', '@StormGamer', 
    '@VortexPlays', '@Zephyr_Pro', '@EchoGaming', '@NeonYT', '@Crimson_Player', '@AzureGamer',
    '@RemagOfficial'
];
const FAKE_AVATARS = ['🤖', '💬', '⚡', '🎮', '🚀', '💻', '🔥', '⭐', '🌟', '✨', '🎯', '💡', '🎨', '🎵', '🎭', '🎪', '🏆', '🎲', '🎸', '🎺'];

// Generate random message text
function generateRandomMessage() {
    const messages = [
        'Hey everyone, how\'s it going?',
        'What are you all up to today?',
        'I\'ve been working on some new stuff, pretty excited about it',
        'Anyone else notice how fast things are moving lately?',
        'I think we should try a different approach to this',
        'That makes a lot of sense actually, thanks for explaining',
        'I\'m not sure I understand completely, can someone clarify?',
        'Has anyone tried doing it this way before?',
        'I\'ve been thinking about this for a while now',
        'What do you guys think about the recent changes?',
        'I\'m still figuring things out but it\'s getting better',
        'Anyone want to share their experience with this?',
        'I found something interesting earlier, might be worth checking out',
        'This is taking longer than I expected but we\'re making progress',
        'I wonder if there\'s a better way to handle this situation',
        'Thanks for the help earlier, really appreciate it',
        'I\'m going to try something different and see how it goes',
        'Has anyone else run into this issue before?',
        'I think we\'re on the right track with this approach',
        'Let me know if you need any help with that',
        'I\'m curious to see how this turns out',
        'That\'s a good point, I hadn\'t considered that',
        'I\'ll keep working on it and update you all later',
        'Anyone have suggestions for improving this?',
        'I\'m still learning but it\'s been fun so far',
        'What time are you all usually active?',
        'I\'ve been experimenting with different methods',
        'This community is really helpful, thanks everyone',
        'I might need to take a break soon but I\'ll be back',
        'Anyone want to collaborate on something?',
        'I\'m trying to understand the basics first before moving on',
        'That sounds like a solid plan to me',
        'I\'ll give it a shot and see what happens',
        'Has anyone made any interesting discoveries lately?',
        'I\'m always looking for ways to improve',
        'This is more complex than I initially thought',
        'I appreciate all the feedback, it\'s really helpful',
        'Let\'s see where this takes us',
        'I\'m open to trying new things if anyone has ideas',
        'This has been a learning experience for sure'
    ];
    return messages[Math.floor(Math.random() * messages.length)];
}

// Format timestamp (Discord style: HH:MM)
function formatMessageTime(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

// Create and add a fake message to the chat
function addFakeMessage() {
    const messagesContainer = document.getElementById('messages-container');
    if (!messagesContainer) return;
    
    const username = FAKE_USERNAMES[Math.floor(Math.random() * FAKE_USERNAMES.length)];
    const avatar = FAKE_AVATARS[Math.floor(Math.random() * FAKE_AVATARS.length)];
    const messageText = generateRandomMessage();
    const timestamp = formatMessageTime(new Date());
    
    const messageElement = document.createElement('div');
    messageElement.className = 'discord-message';
    messageElement.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-username">${username}</span>
                <span class="message-timestamp">${timestamp}</span>
            </div>
            <div class="message-text">${messageText}</div>
        </div>
    `;
    
    messagesContainer.appendChild(messageElement);
    
    // Scroll to bottom (with smooth scroll if user is near bottom)
    const isNearBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 100;
    if (isNearBottom) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

// Remove messages that have scrolled off screen
function removeOffScreenMessages(container) {
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const messages = Array.from(container.querySelectorAll('.discord-message'));
    
    messages.forEach(message => {
        const messageRect = message.getBoundingClientRect();
        // If message is above the visible area (with some buffer), remove it
        if (messageRect.bottom < containerRect.top - 100) {
            message.remove();
        }
    });
}

// Setup message container scrolling and cleanup
function setupMessagesContainer() {
    const messagesContainer = document.getElementById('messages-container');
    if (!messagesContainer) return;
    
    // Periodically remove off-screen messages
    const cleanupInterval = setInterval(() => {
        if (document.getElementById('messages-container') === messagesContainer) {
            removeOffScreenMessages(messagesContainer);
        } else {
            clearInterval(cleanupInterval);
        }
    }, 1000);
    
    // Also remove on scroll
    messagesContainer.addEventListener('scroll', () => {
        removeOffScreenMessages(messagesContainer);
    });
}

// Generate a message (used by both typing and clicking)
function generateMessage() {
    const manualMultiplier = getManualGenerationMultiplier();
    const globalMultiplier = getGlobalMessageMultiplier();
    const totalMultiplier = manualMultiplier * globalMultiplier;
    
    // Track manual generation event
    manualGenerationHistory.push(Date.now());
    
    // Track character count for fake messages (1 message per 10 characters)
    manualCharacterCount++;
    if (manualCharacterCount >= 10) {
        manualCharacterCount = 0;
        addFakeMessage();
    }
    
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
        const displayText = `+${formatNumber(totalMultiplier, 1)}`;
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
// Color preset definitions
const COLOR_PRESETS = {
    default: { bg: '#36393f', accent: '#5865f2' },
    green: { bg: '#2d3a2d', accent: '#57f287' },
    purple: { bg: '#3d2d3d', accent: '#eb459e' },
    red: { bg: '#3d2d2d', accent: '#ed4245' },
    orange: { bg: '#3d332d', accent: '#faa61a' },
    pink: { bg: '#3d2d35', accent: '#ff73fa' }
};

// Convert hex to RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

// Convert RGB to hex
function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    }).join("");
}

// Calculate luminance (brightness) of a color
function getLuminance(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return 0.5;
    // Relative luminance formula
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;
    const [rs, gs, bs] = [r, g, b].map(val => {
        return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Darken a color by a percentage
function darkenColor(hex, percent) {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    const factor = 1 - (percent / 100);
    return rgbToHex(
        Math.max(0, Math.floor(rgb.r * factor)),
        Math.max(0, Math.floor(rgb.g * factor)),
        Math.max(0, Math.floor(rgb.b * factor))
    );
}

// Lighten a color by a percentage
function lightenColor(hex, percent) {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    const factor = 1 + (percent / 100);
    return rgbToHex(
        Math.min(255, Math.floor(rgb.r * factor)),
        Math.min(255, Math.floor(rgb.g * factor)),
        Math.min(255, Math.floor(rgb.b * factor))
    );
}

// Apply colors to CSS variables
function applyColors() {
    const bgColor = gameState.settings.backgroundColor || '#36393f';
    const accentColor = gameState.settings.accentColor || '#5865f2';
    
    const root = document.documentElement;
    root.style.setProperty('--bg-color', bgColor);
    root.style.setProperty('--accent-color', accentColor);
    
    // Calculate darker/lighter tones from background
    root.style.setProperty('--bg-darker', darkenColor(bgColor, 30));
    root.style.setProperty('--bg-dark', darkenColor(bgColor, 15));
    root.style.setProperty('--bg-medium', darkenColor(bgColor, 20));
    root.style.setProperty('--bg-light', lightenColor(bgColor, 8));
    root.style.setProperty('--bg-lighter', lightenColor(bgColor, 12));
    
    // Adjust text color based on background brightness
    const bgLuminance = getLuminance(bgColor);
    // Use a lower threshold (0.4) to switch to dark text earlier for better contrast
    if (bgLuminance > 0.4) {
        // Light background - use dark text
        root.style.setProperty('--text-color', '#2c2f33');
        root.style.setProperty('--text-secondary', '#4f545c');
        root.style.setProperty('--text-muted', '#747f8d');
        root.style.setProperty('--text-bright', '#060607');
        root.style.setProperty('--upgrade-level-text', '#000000'); // Black on light backgrounds
        // For upgrade level badge on light backgrounds - use darker accent with more opacity
        const accentRgb = hexToRgb(accentColor);
        if (accentRgb) {
            const darkerAccent = {
                r: Math.max(0, accentRgb.r - 40),
                g: Math.max(0, accentRgb.g - 40),
                b: Math.max(0, accentRgb.b - 40)
            };
            // Convert to rgba for opacity
            root.style.setProperty('--accent-badge-bg', `rgba(${darkerAccent.r}, ${darkerAccent.g}, ${darkerAccent.b}, 0.2)`);
        } else {
            root.style.setProperty('--accent-badge-bg', 'rgba(0, 0, 0, 0.2)');
        }
    } else {
        // Dark background - use light text
        root.style.setProperty('--text-color', '#dcddde');
        root.style.setProperty('--text-secondary', '#b9bbbe');
        root.style.setProperty('--text-muted', '#8e9297');
        root.style.setProperty('--text-bright', '#ffffff');
        root.style.setProperty('--upgrade-level-text', '#ffffff'); // White on dark backgrounds
        // For upgrade level badge on dark backgrounds - use lighter accent with less opacity
        const accentRgb = hexToRgb(accentColor);
        if (accentRgb) {
            const lighterAccent = {
                r: Math.min(255, accentRgb.r + 30),
                g: Math.min(255, accentRgb.g + 30),
                b: Math.min(255, accentRgb.b + 30)
            };
            // Convert to rgba for opacity - only background, not text
            root.style.setProperty('--accent-badge-bg', `rgba(${lighterAccent.r}, ${lighterAccent.g}, ${lighterAccent.b}, 0.15)`);
        } else {
            root.style.setProperty('--accent-badge-bg', 'rgba(255, 255, 255, 0.15)');
        }
    }
}

function setupSettingsHandlers() {
    // Number format radio buttons
    const formatRadios = document.querySelectorAll('input[name="numberFormat"]');
    formatRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                gameState.settings.numberFormat = e.target.value;
                saveSettings();
                autoSave(); // Save full game state immediately
                updateCurrencyDisplay();
                // Update preview
                const preview = document.getElementById('format-preview');
                if (preview) {
                    preview.textContent = formatNumber(1567668);
                }
            }
        });
    });
    
    // Color pickers
    const bgColorPicker = document.getElementById('bg-color-picker');
    const bgColorText = document.getElementById('bg-color-text');
    const accentColorPicker = document.getElementById('accent-color-picker');
    const accentColorText = document.getElementById('accent-color-text');
    
    if (bgColorPicker && bgColorText) {
        bgColorPicker.addEventListener('input', (e) => {
            const color = e.target.value;
            bgColorText.value = color;
            gameState.settings.backgroundColor = color;
            applyColors();
            saveSettings();
            autoSave(); // Save full game state immediately
        });
        
        bgColorText.addEventListener('input', (e) => {
            const color = e.target.value;
            if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
                bgColorPicker.value = color;
                gameState.settings.backgroundColor = color;
                applyColors();
                saveSettings();
                autoSave(); // Save full game state immediately
            }
        });
    }
    
    if (accentColorPicker && accentColorText) {
        accentColorPicker.addEventListener('input', (e) => {
            const color = e.target.value;
            accentColorText.value = color;
            gameState.settings.accentColor = color;
            applyColors();
            saveSettings();
            autoSave(); // Save full game state immediately
        });
        
        accentColorText.addEventListener('input', (e) => {
            const color = e.target.value;
            if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
                accentColorPicker.value = color;
                gameState.settings.accentColor = color;
                applyColors();
                saveSettings();
                autoSave(); // Save full game state immediately
            }
        });
    }
    
    // Preset buttons
    const presetButtons = document.querySelectorAll('.preset-button');
    presetButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const preset = e.target.dataset.preset;
            if (COLOR_PRESETS[preset]) {
                const colors = COLOR_PRESETS[preset];
                gameState.settings.backgroundColor = colors.bg;
                gameState.settings.accentColor = colors.accent;
                
                if (bgColorPicker) bgColorPicker.value = colors.bg;
                if (bgColorText) bgColorText.value = colors.bg;
                if (accentColorPicker) accentColorPicker.value = colors.accent;
                if (accentColorText) accentColorText.value = colors.accent;
                
                applyColors();
                saveSettings();
                autoSave(); // Save full game state immediately
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
                                gameState.generators.generator1 = { bots: 0, efficiency: 1.0, botSpeed: 0, autoBuy: false, autoBuyPurchased: false, autoBuyDelayLevel: 0, prestigeLevel: 0 };
                            }
                            // Assign names to unlocked generators if they don't have one
                            ['generator1', 'generator2', 'generator3'].forEach(genId => {
                                if (isGeneratorUnlocked(genId)) {
                                    assignRandomServerName(genId);
                                }
                            });
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
                // Preserve settings (colors, number format, etc.)
                const preservedSettings = { ...gameState.settings };
                
                // Reset game state
                gameState.messages = 0;
                gameState.fractionalMessages = 0;
                gameState.lifetimeMessages = 0;
                gameState.playtime = 0;
                gameState.sessionStartTime = Date.now();
                
                // Restore preserved settings
                gameState.settings = preservedSettings;
                
                gameState.upgrades = {
                    manualGenerationMultiplier: 0,
                    autoGenerationBoost: 0,
                    messageMultiplier: 0,
                    costEfficiency: 0
                };
                gameState.generators = {
                    unlocked: [],
                    generator1: { bots: 0, efficiency: 1.0, botSpeed: 0, autoBuy: false, autoBuyPurchased: false, autoBuyDelayLevel: 0, prestigeLevel: 0 }
                };
                
                // Only remove gameState from localStorage, keep gameSettings
                localStorage.removeItem('gameState');
                
                // Save the reset game state (with preserved settings)
                autoSave();
                saveSettings();
                
                // Reapply colors in case they were changed
                applyColors();
                
                updateCurrencyDisplay();
                renderServerSidebar();
                alert('Game reset!');
                loadChannel(currentChannel);
            }
        });
    }
    
    // Debug: Add messages
    const debugAddMessagesBtn = document.getElementById('debug-add-messages');
    if (debugAddMessagesBtn) {
        debugAddMessagesBtn.addEventListener('click', () => {
            gameState.messages += 10000;
            autoSave();
            updateCurrencyDisplay();
            updateUpgradeButtonStates();
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
    
    // Check max level limit
    if (currentLevel >= GLOBAL_UPGRADE_MAX_LEVELS.manualGenerationMultiplier) {
        return; // Already at max
    }
    
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
        
        gameState.upgrades.manualGenerationMultiplier = currentLevel + 1;
        autoSave();
        updateCurrencyDisplay();
        
        // Reload the channel to update the UI
        loadChannel(currentChannel);
    }
}

// Purchase auto-generation boost
function purchaseAutoGenerationBoost() {
    const currentLevel = gameState.upgrades.autoGenerationBoost || 0;
    
    // Check max level limit
    if (currentLevel >= GLOBAL_UPGRADE_MAX_LEVELS.autoGenerationBoost) {
        return; // Already at max
    }
    
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
        
        gameState.upgrades.autoGenerationBoost = currentLevel + 1;
        autoSave();
        updateCurrencyDisplay();
        loadChannel(currentChannel);
    }
}

// Purchase message multiplier
function purchaseMessageMultiplier() {
    const currentLevel = gameState.upgrades.messageMultiplier || 0;
    
    // Check max level limit
    if (currentLevel >= GLOBAL_UPGRADE_MAX_LEVELS.messageMultiplier) {
        return; // Already at max
    }
    
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
        
        gameState.upgrades.messageMultiplier = currentLevel + 1;
        autoSave();
        updateCurrencyDisplay();
        loadChannel(currentChannel);
    }
}

// Purchase cost efficiency
function purchaseCostEfficiency() {
    const currentLevel = gameState.upgrades.costEfficiency || 0;
    
    // Check max level limit
    if (currentLevel >= GLOBAL_UPGRADE_MAX_LEVELS.costEfficiency) {
        return; // Already at max
    }
    
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
        
        gameState.upgrades.costEfficiency = currentLevel + 1;
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
    
    // Check max level limit for Generator 1
    const maxLevels = getGenerator1MaxLevels();
    if (generatorId === 'generator1' && currentLevel >= maxLevels.botSpeed) {
        return; // Already at max
    }
    
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
        
        gen.botSpeed = currentLevel + 1;
        autoSave();
        updateCurrencyDisplay();
        
        // Only refresh UI if on upgrades channel
        if (currentServer === 'generator1' && currentChannel === 'general') {
            updateUpgradeButtonStates();
        }
        // Otherwise, just update currency (no UI refresh needed)
    }
}

// Purchase auto-buy
function purchaseAutoBuy(generatorId) {
    if (!isGeneratorUnlocked(generatorId)) return;
    
    const gen = gameState.generators[generatorId];
    if (!gen || gen.autoBuyPurchased) return;
    
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
        
        gen.autoBuyPurchased = true;
        gen.autoBuy = true; // Enable by default when purchased
        autoSave();
        updateCurrencyDisplay();
        
        // Refresh UI if on upgrades channel to show toggle button
        if (currentServer === 'generator1' && currentChannel === 'general') {
            loadChannel('general');
        }
        // Otherwise, just update currency (no UI refresh needed)
    }
}

// Toggle auto-buy
function toggleAutoBuy(generatorId) {
    if (!isGeneratorUnlocked(generatorId)) return;
    
    const gen = gameState.generators[generatorId];
    if (!gen) return;
    
    gen.autoBuy = !gen.autoBuy;
    autoSave();
    
    // Only refresh UI if on a channel that displays bot stats
    if (currentServer === 'generator1' && currentChannel === 'general') {
        updateUpgradeButtonStates();
        }
    // Otherwise, just update currency (no UI refresh needed)
}

// Upgrade auto-buy delay
function upgradeAutoBuyDelay(generatorId) {
    if (!isGeneratorUnlocked(generatorId)) return;
    
    const gen = gameState.generators[generatorId];
    if (!gen) return;
    
    const currentLevel = gen.autoBuyDelayLevel || 0;
    
    // Check max level limit for Generator 1
    const maxLevels = getGenerator1MaxLevels();
    if (generatorId === 'generator1' && currentLevel >= maxLevels.autoBuyDelay) {
        return; // Already at max
    }
    
    const maxLevel = getMaxAutoBuyDelayLevel();
    
    // Don't allow upgrade if at max level
    if (currentLevel >= maxLevel) return;
    
    const cost = Math.floor(getAutoBuyDelayCost(currentLevel) * getCostReductionMultiplier());
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
        
        gen.autoBuyDelayLevel = (gen.autoBuyDelayLevel || 0) + 1;
        // Cap at max level
        if (gen.autoBuyDelayLevel > maxLevel) {
            gen.autoBuyDelayLevel = maxLevel;
        }
        autoSave();
        updateCurrencyDisplay();
        
        // Only refresh UI if on upgrades channel
        if (currentServer === 'generator1' && currentChannel === 'general') {
            updateUpgradeButtonStates();
        }
        // Otherwise, just update currency (no UI refresh needed)
    }
}

// Render changelog
function renderChangelog() {
    const container = document.getElementById('changelog-container');
    if (!container) return;
    
    // Helper function to format date as YYYY-MM-DD
    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    
    // Changelog data - add entries here in reverse chronological order (newest first)
    // Use new Date() to get the current date when the entry is created
    const changelog = [
        {
            version: 'beta 1.0.3',
            date: formatDate(new Date()), // Today's date
            changes: [
                'Added Generator 3: Research Lab (unlocks at 100,000 messages)',
                'Research Points: 1 point per 10,000 current messages',
                'Research Tree: Center node (Global Production Boost +100% to all sources for 10 RP) and 3 branches (Manual, Bot, Cascade Production +50% per level, max 5 levels)',
                'Research upgrades have aggressive scaling costs (10, 25, 50, 100, 200 RP)',
                'Research multipliers applied to all production calculations',
                'Implemented visual research tree with nodes and connecting lines',
                'Fixed research points display to update dynamically without page refresh',
                'Fixed research upgrade boost display to show only branch upgrade boost (excluding global boost)',
                'Removed research points from channel header (displayed in channel instead)',
                'Fixed research tree connection lines positioning'
            ]
        },
        {
            version: 'beta 1.0.2',
            date: formatDate(new Date()), // Today's date
            changes: [
                'Added server prestige system - reset generator upgrades to increase max levels by 10',
                'Added prestige level display to stats channel',
                'Generator servers now use random Discord-style names that persist across saves',
                'Fixed bug where resetting the game would also reset user settings',
                'Added Generator 2: Message Cascade system (unlocks at 10,000 messages)',
                'Generator 2 cascades cost 1 bot from Generator 1 + messages, generate 10% of Generator 1\'s base production',
                'Added upgrades for Generator 2: Cascade Efficiency, Auto-Buy Cascades, Auto-Buy Speed',
                'Generator 2 upgrades have 10x costs and max levels (50 cascades, 10 levels for efficiency/delay)',
                'Added prestige system for Generator 2, costing 100x unlock cost then 100x previous prestige cost'
            ]
        },
        {
            version: 'beta 1.0.1',
            date: formatDate(new Date()), // Today's date
            changes: [
                'Added Discord embed support for link sharing'
            ]
        },
        {
            version: 'beta 1.0.0',
            date: formatDate(new Date()), // Today's date
            changes: [
                'Initial release'
            ]
        }
    ];
    
    let html = '';
    changelog.forEach(entry => {
        html += `
            <div class="changelog-entry">
                <div class="changelog-header">
                    <h4 class="changelog-version">Version ${entry.version}</h4>
                    <span class="changelog-date">${entry.date}</span>
                </div>
                <ul class="changelog-changes">
                    ${entry.changes.map(change => `<li>${change}</li>`).join('')}
                </ul>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Initialize on page load
init();

