const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const playerNameInput = document.getElementById('player-name-input');
const authScreen = document.getElementById('auth-screen');
const saveNameBtn = document.getElementById('save-name-btn');
const homeScreen = document.getElementById('home-screen');
const startBtn = document.getElementById('start-btn');
const openSettingsBtn = document.getElementById('open-settings-btn');
const settingsScreen = document.getElementById('settings-screen');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const openSkinsBtn = document.getElementById('open-skins-btn');
const changeNameBtn = document.getElementById('change-name-btn');
const gameOverHomeBtn = document.getElementById('game-over-home-btn');
const skinsScreen = document.getElementById('skins-screen');
const closeSkinsBtn = document.getElementById('close-skins-btn');
const skinCards = document.querySelectorAll('.skin-card');
const profilePlayerName = document.getElementById('profile-player-name');
const profilePlayerRank = document.getElementById('profile-player-rank');
const gameOverScreen = document.getElementById('game-over-screen');
const scoreDisplay = document.getElementById('score-display');
const finalScoreDisplay = document.getElementById('final-score');
const leaderboardList = document.getElementById('leaderboard-list');
const restartBtn = document.getElementById('restart-btn');
const leaderboardScreen = document.getElementById('leaderboard-screen');
const showLeaderboardBtn = document.getElementById('show-leaderboard-btn');
const closeLeaderboardBtn = document.getElementById('close-leaderboard-btn');
const showLeaderboardStartBtn = document.getElementById('show-leaderboard-start-btn');
const prevPageBtn = document.getElementById('prev-page-btn');
const nextPageBtn = document.getElementById('next-page-btn');

// LootLocker Config
const LL_API_KEY = "dev_c7b99b0ed5f841c1b544970b3c599def";
const LL_LEADERBOARD_ID = "34391";
let sessionToken = null;
let llPlayerId = null;

let playerIdentifier = localStorage.getItem('ll_player_identifier');
if (!playerIdentifier) {
    playerIdentifier = 'player_' + Math.floor(Math.random() * 1000000000);
    localStorage.setItem('ll_player_identifier', playerIdentifier);
}

// Authenticate with LootLocker immediately
async function loginToLootLocker() {
    try {
        const response = await fetch("https://api.lootlocker.io/game/v2/session/guest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                game_key: LL_API_KEY,
                game_version: "1.0.0",
                player_identifier: playerIdentifier
            })
        });
        const data = await response.json();
        if (data.session_token) {
            sessionToken = data.session_token;
            llPlayerId = data.player_id;
            console.log("Logged into LootLocker successfully!");
            if (currentPlayerName) {
                setPlayerName(currentPlayerName);
            }
            fetchTopScore();
            fetchPlayerRank();
        }
    } catch (e) {
        console.error("Error logging in to LootLocker", e);
    }
}
loginToLootLocker();

async function setPlayerName(name) {
    if (!sessionToken) return;
    try {
        await fetch("https://api.lootlocker.io/game/player/name", {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "x-session-token": sessionToken
            },
            body: JSON.stringify({ name: name })
        });
    } catch (e) {
        console.error("Error setting player name", e);
    }
}

async function fetchTopScore() {
    if (!sessionToken) return;
    try {
        const response = await fetch(`https://api.lootlocker.io/game/leaderboards/${LL_LEADERBOARD_ID}/list?count=1`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "x-session-token": sessionToken
            }
        });
        const data = await response.json();
        if (data.items && data.items.length > 0) {
            globalTopScore = data.items[0].score;
            if (personalBestScore >= globalTopScore && globalTopScore > 0) {
                isRankOne = true;
            }
        }
    } catch (e) {
        console.error("Error fetching top score", e);
    }
}

async function fetchPlayerRank() {
    if (!sessionToken || !llPlayerId) return;
    try {
        const response = await fetch(`https://api.lootlocker.io/game/leaderboards/${LL_LEADERBOARD_ID}/member/${llPlayerId}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "x-session-token": sessionToken
            }
        });
        const data = await response.json();
        if (data.rank) {
            profilePlayerRank.innerText = `Rank: #${data.rank}`;
            if (data.rank === 1) profilePlayerRank.innerText += ' 👑';
        } else {
            profilePlayerRank.innerText = `Rank: Unranked`;
        }
    } catch (e) {
        console.error("Error fetching player rank", e);
    }
}

// Game State
let frames = 0;
let gameState = 'auth'; // 'auth', 'start', 'playing', 'gameover'
let score = 0;
let flashAlpha = 0;

let currentPlayerName = localStorage.getItem('flappyPlayerName') || '';
playerNameInput.value = currentPlayerName;
profilePlayerName.innerText = currentPlayerName || 'Player';

if (currentPlayerName) {
    gameState = 'start';
    authScreen.classList.remove('active');
    homeScreen.classList.add('active');
}

let leaderboardPage = 0;
const PAGE_SIZE = 10;

let personalBestScore = parseInt(localStorage.getItem('flappyBestScore')) || 0;
let selectedSkin = localStorage.getItem('flappySelectedSkin') || 'standard';
let globalTopScore = 0;
let isRankOne = false;
let shakeFrames = 0;
let recordAlert = { active: false, alpha: 0 };
let bgTransition = { r: 113, g: 197, b: 207 };

// Bird Object
const bird = {
    x: 100,
    y: 300,
    velocity: 0,
    gravity: 0.25,
    jumpStrength: -6,
    radius: 16,
    rotation: 0,
    
    init() {
        this.img = new Image();
        this.img.src = 'assets/bird.png';
    },

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        if (gameState === 'playing' || gameState === 'gameover') {
            this.rotation = Math.min(Math.PI / 2, Math.max(-Math.PI / 4, (this.velocity * 0.1)));
        }
        ctx.rotate(this.rotation);
        
        // Apply Skin Filters
        if (selectedSkin === 'neon') {
            ctx.filter = 'drop-shadow(0 0 10px #00ffff) hue-rotate(180deg) brightness(1.2)';
        } else if (selectedSkin === 'golden') {
            ctx.filter = 'drop-shadow(0 0 10px #FFD700) sepia(1) saturate(5) hue-rotate(-10deg) brightness(1.1)';
        } else {
            ctx.filter = 'none';
        }

        // Draw the bird image
        // Center it: image is drawn from top-left, so we offset by -radius
        if (this.img.complete) {
            ctx.drawImage(this.img, -this.radius * 1.5, -this.radius * 1.5, this.radius * 3, this.radius * 3);
        } else {
            // Fallback if image hasn't loaded yet
            ctx.fillStyle = '#f3c623';
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        // Reset filter for crown/other overlays
        ctx.filter = 'none';

        if (isRankOne) {
            ctx.shadowBlur = 0;
            ctx.font = '24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('👑', 0, -this.radius * 1.8);
        }

        ctx.restore();
    },
    
    update() {
        if (gameState !== 'playing') return;
        
        this.velocity += this.gravity;
        this.y += this.velocity;
        
        if (this.y + this.radius >= canvas.height - 20) { 
            this.y = canvas.height - 20 - this.radius;
            if (gameState === 'playing') gameOver();
        }
        
        if (this.y - this.radius <= 0) {
            this.y = this.radius;
            this.velocity = 0;
        }
    },
    
    jump() {
        if (this.y > 0) {
            this.velocity = this.jumpStrength;
        }
    },
    
    reset() {
        this.y = canvas.height / 2;
        this.velocity = 0;
        this.rotation = 0;
    }
};

// Pipes Object
const pipes = {
    items: [],
    width: 60,
    gap: 150,
    dx: 3,
    
    draw() {
        for (let i = 0; i < this.items.length; i++) {
            let p = this.items[i];
            
            ctx.fillStyle = '#74bf2e';
            ctx.strokeStyle = '#543847';
            ctx.lineWidth = 3;
            
            ctx.fillRect(p.x, 0, this.width, p.top);
            ctx.strokeRect(p.x, 0, this.width, p.top);
            
            ctx.fillRect(p.x - 5, p.top - 20, this.width + 10, 20);
            ctx.strokeRect(p.x - 5, p.top - 20, this.width + 10, 20);
            
            ctx.fillRect(p.x, canvas.height - p.bottom, this.width, p.bottom);
            ctx.strokeRect(p.x, canvas.height - p.bottom, this.width, p.bottom);
            
            ctx.fillRect(p.x - 5, canvas.height - p.bottom, this.width + 10, 20);
            ctx.strokeRect(p.x - 5, canvas.height - p.bottom, this.width + 10, 20);
        }
    },
    
    update() {
        if (gameState !== 'playing') return;
        
        if (frames % 100 === 0) {
            const minTop = 60;
            const usableHeight = canvas.height - this.gap - 80;
            // Ensure enough range for randomness (min 80px spread)
            const range = Math.max(usableHeight - minTop, 80);
            let topHeight;
            // Force meaningful variation: bias away from last top
            if (this.lastTopHeight !== undefined) {
                const minDist = range * 0.35; // must differ by at least 35% of range
                let attempts = 0;
                do {
                    topHeight = minTop + Math.random() * range;
                    attempts++;
                } while (Math.abs(topHeight - this.lastTopHeight) < minDist && attempts < 20);
            } else {
                topHeight = minTop + Math.random() * range;
            }
            this.lastTopHeight = topHeight;
            let bottomHeight = canvas.height - this.gap - topHeight;
            
            this.items.push({ x: canvas.width, top: topHeight, bottom: bottomHeight, passed: false });
        }
        
        for (let i = 0; i < this.items.length; i++) {
            let p = this.items[i];
            p.x -= this.dx;
            
            let birdLeft = bird.x - bird.radius + 4; 
            let birdRight = bird.x + bird.radius - 4;
            let birdTop = bird.y - bird.radius + 4;
            let birdBottom = bird.y + bird.radius - 4;
            
            if (birdRight > p.x && birdLeft < p.x + this.width && birdTop < p.top) {
                gameOver();
            }
            if (birdRight > p.x && birdLeft < p.x + this.width && birdBottom > canvas.height - p.bottom) {
                gameOver();
            }
            
            if (p.x + this.width < bird.x && !p.passed) {
                score++;
                scoreDisplay.innerText = score;
                p.passed = true;
                
                if (score > 0 && score % 10 === 0) {
                    this.dx += 0.5;
                    if (this.gap > 100) this.gap -= 10;
                }
            }
            
            if (p.x + this.width < -20) {
                this.items.shift();
                i--;
            }
        }
    },
    
    reset() {
        this.items = [];
        this.dx = 3;
        this.gap = 150;
    }
};

// Particles Object
const particles = {
    items: [],
    
    createExplosion(x, y) {
        for (let i = 0; i < 30; i++) {
            this.items.push({
                x: x, y: y,
                vx: (Math.random() - 0.5) * 15,
                vy: (Math.random() - 0.5) * 15,
                life: 1.0,
                color: Math.random() > 0.5 ? '#f3c623' : '#e86101'
            });
        }
    },
    
    update() {
        for (let i = 0; i < this.items.length; i++) {
            let p = this.items[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.03;
            if (p.life <= 0) {
                this.items.splice(i, 1);
                i--;
            }
        }
    },
    
    draw() {
        for (let p of this.items) {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;
    }
};

// Background Object
const background = {
    dx: 1,
    clouds: [
        {x: 50, y: 100, scale: 1},
        {x: 150, y: 150, scale: 1.2},
        {x: 250, y: 80, scale: 0.8}
    ],
    stars: [],

    initStars() {
        for (let i = 0; i < 50; i++) {
            this.stars.push({
                x: Math.random() * 800,
                y: Math.random() * 300,
                alpha: Math.random()
            });
        }
    },

    draw() {
        let target = {r: 113, g: 197, b: 207}; // Day
        if (score >= 20) target = {r: 26, g: 43, b: 76}; // Night
        else if (score >= 10) target = {r: 255, g: 140, b: 58}; // Sunset
        
        bgTransition.r += (target.r - bgTransition.r) * 0.05;
        bgTransition.g += (target.g - bgTransition.g) * 0.05;
        bgTransition.b += (target.b - bgTransition.b) * 0.05;
        
        ctx.fillStyle = `rgb(${Math.round(bgTransition.r)}, ${Math.round(bgTransition.g)}, ${Math.round(bgTransition.b)})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (score >= 20) {
            ctx.fillStyle = '#ffffff';
            for (let s of this.stars) {
                ctx.globalAlpha = s.alpha;
                ctx.fillRect(s.x, s.y, 2, 2);
            }
            ctx.globalAlpha = 1.0;
        }

        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.8;
        
        for (let cloud of this.clouds) {
            ctx.save();
            ctx.translate(cloud.x, cloud.y);
            ctx.scale(cloud.scale, cloud.scale);
            
            ctx.beginPath();
            ctx.arc(0, 0, 20, 0, Math.PI * 2);
            ctx.arc(20, -10, 25, 0, Math.PI * 2);
            ctx.arc(45, 0, 20, 0, Math.PI * 2);
            ctx.arc(25, 10, 25, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
        }
        ctx.globalAlpha = 1.0;

        ctx.fillStyle = '#ded895';
        ctx.fillRect(0, canvas.height - 20, canvas.width, 20);
        ctx.strokeStyle = '#543847';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height - 20);
        ctx.lineTo(canvas.width, canvas.height - 20);
        ctx.stroke();
    },

    update() {
        if (gameState !== 'playing') return;
        for (let cloud of this.clouds) {
            cloud.x -= this.dx * 0.5;
            if (cloud.x < -100) {
                cloud.x = canvas.width + 50;
                cloud.y = Math.random() * 200 + 50;
            }
        }
    }
};
background.initStars();
bird.init();

function resizeCanvas() {
    const container = document.getElementById('game-container');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    
    bird.x = canvas.width * 0.25;
    if (gameState === 'auth' || gameState === 'start') {
        bird.y = canvas.height / 2;
    }
}
window.addEventListener('resize', () => {
    resizeCanvas();
    checkOrientation();
});
resizeCanvas();

// Orientation lock - show blocker in landscape on mobile
const landscapeBlocker = document.getElementById('landscape-blocker');
function checkOrientation() {
    if (window.innerHeight < 500 && window.innerWidth > window.innerHeight) {
        landscapeBlocker.style.display = 'flex';
    } else {
        landscapeBlocker.style.display = 'none';
    }
}
window.addEventListener('orientationchange', () => setTimeout(checkOrientation, 100));
checkOrientation();


// Controls
function handleInput(e) {
    if (e.target && e.target.tagName) {
        const tag = e.target.tagName.toLowerCase();
        if (tag === 'input' || tag === 'button') return;
    }
    
    // Ignore clicks on anything that isn't the canvas when not playing
    if (e.target && e.target !== canvas && e.code !== 'Space') {
        return; 
    }
    
    if (e.type === 'keydown' && e.code !== 'Space') return;
    if (e.type === 'mousedown' && e.button !== 0) return;
    
    if (e.type === 'touchstart' || e.type === 'keydown') {
        if(e.target === canvas || e.code === 'Space') e.preventDefault();
    }
    
    if (gameState === 'start') {
        if (e.target === canvas || e.code === 'Space') startGame();
    } else if (gameState === 'playing') {
        bird.jump();
    }
}

window.addEventListener('keydown', handleInput);
window.addEventListener('touchstart', handleInput, {passive: false});
window.addEventListener('mousedown', handleInput);

saveNameBtn.addEventListener('click', () => {
    currentPlayerName = playerNameInput.value.trim().substring(0, 12) || 'Player';
    profilePlayerName.innerText = currentPlayerName;
    try {
        localStorage.setItem('flappyPlayerName', currentPlayerName);
    } catch(e) {}
    
    // Set global LootLocker name
    setPlayerName(currentPlayerName);
    
    authScreen.classList.remove('active');
    homeScreen.classList.add('active');
    gameState = 'start';
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', resetGame);

openSettingsBtn.addEventListener('click', () => {
    homeScreen.classList.remove('active');
    settingsScreen.classList.add('active');
});

closeSettingsBtn.addEventListener('click', () => {
    settingsScreen.classList.remove('active');
    homeScreen.classList.add('active');
});

openSkinsBtn.addEventListener('click', () => {
    settingsScreen.classList.remove('active');
    skinsScreen.classList.add('active');
    updateSkinsUI();
});

closeSkinsBtn.addEventListener('click', () => {
    skinsScreen.classList.remove('active');
    settingsScreen.classList.add('active');
});

changeNameBtn.addEventListener('click', () => {
    settingsScreen.classList.remove('active');
    authScreen.classList.add('active');
    gameState = 'auth';
});

gameOverHomeBtn.addEventListener('click', () => {
    gameOverScreen.classList.remove('active');
    homeScreen.classList.add('active');
    gameState = 'start';
});

function updateSkinsUI() {
    const goldCard = document.getElementById('skin-gold');
    const neonCard = document.getElementById('skin-neon');
    
    // Gold Progress
    const goldProgress = Math.min(personalBestScore, 20);
    const goldPercent = (goldProgress / 20) * 100;
    const textGold = document.getElementById('text-gold');
    const barGold = document.getElementById('bar-gold');
    if (textGold && barGold) {
        textGold.innerText = `Progress: ${goldProgress} / 20`;
        barGold.style.width = `${goldPercent}%`;
    }
    
    if (personalBestScore >= 20) {
        goldCard.classList.remove('locked');
        const statusGold = document.getElementById('status-gold');
        if (statusGold) statusGold.innerHTML = '<span style="color: #a8ff78; font-weight: bold;">Unlocked</span>';
    }
    
    // Neon Progress
    const neonProgress = Math.min(personalBestScore, 50);
    const neonPercent = (neonProgress / 50) * 100;
    const textNeon = document.getElementById('text-neon');
    const barNeon = document.getElementById('bar-neon');
    if (textNeon && barNeon) {
        textNeon.innerText = `Progress: ${neonProgress} / 50`;
        barNeon.style.width = `${neonPercent}%`;
    }
    
    if (personalBestScore >= 50) {
        neonCard.classList.remove('locked');
        const statusNeon = document.getElementById('status-neon');
        if (statusNeon) statusNeon.innerHTML = '<span style="color: #a8ff78; font-weight: bold;">Unlocked</span>';
    }
    
    skinCards.forEach(card => {
        card.classList.remove('selected');
        if (card.dataset.skin === selectedSkin) {
            card.classList.add('selected');
        }
    });
}

skinCards.forEach(card => {
    card.addEventListener('click', () => {
        if (card.classList.contains('locked')) return;
        selectedSkin = card.dataset.skin;
        localStorage.setItem('flappySelectedSkin', selectedSkin);
        updateSkinsUI();
    });
});

showLeaderboardBtn.addEventListener('click', () => {
    gameOverScreen.classList.remove('active');
    leaderboardPage = 0;
    leaderboardScreen.classList.add('active');
    renderLeaderboard();
});

showLeaderboardStartBtn.addEventListener('click', () => {
    homeScreen.classList.remove('active');
    leaderboardPage = 0;
    leaderboardScreen.classList.add('active');
    renderLeaderboard();
});

closeLeaderboardBtn.addEventListener('click', () => {
    leaderboardScreen.classList.remove('active');
    if (gameState === 'gameover') {
        gameOverScreen.classList.add('active');
    } else {
        homeScreen.classList.add('active');
    }
});

prevPageBtn.addEventListener('click', () => {
    if (leaderboardPage > 0) {
        leaderboardPage--;
        renderLeaderboard();
    }
});

nextPageBtn.addEventListener('click', () => {
    leaderboardPage++;
    renderLeaderboard();
});

// Game Logic Functions
function startGame() {
    gameState = 'playing';
    homeScreen.classList.remove('active');
    scoreDisplay.classList.add('active');
    scoreDisplay.innerText = score;
    bird.jump();
}

async function updateLeaderboard(newScore) {
    if (!sessionToken) return;
    try {
        await fetch(`https://api.lootlocker.io/game/leaderboards/${LL_LEADERBOARD_ID}/submit`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-session-token": sessionToken
            },
            body: JSON.stringify({ score: newScore })
        });
    } catch (e) {
        console.error("Error submitting score", e);
    }
}

async function renderLeaderboard() {
    leaderboardList.innerHTML = '<li>Loading scores...</li>';
    
    // Wait up to 5s for session token if not ready yet
    if (!sessionToken) {
        let waited = 0;
        while (!sessionToken && waited < 5000) {
            await new Promise(r => setTimeout(r, 300));
            waited += 300;
        }
        if (!sessionToken) {
            leaderboardList.innerHTML = '<li>Not connected. Please check your internet and try again.</li>';
            return;
        }
    }
    
    try {
        const response = await fetch(`https://api.lootlocker.io/game/leaderboards/${LL_LEADERBOARD_ID}/list?count=${PAGE_SIZE}&after=${leaderboardPage * PAGE_SIZE}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "x-session-token": sessionToken
            }
        });
        const data = await response.json();
        
        // Log for debugging
        if (!response.ok || data.error) {
            console.error("Leaderboard API error:", data);
            leaderboardList.innerHTML = `<li>Server error: ${data.message || data.error || 'Unknown'}. Try again.</li>`;
            return;
        }
        
        leaderboardList.innerHTML = '';
        
        if (data.items && data.items.length > 0) {
            data.items.forEach((item) => {
                const li = document.createElement('li');
                let name = item.player ? (item.player.name || "Unknown") : "Unknown";
                
                let rankDisplay = `#${item.rank}`;
                if (item.rank === 1) rankDisplay = "🥇";
                else if (item.rank === 2) rankDisplay = "🥈";
                else if (item.rank === 3) rankDisplay = "🥉";
                
                if (item.member_id === String(llPlayerId)) {
                    li.classList.add('current-player');
                    name += " (YOU)";
                }
                
                li.innerHTML = `<span class="score-name">${rankDisplay} ${name}</span> <span class="score-value">${item.score}</span>`;
                leaderboardList.appendChild(li);
            });
            
            nextPageBtn.style.opacity = data.items.length < PAGE_SIZE ? '0.5' : '1';
            nextPageBtn.style.pointerEvents = data.items.length < PAGE_SIZE ? 'none' : 'auto';
        } else {
            leaderboardList.innerHTML = '<li>No scores here!</li>';
            nextPageBtn.style.opacity = '0.5';
            nextPageBtn.style.pointerEvents = 'none';
        }
        
    } catch (e) {
        console.error("Error fetching leaderboard", e);
        if (e.message.includes('Failed to fetch')) {
            leaderboardList.innerHTML = '<li>Connection Blocked: Please disable AdBlock or check your internet.</li>';
        } else {
            leaderboardList.innerHTML = `<li>Error: ${e.message || 'Check Console'}</li>`;
        }
    }
    
    prevPageBtn.style.opacity = leaderboardPage === 0 ? '0.5' : '1';
    prevPageBtn.style.pointerEvents = leaderboardPage === 0 ? 'none' : 'auto';
}

function gameOver() {
    if (gameState === 'gameover') return;
    
    gameState = 'gameover';
    bird.velocity = 0;
    flashAlpha = 1;
    shakeFrames = 20;
    particles.createExplosion(bird.x, bird.y);
    scoreDisplay.classList.remove('active');
    
    if (score > personalBestScore) {
        personalBestScore = score;
        localStorage.setItem('flappyBestScore', personalBestScore);
        if (personalBestScore >= globalTopScore && globalTopScore > 0) {
            isRankOne = true;
        }
    }
    
    updateLeaderboard(score).then(() => {
        fetchPlayerRank();
    });
    
    setTimeout(() => {
        gameOverScreen.classList.add('active');
    }, 1000);
    
    finalScoreDisplay.innerText = score;
}

function resetGame() {
    bird.reset();
    pipes.reset();
    particles.items = [];
    flashAlpha = 0;
    score = 0;
    frames = 0;
    gameState = 'start';
    gameOverScreen.classList.remove('active');
    homeScreen.classList.add('active');
}

// Main Game Loop
function loop() {
    ctx.save();
    if (shakeFrames > 0) {
        ctx.translate((Math.random() - 0.5) * 15, (Math.random() - 0.5) * 15);
        shakeFrames--;
    }

    background.update();
    background.draw();
    
    pipes.update();
    pipes.draw();
    
    bird.update();
    bird.draw();
    
    particles.update();
    particles.draw();
    
    if (flashAlpha > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        flashAlpha -= 0.05;
    }
    
    if (gameState === 'playing' && globalTopScore > 0 && score > globalTopScore && !recordAlert.active) {
        recordAlert.active = true;
        recordAlert.alpha = 2.0;
        globalTopScore = score;
        isRankOne = true;
    }
    
    if (recordAlert.active && recordAlert.alpha > 0) {
        ctx.fillStyle = `rgba(255, 215, 0, ${Math.min(1, recordAlert.alpha)})`;
        ctx.font = 'bold 30px Orbitron';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 10;
        ctx.fillText("NEW WORLD RECORD!", canvas.width / 2, canvas.height / 3);
        ctx.shadowBlur = 0;
        recordAlert.alpha -= 0.01;
    }
    
    ctx.restore();

    if (gameState === 'playing') {
        frames++;
    }
    
    requestAnimationFrame(loop);
}

loop();
