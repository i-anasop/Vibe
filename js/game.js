const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const playerNameInput = document.getElementById('player-name-input');
const authScreen = document.getElementById('auth-screen');
const saveNameBtn = document.getElementById('save-name-btn');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const scoreDisplay = document.getElementById('score-display');
const finalScoreDisplay = document.getElementById('final-score');
const leaderboardList = document.getElementById('leaderboard-list');
const startBtn = document.getElementById('start-btn');
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
            console.log("Logged into LootLocker successfully!");
            if (currentPlayerName) {
                setPlayerName(currentPlayerName);
            }
            fetchTopScore();
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

// Game State
let frames = 0;
let gameState = 'auth'; // 'auth', 'start', 'playing', 'gameover'
let score = 0;
let flashAlpha = 0;

let currentPlayerName = localStorage.getItem('flappyPlayerName') || '';
playerNameInput.value = currentPlayerName;

if (currentPlayerName) {
    gameState = 'start';
    authScreen.classList.remove('active');
    startScreen.classList.add('active');
}

let leaderboardPage = 0;
const PAGE_SIZE = 10;

let personalBestScore = parseInt(localStorage.getItem('flappyBestScore')) || 0;
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
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        if (gameState === 'playing' || gameState === 'gameover') {
            this.rotation = Math.min(Math.PI / 2, Math.max(-Math.PI / 4, (this.velocity * 0.1)));
        }
        ctx.rotate(this.rotation);
        
        // Body
        if (personalBestScore >= 50) {
            ctx.fillStyle = '#00ffff';
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur = 15;
        } else if (personalBestScore >= 20) {
            ctx.fillStyle = '#FFD700';
            ctx.shadowColor = '#FF8C00';
            ctx.shadowBlur = 10;
        } else {
            ctx.fillStyle = '#f3c623';
            ctx.shadowBlur = 0;
        }
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#543847';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Wing
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.ellipse(-5, 2, 8, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Eye (White)
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(6, -6, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Eye (Pupil)
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(8, -6, 2, 0, Math.PI * 2);
        ctx.fill();

        // Beak
        ctx.fillStyle = '#e86101';
        ctx.beginPath();
        ctx.moveTo(10, 2);
        ctx.lineTo(22, 6);
        ctx.lineTo(10, 10);
        ctx.fill();
        ctx.stroke();

        if (isRankOne) {
            ctx.shadowBlur = 0;
            ctx.font = '20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('👑', 0, -25);
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
            let topHeight = Math.max(50, Math.random() * (canvas.height - this.gap - 100));
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

function resizeCanvas() {
    const container = document.getElementById('game-container');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    
    bird.x = canvas.width * 0.25;
    if (gameState === 'auth' || gameState === 'start') {
        bird.y = canvas.height / 2;
    }
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Controls
function handleInput(e) {
    if (e.target && e.target.tagName) {
        const tag = e.target.tagName.toLowerCase();
        if (tag === 'input' || tag === 'button') return;
    }
    
    if (e.type === 'keydown' && e.code !== 'Space') return;
    if (e.type === 'mousedown' && e.button !== 0) return;
    
    if (e.type === 'touchstart' || e.type === 'keydown') {
        if(e.target === canvas || e.code === 'Space') e.preventDefault();
    }
    
    if (gameState === 'start') {
        startGame();
    } else if (gameState === 'playing') {
        bird.jump();
    }
}

window.addEventListener('keydown', handleInput);
window.addEventListener('touchstart', handleInput, {passive: false});
window.addEventListener('mousedown', handleInput);

saveNameBtn.addEventListener('click', () => {
    currentPlayerName = playerNameInput.value.trim().substring(0, 12) || 'Player';
    try {
        localStorage.setItem('flappyPlayerName', currentPlayerName);
    } catch(e) {}
    
    // Set global LootLocker name
    setPlayerName(currentPlayerName);
    
    authScreen.classList.remove('active');
    startScreen.classList.add('active');
    gameState = 'start';
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', resetGame);

showLeaderboardBtn.addEventListener('click', () => {
    gameOverScreen.classList.remove('active');
    leaderboardPage = 0;
    leaderboardScreen.classList.add('active');
    renderLeaderboard();
});

showLeaderboardStartBtn.addEventListener('click', () => {
    startScreen.classList.remove('active');
    leaderboardPage = 0;
    leaderboardScreen.classList.add('active');
    renderLeaderboard();
});

closeLeaderboardBtn.addEventListener('click', () => {
    leaderboardScreen.classList.remove('active');
    if (gameState === 'gameover') {
        gameOverScreen.classList.add('active');
    } else {
        startScreen.classList.add('active');
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
    startScreen.classList.remove('active');
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
    if (!sessionToken) return;
    
    try {
        const response = await fetch(`https://api.lootlocker.io/game/leaderboards/${LL_LEADERBOARD_ID}/list?count=${PAGE_SIZE}&after=${leaderboardPage * PAGE_SIZE}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "x-session-token": sessionToken
            }
        });
        const data = await response.json();
        
        leaderboardList.innerHTML = '';
        
        if (data.items && data.items.length > 0) {
            data.items.forEach((item) => {
                const li = document.createElement('li');
                const name = item.player ? (item.player.name || "Unknown") : "Unknown";
                
                let rankDisplay = `#${item.rank}`;
                if (item.rank === 1) rankDisplay = "🥇";
                else if (item.rank === 2) rankDisplay = "🥈";
                else if (item.rank === 3) rankDisplay = "🥉";
                
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
        leaderboardList.innerHTML = '<li>Error loading scores</li>';
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
    
    updateLeaderboard(score);
    
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
    startScreen.classList.add('active');
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
