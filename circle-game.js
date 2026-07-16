const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

//some bullshit
const TICK_RATE = 60;
const MS_PER_TICK = 1000 / TICK_RATE;
let lastTick = performance.now();
let accumulator = 0;

// Input
const keys = {};
window.addEventListener('keydown', e => keys[e.key] = true);
window.addEventListener('keyup', e => keys[e.key] = false);

// State
let score = 0;
let gamePaused = false;
let gameOver = false;

//random int between min and max
function randInt(min, max) {
    return Math.round((Math.random()*(max-min))+min)
}

function drawFilledCircle(x, y, radius, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
}

class Level {
    constructor(waves) {
        this.waves = waves;
    }
}

class Wave {
    constructor(enemySpawners) {
        this.enemySpawners = enemySpawners;
    }
}

class SpawnEnemies {
    constructor(enemy, amount) {
        this.enemy = enemy;
        this.amount = amount;
    }
}

//list of the levels
// const levels = [
//     new Level(
//         [
//             new Wave (
//                 [
//                     new SpawnEnemies(Boss1, 1),
//                     new SpawnEnemies(SideSniper, 1)
//                 ]
//             )
//         ]
//     ),
//     new Level(
//         [
//             new Wave (
//                 [

//                 ]
//             )
//         ]
//     )
// ];

//base class for shootpatterns for enemies to have
class ShootPattern {
    constructor(damage, radius, speed, shotCooldown) {
        //cooldown in seconds
        this.shotCooldown = shotCooldown;
        //timer to be used with cooldown
        this.cooldownTimer = 0;
        this.speed = speed;
        this.radius = radius;
        this.damage = damage;
    }
    step(x, y, dt) {}
}

class SpiralPattern extends ShootPattern {
    constructor(damage, radius, speed, shotCooldown, shotsPerCycle) {
        super(damage, radius, speed, shotCooldown)
        this.shotsPerCycle = shotsPerCycle;
        this.shotNumber = 0;
    }
    step(x, y, dt) {
        if (this.shotNumber >= this.shotsPerCycle) this.shotNumber = 0;
        if (this.cooldownTimer > 0) this.cooldownTimer -= dt;
        else {
            var angle = (this.shotNumber / this.shotsPerCycle)*(Math.PI * 2);
            var vx = Math.cos(angle) * this.speed;
            var vy = Math.sin(angle) * this.speed;
            entities.bullets.push(new EnemyBullet(x, y, vx, vy, this.radius));
            this.shotNumber++;
            this.cooldownTimer = this.shotCooldown;
        }
    }
}

class BurstRingPattern extends ShootPattern {
    constructor(damage, radius, speed, shotCooldown, bulletAmount) {
        super(damage, radius, speed, shotCooldown)
        //the amount of bullets in the ring
        this.bulletAmount = bulletAmount;
    }
    step(x, y, dt) {
        if (this.cooldownTimer > 0) this.cooldownTimer -= dt;
        else {
            for (var i = 0; i < this.bulletAmount; i++) {
                var angle = (i / this.bulletAmount) * Math.PI * 2;
                var vx = Math.cos(angle) * this.speed;
                var vy = Math.sin(angle) * this.speed;
                entities.bullets.push(new EnemyBullet(x, y, vx, vy, this.radius));
            }
            this.cooldownTimer = this.shotCooldown;
        }
    }
}

class TowardsPlayerPattern extends ShootPattern {
    constructor() {
        super(1, 5, 200, 0.5)
    }
    step(x, y, dt) {
        if (this.shotCooldownTimer > 0) this.shotCooldownTimer -= dt;
        else {
            var closestPlayerX = null;
            var closestPlayerY = null;
            for (var p of entities.players) {
                var dist = Math.hypot(x - p.x, y - p.y);
                if (closestPlayerX == null || closestPlayerY == null) {
                    closestPlayerX = p.x;
                    closestPlayerY = p.y;
                    var prevDist = dist;
                }
                else if (dist < prevDist) {
                    closestPlayerX = p.x;
                    closestPlayerY = p.y;
                    var prevDist = dist;
                }
            }
            var angle = Math.atan2(closestPlayerX - x, closestPlayerY - y);
            var vx = Math.cos(angle - Math.PI/2) * this.speed;
            var vy = Math.sin(angle + Math.PI/2) * this.speed;
            entities.bullets.push(new EnemyBullet(x, y, vx, vy, this.radius));
            this.shotCooldownTimer = this.shotCooldown;
        }
    }
}


class Entity {
    constructor(x, y, health) {
        this.x = x;
        this.y = y;
        this.health = health;
    }
    step() {}
    hit() {}
    render() {}
}

class Bullet extends Entity {
    constructor(x, y, vx, vy, radius) {
        super(x, y, 1);
        this.vx = vx;
        this.vy = vy;
        this.radius = radius;
        this.color = '#ffffff'
    }
    step(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        if (this.x < -10 || this.x > canvas.width + 10 || this.y < -10 || this.y > canvas.height + 10) {
            this.health = 0;
        }
    }
    render() {
        drawFilledCircle(this.x, this.y, this.radius, this.color)
    }
}

class PlayerBullet extends Bullet {
    constructor(x, y, vx, vy, radius) {
        super(x, y, vx, vy, radius);
        this.color = '#00a5f1'
    }
    step(dt) {
        for (var e of entities.enemies) {
            var dist = Math.hypot(this.x - e.x, this.y - e.y);
            if (dist < this.radius + e.hitboxRadius) {
                e.hit();
                this.health = 0;
            }
        }
        super.step(dt);
    }
}

class EnemyBullet extends Bullet {
    constructor(x, y, vx, vy, radius) {
        super(x, y, vx, vy, radius);
        this.color = '#ff3336'
    }
    step(dt) {
        for (var p of entities.players) {
            var dist = Math.hypot(this.x - p.x, this.y - p.y);
            if (dist < this.radius + p.hitboxRadius) {
                p.hit();
                this.health = 0;
            }
        }
        super.step(dt);
    }
}

class Player extends Entity {
    constructor(x, y) {
        super(x, y, 1);
        this.firstX = x;
        this.firstY = y;
        this.lives = 3;
        this.radius = 15;
        this.hitboxRadius = 5;
        this.moveSpeed = 400;
        this.damage = 10;
        this.shotCooldown = 0.1;
        this.shotCooldownTimer = 0;
        this.hitCooldown = 1;
        this.hitCooldownTimer = 0;
        this.color = 'rgba(0, 255, 204, 1)';
    }
    step(dt) {
        if (keys['ArrowUp']) this.y -= this.moveSpeed * dt;
        if (keys['ArrowDown']) this.y += this.moveSpeed * dt;
        if (keys['ArrowLeft']) this.x -= this.moveSpeed * dt;
        if (keys['ArrowRight']) this.x += this.moveSpeed * dt;

        // Clamp player to screen
        this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.y));

        // Player bullets
        if (this.shotCooldownTimer > 0) this.shotCooldownTimer -= dt;
        else if (keys['z']) {
            entities.bullets.push(new PlayerBullet(this.x, this.y, 0, -500, 5));
            this.shotCooldownTimer = this.shotCooldown;
        }

        if (this.hitCooldownTimer > 0) {
            this.color = 'rgba(0, 255, 204, 0.5)';
            this.hitCooldownTimer -= dt;
        }
        else {
            this.color = 'rgba(0,255, 204, 1)';
        }

    }
    hit() {
        if (this.hitCooldownTimer <= 0) {
            this.x = this.firstX;
            this.y = this.firstY;
            this.hitCooldownTimer = this.hitCooldown;
            this.lives--;
        }
    }
    render() {
        //body
        drawFilledCircle(this.x, this.y, this.radius, this.color)
        //hitbox
        drawFilledCircle(this.x, this.y, this.hitboxRadius, 'red')
    }
}

class Enemy extends Entity {
    constructor(x, y, health, shootPatterns) {
        super(x, y, health)
        this.shootPatterns = shootPatterns;
    }
    step(dt) {
        for (var p of this.shootPatterns) {
            p.step(this.x, this.y, dt);
        }
    }
}

class Boss1 extends Enemy {
    constructor(x, y) {
        super(
            x, y, 
            100, 
            [
                new SpiralPattern(1, 6, 300, 0.1, 16),
                new BurstRingPattern(1, 5, 200, 1, 20)
            ]
        );
        this.radius = 30;
        this.hitboxRadius = 40;
        this.color = 'purple';
    }
    step(dt) {
        super.step(dt);
    }
    render() {
        ctx.font = "25px Arial";
        ctx.fillStyle = 'white';
        ctx.textAlign = "start"; 
        ctx.fillText("Boss Health: " + this.health, 10, 25);

        drawFilledCircle(this.x, this.y, this.radius, this.color)
    }
}

class SideSniper extends Enemy {
    constructor(x, y) {
        super(
            x, y, 
            10, 
            [new TowardsPlayerPattern()]
        );
        this.moveSpeed = 100;
        this.radius = 20;
        this.hitboxRadius = 30;
        this.color = 'purple';
    }
    step(dt) {
        this.y += this.moveSpeed * dt;
        super.step(dt);
    }
    render() {
        drawFilledCircle(this.x, this.y, this.radius, this.color)
    }
}


const entities = {
    players: [new Player(300, 700)],
    enemies: [new Boss1(300, 200)],
    bullets: []
};


function loop() {
    const now = performance.now();
    const delta = now - lastTick;
    lastTick = now;

    accumulator += delta;

    while (accumulator >= MS_PER_TICK) {
        update(MS_PER_TICK / 1000);
        accumulator -= MS_PER_TICK;
    }

    requestAnimationFrame(loop);
}


function update(dt) {
    if (keys['Escape']) gamePaused = true;
    if (gamePaused) {
        ctx.fillStyle = 'red';
        ctx.textAlign = "center"; 
        ctx.font = "25px Arial";
        if (gameOver) {
            if (keys["Enter"]) window.location.reload();
            ctx.fillText(`Final Score: ${Math.floor(score)}`, 300, 400);
        }
        else {
            if (keys["Enter"]) gamePaused = false;
            ctx.fillText("Score: " + Math.floor(score), 300, 400);
        }
        return;
    }

    score += dt * 10;

    for (var i = 0; i < entities.players.length; i++) {
        var p = entities.players[i];
        p.step(dt);
        if (p.lives <= 0) {
            entities.players.splice(i, 1);
        }
    }
    if (entities.players.length <= 0) {
        gamePaused = true;
        gameOver = true;
        return;
    }

    for (var i = 0; i < entities.enemies.length; i++) {
        var e = entities.enemies[i];
        e.step(dt);
        if (e.health <= 0) {
            entities.enemies.splice(i, 1);
        }
    }
    
    for (var i = 0; i < entities.bullets.length; i++) {
        var b = entities.bullets[i];
        b.step(dt);
        if (b.health <= 0) {
            entities.bullets.splice(i, 1);
        }
    }

    //kill
    // if (e.y > canvas.height + e.size || e.health <= 0) {
    //     if (e.type == "boss1") {
    //         var newBoss = Object.create(boss1);
    //         newBoss.x = Math.floor(Math.random() * canvas.width);
    //         enemies.push(newBoss);
    //     }
    //     score += 100;
    //     enemies.splice(i, 1);
    // }

    //Draw
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = "center"; 
    ctx.fillStyle = 'white';
    ctx.font = "25px Arial"
    ctx.fillText("Score: " + Math.floor(score), 300, 25);
    ctx.fillText("Health: " + Math.floor(entities.players[0].lives), 500, 25);
    // ctx.font = "10px Arial";
    // ctx.fillText("bullets " + entities.bullets.length, 10, 50);
    // ctx.fillText("enemies " + entities.enemies.length, 10, 60);
    
    // Draw Entities
    for (var p of entities.players) {
        p.render();
    }
    for (var e of entities.enemies) {
        e.render();
    }
    for (var b of entities.bullets) {
        b.render();
    }

}

requestAnimationFrame(loop);
