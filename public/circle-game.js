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
function rand(min, max) {
    return (Math.random()*(max-min))+min;
}
function absSubtract(value, subtraction) {
    if (value > 0) {
        return value - subtraction;
    }
    else if (value < 0) {
        return value + subtraction;
    }
    else {
        return value;
    }
}

function drawFilledCircle(x, y, radius, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
}
function drawFilledArc(x, y, radius, color, startAngle, endAngle) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, startAngle, endAngle);
    ctx.lineTo(x, y);
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
            bullets.push(new EnemyBullet(x, y, vx, vy, this.radius, this.damage));
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
                bullets.push(new EnemyBullet(x, y, vx, vy, this.radius, this.damage));
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
            for (var p of players) {
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
            bullets.push(new EnemyBullet(x, y, vx, vy, this.radius, this.damage));
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
    entityRender() {}
    uiRender() {}
}

function updateEntities(list, dt) {
    for (var i = 0; i < list.length; i++) {
        var e = list[i];
        e.step(dt);
        if (e.health <= 0) {
            gibs.push(new GibSpawner(e.x, e.y, e.radius, e.color, 12))
            list.splice(i, 1);
        }
    }
}

class Bullet extends Entity {
    constructor(x, y, vx, vy, radius, damage) {
        super(x, y, 1);
        this.vx = vx;
        this.vy = vy;
        this.radius = radius;
        this.damage = damage;
        this.color = '#ffffff'
    }
    step(dt) {
        if (this.x < -10 || this.x > canvas.width + 10 || this.y < -10 || this.y > canvas.height + 10) {
            this.health = 0;
        }
    }
    entityRender() {
        drawFilledCircle(this.x, this.y, this.radius, this.color)
    }
}

class PlayerBullet extends Bullet {
    constructor(x, y, vx, vy, radius, damage) {
        super(x, y, vx, vy, radius, damage);
        this.color = '#00a5f1'
    }
    step(dt) {
        for (var e of enemies) {
            var dist = Math.hypot(this.x - e.x, this.y - e.y);
            if (dist < this.radius + e.hitboxRadius) {
                e.hit(this.damage);
                this.health = 0;
            }
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        super.step(dt);
    }
}

class EnemyBullet extends Bullet {
    constructor(x, y, vx, vy, radius, damage) {
        super(x, y, vx, vy, radius, damage);
        this.color = '#ff3336'
    }
    step(dt) {
        for (var p of players) {
            var dist = Math.hypot(this.x - p.x, this.y - p.y);
            if (dist < this.radius + p.hitboxRadius && p.hitCooldownTimer <= 0) {
                p.hit(this.damage);
                this.health = 0;
            }
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

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
        this.bulletDamage = 10;
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
            bullets.push(new PlayerBullet(this.x, this.y, 0, -500, 6, this.bulletDamage));
            this.shotCooldownTimer = this.shotCooldown;
        }

        if (this.health <= 0 && this.hitCooldownTimer <= 0) {
            this.x = this.firstX;
            this.y = this.firstY;
            this.hitCooldownTimer = this.hitCooldown;
            this.lives--;
            this.health = 1;
        }
        else if (this.hitCooldownTimer > 0) {
            this.color = 'rgba(0, 255, 204, 0.5)';
            this.hitCooldownTimer -= dt;
        }
        else {
            this.color = 'rgba(0,255, 204, 1)';
        }

    }
    hit(damage) {
        this.health -= damage;
    }
    entityRender() {
        //body
        drawFilledCircle(this.x, this.y, this.radius, this.color)
        //hitbox
        drawFilledCircle(this.x, this.y, this.hitboxRadius, 'red')
    }
    uiRender() {
        ctx.textAlign = "center"; 
        ctx.fillStyle = 'white';
        ctx.font = "25px Arial"
        ctx.fillText("Lives: " + Math.floor(players[0].lives), 500, 25);
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
    hit(damage) {
        this.health -= damage;
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
    entityRender() {
        drawFilledCircle(this.x, this.y, this.radius, this.color)
    }
    uiRender() {
        ctx.font = "25px Arial";
        ctx.fillStyle = 'white';
        ctx.textAlign = "start"; 
        ctx.fillText("Boss Health: " + this.health, 10, 25);
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
    entityRender() {
        drawFilledCircle(this.x, this.y, this.radius, this.color)
    }
}

class Gib extends Entity {
    constructor(x, y, vx, vy, radius, color, startAngle, endAngle, timer) {
        super(x, y, 1)
        this.vx = vx;
        this.vy = vy;
        this.vxOnSpawn = vx;
        this.vyOnSpawn = vy;
        this.radius = radius;
        this.color = color;
        this.startAngle = startAngle;
        this.endAngle = endAngle;
        this.timerOnSpawn = timer;
        this.timer = timer;
    }
    step(dt) {
        this.vx = this.vxOnSpawn * (this.timer / this.timerOnSpawn);
        this.vy = this.vyOnSpawn * (this.timer / this.timerOnSpawn);
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if (this.timer > 0) this.timer -= dt;
        else {
            this.health = 0;
        }
    }
    entityRender() {
        drawFilledArc(this.x, this.y, this.radius, this.color, this.startAngle, this.endAngle)
    }
}

class GibSpawner extends Entity{
    constructor(x, y, radius, color, amount) {
        super(x, y, 1);
        this.gibs = [];
        this.angleOffset = Math.random();
        for (var i = 0; i < amount; i++) {
            var timer = rand(1, 2);
            var startAngle = (i / amount) * (Math.PI * 2) + this.angleOffset;
            var endAngle = ((i+1) / amount) * (Math.PI * 2) + this.angleOffset;
            var moveAngle = startAngle+((endAngle-startAngle)/2);
            var speed = randInt(35, 50);
            var vx = Math.cos(moveAngle) * speed;
            var vy = Math.sin(moveAngle) * speed;
            this.gibs.push(new Gib(this.x, this.y, vx, vy, radius, color, startAngle, endAngle, timer));
        }
    }
    step(dt) {
        for (var i = 0; i < this.gibs.length; i++) {
            var g = this.gibs[i];
            g.step(dt);
            if (g.health <= 0) {
                this.gibs.splice(i, 1);
            }
        }
    }
    entityRender() {
        for (var g of this.gibs) {
            g.entityRender();
        }
    }
}


const players = [new Player(300, 700)];
const enemies = [new Boss1(300, 200)];
const bullets = [];
const gibs = [];


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
        if (gameOver) {
            if (keys["Enter"]) window.location.reload();
            ctx.fillStyle = 'red';
            ctx.textAlign = "center"; 
            ctx.font = "25px Arial";
            ctx.fillText(`Final Score: ${Math.floor(score)}`, 300, 400);
        }
        else {
            if (keys["Enter"]) gamePaused = false;
            ctx.fillStyle = 'red';
            ctx.textAlign = "center"; 
            ctx.font = "25px Arial";
            ctx.fillText("Score: " + Math.floor(score), 300, 400);
        }
        return;
    }

    score += dt * 10;

    for (var i = 0; i < players.length; i++) {
        var p = players[i];
        p.step(dt);
        if (p.lives <= 0) {
            players.splice(i, 1);
        }
    }
    if (players.length <= 0) {
        gamePaused = true;
        gameOver = true;
        return;
    }

    updateEntities(enemies, dt);
    updateEntities(bullets, dt);
    updateEntities(gibs, dt);

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
    
    // Draw Entities
    for (var p of players) {
        p.entityRender();
    }
    for (var e of enemies) {
        e.entityRender();
    }
    for (var b of bullets) {
        b.entityRender();
    }
    for (var g of gibs) {
        g.entityRender();
    }

    //Score and Other Stuff
    ctx.fillStyle = 'gray';
    ctx.fillRect(0, 0, canvas.width, 40)

    for (var p of players) {
        p.uiRender();
    }
    for (var e of enemies) {
        e.uiRender();
    }

    ctx.textAlign = "center"; 
    ctx.fillStyle = 'white';
    ctx.font = "25px Arial"
    ctx.fillText("Score: " + Math.floor(score), 300, 25);

    // ctx.font = "10px Arial";
    // ctx.fillText("bullets " + bullets.length, 10, 50);
    // ctx.fillText("enemies " + enemies.length, 10, 60);

}

requestAnimationFrame(loop);
