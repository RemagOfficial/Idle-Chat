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
let sessionMessages = []; // Store messages for manual generation channel (session only, not saved)
let lastPetPhotoFetchTime = 0; // Track last pet photo API call time for rate limiting
const PET_PHOTO_RATE_LIMIT_MS = 2000; // Minimum 2 seconds between pet photo API calls
const MAX_PET_PHOTOS = 10; // Maximum number of pet photos to store in gameState
const MAX_DISPLAYED_PET_PHOTOS = 20; // Maximum number of pet photos to display in the channel
// Suffixes: K, M, B, T, Qa, Qi, Sx, Sp, Oc, No, Dc, Ud, Dd, Td, Qad, Qid, Sxd, Spd, Ocd, Nod, Vg, Uvg, Dvg, Tvg, Qavg, Qivg, Sxvg, Spvg, Ocvg, Novg, Tg, Utg, Dtg, Ttg, Qatg, Qitg, Sxtg, Sptg, Octg, Notg, Qag, Uqag, Dqag, Tqag, Qaqag, Qiqag, Sxqag, Spqag, Ocqag, Noqag, Ssg, Ussg, Dssg, Tssg, Qassg, Qissg, Sxssg, Spssg, Ocssg, Nosg, Stg, Ustg, Dstg, Tstg, Qastg, Qistg, Sxstg, Spstg, Ocstg, Nostg, Otg, Uotg, Dotg, Totg, Qaotg, Qiotg, Sxotg, Spotg, Ocotg, Nootg, Ng, Ung, Dng, Tng, Qang, Qing, Sxng, Spng, Ocng, Nong, Ctg
const suffixes = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'Ud', 'Dd', 'Td', 'Qad', 'Qid', 'Sxd', 'Spd', 'Ocd', 'Nod', 'Vg', 'Uvg', 'Dvg', 'Tvg', 'Qavg', 'Qivg', 'Sxvg', 'Spvg', 'Ocvg', 'Novg', 'Tg', 'Utg', 'Dtg', 'Ttg', 'Qatg', 'Qitg', 'Sxtg', 'Sptg', 'Octg', 'Notg', 'Qag', 'Uqag', 'Dqag', 'Tqag', 'Qaqag', 'Qiqag', 'Sxqag', 'Spqag', 'Ocqag', 'Noqag', 'Ssg', 'Ussg', 'Dssg', 'Tssg', 'Qassg', 'Qissg', 'Sxssg', 'Spssg', 'Ocssg', 'Nosg', 'Stg', 'Ustg', 'Dstg', 'Tstg', 'Qastg', 'Qistg', 'Sxstg', 'Spstg', 'Ocstg', 'Nostg', 'Otg', 'Uotg', 'Dotg', 'Totg', 'Qaotg', 'Qiotg', 'Sxotg', 'Spotg', 'Ocotg', 'Nootg', 'Ng', 'Ung', 'Dng', 'Tng', 'Qang', 'Qing', 'Sxng', 'Spng', 'Ocng', 'Nong', 'Ctg'];
let channelMessages = {
    'generator1-off-topic': [],
    'generator2-tech': [],
    'generator3-science': []
}; // Store messages for generator channels (session only)
let channelMessageCounters = {
    'generator1-off-topic': 0, // Track messages generated for generator1
    'generator2-tech': 0, // Track messages generated for generator2
    'generator3-science': 0 // Not used for generator3 (uses timer instead)
}; // Track message generation counters
let channelMessageTimers = {
    'generator3-science': null
}; // Timer for generator3 science channel

// Bulk purchase amount (stored per session)
let bulkPurchaseAmount = 1;

// Game state
let gameState = {
    messages: 0n, // BigInt for message count
    fractionalMessages: 0, // Accumulated fractional messages (kept as number, always < 1)
    lifetimeMessages: 0n, // Total messages ever generated (including spent) - BigInt
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
        cascadeProduction: 0, // Cascade (generator2) production buff (max 5)
        petPhotosUnlocked: false, // Unlocks pet-photos channel (costs 25 research points, requires bot production maxed)
        offTopicUnlocked: false, // Unlocks off-topic channel (costs 25 research points, requires bot production maxed)
        techUnlocked: false, // Unlocks tech channel (costs 25 research points, requires cascade production maxed)
        scienceUnlocked: false // Unlocks science channel (costs 25 research points, requires manual production maxed)
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
    },
    dmCharacters: 0, // Characters typed in RemagOfficial DM
    dmRewardClaimed: false, // Whether the DM typing reward has been claimed
    dmMessageTimestamps: {
        message1: null, // Timestamp for first message
        message2: null, // Timestamp for second message
        rewardMessage: null // Timestamp for reward message (set when reaching 1000)
    },
    dmPings: {
        message1: false, // Ping for first message
        message2: false, // Ping for second message
        rewardMessage: false // Ping for reward message
    },
    generator1BotMessages: 0n, // Total messages generated by generator1 bots (for pet photo tracking) - BigInt
    petPhotos: [], // Array of pet photo messages: { username, avatar, petType, petName, imageUrl, timestamp }
    achievements: {} // Object to track unlocked achievements: { achievementId: true }
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
            manual: { name: 'Manual Generation', content: 'Manual generation content goes here' },
            stats: { name: 'Stats', content: 'Game statistics will be displayed here' },
            achievements: { name: 'Achievements', content: 'Game achievements and milestones' },
            remagofficial: { name: 'RemagOfficial', content: 'Direct message with RemagOfficial', isDM: true, avatar: '🐱' }
        }
    },
    generator1: {
        name: 'Auto-Typer Bot',
        locked: true,
        channels: {
            general: { name: 'general', content: 'Server upgrades and management' },
            'pet-photos': { name: 'pet-photos', content: 'Pet photos shared by users' },
            'off-topic': { name: 'off-topic', content: 'Off-topic discussions' }
        }
    },
    generator2: {
        name: 'Message Cascade',
        locked: true,
        channels: {
            general: { name: 'general', content: 'Cascade upgrades and management' },
            tech: { name: 'tech', content: 'Tech discussions' }
        }
    },
    generator3: {
        name: 'Research Lab',
        locked: true,
        channels: {
            research: { name: 'research-tree', content: 'Research upgrades and technology' },
            science: { name: 'science', content: 'Science discussions' }
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
            general: { name: 'General', content: 'General game settings' },
            changelog: { name: 'Changelog', content: 'Game changelog and updates' },
            about: { name: 'About', content: 'About the game' }
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

// Get ping count for a server (number of affordable upgrades, or null if no ping)
function getServerPingCount(serverId) {
    const totalMessages = getTotalMessagesAsNumber();
    
    // Locked generators: show "!" if they can be unlocked
    if (serverId === 'generator1' || serverId === 'generator2' || serverId === 'generator3') {
        if (!isGeneratorUnlocked(serverId)) {
            const unlockCost = GENERATOR_COSTS[serverId];
            if (totalMessages >= unlockCost) {
                return '!'; // Can be unlocked
            }
            return null; // Can't unlock yet
        }
    }
    
    // Unlocked generators: count affordable upgrades
    if (serverId === 'generator1') {
        const gen = gameState.generators.generator1 || { bots: 0, efficiency: 1.0, botSpeed: 0, autoBuyPurchased: false, autoBuyDelayLevel: 0 };
        const maxLevels = getGenerator1MaxLevels();
        let count = 0;
        
        // Check bots (skip if maxed, and only if we have at least 1 bot - the free one)
        if (gen.bots >= 1 && gen.bots < maxLevels.bots) {
            const costBots = gen.bots === 1 ? 0 : gen.bots;
            const botCost = Math.floor(getBotCost(costBots) * getCostReductionMultiplier());
            if (totalMessages >= botCost) count++;
        }
        
        // Check efficiency
        const currentEfficiency = gen.efficiency || 1.0;
        const efficiencyLevel = Math.floor(Math.log(currentEfficiency / 1.0) / Math.log(1.1));
        if (efficiencyLevel < maxLevels.efficiency) {
            const efficiencyCost = Math.floor(getEfficiencyUpgradeCost(currentEfficiency) * getCostReductionMultiplier());
            if (totalMessages >= efficiencyCost) count++;
        }
        
        // Check bot speed
        const botSpeedLevel = gen.botSpeed || 0;
        if (botSpeedLevel < maxLevels.botSpeed) {
            const botSpeedCost = Math.floor(getBotSpeedCost(botSpeedLevel) * getCostReductionMultiplier());
            if (totalMessages >= botSpeedCost) count++;
        }
        
        // Check auto-buy purchase (only if not purchased and can afford)
        if (gen.autoBuyPurchased !== true) {
            const autoBuyCost = 5000;
            if (totalMessages >= autoBuyCost) count++;
        }
        
        // Check auto-buy delay (only if auto-buy is purchased)
        if (gen.autoBuyPurchased === true) {
            const autoBuyDelayLevel = gen.autoBuyDelayLevel || 0;
            const maxDelayLevel = maxLevels.autoBuyDelay; // Use maxLevels from getGenerator1MaxLevels() instead of getMaxAutoBuyDelayLevel()
            if (autoBuyDelayLevel < maxDelayLevel) {
                const autoBuyDelayCost = Math.floor(getAutoBuyDelayCost(autoBuyDelayLevel) * getCostReductionMultiplier());
                if (totalMessages >= autoBuyDelayCost) count++;
            }
        }
        
        // Check prestige (only if all upgrades are maxed)
        if (isGenerator1AllMaxed()) {
            const prestigeCost = getPrestigeCost('generator1');
            if (totalMessages >= prestigeCost) count++;
        }
        
        return count > 0 ? count : null;
    }
    
    if (serverId === 'generator2') {
        // Only count if generator2 is unlocked
        if (!isGeneratorUnlocked('generator2')) {
            return null;
        }
        
        const gen2 = gameState.generators.generator2 || { cascades: 0, cascadeEfficiency: 0.1, autoBuyPurchased: false, autoBuyDelayLevel: 0 };
        const maxLevels = getGenerator2MaxLevels();
        let count = 0;
        
        // Check cascades (need 1 bot from generator1 and messages)
        if ((gen2.cascades || 0) < maxLevels.cascades) {
            const gen1 = gameState.generators.generator1 || { bots: 0 };
            const gen1Bots = gen1.bots || 0;
            const hasGen1Bot = gen1Bots >= 1;
            if (hasGen1Bot) {
                const cascadeCost = Math.floor(getCascadeCost(gen2.cascades || 0) * getCostReductionMultiplier());
                if (totalMessages >= cascadeCost) {
                    count++;
                }
            }
        }
        
        // Check cascade efficiency (always available, doesn't require cascades)
        const cascadeEfficiency = gen2.cascadeEfficiency || 0.1;
        const efficiencyLevel = Math.floor(Math.log(cascadeEfficiency / 0.1) / Math.log(1.1));
        if (efficiencyLevel < maxLevels.cascadeEfficiency) {
            const efficiencyCost = Math.floor(getCascadeEfficiencyUpgradeCost(cascadeEfficiency) * getCostReductionMultiplier());
            if (totalMessages >= efficiencyCost) {
                count++;
            }
        }
        
        // Check auto-buy purchase
        if (gen2.autoBuyPurchased !== true) {
            const autoBuyCost = 50000;
            if (totalMessages >= autoBuyCost) {
                count++;
            }
        }
        
        // Check auto-buy delay (available even before auto-buy is purchased)
        const autoBuyDelayLevel = gen2.autoBuyDelayLevel || 0;
        if (autoBuyDelayLevel < maxLevels.autoBuyDelay) {
            const autoBuyDelayCost = Math.floor(getGenerator2AutoBuyDelayCost(autoBuyDelayLevel) * getCostReductionMultiplier());
            if (totalMessages >= autoBuyDelayCost) {
                count++;
            }
        }
        
        // Check prestige (only if all upgrades are maxed)
        if (isGenerator2AllMaxed()) {
            const prestigeCost = getPrestigeCost('generator2');
            if (totalMessages >= prestigeCost) {
                count++;
            }
        }
        
        return count > 0 ? count : null;
    }
    
    if (serverId === 'generator3') {
        if (!isGeneratorUnlocked('generator3')) return null;
        
        const researchPoints = getResearchPoints();
        const research = gameState.research || { globalBoostPurchased: false, manualProduction: 0, botProduction: 0, cascadeProduction: 0, petPhotosUnlocked: false, offTopicUnlocked: false, techUnlocked: false, scienceUnlocked: false };
        let count = 0;
        
        // Check global boost
        if (!research.globalBoostPurchased) {
            const globalBoostCost = 10;
            if (researchPoints >= globalBoostCost) count++;
        }
        
        // Check manual production (requires global boost)
        if (research.globalBoostPurchased) {
            const manualLevel = research.manualProduction || 0;
            if (manualLevel < 5) {
                const manualCost = getResearchUpgradeCost(manualLevel);
                if (researchPoints >= manualCost) count++;
            }
            
            // Check bot production
            const botLevel = research.botProduction || 0;
            if (botLevel < 5) {
                const botCost = getResearchUpgradeCost(botLevel);
                if (researchPoints >= botCost) count++;
            }
            
            // Check cascade production
            const cascadeLevel = research.cascadeProduction || 0;
            if (cascadeLevel < 5) {
                const cascadeCost = getResearchUpgradeCost(cascadeLevel);
                if (researchPoints >= cascadeCost) count++;
            }
            
            // Check Pet Photos unlock (requires max bot production)
            const isMaxBot = (research.botProduction || 0) >= 5;
            if (isMaxBot && !research.petPhotosUnlocked) {
                const petPhotosCost = 25;
                if (researchPoints >= petPhotosCost) count++;
            }
            
            // Check Off-Topic unlock (requires pet photos unlocked)
            if (research.petPhotosUnlocked && !research.offTopicUnlocked) {
                const offTopicCost = 25;
                if (researchPoints >= offTopicCost) count++;
            }
            
            // Check Tech unlock (requires max cascade production)
            const isMaxCascade = (research.cascadeProduction || 0) >= 5;
            if (isMaxCascade && !research.techUnlocked) {
                const techCost = 25;
                if (researchPoints >= techCost) count++;
            }
        }
        
        // Check Science unlock (requires max manual production)
        const isMaxManual = (research.manualProduction || 0) >= 5;
        if (isMaxManual && !research.scienceUnlocked) {
            const scienceCost = 25;
            if (researchPoints >= scienceCost) count++;
        }
        
        return count > 0 ? count : null;
    }
    
    // Global upgrades server
    if (serverId === 'upgrades') {
        let count = 0;
        const upgrades = gameState.upgrades || {};
        
        // Manual generation multiplier (max 25)
        const manualMultLevel = upgrades.manualGenerationMultiplier || 0;
        if (manualMultLevel < 25) {
            const cost = Math.floor(getManualGenerationUpgradeCost(manualMultLevel) * getCostReductionMultiplier());
            if (totalMessages >= cost) count++;
        }
        
        // Message multiplier (max 10)
        const messageMultLevel = upgrades.messageMultiplier || 0;
        if (messageMultLevel < 10) {
            const cost = Math.floor(getMessageMultiplierCost(messageMultLevel) * getCostReductionMultiplier());
            if (totalMessages >= cost) count++;
        }
        
        // Auto-generation boost (max 10)
        const autoGenBoostLevel = upgrades.autoGenerationBoost || 0;
        if (autoGenBoostLevel < 10) {
            const cost = Math.floor(getAutoGenerationBoostCost(autoGenBoostLevel) * getCostReductionMultiplier());
            if (totalMessages >= cost) count++;
        }
        
        // Cost efficiency (max 10)
        const costEfficiencyLevel = upgrades.costEfficiency || 0;
        if (costEfficiencyLevel < 10) {
            const cost = Math.floor(getCostEfficiencyCost(costEfficiencyLevel) * getCostReductionMultiplier());
            if (totalMessages >= cost) count++;
        }
        
        return count > 0 ? count : null;
    }
    
    // Home server: check for DM pings
    if (serverId === 'home') {
        const dmPings = gameState.dmPings || { message1: false, message2: false, rewardMessage: false };
        let count = 0;
        if (dmPings.message1) count++;
        if (dmPings.message2) count++;
        if (dmPings.rewardMessage) count++;
        return count > 0 ? count : null;
    }
    
    // Settings don't have pings
    return null;
}

// Update all server ping badges
function updateServerPings() {
    const serverIcons = document.querySelectorAll('.server-icon');
    serverIcons.forEach(icon => {
        const serverId = icon.dataset.server;
        if (!serverId) return;
        
        const pingCount = getServerPingCount(serverId);
        let pingBadge = icon.querySelector('.server-ping');
        
        if (pingCount) {
            if (!pingBadge) {
                pingBadge = document.createElement('div');
                pingBadge.className = 'server-ping';
                icon.appendChild(pingBadge);
            }
            pingBadge.textContent = pingCount;
        } else {
            if (pingBadge) {
                pingBadge.remove();
            }
        }
    });
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
    
    // Update pings after rendering
    updateServerPings();
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
    const totalMessages = getTotalMessagesAsNumber();
    
    if (totalMessages >= cost) {
        // Deduct cost
        if (gameState.fractionalMessages >= cost) {
            gameState.fractionalMessages -= cost;
        } else {
            const remaining = cost - gameState.fractionalMessages;
            gameState.fractionalMessages = 0;
            gameState.messages = gameState.messages - BigInt(Math.ceil(remaining));
        }
        
        // Unlock generator
        gameState.generators.unlocked.push(generatorId);
        
        // Check achievements
        checkAchievements();
        
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
                        cascadeProduction: 0,
                        petPhotosUnlocked: false,
                        offTopicUnlocked: false,
                        techUnlocked: false,
                        scienceUnlocked: false
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
    let multiplier = Math.pow(1.05, multiplierLevel);
    
    // Apply DM reward boost (+15% = 1.15x)
    if (gameState.dmRewardClaimed) {
        multiplier *= 1.15;
    }
    
    return multiplier;
}

// Get cost reduction multiplier
function getCostReductionMultiplier() {
    const efficiencyLevel = gameState.upgrades.costEfficiency || 0;
    const reduction = Math.min(efficiencyLevel * 0.05, 0.5); // -5% per level, max 50%
    return 1.0 - reduction;
}

// Get current research points (based on current messages)
function getResearchPoints() {
    const totalMessages = getTotalMessagesAsNumber();
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
        const totalMessages = getTotalMessagesAsNumber();
        
        if (totalMessages >= messageCost) {
            // Deduct messages
            if (gameState.fractionalMessages >= messageCost) {
                gameState.fractionalMessages -= messageCost;
            } else {
                const remaining = messageCost - gameState.fractionalMessages;
                gameState.fractionalMessages = 0;
                gameState.messages = gameState.messages - BigInt(Math.ceil(remaining));
            }
            
            // Ensure research object exists
            if (!gameState.research) {
                gameState.research = { globalBoostPurchased: false, manualProduction: 0, botProduction: 0, cascadeProduction: 0, petPhotosUnlocked: false, offTopicUnlocked: false, techUnlocked: false, scienceUnlocked: false };
            }
            
            gameState.research.globalBoostPurchased = true;
            checkAchievements();
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
        gameState.research = { globalBoostPurchased: false, manualProduction: 0, botProduction: 0, cascadeProduction: 0, petPhotosUnlocked: false, offTopicUnlocked: false, techUnlocked: false, scienceUnlocked: false };
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
        const totalMessages = getTotalMessagesAsNumber();
        
        if (totalMessages >= messageCost) {
            // Deduct messages
            if (gameState.fractionalMessages >= messageCost) {
                gameState.fractionalMessages -= messageCost;
            } else {
                const remaining = messageCost - gameState.fractionalMessages;
                gameState.fractionalMessages = 0;
                gameState.messages = gameState.messages - BigInt(Math.ceil(remaining));
            }
            
            // Upgrade
            gameState.research[propertyName] = currentLevel + 1;
            checkAchievements();
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
    
    // Initialize achievements if not exists
    if (!gameState.achievements) {
        gameState.achievements = {};
    }
    
    // Check achievements on load
    checkAchievements();
    
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
    let lastPingUpdate = 0; // Track last ping update
    let lastAutoBuyTime = 0; // Track last auto-buy purchase time (generator1)
    let lastGenerator2AutoBuyTime = 0; // Track last auto-buy purchase time (generator2)
    
    // Passive generation loop (runs 10 times per second for smooth updates)
    setInterval(() => {
        // Update playtime based on actual elapsed time
        const currentTime = Date.now();
        const elapsed = currentTime - lastPlaytimeUpdate;
        const previousPlaytime = gameState.playtime || 0;
        gameState.playtime = previousPlaytime + elapsed;
        lastPlaytimeUpdate = currentTime;
        
        // Check if first DM message should appear (10 minutes playtime)
        const tenMinutes = 10 * 60 * 1000; // 10 minutes in milliseconds
        const justReachedTenMinutes = previousPlaytime < tenMinutes && gameState.playtime >= tenMinutes;
        if (justReachedTenMinutes) {
            // Initialize timestamps if needed
            if (!gameState.dmMessageTimestamps) {
                gameState.dmMessageTimestamps = {
                    message1: null,
                    message2: null,
                    rewardMessage: null
                };
            }
            // Set first message timestamp
            if (!gameState.dmMessageTimestamps.message1) {
                gameState.dmMessageTimestamps.message1 = currentTime;
                // Set ping if channel is not currently open
                if (!(currentServer === 'home' && currentChannel === 'remagofficial')) {
                    if (!gameState.dmPings) {
                        gameState.dmPings = { message1: false, message2: false, rewardMessage: false };
                    }
                    gameState.dmPings.message1 = true;
                    updateServerPings();
                    // Reload server to show channel and update channel list ping
                    if (currentServer === 'home') {
                        loadServer('home');
                    }
                }
                autoSave();
            }
        }
        
        let totalProduction = 0;
        let generator1Production = 0;
        const research = gameState.research || {};
        
        // Calculate production from all unlocked generators
        const generatorOrder = ['generator1', 'generator2', 'generator3'];
        for (const genId of generatorOrder) {
            if (isGeneratorUnlocked(genId)) {
                const production = getGeneratorProduction(genId);
                totalProduction += production;
                // Track generator1 production separately for pet photo tracking
                if (genId === 'generator1') {
                    generator1Production = production;
                }
            }
        }
        
        // Apply global message multiplier to production
        const globalMultiplier = getGlobalMessageMultiplier();
        totalProduction *= globalMultiplier;
        generator1Production *= globalMultiplier; // Also apply to generator1 for tracking
        
        // Add production (divided by 10 since we run 10 times per second)
        if (totalProduction > 0) {
            gameState.fractionalMessages = (gameState.fractionalMessages || 0) + (totalProduction / 10);
            
            // Convert whole parts to messages
            const wholePart = Math.floor(gameState.fractionalMessages);
            if (wholePart > 0) {
                gameState.messages = gameState.messages + BigInt(wholePart);
                gameState.lifetimeMessages = (gameState.lifetimeMessages || 0n) + BigInt(wholePart);
                gameState.fractionalMessages -= wholePart;
                
                // Check achievements when messages are generated
                checkAchievements();
            }
        }
        
        // Track generator1 bot messages for pet photos (divided by 10 since we run 10 times per second)
        if (generator1Production > 0 && isGeneratorUnlocked('generator1')) {
            if (!gameState.generator1BotMessages) {
                gameState.generator1BotMessages = 0n;
            }
            if (!gameState.generator1BotMessagesFractional) {
                gameState.generator1BotMessagesFractional = 0;
            }
            
            gameState.generator1BotMessagesFractional = (gameState.generator1BotMessagesFractional || 0) + (generator1Production / 10);
            
            // Convert whole parts to generator1 messages
            const gen1WholePart = Math.floor(gameState.generator1BotMessagesFractional);
            if (gen1WholePart > 0) {
                const previousCount = gameState.generator1BotMessages || 0n;
                gameState.generator1BotMessages = previousCount + BigInt(gen1WholePart);
                gameState.generator1BotMessagesFractional -= gen1WholePart;
                
                // Check if we've hit a multiple of 100 for pet photos
                // Only fetch if the pet-photos channel is currently open
                const previousHundreds = Number(previousCount) / 100;
                const currentHundreds = Number(gameState.generator1BotMessages) / 100;
                if (currentHundreds > previousHundreds && currentServer === 'generator1' && currentChannel === 'pet-photos') {
                    // Trigger pet photo message only if channel is open
                    addPetPhotoMessage();
                }
            }
        }
        
        // Generate messages for generator1 off-topic channel: 1 message per 1000 messages generated
        // Only generate if the channel is currently open and unlocked
        if (isGeneratorUnlocked('generator1') && research.offTopicUnlocked && currentServer === 'generator1' && currentChannel === 'off-topic') {
            const gen1Production = getGeneratorProduction('generator1') * getGlobalMessageMultiplier();
            if (gen1Production > 0) {
                // Track fractional messages for generator1
                if (!channelMessageCounters['generator1-off-topic']) {
                    channelMessageCounters['generator1-off-topic'] = 0;
                }
                if (!channelMessageCounters['generator1-off-topic-fractional']) {
                    channelMessageCounters['generator1-off-topic-fractional'] = 0;
                }
                
                channelMessageCounters['generator1-off-topic-fractional'] += (gen1Production / 10); // Divided by 10 since we run 10 times per second
                
                const wholePart = Math.floor(channelMessageCounters['generator1-off-topic-fractional']);
                if (wholePart > 0) {
                    const previousCount = channelMessageCounters['generator1-off-topic'] || 0;
                    channelMessageCounters['generator1-off-topic'] = previousCount + wholePart;
                    channelMessageCounters['generator1-off-topic-fractional'] -= wholePart;
                    
                    // Check if we've hit a multiple of 1000
                    const previousThousands = Math.floor(previousCount / 1000);
                    const currentThousands = Math.floor(channelMessageCounters['generator1-off-topic'] / 1000);
                    if (currentThousands > previousThousands) {
                        addGeneratorChannelMessage('generator1', 'off-topic');
                    }
                }
            }
        }
        
        // Generate messages for generator2 tech channel: 1 message per 1000 messages generated
        if (isGeneratorUnlocked('generator2') && research.techUnlocked && currentServer === 'generator2' && currentChannel === 'tech') {
            const gen2Production = getGeneratorProduction('generator2') * getGlobalMessageMultiplier();
            if (gen2Production > 0) {
                if (!channelMessageCounters['generator2-tech']) {
                    channelMessageCounters['generator2-tech'] = 0;
                }
                if (!channelMessageCounters['generator2-tech-fractional']) {
                    channelMessageCounters['generator2-tech-fractional'] = 0;
                }
                
                channelMessageCounters['generator2-tech-fractional'] += (gen2Production / 10);
                
                const wholePart = Math.floor(channelMessageCounters['generator2-tech-fractional']);
                if (wholePart > 0) {
                    const previousCount = channelMessageCounters['generator2-tech'] || 0;
                    channelMessageCounters['generator2-tech'] = previousCount + wholePart;
                    channelMessageCounters['generator2-tech-fractional'] -= wholePart;
                    
                    // Check if we've hit a multiple of 1000
                    const previousThousands = Math.floor(previousCount / 1000);
                    const currentThousands = Math.floor(channelMessageCounters['generator2-tech'] / 1000);
                    if (currentThousands > previousThousands) {
                        addGeneratorChannelMessage('generator2', 'tech');
                    }
                }
            }
        }
        
        // Generate messages for generator3 science channel: 1 message per second per research upgrade
        if (isGeneratorUnlocked('generator3') && research.scienceUnlocked && currentServer === 'generator3' && currentChannel === 'science') {
            const researchUpgradeCount = (research.manualProduction || 0) + (research.botProduction || 0) + (research.cascadeProduction || 0) + (research.globalBoostPurchased ? 1 : 0) + (research.petPhotosUnlocked ? 1 : 0) + (research.offTopicUnlocked ? 1 : 0) + (research.techUnlocked ? 1 : 0) + (research.scienceUnlocked ? 1 : 0);
            
            if (researchUpgradeCount > 0) {
                // Use timer: 1 message per second per upgrade
                const messageInterval = 1000 / researchUpgradeCount; // Interval in ms
                
                // Only update timer if upgrade count changed or timer doesn't exist
                if (!channelMessageTimers['generator3-science'] || channelMessageTimers['generator3-science-upgrade-count'] !== researchUpgradeCount) {
                    if (channelMessageTimers['generator3-science']) {
                        clearInterval(channelMessageTimers['generator3-science']);
                    }
                    channelMessageTimers['generator3-science'] = setInterval(() => {
                        if (currentServer === 'generator3' && currentChannel === 'science') {
                            addGeneratorChannelMessage('generator3', 'science');
                        }
                    }, messageInterval);
                    channelMessageTimers['generator3-science-upgrade-count'] = researchUpgradeCount;
                }
            } else {
                // Clear timer if no upgrades
                if (channelMessageTimers['generator3-science']) {
                    clearInterval(channelMessageTimers['generator3-science']);
                    channelMessageTimers['generator3-science'] = null;
                    delete channelMessageTimers['generator3-science-upgrade-count'];
                }
            }
        } else {
            // Clear timer if channel is not open
            if (channelMessageTimers['generator3-science']) {
                clearInterval(channelMessageTimers['generator3-science']);
                channelMessageTimers['generator3-science'] = null;
                delete channelMessageTimers['generator3-science-upgrade-count'];
            }
        }
        
        // Auto-buy bots if enabled (with delay)
        if (isGeneratorUnlocked('generator1')) {
            const gen = gameState.generators.generator1;
            if (gen && gen.autoBuy) {
                const totalMessages = getTotalMessagesAsNumber();
                const botCost = Math.floor(getBotCost(gen.bots || 0) * getCostReductionMultiplier());
                const delay = getAutoBuyDelay(gen.autoBuyDelayLevel || 0);
                const now = Date.now();
                
                if (totalMessages >= botCost && (now - lastAutoBuyTime) >= (delay * 1000)) {
                    purchaseBot('generator1');
                    lastAutoBuyTime = now;
                }
            }
        }
        
        // Auto-buy cascades if enabled (with delay)
        if (isGeneratorUnlocked('generator2')) {
            const gen2 = gameState.generators.generator2;
            if (gen2 && gen2.autoBuy) {
                const gen1 = gameState.generators.generator1;
                const totalMessages = getTotalMessagesAsNumber();
                const maxLevels = getGenerator2MaxLevels();
                const currentCascades = gen2.cascades || 0;
                const gen1Bots = gen1 ? (gen1.bots || 0) : 0;
                const hasGen1Bot = gen1Bots >= 1;
                const delay = getAutoBuyDelay(gen2.autoBuyDelayLevel || 0);
                const now = Date.now();
                
                if (currentCascades < maxLevels.cascades && hasGen1Bot && (now - lastGenerator2AutoBuyTime) >= (delay * 1000)) {
                    const cascadeCost = Math.floor(getCascadeCost(currentCascades) * getCostReductionMultiplier());
                    if (totalMessages >= cascadeCost) {
                        purchaseCascade();
                        lastGenerator2AutoBuyTime = now;
                    }
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
        const now = Date.now();
        if (isUpgradeChannel) {
            if (!lastUpgradeUIUpdate || now - lastUpgradeUIUpdate > 500) {
                lastUpgradeUIUpdate = now;
                updateUpgradeButtonStates();
            }
        }
        
        // Update server pings periodically (every 500ms)
        if (!lastPingUpdate || now - lastPingUpdate > 500) {
            lastPingUpdate = now;
            updateServerPings();
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
    const totalMessages = getTotalMessagesAsNumber();
    
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
                // Calculate bulk cost: if they have 1 bot (the free one), next bot costs 1000 (bot #0 cost)
                const costBots = currentBots === 1 ? 0 : currentBots;
                const actualCount = Math.min(bulkPurchaseAmount, maxLevels.bots - currentBots);
                const botCost = getBulkBotCost(costBots, bulkPurchaseAmount, maxLevels.bots);
                const canAfford = totalMessages >= botCost;
                buyBotBtn.disabled = !canAfford;
                buyBotBtn.classList.toggle('disabled', !canAfford);
                const costSpan = buyBotBtn.querySelector('.upgrade-button-cost');
                const textSpan = buyBotBtn.querySelector('.upgrade-button-text');
                if (costSpan) costSpan.textContent = `${formatNumber(botCost, 2)} Messages`;
                if (textSpan) textSpan.textContent = `Purchase ${actualCount > 1 ? actualCount : ''} Bot${actualCount > 1 ? 's' : ''}`;
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
                const actualCount = Math.min(bulkPurchaseAmount, maxLevels.efficiency - currentLevel);
                const efficiencyCost = getBulkEfficiencyCost(currentEfficiency, bulkPurchaseAmount, maxLevels.efficiency);
                const canAfford = totalMessages >= efficiencyCost;
                efficiencyBtn.disabled = !canAfford;
                efficiencyBtn.classList.toggle('disabled', !canAfford);
                const costSpan = efficiencyBtn.querySelector('.upgrade-button-cost');
                const textSpan = efficiencyBtn.querySelector('.upgrade-button-text');
                if (costSpan) costSpan.textContent = `${formatNumber(efficiencyCost, 2)} Messages`;
                if (textSpan) textSpan.textContent = `Upgrade Efficiency ${actualCount > 1 ? `x${actualCount}` : ''}`;
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
                const actualCount = Math.min(bulkPurchaseAmount, maxLevels.botSpeed - currentLevel);
                const botSpeedCost = getBulkBotSpeedCost(currentLevel, bulkPurchaseAmount, maxLevels.botSpeed);
                const canAfford = totalMessages >= botSpeedCost;
                botSpeedBtn.disabled = !canAfford;
                botSpeedBtn.classList.toggle('disabled', !canAfford);
                const costSpan = botSpeedBtn.querySelector('.upgrade-button-cost');
                const textSpan = botSpeedBtn.querySelector('.upgrade-button-text');
                if (costSpan) costSpan.textContent = `${formatNumber(botSpeedCost, 2)} Messages`;
                if (textSpan) textSpan.textContent = `Upgrade Bot Speed ${actualCount > 1 ? `x${actualCount}` : ''}`;
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
                const actualCount = Math.min(bulkPurchaseAmount, maxLevel - autoBuyDelayLevel);
                const autoBuyDelayCost = getBulkAutoBuyDelayCost(autoBuyDelayLevel, bulkPurchaseAmount, maxLevel);
                const canAfford = totalMessages >= autoBuyDelayCost;
                autoBuyDelayBtn.disabled = !canAfford;
                autoBuyDelayBtn.classList.toggle('disabled', !canAfford);
                const costSpan = autoBuyDelayBtn.querySelector('.upgrade-button-cost');
                const textSpan = autoBuyDelayBtn.querySelector('.upgrade-button-text');
                if (costSpan) costSpan.textContent = `${formatNumber(autoBuyDelayCost, 2)} Messages`;
                if (textSpan) textSpan.textContent = `Upgrade Auto-Buy Speed ${actualCount > 1 ? `x${actualCount}` : ''}`;
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
        const research = gameState.research || { globalBoostPurchased: false, manualProduction: 0, botProduction: 0, cascadeProduction: 0, petPhotosUnlocked: false, offTopicUnlocked: false, techUnlocked: false, scienceUnlocked: false };
        
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
                const actualCount = Math.min(bulkPurchaseAmount, GLOBAL_UPGRADE_MAX_LEVELS.manualGenerationMultiplier - multiplierLevel);
                const upgradeCost = getBulkManualGenerationUpgradeCost(multiplierLevel, bulkPurchaseAmount, GLOBAL_UPGRADE_MAX_LEVELS.manualGenerationMultiplier);
                const canAfford = totalMessages >= upgradeCost;
                manualMultiplierBtn.disabled = !canAfford;
                manualMultiplierBtn.classList.toggle('disabled', !canAfford);
                const costSpan = manualMultiplierBtn.querySelector('.upgrade-button-cost');
                const textSpan = manualMultiplierBtn.querySelector('.upgrade-button-text');
                if (costSpan) costSpan.textContent = `${formatNumber(upgradeCost, 2)} Messages`;
                if (textSpan) textSpan.textContent = `Purchase Upgrade ${actualCount > 1 ? `x${actualCount}` : ''}`;
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
                const actualCount = Math.min(bulkPurchaseAmount, GLOBAL_UPGRADE_MAX_LEVELS.autoGenerationBoost - autoBoostLevel);
                const autoBoostCost = getBulkAutoGenerationBoostCost(autoBoostLevel, bulkPurchaseAmount, GLOBAL_UPGRADE_MAX_LEVELS.autoGenerationBoost);
                const canAfford = totalMessages >= autoBoostCost;
                autoBoostBtn.disabled = !canAfford;
                autoBoostBtn.classList.toggle('disabled', !canAfford);
                const costSpan = autoBoostBtn.querySelector('.upgrade-button-cost');
                const textSpan = autoBoostBtn.querySelector('.upgrade-button-text');
                if (costSpan) costSpan.textContent = `${formatNumber(autoBoostCost, 2)} Messages`;
                if (textSpan) textSpan.textContent = `Purchase Upgrade ${actualCount > 1 ? `x${actualCount}` : ''}`;
            }
        }
        
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
                const actualCount = Math.min(bulkPurchaseAmount, GLOBAL_UPGRADE_MAX_LEVELS.messageMultiplier - messageMultiplierLevel);
                const messageMultiplierCost = getBulkMessageMultiplierCost(messageMultiplierLevel, bulkPurchaseAmount, GLOBAL_UPGRADE_MAX_LEVELS.messageMultiplier);
                const canAfford = totalMessages >= messageMultiplierCost;
                messageMultiplierBtn.disabled = !canAfford;
                messageMultiplierBtn.classList.toggle('disabled', !canAfford);
                const costSpan = messageMultiplierBtn.querySelector('.upgrade-button-cost');
                const textSpan = messageMultiplierBtn.querySelector('.upgrade-button-text');
                if (costSpan) costSpan.textContent = `${formatNumber(messageMultiplierCost, 2)} Messages`;
                if (textSpan) textSpan.textContent = `Purchase Upgrade ${actualCount > 1 ? `x${actualCount}` : ''}`;
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
                const actualCount = Math.min(bulkPurchaseAmount, GLOBAL_UPGRADE_MAX_LEVELS.costEfficiency - costEfficiencyLevel);
                const costEfficiencyCost = getBulkCostEfficiencyCost(costEfficiencyLevel, bulkPurchaseAmount, GLOBAL_UPGRADE_MAX_LEVELS.costEfficiency);
                const canAfford = totalMessages >= costEfficiencyCost;
                costEfficiencyBtn.disabled = !canAfford;
                costEfficiencyBtn.classList.toggle('disabled', !canAfford);
                const costSpan = costEfficiencyBtn.querySelector('.upgrade-button-cost');
                const textSpan = costEfficiencyBtn.querySelector('.upgrade-button-text');
                if (costSpan) costSpan.textContent = `${formatNumber(costEfficiencyCost, 2)} Messages`;
                if (textSpan) textSpan.textContent = `Purchase Upgrade ${actualCount > 1 ? `x${actualCount}` : ''}`;
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
                // Recalculate for non-max case using bulk costs
                const actualCount = Math.min(bulkPurchaseAmount, maxLevels.cascades - currentCascades, gen1Bots);
                const messageCost = getBulkCascadeCost(currentCascades, bulkPurchaseAmount, maxLevels.cascades);
                const canAfford = hasGen1Bot && totalMessages >= messageCost && gen1Bots >= actualCount;
                
                buyCascadeBtn.disabled = !canAfford;
                if (!canAfford) {
                    buyCascadeBtn.setAttribute('disabled', 'disabled');
                } else {
                    buyCascadeBtn.removeAttribute('disabled');
                }
                buyCascadeBtn.classList.toggle('disabled', !canAfford);
                
                const costSpan = buyCascadeBtn.querySelector('.upgrade-button-cost');
                const textSpan = buyCascadeBtn.querySelector('.upgrade-button-text');
                if (costSpan) {
                    if (!hasGen1Bot) {
                        costSpan.textContent = `Need 1 Bot from ${gen1ServerName}`;
                    } else {
                        costSpan.textContent = `${formatNumber(messageCost, 2)} Messages + ${actualCount} Bot${actualCount > 1 ? 's' : ''}`;
                    }
                }
                if (textSpan) textSpan.textContent = `Purchase ${actualCount > 1 ? actualCount : ''} Cascade${actualCount > 1 ? 's' : ''}`;
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
                const actualCount = Math.min(bulkPurchaseAmount, maxLevels.cascadeEfficiency - efficiencyLevel);
                const efficiencyCost = getBulkCascadeEfficiencyCost(cascadeEfficiency, bulkPurchaseAmount, maxLevels.cascadeEfficiency);
                const canAfford = totalMessages >= efficiencyCost;
                efficiencyBtn.disabled = !canAfford;
                if (!canAfford) {
                    efficiencyBtn.classList.add('disabled');
                } else {
                    efficiencyBtn.classList.remove('disabled');
                }
                const costSpan = efficiencyBtn.querySelector('.upgrade-button-cost');
                const textSpan = efficiencyBtn.querySelector('.upgrade-button-text');
                if (costSpan) costSpan.textContent = `${formatNumber(efficiencyCost, 2)} Messages`;
                if (textSpan) textSpan.textContent = `Upgrade Cascade Efficiency ${actualCount > 1 ? `x${actualCount}` : ''}`;
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
                const actualCount = Math.min(bulkPurchaseAmount, maxLevels.autoBuyDelay - autoBuyDelayLevel);
                const autoBuyDelayCost = getBulkGenerator2AutoBuyDelayCost(autoBuyDelayLevel, bulkPurchaseAmount, maxLevels.autoBuyDelay);
                const canAfford = totalMessages >= autoBuyDelayCost;
                autoBuyDelayBtn.disabled = !canAfford;
                if (!canAfford) {
                    autoBuyDelayBtn.setAttribute('disabled', 'disabled');
                } else {
                    autoBuyDelayBtn.removeAttribute('disabled');
                }
                autoBuyDelayBtn.classList.toggle('disabled', !canAfford);
                const costSpan = autoBuyDelayBtn.querySelector('.upgrade-button-cost');
                const textSpan = autoBuyDelayBtn.querySelector('.upgrade-button-text');
                if (costSpan) costSpan.textContent = `${formatNumber(autoBuyDelayCost, 2)} Messages`;
                if (textSpan) textSpan.textContent = `Upgrade Auto-Buy Speed ${actualCount > 1 ? `x${actualCount}` : ''}`;
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

// Helper function to get total messages (BigInt + fractional) as Number for calculations
// WARNING: This can lose precision or become Infinity for very large BigInt values
function getTotalMessagesAsNumber() {
    const bigIntValue = Number(gameState.messages);
    // If conversion results in Infinity, return a safe fallback
    if (!isFinite(bigIntValue)) {
        // Return a very large but finite number for comparison purposes
        return Number.MAX_SAFE_INTEGER;
    }
    return bigIntValue + (gameState.fractionalMessages || 0);
}

// Helper function to get total messages for display (returns BigInt for formatNumber)
function getTotalMessagesForDisplay() {
    // Return the BigInt part - formatNumber will handle it properly
    // Fractional part is always < 1, so we can ignore it for display
    return gameState.messages;
}

// Update currency display
function updateCurrencyDisplay() {
    const totalMessages = getTotalMessagesForDisplay(); // Use BigInt for display
    const msgPerSec = getTotalMessagesPerSecond();
    
    // Check achievements periodically (every 5 seconds)
    if (!updateCurrencyDisplay.lastAchievementCheck) {
        updateCurrencyDisplay.lastAchievementCheck = Date.now();
    }
    if (Date.now() - updateCurrencyDisplay.lastAchievementCheck > 5000) {
        checkAchievements();
        updateCurrencyDisplay.lastAchievementCheck = Date.now();
    }
    
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
        mobileCurrencyValue.textContent = formatNumber(getTotalMessagesForDisplay(), 2);
    }
    
    const mobileCurrencyRate = document.getElementById('mobile-currency-rate');
    if (mobileCurrencyRate) {
        mobileCurrencyRate.textContent = `${formatNumber(msgPerSec, 2)} msg/s`;
    }
}

const UNIT_PREFIXES = [
    'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No'
];
  
const GROUP_SUFFIXES = [
    '', 'Dc', 'Vg', 'Tg', 'Qag', 'Ssg', 'Stg', 'Otg', 'Ng', 'Ctg'
];
  
  function generateSuffix(tier) {
    if (tier === 0) return '';
  
    const group = Math.floor(tier / 10);
    const unit = tier % 10;
  
    const unitPart = UNIT_PREFIXES[unit] || '';
  
    const groupPart =
      group < GROUP_SUFFIXES.length
        ? GROUP_SUFFIXES[group]
        : generateSuffix(group) + 'g';
  
    return unitPart + groupPart;
  }

// Format number based on settings
function formatNumber(num, decimals = 0) {
    // Handle BigInt by converting to string for calculations
    const isBigInt = typeof num === 'bigint';
    // Don't convert BigInt to Number if it's too large (would become Infinity)
    // Try to convert and check if it becomes Infinity
    let numValue;
    if (isBigInt) {
        const converted = Number(num);
        numValue = isFinite(converted) ? converted : null;
    } else {
        numValue = num;
    }
    
    // Zero is always just "0"
    if ((!isBigInt && numValue === 0) || (isBigInt && num === 0n)) return '0';
    
    const format = gameState.settings.numberFormat;
    
    // Format with specified decimal places
    const formatWithDecimals = (value, dec) => {
        if (dec === 0) {
            return Math.floor(value).toString();
        }
        return value.toFixed(dec);
    };
    if (format === 'abbreviated') {
        // For BigInt, calculate order from string length to avoid precision loss
        let order;
        if (isBigInt) {
            const numStr = num.toString();
            const numDigits = numStr.length;
            order = Math.floor((numDigits - 1) / 3);
        } else {
            // Check if numValue is Infinity or too large (only for non-BigInt numbers)
            if (!isBigInt && (numValue === null || !isFinite(numValue))) {
                // For regular numbers that are Infinity, we can't format them properly
                // This shouldn't happen with BigInt, but if it does, return Infinity
                return 'Infinity';
            }
            if (numValue < 1000) return formatWithDecimals(numValue, decimals);
            order = Math.floor(Math.log10(numValue) / 3);
        }
        
        if (order >= suffixes.length) {
            // For numbers too large for abbreviated format, use scientific notation
            if (isBigInt) {
                const numStr = num.toString();
                if (numStr.length <= 1) return numStr;
                const firstDigit = numStr[0];
                const rest = numStr.substring(1, 3);
                const exponent = numStr.length - 1;
                const formattedExponent = exponent.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                return `${firstDigit}.${rest || '00'}e+${formattedExponent}`;
            }
            // Handle Infinity case (only for non-BigInt numbers)
            if (!isBigInt && (numValue === null || !isFinite(numValue))) {
                return 'Infinity';
            }
            // Format regular number scientific notation with comma-separated exponent
            const scientificStr = numValue.toExponential(2);
            // Extract the exponent part and add commas
            const parts = scientificStr.split('e');
            if (parts.length === 2) {
                const exponent = parts[1].replace(/[+-]/, '');
                const sign = parts[1][0] === '-' ? '-' : '+';
                const formattedExponent = exponent.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                return `${parts[0]}e${sign}${formattedExponent}`;
            }
            return scientificStr;
        }
        
        const suffixIndex = order;
        
        if (isBigInt) {
            // For BigInt, divide using BigInt operations to maintain precision
            if (suffixIndex === 0) {
                return num.toString();
            }
            
            const divisor = BigInt(1000) ** BigInt(suffixIndex);
            const quotient = num / divisor;
            const remainder = num % divisor;
            
            // Convert to decimal representation
            const quotientStr = quotient.toString();
            
            // Calculate decimal part (2 decimal places) by converting remainder to Number
            // This is safe because remainder < divisor, and divisor is at most 1000^suffixIndex
            // For very large numbers, we'll lose some precision in the decimal part, but that's acceptable
            const divisorNum = Number(divisor);
            const remainderNum = Number(remainder);
            const decimalValue = remainderNum / divisorNum;
            const decimalPart = decimalValue.toFixed(2).substring(1); // Get ".XX" part
            const value = quotientStr + decimalPart;
            
            return value.replace(/\.?0+$/, '') + suffixes[suffixIndex];
        } else {
            // Check if numValue is Infinity or too large (only for non-BigInt numbers)
            if (!isBigInt && (numValue === null || !isFinite(numValue))) {
                return 'Infinity';
            }
            if (numValue < 1000) return formatWithDecimals(numValue, decimals);
            const divisor = Math.pow(1000, suffixIndex);
            const value = numValue / divisor;
            return value.toFixed(2).replace(/\.?0+$/, '') + suffixes[suffixIndex];
        }
    } else if (format === 'scientific') {
        if (isBigInt) {
            // For BigInt scientific notation, convert to string and format
            const numStr = num.toString();
            if (numStr.length <= 1) return numStr;
            const firstDigit = numStr[0];
            const rest = numStr.substring(1, 3);
            const exponent = numStr.length - 1;
            const formattedExponent = exponent.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            return `${firstDigit}.${rest || '00'}e+${formattedExponent}`;
        }
        // For regular numbers that are Infinity, we can't format them
        if (!isFinite(numValue)) {
            return 'Infinity';
        }
        // Format regular number scientific notation with comma-separated exponent
        const scientificStr = numValue.toExponential(2);
        // Extract the exponent part and add commas
        const parts = scientificStr.split('e');
        if (parts.length === 2) {
            const exponent = parts[1].replace(/[+-]/, '');
            const sign = parts[1][0] === '-' ? '-' : '+';
            const formattedExponent = exponent.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            return `${parts[0]}e${sign}${formattedExponent}`;
        }
        return scientificStr;
    } else {
        // Full format with commas and decimals
        if (isBigInt) {
            const numStr = num.toString();
            const parts = numStr.split('.');
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            return parts.join('.');
        }
        // For regular numbers that are Infinity, we can't format them
        if (!isFinite(numValue)) {
            return 'Infinity';
        }
        const formatted = formatWithDecimals(numValue, decimals);
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
        // Hide DM channel until first message should appear (10 minutes playtime)
        if (serverId === 'home' && channelId === 'remagofficial') {
            const playtime = gameState.playtime || 0;
            const tenMinutes = 10 * 60 * 1000; // 10 minutes in milliseconds
            if (playtime < tenMinutes) {
                return; // Skip rendering this channel
            }
        }
        
        // Hide pet-photos channel until unlocked via research
        if (serverId === 'generator1' && channelId === 'pet-photos') {
            const research = gameState.research || {};
            if (!research.petPhotosUnlocked) {
                return; // Skip rendering this channel
            }
        }
        
        // Hide off-topic channel until unlocked via research
        if (serverId === 'generator1' && channelId === 'off-topic') {
            const research = gameState.research || {};
            if (!research.offTopicUnlocked) {
                return; // Skip rendering this channel
            }
        }
        
        // Hide tech channel until unlocked via research
        if (serverId === 'generator2' && channelId === 'tech') {
            const research = gameState.research || {};
            if (!research.techUnlocked) {
                return; // Skip rendering this channel
            }
        }
        
        // Hide science channel until unlocked via research
        if (serverId === 'generator3' && channelId === 'science') {
            const research = gameState.research || {};
            if (!research.scienceUnlocked) {
                return; // Skip rendering this channel
            }
        }
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
        
        // Only add hash icon for non-home servers
        if (!isHomeServer) {
            const hash = document.createElement('img');
            hash.className = 'channel-hash';
            hash.src = 'assets/hashtag.svg';
            hash.alt = '#';
            channelItem.appendChild(hash);
        }
        
        // Add icon or avatar for home server channels
        if (serverId === 'home') {
            const channel = server.channels[channelId];
            // Check if this is a DM channel
            if (channel.isDM && channel.avatar) {
                // Add DM class to make channel taller
                channelItem.classList.add('channel-item-dm');
                // Create DM-style avatar with emoji
                const avatar = document.createElement('div');
                avatar.className = 'channel-avatar';
                avatar.textContent = channel.avatar;
                
                // Add online indicator
                const onlineIndicator = document.createElement('div');
                onlineIndicator.className = 'channel-avatar-online';
                avatar.appendChild(onlineIndicator);
                
                channelItem.appendChild(avatar);
            } else {
                // Regular channel with icon
                const icon = document.createElement('img');
                icon.className = 'channel-icon';
                if (channelId === 'manual') {
                    icon.src = 'assets/envelope.svg';
                    icon.alt = 'Manual Generation';
                } else if (channelId === 'stats') {
                    icon.src = 'assets/signal.svg';
                    icon.alt = 'Stats';
                } else if (channelId === 'achievements') {
                    icon.src = 'assets/gem.svg';
                    icon.alt = 'Achievements';
                }
                channelItem.appendChild(icon);
            }
        }
        
        const name = document.createElement('span');
        name.textContent = server.channels[channelId].name;
        
        channelItem.appendChild(name);
        
        // Add ping badge for DM channel if there's a ping
        if (serverId === 'home' && channelId === 'remagofficial') {
            const dmPings = gameState.dmPings || { message1: false, message2: false, rewardMessage: false };
            const hasPing = dmPings.message1 || dmPings.message2 || dmPings.rewardMessage;
            if (hasPing) {
                const pingBadge = document.createElement('div');
                pingBadge.className = 'channel-ping';
                pingBadge.textContent = '1';
                channelItem.appendChild(pingBadge);
            }
        }
        
        channelList.appendChild(channelItem);
        
        // Add divider after achievements channel in home server
        if (serverId === 'home' && channelId === 'achievements') {
            const divider = document.createElement('div');
            divider.className = 'channel-divider';
            channelList.appendChild(divider);
        }
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
    
    // Prevent accessing DM channel before 10 minutes playtime
    if (currentServer === 'home' && channelId === 'remagofficial') {
        const playtime = gameState.playtime || 0;
        const tenMinutes = 10 * 60 * 1000; // 10 minutes in milliseconds
        if (playtime < tenMinutes) {
            // Redirect to manual channel if trying to access DM before it's available
            loadChannel('manual');
            return;
        }
    }
    
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
    
    // Add hash icon for non-home servers
    if (!isHomeServer) {
        const hash = document.createElement('img');
        hash.className = 'channel-hash';
        hash.src = 'assets/hashtag.svg';
        hash.alt = '#';
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
                    ${sessionMessages.join('')}
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
        
        // Restore scroll position or scroll to bottom if messages exist
        if (sessionMessages.length > 0) {
            const messagesContainer = document.getElementById('messages-container');
            if (messagesContainer) {
                // Scroll to bottom after a brief delay to ensure messages are rendered
                setTimeout(() => {
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }, 50);
            }
        }
    } else if (channelId === 'general' && currentServer === 'generator1') {
        // Auto-Typer Bot upgrades
        const gen = gameState.generators.generator1 || { bots: 0, efficiency: 1.0, botSpeed: 0, autoBuy: false, autoBuyPurchased: false, autoBuyDelayLevel: 0 };
        const currentBots = gen.bots || 0;
        const maxLevels = getGenerator1MaxLevels();
        const isMaxBots = currentBots >= maxLevels.bots;
        // Calculate bot cost: if they have 1 bot (the free one), next bot costs 1000 (bot #0 cost)
        const costBots = currentBots === 1 ? 0 : currentBots;
        const botCost = isMaxBots ? 0 : Math.floor(getBotCost(costBots) * getCostReductionMultiplier());
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
        const totalMessages = getTotalMessagesAsNumber();
        const canAffordBot = !isMaxBots && totalMessages >= botCost;
        const canAffordEfficiency = !isMaxEfficiency && totalMessages >= efficiencyCost;
        const canAffordBotSpeed = !isMaxBotSpeed && totalMessages >= botSpeedCost;
        const canAffordAutoBuy = totalMessages >= autoBuyCost && !gen.autoBuyPurchased;
        const canAffordAutoBuyDelay = !isMaxDelayLevel && totalMessages >= autoBuyDelayCost;
        
        // Calculate bulk costs and actual counts
        const actualBotCount = Math.min(bulkPurchaseAmount, maxLevels.bots - currentBots);
        const actualEfficiencyCount = Math.min(bulkPurchaseAmount, maxLevels.efficiency - efficiencyLevel);
        const actualBotSpeedCount = Math.min(bulkPurchaseAmount, maxLevels.botSpeed - botSpeedLevel);
        const actualAutoBuyDelayCount = Math.min(bulkPurchaseAmount, maxDelayLevel - autoBuyDelayLevel);
        
        const bulkBotCost = getBulkBotCost(currentBots, bulkPurchaseAmount, maxLevels.bots);
        const bulkEfficiencyCost = getBulkEfficiencyCost(currentEfficiency, bulkPurchaseAmount, maxLevels.efficiency);
        const bulkBotSpeedCost = getBulkBotSpeedCost(botSpeedLevel, bulkPurchaseAmount, maxLevels.botSpeed);
        const bulkAutoBuyDelayCost = getBulkAutoBuyDelayCost(autoBuyDelayLevel, bulkPurchaseAmount, maxDelayLevel);
        
        const canAffordBulkBot = !isMaxBots && totalMessages >= bulkBotCost;
        const canAffordBulkEfficiency = !isMaxEfficiency && totalMessages >= bulkEfficiencyCost;
        const canAffordBulkBotSpeed = !isMaxBotSpeed && totalMessages >= bulkBotSpeedCost;
        const canAffordBulkAutoBuyDelay = !isMaxDelayLevel && totalMessages >= bulkAutoBuyDelayCost;
        
        contentBody.innerHTML = `
            <div class="bulk-purchase-selector" style="margin-bottom: 20px; padding: 12px; background-color: var(--bg-medium, #2f3136); border-radius: 8px; display: flex; align-items: center; gap: 12px;">
                <span style="color: var(--text-bright); font-weight: 600;">Buy:</span>
                <div style="display: flex; gap: 6px;">
                    ${[1, 5, 10, 25, 50].map(num => `
                        <button class="bulk-purchase-btn ${bulkPurchaseAmount === num ? 'active' : ''}" data-amount="${num}" style="
                            padding: 6px 12px;
                            background-color: ${bulkPurchaseAmount === num ? 'var(--accent-color, #5865f2)' : 'var(--bg-dark, #202225)'};
                            color: var(--text-bright);
                            border: 1px solid ${bulkPurchaseAmount === num ? 'var(--accent-color, #5865f2)' : 'rgba(114, 118, 125, 0.3)'};
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: ${bulkPurchaseAmount === num ? '600' : '400'};
                            transition: all 0.2s ease;
                        ">${num}</button>
                    `).join('')}
                </div>
            </div>
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
                    <button class="upgrade-button ${canAffordBulkBot && !isMaxBots ? '' : 'disabled'}" id="buy-bot" ${!canAffordBulkBot || isMaxBots ? 'disabled' : ''}>
                        <span class="upgrade-button-text">Purchase ${actualBotCount > 1 ? actualBotCount : ''} Bot${actualBotCount > 1 ? 's' : ''}</span>
                        <span class="upgrade-button-cost">${isMaxBots ? 'Max Level' : `${formatNumber(bulkBotCost, 2)} Messages`}</span>
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
                    <button class="upgrade-button ${canAffordBulkEfficiency && !isMaxEfficiency ? '' : 'disabled'}" id="upgrade-efficiency" ${!canAffordBulkEfficiency || isMaxEfficiency ? 'disabled' : ''}>
                        <span class="upgrade-button-text">Upgrade Efficiency ${actualEfficiencyCount > 1 ? `x${actualEfficiencyCount}` : ''}</span>
                        <span class="upgrade-button-cost">${isMaxEfficiency ? 'Max Level' : `${formatNumber(bulkEfficiencyCost, 2)} Messages`}</span>
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
                    <button class="upgrade-button ${canAffordBulkBotSpeed && !isMaxBotSpeed ? '' : 'disabled'}" id="upgrade-bot-speed" ${!canAffordBulkBotSpeed || isMaxBotSpeed ? 'disabled' : ''}>
                        <span class="upgrade-button-text">Upgrade Bot Speed ${actualBotSpeedCount > 1 ? `x${actualBotSpeedCount}` : ''}</span>
                        <span class="upgrade-button-cost">${isMaxBotSpeed ? 'Max Level' : `${formatNumber(bulkBotSpeedCost, 2)} Messages`}</span>
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
                        <button class="upgrade-button ${canAffordBulkAutoBuyDelay ? '' : 'disabled'}" id="upgrade-auto-buy-delay" ${!canAffordBulkAutoBuyDelay ? 'disabled' : ''}>
                            <span class="upgrade-button-text">Upgrade Auto-Buy Speed ${actualAutoBuyDelayCount > 1 ? `x${actualAutoBuyDelayCount}` : ''}</span>
                            <span class="upgrade-button-cost">${formatNumber(bulkAutoBuyDelayCost, 2)} Messages</span>
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
        
        // Setup bulk purchase selector handlers
        const bulkPurchaseBtns = document.querySelectorAll('.bulk-purchase-btn');
        bulkPurchaseBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                bulkPurchaseAmount = parseInt(btn.dataset.amount);
                // Reload channel to update costs
                loadChannel('general');
            });
        });
        
        const prestigeBtn = document.getElementById('prestige-generator1');
        if (prestigeBtn) {
            prestigeBtn.addEventListener('click', () => {
                if (prestigeGenerator('generator1')) {
                    // Prestige successful - UI will refresh automatically
                }
            });
        }
    } else if (channelId === 'pet-photos' && currentServer === 'generator1') {
        // Pet photos channel
        const petPhotos = gameState.petPhotos || [];
        
        let petPhotosHtml = '';
        if (petPhotos.length === 0) {
            petPhotosHtml = '<div style="text-align: center; color: var(--text-muted); padding: 40px 20px;">No pet photos yet. Keep generating messages with your bots to see pet photos appear!</div>';
        } else {
            // Only show the most recent MAX_DISPLAYED_PET_PHOTOS messages
            const photosToShow = petPhotos.slice(-MAX_DISPLAYED_PET_PHOTOS);
            photosToShow.forEach(photo => {
                // Only show photos that have an image URL
                if (!photo.imageUrl) return;
                
                petPhotosHtml += `
                    <div class="discord-message">
                        <div class="message-avatar">${photo.avatar}</div>
                        <div class="message-content">
                            <div class="message-header">
                                <span class="message-username">${photo.username}</span>
                                <span class="message-timestamp">${photo.timestamp}</span>
                            </div>
                            <div class="message-text">this is my ${photo.petType}, their name is ${photo.petName}</div>
                            <div class="message-image-container">
                                <img src="${photo.imageUrl}" alt="${photo.petName}" class="message-image" />
                            </div>
                        </div>
                    </div>
                `;
            });
        }
        
        contentBody.innerHTML = `
            <div class="messages-container" id="messages-container">
                ${petPhotosHtml}
            </div>
        `;
        
        // Scroll to bottom on initial load (when channel is first opened)
        setTimeout(() => {
            const messagesContainer = document.getElementById('messages-container');
            if (messagesContainer) {
                // Always scroll to bottom when channel is first loaded
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        }, 50);
    } else if (channelId === 'off-topic' && currentServer === 'generator1') {
        // Off-topic channel for generator1
        const channelKey = 'generator1-off-topic';
        const messages = channelMessages[channelKey] || [];
        
        contentBody.innerHTML = `
            <div class="messages-container" id="messages-container">
                ${messages.join('')}
            </div>
        `;
        
        // Setup messages container
        setupMessagesContainer();
        
        // Scroll to bottom on initial load
        setTimeout(() => {
            const messagesContainer = document.getElementById('messages-container');
            if (messagesContainer) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        }, 50);
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
        const totalMessages = getTotalMessagesAsNumber();
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
        
        // Calculate bulk costs and actual counts for generator2
        const actualCascadeCount = Math.min(bulkPurchaseAmount, maxLevels.cascades - currentCascades, gen1Bots);
        const actualCascadeEfficiencyCount = Math.min(bulkPurchaseAmount, maxLevels.cascadeEfficiency - efficiencyLevel);
        const actualGenerator2AutoBuyDelayCount = Math.min(bulkPurchaseAmount, maxDelayLevel - autoBuyDelayLevel);
        
        const bulkCascadeCost = getBulkCascadeCost(currentCascades, bulkPurchaseAmount, maxLevels.cascades);
        const bulkCascadeEfficiencyCost = getBulkCascadeEfficiencyCost(cascadeEfficiency, bulkPurchaseAmount, maxLevels.cascadeEfficiency);
        const bulkGenerator2AutoBuyDelayCost = getBulkGenerator2AutoBuyDelayCost(autoBuyDelayLevel, bulkPurchaseAmount, maxDelayLevel);
        
        const canAffordBulkCascade = !isMaxCascades && totalMessages >= bulkCascadeCost && gen1Bots >= actualCascadeCount;
        const canAffordBulkCascadeEfficiency = !isMaxEfficiency && totalMessages >= bulkCascadeEfficiencyCost;
        const canAffordBulkGenerator2AutoBuyDelay = !isMaxDelayLevel && totalMessages >= bulkGenerator2AutoBuyDelayCost;
        
        contentBody.innerHTML = `
            <div class="bulk-purchase-selector" style="margin-bottom: 20px; padding: 12px; background-color: var(--bg-medium, #2f3136); border-radius: 8px; display: flex; align-items: center; gap: 12px;">
                <span style="color: var(--text-bright); font-weight: 600;">Buy:</span>
                <div style="display: flex; gap: 6px;">
                    ${[1, 5, 10, 25, 50].map(num => `
                        <button class="bulk-purchase-btn ${bulkPurchaseAmount === num ? 'active' : ''}" data-amount="${num}" style="
                            padding: 6px 12px;
                            background-color: ${bulkPurchaseAmount === num ? 'var(--accent-color, #5865f2)' : 'var(--bg-dark, #202225)'};
                            color: var(--text-bright);
                            border: 1px solid ${bulkPurchaseAmount === num ? 'var(--accent-color, #5865f2)' : 'rgba(114, 118, 125, 0.3)'};
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: ${bulkPurchaseAmount === num ? '600' : '400'};
                            transition: all 0.2s ease;
                        ">${num}</button>
                    `).join('')}
                </div>
            </div>
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
                    <button class="upgrade-button ${canAffordBulkCascade && !isMaxCascades ? '' : 'disabled'}" id="buy-cascade" ${!canAffordBulkCascade || isMaxCascades ? 'disabled' : ''}>
                        <span class="upgrade-button-text">Purchase ${actualCascadeCount > 1 ? actualCascadeCount : ''} Cascade${actualCascadeCount > 1 ? 's' : ''}</span>
                        <span class="upgrade-button-cost">${isMaxCascades ? 'Max Level' : !hasGen1Bot ? `Need 1 Bot from ${gen1ServerName}` : `${formatNumber(bulkCascadeCost, 2)} Messages + ${actualCascadeCount} Bot${actualCascadeCount > 1 ? 's' : ''}`}</span>
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
                    <button class="upgrade-button ${canAffordBulkCascadeEfficiency && !isMaxEfficiency ? '' : 'disabled'}" id="upgrade-cascade-efficiency" ${!canAffordBulkCascadeEfficiency || isMaxEfficiency ? 'disabled' : ''}>
                        <span class="upgrade-button-text">Upgrade Cascade Efficiency ${actualCascadeEfficiencyCount > 1 ? `x${actualCascadeEfficiencyCount}` : ''}</span>
                        <span class="upgrade-button-cost">${isMaxEfficiency ? 'Max Level' : `${formatNumber(bulkCascadeEfficiencyCost, 2)} Messages`}</span>
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
                        <button class="upgrade-button ${canAffordBulkGenerator2AutoBuyDelay ? '' : 'disabled'}" id="upgrade-generator2-auto-buy-delay" ${!canAffordBulkGenerator2AutoBuyDelay ? 'disabled' : ''}>
                            <span class="upgrade-button-text">Upgrade Auto-Buy Speed ${actualGenerator2AutoBuyDelayCount > 1 ? `x${actualGenerator2AutoBuyDelayCount}` : ''}</span>
                            <span class="upgrade-button-cost">${formatNumber(bulkGenerator2AutoBuyDelayCost, 2)} Messages</span>
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
        
        // Setup bulk purchase selector handlers
        const bulkPurchaseBtns = document.querySelectorAll('.bulk-purchase-btn');
        bulkPurchaseBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                bulkPurchaseAmount = parseInt(btn.dataset.amount);
                // Reload channel to update costs
                loadChannel('general');
            });
        });
        
        const prestigeBtn = document.getElementById('prestige-generator2');
        if (prestigeBtn) {
            prestigeBtn.addEventListener('click', () => {
                if (prestigeGenerator('generator2')) {
                    // Prestige successful - UI will refresh automatically
                }
            });
        }
    } else if (channelId === 'tech' && currentServer === 'generator2') {
        // Tech channel for generator2
        const channelKey = 'generator2-tech';
        const messages = channelMessages[channelKey] || [];
        
        contentBody.innerHTML = `
            <div class="messages-container" id="messages-container">
                ${messages.join('')}
            </div>
        `;
        
        // Setup messages container
        setupMessagesContainer();
        
        // Scroll to bottom on initial load
        setTimeout(() => {
            const messagesContainer = document.getElementById('messages-container');
            if (messagesContainer) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        }, 50);
    } else if (currentServer === 'generator3' && channelId === 'research') {
        // Research Tree channel
        const researchPoints = getResearchPoints();
        const research = gameState.research || { globalBoostPurchased: false, manualProduction: 0, botProduction: 0, cascadeProduction: 0, petPhotosUnlocked: false, offTopicUnlocked: false, techUnlocked: false, scienceUnlocked: false };
        
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
        
        // Science Channel Unlock (requires manual production maxed)
        const scienceUnlocked = research.scienceUnlocked || false;
        const scienceCost = 25;
        const canAffordScience = !scienceUnlocked && researchPoints >= scienceCost && isMaxManual;
        
        // Bot Production branch
        const botLevel = research.botProduction || 0;
        const isMaxBot = botLevel >= 5;
        const botCost = isMaxBot ? 0 : getResearchUpgradeCost(botLevel);
        const canAffordBot = !isMaxBot && researchPoints >= botCost;
        const botMultiplier = 1.0 + (botLevel * 0.5); // +50% per level
        const botBoost = globalBoostPurchased ? (botMultiplier * 2.0) : botMultiplier;
        
        // Pet Photos Unlock (requires bot production maxed)
        const petPhotosUnlocked = research.petPhotosUnlocked || false;
        const petPhotosCost = 25;
        const canAffordPetPhotos = !petPhotosUnlocked && researchPoints >= petPhotosCost && isMaxBot;
        
        // Off-Topic Channel Unlock (requires pet photos unlocked)
        const offTopicUnlocked = research.offTopicUnlocked || false;
        const offTopicCost = 25;
        const canAffordOffTopic = !offTopicUnlocked && researchPoints >= offTopicCost && petPhotosUnlocked;
        
        // Cascade Production branch
        const cascadeLevel = research.cascadeProduction || 0;
        const isMaxCascade = cascadeLevel >= 5;
        const cascadeCost = isMaxCascade ? 0 : getResearchUpgradeCost(cascadeLevel);
        const canAffordCascade = !isMaxCascade && researchPoints >= cascadeCost;
        const cascadeMultiplier = 1.0 + (cascadeLevel * 0.5); // +50% per level
        const cascadeBoost = globalBoostPurchased ? (cascadeMultiplier * 2.0) : cascadeMultiplier;
        
        // Tech Channel Unlock (requires cascade production maxed)
        const techUnlocked = research.techUnlocked || false;
        const techCost = 25;
        const canAffordTech = !techUnlocked && researchPoints >= techCost && isMaxCascade;
        
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
                        <!-- Manual Production Branch (with nested Science) -->
                        <div style="display: flex; flex-direction: column; gap: 20px;">
                            <!-- Manual Production -->
                            <div class="research-node research-node-branch ${!globalBoostPurchased ? 'disabled-node' : (isMaxManual ? 'purchased-node unlocked' : 'unlocked')}" id="research-node-manual">
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
                            
                            <!-- Science Channel Unlock (under Manual Production) -->
                            <div class="research-node research-node-branch ${!isMaxManual ? 'disabled-node' : (scienceUnlocked ? 'purchased-node unlocked' : 'unlocked')}" id="research-node-science" style="margin-top: 0;">
                                <div class="research-node-content upgrade-item">
                                    <div class="upgrade-header">
                                        <h3 class="upgrade-title">🔬 Science Channel</h3>
                                        ${scienceUnlocked ? '<div class="upgrade-level">Unlocked</div>' : ''}
                                    </div>
                                    <p class="upgrade-description">Unlock the science channel in Generator 3. Research discussions appear based on your research upgrades!</p>
                                    <div class="upgrade-stats">
                                        <div class="upgrade-stat">
                                            <span class="stat-label">Status:</span>
                                            <span class="stat-value">${scienceUnlocked ? 'Unlocked' : 'Locked'}</span>
                                        </div>
                                        ${!isMaxManual ? `
                                            <div class="upgrade-stat">
                                                <span class="stat-label" style="color: var(--text-muted);">Requirement:</span>
                                                <span class="stat-value" style="color: var(--text-muted);">Max Manual Production (Level 5)</span>
                                            </div>
                                        ` : ''}
                                    </div>
                                    ${!isMaxManual ? `
                                        <button class="upgrade-button disabled" disabled>
                                            <span class="upgrade-button-text">Requires Max Manual Production</span>
                                        </button>
                                    ` : scienceUnlocked ? `
                                        <button class="upgrade-button disabled" disabled>
                                            <span class="upgrade-button-text">Already Unlocked</span>
                                        </button>
                                    ` : `
                                        <button class="upgrade-button ${canAffordScience ? '' : 'disabled'}" id="unlock-science" ${!canAffordScience ? 'disabled' : ''}>
                                            <span class="upgrade-button-text">Unlock Science Channel</span>
                                            <span class="upgrade-button-cost">${scienceCost} Research Points</span>
                                        </button>
                                    `}
                                </div>
                            </div>
                        </div>
                        
                        <!-- Bot Production Branch (with nested Pet Photos and Off-Topic) -->
                        <div style="display: flex; flex-direction: column; gap: 20px;">
                            <!-- Bot Production -->
                            <div class="research-node research-node-branch ${!globalBoostPurchased ? 'disabled-node' : (isMaxBot ? 'purchased-node unlocked' : 'unlocked')}" id="research-node-bot">
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
                            
                            <!-- Pet Photos Unlock (under Bot Production) -->
                            <div class="research-node research-node-branch ${!isMaxBot ? 'disabled-node' : (petPhotosUnlocked ? 'purchased-node unlocked' : 'unlocked')}" id="research-node-pet-photos" style="margin-top: 0;">
                                <div class="research-node-content upgrade-item">
                                    <div class="upgrade-header">
                                        <h3 class="upgrade-title">📸 Pet Photos Channel</h3>
                                        ${petPhotosUnlocked ? '<div class="upgrade-level">Unlocked</div>' : ''}
                                    </div>
                                    <p class="upgrade-description">Unlock the pet-photos channel in Generator 1. Users will share pet photos as your bots generate messages!</p>
                                    <div class="upgrade-stats">
                                        <div class="upgrade-stat">
                                            <span class="stat-label">Status:</span>
                                            <span class="stat-value">${petPhotosUnlocked ? 'Unlocked' : 'Locked'}</span>
                                        </div>
                                        ${!isMaxBot ? `
                                            <div class="upgrade-stat">
                                                <span class="stat-label" style="color: var(--text-muted);">Requirement:</span>
                                                <span class="stat-value" style="color: var(--text-muted);">Max Bot Production (Level 5)</span>
                                            </div>
                                        ` : ''}
                                    </div>
                                    ${!isMaxBot ? `
                                        <button class="upgrade-button disabled" disabled>
                                            <span class="upgrade-button-text">Requires Max Bot Production</span>
                                        </button>
                                    ` : petPhotosUnlocked ? `
                                        <button class="upgrade-button disabled" disabled>
                                            <span class="upgrade-button-text">Already Unlocked</span>
                                        </button>
                                    ` : `
                                        <button class="upgrade-button ${canAffordPetPhotos ? '' : 'disabled'}" id="unlock-pet-photos" ${!canAffordPetPhotos ? 'disabled' : ''}>
                                            <span class="upgrade-button-text">Unlock Pet Photos Channel</span>
                                            <span class="upgrade-button-cost">${petPhotosCost} Research Points</span>
                                        </button>
                                    `}
                                </div>
                            </div>
                            
                            <!-- Off-Topic Channel Unlock (under Pet Photos) -->
                            <div class="research-node research-node-branch ${!petPhotosUnlocked ? 'disabled-node' : (offTopicUnlocked ? 'purchased-node unlocked' : 'unlocked')}" id="research-node-off-topic" style="margin-top: 0;">
                                <div class="research-node-content upgrade-item">
                                    <div class="upgrade-header">
                                        <h3 class="upgrade-title">💬 Off-Topic Channel</h3>
                                        ${offTopicUnlocked ? '<div class="upgrade-level">Unlocked</div>' : ''}
                                    </div>
                                    <p class="upgrade-description">Unlock the off-topic channel in Generator 1. Chat messages appear based on your bot generation rate!</p>
                                    <div class="upgrade-stats">
                                        <div class="upgrade-stat">
                                            <span class="stat-label">Status:</span>
                                            <span class="stat-value">${offTopicUnlocked ? 'Unlocked' : 'Locked'}</span>
                                        </div>
                                        ${!petPhotosUnlocked ? `
                                            <div class="upgrade-stat">
                                                <span class="stat-label" style="color: var(--text-muted);">Requirement:</span>
                                                <span class="stat-value" style="color: var(--text-muted);">Pet Photos Channel Unlocked</span>
                                            </div>
                                        ` : ''}
                                    </div>
                                    ${!petPhotosUnlocked ? `
                                        <button class="upgrade-button disabled" disabled>
                                            <span class="upgrade-button-text">Requires Pet Photos Channel</span>
                                        </button>
                                    ` : offTopicUnlocked ? `
                                        <button class="upgrade-button disabled" disabled>
                                            <span class="upgrade-button-text">Already Unlocked</span>
                                        </button>
                                    ` : `
                                        <button class="upgrade-button ${canAffordOffTopic ? '' : 'disabled'}" id="unlock-off-topic" ${!canAffordOffTopic ? 'disabled' : ''}>
                                            <span class="upgrade-button-text">Unlock Off-Topic Channel</span>
                                            <span class="upgrade-button-cost">${offTopicCost} Research Points</span>
                                        </button>
                                    `}
                                </div>
                            </div>
                        </div>
                        
                        <!-- Cascade Production Branch (with nested Tech) -->
                        <div style="display: flex; flex-direction: column; gap: 20px;">
                            <!-- Cascade Production -->
                            <div class="research-node research-node-branch ${!globalBoostPurchased ? 'disabled-node' : (isMaxCascade ? 'purchased-node unlocked' : 'unlocked')}" id="research-node-cascade">
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
                            
                            <!-- Tech Channel Unlock (under Cascade Production) -->
                            <div class="research-node research-node-branch ${!isMaxCascade ? 'disabled-node' : (techUnlocked ? 'purchased-node unlocked' : 'unlocked')}" id="research-node-tech" style="margin-top: 0;">
                                <div class="research-node-content upgrade-item">
                                    <div class="upgrade-header">
                                        <h3 class="upgrade-title">💻 Tech Channel</h3>
                                        ${techUnlocked ? '<div class="upgrade-level">Unlocked</div>' : ''}
                                    </div>
                                    <p class="upgrade-description">Unlock the tech channel in Generator 2. Tech discussions appear based on your cascade generation rate!</p>
                                    <div class="upgrade-stats">
                                        <div class="upgrade-stat">
                                            <span class="stat-label">Status:</span>
                                            <span class="stat-value">${techUnlocked ? 'Unlocked' : 'Locked'}</span>
                                        </div>
                                        ${!isMaxCascade ? `
                                            <div class="upgrade-stat">
                                                <span class="stat-label" style="color: var(--text-muted);">Requirement:</span>
                                                <span class="stat-value" style="color: var(--text-muted);">Max Cascade Production (Level 5)</span>
                                            </div>
                                        ` : ''}
                                    </div>
                                    ${!isMaxCascade ? `
                                        <button class="upgrade-button disabled" disabled>
                                            <span class="upgrade-button-text">Requires Max Cascade Production</span>
                                        </button>
                                    ` : techUnlocked ? `
                                        <button class="upgrade-button disabled" disabled>
                                            <span class="upgrade-button-text">Already Unlocked</span>
                                        </button>
                                    ` : `
                                        <button class="upgrade-button ${canAffordTech ? '' : 'disabled'}" id="unlock-tech" ${!canAffordTech ? 'disabled' : ''}>
                                            <span class="upgrade-button-text">Unlock Tech Channel</span>
                                            <span class="upgrade-button-cost">${techCost} Research Points</span>
                                        </button>
                                    `}
                                </div>
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
        
        const unlockPetPhotosBtn = document.getElementById('unlock-pet-photos');
        if (unlockPetPhotosBtn) {
            unlockPetPhotosBtn.addEventListener('click', () => {
                const researchPoints = getResearchPoints();
                if (researchPoints >= petPhotosCost && isMaxBot && !petPhotosUnlocked) {
                    gameState.research.petPhotosUnlocked = true;
                    const cost = BigInt(petPhotosCost * 10000);
                    gameState.messages = gameState.messages - cost; // Deduct research points (1 RP = 10,000 messages)
                    if (gameState.messages < 0n) {
                        gameState.fractionalMessages += Number(gameState.messages);
                        gameState.messages = 0n;
                    }
                    autoSave();
                    updateCurrencyDisplay();
                    loadChannel('research'); // Refresh the research tree
                    // Refresh generator1 server sidebar to show pet-photos channel (without switching to it)
                    if (currentServer === 'generator1') {
                        loadServer('generator1');
                    }
                }
            });
        }
        
        const unlockOffTopicBtn = document.getElementById('unlock-off-topic');
        if (unlockOffTopicBtn) {
            unlockOffTopicBtn.addEventListener('click', () => {
                const researchPoints = getResearchPoints();
                if (researchPoints >= offTopicCost && petPhotosUnlocked && !offTopicUnlocked) {
                    gameState.research.offTopicUnlocked = true;
                    const cost = BigInt(offTopicCost * 10000);
                    gameState.messages = gameState.messages - cost;
                    checkAchievements();
                    if (gameState.messages < 0n) {
                        gameState.fractionalMessages += Number(gameState.messages);
                        gameState.messages = 0n;
                    }
                    autoSave();
                    updateCurrencyDisplay();
                    loadChannel('research');
                    if (currentServer === 'generator1') {
                        loadServer('generator1');
                    }
                }
            });
        }
        
        const unlockTechBtn = document.getElementById('unlock-tech');
        if (unlockTechBtn) {
            unlockTechBtn.addEventListener('click', () => {
                const researchPoints = getResearchPoints();
                if (researchPoints >= techCost && isMaxCascade && !techUnlocked) {
                    gameState.research.techUnlocked = true;
                    const cost = BigInt(techCost * 10000);
                    gameState.messages = gameState.messages - cost;
                    checkAchievements();
                    if (gameState.messages < 0n) {
                        gameState.fractionalMessages += Number(gameState.messages);
                        gameState.messages = 0n;
                    }
                    autoSave();
                    updateCurrencyDisplay();
                    loadChannel('research');
                    if (currentServer === 'generator2') {
                        loadServer('generator2');
                    }
                }
            });
        }
        
        const unlockScienceBtn = document.getElementById('unlock-science');
        if (unlockScienceBtn) {
            unlockScienceBtn.addEventListener('click', () => {
                const researchPoints = getResearchPoints();
                if (researchPoints >= scienceCost && isMaxManual && !scienceUnlocked) {
                    gameState.research.scienceUnlocked = true;
                    const cost = BigInt(scienceCost * 10000);
                    gameState.messages = gameState.messages - cost;
                    checkAchievements();
                    if (gameState.messages < 0n) {
                        gameState.fractionalMessages += Number(gameState.messages);
                        gameState.messages = 0n;
                    }
                    autoSave();
                    updateCurrencyDisplay();
                    loadChannel('research');
                    if (currentServer === 'generator3') {
                        loadServer('generator3');
                    }
                }
            });
        }
    } else if (channelId === 'science' && currentServer === 'generator3') {
        // Science channel for generator3
        const channelKey = 'generator3-science';
        const messages = channelMessages[channelKey] || [];
        
        contentBody.innerHTML = `
            <div class="messages-container" id="messages-container">
                ${messages.join('')}
            </div>
        `;
        
        // Setup messages container
        setupMessagesContainer();
        
        // Scroll to bottom on initial load
        setTimeout(() => {
            const messagesContainer = document.getElementById('messages-container');
            if (messagesContainer) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        }, 50);
    } else if (channelId === 'global1' && currentServer === 'upgrades') {
        // Global upgrades channel 1
        const multiplierLevel = gameState.upgrades.manualGenerationMultiplier || 0;
        const isMaxManualMultiplier = multiplierLevel >= GLOBAL_UPGRADE_MAX_LEVELS.manualGenerationMultiplier;
        const currentMultiplier = getManualGenerationMultiplier();
        const upgradeCost = isMaxManualMultiplier ? 0 : Math.floor(getManualGenerationUpgradeCost(multiplierLevel) * getCostReductionMultiplier());
        const totalMessages = getTotalMessagesAsNumber();
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
        
        // Calculate bulk costs and actual counts for global upgrades
        const actualManualMultiplierCount = Math.min(bulkPurchaseAmount, GLOBAL_UPGRADE_MAX_LEVELS.manualGenerationMultiplier - multiplierLevel);
        const actualAutoBoostCount = Math.min(bulkPurchaseAmount, GLOBAL_UPGRADE_MAX_LEVELS.autoGenerationBoost - autoBoostLevel);
        const actualMessageMultiplierCount = Math.min(bulkPurchaseAmount, GLOBAL_UPGRADE_MAX_LEVELS.messageMultiplier - messageMultiplierLevel);
        const actualCostEfficiencyCount = Math.min(bulkPurchaseAmount, GLOBAL_UPGRADE_MAX_LEVELS.costEfficiency - costEfficiencyLevel);
        
        const bulkManualMultiplierCost = getBulkManualGenerationUpgradeCost(multiplierLevel, bulkPurchaseAmount, GLOBAL_UPGRADE_MAX_LEVELS.manualGenerationMultiplier);
        const bulkAutoBoostCost = getBulkAutoGenerationBoostCost(autoBoostLevel, bulkPurchaseAmount, GLOBAL_UPGRADE_MAX_LEVELS.autoGenerationBoost);
        const bulkMessageMultiplierCost = getBulkMessageMultiplierCost(messageMultiplierLevel, bulkPurchaseAmount, GLOBAL_UPGRADE_MAX_LEVELS.messageMultiplier);
        const bulkCostEfficiencyCost = getBulkCostEfficiencyCost(costEfficiencyLevel, bulkPurchaseAmount, GLOBAL_UPGRADE_MAX_LEVELS.costEfficiency);
        
        const canAffordBulkManualMultiplier = !isMaxManualMultiplier && totalMessages >= bulkManualMultiplierCost;
        const canAffordBulkAutoBoost = !isMaxAutoBoost && totalMessages >= bulkAutoBoostCost;
        const canAffordBulkMessageMultiplier = !isMaxMessageMultiplier && totalMessages >= bulkMessageMultiplierCost;
        const canAffordBulkCostEfficiency = !isMaxCostEfficiency && totalMessages >= bulkCostEfficiencyCost;
        
        contentBody.innerHTML = `
            <div class="bulk-purchase-selector" style="margin-bottom: 20px; padding: 12px; background-color: var(--bg-medium, #2f3136); border-radius: 8px; display: flex; align-items: center; gap: 12px;">
                <span style="color: var(--text-bright); font-weight: 600;">Buy:</span>
                <div style="display: flex; gap: 6px;">
                    ${[1, 5, 10, 25, 50].map(num => `
                        <button class="bulk-purchase-btn ${bulkPurchaseAmount === num ? 'active' : ''}" data-amount="${num}" style="
                            padding: 6px 12px;
                            background-color: ${bulkPurchaseAmount === num ? 'var(--accent-color, #5865f2)' : 'var(--bg-dark, #202225)'};
                            color: var(--text-bright);
                            border: 1px solid ${bulkPurchaseAmount === num ? 'var(--accent-color, #5865f2)' : 'rgba(114, 118, 125, 0.3)'};
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: ${bulkPurchaseAmount === num ? '600' : '400'};
                            transition: all 0.2s ease;
                        ">${num}</button>
                    `).join('')}
                </div>
            </div>
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
                    <button class="upgrade-button ${canAffordBulkManualMultiplier ? '' : 'disabled'}" id="buy-manual-multiplier" ${!canAffordBulkManualMultiplier ? 'disabled' : ''}>
                        <span class="upgrade-button-text">Purchase Upgrade ${actualManualMultiplierCount > 1 ? `x${actualManualMultiplierCount}` : ''}</span>
                        <span class="upgrade-button-cost">${formatNumber(bulkManualMultiplierCost, 2)} Messages</span>
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
                    <button class="upgrade-button ${canAffordBulkAutoBoost && !isMaxAutoBoost ? '' : 'disabled'}" id="buy-auto-boost" ${!canAffordBulkAutoBoost || isMaxAutoBoost ? 'disabled' : ''}>
                        <span class="upgrade-button-text">Purchase Upgrade ${actualAutoBoostCount > 1 ? `x${actualAutoBoostCount}` : ''}</span>
                        <span class="upgrade-button-cost">${isMaxAutoBoost ? 'Max Level' : `${formatNumber(bulkAutoBoostCost, 2)} Messages`}</span>
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
                    <button class="upgrade-button ${canAffordBulkMessageMultiplier && !isMaxMessageMultiplier ? '' : 'disabled'}" id="buy-message-multiplier" ${!canAffordBulkMessageMultiplier || isMaxMessageMultiplier ? 'disabled' : ''}>
                        <span class="upgrade-button-text">Purchase Upgrade ${actualMessageMultiplierCount > 1 ? `x${actualMessageMultiplierCount}` : ''}</span>
                        <span class="upgrade-button-cost">${isMaxMessageMultiplier ? 'Max Level' : `${formatNumber(bulkMessageMultiplierCost, 2)} Messages`}</span>
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
                    <button class="upgrade-button ${canAffordBulkCostEfficiency && !isMaxCostEfficiency ? '' : 'disabled'}" id="buy-cost-efficiency" ${!canAffordBulkCostEfficiency || isMaxCostEfficiency ? 'disabled' : ''}>
                        <span class="upgrade-button-text">Purchase Upgrade ${actualCostEfficiencyCount > 1 ? `x${actualCostEfficiencyCount}` : ''}</span>
                        <span class="upgrade-button-cost">${isMaxCostEfficiency ? 'Max Level' : `${formatNumber(bulkCostEfficiencyCost, 2)} Messages`}</span>
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
        
        // Setup bulk purchase selector handlers
        const bulkPurchaseBtns = document.querySelectorAll('.bulk-purchase-btn');
        bulkPurchaseBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                bulkPurchaseAmount = parseInt(btn.dataset.amount);
                // Reload channel to update costs
                loadChannel('global1');
            });
        });
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
                
                <div class="settings-section" id="debug-tools-section" style="display: none;">
                    <h3 class="settings-title">Debug Tools</h3>
                    <p class="settings-description">Testing and development tools.</p>
                    <div class="settings-buttons">
                        <button class="settings-button" id="debug-add-messages" style="background-color: #5865f2;">Add 10,000 Messages</button>
                        <button class="settings-button" id="debug-double-messages" style="background-color: #5865f2;">Double Messages</button>
                    </div>
                    <div style="margin-top: 15px;">
                        <label for="debug-set-messages" style="display: block; margin-bottom: 5px; color: var(--text-primary);">Set Messages (supports scientific notation, e.g., 1e100):</label>
                        <div style="display: flex; gap: 10px;">
                            <input type="text" id="debug-set-messages" placeholder="Enter number or scientific notation" style="flex: 1; padding: 8px; background-color: var(--bg-medium); border: 1px solid var(--bg-light); border-radius: 4px; color: var(--text-primary); font-family: inherit;">
                            <button class="settings-button" id="debug-set-messages-btn" style="background-color: #5865f2;">Set</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        setupSettingsHandlers();
        // Check debug unlock state when settings channel is loaded
        setTimeout(() => {
            const debugSection = document.getElementById('debug-tools-section');
            if (debugSection) {
                const isUnlocked = sessionStorage.getItem('debugToolsUnlocked') === 'true';
                debugSection.style.display = isUnlocked ? 'block' : 'none';
            }
        }, 0);
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
                <div class="settings-section">
                    <h3 class="settings-title">AI Content Disclosure</h3>
                    <p class="settings-description">This is a personal project created with AI assistance. The game code was developed with the help of AI, and the logo is AI-generated. This project is not intended as a commercial release in its current state.</p>
                    <p class="settings-description">If people enjoy this game, I may consider remaking it with a friend as a more polished release.</p>
                </div>
            </div>
        `;
    } else if (channelId === 'stats' && currentServer === 'home') {
        // Stats channel
        const totalMessages = getTotalMessagesAsNumber();
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
                            <span class="stat-value">${formatNumber(getTotalMessagesForDisplay(), 2)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Lifetime Messages:</span>
                            <span class="stat-value">${formatNumber(gameState.lifetimeMessages, 2)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Messages per Second:</span>
                            <span class="stat-value">${formatNumber(msgPerSecond, 2)} msg/s</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Playtime:</span>
                            <span class="stat-value" id="playtime-display">${playtime}</span>
                        </div>
                        ${gameState.dmRewardClaimed ? `
                        <div class="stat-item">
                            <span class="stat-label">DM Boost:</span>
                            <span class="stat-value">+15%</span>
                        </div>
                        ` : ''}
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
    } else if (channelId === 'achievements' && currentServer === 'home') {
        // Achievements channel
        renderAchievements();
    } else if (channelId === 'remagofficial' && currentServer === 'home') {
        // RemagOfficial DM channel
        const dmChars = gameState.dmCharacters || 0;
        const maxChars = 5000;
        const hasReachedMax = dmChars >= maxChars;
        const rewardClaimed = gameState.dmRewardClaimed || false;
        
        // Initialize or get stored message timestamps
        if (!gameState.dmMessageTimestamps) {
            gameState.dmMessageTimestamps = {
                message1: null,
                message2: null,
                rewardMessage: null
            };
        }
        
        const timestamps = gameState.dmMessageTimestamps;
        const now = Date.now();
        const playtime = gameState.playtime || 0;
        const tenMinutes = 10 * 60 * 1000; // 10 minutes in milliseconds
        
        // Check if first message should appear (10 minutes playtime)
        const showFirstMessage = playtime >= tenMinutes;
        
        // Set first message timestamp when playtime reaches 10 minutes
        if (showFirstMessage && !timestamps.message1) {
            timestamps.message1 = now;
            autoSave();
            // Set ping if channel is not currently open
            if (!(currentServer === 'home' && currentChannel === 'remagofficial')) {
                if (!gameState.dmPings) {
                    gameState.dmPings = { message1: false, message2: false, rewardMessage: false };
                }
                gameState.dmPings.message1 = true;
                autoSave();
                updateServerPings();
                // Reload server to show channel and update channel list ping
                if (currentServer === 'home') {
                    loadServer('home');
                }
            }
        }
        
        // Clear first message ping when channel is opened
        if (showFirstMessage && timestamps.message1) {
            if (gameState.dmPings && gameState.dmPings.message1) {
                gameState.dmPings.message1 = false;
                autoSave();
                updateServerPings();
                // Reload server to update channel list ping
                if (currentServer === 'home') {
                    loadServer('home');
                }
            }
        }
        
        // Check if enough time has passed to show second message (1 minute after first)
        const timeSinceFirst = timestamps.message1 ? (now - timestamps.message1) : 0;
        const showSecondMessage = showFirstMessage && timestamps.message1 && timeSinceFirst >= 60000; // 1 minute = 60000ms
        
        // Set second message timestamp when it first becomes visible
        if (showSecondMessage && !timestamps.message2) {
            timestamps.message2 = timestamps.message1 + 60000; // 1 minute after first
            autoSave();
            // Set ping if channel is not currently open
            if (!(currentServer === 'home' && currentChannel === 'remagofficial')) {
                if (!gameState.dmPings) {
                    gameState.dmPings = { message2: false, rewardMessage: false };
                }
                gameState.dmPings.message2 = true;
                autoSave();
                updateServerPings();
                // Reload server to update channel list ping
                if (currentServer === 'home') {
                    loadServer('home');
                }
            }
        }
        
        // Set reward message timestamp when reaching max (only once)
        if (hasReachedMax && !timestamps.rewardMessage) {
            // Set it to 1 minute after second message, or 2 minutes after first if second doesn't exist yet
            const baseTime = timestamps.message2 || (timestamps.message1 + 60000);
            timestamps.rewardMessage = baseTime + 60000; // 1 minute after second message
            autoSave();
            // Set ping if channel is not currently open
            if (!(currentServer === 'home' && currentChannel === 'remagofficial')) {
                if (!gameState.dmPings) {
                    gameState.dmPings = { message2: false, rewardMessage: false };
                }
                gameState.dmPings.rewardMessage = true;
                autoSave();
                updateServerPings();
                // Reload server to update channel list ping
                if (currentServer === 'home') {
                    loadServer('home');
                }
            }
        }
        
        // Initialize DM pings if they don't exist
        if (!gameState.dmPings) {
            gameState.dmPings = {
                message2: false,
                rewardMessage: false
            };
        }
        
        // Check if second message should have a ping (exists but channel wasn't open when it appeared)
        if (showSecondMessage && timestamps.message2) {
            // Clear ping when channel is opened
            if (gameState.dmPings.message2) {
                gameState.dmPings.message2 = false;
                autoSave();
                updateServerPings();
                // Reload server to update channel list ping
                if (currentServer === 'home') {
                    loadServer('home');
                }
            }
        }
        
        // Check if reward message should have a ping (exists but channel wasn't open when it appeared)
        if (hasReachedMax && timestamps.rewardMessage) {
            // Clear ping when channel is opened
            if (gameState.dmPings.rewardMessage) {
                gameState.dmPings.rewardMessage = false;
                autoSave();
                updateServerPings();
                // Reload server to update channel list ping
                if (currentServer === 'home') {
                    loadServer('home');
                }
            }
        }
        
        const timestamp1 = timestamps.message1 ? formatMessageTime(new Date(timestamps.message1)) : formatMessageTime(new Date(now));
        const timestamp2 = timestamps.message2 ? formatMessageTime(new Date(timestamps.message2)) : formatMessageTime(new Date((timestamps.message1 || now) + 60000));
        const timestamp3 = timestamps.rewardMessage ? formatMessageTime(new Date(timestamps.rewardMessage)) : formatMessageTime(new Date(now + 60000));
        
        let rewardMessageHtml = '';
        if (hasReachedMax) {
            const buttonHtml = !rewardClaimed ? `
                            <div style="margin-top: 12px;">
                                <button class="upgrade-button" id="claim-dm-reward" style="width: auto; padding: 8px 16px;">
                                    <span class="upgrade-button-text">Claim +15% Production Boost</span>
                                </button>
                            </div>
            ` : `
                            <div style="margin-top: 8px; color: var(--text-muted); font-size: 14px;">
                                ✓ Reward claimed
                            </div>
            `;
            rewardMessageHtml = `
                    <div class="discord-message">
                        <div class="message-avatar">🐱</div>
                        <div class="message-content">
                            <div class="message-header">
                                <span class="message-username">RemagOfficial</span>
                                <span class="message-timestamp">${timestamp3}</span>
                            </div>
                            <div class="message-text">Well done there player! here's a little boost to your production</div>
                            ${buttonHtml}
                        </div>
                    </div>
            `;
        }
        
        // Only show messages if first message should be visible
        const firstMessageHtml = showFirstMessage ? `
                    <div class="discord-message">
                        <div class="message-avatar">🐱</div>
                        <div class="message-content">
                            <div class="message-header">
                                <span class="message-username">RemagOfficial</span>
                                <span class="message-timestamp">${timestamp1}</span>
                            </div>
                            <div class="message-text">Hey! thanks for playing my game, i hope youre enjoying it</div>
                        </div>
                    </div>
        ` : '';
        
        contentBody.innerHTML = `
            <div class="manual-generation-content">
                <div class="messages-container" id="messages-container">
                    ${firstMessageHtml}
                    ${showSecondMessage ? `
                    <div class="discord-message">
                        <div class="message-avatar">🐱</div>
                        <div class="message-content">
                            <div class="message-header">
                                <span class="message-username">RemagOfficial</span>
                                <span class="message-timestamp">${timestamp2}</span>
                            </div>
                            <div class="message-text">btw if you type a bit in my DMs maybe ill give you a reward...</div>
                        </div>
                    </div>
                    ` : ''}
                    ${rewardMessageHtml}
                </div>
            </div>
            <div class="chat-input-container">
                <div class="dm-counter" id="dm-counter">${formatNumber(Math.min(dmChars, maxChars), 0)}/${formatNumber(maxChars, 0)}</div>
                <div class="chat-input-wrapper">
                    <input type="text" class="chat-input" id="dm-input" placeholder="Message @RemagOfficial" autocomplete="off" ${hasReachedMax ? 'disabled' : ''} />
                    <button class="send-button" id="dm-send-button" title="Send message" ${hasReachedMax ? 'disabled' : ''}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        
        // Setup DM input tracking
        setupDMInput();
        
        // Setup reward claim button
        if (hasReachedMax && !rewardClaimed) {
            const claimButton = document.getElementById('claim-dm-reward');
            if (claimButton) {
                claimButton.addEventListener('click', () => {
                    gameState.dmRewardClaimed = true;
                    autoSave();
                    updateCurrencyDisplay();
                    // Reload channel to update UI
                    loadChannel('remagofficial');
                });
            }
        }
        
        // If second message hasn't appeared yet, set up a timeout to show it
        if (!showSecondMessage && timestamps.message1) {
            const timeUntilSecond = 60000 - timeSinceFirst;
            if (timeUntilSecond > 0) {
                setTimeout(() => {
                    // Set ping if channel is not open
                    if (!(currentServer === 'home' && currentChannel === 'remagofficial')) {
                        if (!gameState.dmPings) {
                            gameState.dmPings = { message2: false, rewardMessage: false };
                        }
                        gameState.dmPings.message2 = true;
                        autoSave();
                        updateServerPings();
                        // Reload server to update channel list ping
                        if (currentServer === 'home') {
                            loadServer('home');
                        }
                    } else {
                        // Only reload if we're still on this channel
                        loadChannel('remagofficial');
                    }
                }, timeUntilSecond);
            }
        }
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
    try {
        // Convert BigInt values to strings for JSON serialization
        const stateToSave = JSON.parse(JSON.stringify(gameState, (key, value) => {
            if (typeof value === 'bigint') {
                // For very large BigInt values, use scientific notation to save space
                const str = value.toString();
                // Compress numbers longer than 50 digits to prevent localStorage quota issues
                if (str.length > 50) {
                    // Use scientific notation for large numbers to reduce storage size
                    const firstDigit = str[0];
                    const rest = str.substring(1, 10); // Use first 9 digits after first
                    const exponent = str.length - 1;
                    return `sci:${firstDigit}.${rest}e+${exponent}`;
                }
                return value.toString() + 'n'; // Mark as BigInt with 'n' suffix
            }
            return value;
        }));
        const serialized = JSON.stringify(stateToSave);
        
        // Check if the serialized data is too large
        if (serialized.length > 4 * 1024 * 1024) { // 4MB warning threshold
            console.warn('Save data is very large (' + (serialized.length / 1024 / 1024).toFixed(2) + 'MB). Consider reducing message count.');
        }
        
        localStorage.setItem('gameState', serialized);
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            console.error('Save data too large for localStorage. Message count may be too high. Consider using a smaller value.');
            // Try to save without the large BigInt values as a fallback
            try {
                const fallbackState = JSON.parse(JSON.stringify(gameState, (key, value) => {
                    if (typeof value === 'bigint') {
                        // For very large values, save as scientific notation
                        const str = value.toString();
                        if (str.length > 50) {
                            const firstDigit = str[0];
                            const rest = str.substring(1, 6);
                            const exponent = str.length - 1;
                            return `sci:${firstDigit}.${rest}e+${exponent}`;
                        }
                        return value.toString() + 'n';
                    }
                    return value;
                }));
                localStorage.setItem('gameState', JSON.stringify(fallbackState));
                console.warn('Saved with compressed BigInt values. Some precision may be lost on very large numbers.');
            } catch (e2) {
                console.error('Unable to save game state. Data is too large.');
            }
        } else {
            throw e;
        }
    }
}

// Load game state from localStorage
function loadGameState() {
    const saved = localStorage.getItem('gameState');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            // Convert BigInt strings back to BigInt (handles both 'n' suffix and scientific notation)
            const parseBigIntValue = (value) => {
                if (value === undefined || value === null) return 0n;
                if (typeof value === 'string') {
                    // Check if it's scientific notation format
                    if (value.startsWith('sci:')) {
                        const sciPart = value.substring(4); // Remove 'sci:' prefix
                        const match = sciPart.match(/^([\d.]+)e\+(\d+)$/);
                        if (match) {
                            const base = parseFloat(match[1]);
                            const exponent = parseInt(match[2], 10);
                            // Reconstruct the number (may lose some precision for very large numbers)
                            // Use the same parsing logic as the debug input
                            const baseStr = base.toString();
                            const baseParts = baseStr.split('.');
                            const integerPart = baseParts[0];
                            const decimalPart = baseParts[1] || '';
                            const allDigits = integerPart + decimalPart;
                            let significantDigits = allDigits.replace(/^0+/, '');
                            if (significantDigits === '') significantDigits = '0';
                            const adjustedExponent = exponent - decimalPart.length;
                            
                            if (adjustedExponent < 0) return 0n;
                            
                            // Reconstruct using BigInt multiplication for large exponents
                            let result = BigInt(significantDigits);
                            const chunkSize = 1000;
                            let remainingExponent = adjustedExponent;
                            
                            while (remainingExponent > 0) {
                                const currentChunk = Math.min(remainingExponent, chunkSize);
                                const multiplier = BigInt(10) ** BigInt(currentChunk);
                                result = result * multiplier;
                                remainingExponent -= currentChunk;
                            }
                            
                            return result;
                        }
                    }
                    // Check if it ends with 'n' (standard BigInt format)
                    if (value.endsWith('n')) {
                        return BigInt(value.slice(0, -1));
                    }
                    // Try parsing as regular number string
                    try {
                        return BigInt(value);
                    } catch (e) {
                        return BigInt(0);
                    }
                }
                // If it's already a number, convert to BigInt
                return BigInt(value || 0);
            };
            
            if (parsed.messages !== undefined) {
                parsed.messages = parseBigIntValue(parsed.messages);
            }
            if (parsed.lifetimeMessages !== undefined) {
                parsed.lifetimeMessages = parseBigIntValue(parsed.lifetimeMessages);
            }
            if (parsed.generator1BotMessages !== undefined) {
                parsed.generator1BotMessages = parseBigIntValue(parsed.generator1BotMessages);
            }
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
                    cascadeProduction: 0,
                    petPhotosUnlocked: false,
                    offTopicUnlocked: false,
                    techUnlocked: false,
                    scienceUnlocked: false
                };
            }
            // Ensure petPhotosUnlocked exists for older saves
            if (gameState.research.petPhotosUnlocked === undefined) {
                gameState.research.petPhotosUnlocked = false;
            }
            // Ensure offTopicUnlocked exists for older saves
            if (gameState.research.offTopicUnlocked === undefined) {
                gameState.research.offTopicUnlocked = false;
            }
            // Ensure techUnlocked exists for older saves
            if (gameState.research.techUnlocked === undefined) {
                gameState.research.techUnlocked = false;
            }
            // Ensure scienceUnlocked exists for older saves
            if (gameState.research.scienceUnlocked === undefined) {
                gameState.research.scienceUnlocked = false;
            }
            // Ensure fractionalMessages exists
            if (gameState.fractionalMessages === undefined) {
                gameState.fractionalMessages = 0;
            }
            // Ensure lifetimeMessages exists
            if (gameState.lifetimeMessages === undefined) {
                gameState.lifetimeMessages = gameState.messages || 0n;
            }
            // Ensure BigInt fields are actually BigInt
            if (typeof gameState.messages !== 'bigint') {
                gameState.messages = BigInt(gameState.messages || 0);
            }
            if (typeof gameState.lifetimeMessages !== 'bigint') {
                gameState.lifetimeMessages = BigInt(gameState.lifetimeMessages || 0);
            }
            if (typeof gameState.generator1BotMessages !== 'bigint') {
                gameState.generator1BotMessages = BigInt(gameState.generator1BotMessages || 0);
            }
            // Ensure playtime exists
            if (gameState.playtime === undefined) {
                gameState.playtime = 0;
            }
            // Ensure sessionStartTime exists
            if (!gameState.sessionStartTime) {
                gameState.sessionStartTime = Date.now();
            }
            // Ensure dmCharacters exists
            if (gameState.dmCharacters === undefined) {
                gameState.dmCharacters = 0;
            }
            // Ensure dmRewardClaimed exists
            if (gameState.dmRewardClaimed === undefined) {
                gameState.dmRewardClaimed = false;
            }
            // Ensure dmMessageTimestamps exists
            if (!gameState.dmMessageTimestamps) {
                gameState.dmMessageTimestamps = {
                    message1: null,
                    message2: null,
                    rewardMessage: null
                };
            }
            // Ensure dmPings exists
            if (!gameState.dmPings) {
                gameState.dmPings = {
                    message1: false,
                    message2: false,
                    rewardMessage: false
                };
            }
            // Ensure generator1BotMessages exists
            if (gameState.generator1BotMessages === undefined) {
                gameState.generator1BotMessages = 0n;
            }
            // Ensure generator1BotMessagesFractional exists
            if (gameState.generator1BotMessagesFractional === undefined) {
                gameState.generator1BotMessagesFractional = 0;
            }
            // Ensure achievements exists
            if (!gameState.achievements) {
                gameState.achievements = {};
            }
            // Ensure petPhotos exists
            if (!gameState.petPhotos) {
                gameState.petPhotos = [];
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
    const totalMessages = getTotalMessagesAsNumber();
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
                        <span class="stat-value ${canAfford ? '' : 'insufficient'}">${formatNumber(getTotalMessagesForDisplay(), 2)} Messages</span>
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
    
    // Calculate auto buy delay cap: base 10, prestige 1 adds 10, prestige 2 adds 5, then capped at 25
    let autoBuyDelayCap = GENERATOR1_BASE_MAX_LEVELS.autoBuyDelay; // Base: 10
    if (prestigeLevel >= 1) {
        autoBuyDelayCap += 10; // Prestige 1 adds 10 (total: 20)
    }
    if (prestigeLevel >= 2) {
        autoBuyDelayCap += 5; // Prestige 2 adds 5 (total: 25)
    }
    // Cap at 25 absolute maximum (no further increases after prestige 2)
    autoBuyDelayCap = Math.min(autoBuyDelayCap, 25);
    
    return {
        bots: GENERATOR1_BASE_MAX_LEVELS.bots + (prestigeLevel * 10),
        efficiency: GENERATOR1_BASE_MAX_LEVELS.efficiency + (prestigeLevel * 10),
        botSpeed: GENERATOR1_BASE_MAX_LEVELS.botSpeed + (prestigeLevel * 10),
        autoBuyDelay: autoBuyDelayCap
    };
}

// Get max levels for Generator 2 based on prestige level
function getGenerator2MaxLevels() {
    const prestigeLevel = (gameState.generators.generator2?.prestigeLevel || 0);
    
    // Calculate auto buy delay cap: base 10, prestige 1 adds 10, prestige 2 adds 5, then capped at 25
    let autoBuyDelayCap = GENERATOR2_BASE_MAX_LEVELS.autoBuyDelay; // Base: 10
    if (prestigeLevel >= 1) {
        autoBuyDelayCap += 10; // Prestige 1 adds 10 (total: 20)
    }
    if (prestigeLevel >= 2) {
        autoBuyDelayCap += 5; // Prestige 2 adds 5 (total: 25)
    }
    // Cap at 25 absolute maximum (no further increases after prestige 2)
    autoBuyDelayCap = Math.min(autoBuyDelayCap, 25);
    
    return {
        cascades: GENERATOR2_BASE_MAX_LEVELS.cascades + (prestigeLevel * 10),
        cascadeEfficiency: GENERATOR2_BASE_MAX_LEVELS.cascadeEfficiency + (prestigeLevel * 10),
        autoBuyDelay: autoBuyDelayCap
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
    const count = Math.min(bulkPurchaseAmount, maxLevels.cascades - currentCascades, gen1Bots);
    if (count < 1) {
        return; // Need at least 1 bot from generator1 or already at max
    }
    
    // Calculate bulk message cost
    const totalCost = getBulkCascadeCost(currentCascades, count, maxLevels.cascades);
    const totalMessages = getTotalMessagesAsNumber();
    
    if (totalMessages >= totalCost && gen1Bots >= count) {
        // Deduct bots from generator1
        gen1.bots = gen1Bots - count;
        
        // Deduct message cost
        if (gameState.fractionalMessages >= totalCost) {
            gameState.fractionalMessages -= totalCost;
        } else {
            const remaining = totalCost - gameState.fractionalMessages;
            gameState.fractionalMessages = 0;
            gameState.messages = gameState.messages - BigInt(Math.ceil(remaining));
        }
        
        // Add cascades
        gen2.cascades = currentCascades + count;
        checkAchievements();
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
    // Calculate level - must match the calculation in getBulkCascadeEfficiencyCost exactly
    // Don't use rounding here - it can cause off-by-one errors
    const level = Math.floor(Math.log(currentEfficiency / 0.1) / Math.log(1.1));
    const maxLevels = getGenerator2MaxLevels();
    if (level >= maxLevels.cascadeEfficiency) {
        return; // Already at max
    }
    
    // Calculate the actual count that will be purchased (must match cost function calculation exactly)
    const requestedCount = Math.min(bulkPurchaseAmount, maxLevels.cascadeEfficiency - level);
    const totalCost = getBulkCascadeEfficiencyCost(currentEfficiency, requestedCount, maxLevels.cascadeEfficiency);
    
    // Calculate actualCount using the exact same logic as getBulkCascadeEfficiencyCost
    // This ensures we purchase exactly what we calculated the cost for
    const actualCount = Math.min(requestedCount, maxLevels.cascadeEfficiency - level);
    
    const totalMessages = getTotalMessagesAsNumber();
    
    if (totalMessages >= totalCost && actualCount > 0) {
        // Deduct cost
        if (gameState.fractionalMessages >= totalCost) {
            gameState.fractionalMessages -= totalCost;
        } else {
            const remaining = totalCost - gameState.fractionalMessages;
            gameState.fractionalMessages = 0;
            gameState.messages = gameState.messages - BigInt(Math.ceil(remaining));
        }
        
        // Increase efficiency by 10% for each upgrade (multiply by 1.1)
        // Purchase exactly actualCount upgrades (the same count we calculated the cost for)
        // Calculate final efficiency directly to avoid floating point accumulation errors
        // Use the base efficiency (0.1) and calculate from the target level to avoid precision issues
        const baseEfficiency = 0.1;
        const targetLevel = level + actualCount;
        const finalEfficiency = baseEfficiency * Math.pow(1.1, targetLevel);
        gen2.cascadeEfficiency = finalEfficiency;
        checkAchievements();
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
    const totalMessages = getTotalMessagesAsNumber();
    
    if (totalMessages >= cost) {
        // Deduct cost
        if (gameState.fractionalMessages >= cost) {
            gameState.fractionalMessages -= cost;
        } else {
            const remaining = cost - gameState.fractionalMessages;
            gameState.fractionalMessages = 0;
            gameState.messages = gameState.messages - BigInt(Math.ceil(remaining));
        }
        
        gen2.autoBuyPurchased = true;
        gen2.autoBuy = true; // Enable by default when purchased
        autoSave();
        updateCurrencyDisplay();
        updateServerPings(); // Update pings immediately after purchase
        
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
    
    const count = Math.min(bulkPurchaseAmount, maxLevels.autoBuyDelay - autoBuyDelayLevel);
    const totalCost = getBulkGenerator2AutoBuyDelayCost(autoBuyDelayLevel, count, maxLevels.autoBuyDelay);
    const totalMessages = getTotalMessagesAsNumber();
    
    if (totalMessages >= totalCost && count > 0) {
        // Deduct cost
        if (gameState.fractionalMessages >= totalCost) {
            gameState.fractionalMessages -= totalCost;
        } else {
            const remaining = totalCost - gameState.fractionalMessages;
            gameState.fractionalMessages = 0;
            gameState.messages = gameState.messages - BigInt(Math.ceil(remaining));
        }
        
        gen2.autoBuyDelayLevel = autoBuyDelayLevel + count;
        checkAchievements();
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
        const totalMessages = getTotalMessagesAsNumber();
        
        if (totalMessages < cost) return false;
        
        // Deduct cost
        if (gameState.fractionalMessages >= cost) {
            gameState.fractionalMessages -= cost;
        } else {
            const remaining = cost - gameState.fractionalMessages;
            gameState.fractionalMessages = 0;
            gameState.messages = gameState.messages - BigInt(Math.ceil(remaining));
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
        
        checkAchievements();
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
        const totalMessages = getTotalMessagesAsNumber();
        
        if (totalMessages < cost) return false;
        
        // Deduct cost
        if (gameState.fractionalMessages >= cost) {
            gameState.fractionalMessages -= cost;
        } else {
            const remaining = cost - gameState.fractionalMessages;
            gameState.fractionalMessages = 0;
            gameState.messages = gameState.messages - BigInt(Math.ceil(remaining));
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
        
        checkAchievements();
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

// Bulk purchase helper functions - calculate total cost for buying X upgrades
function getBulkBotCost(currentBots, count, maxLevel) {
    let totalCost = 0;
    const actualCount = Math.min(count, maxLevel - currentBots);
    for (let i = 0; i < actualCount; i++) {
        totalCost += getBotCost(currentBots + i);
    }
    return Math.floor(totalCost * getCostReductionMultiplier());
}

function getBulkEfficiencyCost(currentEfficiency, count, maxLevel) {
    let totalCost = 0;
    let currentEff = currentEfficiency;
    const currentLevel = Math.floor(Math.log(currentEff / 1.0) / Math.log(1.1));
    const actualCount = Math.min(count, maxLevel - currentLevel);
    for (let i = 0; i < actualCount; i++) {
        totalCost += getEfficiencyUpgradeCost(currentEff);
        currentEff *= 1.1; // Efficiency increases by 10% per upgrade
    }
    return Math.floor(totalCost * getCostReductionMultiplier());
}

function getBulkBotSpeedCost(currentLevel, count, maxLevel) {
    let totalCost = 0;
    const actualCount = Math.min(count, maxLevel - currentLevel);
    for (let i = 0; i < actualCount; i++) {
        totalCost += getBotSpeedCost(currentLevel + i);
    }
    return Math.floor(totalCost * getCostReductionMultiplier());
}

function getBulkAutoBuyDelayCost(currentLevel, count, maxLevel) {
    let totalCost = 0;
    const actualCount = Math.min(count, maxLevel - currentLevel);
    for (let i = 0; i < actualCount; i++) {
        totalCost += getAutoBuyDelayCost(currentLevel + i);
    }
    return Math.floor(totalCost * getCostReductionMultiplier());
}

function getBulkCascadeCost(currentCascades, count, maxLevel) {
    let totalCost = 0;
    const actualCount = Math.min(count, maxLevel - currentCascades);
    for (let i = 0; i < actualCount; i++) {
        totalCost += getCascadeCost(currentCascades + i);
    }
    return Math.floor(totalCost * getCostReductionMultiplier());
}

function getBulkCascadeEfficiencyCost(currentEfficiency, count, maxLevel) {
    let totalCost = 0;
    let currentEff = currentEfficiency;
    // Calculate level - use the same calculation as the purchase function (no rounding)
    const currentLevel = Math.floor(Math.log(currentEff / 0.1) / Math.log(1.1));
    const actualCount = Math.min(count, maxLevel - currentLevel);
    // Make sure we don't go over max
    if (actualCount <= 0) return 0;
    for (let i = 0; i < actualCount; i++) {
        totalCost += getCascadeEfficiencyUpgradeCost(currentEff);
        currentEff *= 1.1; // Efficiency increases by 10% per upgrade
    }
    return Math.floor(totalCost * getCostReductionMultiplier());
}

// Helper to get actual count that will be purchased (for cascade efficiency)
function getBulkCascadeEfficiencyCount(currentEfficiency, count, maxLevel) {
    const currentLevel = Math.floor(Math.log(currentEfficiency / 0.1) / Math.log(1.1));
    return Math.min(count, maxLevel - currentLevel);
}

function getBulkGenerator2AutoBuyDelayCost(currentLevel, count, maxLevel) {
    let totalCost = 0;
    const actualCount = Math.min(count, maxLevel - currentLevel);
    for (let i = 0; i < actualCount; i++) {
        totalCost += getGenerator2AutoBuyDelayCost(currentLevel + i);
    }
    return Math.floor(totalCost * getCostReductionMultiplier());
}

function getBulkManualGenerationUpgradeCost(currentLevel, count, maxLevel) {
    let totalCost = 0;
    const actualCount = Math.min(count, maxLevel - currentLevel);
    for (let i = 0; i < actualCount; i++) {
        totalCost += getManualGenerationUpgradeCost(currentLevel + i);
    }
    return Math.floor(totalCost * getCostReductionMultiplier());
}

function getBulkAutoGenerationBoostCost(currentLevel, count, maxLevel) {
    let totalCost = 0;
    const actualCount = Math.min(count, maxLevel - currentLevel);
    for (let i = 0; i < actualCount; i++) {
        totalCost += getAutoGenerationBoostCost(currentLevel + i);
    }
    return Math.floor(totalCost * getCostReductionMultiplier());
}

function getBulkMessageMultiplierCost(currentLevel, count, maxLevel) {
    let totalCost = 0;
    const actualCount = Math.min(count, maxLevel - currentLevel);
    for (let i = 0; i < actualCount; i++) {
        totalCost += getMessageMultiplierCost(currentLevel + i);
    }
    return Math.floor(totalCost * getCostReductionMultiplier());
}

function getBulkCostEfficiencyCost(currentLevel, count, maxLevel) {
    let totalCost = 0;
    const actualCount = Math.min(count, maxLevel - currentLevel);
    for (let i = 0; i < actualCount; i++) {
        totalCost += getCostEfficiencyCost(currentLevel + i);
    }
    return Math.floor(totalCost * getCostReductionMultiplier());
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
    
    // Calculate bulk cost: if they have 1 bot (the free one), next bot costs 1000 (bot #0 cost)
    // Otherwise, use the normal cost scaling
    const count = Math.min(bulkPurchaseAmount, maxLevels.bots - currentBots);
    const costBots = currentBots === 1 ? 0 : currentBots;
    const totalCost = getBulkBotCost(costBots, count, maxLevels.bots);
    const totalMessages = getTotalMessagesAsNumber();
    
    if (totalMessages >= totalCost && count > 0) {
        // Deduct cost
        if (gameState.fractionalMessages >= totalCost) {
            gameState.fractionalMessages -= totalCost;
        } else {
            const remaining = totalCost - gameState.fractionalMessages;
            gameState.fractionalMessages = 0;
            gameState.messages = gameState.messages - BigInt(Math.ceil(remaining));
        }
        
        gen.bots = currentBots + count;
        checkAchievements();
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
    
    const currentEfficiency = gen.efficiency || 1.0;
    const currentLevel = Math.floor(Math.log(currentEfficiency / 1.0) / Math.log(1.1));
    const maxLevels = getGenerator1MaxLevels();
    const count = Math.min(bulkPurchaseAmount, maxLevels.efficiency - currentLevel);
    const totalCost = getBulkEfficiencyCost(currentEfficiency, count, maxLevels.efficiency);
    const totalMessages = getTotalMessagesAsNumber();
    
    if (totalMessages >= totalCost && count > 0) {
        // Deduct cost
        if (gameState.fractionalMessages >= totalCost) {
            gameState.fractionalMessages -= totalCost;
        } else {
            const remaining = totalCost - gameState.fractionalMessages;
            gameState.fractionalMessages = 0;
            gameState.messages = gameState.messages - BigInt(Math.ceil(remaining));
        }
        
        // Multiply efficiency by 1.1 for each upgrade (compounding: +10% of current value)
        // Calculate final efficiency directly to avoid floating point accumulation errors
        const finalEfficiency = (gen.efficiency || 1.0) * Math.pow(1.1, count);
        gen.efficiency = finalEfficiency;
        checkAchievements();
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
    '@RemagOfficial',
  
    // Clean, modern handles
    '@VoidDrift', '@PixelFlux', '@NeonOrbit', '@EchoShift', '@StaticBloom',
    '@NovaSpiral', '@CryoPulse', '@PhantomStack', '@LunarTrace', '@VantaCore',
    '@SolarGlitch', '@NightPayload', '@DriftSignal', '@IonWake', '@ShadowPacket',
  
    // Tech / cyber vibes
    '@NullVector', '@BitCrusher', '@StackUnder', '@Overclocked', '@PacketStorm',
    '@HeapSpace', '@FrameDrop', '@KernelPanic', '@DataFault', '@OpcodeZero',
  
    // Gaming energy
    '@CritFrame', '@HitMarker', '@RespawnLoop', '@ManaOverflow', '@LootPhase',
    '@QuickReset', '@LagSpike', '@NoScopeZone', '@ClutchState', '@CooldownReady',
  
    // Short, punchy, realistic tags
    '@V0ID', '@PIX3L', '@GL1TCH', '@ECHOX', '@NEXUS7',
    '@BYTE_IX', '@FREQ99', '@CORE_X', '@SYNCED', '@RIFTED',
  
    // Slightly chaotic / meme handles
    '@ItCrashed', '@StillBuffering', '@TrustNoPatch', '@DefinitelyBroken',
    '@HotfixWhen', '@SendPackets', '@WhyIsLag', '@OopsLatency', '@ServerOnFire'
  ];  
const FAKE_AVATARS = ['🤖', '💬', '⚡', '🎮', '🚀', '💻', '🔥', '⭐', '🌟', '✨', '🎯', '💡', '🎨', '🎵', '🎭', '🎪', '🏆', '🎲', '🎸', '🎺'];

// Message pools for generator channels
const OFF_TOPIC_MESSAGES = [
    "anyone else just randomly think about random stuff",
    "what's everyone up to",
    "just vibing tbh",
    "this server is so active",
    "who else is procrastinating",
    "random thought but what if",
    "anyone want to chat",
    "this is my safe space",
    "just here for the vibes",
    "who's still awake",
    "anyone else bored",
    "what's the move tonight",
    "just chilling",
    "anyone else having one of those days",
    "this place is wild",
    "who else is avoiding responsibilities",
    "just popping in to say hi",
    "anyone else think about life",
    "what's everyone's plans",
    "just here for the chaos"
];

const TECH_MESSAGES = [
    "just upgraded my setup",
    "anyone else having issues with their rig",
    "what specs are you running",
    "thinking about upgrading soon",
    "anyone know a good build",
    "my pc is struggling",
    "just got new hardware",
    "what's the best gpu right now",
    "anyone else into overclocking",
    "my temps are getting high",
    "just built a new pc",
    "what's everyone's setup",
    "thinking about switching to amd",
    "anyone else having driver issues",
    "just optimized my build",
    "what's the best cooling solution",
    "my build is finally complete",
    "anyone else into custom loops",
    "just upgraded my ram",
    "what's everyone's favorite brand"
];

const SCIENCE_MESSAGES = [
    "just read an interesting paper",
    "anyone else into quantum physics",
    "thinking about the universe",
    "just learned something cool",
    "anyone else love chemistry",
    "what's everyone researching",
    "just had a breakthrough",
    "anyone else into astronomy",
    "thinking about experiments",
    "just discovered something",
    "what's the latest research",
    "anyone else into biology",
    "just published findings",
    "thinking about theories",
    "anyone else love physics",
    "just analyzed some data",
    "what's everyone studying",
    "anyone else into research",
    "just made a hypothesis",
    "thinking about the cosmos"
];

// Add a message to a generator channel
function addGeneratorChannelMessage(serverId, channelId) {
    const channelKey = `${serverId}-${channelId}`;
    const messagesContainer = document.getElementById('messages-container');
    if (!messagesContainer) return;
    
    // Select message pool based on channel
    let messagePool = [];
    if (channelId === 'off-topic') {
        messagePool = OFF_TOPIC_MESSAGES;
    } else if (channelId === 'tech') {
        messagePool = TECH_MESSAGES;
    } else if (channelId === 'science') {
        messagePool = SCIENCE_MESSAGES;
    } else {
        return; // Unknown channel
    }
    
    const username = FAKE_USERNAMES[Math.floor(Math.random() * FAKE_USERNAMES.length)];
    const avatar = FAKE_AVATARS[Math.floor(Math.random() * FAKE_AVATARS.length)];
    const messageText = messagePool[Math.floor(Math.random() * messagePool.length)];
    const timestamp = formatMessageTime(new Date());
    
    const messageHtml = `
        <div class="discord-message">
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-username">${username}</span>
                    <span class="message-timestamp">${timestamp}</span>
                </div>
                <div class="message-text">${messageText}</div>
            </div>
        </div>
    `;
    
    // Store message in session
    if (!channelMessages[channelKey]) {
        channelMessages[channelKey] = [];
    }
    channelMessages[channelKey].push(messageHtml);
    
    // Limit stored messages
    if (channelMessages[channelKey].length > 50) {
        channelMessages[channelKey] = channelMessages[channelKey].slice(-50);
    }
    
    const messageElement = document.createElement('div');
    messageElement.className = 'discord-message';
    messageElement.innerHTML = messageHtml;
    
    messagesContainer.appendChild(messageElement);
    
    // Remove old messages if we exceed display limit
    const messages = messagesContainer.querySelectorAll('.discord-message');
    if (messages.length > 50) {
        const messagesToRemove = messages.length - 50;
        for (let i = 0; i < messagesToRemove; i++) {
            messages[i].remove();
        }
    }
    
    // Scroll to bottom (with smooth scroll if user is near bottom)
    const isNearBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 100;
    if (isNearBottom) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

// Generate random message text
function generateRandomMessage() {
    const messages = [
        "brb grabbing food",
        "anyone on rn?",
        "that boss fight was actually insane",
        "why is the server lagging so hard 😭",
        "who forgot to pay the hosting bill",
        "ggs everyone",
        "i just spent 3 hours fixing a bug and it was a typo",
        "skill issue tbh",
        "does anyone have the modpack link",
        "i am once again asking for tech support",
        "wait what happened while i was gone",
        "that update lowkey broke everything",
        "ping me when the server's back",
        "this game hates me i swear",
        "hot take but pineapple on pizza is fine",
        "who's idea was it to add that feature",
        "my fps just evaporated",
        "is it supposed to do that",
        "no thoughts head empty",
        "i accidentally deleted my entire build",
        "it's not a bug it's a feature",
        "why does this always happen at 3am",
        "anybody want to test something real quick",
        "i just softlocked the world",
        "who has admin",
        "this is either genius or incredibly dumb",
        "trust me this will work",
        "update: it did not work",
        "why are there so many creepers",
        "im so done for tonight",
        "one more run and then i sleep",
        "this is scuffed but it works",
        "that was way closer than it should've been",
        "chat is this real",
        "i was today years old when i learned that",
        "server just ate my items",
        "lag spike of doom",
        "does this scale with upgrades",
        "oh that explains a LOT",
        "anyone else hearing that",
        "i broke it again",
        "this felt easier in the tutorial",
        "same energy as duct tape and hope",
        "who let him cook",
        "i regret everything",
        "that actually worked wtf",
        "i'm blaming the code",
        "my brain has stopped functioning",
        "why is this oddly satisfying",
        "this was not in the patch notes",
        "i fear no man but this thing scares me",
        "okay but that was kinda clean",
        "accidentally speedran it",
        "i have achieved nothing today",
        "this is peak gameplay",
        "we take those",
        "this is fine 🔥",
        "nothing could have prepared me for that",
        "average tuesday moment",
        "i choose violence today"
      ];
    return messages[Math.floor(Math.random() * messages.length)];
}

// Format timestamp (Discord style: HH:MM)
function formatMessageTime(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

// Pet types for random selection
const PET_TYPES = ['cat', 'dog', 'rabbit', 'hamster'];

// Fetch a random pet photo from the API
async function fetchPetPhoto() {
    const petType = PET_TYPES[Math.floor(Math.random() * PET_TYPES.length)];
    const apiUrl = `https://animals.maxz.dev/api/${petType}/random`;
    
    try {
        // Use CORS proxy directly to avoid CORS errors
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(apiUrl)}`;
        const proxyResponse = await fetch(proxyUrl).catch(() => null);
        
        if (!proxyResponse || !proxyResponse.ok) {
            return {
                petType: petType,
                petName: 'Unknown',
                imageUrl: ''
            };
        }
        
        const data = await proxyResponse.json().catch(() => null);
        if (!data || !data.image) {
            return {
                petType: petType,
                petName: 'Unknown',
                imageUrl: ''
            };
        }
        
        return {
            petType: data.type || petType,
            petName: data.name || 'Unknown',
            imageUrl: data.image || ''
        };
    } catch (error) {
        // Silently fail - don't log errors to console
        return {
            petType: petType,
            petName: 'Unknown',
            imageUrl: ''
        };
    }
}

// Add a pet photo message to the pet-photos channel
async function addPetPhotoMessage() {
    const now = Date.now();
    
    // Rate limiting: don't make API calls more frequently than the limit
    if (now - lastPetPhotoFetchTime < PET_PHOTO_RATE_LIMIT_MS) {
        // Too soon, skip this fetch entirely
        return;
    }
    
    // Update last fetch time
    lastPetPhotoFetchTime = now;
    
    const petData = await fetchPetPhoto();
    if (!petData.imageUrl) return; // Skip if no image
    
    const username = FAKE_USERNAMES[Math.floor(Math.random() * FAKE_USERNAMES.length)];
    const avatar = FAKE_AVATARS[Math.floor(Math.random() * FAKE_AVATARS.length)];
    const timestamp = formatMessageTime(new Date());
    
    const petPhotoMessage = {
        username,
        avatar,
        petType: petData.petType,
        petName: petData.petName,
        imageUrl: petData.imageUrl,
        timestamp
    };
    
    // Add to gameState
    if (!gameState.petPhotos) {
        gameState.petPhotos = [];
    }
    gameState.petPhotos.push(petPhotoMessage);
    
    // Limit array size to prevent memory issues
    if (gameState.petPhotos.length > MAX_PET_PHOTOS) {
        gameState.petPhotos = gameState.petPhotos.slice(-MAX_PET_PHOTOS);
    }
    
    autoSave();
    
    // If the pet-photos channel is currently open, append the new message directly
    if (currentServer === 'generator1' && currentChannel === 'pet-photos') {
        const messagesContainer = document.getElementById('messages-container');
        if (messagesContainer) {
            const wasNearBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 100;
            
            const messageHtml = `
                <div class="discord-message">
                    <div class="message-avatar">${petPhotoMessage.avatar}</div>
                    <div class="message-content">
                        <div class="message-header">
                            <span class="message-username">${petPhotoMessage.username}</span>
                            <span class="message-timestamp">${petPhotoMessage.timestamp}</span>
                        </div>
                        <div class="message-text">this is my ${petPhotoMessage.petType}, their name is ${petPhotoMessage.petName}</div>
                        <div class="message-image-container">
                            <img src="${petPhotoMessage.imageUrl}" alt="${petPhotoMessage.petName}" class="message-image" />
                        </div>
                    </div>
                </div>
            `;
            
            const messageElement = document.createElement('div');
            messageElement.className = 'discord-message';
            messageElement.innerHTML = messageHtml;
            messagesContainer.appendChild(messageElement);
            
            // Remove old messages if we exceed the display limit (remove from top)
            const messages = messagesContainer.querySelectorAll('.discord-message');
            if (messages.length > MAX_DISPLAYED_PET_PHOTOS) {
                const messagesToRemove = messages.length - MAX_DISPLAYED_PET_PHOTOS;
                for (let i = 0; i < messagesToRemove; i++) {
                    messages[i].remove();
                }
            }
            
            // Check if the new message is visible on screen
            const messageRect = messageElement.getBoundingClientRect();
            const containerRect = messagesContainer.getBoundingClientRect();
            const isMessageVisible = messageRect.top - 100 < containerRect.bottom && messageRect.bottom > containerRect.top;
            
            if (isMessageVisible) {
                // If message is visible, scroll down by the image height
                const imageElement = messageElement.querySelector('.message-image');
                if (imageElement) {
                    // Wait for image to load to get accurate height
                    imageElement.onload = () => {
                        const imageHeight = imageElement.offsetHeight;
                        messagesContainer.scrollTop += imageHeight;
                    };
                    // If image is already loaded, adjust immediately
                    if (imageElement.complete) {
                        const imageHeight = imageElement.offsetHeight;
                        messagesContainer.scrollTop += imageHeight + 500;
                    }
                } else {
                    // No image yet, just scroll to bottom if was near bottom
                    if (wasNearBottom) {
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }
                }
            }
            // If message is not visible, don't change scroll position at all
        }
    }
}

// Create and add a fake message to the chat
function addFakeMessage() {
    const messagesContainer = document.getElementById('messages-container');
    if (!messagesContainer) return;
    
    const username = FAKE_USERNAMES[Math.floor(Math.random() * FAKE_USERNAMES.length)];
    const avatar = FAKE_AVATARS[Math.floor(Math.random() * FAKE_AVATARS.length)];
    const messageText = generateRandomMessage();
    const timestamp = formatMessageTime(new Date());
    
    const messageHtml = `
        <div class="discord-message">
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-username">${username}</span>
                    <span class="message-timestamp">${timestamp}</span>
                </div>
                <div class="message-text">${messageText}</div>
            </div>
        </div>
    `;
    
    // Store message in session
    sessionMessages.push(messageHtml);
    
    const messageElement = document.createElement('div');
    messageElement.className = 'discord-message';
    messageElement.innerHTML = messageHtml;
    
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
        gameState.messages = gameState.messages + BigInt(wholePart);
        gameState.lifetimeMessages = (gameState.lifetimeMessages || 0n) + BigInt(wholePart);
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

// Setup DM input for RemagOfficial channel
function setupDMInput() {
    const input = document.getElementById('dm-input');
    const sendButton = document.getElementById('dm-send-button');
    const counter = document.getElementById('dm-counter');
    
    if (!input || !counter) return;
    
    const maxChars = 5000;
    let pressedKeys = new Set();
    
    // Update counter display
    function updateCounter() {
        const current = gameState.dmCharacters || 0;
        const capped = Math.min(current, maxChars);
        // Cap the actual value to prevent going over
        if (current > maxChars) {
            gameState.dmCharacters = maxChars;
        }
        counter.textContent = `${formatNumber(capped, 0)}/${formatNumber(maxChars, 0)}`;
        autoSave(); // Save progress
        
        // If we just reached the max, set reward message timestamp and reload channel
        if (capped >= maxChars) {
            // Set reward message timestamp if not already set
            if (!gameState.dmMessageTimestamps) {
                gameState.dmMessageTimestamps = {
                    message1: null,
                    message2: null,
                    rewardMessage: null
                };
            }
            if (!gameState.dmMessageTimestamps.rewardMessage) {
                gameState.dmMessageTimestamps.rewardMessage = Date.now();
                autoSave();
            }
            
            // Set ping if channel is not open
            if (!(currentServer === 'home' && currentChannel === 'remagofficial')) {
                if (!gameState.dmPings) {
                    gameState.dmPings = { message2: false, rewardMessage: false };
                }
                gameState.dmPings.rewardMessage = true;
                autoSave();
                updateServerPings();
                // Reload server to update channel list ping
                if (currentServer === 'home') {
                    loadServer('home');
                }
            } else {
                setTimeout(() => {
                    loadChannel('remagofficial');
                }, 100);
            }
        }
    }
    
    // Handle input events
    let lastInputTime = 0;
    let isPasting = false;
    input.addEventListener('input', (e) => {
        const now = Date.now();
        const inputValue = input.value;
        
        // If pasting, only count 1 character
        if (isPasting) {
            input.value = '';
            e.preventDefault();
            if (gameState.dmCharacters < maxChars) {
                gameState.dmCharacters = (gameState.dmCharacters || 0) + 1;
                updateCounter();
            }
            return;
        }
        
        // Only process if there's new input and enough time has passed
        if (inputValue.length > 0 && now - lastInputTime > 50) {
            lastInputTime = now;
            
            // Limit to 1 character per input event
            if (inputValue.length === 1 && gameState.dmCharacters < maxChars) {
                gameState.dmCharacters = (gameState.dmCharacters || 0) + 1;
                updateCounter();
            }
            
            // Clear input
            input.value = '';
        }
        
        e.preventDefault();
    });
    
    // Handle keydown for desktop
    input.addEventListener('keydown', (e) => {
        // Prevent default behavior and clear input
        e.preventDefault();
        input.value = '';
        
        // Only count printable characters (not special keys)
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && !pressedKeys.has(e.key)) {
            pressedKeys.add(e.key);
            if (gameState.dmCharacters < maxChars) {
                gameState.dmCharacters = (gameState.dmCharacters || 0) + 1;
                updateCounter();
            }
        }
    });
    
    input.addEventListener('keyup', (e) => {
        // Remove key from pressed set when released
        pressedKeys.delete(e.key);
    });
    
    input.addEventListener('paste', (e) => {
        e.preventDefault();
        isPasting = true;
        
        // Paste only counts as 1 character
        if (gameState.dmCharacters < maxChars) {
            gameState.dmCharacters = (gameState.dmCharacters || 0) + 1;
            updateCounter();
        }
        
        // Clear input
        input.value = '';
        
        // Reset paste flag after a short delay
        setTimeout(() => {
            isPasting = false;
        }, 100);
    });
    
    // Send button click handler (also counts as 1 character)
    if (sendButton) {
        sendButton.addEventListener('mousedown', (e) => {
            e.preventDefault();
        });
        
        sendButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
        });
        
        sendButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (input) {
                input.blur();
            }
            
            if (gameState.dmCharacters < maxChars) {
                gameState.dmCharacters = (gameState.dmCharacters || 0) + 1;
                updateCounter();
            }
        });
        
        sendButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (input) {
                input.blur();
            }
            
            if (gameState.dmCharacters < maxChars) {
                gameState.dmCharacters = (gameState.dmCharacters || 0) + 1;
                updateCounter();
            }
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
                
                // Disable debug tools on reset
                sessionStorage.removeItem('debugToolsUnlocked');
                const debugSection = document.getElementById('debug-tools-section');
                if (debugSection) {
                    debugSection.style.display = 'none';
                }
                
                // Reset game state
                gameState.messages = 0n;
                gameState.fractionalMessages = 0;
                gameState.lifetimeMessages = 0n;
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
                gameState.research = {
                    globalBoostPurchased: false,
                    manualProduction: 0,
                    botProduction: 0,
                    cascadeProduction: 0,
                    petPhotosUnlocked: false,
                    offTopicUnlocked: false,
                    techUnlocked: false,
                    scienceUnlocked: false
                };
                gameState.generators = {
                    unlocked: [],
                    generator1: { bots: 0, efficiency: 1.0, botSpeed: 0, autoBuy: false, autoBuyPurchased: false, autoBuyDelayLevel: 0, prestigeLevel: 0 },
                    generator2: { cascades: 0, cascadeEfficiency: 0.1, autoBuy: false, autoBuyPurchased: false, autoBuyDelayLevel: 0, prestigeLevel: 0 }
                };
                
                // Reset DM progress
                gameState.dmCharacters = 0;
                gameState.dmRewardClaimed = false;
                gameState.generator1BotMessages = 0n;
                gameState.generator1BotMessagesFractional = 0;
                gameState.petPhotos = [];
                gameState.achievements = {};
                gameState.dmMessageTimestamps = {
                    message1: null,
                    message2: null,
                    rewardMessage: null
                };
                gameState.dmPings = {
                    message1: false,
                    message2: false,
                    rewardMessage: false
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
    
    // Check if debug tools were previously unlocked in this session
    const checkDebugUnlock = () => {
        const debugSection = document.getElementById('debug-tools-section');
        if (debugSection) {
            const isUnlocked = sessionStorage.getItem('debugToolsUnlocked') === 'true';
            if (isUnlocked) {
                debugSection.style.display = 'block';
            } else {
                debugSection.style.display = 'none';
            }
        }
    };
    
    // Check when settings channel is loaded
    checkDebugUnlock();
    
    // Debug: Add messages
    const debugAddMessagesBtn = document.getElementById('debug-add-messages');
    if (debugAddMessagesBtn) {
        debugAddMessagesBtn.addEventListener('click', () => {
            gameState.messages = gameState.messages + 10000n;
            autoSave();
            updateCurrencyDisplay();
            updateUpgradeButtonStates();
        });
    }
    
    // Debug: Double messages
    const debugDoubleMessagesBtn = document.getElementById('debug-double-messages');
    if (debugDoubleMessagesBtn) {
        debugDoubleMessagesBtn.addEventListener('click', () => {
            gameState.messages = gameState.messages * 1000n;
            autoSave();
            updateCurrencyDisplay();
            updateUpgradeButtonStates();
        });
    }
    
    // Debug: Set messages from text input (supports scientific notation)
    const debugSetMessagesBtn = document.getElementById('debug-set-messages-btn');
    const debugSetMessagesInput = document.getElementById('debug-set-messages');
    if (debugSetMessagesBtn && debugSetMessagesInput) {
        const parseNumberInput = (input) => {
            if (!input || input.trim() === '') return null;
            
            const trimmed = input.trim().toLowerCase();
            
            // Handle scientific notation (e.g., 1e100, 1.5e+1000, 2e-10)
            const scientificMatch = trimmed.match(/^([\d.]+)e([+-]?)(\d+)$/);
            if (scientificMatch) {
                const base = parseFloat(scientificMatch[1]);
                const sign = scientificMatch[2] === '-' ? -1 : 1;
                const exponent = parseInt(scientificMatch[3], 10) * sign;
                
                if (!isFinite(base) || !isFinite(exponent) || exponent < 0) return null;
                
                // For very large exponents, construct BigInt more efficiently
                if (exponent > 308 || base * Math.pow(10, Math.min(exponent, 308)) > Number.MAX_SAFE_INTEGER) {
                    // Too large for Number, construct BigInt from string
                    const baseStr = base.toString();
                    const baseParts = baseStr.split('.');
                    const integerPart = baseParts[0];
                    const decimalPart = baseParts[1] || '';
                    
                    // Combine integer and decimal parts
                    const allDigits = integerPart + decimalPart;
                    
                    // Remove leading zeros
                    let significantDigits = allDigits.replace(/^0+/, '');
                    if (significantDigits === '') significantDigits = '0';
                    
                    // Calculate how many zeros to add after the significant digits
                    // adjustedExponent accounts for the decimal places we already have
                    const adjustedExponent = exponent - decimalPart.length;
                    
                    if (adjustedExponent < 0) {
                        // Would result in a decimal number, return null (we only support integers)
                        return null;
                    }
                    
                    // Construct the number string efficiently
                    // Instead of using '0'.repeat() which can fail for very large numbers,
                    // we'll build it in chunks or use a more efficient method
                    try {
                        // For very large exponents, we need to be more careful
                        // Calculate the final length
                        const finalLength = significantDigits.length + adjustedExponent;
                        
                        // If the final length is reasonable (< 1 million digits), construct directly
                        if (finalLength < 1000000) {
                            const zerosToAdd = adjustedExponent;
                            // Build zeros in chunks to avoid memory issues
                            let zeros = '';
                            const chunkSize = 10000;
                            const fullChunks = Math.floor(zerosToAdd / chunkSize);
                            const remainder = zerosToAdd % chunkSize;
                            
                            for (let i = 0; i < fullChunks; i++) {
                                zeros += '0'.repeat(chunkSize);
                            }
                            zeros += '0'.repeat(remainder);
                            
                            const numberStr = significantDigits + zeros;
                            return BigInt(numberStr);
                        } else {
                            // For extremely large numbers, use a different approach
                            // We'll construct using BigInt multiplication
                            // Start with the significant digits as BigInt
                            let result = BigInt(significantDigits);
                            
                            // Multiply by 10^exponent in chunks
                            // 10^exponent = 10^(chunk1) * 10^(chunk2) * ...
                            const chunkSize = 1000; // Process exponent in chunks
                            let remainingExponent = adjustedExponent;
                            
                            while (remainingExponent > 0) {
                                const currentChunk = Math.min(remainingExponent, chunkSize);
                                const multiplier = BigInt(10) ** BigInt(currentChunk);
                                result = result * multiplier;
                                remainingExponent -= currentChunk;
                            }
                            
                            return result;
                        }
                    } catch (e) {
                        return null;
                    }
                } else {
                    // Small enough to use regular Number conversion
                    const value = base * Math.pow(10, exponent);
                    if (!isFinite(value)) return null;
                    try {
                        return BigInt(Math.floor(value));
                    } catch (e) {
                        return null;
                    }
                }
            }
            
            // Handle regular number (try BigInt first, then Number)
            try {
                // Try parsing as BigInt directly
                if (trimmed.includes('n')) {
                    return BigInt(trimmed.replace('n', ''));
                }
                // Try as regular integer
                const bigIntValue = BigInt(trimmed);
                return bigIntValue;
            } catch (e) {
                // If BigInt fails, try Number
                const numValue = parseFloat(trimmed);
                if (!isFinite(numValue)) return null;
                try {
                    return BigInt(Math.floor(numValue));
                } catch (e2) {
                    return null;
                }
            }
        };
        
        const handleSetMessages = () => {
            const input = debugSetMessagesInput.value;
            const parsed = parseNumberInput(input);
            
            if (parsed === null) {
                alert('Invalid number format. Please enter a number or scientific notation (e.g., 1e100, 1.5e+1000)');
                return;
            }
            
            if (parsed < 0n) {
                alert('Message count cannot be negative');
                return;
            }
            
            gameState.messages = parsed;
            gameState.fractionalMessages = 0; // Reset fractional when setting directly
            autoSave();
            updateCurrencyDisplay();
            updateUpgradeButtonStates();
            debugSetMessagesInput.value = ''; // Clear input
        };
        
        debugSetMessagesBtn.addEventListener('click', handleSetMessages);
        
        // Allow Enter key to submit
        debugSetMessagesInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                handleSetMessages();
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
    
    // Check max level limit
    if (currentLevel >= GLOBAL_UPGRADE_MAX_LEVELS.manualGenerationMultiplier) {
        return; // Already at max
    }
    
    const count = Math.min(bulkPurchaseAmount, GLOBAL_UPGRADE_MAX_LEVELS.manualGenerationMultiplier - currentLevel);
    const totalCost = getBulkManualGenerationUpgradeCost(currentLevel, count, GLOBAL_UPGRADE_MAX_LEVELS.manualGenerationMultiplier);
    const totalMessages = getTotalMessagesAsNumber();
    
    if (totalMessages >= totalCost && count > 0) {
        // Deduct cost
        if (gameState.fractionalMessages >= totalCost) {
            gameState.fractionalMessages -= totalCost;
        } else {
            const remaining = totalCost - gameState.fractionalMessages;
            gameState.fractionalMessages = 0;
            gameState.messages = gameState.messages - BigInt(Math.ceil(remaining));
        }
        
        gameState.upgrades.manualGenerationMultiplier = currentLevel + count;
        checkAchievements();
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
    
    const count = Math.min(bulkPurchaseAmount, GLOBAL_UPGRADE_MAX_LEVELS.autoGenerationBoost - currentLevel);
    const totalCost = getBulkAutoGenerationBoostCost(currentLevel, count, GLOBAL_UPGRADE_MAX_LEVELS.autoGenerationBoost);
    const totalMessages = getTotalMessagesAsNumber();
    
    if (totalMessages >= totalCost && count > 0) {
        // Deduct cost
        if (gameState.fractionalMessages >= totalCost) {
            gameState.fractionalMessages -= totalCost;
        } else {
            const remaining = totalCost - gameState.fractionalMessages;
            gameState.fractionalMessages = 0;
            gameState.messages = gameState.messages - BigInt(Math.ceil(remaining));
        }
        
        gameState.upgrades.autoGenerationBoost = currentLevel + count;
        checkAchievements();
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
    
    const count = Math.min(bulkPurchaseAmount, GLOBAL_UPGRADE_MAX_LEVELS.messageMultiplier - currentLevel);
    const totalCost = getBulkMessageMultiplierCost(currentLevel, count, GLOBAL_UPGRADE_MAX_LEVELS.messageMultiplier);
    const totalMessages = getTotalMessagesAsNumber();
    
    if (totalMessages >= totalCost && count > 0) {
        // Deduct cost
        if (gameState.fractionalMessages >= totalCost) {
            gameState.fractionalMessages -= totalCost;
        } else {
            const remaining = totalCost - gameState.fractionalMessages;
            gameState.fractionalMessages = 0;
            gameState.messages = gameState.messages - BigInt(Math.ceil(remaining));
        }
        
        gameState.upgrades.messageMultiplier = currentLevel + count;
        checkAchievements();
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
    
    const count = Math.min(bulkPurchaseAmount, GLOBAL_UPGRADE_MAX_LEVELS.costEfficiency - currentLevel);
    const totalCost = getBulkCostEfficiencyCost(currentLevel, count, GLOBAL_UPGRADE_MAX_LEVELS.costEfficiency);
    const totalMessages = getTotalMessagesAsNumber();
    
    if (totalMessages >= totalCost && count > 0) {
        // Deduct cost
        if (gameState.fractionalMessages >= totalCost) {
            gameState.fractionalMessages -= totalCost;
        } else {
            const remaining = totalCost - gameState.fractionalMessages;
            gameState.fractionalMessages = 0;
            gameState.messages = gameState.messages - BigInt(Math.ceil(remaining));
        }
        
        gameState.upgrades.costEfficiency = currentLevel + count;
        checkAchievements();
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
    
    const count = Math.min(bulkPurchaseAmount, maxLevels.botSpeed - currentLevel);
    const totalCost = getBulkBotSpeedCost(currentLevel, count, maxLevels.botSpeed);
    const totalMessages = getTotalMessagesAsNumber();
    
    if (totalMessages >= totalCost && count > 0) {
        // Deduct cost
        if (gameState.fractionalMessages >= totalCost) {
            gameState.fractionalMessages -= totalCost;
        } else {
            const remaining = totalCost - gameState.fractionalMessages;
            gameState.fractionalMessages = 0;
            gameState.messages = gameState.messages - BigInt(Math.ceil(remaining));
        }
        
        gen.botSpeed = currentLevel + count;
        checkAchievements();
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
    const totalMessages = getTotalMessagesAsNumber();
    
    if (totalMessages >= cost) {
        // Deduct cost
        if (gameState.fractionalMessages >= cost) {
            gameState.fractionalMessages -= cost;
        } else {
            const remaining = cost - gameState.fractionalMessages;
            gameState.fractionalMessages = 0;
            gameState.messages = gameState.messages - BigInt(Math.ceil(remaining));
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
    
    const count = Math.min(bulkPurchaseAmount, maxLevel - currentLevel);
    const totalCost = getBulkAutoBuyDelayCost(currentLevel, count, maxLevel);
    const totalMessages = getTotalMessagesAsNumber();
    
    if (totalMessages >= totalCost && count > 0) {
        // Deduct cost
        if (gameState.fractionalMessages >= totalCost) {
            gameState.fractionalMessages -= totalCost;
        } else {
            const remaining = totalCost - gameState.fractionalMessages;
            gameState.fractionalMessages = 0;
            gameState.messages = gameState.messages - BigInt(Math.ceil(remaining));
        }
        
        gen.autoBuyDelayLevel = (gen.autoBuyDelayLevel || 0) + count;
        // Cap at max level
        if (gen.autoBuyDelayLevel > maxLevel) {
            gen.autoBuyDelayLevel = maxLevel;
        }
        checkAchievements();
        autoSave();
        updateCurrencyDisplay();
        
        // Only refresh UI if on upgrades channel
        if (currentServer === 'generator1' && currentChannel === 'general') {
            updateUpgradeButtonStates();
        }
        // Otherwise, just update currency (no UI refresh needed)
    }
}

// Achievement definitions
const ACHIEVEMENTS = [
    // Progress Achievements
    { id: 'first_steps', name: 'First Steps', description: 'Generate your first {target} messages', target: 100, category: 'progress', check: () => Number(gameState.lifetimeMessages) >= 100 },
    { id: 'getting_started', name: 'Getting Started', description: 'Generate {target} messages', target: 1000, category: 'progress', check: () => Number(gameState.lifetimeMessages) >= 1000 },
    { id: 'making_progress', name: 'Making Progress', description: 'Generate {target} messages', target: 10000, category: 'progress', check: () => Number(gameState.lifetimeMessages) >= 10000 },
    { id: 'milestone', name: 'Milestone', description: 'Generate {target} messages', target: 100000, category: 'progress', check: () => Number(gameState.lifetimeMessages) >= 100000 },
    { id: 'big_numbers', name: 'Big Numbers', description: 'Generate {target} messages', target: 1000000, category: 'progress', check: () => Number(gameState.lifetimeMessages) >= 1000000 },
    { id: 'billionaire', name: 'Billionaire', description: 'Generate {target} messages', target: 1000000000, category: 'progress', check: () => Number(gameState.lifetimeMessages) >= 1000000000 },
    { id: 'trillionaire', name: 'Trillionaire', description: 'Generate {target} messages', target: 1000000000000, category: 'progress', check: () => Number(gameState.lifetimeMessages) >= 1000000000000 },
    
    // Generator Achievements
    { id: 'automation', name: 'Automation', description: 'Unlock your first generator', category: 'generator', check: () => gameState.generators.unlocked.length >= 1 },
    { id: 'bot_army', name: 'Bot Army', description: 'Purchase 10 bots', category: 'generator', check: () => (gameState.generators.generator1?.bots || 0) >= 10 },
    { id: 'bot_master', name: 'Bot Master', description: 'Purchase 50 bots', category: 'generator', check: () => (gameState.generators.generator1?.bots || 0) >= 50 },
    { id: 'cascade_unlocked', name: 'Cascade Unlocked', description: 'Unlock Generator 2', category: 'generator', check: () => isGeneratorUnlocked('generator2') },
    { id: 'cascade_master', name: 'Cascade Master', description: 'Purchase 10 cascades', category: 'generator', check: () => (gameState.generators.generator2?.cascades || 0) >= 10 },
    { id: 'research_lab', name: 'Research Lab', description: 'Unlock Generator 3', category: 'generator', check: () => isGeneratorUnlocked('generator3') },
    { id: 'all_generators', name: 'All Generators', description: 'Unlock all 3 generators', category: 'generator', check: () => gameState.generators.unlocked.length >= 3 },
    
    // Production Achievements
    { id: 'speed_demon', name: 'Speed Demon', description: 'Reach 100 msg/s', category: 'production', check: () => getTotalMessagesPerSecond() >= 100 },
    { id: 'powerhouse', name: 'Powerhouse', description: 'Reach 1,000 msg/s', category: 'production', check: () => getTotalMessagesPerSecond() >= 1000 },
    { id: 'lightning_fast', name: 'Lightning Fast', description: 'Reach 10,000 msg/s', category: 'production', check: () => getTotalMessagesPerSecond() >= 10000 },
    { id: 'unstoppable', name: 'Unstoppable', description: 'Reach 100,000 msg/s', category: 'production', check: () => getTotalMessagesPerSecond() >= 100000 },
    
    // Upgrade Achievements
    { id: 'first_upgrade', name: 'First Upgrade', description: 'Purchase your first upgrade', category: 'upgrade', check: () => {
        const gen1 = gameState.generators.generator1 || {};
        const gen2 = gameState.generators.generator2 || {};
        return (gameState.upgrades.manualGenerationMultiplier || 0) > 0 ||
               (gameState.upgrades.autoGenerationBoost || 0) > 0 ||
               (gameState.upgrades.messageMultiplier || 0) > 0 ||
               (gameState.upgrades.costEfficiency || 0) > 0 ||
               (gen1.efficiency || 1.0) > 1.0 ||
               (gen1.botSpeed || 0) > 0 ||
               (gen2.cascadeEfficiency || 0.1) > 0.1;
    }},
    { id: 'maxed_out', name: 'Maxed Out', description: 'Max out any upgrade', category: 'upgrade', check: () => {
        const gen1 = gameState.generators.generator1 || {};
        const gen2 = gameState.generators.generator2 || {};
        const maxLevels1 = getGenerator1MaxLevels();
        const maxLevels2 = getGenerator2MaxLevels();
        const globalMax = GLOBAL_UPGRADE_MAX_LEVELS;
        return (gameState.upgrades.manualGenerationMultiplier || 0) >= globalMax.manualGenerationMultiplier ||
               (gameState.upgrades.autoGenerationBoost || 0) >= globalMax.autoGenerationBoost ||
               (gameState.upgrades.messageMultiplier || 0) >= globalMax.messageMultiplier ||
               (gameState.upgrades.costEfficiency || 0) >= globalMax.costEfficiency ||
               (gen1.bots || 0) >= maxLevels1.bots ||
               (gen1.efficiency || 1.0) >= (1.0 * Math.pow(1.1, maxLevels1.efficiency)) ||
               (gen1.botSpeed || 0) >= maxLevels1.botSpeed ||
               (gen1.autoBuyDelayLevel || 0) >= maxLevels1.autoBuyDelay ||
               (gen2.cascades || 0) >= maxLevels2.cascades ||
               (gen2.cascadeEfficiency || 0.1) >= (0.1 * Math.pow(1.1, maxLevels2.cascadeEfficiency)) ||
               (gen2.autoBuyDelayLevel || 0) >= maxLevels2.autoBuyDelay;
    }},
    { id: 'fully_upgraded', name: 'Fully Upgraded', description: 'Max out all upgrades on a generator', category: 'upgrade', check: () => {
        const gen1 = gameState.generators.generator1 || {};
        const gen2 = gameState.generators.generator2 || {};
        const maxLevels1 = getGenerator1MaxLevels();
        const maxLevels2 = getGenerator2MaxLevels();
        const gen1Maxed = (gen1.bots || 0) >= maxLevels1.bots &&
                          (gen1.efficiency || 1.0) >= (1.0 * Math.pow(1.1, maxLevels1.efficiency)) &&
                          (gen1.botSpeed || 0) >= maxLevels1.botSpeed &&
                          (gen1.autoBuyDelayLevel || 0) >= maxLevels1.autoBuyDelay;
        const gen2Maxed = (gen2.cascades || 0) >= maxLevels2.cascades &&
                          (gen2.cascadeEfficiency || 0.1) >= (0.1 * Math.pow(1.1, maxLevels2.cascadeEfficiency)) &&
                          (gen2.autoBuyDelayLevel || 0) >= maxLevels2.autoBuyDelay;
        return gen1Maxed || gen2Maxed;
    }},
    { id: 'research_master', name: 'Research Master', description: 'Max out all research upgrades', category: 'upgrade', check: () => {
        return (gameState.research.manualProduction || 0) >= 5 &&
               (gameState.research.botProduction || 0) >= 5 &&
               (gameState.research.cascadeProduction || 0) >= 5;
    }},
    { id: 'global_power', name: 'Global Power', description: 'Purchase the global research boost', category: 'upgrade', check: () => gameState.research.globalBoostPurchased === true },
    
    // Prestige Achievements
    { id: 'first_prestige', name: 'First Prestige', description: 'Prestige a generator for the first time', category: 'prestige', check: () => {
        const gen1 = gameState.generators.generator1 || {};
        const gen2 = gameState.generators.generator2 || {};
        return (gen1.prestigeLevel || 0) > 0 || (gen2.prestigeLevel || 0) > 0;
    }},
    { id: 'prestige_master', name: 'Prestige Master', description: 'Reach prestige level 5 on any generator', category: 'prestige', check: () => {
        const gen1 = gameState.generators.generator1 || {};
        const gen2 = gameState.generators.generator2 || {};
        return (gen1.prestigeLevel || 0) >= 5 || (gen2.prestigeLevel || 0) >= 5;
    }},
    { id: 'dedication', name: 'Dedication', description: 'Reach prestige level 10 on any generator', category: 'prestige', check: () => {
        const gen1 = gameState.generators.generator1 || {};
        const gen2 = gameState.generators.generator2 || {};
        return (gen1.prestigeLevel || 0) >= 10 || (gen2.prestigeLevel || 0) >= 10;
    }},
    
    // Special Achievements
    { id: 'dm_champion', name: 'DM Champion', description: 'Complete the RemagOfficial DM challenge', category: 'special', check: () => gameState.dmRewardClaimed === true },
    { id: 'pet_lover', name: 'Pet Lover', description: 'Unlock the pet-photos channel', category: 'special', check: () => gameState.research.petPhotosUnlocked === true },
    { id: 'social_butterfly', name: 'Social Butterfly', description: 'Unlock all chat channels (off-topic, tech, science)', category: 'special', check: () => {
        return gameState.research.offTopicUnlocked === true &&
               gameState.research.techUnlocked === true &&
               gameState.research.scienceUnlocked === true;
    }},
    { id: 'veteran', name: 'Veteran', description: 'Play for 1 hour total', category: 'special', check: () => (gameState.playtime || 0) >= 3600000 },
    { id: 'dedicated_player', name: 'Dedicated', description: 'Play for 10 hours total', category: 'special', check: () => (gameState.playtime || 0) >= 36000000 },
    { id: 'lifetime', name: 'Lifetime', description: 'Generate {target} lifetime messages', target: 1000000, category: 'special', check: () => Number(gameState.lifetimeMessages) >= 1000000 },
    
    // Secret Achievements
    { id: 'cheater', name: 'Cheater', description: 'Use debug tools', category: 'secret', check: () => sessionStorage.getItem('debugToolsUnlocked') === 'true' },
    { id: 'speed_runner', name: 'Speed Runner', description: 'Unlock all generators in under 5 minutes', category: 'secret', check: () => {
        // This would need to track when generators were unlocked - for now, check if all are unlocked and playtime is low
        return gameState.generators.unlocked.length >= 3 && (gameState.playtime || 0) < 300000;
    }},
    { id: 'perfectionist', name: 'Perfectionist', description: 'Complete all other achievements', category: 'secret', check: () => {
        // Check if all other achievements are unlocked (excluding this one)
        const otherAchievements = ACHIEVEMENTS.filter(a => a.id !== 'perfectionist');
        return otherAchievements.every(a => gameState.achievements[a.id] === true);
    }}
];

// Check and unlock achievements
function checkAchievements() {
    let newAchievements = [];
    
    ACHIEVEMENTS.forEach(achievement => {
        // Skip if already unlocked
        if (gameState.achievements[achievement.id] === true) {
            return;
        }
        
        // Check if achievement condition is met
        try {
            if (achievement.check()) {
                gameState.achievements[achievement.id] = true;
                newAchievements.push(achievement);
                autoSave();
            }
        } catch (e) {
            console.error(`Error checking achievement ${achievement.id}:`, e);
        }
    });
    
    // Show toast for new achievements
    if (newAchievements.length > 0) {
        newAchievements.forEach(achievement => {
            showToast(`Achievement Unlocked: ${achievement.name}!`, 4000);
        });
        
        // Refresh achievements display if channel is open
        if (currentServer === 'home' && currentChannel === 'achievements') {
            renderAchievements();
        }
    }
}

// Render achievements in the achievements channel
function renderAchievements() {
    let container = document.getElementById('achievements-container');
    if (!container) {
        // Create container if it doesn't exist
        const contentBody = document.getElementById('content-body');
        if (contentBody) {
            contentBody.innerHTML = `
                <div class="settings-content">
                    <div class="settings-section">
                        <h3 class="settings-title">Achievements</h3>
                        <p class="settings-description">View your achievements and milestones.</p>
                        <div class="achievements-container" id="achievements-container">
                            <!-- Achievements will be displayed here -->
                        </div>
                    </div>
                </div>
            `;
            // Get the container after creating it
            container = document.getElementById('achievements-container');
        }
        if (!container) return; // Still no container, can't render
    }
    
    // Group achievements by category
    const categories = {
        progress: { name: 'Progress', achievements: [] },
        generator: { name: 'Generators', achievements: [] },
        production: { name: 'Production', achievements: [] },
        upgrade: { name: 'Upgrades', achievements: [] },
        prestige: { name: 'Prestige', achievements: [] },
        special: { name: 'Special', achievements: [] },
        secret: { name: 'Secret', achievements: [] }
    };
    
    ACHIEVEMENTS.forEach(achievement => {
        const isUnlocked = gameState.achievements[achievement.id] === true;
        // Hide secret achievements until unlocked
        if (achievement.category === 'secret' && !isUnlocked) {
            return;
        }
        if (categories[achievement.category]) {
            categories[achievement.category].achievements.push({ ...achievement, unlocked: isUnlocked });
        }
    });
    
    let html = '';
    Object.values(categories).forEach(category => {
        if (category.achievements.length === 0) return;
        
        html += `<div class="achievement-category" style="margin-bottom: 30px;">
            <h4 style="color: var(--text-bright); margin-bottom: 15px; font-size: 18px;">${category.name}</h4>
            <div class="achievements-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">`;
        
        category.achievements.forEach(achievement => {
            // Format description with target number if it exists
            let description = achievement.description;
            if (achievement.target !== undefined) {
                const formattedTarget = formatNumber(BigInt(achievement.target), 2);
                description = description.replace('{target}', formattedTarget);
            }
            
            html += `
                <div class="achievement-item" style="
                    background-color: var(--bg-medium, #2f3136);
                    border: 2px solid ${achievement.unlocked ? 'var(--accent-color, #5865f2)' : 'rgba(114, 118, 125, 0.3)'};
                    border-radius: 8px;
                    padding: 12px;
                    opacity: ${achievement.unlocked ? '1' : '0.6'};
                ">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                        <span style="font-size: 24px;">${achievement.unlocked ? '✅' : '🔒'}</span>
                        <h5 style="margin: 0; color: var(--text-bright); font-size: 16px; font-weight: 600;">${achievement.name}</h5>
                    </div>
                    <p style="margin: 0; color: var(--text-secondary); font-size: 14px; line-height: 1.4;">${description}</p>
                </div>
            `;
        });
        
        html += `</div></div>`;
    });
    
    // Add progress summary
    const totalAchievements = ACHIEVEMENTS.length;
    const unlockedCount = Object.values(gameState.achievements).filter(v => v === true).length;
    const progressPercent = Math.round((unlockedCount / totalAchievements) * 100);
    
    html = `
        <div style="margin-bottom: 20px; padding: 15px; background-color: var(--bg-medium, #2f3136); border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="color: var(--text-bright); font-weight: 600;">Progress</span>
                <span style="color: var(--text-secondary);">${unlockedCount} / ${totalAchievements}</span>
            </div>
            <div style="background-color: var(--bg-dark, #202225); border-radius: 4px; height: 8px; overflow: hidden;">
                <div style="background-color: var(--accent-color, #5865f2); height: 100%; width: ${progressPercent}%; transition: width 0.3s ease;"></div>
            </div>
            <div style="margin-top: 8px; text-align: center; color: var(--text-secondary); font-size: 14px;">${progressPercent}% Complete</div>
        </div>
    ` + html;
    
    container.innerHTML = html;
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
            version: 'beta 1.0.8',
            date: formatDate(new Date()), // Release date
            changes: [
                'Added achievements system - track your progress with 30+ achievements across multiple categories',
                'Achievements are displayed in the Achievements channel in the home server',
                'Secret achievements are hidden until unlocked',
                'Auto-buy speed upgrade cap adjusted: Prestige 1 adds 10 levels (max 20), Prestige 2 adds 5 levels (max 25), capped at 25 for both generators',
                'Added bulk purchase feature - buy multiple upgrades at once with selector (1, 5, 10, 25, 50)',
                'Bulk purchase button text now shows actual number of upgrades that will be purchased when selection exceeds max level',
                'Research upgrades with levels now show accent color border when maxed',
                'Fixed research upgrade pings for channel unlocks (Pet Photos, Off-Topic, Tech, Science)',
                'Fixed ghost ping issue with auto-buy delay upgrade in generator1'
            ]
        },
        {
            version: 'beta 1.0.7',
            date: '2025-12-09', // Release date
            changes: [
                'Added off-topic, tech, and science channels to generators - chat messages appear based on generation rates',
                'Switched message counts to BigInt for precise handling of very large numbers (note: BigInt can impact performance on extremely large numbers and may be changed in the future)',
                'Extended abbreviated number formatting beyond trillions (Qa, Qi, Sx, Sp, Oc, No, Dc, and beyond)',
                'Added comma formatting to scientific notation exponents for better readability',
                'Debug tools are now locked by default and require a key sequence to unlock'
            ]
        },
        {
            version: 'beta 1.0.6',
            date: '2025-12-08', // Release date
            changes: [
                'Capitalized settings server channel names to match home server style',
                'Added AI content disclosure to About channel',
                'Improved random messages in Manual Generation channel to sound more like real Discord chat',
                'Updated fake usernames with more modern, gaming-focused handles',
                'Added pet-photos channel to Generator 1 - unlocked via research upgrade after maxing Bot Production'
            ]
        },
        {
            version: 'beta 1.0.5',
            date: '2025-12-07', // Release date
            changes: [
                'Updated home server channels to use capitalized names without dashes',
                'Added SVG icons to home server channels (envelope for Manual Generation, signal for Stats)',
                'Channel icons adapt to light/dark backgrounds and match channel text colors',
                'Added Achievements channel to home server with gem icon',
                'Added DM system - side tasks that reward production bonuses',
                'Replaced channel hashtags with SVG icons that adapt to text colors'
            ]
        },
        {
            version: 'beta 1.0.4',
            date: '2025-12-07', // Release date
            changes: [
                'Added server ping notification system - shows number of affordable upgrades on each server',
                'Locked servers show "!" ping when they can be unlocked',
                'Unlocked servers show count of affordable upgrades (excludes maxed upgrades)',
                'Pings update dynamically as messages/research points accumulate',
                'All generator servers, global upgrades server, and research upgrades are tracked',
                'Prestige upgrades included in ping count when all other upgrades are maxed',
                'Fixed: Research tree upgrades now reset when using the reset game button',
                'Fixed: Generator 2 cascade auto-buy now works correctly'
            ]
        },
        {
            version: 'beta 1.0.3',
            date: '2025-12-06', // Release date
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
            date: '2025-12-06', // Release date
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
            date: '2025-12-06', // Release date
            changes: [
                'Added Discord embed support for link sharing'
            ]
        },
        {
            version: 'beta 1.0.0',
            date: '2025-12-06', // Release date
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

// Debug tools unlock system (global, works from anywhere)
let debugUnlockSequence = [];
const DEBUG_UNLOCK_CODE = ['d', 'e', 'b', 'u', 'g']; // Type "debug" to unlock
let lastKeyTime = 0;

// Show toast notification
function showToast(message, duration = 3000) {
    // Remove existing toast if any
    const existingToast = document.getElementById('toast-notification');
    if (existingToast) {
        existingToast.remove();
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.id = 'toast-notification';
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: var(--bg-medium, #2f3136);
        color: var(--text-bright, #ffffff);
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        font-size: 14px;
        font-weight: 500;
        animation: toastSlideIn 0.3s ease-out;
        max-width: 300px;
        word-wrap: break-word;
    `;
    toast.textContent = message;
    
    // Add animation style if not already added
    if (!document.getElementById('toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            @keyframes toastSlideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes toastSlideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    
    // Remove toast after duration
    setTimeout(() => {
        toast.style.animation = 'toastSlideOut 0.3s ease-out';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 300);
    }, duration);
}

// Global keydown listener for debug unlock (works from anywhere)
document.addEventListener('keydown', (e) => {
    // Skip if already unlocked
    if (sessionStorage.getItem('debugToolsUnlocked') === 'true') {
        return;
    }
    
    // Don't trigger if user is typing in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
    }
    
    const now = Date.now();
    // Reset sequence if more than 2 seconds between keys
    if (now - lastKeyTime > 2000) {
        debugUnlockSequence = [];
    }
    lastKeyTime = now;
    
    // Add the key to the sequence (case insensitive)
    const key = e.key.toLowerCase();
    debugUnlockSequence.push(key);
    
    // Keep only the last N characters (where N is the code length)
    if (debugUnlockSequence.length > DEBUG_UNLOCK_CODE.length) {
        debugUnlockSequence.shift();
    }
    
    // Check if the sequence matches
    if (debugUnlockSequence.length === DEBUG_UNLOCK_CODE.length) {
        let matches = true;
        for (let i = 0; i < DEBUG_UNLOCK_CODE.length; i++) {
            if (debugUnlockSequence[i] !== DEBUG_UNLOCK_CODE[i]) {
                matches = false;
                break;
            }
        }
        
        if (matches) {
            // Unlock debug tools
            sessionStorage.setItem('debugToolsUnlocked', 'true');
            debugUnlockSequence = []; // Reset sequence
            
            // Show toast notification
            showToast('Debug tools unlocked!');
            
            // Update debug section if it exists
            const debugSection = document.getElementById('debug-tools-section');
            if (debugSection) {
                debugSection.style.display = 'block';
            }
        }
    }
});

// Initialize on page load
init();

