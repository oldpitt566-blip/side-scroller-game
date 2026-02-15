// -------------------
//     Setup
// -------------------
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// -------------------
//     Sounds
// -------------------
const sounds = {
    jump: new Audio('assets/sounds/jump.mp3'),
    collect: new Audio('assets/sounds/collect.mp3'),
    hit: new Audio('assets/sounds/hit.mp3'),
    gameOver: new Audio('assets/sounds/gameOver.mp3')
};
// Function to play sound and handle errors
function playSound(sound) {
    sound.currentTime = 0;
    sound.play().catch(error => console.error(`Error playing sound ${sound.src}:`, error));
}


// Settings Modal Elements
const settingsModal = document.getElementById('settingsModal');
const settingsButton = document.getElementById('settingsButton');
const closeModalButton = document.getElementById('closeModal');
const speedOptionButtons = document.querySelectorAll('.speed-option');

let score = 0;
let gameState = 'start'; // 'start', 'playing', 'gameOver', 'paused'
let baseGameSpeed = 2; // Default speed
let gameSpeed = 2;
let speedIncreaseFactor = 0.0005;

// --- Event Listeners for Settings ---
settingsButton.addEventListener('click', () => {
    if (gameState === 'playing') {
        gameState = 'paused';
    }
    settingsModal.style.display = 'flex';
});

closeModalButton.addEventListener('click', () => {
    settingsModal.style.display = 'none';
    if (gameState === 'paused') {
        gameState = 'playing';
        requestAnimationFrame(gameLoop); // Resume game loop
    }
});

speedOptionButtons.forEach(button => {
    button.addEventListener('click', () => {
        // Update active button
        document.querySelector('.speed-option.active').classList.remove('active');
        button.classList.add('active');
        // Update speed
        baseGameSpeed = parseFloat(button.dataset.speed);
        if (gameState !== 'playing' && gameState !== 'paused') {
           gameSpeed = baseGameSpeed;
        }
    });
});


let backgroundCloudImage = new Image();
let backgrounds = [];
let bulletImage = new Image(); // New: Image for bullets
let appleImage = new Image(); // For score items
let heartImage = new Image(); // For health items
let obstacleImage = new Image(); // For ground obstacles
let monsterImage = new Image(); // For monster enemies

const player = {
    x: 50,
    y: 0,
    width: 0,
    height: 0,
    originalHeight: 0,
    crouchHeight: 0,
    speed: 5,
    dx: 0, // horizontal velocity
    dy: 0, // vertical velocity
    gravity: 0.6,
    jumpForce: -15,
    baseGravity: 0.6,
    baseJumpForce: -15,
    isJumping: false,
    isCrouching: false,
    lives: 3, // New: Player lives
    isInvincible: false, // New: Invincibility status
    invincibilityDuration: 120, // New: Frames of invincibility
    invincibilityTimer: 0, // New: Timer for invincibility

    // Image properties
    spriteStand: new Image(),
    spriteCrouch: new Image(),
    imagesLoaded: false,

    draw() {
        if (!this.imagesLoaded) return; // Don't draw if images aren't loaded

        // Flash when invincible
        if (this.isInvincible && Math.floor(this.invincibilityTimer / 10) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }

        const imageToDraw = this.isCrouching ? this.spriteCrouch : this.spriteStand;
        ctx.drawImage(imageToDraw, this.x, this.y, this.width, this.height);

        ctx.globalAlpha = 1.0; // Reset alpha
    },

    update() {
        // Adjust width based on aspect ratio
        if (this.imagesLoaded) {
            const imageToDraw = this.isCrouching ? this.spriteCrouch : this.spriteStand;
            if (imageToDraw.naturalHeight > 0) {
                const aspectRatio = imageToDraw.naturalWidth / imageToDraw.naturalHeight;
                this.width = this.height * aspectRatio;
            }
        }

        // Apply horizontal movement
        this.x += this.dx;

        // Boundary checks for horizontal movement
        if (this.x < 0) {
            this.x = 0;
        }
        if (this.x + this.width > canvas.width) {
            this.x = canvas.width - this.width;
        }

        // Apply gravity
        if (this.isJumping) {
            this.dy += this.gravity;
            this.y += this.dy;
        }

        // Handle invincibility timer
        if (this.isInvincible) {
            this.invincibilityTimer--;
            if (this.invincibilityTimer <= 0) {
                this.isInvincible = false;
            }
        }

        // Ground check
        if (this.y + this.height > canvas.height) {
            this.y = canvas.height - this.height;
            this.dy = 0;
            this.isJumping = false;
        }
    },
    
    jump() {
        if (!this.isJumping) {
            this.dy = this.jumpForce;
            this.isJumping = true;
            playSound(sounds.jump);
        }
    },

    crouch(state) {
        if (this.isCrouching === state) return;
        this.isCrouching = state;
        if (state) { // Start crouching
            this.height = this.crouchHeight;
            if (!this.isJumping) {
                 this.y += this.originalHeight - this.crouchHeight;
            }
        } else { // Stop crouching
            this.height = this.originalHeight;
            if (!this.isJumping) {
                this.y -= this.originalHeight - this.crouchHeight;
            }
        }
    }
};

// Canvas dimensions
function resizeCanvas() {
    canvas.width = window.innerWidth * 0.9;
    canvas.height = window.innerHeight * 0.9;
    if (canvas.width > 1000) canvas.width = 1000;
    if (canvas.height > 600) canvas.height = 600;

    // Dynamically set player size based on canvas height
    player.originalHeight = canvas.height / 3;
    player.crouchHeight = player.originalHeight / 2 * 1.2; // Increase by 1/5
    player.height = player.originalHeight; // Reset current height
    player.y = canvas.height - player.height; // Adjust player position

    // Dynamically scale physics based on player height
    const heightReference = 100; // The original height for which physics were tuned
    const scaleFactor = player.originalHeight / heightReference;
    player.gravity = player.baseGravity * scaleFactor;
    player.jumpForce = player.baseJumpForce * scaleFactor;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas(); // Initial call to set size


// -------------------
//   Player & Images
// -------------------

function initGameImages() {
    let loadedCount = 0;
    const totalImages = 8; // player.spriteStand, backgroundCloudImage, bulletImage, appleImage, heartImage, obstacleImage, monsterImage, player.spriteCrouch

    const onImageLoad = () => {
        loadedCount++;
        if (loadedCount === totalImages) {
            player.imagesLoaded = true; // Still use this as a global flag for all images
            console.log("All game images loaded.");

            // Initialize backgrounds array after image has loaded to get its width
            if (backgrounds.length === 0 && backgroundCloudImage.width > 0) {
                 backgrounds.push({ x: 0, image: backgroundCloudImage });
                 backgrounds.push({ x: backgroundCloudImage.width, image: backgroundCloudImage });
            }
        }
    };
    player.spriteStand.onload = onImageLoad;
    player.spriteCrouch.onload = onImageLoad;
    backgroundCloudImage.onload = onImageLoad;
    bulletImage.onload = onImageLoad;
    appleImage.onload = onImageLoad;
    heartImage.onload = onImageLoad;
    obstacleImage.onload = onImageLoad;
    monsterImage.onload = onImageLoad;

    player.spriteStand.src = 'assets/tong.png';
    player.spriteCrouch.src = 'assets/tong2.png';
    backgroundCloudImage.src = 'assets/clouds.png';
    bulletImage.src = 'assets/lion.png';
    appleImage.src = 'assets/apple.png';
    heartImage.src = 'assets/heart.png';
    obstacleImage.src = 'assets/stone.png';
    monsterImage.src = 'assets/monster.png';
}

initGameImages();


// -------------------
//    Obstacles
// -------------------
const obstacles = [];
const bullets = [];
const apples = [];
const hearts = [];
const monsters = [];

function manageProjectiles() {
    // Scaling factors relative to player.originalHeight
    const obstacleHeight = player.originalHeight * 0.4; // Fixed height, scaled up from before
    const obstacleWidth = player.originalHeight * 0.35 * 2; // 35% of player height, scaled by 2

    const bulletWidth = player.originalHeight * 1.35; // 45% of player height * 3
    const bulletHeight = player.originalHeight * 0.45; // 15% of player height * 3
    const bulletYOffset = player.originalHeight * 0.15; // 5% offset for head level * 3

    // Add new obstacles
    if (Math.random() < 0.002 && gameState === 'playing') { // Reduced frequency
        obstacles.push({
            x: canvas.width,
            y: canvas.height - (obstacleHeight * 0.8), // Adjust for transparent space in image, pushing it down
            width: obstacleWidth,
            height: obstacleHeight
        });
    }

    // Add new bullets
    if (Math.random() < 0.0025 && gameState === 'playing') { // Reduced frequency
        // Position bullets high so the player must crouch to dodge them.
        const yPos = (canvas.height - player.crouchHeight - bulletHeight) - 5; // 5px margin
        
        bullets.push({
            x: canvas.width,
            y: yPos,
            width: bulletWidth,
            height: bulletHeight
        });
    }

    // Update and draw obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        let o = obstacles[i];
        o.x -= gameSpeed;
        if (obstacleImage.complete && obstacleImage.naturalWidth > 0) {
            ctx.drawImage(obstacleImage, o.x, o.y, o.width, o.height);
        } else {
            ctx.fillStyle = '#000000'; // Fallback color
            ctx.fillRect(o.x, o.y, o.width, o.height);
        }

        if (o.x + o.width < 0) {
            obstacles.splice(i, 1);
            score++;
        }
    }
    
    // Update and draw bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        b.x -= gameSpeed * 1.5; // Bullets are faster
        if (bulletImage.complete && bulletImage.naturalWidth > 0) {
            const aspectRatio = bulletImage.naturalWidth / bulletImage.naturalHeight;
            b.height = bulletHeight; // Use the scaled bulletHeight
            b.width = b.height * aspectRatio; // Adjust width to maintain aspect ratio
            ctx.drawImage(bulletImage, b.x, b.y, b.width, b.height);
        } else {
            // Fallback to drawing a black rectangle if image not loaded
            ctx.fillStyle = '#000000'; 
            ctx.fillRect(b.x, b.y, b.width, b.height);
        }

        if (b.x + b.width < 0) {
            bullets.splice(i, 1);
        }
    }
}

function manageApples() {
    const appleSize = player.originalHeight * 0.2; // 20% of player height

    // Add new apples
    if (Math.random() < 0.008 && gameState === 'playing') { // Spawn more frequently than obstacles
        // Spawn at varying heights, but not too low
        const yPos = (canvas.height - player.originalHeight) - (Math.random() * player.originalHeight * 1.5);
        apples.push({
            x: canvas.width,
            y: Math.max(yPos, appleSize), // Ensure it's not off the top of the screen
            width: appleSize,
            height: appleSize,
        });
    }

    // Update and draw apples
    for (let i = apples.length - 1; i >= 0; i--) {
        let a = apples[i];
        a.x -= gameSpeed;

        if (appleImage.complete && appleImage.naturalWidth > 0) {
            ctx.drawImage(appleImage, a.x, a.y, a.width, a.height);
        }

        // Remove if it goes off-screen
        if (a.x + a.width < 0) {
            apples.splice(i, 1);
        }
    }
}

function manageHearts() {
    const heartSize = player.originalHeight * 0.2; // 20% of player height

    // Add new hearts
    if (Math.random() < 0.0004 && gameState === 'playing') { // 1/20th the spawn rate of apples
        // Spawn at varying heights, but not too low
        const yPos = (canvas.height - player.originalHeight) - (Math.random() * player.originalHeight * 1.5);
        hearts.push({
            x: canvas.width,
            y: Math.max(yPos, heartSize), // Ensure it's not off the top of the screen
            width: heartSize,
            height: heartSize,
        });
    }

    // Update and draw hearts
    for (let i = hearts.length - 1; i >= 0; i--) {
        let h = hearts[i];
        h.x -= gameSpeed;

        if (heartImage.complete && heartImage.naturalWidth > 0) {
            ctx.drawImage(heartImage, h.x, h.y, h.width, h.height);
        }

        // Remove if it goes off-screen
        if (h.x + h.width < 0) {
            hearts.splice(i, 1);
        }
    }
}

function manageMonsters() {
    const monsterBaseHeight = player.originalHeight * 0.8 * 1.5; // 80% of player height, scaled by 1.5

    // Add new monsters
    if (Math.random() < 0.002 && gameState === 'playing') { // Spawn less frequently
        monsters.push({
            x: canvas.width,
            y: canvas.height - monsterBaseHeight, // Always on the ground
            width: 0, // Will be calculated based on aspect ratio
            height: monsterBaseHeight,
        });
    }

    // Update and draw monsters
    for (let i = monsters.length - 1; i >= 0; i--) {
        let m = monsters[i];
        m.x -= gameSpeed * 2.5; // Rush faster than everything else

        if (monsterImage.complete && monsterImage.naturalWidth > 0) {
            m.width = monsterImage.naturalWidth / monsterImage.naturalHeight * m.height; // Calculate width to maintain aspect ratio
            ctx.drawImage(monsterImage, m.x, m.y, m.width, m.height);
        }

        // Remove if it goes off-screen
        if (m.x + m.width < 0) {
            monsters.splice(i, 1);
        }
    }
}


// -------------------
//   Collision
// -------------------

function getHitbox(obj, type) {
    // Default hitbox is the object's full dimensions
    let r = { x: 0, y: 0, w: 1, h: 1 };

    // Define ratios for different object types to tighten the hitbox
    if (type === 'player') {
        r = { x: 0.15, y: 0.1, w: 0.7, h: 0.9 };
    } else if (type === 'stone') {
        r = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
    } else if (type === 'lion') { // Bullet
        r = { x: 0.2, y: 0.2, w: 0.6, h: 0.6 };
    } else if (type === 'monster') {
        r = { x: 0.1, y: 0.1, w: 0.8, h: 0.9 };
    } else if (type === 'collectible') { // For apples and hearts
        r = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
    }

    return {
        x: obj.x + (obj.width * r.x),
        y: obj.y + (obj.height * r.y),
        width: obj.width * r.w,
        height: obj.height * r.h
    };
}


function checkCollisions() {
    const check = (obj1, type1, obj2, type2) => {
        const box1 = getHitbox(obj1, type1);
        const box2 = getHitbox(obj2, type2);
        return (
            box1.x < box2.x + box2.width &&
            box1.x + box1.width > box2.x &&
            box1.y < box2.y + box2.height &&
            box1.y + box1.height > box2.y
        );
    };

    // Check for apple collisions
    for (let i = apples.length - 1; i >= 0; i--) {
        let a = apples[i];
        if (check(player, 'player', a, 'collectible')) {
            score++; // Add 1 point for an apple
            apples.splice(i, 1);
            playSound(sounds.collect);
            // Don't return, as we can collect and be hit in the same frame
        }
    }

    // Check for heart collisions
    for (let i = hearts.length - 1; i >= 0; i--) {
        let h = hearts[i];
        if (check(player, 'player', h, 'collectible')) {
            if (player.lives < 3) { // Assuming 3 is max lives
                player.lives++;
            }
            hearts.splice(i, 1);
            playSound(sounds.collect); // Can reuse the same sound
            // Don't return, as we can collect and be hit in the same frame
        }
    }

    if (player.isInvincible) return; // Ignore damaging collisions if invincible

    // Check for obstacle collisions
    for (let i = obstacles.length - 1; i >= 0; i--) {
        let o = obstacles[i];
        if (check(player, 'player', o, 'stone')) {
            playSound(sounds.hit);
            player.lives--;
            if (player.lives <= 0) {
                gameState = 'gameOver';
                playSound(sounds.gameOver);
            } else {
                player.isInvincible = true;
                player.invincibilityTimer = player.invincibilityDuration;
            }
            obstacles.splice(i, 1); // Remove obstacle after hit
            return; // Only take one hit at a time
        }
    }

    // Check for bullet collisions
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        if (check(player, 'player', b, 'lion')) {
            playSound(sounds.hit);
            player.lives--;
            if (player.lives <= 0) {
                gameState = 'gameOver';
                playSound(sounds.gameOver);
            } else {
                player.isInvincible = true;
                player.invincibilityTimer = player.invincibilityDuration;
            }
            bullets.splice(i, 1); // Remove bullet after hit
            return; // Only take one hit at a time
        }
    }

    // Check for monster collisions
    for (let i = monsters.length - 1; i >= 0; i--) {
        let m = monsters[i];
        if (check(player, 'player', m, 'monster')) {
            playSound(sounds.hit);
            player.lives--;
            if (player.lives <= 0) {
                gameState = 'gameOver';
                playSound(sounds.gameOver);
            } else {
                player.isInvincible = true;
                player.invincibilityTimer = player.invincibilityDuration;
            }
            monsters.splice(i, 1); // Remove monster after hit
            return; // Only take one hit at a time
        }
    }
}

// -------------------
//   Input Handling
// -------------------

// On-screen button definitions
const touchButtons = {
    left: { path: new Path2D() },
    right: { path: new Path2D() }
};

function drawTouchButtons() {
    const buttonSize = 60;
    const bottomMargin = 80;
    
    // Define button geometry dynamically based on current canvas size
    const leftBtn = {
        x: 50,
        y: canvas.height - bottomMargin,
        width: buttonSize,
        height: buttonSize
    };
    const rightBtn = {
        x: 130,
        y: canvas.height - bottomMargin,
        width: buttonSize,
        height: buttonSize
    };

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 3;
    
    // --- Left Arrow ---
    // Recreate the path for the left button for collision detection
    touchButtons.left.path = new Path2D();
    touchButtons.left.path.rect(leftBtn.x, leftBtn.y, leftBtn.width, leftBtn.height);
    ctx.stroke(touchButtons.left.path);
    // Draw the arrow shape
    ctx.beginPath();
    ctx.moveTo(leftBtn.x + 40, leftBtn.y + 15);
    ctx.lineTo(leftBtn.x + 20, leftBtn.y + 30);
    ctx.lineTo(leftBtn.x + 40, leftBtn.y + 45);
    ctx.stroke();

    // --- Right Arrow ---
    // Recreate the path for the right button for collision detection
    touchButtons.right.path = new Path2D();
    touchButtons.right.path.rect(rightBtn.x, rightBtn.y, rightBtn.width, rightBtn.height);
    ctx.stroke(touchButtons.right.path);
    // Draw the arrow shape
    ctx.beginPath();
    ctx.moveTo(rightBtn.x + 20, rightBtn.y + 15);
    ctx.lineTo(rightBtn.x + 40, rightBtn.y + 30);
    ctx.lineTo(rightBtn.x + 20, rightBtn.y + 45);
    ctx.stroke();
}

const keyState = {};
const activeTouches = new Set();

function handleInput() {
    // --- Touch Controls ---
    const touchesOnLeft = [...activeTouches].some(t => isPointInPath(touchButtons.left.path, t.clientX, t.clientY));
    const touchesOnRight = [...activeTouches].some(t => isPointInPath(touchButtons.right.path, t.clientX, t.clientY));
    const touchesOnCrouch = [...activeTouches].some(t => t.clientX > canvas.width / 2 && t.clientY > canvas.height / 2);

    // --- Determine Player Actions ---
    // Horizontal Movement
    player.dx = 0;
    if (touchesOnRight) {
        player.dx = player.speed;
    } else if (touchesOnLeft) {
        player.dx = -player.speed;
    }

    // Keyboard controls override touch for movement
    if (keyState['ArrowRight']) {
        player.dx = player.speed;
    } else if (keyState['ArrowLeft']) {
        player.dx = -player.speed;
    }

    // Jumping (Keyboard only, touch is handled in handleInteractionStart)
    if (keyState['Space'] || keyState['ArrowUp']) {
        player.jump();
    }
    
    // Crouching (Keyboard OR Touch)
    player.crouch(keyState['ArrowDown'] || touchesOnCrouch);
}

function isPointInPath(path, x, y) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (x - rect.left) * scaleX;
    const canvasY = (y - rect.top) * scaleY;
    return ctx.isPointInPath(path, canvasX, canvasY);
}

// --- Event Listeners ---
window.addEventListener('keydown', e => keyState[e.code] = true);
window.addEventListener('keyup', e => keyState[e.code] = false);

function handleInteractionStart(event) {
    event.preventDefault();
    if (gameState === 'start' || gameState === 'gameOver') {
        restartGame();
        return;
    }

    const touches = event.touches ? event.touches : [{ clientX: event.clientX, clientY: event.clientY, identifier: 'mouse' }];
    
    for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        // Ensure we have a unique identifier for each touch
        const existingTouch = [...activeTouches].find(t => t.identifier === touch.identifier);
        if (!existingTouch) {
            activeTouches.add(touch);
        }

        // Handle instantaneous actions like jumping
        const rect = canvas.getBoundingClientRect();
        if (touch.clientX > rect.left + rect.width / 2 && touch.clientY < rect.top + rect.height / 2) {
             player.jump();
        }
    }
}

function handleInteractionEnd(event) {
    event.preventDefault();
    const releasedTouches = event.changedTouches ? event.changedTouches : [{ clientX: event.clientX, clientY: event.clientY, identifier: 'mouse' }];
    
    for (let i = 0; i < releasedTouches.length; i++) {
        const releasedTouch = releasedTouches[i];
        activeTouches.forEach(t => {
            if(t.identifier === releasedTouch.identifier) {
                activeTouches.delete(t);
            }
        });
    }
}

// Add unified listeners
canvas.addEventListener('touchstart', handleInteractionStart, { passive: false });
canvas.addEventListener('mousedown', handleInteractionStart, { passive: false });
canvas.addEventListener('touchend', handleInteractionEnd, { passive: false });
canvas.addEventListener('mouseup', handleInteractionEnd, { passive: false });
canvas.addEventListener('contextmenu', e => e.preventDefault()); // Prevent right-click menu



// -------------------
//    Game Loop
// -------------------
function drawText(text, x, y, size = '30px', color = 'white', alignment = 'center') {
    ctx.fillStyle = color;
    ctx.font = `${size} 'Courier New', Courier, monospace`;
    ctx.textAlign = alignment;
    ctx.fillText(text, x, y);
}

function restartGame() {
    score = 0;
    gameSpeed = baseGameSpeed; // Use the selected speed
    obstacles.length = 0;
    bullets.length = 0;
    apples.length = 0;
    hearts.length = 0;
    monsters.length = 0; // Reset monsters

    // Reset background positions
    backgrounds.length = 0;
    if (backgroundCloudImage.width > 0) {
        backgrounds.push({ x: 0, image: backgroundCloudImage });
        backgrounds.push({ x: backgroundCloudImage.width, image: backgroundCloudImage });
    }

    player.y = canvas.height - player.originalHeight;
    player.isJumping = false;
    player.isCrouching = false;
    player.lives = 3; // Reset lives on restart
    player.isInvincible = false;
    player.invincibilityTimer = 0;
    player.height = player.originalHeight;
    backgroundCloudX = 0; // Reset background position
    gameState = 'playing';
}

function gameLoop() {
    // Stop the loop if the game is paused or over
    if (gameState === 'paused') {
        drawText('Paused', canvas.width / 2, canvas.height / 2, '50px');
        return;
    }
    
    requestAnimationFrame(gameLoop);
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background clouds with seamless scrolling
    if (player.imagesLoaded && backgroundCloudImage.complete && backgroundCloudImage.naturalWidth > 0) {
        for (const bg of backgrounds) {
            bg.x -= gameSpeed * 0.2; // Slower than foreground
            if (bg.x <= -backgroundCloudImage.width) {
                // When a background moves fully off-screen, reposition it to the right of the other one
                bg.x += 2 * backgroundCloudImage.width;
            }
            ctx.drawImage(bg.image, bg.x, 0, backgroundCloudImage.width, canvas.height);
        }
    }

    // Wait for images to load before starting the game
    if (!player.imagesLoaded) {
        drawText('Loading images...', canvas.width / 2, canvas.height / 2, '30px');
        return; // Return and wait for the next frame
    }
    
    if (gameState === 'start') {
        drawText('Side Scroller', canvas.width / 2, canvas.height / 3, '50px');
        drawText('Tap or Click to Start', canvas.width / 2, canvas.height / 2);
        drawText('Top half to Jump, Bottom half to Crouch (Hold)', canvas.width / 2, canvas.height / 2 + 50, '20px');
        drawText('Or use Arrow Keys / Spacebar', canvas.width / 2, canvas.height / 2 + 80, '20px');

    } else if (gameState === 'playing') {
        handleInput();
        player.update();
        player.draw();
        manageProjectiles();
        manageApples();
        manageHearts();
        manageMonsters(); // Handle monsters
        checkCollisions();
        drawTouchButtons(); // Draw touch controls
        
        // Increase speed over time
        gameSpeed += speedIncreaseFactor;

        // Draw score
        drawText(`Score: ${score}`, 50, 50, '24px', 'white', 'left');
        // Draw lives
        drawText(`Lives: ${player.lives}`, 50, 80, '24px', 'white', 'left');

    } else if (gameState === 'gameOver') {
        drawText('Game Over', canvas.width / 2, canvas.height / 3, '50px');
        drawText(`Final Score: ${score}`, canvas.width / 2, canvas.height / 2);
        drawText('Tap or Click to Restart', canvas.width / 2, canvas.height / 2 + 50, '20px');
    }
}

// Start the game
gameLoop();
