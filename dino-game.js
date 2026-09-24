const canvas = document.querySelector('#game-canvas');
const context = canvas.getContext('2d');
const scoreElement = document.querySelector('#score');
const highScoreElement = document.querySelector('#high-score');
const statusElement = document.querySelector('#status');
const restartButton = document.querySelector('#restart-button');

const WORLD_WIDTH = canvas.width;
const WORLD_HEIGHT = canvas.height;
const GROUND_Y = 260;
const HIGH_SCORE_KEY = 'dino-game-high-score';
const dino = { x: 92, y: GROUND_Y - 54, width: 45, height: 54, velocityY: 0, isDucking: false };
let obstacles = [];
let powerups = [];
let state = 'ready';
let score = 0;
let highScore = Number.parseInt(localStorage.getItem(HIGH_SCORE_KEY), 10) || 0;
let speed = 350;
let spawnTimer = 0;
let nextSpawn = 1;
let previousTime = 0;
let audioContext;
let powerupTimer = 0;
let nextPowerup = 5;
const activePowerups = { shield: 0, slow: 0, magnet: 0 };
const powerupLabels = { shield: '護盾啟動', slow: '時間減速', magnet: '磁鐵加分' };

function formatScore(value) {
  return String(Math.floor(value)).padStart(5, '0');
}

function updateScoreDisplay() {
  scoreElement.textContent = formatScore(score);
  highScoreElement.textContent = formatScore(highScore);
}

function ensureAudio() {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === 'suspended') audioContext.resume();
}

function playSound(frequency, duration, type = 'sine', volume = .04) {
  if (!audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(.001, now + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

function startGame(withJump = false) {
  if (state === 'game-over') resetGame();
  ensureAudio();
  state = 'running';
  statusElement.textContent = '';
  if (withJump) jump();
}

function resetGame() {
  state = 'ready';
  score = 0;
  speed = 350;
  spawnTimer = 0;
  nextSpawn = 1;
  obstacles = [];
  powerups = [];
  powerupTimer = 0;
  nextPowerup = 5;
  activePowerups.shield = 0;
  activePowerups.slow = 0;
  activePowerups.magnet = 0;
  dino.y = GROUND_Y - dino.height;
  dino.velocityY = 0;
  dino.isDucking = false;
  statusElement.textContent = '按空白鍵開始';
  updateScoreDisplay();
}

function jump() {
  if (state === 'ready' || state === 'game-over') startGame();
  if (dino.y >= GROUND_Y - dino.height - 1) {
    dino.velocityY = -780;
    playSound(520, .08, 'square', .035);
  }
}

function setDucking(isDucking) {
  if (state === 'running') dino.isDucking = isDucking;
}

function spawnObstacle() {
  const isBird = Math.random() > 0.62;
  const obstacle = isBird
    ? { type: 'bird', x: WORLD_WIDTH + 20, y: 166 + Math.round(Math.random()) * 28, width: 48, height: 28 }
    : { type: 'log', x: WORLD_WIDTH + 20, y: 0, width: 58 + Math.random() * 22, height: 42 + Math.random() * 22 };
  if (obstacle.type === 'log') obstacle.y = GROUND_Y - obstacle.height;
  obstacles.push(obstacle);
  nextSpawn = Math.max(.7, 1.25 + Math.random() * .8 - (speed - 350) / 1800);
}

function spawnPowerup() {
  const types = ['shield', 'slow', 'magnet'];
  const type = types[Math.floor(Math.random() * types.length)];
  powerups.push({ type, x: WORLD_WIDTH + 20, y: 125 + Math.random() * 80, width: 30, height: 30 });
  nextPowerup = 7 + Math.random() * 5;
}

function getDinoBox() {
  const height = dino.isDucking ? 31 : dino.height;
  return { x: dino.x + 7, y: dino.y + dino.height - height + 5, width: dino.width - 12, height: height - 8 };
}

function getObstacleBox(obstacle) {
  return { x: obstacle.x + 4, y: obstacle.y + 3, width: obstacle.width - 8, height: obstacle.height - 5 };
}

function getPowerupBox(powerup) {
  return { x: powerup.x + 2, y: powerup.y + 2, width: powerup.width - 4, height: powerup.height - 4 };
}

function intersects(first, second) {
  // AABB：兩個矩形在水平與垂直方向都重疊時，代表發生碰撞。
  return first.x < second.x + second.width && first.x + first.width > second.x && first.y < second.y + second.height && first.y + first.height > second.y;
}

function endGame() {
  state = 'game-over';
  playSound(130, .3, 'sawtooth', .06);
  if (score > highScore) {
    highScore = Math.floor(score);
    localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
  }
  statusElement.textContent = 'GAME OVER｜按空白鍵或點擊重新開始';
  updateScoreDisplay();
}

function collectPowerup(powerup) {
  activePowerups[powerup.type] = 6;
  playSound(760, .14, 'triangle', .05);
  statusElement.textContent = powerupLabels[powerup.type];
  window.setTimeout(() => {
    if (state === 'running') statusElement.textContent = '';
  }, 700);
}

function update(deltaTime) {
  if (state !== 'running') return;
  const delta = Math.min(deltaTime, .04);
  activePowerups.shield = Math.max(0, activePowerups.shield - delta);
  activePowerups.slow = Math.max(0, activePowerups.slow - delta);
  activePowerups.magnet = Math.max(0, activePowerups.magnet - delta);
  score += delta * (activePowerups.magnet > 0 ? 18 : 10);
  speed = Math.min(760, 350 + score * 4.8);
  // 速度、位置與重力都乘上 delta，確保遊戲不受螢幕更新率影響。
  dino.velocityY += 2100 * delta;
  dino.y += dino.velocityY * delta;
  if (dino.y > GROUND_Y - dino.height) {
    dino.y = GROUND_Y - dino.height;
    dino.velocityY = 0;
  }
  spawnTimer += delta;
  if (spawnTimer >= nextSpawn) {
    spawnTimer = 0;
    spawnObstacle();
  }
  powerupTimer += delta;
  if (powerupTimer >= nextPowerup) {
    powerupTimer = 0;
    spawnPowerup();
  }
  const movementSpeed = speed * (activePowerups.slow > 0 ? .55 : 1);
  obstacles.forEach((obstacle) => { obstacle.x -= movementSpeed * delta; });
  obstacles = obstacles.filter((obstacle) => obstacle.x + obstacle.width > -20);
  powerups.forEach((powerup) => { powerup.x -= movementSpeed * delta; });
  const dinoBox = getDinoBox();
  powerups = powerups.filter((powerup) => {
    if (intersects(dinoBox, getPowerupBox(powerup))) {
      collectPowerup(powerup);
      return false;
    }
    return powerup.x + powerup.width > -20;
  });
  const hitObstacle = obstacles.find((obstacle) => intersects(dinoBox, getObstacleBox(obstacle)));
  if (hitObstacle && activePowerups.shield > 0) {
    activePowerups.shield = 0;
    obstacles = obstacles.filter((obstacle) => obstacle !== hitObstacle);
    playSound(980, .12, 'square', .04);
  } else if (hitObstacle) endGame();
  updateScoreDisplay();
}

function getNightAmount() {
  const cycle = (score % 120) / 120;
  return (Math.sin(cycle * Math.PI * 2 - Math.PI / 2) + 1) / 2;
}

function mixColor(dayColor, nightColor, amount) {
  const day = dayColor.match(/\w\w/g).map((part) => Number.parseInt(part, 16));
  const night = nightColor.match(/\w\w/g).map((part) => Number.parseInt(part, 16));
  return `#${day.map((value, index) => Math.round(value + (night[index] - value) * amount).toString(16).padStart(2, '0')).join('')}`;
}

function drawCloud(x, y, scale, nightAmount) {
  context.fillStyle = `rgba(255, 210, 192, ${.42 - nightAmount * .18})`;
  context.beginPath();
  context.arc(x, y, 18 * scale, 0, Math.PI * 2);
  context.arc(x + 22 * scale, y - 7 * scale, 25 * scale, 0, Math.PI * 2);
  context.arc(x + 50 * scale, y, 16 * scale, 0, Math.PI * 2);
  context.fill();
}

function drawLantern(x, y, scale) {
  context.fillStyle = `rgba(255, 196, 100, ${.5 + getNightAmount() * .5})`;
  context.fillRect(x, y, 12 * scale, 18 * scale);
  context.fillStyle = '#ffefb0';
  context.fillRect(x + 3 * scale, y + 4 * scale, 6 * scale, 10 * scale);
  context.fillStyle = '#633c58';
  context.fillRect(x + 3 * scale, y - 4 * scale, 6 * scale, 4 * scale);
}

function drawTree(x, y, scale, color) {
  context.fillStyle = '#241d35';
  context.fillRect(x - 5 * scale, y, 10 * scale, 100 * scale);
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(x, y - 105 * scale);
  context.lineTo(x - 46 * scale, y - 12 * scale);
  context.lineTo(x + 46 * scale, y - 12 * scale);
  context.closePath();
  context.fill();
  context.beginPath();
  context.moveTo(x, y - 75 * scale);
  context.lineTo(x - 35 * scale, y - 4 * scale);
  context.lineTo(x + 35 * scale, y - 4 * scale);
  context.closePath();
  context.fill();
}

function drawMountains(nightAmount) {
  context.fillStyle = mixColor('#886281', '#2b294c', nightAmount);
  context.beginPath();
  context.moveTo(0, 185);
  context.lineTo(120, 80);
  context.lineTo(205, 175);
  context.lineTo(320, 58);
  context.lineTo(470, 185);
  context.lineTo(610, 78);
  context.lineTo(780, 185);
  context.lineTo(900, 95);
  context.lineTo(900, 260);
  context.lineTo(0, 260);
  context.closePath();
  context.fill();
}

function drawDino() {
  const height = dino.isDucking ? 31 : dino.height;
  const top = dino.y + dino.height - height;
  context.fillStyle = mixColor('#f29a67', '#f6c19a', getNightAmount());
  context.fillRect(dino.x + 5, top + 12, dino.width - 10, height - 12);
  context.fillRect(dino.x + 14, top + 3, 32, 27);
  context.fillStyle = '#f29a67';
  context.beginPath();
  context.moveTo(dino.x + 16, top + 8);
  context.lineTo(dino.x + 16, top - 8);
  context.lineTo(dino.x + 25, top + 2);
  context.closePath();
  context.fill();
  context.beginPath();
  context.moveTo(dino.x + 37, top + 2);
  context.lineTo(dino.x + 46, top - 8);
  context.lineTo(dino.x + 46, top + 10);
  context.closePath();
  context.fill();
  context.fillStyle = '#fff5dc';
  context.fillRect(dino.x + 35, top + 11, 5, 5);
  context.fillStyle = '#3b2341';
  context.fillRect(dino.x + 42, top + 24, 9, 3);
  context.fillRect(dino.x + 9, top + height - 4, 7, 8);
  context.fillRect(dino.x + 28, top + height - 4, 7, 8);
}

function drawObstacle(obstacle) {
  context.fillStyle = obstacle.type === 'bird' ? '#b9a5df' : '#704035';
  if (obstacle.type === 'bird') {
    context.fillRect(obstacle.x + 8, obstacle.y + 8, 34, 16);
    context.fillRect(obstacle.x, obstacle.y + 4, 18, 7);
    context.fillRect(obstacle.x + 25, obstacle.y + 18, 8, 14);
    context.fillStyle = '#f8e3c1';
    context.fillRect(obstacle.x + 34, obstacle.y + 11, 4, 4);
    return;
  }
  context.fillRect(obstacle.x, obstacle.y + 8, obstacle.width, obstacle.height - 8);
  context.fillStyle = '#a2634a';
  context.fillRect(obstacle.x + 8, obstacle.y + 15, obstacle.width - 16, 5);
  context.fillRect(obstacle.x + 16, obstacle.y + 29, obstacle.width - 28, 4);
  context.fillStyle = '#4a2b38';
  context.fillRect(obstacle.x + 3, obstacle.y + obstacle.height - 8, 8, 10);
  context.fillRect(obstacle.x + obstacle.width - 11, obstacle.y + obstacle.height - 8, 8, 10);
}

function drawPowerup(powerup) {
  const colors = { shield: '#4d9de0', slow: '#f4b942', magnet: '#d95d9b' };
  context.fillStyle = colors[powerup.type];
  context.beginPath();
  context.arc(powerup.x + 15, powerup.y + 15, 14, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#fffdf7';
  context.font = '700 16px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(powerup.type === 'shield' ? 'S' : powerup.type === 'slow' ? 'T' : '+', powerup.x + 15, powerup.y + 15);
  context.textAlign = 'start';
  context.textBaseline = 'alphabetic';
}

function draw() {
  const nightAmount = getNightAmount();
  context.fillStyle = mixColor('#b7e2e6', '#172e45', nightAmount);
  context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  context.fillStyle = mixColor('#eaf5e7', '#27404b', nightAmount);
  context.fillRect(0, 92, WORLD_WIDTH, WORLD_HEIGHT - 92);
  drawMountains(nightAmount);
  drawTree(78, 235, 1.45, mixColor('#35475d', '#17253d', nightAmount));
  drawTree(790, 236, 1.3, mixColor('#35475d', '#17253d', nightAmount));
  if (nightAmount > .35) {
    context.fillStyle = `rgba(255, 246, 190, ${nightAmount})`;
    for (let index = 0; index < 20; index += 1) context.fillRect((index * 83) % WORLD_WIDTH, 22 + ((index * 37) % 72), 3, 3);
  }
  drawCloud(130, 52, 1, nightAmount);
  drawCloud(690, 82, .7, nightAmount);
  drawLantern(235, 84, 1);
  drawLantern(755, 55, .8);
  drawLantern(515, 116, .65);
  context.fillStyle = mixColor('#23323a', '#d6e2dc', nightAmount);
  context.fillRect(0, GROUND_Y, WORLD_WIDTH, 4);
  context.fillStyle = mixColor('#6a7b80', '#9ab2ac', nightAmount);
  for (let x = -((score * speed / 60) % 70); x < WORLD_WIDTH; x += 70) context.fillRect(x, GROUND_Y + 15, 34, 3);
  drawDino();
  obstacles.forEach(drawObstacle);
  powerups.forEach(drawPowerup);
  if (activePowerups.shield > 0) {
    context.strokeStyle = '#4d9de0';
    context.lineWidth = 4;
    context.beginPath();
    context.arc(dino.x + 24, dino.y + 27, 37, 0, Math.PI * 2);
    context.stroke();
  }
}

function gameLoop(timestamp) {
  const deltaTime = previousTime ? (timestamp - previousTime) / 1000 : 0;
  previousTime = timestamp;
  update(deltaTime);
  draw();
  // 即使遊戲尚未開始，也持續繪製畫面，讓 Canvas 狀態保持一致。
  requestAnimationFrame(gameLoop);
}

function handleKeyDown(event) {
  if (event.code === 'Space' || event.code === 'ArrowUp') {
    event.preventDefault();
    jump();
  }
  if (event.code === 'ArrowDown') setDucking(true);
}

function handleKeyUp(event) {
  if (event.code === 'ArrowDown') setDucking(false);
}

document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);
canvas.addEventListener('pointerdown', () => jump());
restartButton.addEventListener('click', () => { resetGame(); startGame(); });
resetGame();
requestAnimationFrame(gameLoop);