const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

//some bullshit
const TICK_RATE = 60;
const MS_PER_TICK = 1000 / TICK_RATE;
let lastTick = performance.now();
let accumulator = 0;

function update() {
    const now = performance.now();
    const delta = now - lastTick;
    lastTick = now;

    accumulator += delta;

    while (accumulator >= MS_PER_TICK) {
        mainLoop(MS_PER_TICK / 1000);
        accumulator -= MS_PER_TICK;
    }

    requestAnimationFrame(update);
}

// Input
const keys = {};
window.addEventListener('keydown', e => keys[e.key] = true);
window.addEventListener('keyup', e => keys[e.key] = false);

const controls = [
    {
        up: 'ArrowUp',
        down: 'ArrowDown',
        left: 'ArrowLeft',
        right: 'ArrowRight',
        shoot: 'Control'
    },
    {
        up: 'w',
        down: 's',
        left: 'a',
        right: 'd',
        shoot: 'g'
    }
]

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
function drawText(text, x, y, font, fillStyle, alignment) {
    ctx.font = font;
    ctx.fillStyle = fillStyle;
    ctx.textAlign = alignment;
    ctx.fillText(text, x, y);
}

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
            for (var p of players.entities) {
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
    die() {}
    entityRender() {}
    uiRender() {}
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
    step(dt) {}
    die() {
        gibs.push(new GibSpawner(this.x, this.y, this.radius, this.color, 9));
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
        for (var e of enemies.entities) {
            var dist = Math.hypot(this.x - e.x, this.y - e.y);
            if (dist < this.radius + e.hitboxRadius) {
                e.hit(this.damage);
                this.health = 0;
            }
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

    }
}
class EnemyBullet extends Bullet {
    constructor(x, y, vx, vy, radius, damage) {
        super(x, y, vx, vy, radius, damage);
        this.color = '#ff3336'
    }
    step(dt) {
        for (var p of players.entities) {
            var dist = Math.hypot(this.x - p.x, this.y - p.y);
            if (dist < this.radius + p.hitboxRadius && p.hitCooldownTimer <= 0) {
                p.hit(this.damage);
                this.health = 0;
            }
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

    }
}


class Player extends Entity {
    constructor(x, y, index, color) {
        super(x, y, 1);
        this.index = index;
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
        this.firstColor = color;
        this.color = color;
    }
    step(dt) {
        if (keys[controls[this.index].up]) this.y -= this.moveSpeed * dt;
        if (keys[controls[this.index].down]) this.y += this.moveSpeed * dt;
        if (keys[controls[this.index].left]) this.x -= this.moveSpeed * dt;
        if (keys[controls[this.index].right]) this.x += this.moveSpeed * dt;

        // Clamp player to screen
        this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.y));

        // Player bullets
        if (this.shotCooldownTimer > 0) this.shotCooldownTimer -= dt;
        else if (keys[controls[this.index].shoot]) {
            bullets.push(new PlayerBullet(this.x, this.y, 0, -500, 6, this.bulletDamage));
            this.shotCooldownTimer = this.shotCooldown;
        }

        if (this.health <= 0 && this.hitCooldownTimer <= 0) {
            gibs.push(new GibSpawner(this.x, this.y, this.radius, this.color, 12));
            this.x = this.firstX;
            this.y = this.firstY;
            this.hitCooldownTimer = this.hitCooldown;
            this.lives--;
            this.health = 1;
        }
        else if (this.hitCooldownTimer > 0) {
            this.color = this.firstColor + '77';
            this.hitCooldownTimer -= dt;
        }
        else {
            this.color = this.firstColor;
        }

    }
    hit(damage) {
        this.health -= damage;
    }
    die() {}
    entityRender() {
        //body
        drawFilledCircle(this.x, this.y, this.radius, this.color)
        //hitbox
        drawFilledCircle(this.x, this.y, this.hitboxRadius, 'red')
    }
    uiRender() {
        drawText("Lives: " + Math.floor(this.lives), 500, this.index*25+25, "25px Arial", "white", "center");
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
    die() {
        gibs.push(new GibSpawner(this.x, this.y, this.radius, this.color, 30));
    }
}
class Boss1 extends Enemy {
    constructor(params) {
        super(
            params.x, -params.radius, 
            params.health, 
            [
                new SpiralPattern(1, 6, 300, 0.1, 16),
                new BurstRingPattern(1, 5, 200, 1, 20)
            ]
        );
        this.targetY = params.y;
        this.moveSpeed = params.moveSpeed;
        this.radius = params.radius;
        this.hitboxRadius = 40;
        this.color = 'purple';
    }
    step(dt) {
        this.y += (this.targetY - this.y) * this.moveSpeed * dt;
        super.step(dt);
    }
    entityRender() {
        drawFilledCircle(this.x, this.y, this.radius, this.color)
    }
    uiRender() {
        drawText("Boss Health: " + this.health, 10, 25, "25px Arial", "white", "start");
    }
}
class SideSniper extends Enemy {
    constructor(params) {
        super(
            params.x, -params.radius, 
            params.health, 
            [new TowardsPlayerPattern()]
        );
        this.moveSpeed = params.moveSpeed;
        this.radius = params.radius;
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


class EntityList {
    constructor(entities) {
        this.entities = entities;
    }
    push(entities) {
        this.entities.push(entities);
    }
    stepAndKill(dt) {
        for (var i = 0; i < this.entities.length; i++) {
            var e = this.entities[i];
            e.step(dt);
            if (e.x < -e.radius || e.x > canvas.width + e.radius || e.y < -e.radius || e.y > canvas.height + e.radius) {
                this.entities.splice(i, 1);
            }
            else if (e.health <= 0) {
                e.die();
                this.entities.splice(i, 1);
            }
        }
    }
    entityRender() {
        for (var e of this.entities) {
            e.entityRender();
        }
    }
    uiRender() {
        for (var e of this.entities) {
            e.uiRender();
        }
    }
}
class PlayerList extends EntityList{
    constructor(players) {
        super(players)
    }
    stepAndKill(dt) {
        for (var i = 0; i < this.entities.length; i++) {
            var e = this.entities[i];
            e.step(dt);
            if (e.lives <= 0) {
                e.die();
                this.entities.splice(i, 1);
            }
        }
    }
}

let players = new PlayerList([]);
let enemies = new EntityList([]);
let bullets = new EntityList([]);
let gibs = new EntityList([]);


class Level {
    constructor(waves) {
        this.waves = waves;
    }
    isFinished() {
        var finishedAmount = 0;
        for (var e in this.waves) {
            if (e.isFinished()) finishedAmount++;
        }
        if (finishedAmount >= this.waves.length) return true;
        else return false;
    }
}
class Wave {
    constructor(enemySpawners) {
        this.enemySpawners = enemySpawners;
    }
    isFinished() {
        var finishedAmount = 0;
        for (var e of this.enemySpawners) {
            if (e.isFinished()) finishedAmount++;
        }
        if (finishedAmount >= this.enemySpawners.length) return true;
        else return false;
    }
}
class enemySpawner {
    constructor(enemy, parameters, amount, timeBetweenSpawns) {
        this.enemy = enemy;
        this.parameters = parameters;
        this.amount = amount;
        this.cooldown = timeBetweenSpawns;
        this.cooldownTimer = timeBetweenSpawns;
    }
    spawn(dt) {
        if (this.amount > 0) {
            if (this.cooldownTimer > 0) this.cooldownTimer -= dt;
            else {
                enemies.push(new this.enemy(this.parameters));
                this.amount--;
                this.cooldownTimer = this.cooldown;
            }
        }
    }
    isFinished() {
        return this.amount <= 0;
    }
}

// list of the levels
const levels = [
    new Level([
        new Wave ([
            new enemySpawner(Boss1, {x:200, y:200, radius:30, health:500, moveSpeed:50}, 1, 0),
            new enemySpawner(SideSniper, {x:300, y:-10, radius:15, health:20, moveSpeed: 75}, 20, 1)
        ]),
        new Wave ([
            new enemySpawner(Boss1, {x:200, y:200, radius:30, health:500, moveSpeed:50}, 1, 0),
            new enemySpawner(SideSniper, {x:300, y:-10, radius:15, health:20, moveSpeed: 75}, 20, 1)
        ])
    ]),
    new Level([
        new Wave ([
            new enemySpawner(Boss1, {x:300, y:200, radius:60, health:2000, moveSpeed:50}, 1, 0),
            new enemySpawner(SideSniper, {x:150, y:-10, radius:15, health:20, moveSpeed: 75}, 20, 1),
            new enemySpawner(SideSniper, {x:450, y:-10, radius:15, health:20, moveSpeed: 75}, 20, 1)
        ])
    ])
];

class EndlessGamemode {
    constructor() {}
    spawn(dt) {}
    uiRender() {}
}
class LevelsGamemode {
    constructor(startingLevel) {
        this.levels = Object.create(levels);
        this.levelIndex = startingLevel;
        this.waveIndex = 0;
    }
    spawn(dt) {
        var currentLevel = this.levels[this.levelIndex];
        var currentWave = currentLevel.waves[this.waveIndex];

        if (currentWave.isFinished() && enemies.entities.length <= 0) {
            if (this.waveIndex >= currentLevel.waves.length - 1){
                if (this.levelIndex >= this.levels.length - 1) {
                    gameOver = true;
                }
                else {
                    this.levelIndex++;
                    this.waveIndex = 0;
                }
            }
            else this.waveIndex++;
        }
        else {
            for (var spawner of currentWave.enemySpawners) {
                spawner.spawn(dt);
            }
        }
    }
    uiRender() {
        drawText("Level: " + this.levelIndex, 100, 200, "15px Arial", "white", "center");
        drawText("Wave: " + this.waveIndex, 100, 225, "15px Arial", "white", "center");
    }
}
let gamemode = null;


const gamestates = {
    menu: {
        playerAmount: 1,
        selectedGamemode: null,
        loop: function(dt) {
            var selectedTextStyle = "25px Courier New";
            var notSelectedTextStyle = "20px Courier New";
            if (keys['ArrowLeft']) this.selectedGamemode = new EndlessGamemode();
            else if (keys['ArrowRight']) this.selectedGamemode = new LevelsGamemode(0);
            if (keys['ArrowUp'] && this.playerAmount < 2) this.playerAmount++;
            else if (keys['ArrowDown'] && this.playerAmount > 1) this.playerAmount--;

            if (keys['Enter']) {
                if (this.selectedGamemode != null) {
                    reset();
                    for (var i = 0; i < this.playerAmount; i++) {
                        players.push(new Player(i*100+250, 700, i, '#00ffcc'));
                    }
                    gamemode = this.selectedGamemode;
                    gamestate = gamestates.game;
                    return;
                }
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawText("Circle Game", 300, 300, "25px Courier New", "white", "center");
            drawText("players: " + this.playerAmount, 300, 500, "25px Courier New", "white", "center");
            if (this.selectedGamemode instanceof EndlessGamemode) {
                var endlessTextStyle = selectedTextStyle;
                var levelsTextStyle = notSelectedTextStyle;
            }
            else if (this.selectedGamemode instanceof LevelsGamemode) {
                var endlessTextStyle = notSelectedTextStyle;
                var levelsTextStyle = selectedTextStyle;
            }
            else {
                var endlessTextStyle = notSelectedTextStyle;
                var levelsTextStyle = notSelectedTextStyle;
            }
            drawText("Endless", 200, 400, endlessTextStyle, "white", "center");
            drawText("Levels", 400, 400, levelsTextStyle, "white", "center");

        }
    },
    game: {
        loop: function(dt) {
            if (keys['Escape']) gamePaused = true;
            if (gameOver) {
                if (keys['q']) {
                    gamemode = null;
                    gamestate = gamestates.menu;
                }
            }
            else if (gamePaused) {
                if (keys["Enter"]) gamePaused = false;
                if (keys['q']) {
                    gamemode = null;
                    gamestate = gamestates.menu;
                }
            }

            //STEP
            if (!gamePaused) {
                if (!gameOver) {
                    if (gamemode != null) {
                        gamemode.spawn(dt);
                    }

                    bullets.stepAndKill(dt);
                    players.stepAndKill(dt);
                    enemies.stepAndKill(dt);
                    if (players.entities.length <= 0) {
                        gameOver = true;
                    }
                }
                gibs.stepAndKill(dt);
            }


            //RENDER
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            //ENTITIES
            bullets.entityRender();
            players.entityRender();
            enemies.entityRender();
            gibs.entityRender();

            //UI
            players.uiRender();
            enemies.uiRender();

            if (gamemode != null) {
                gamemode.uiRender();
            }

            if (gamePaused) {
                drawText("Score: " + Math.floor(score), 300, 400, "25px Arial", "red", "center");
                drawText("Q to quit to menu", 300, 450, "25px Arial", "white", "center");
            }
            else if (gameOver) {
                drawText("Final Score: " + Math.floor(score), 300, 400, "25px Arial", "red", "center");
                drawText("Q to quit to menu", 300, 450, "25px Arial", "white", "center");
            }
            else drawText("Score: " + Math.floor(score), 300, 30, "25px Arial", "white", "center");

        }
    }
}

let gamestate = gamestates.menu;


function mainLoop(dt) {
    gamestate.loop(dt);
}

function reset() {
    players = new PlayerList([]);
    enemies = new EntityList([]);
    bullets = new EntityList([]);
    gibs = new EntityList([]);
    gamePaused = false;
    gameOver = false;
    score = 0;
    gamemode = null;
}

requestAnimationFrame(update);
