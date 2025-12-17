// =============================================================================
// NES SUPER MARIO BROS. — GAME ENGINE
// Frame-accurate physics, NES-style collision, exact game flow
// =============================================================================

import {
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  TILE_SIZE,
  GRAVITY_A_HELD,
  GRAVITY_A_RELEASED,
  GRAVITY_FALLING,
  MAX_FALL_SPEED,
  JUMP_VEL_SLOW,
  JUMP_VEL_FAST,
  ACCEL_WALK,
  DECEL_RELEASE,
  DECEL_SKID,
  MAX_WALK_SPEED,
  MAX_RUN_SPEED,
  MIN_WALK_SPEED,
  STOMP_BOUNCE_LOW,
  STOMP_BOUNCE_HIGH,
  GOOMBA_SPEED,
  KOOPA_SPEED,
  SHELL_SPEED,
  MUSHROOM_SPEED,
  GOOMBA_SQUISH_FRAMES,
  SHELL_WAKE_FRAMES,
  COLOR_SKY,
  COLOR_GROUND,
  COLOR_BRICK,
  COLOR_QUESTION,
  COLOR_USED,
  COLOR_PIPE,
  COLOR_PIPE_DARK,
  COLOR_MARIO,
  COLOR_GOOMBA,
  COLOR_KOOPA_GREEN,
  STARTING_LIVES,
  TIMER_START,
  TIMER_TICK_FRAMES,
  DAMAGE_IFRAMES,
  CHAIN_SCORES,
  FLAG_SCORES,
  SCORE_COIN,
  BLOCK_BUMP_HEIGHT,
  BLOCK_BUMP_FRAMES,
  DEATH_JUMP_FRAMES,
  FLAG_SLIDE_SPEED,
  LEVEL_CLEAR_WALK_SPEED,
} from '../constants';
import {
  GameState,
  PlayerState,
  PlayerAction,
  EntityType,
  EnemyState,
  TileType,
  BlockContent,
  Direction,
  InputState,
  BlockData,
} from '../types';
import { InputManager } from './input';
import { audioManager } from './audio';
import { getLevelData } from './level';

// =============================================================================
// ENTITY CLASSES
// =============================================================================

class Entity {
  x: number;
  y: number;
  vx: number = 0;
  vy: number = 0;
  width: number;
  height: number;
  type: EntityType;
  dead: boolean = false;
  grounded: boolean = false;
  dir: Direction = Direction.Right;
  active: boolean = false;

  constructor(type: EntityType, x: number, y: number, w: number, h: number) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.width = w;
    this.height = h;
  }
}

class Enemy extends Entity {
  state: EnemyState = EnemyState.Walking;
  stateTimer: number = 0;
  startX: number;

  constructor(type: EntityType, x: number, y: number) {
    const h = type === EntityType.KoopaTroopa ? 24 : 16;
    super(type, x, y, 16, h);
    this.startX = x;
    this.dir = Direction.Left;
    this.vx = type === EntityType.KoopaTroopa ? -KOOPA_SPEED : -GOOMBA_SPEED;
  }
}

class PowerUp extends Entity {
  emerged: boolean = false;
  emergeY: number = 0;

  constructor(type: EntityType, x: number, y: number) {
    super(type, x, y, 16, 16);
    this.emergeY = y;
    this.dir = Direction.Right;
  }
}

class Particle extends Entity {
  life: number;
  
  constructor(type: EntityType, x: number, y: number, vx: number, vy: number, life: number = 60) {
    super(type, x, y, 8, 8);
    this.vx = vx;
    this.vy = vy;
    this.life = life;
    this.active = true;
  }
}

class Player extends Entity {
  state: PlayerState = PlayerState.Small;
  action: PlayerAction = PlayerAction.Standing;
  
  // Jump state — NES tracks if A was pressed this jump
  isJumping: boolean = false;
  jumpHeld: boolean = false;
  canJump: boolean = true;  // Must release A before next jump
  
  // Invincibility
  iframeTimer: number = 0;
  starTimer: number = 0;
  
  // Animation
  animFrame: number = 0;
  animTimer: number = 0;
  
  // Flagpole
  onFlagpole: boolean = false;
  flagY: number = 0;

  constructor() {
    // NES Mario hitbox: 12x16 small, 12x32 big
    super(EntityType.Player, 40, 192, 12, 16);
    this.dir = Direction.Right;
  }

  get isBig(): boolean {
    return this.state !== PlayerState.Small;
  }

  updateHitbox() {
    this.height = this.isBig ? 32 : 16;
    this.width = 12;
  }
}

// =============================================================================
// MAIN ENGINE
// =============================================================================

export class GameEngine {
  ctx: CanvasRenderingContext2D;
  input: InputManager;
  gameState: GameState = GameState.Title;
  
  player: Player;
  enemies: Enemy[] = [];
  powerUps: PowerUp[] = [];
  particles: Particle[] = [];
  
  level: { tiles: number[][]; width: number; height: number };
  blockData: Map<string, BlockData> = new Map();
  
  cameraX: number = 0;
  
  // Game state
  lives: number = STARTING_LIVES;
  score: number = 0;
  coins: number = 0;
  world: string = '1-1';
  timeLeft: number = TIMER_START;
  timerFrames: number = 0;
  
  // Chain kill tracking (resets when touching ground)
  chainKillCount: number = 0;
  
  // Death animation
  deathTimer: number = 0;
  
  // Level clear
  flagScore: number = 0;
  levelClearPhase: number = 0;
  
  // Frame counter
  frameCount: number = 0;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.input = new InputManager();
    this.player = new Player();
    this.level = { tiles: [], width: 0, height: 0 };
    this.loadLevel();
  }

  loadLevel() {
    const data = getLevelData();
    this.level = {
      tiles: data.tiles.map(row => [...row]),  // Deep copy
      width: data.width,
      height: data.height,
    };

    // Reset entities
    this.enemies = [];
    this.powerUps = [];
    this.particles = [];
    this.blockData.clear();

    // Spawn enemies from level data
    data.entities.forEach(e => {
      if (e.type === 'goomba') {
        const enemy = new Enemy(EntityType.Goomba, e.x, e.y);
        this.enemies.push(enemy);
      } else if (e.type === 'koopa') {
        const enemy = new Enemy(EntityType.KoopaTroopa, e.x, e.y - 8);
        this.enemies.push(enemy);
      }
    });

    // Setup special blocks from level data
    this.setupBlockData(data.blocks);
  }

  setupBlockData(levelBlocks: { x: number; y: number; content: number }[]) {
    // Use block data from level definition
    levelBlocks.forEach(block => {
      this.blockData.set(`${block.x},${block.y}`, {
        x: block.x,
        y: block.y,
        content: block.content as BlockContent,
        bumpTimer: 0,
        bumpOffset: 0,
      });
    });

    // Also scan for any question blocks not in the list (default to coin)
    for (let y = 0; y < this.level.tiles.length; y++) {
      for (let x = 0; x < this.level.tiles[y].length; x++) {
        const tile = this.level.tiles[y][x];
        const key = `${x},${y}`;
        if (tile === TileType.QuestionBlock && !this.blockData.has(key)) {
          this.blockData.set(key, {
            x, y,
            content: BlockContent.Coin,
            bumpTimer: 0,
            bumpOffset: 0,
          });
        }
      }
    }
  }

  reset() {
    this.loadLevel();
    
    this.player = new Player();
    this.player.x = 40;
    this.player.y = 192;
    
    this.cameraX = 0;
    this.timeLeft = TIMER_START;
    this.timerFrames = 0;
    this.chainKillCount = 0;
    this.deathTimer = 0;
    this.levelClearPhase = 0;
    this.frameCount = 0;
  }

  fullReset() {
    this.reset();
    this.lives = STARTING_LIVES;
    this.score = 0;
    this.coins = 0;
    this.gameState = GameState.Title;
  }

  // ===========================================================================
  // MAIN UPDATE
  // ===========================================================================

  update() {
    this.frameCount++;
    const input = this.input.poll();

    switch (this.gameState) {
      case GameState.Title:
        if (input.start || input.jump) {
          this.gameState = GameState.Playing;
          audioManager.init();
        }
        break;

      case GameState.Playing:
        this.updatePlaying(input);
        break;

      case GameState.Dying:
        this.updateDying();
        break;

      case GameState.LevelClear:
        this.updateLevelClear();
        break;

      case GameState.GameOver:
        if (input.start) {
          this.fullReset();
        }
        break;
    }
  }

  updatePlaying(input: InputState) {
    // Timer
    this.timerFrames++;
    if (this.timerFrames >= TIMER_TICK_FRAMES) {
      this.timerFrames = 0;
      this.timeLeft--;
      if (this.timeLeft <= 0) {
        this.killPlayer();
        return;
      }
    }

    // Update entities
    this.updatePlayer(input);
    this.updateEnemies();
    this.updatePowerUps();
    this.updateParticles();
    this.updateBlocks();
    this.updateCamera();

    // Pit death
    if (this.player.y > SCREEN_HEIGHT + 16) {
      this.killPlayer();
    }
  }

  // ===========================================================================
  // PLAYER UPDATE — NES-ACCURATE PHYSICS
  // ===========================================================================

  updatePlayer(input: InputState) {
    const p = this.player;
    if (p.dead) return;

    // Decrease invincibility
    if (p.iframeTimer > 0) p.iframeTimer--;
    if (p.starTimer > 0) p.starTimer--;

    // Reset chain kills when grounded
    if (p.grounded) {
      this.chainKillCount = 0;
    }

    // --- HORIZONTAL MOVEMENT (NES-style) ---
    const maxSpeed = input.run ? MAX_RUN_SPEED : MAX_WALK_SPEED;

    if (input.left && !input.right) {
      if (p.vx > 0 && p.grounded) {
        // SKID — NES applies skid decel, not instant reverse
        p.vx -= DECEL_SKID;
        p.action = PlayerAction.Skidding;
      } else {
        p.vx -= ACCEL_WALK;
        p.action = p.grounded ? PlayerAction.Walking : p.action;
      }
      p.dir = Direction.Left;
    } else if (input.right && !input.left) {
      if (p.vx < 0 && p.grounded) {
        // SKID
        p.vx += DECEL_SKID;
        p.action = PlayerAction.Skidding;
      } else {
        p.vx += ACCEL_WALK;
        p.action = p.grounded ? PlayerAction.Walking : p.action;
      }
      p.dir = Direction.Right;
    } else {
      // No input — NES applies deceleration
      if (p.grounded) {
        if (p.vx > 0) {
          p.vx -= DECEL_RELEASE;
          if (p.vx < 0) p.vx = 0;
        } else if (p.vx < 0) {
          p.vx += DECEL_RELEASE;
          if (p.vx > 0) p.vx = 0;
        }
      }
    }

    // Clamp to max speed
    if (p.vx > maxSpeed) p.vx = maxSpeed;
    if (p.vx < -maxSpeed) p.vx = -maxSpeed;

    // Snap to zero if very slow
    if (Math.abs(p.vx) < MIN_WALK_SPEED && !input.left && !input.right) {
      p.vx = 0;
      if (p.grounded) p.action = PlayerAction.Standing;
    }

    // --- JUMPING (NES two-gravity system) ---
    // Can only start jump if grounded AND A was released since last jump
    if (input.jump && p.canJump && p.grounded) {
      // NES: Jump velocity varies with horizontal speed
      const jumpVel = Math.abs(p.vx) > MAX_WALK_SPEED ? JUMP_VEL_FAST : JUMP_VEL_SLOW;
      p.vy = jumpVel;
      p.isJumping = true;
      p.jumpHeld = true;
      p.canJump = false;
      p.grounded = false;
      p.action = PlayerAction.Jumping;
      audioManager.playJump();
    }

    // Track if A is held during jump
    if (!input.jump) {
      p.canJump = true;  // Can jump again after release
      p.jumpHeld = false;
    }

    // --- GRAVITY (NES two-gravity system) ---
    // NES uses different gravity based on:
    // 1. Whether A is held
    // 2. Whether moving up or down
    let gravity: number;
    if (p.vy < 0) {
      // Moving UP
      gravity = p.jumpHeld ? GRAVITY_A_HELD : GRAVITY_A_RELEASED;
    } else {
      // Moving DOWN or stationary
      gravity = GRAVITY_FALLING;
      p.isJumping = false;
      if (!p.grounded) p.action = PlayerAction.Falling;
    }

    p.vy += gravity;
    if (p.vy > MAX_FALL_SPEED) p.vy = MAX_FALL_SPEED;

    // --- APPLY MOVEMENT & COLLISION ---
    // NES does X then Y, separate passes
    
    // X movement
    p.x += p.vx;
    this.collidePlayerX();

    // Y movement
    p.y += p.vy;
    p.grounded = false;
    this.collidePlayerY();

    // Clamp to camera (can't go backwards)
    if (p.x < this.cameraX) {
      p.x = this.cameraX;
      p.vx = 0;
    }
  }

  collidePlayerX() {
    const p = this.player;
    const left = Math.floor(p.x / TILE_SIZE);
    const right = Math.floor((p.x + p.width - 1) / TILE_SIZE);
    const top = Math.floor(p.y / TILE_SIZE);
    const bottom = Math.floor((p.y + p.height - 1) / TILE_SIZE);

    for (let ty = top; ty <= bottom; ty++) {
      for (let tx = left; tx <= right; tx++) {
        if (this.isSolidTile(tx, ty)) {
          if (p.vx > 0) {
            // Moving right, push left
            p.x = tx * TILE_SIZE - p.width;
            p.vx = 0;
          } else if (p.vx < 0) {
            // Moving left, push right
            p.x = (tx + 1) * TILE_SIZE;
            p.vx = 0;
          }
          return;
        }
      }
    }
  }

  collidePlayerY() {
    const p = this.player;
    const left = Math.floor(p.x / TILE_SIZE);
    const right = Math.floor((p.x + p.width - 1) / TILE_SIZE);
    const top = Math.floor(p.y / TILE_SIZE);
    const bottom = Math.floor((p.y + p.height - 1) / TILE_SIZE);

    for (let ty = top; ty <= bottom; ty++) {
      for (let tx = left; tx <= right; tx++) {
        const tile = this.getTile(tx, ty);
        
        // Check flagpole
        if (tile === TileType.FlagPole || tile === TileType.FlagTop) {
          this.grabFlagpole(tx);
          return;
        }

        if (this.isSolidTile(tx, ty)) {
          if (p.vy > 0) {
            // Falling, land on top
            p.y = ty * TILE_SIZE - p.height;
            p.vy = 0;
            p.grounded = true;
            if (p.action === PlayerAction.Jumping || p.action === PlayerAction.Falling) {
              p.action = PlayerAction.Standing;
            }
          } else if (p.vy < 0) {
            // Rising, hit head
            p.y = (ty + 1) * TILE_SIZE;
            p.vy = 0;
            this.bumpBlock(tx, ty);
          }
          return;
        }
      }
    }
  }

  // ===========================================================================
  // BLOCK INTERACTION
  // ===========================================================================

  bumpBlock(tx: number, ty: number) {
    const tile = this.getTile(tx, ty);
    const key = `${tx},${ty}`;
    
    if (tile === TileType.QuestionBlock) {
      // Get block content
      const data = this.blockData.get(key);
      if (data) {
        // Start bump animation
        data.bumpTimer = BLOCK_BUMP_FRAMES;
        
        // Spawn content
        if (data.content === BlockContent.Coin) {
          this.coins++;
          this.score += SCORE_COIN;
          audioManager.playCoin();
          // Spawn coin particle
          this.particles.push(new Particle(
            EntityType.Coin,
            tx * TILE_SIZE + 4, ty * TILE_SIZE - 16,
            0, -4,
            20
          ));
        } else if (data.content === BlockContent.Mushroom) {
          // Spawn mushroom (or fire flower if big)
          const powerType = this.player.isBig ? EntityType.FireFlower : EntityType.Mushroom;
          const pu = new PowerUp(powerType, tx * TILE_SIZE, ty * TILE_SIZE);
          pu.emergeY = ty * TILE_SIZE - 16;
          this.powerUps.push(pu);
          audioManager.playPowerUp();
        }
        
        // Change to used block
        this.level.tiles[ty][tx] = TileType.UsedBlock;
      }
    } else if (tile === TileType.Brick) {
      if (this.player.isBig) {
        // Break brick
        this.level.tiles[ty][tx] = TileType.Air;
        audioManager.playStomp();
        // Spawn debris
        this.spawnBrickDebris(tx * TILE_SIZE + 8, ty * TILE_SIZE + 8);
      } else {
        // Just bump — check for enemies above
        audioManager.playStomp();
        this.checkBumpKill(tx, ty);
      }
    }
  }

  spawnBrickDebris(x: number, y: number) {
    // 4 pieces of debris
    const speeds = [
      { vx: -1.5, vy: -4 },
      { vx: 1.5, vy: -4 },
      { vx: -1, vy: -3 },
      { vx: 1, vy: -3 },
    ];
    speeds.forEach(s => {
      this.particles.push(new Particle(EntityType.BrickDebris, x, y, s.vx, s.vy, 60));
    });
  }

  checkBumpKill(tx: number, ty: number) {
    // Kill enemies standing on this block
    this.enemies.forEach(e => {
      if (e.dead || !e.active) return;
      const ex = Math.floor((e.x + e.width / 2) / TILE_SIZE);
      const ey = Math.floor((e.y + e.height) / TILE_SIZE);
      if (ex === tx && ey === ty) {
        this.killEnemy(e, true);
      }
    });
  }

  updateBlocks() {
    // Update bump animations
    this.blockData.forEach(data => {
      if (data.bumpTimer > 0) {
        data.bumpTimer--;
        // Parabolic bump
        const t = data.bumpTimer / BLOCK_BUMP_FRAMES;
        data.bumpOffset = Math.sin(t * Math.PI) * BLOCK_BUMP_HEIGHT;
      } else {
        data.bumpOffset = 0;
      }
    });
  }

  // ===========================================================================
  // ENEMY UPDATE
  // ===========================================================================

  updateEnemies() {
    this.enemies.forEach(e => {
      if (e.dead && e.state !== EnemyState.Squished) return;

      // Activation — spawn when near camera
      if (!e.active) {
        if (e.x < this.cameraX + SCREEN_WIDTH + 32 && e.x > this.cameraX - 32) {
          e.active = true;
        } else {
          return;
        }
      }

      // Deactivate if off-screen left or fell in pit
      if (e.x < this.cameraX - 32 || e.y > SCREEN_HEIGHT + 32) {
        e.dead = true;
        return;
      }

      // State-based update
      switch (e.state) {
        case EnemyState.Walking:
          this.updateEnemyWalking(e);
          break;
        case EnemyState.Squished:
          e.stateTimer--;
          if (e.stateTimer <= 0) {
            e.dead = true;
          }
          break;
        case EnemyState.Shell:
          e.stateTimer++;
          if (e.stateTimer >= SHELL_WAKE_FRAMES) {
            e.state = EnemyState.Emerging;
            e.stateTimer = 0;
          }
          break;
        case EnemyState.ShellMoving:
          this.updateShellMoving(e);
          break;
      }

      // Collision with player (if not already dead/squished)
      if (e.state !== EnemyState.Squished && !e.dead) {
        if (this.checkCollision(this.player, e)) {
          this.resolvePlayerEnemyCollision(e);
        }
      }
    });

    // Remove dead enemies
    this.enemies = this.enemies.filter(e => !e.dead || e.state === EnemyState.Squished);
  }

  updateEnemyWalking(e: Enemy) {
    // Apply gravity
    e.vy += GRAVITY_FALLING;
    if (e.vy > MAX_FALL_SPEED) e.vy = MAX_FALL_SPEED;

    // Move X — FIXED: store direction before collision
    const moveDir = e.vx > 0 ? 1 : -1;
    e.x += e.vx;
    
    // Collision X
    const left = Math.floor(e.x / TILE_SIZE);
    const right = Math.floor((e.x + e.width - 1) / TILE_SIZE);
    const top = Math.floor(e.y / TILE_SIZE);
    const bottom = Math.floor((e.y + e.height - 1) / TILE_SIZE);

    for (let ty = top; ty <= bottom; ty++) {
      for (let tx = left; tx <= right; tx++) {
        if (this.isSolidTile(tx, ty)) {
          if (moveDir > 0) {
            e.x = tx * TILE_SIZE - e.width;
          } else {
            e.x = (tx + 1) * TILE_SIZE;
          }
          // FIXED: Reverse direction by flipping sign of speed constant
          const speed = e.type === EntityType.KoopaTroopa ? KOOPA_SPEED : GOOMBA_SPEED;
          e.vx = moveDir > 0 ? -speed : speed;
          e.dir = e.vx < 0 ? Direction.Left : Direction.Right;
          break;
        }
      }
    }

    // Move Y
    e.y += e.vy;
    e.grounded = false;

    // Collision Y
    const bottom2 = Math.floor((e.y + e.height - 1) / TILE_SIZE);
    const left2 = Math.floor(e.x / TILE_SIZE);
    const right2 = Math.floor((e.x + e.width - 1) / TILE_SIZE);

    for (let tx = left2; tx <= right2; tx++) {
      if (this.isSolidTile(tx, bottom2)) {
        e.y = bottom2 * TILE_SIZE - e.height;
        e.vy = 0;
        e.grounded = true;
        break;
      }
    }
  }

  updateShellMoving(e: Enemy) {
    // Shell slides fast
    e.x += e.vx;

    // Collision with walls
    const left = Math.floor(e.x / TILE_SIZE);
    const right = Math.floor((e.x + e.width - 1) / TILE_SIZE);
    const top = Math.floor(e.y / TILE_SIZE);
    const bottom = Math.floor((e.y + e.height - 1) / TILE_SIZE);

    for (let ty = top; ty <= bottom; ty++) {
      for (let tx = left; tx <= right; tx++) {
        if (this.isSolidTile(tx, ty)) {
          // Reverse direction
          e.vx = -e.vx;
          e.dir = e.vx < 0 ? Direction.Left : Direction.Right;
          if (e.vx > 0) {
            e.x = (tx + 1) * TILE_SIZE;
          } else {
            e.x = tx * TILE_SIZE - e.width;
          }
          break;
        }
      }
    }

    // Gravity
    e.vy += GRAVITY_FALLING;
    if (e.vy > MAX_FALL_SPEED) e.vy = MAX_FALL_SPEED;
    e.y += e.vy;

    // Ground collision
    const bottom2 = Math.floor((e.y + e.height - 1) / TILE_SIZE);
    for (let tx = left; tx <= right; tx++) {
      if (this.isSolidTile(tx, bottom2)) {
        e.y = bottom2 * TILE_SIZE - e.height;
        e.vy = 0;
        break;
      }
    }

    // Shell kills other enemies
    this.enemies.forEach(other => {
      if (other === e || other.dead) return;
      if (other.state === EnemyState.Squished) return;
      if (this.checkCollision(e, other)) {
        this.killEnemy(other, true);
        this.addChainScore();
      }
    });
  }

  resolvePlayerEnemyCollision(e: Enemy) {
    const p = this.player;
    if (p.dead) return;

    // Star power — instant kill
    if (p.starTimer > 0) {
      this.killEnemy(e, true);
      this.addChainScore();
      return;
    }

    // Check for stomp — NES requires player moving DOWN and feet near enemy head
    const playerBottom = p.y + p.height;
    const enemyTop = e.y;
    const stompMargin = 8;

    if (p.vy > 0 && playerBottom <= enemyTop + stompMargin) {
      // STOMP
      if (e.type === EntityType.Goomba) {
        e.state = EnemyState.Squished;
        e.stateTimer = GOOMBA_SQUISH_FRAMES;
        e.height = 8;  // Squished
      } else if (e.type === EntityType.KoopaTroopa) {
        // Becomes shell
        if (e.state === EnemyState.Walking) {
          e.state = EnemyState.Shell;
          e.stateTimer = 0;
          e.vx = 0;
          e.height = 16;
        }
      } else if (e.type === EntityType.KoopaShell || e.state === EnemyState.Shell) {
        // Kick shell
        e.state = EnemyState.ShellMoving;
        e.vx = p.x < e.x ? SHELL_SPEED : -SHELL_SPEED;
        e.dir = e.vx < 0 ? Direction.Left : Direction.Right;
      }

      // Bounce — NES: higher if holding A
      const input = this.input.poll();
      p.vy = input.jump ? STOMP_BOUNCE_HIGH : STOMP_BOUNCE_LOW;
      p.isJumping = true;
      p.jumpHeld = input.jump;

      this.addChainScore();
      audioManager.playStomp();
    } else {
      // DAMAGE
      if (p.iframeTimer > 0) return;

      if (e.state === EnemyState.Shell && e.vx === 0) {
        // Kick stationary shell instead of taking damage
        e.state = EnemyState.ShellMoving;
        e.vx = p.dir === Direction.Right ? SHELL_SPEED : -SHELL_SPEED;
        e.dir = e.vx < 0 ? Direction.Left : Direction.Right;
        return;
      }

      this.damagePlayer();
    }
  }

  killEnemy(e: Enemy, fromAbove: boolean) {
    if (e.type === EntityType.Goomba) {
      if (fromAbove) {
        e.state = EnemyState.Squished;
        e.stateTimer = GOOMBA_SQUISH_FRAMES;
        e.height = 8;
      } else {
        // Killed by shell — flip upside down and fall
        e.dead = true;
        e.vy = -3;
      }
    } else if (e.type === EntityType.KoopaTroopa) {
      e.dead = true;
      e.vy = -3;
    }
    audioManager.playStomp();
  }

  addChainScore() {
    const scoreIndex = Math.min(this.chainKillCount, CHAIN_SCORES.length - 1);
    const points = CHAIN_SCORES[scoreIndex];
    
    if (this.chainKillCount >= CHAIN_SCORES.length) {
      // 1-UP after max chain
      this.lives++;
      audioManager.playPowerUp();
    } else {
      this.score += points;
    }
    
    this.chainKillCount++;
  }

  damagePlayer() {
    const p = this.player;
    
    if (p.isBig) {
      // Shrink to small
      p.state = PlayerState.Small;
      p.updateHitbox();
      p.iframeTimer = DAMAGE_IFRAMES;
      audioManager.playStomp();  // Pipe sound in NES
    } else {
      // Die
      this.killPlayer();
    }
  }

  killPlayer() {
    this.player.dead = true;
    this.player.vy = -5;  // Death jump
    this.deathTimer = DEATH_JUMP_FRAMES + 120;
    this.gameState = GameState.Dying;
    audioManager.playDie();
  }

  updateDying() {
    const p = this.player;
    
    if (this.deathTimer > 120) {
      // Death jump up phase
      p.vy += GRAVITY_FALLING;
    } else {
      // Falling phase
      p.vy += GRAVITY_FALLING;
    }
    p.y += p.vy;

    this.deathTimer--;
    if (this.deathTimer <= 0) {
      this.lives--;
      if (this.lives <= 0) {
        this.gameState = GameState.GameOver;
      } else {
        this.reset();
        this.gameState = GameState.Playing;
      }
    }
  }

  // ===========================================================================
  // POWER-UPS
  // ===========================================================================

  updatePowerUps() {
    this.powerUps.forEach(pu => {
      if (pu.dead) return;

      // Emerge from block
      if (!pu.emerged) {
        pu.y -= 1;
        if (pu.y <= pu.emergeY) {
          pu.y = pu.emergeY;
          pu.emerged = true;
          pu.active = true;
          pu.vx = MUSHROOM_SPEED;
        }
        return;
      }

      // Movement
      if (pu.type === EntityType.Mushroom) {
        // Gravity
        pu.vy += GRAVITY_FALLING;
        if (pu.vy > MAX_FALL_SPEED) pu.vy = MAX_FALL_SPEED;

        // Move X
        pu.x += pu.vx;
        
        // Wall collision
        const tx = pu.vx > 0 
          ? Math.floor((pu.x + pu.width) / TILE_SIZE)
          : Math.floor(pu.x / TILE_SIZE);
        const ty = Math.floor((pu.y + pu.height / 2) / TILE_SIZE);
        
        if (this.isSolidTile(tx, ty)) {
          pu.vx = -pu.vx;
          pu.x += pu.vx * 2;
        }

        // Move Y
        pu.y += pu.vy;
        
        // Ground collision
        const bottom = Math.floor((pu.y + pu.height) / TILE_SIZE);
        const left = Math.floor(pu.x / TILE_SIZE);
        const right = Math.floor((pu.x + pu.width - 1) / TILE_SIZE);
        
        for (let x = left; x <= right; x++) {
          if (this.isSolidTile(x, bottom)) {
            pu.y = bottom * TILE_SIZE - pu.height;
            pu.vy = 0;
            break;
          }
        }
      }

      // Collect
      if (this.checkCollision(this.player, pu)) {
        this.collectPowerUp(pu);
      }

      // Off screen
      if (pu.y > SCREEN_HEIGHT + 16 || pu.x < this.cameraX - 32) {
        pu.dead = true;
      }
    });

    this.powerUps = this.powerUps.filter(pu => !pu.dead);
  }

  collectPowerUp(pu: PowerUp) {
    pu.dead = true;
    const p = this.player;

    if (pu.type === EntityType.Mushroom) {
      if (p.state === PlayerState.Small) {
        p.state = PlayerState.Big;
        p.updateHitbox();
        // NES: Mario's position adjusts when growing
        p.y -= 16;
      }
      this.score += 1000;
      audioManager.playPowerUp();
    } else if (pu.type === EntityType.FireFlower) {
      p.state = PlayerState.Fire;
      p.updateHitbox();
      this.score += 1000;
      audioManager.playPowerUp();
    }
  }

  // ===========================================================================
  // PARTICLES
  // ===========================================================================

  updateParticles() {
    this.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += GRAVITY_FALLING;
      p.life--;
    });
    this.particles = this.particles.filter(p => p.life > 0);
  }

  // ===========================================================================
  // FLAGPOLE
  // ===========================================================================

  grabFlagpole(tx: number) {
    const p = this.player;
    p.onFlagpole = true;
    p.x = tx * TILE_SIZE - p.width;
    p.vx = 0;
    p.vy = 0;
    p.flagY = p.y;
    
    // Calculate score based on height
    const height = SCREEN_HEIGHT - p.y;
    let scoreIndex = Math.floor(height / 40);
    scoreIndex = Math.min(scoreIndex, FLAG_SCORES.length - 1);
    this.flagScore = FLAG_SCORES[scoreIndex];
    this.score += this.flagScore;
    
    this.gameState = GameState.LevelClear;
    this.levelClearPhase = 0;
    audioManager.playCoin();  // Flag sound
  }

  updateLevelClear() {
    const p = this.player;
    
    if (this.levelClearPhase === 0) {
      // Slide down flagpole
      p.y += FLAG_SLIDE_SPEED;
      const groundY = (this.level.tiles.length - 2) * TILE_SIZE - p.height;
      if (p.y >= groundY) {
        p.y = groundY;
        this.levelClearPhase = 1;
        p.dir = Direction.Right;
      }
    } else if (this.levelClearPhase === 1) {
      // Walk to castle
      p.x += LEVEL_CLEAR_WALK_SPEED;
      p.animTimer++;
      if (p.animTimer >= 8) {
        p.animTimer = 0;
        p.animFrame = (p.animFrame + 1) % 3;
      }
      
      // Check if reached end of level
      if (p.x > this.level.width - 80) {
        this.levelClearPhase = 2;
      }
    } else if (this.levelClearPhase === 2) {
      // Timer bonus
      if (this.timeLeft > 0) {
        this.timeLeft--;
        this.score += 50;  // NES gives 50 per timer tick
      } else {
        // Done — would load next level
        // For demo, just reset
        setTimeout(() => this.fullReset(), 2000);
        this.levelClearPhase = 3;
      }
    }
  }

  // ===========================================================================
  // CAMERA
  // ===========================================================================

  updateCamera() {
    // NES camera: follows Mario with dead zone, never scrolls back
    const targetX = this.player.x - 100;
    
    if (targetX > this.cameraX) {
      this.cameraX = targetX;
    }
    
    // Clamp to level bounds
    const maxCam = this.level.width - SCREEN_WIDTH;
    if (this.cameraX > maxCam) this.cameraX = maxCam;
    if (this.cameraX < 0) this.cameraX = 0;
  }

  // ===========================================================================
  // UTILITY
  // ===========================================================================

  getTile(tx: number, ty: number): number {
    if (ty < 0 || ty >= this.level.tiles.length) return TileType.Air;
    if (tx < 0 || tx >= this.level.tiles[0].length) return TileType.Air;
    return this.level.tiles[ty][tx];
  }

  isSolidTile(tx: number, ty: number): boolean {
    const tile = this.getTile(tx, ty);
    return tile !== TileType.Air && 
           tile !== TileType.FlagPole && 
           tile !== TileType.FlagTop;
  }

  checkCollision(a: Entity, b: Entity): boolean {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  // ===========================================================================
  // RENDERING
  // ===========================================================================

  draw() {
    // Clear with sky color
    this.ctx.fillStyle = COLOR_SKY;
    this.ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    if (this.gameState === GameState.Title) {
      this.drawTitle();
      return;
    }

    if (this.gameState === GameState.GameOver) {
      this.drawGameOver();
      return;
    }

    // World rendering
    this.ctx.save();
    this.ctx.translate(-Math.floor(this.cameraX), 0);

    this.drawTiles();
    this.drawPowerUps();
    this.drawEnemies();
    this.drawPlayer();
    this.drawParticles();

    this.ctx.restore();

    this.drawHUD();
  }

  drawTitle() {
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = 'bold 16px monospace';
    this.ctx.fillText('SUPER MARIO BROS.', 50, 80);
    this.ctx.font = '8px monospace';
    this.ctx.fillText('©1985 NINTENDO', 80, 100);
    this.ctx.fillText('1 PLAYER GAME', 90, 140);
    this.ctx.fillText('PRESS ENTER', 95, 180);
  }

  drawGameOver() {
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = 'bold 16px monospace';
    this.ctx.fillText('GAME OVER', 85, 120);
  }

  drawTiles() {
    const startCol = Math.floor(this.cameraX / TILE_SIZE);
    const endCol = startCol + Math.ceil(SCREEN_WIDTH / TILE_SIZE) + 1;

    for (let y = 0; y < this.level.tiles.length; y++) {
      for (let x = startCol; x <= endCol; x++) {
        if (x >= this.level.tiles[0].length) continue;
        const tile = this.level.tiles[y][x];
        if (tile !== TileType.Air) {
          this.drawTile(x, y, tile);
        }
      }
    }
  }

  drawTile(gx: number, gy: number, type: number) {
    const x = gx * TILE_SIZE;
    let y = gy * TILE_SIZE;

    // Check for bump offset
    const key = `${gx},${gy}`;
    const blockData = this.blockData.get(key);
    if (blockData) {
      y -= blockData.bumpOffset;
    }

    switch (type) {
      case TileType.Ground:
        this.ctx.fillStyle = COLOR_GROUND;
        this.ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        // Brick pattern
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x + 0.5, y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
        break;

      case TileType.Brick:
        this.ctx.fillStyle = COLOR_BRICK;
        this.ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y + 8);
        this.ctx.lineTo(x + TILE_SIZE, y + 8);
        this.ctx.moveTo(x + 8, y);
        this.ctx.lineTo(x + 8, y + 8);
        this.ctx.moveTo(x + 4, y + 8);
        this.ctx.lineTo(x + 4, y + TILE_SIZE);
        this.ctx.moveTo(x + 12, y + 8);
        this.ctx.lineTo(x + 12, y + TILE_SIZE);
        this.ctx.stroke();
        break;

      case TileType.QuestionBlock:
        this.ctx.fillStyle = COLOR_QUESTION;
        this.ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        this.ctx.strokeStyle = '#000';
        this.ctx.strokeRect(x + 0.5, y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
        this.ctx.fillStyle = '#000';
        this.ctx.font = 'bold 10px monospace';
        this.ctx.fillText('?', x + 4, y + 12);
        break;

      case TileType.UsedBlock:
        this.ctx.fillStyle = COLOR_USED;
        this.ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        this.ctx.strokeStyle = '#000';
        this.ctx.strokeRect(x + 0.5, y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
        break;

      case TileType.PipeLeft:
      case TileType.PipeRight:
      case TileType.PipeTopLeft:
      case TileType.PipeTopRight:
        this.ctx.fillStyle = COLOR_PIPE;
        this.ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        this.ctx.strokeStyle = COLOR_PIPE_DARK;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
        if (type === TileType.PipeTopLeft || type === TileType.PipeTopRight) {
          this.ctx.fillStyle = COLOR_PIPE_DARK;
          this.ctx.fillRect(x, y, TILE_SIZE, 4);
        }
        break;

      case TileType.FlagPole:
        this.ctx.fillStyle = '#00a800';
        this.ctx.fillRect(x + 6, y, 4, TILE_SIZE);
        break;

      case TileType.FlagTop:
        this.ctx.fillStyle = '#00a800';
        this.ctx.fillRect(x + 6, y + 8, 4, 8);
        // Flag
        this.ctx.fillStyle = '#00a800';
        this.ctx.beginPath();
        this.ctx.moveTo(x + 10, y + 4);
        this.ctx.lineTo(x + 10, y + 12);
        this.ctx.lineTo(x + 2, y + 8);
        this.ctx.fill();
        break;
    }
  }

  drawPlayer() {
    const p = this.player;
    
    // Flicker during invincibility
    if (p.iframeTimer > 0 && Math.floor(this.frameCount / 4) % 2 === 0) {
      return;
    }

    const x = Math.floor(p.x);
    const y = Math.floor(p.y);

    // Simple colored rectangle (NES-style placeholder)
    this.ctx.fillStyle = p.starTimer > 0 
      ? (this.frameCount % 8 < 4 ? '#FFFFFF' : COLOR_MARIO)
      : COLOR_MARIO;
    this.ctx.fillRect(x, y, p.width, p.height);

    // Face direction indicator
    if (!p.dead) {
      this.ctx.fillStyle = '#FFF';
      const eyeX = p.dir === Direction.Right ? x + 8 : x + 2;
      this.ctx.fillRect(eyeX, y + 4, 2, 4);
    }
  }

  drawEnemies() {
    this.enemies.forEach(e => {
      if (!e.active) return;

      const x = Math.floor(e.x);
      const y = Math.floor(e.y);

      if (e.type === EntityType.Goomba) {
        this.ctx.fillStyle = COLOR_GOOMBA;
        if (e.state === EnemyState.Squished) {
          this.ctx.fillRect(x, y + 8, e.width, 8);
        } else {
          this.ctx.fillRect(x, y, e.width, e.height);
          // Eyes
          this.ctx.fillStyle = '#FFF';
          this.ctx.fillRect(x + 3, y + 4, 3, 4);
          this.ctx.fillRect(x + 10, y + 4, 3, 4);
        }
      } else if (e.type === EntityType.KoopaTroopa) {
        this.ctx.fillStyle = COLOR_KOOPA_GREEN;
        if (e.state === EnemyState.Shell || e.state === EnemyState.ShellMoving) {
          this.ctx.fillRect(x, y + 8, 16, 16);
        } else {
          this.ctx.fillRect(x, y, e.width, e.height);
          // Head
          this.ctx.fillStyle = '#ffcc00';
          this.ctx.fillRect(x + 4, y, 8, 8);
        }
      }
    });
  }

  drawPowerUps() {
    this.powerUps.forEach(pu => {
      if (pu.dead) return;

      const x = Math.floor(pu.x);
      const y = Math.floor(pu.y);

      if (pu.type === EntityType.Mushroom) {
        // Red mushroom
        this.ctx.fillStyle = '#ff0000';
        this.ctx.fillRect(x + 2, y, 12, 8);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(x + 4, y + 2, 3, 4);
        this.ctx.fillRect(x + 9, y + 2, 3, 4);
        this.ctx.fillStyle = '#f0d0a0';
        this.ctx.fillRect(x + 4, y + 8, 8, 8);
      } else if (pu.type === EntityType.FireFlower) {
        // Flower
        this.ctx.fillStyle = '#ff6600';
        this.ctx.fillRect(x + 4, y, 8, 8);
        this.ctx.fillStyle = '#00aa00';
        this.ctx.fillRect(x + 6, y + 8, 4, 8);
      }
    });
  }

  drawParticles() {
    this.particles.forEach(p => {
      const x = Math.floor(p.x);
      const y = Math.floor(p.y);

      if (p.type === EntityType.Coin) {
        this.ctx.fillStyle = '#ffcc00';
        this.ctx.fillRect(x, y, 8, 8);
      } else if (p.type === EntityType.BrickDebris) {
        this.ctx.fillStyle = COLOR_BRICK;
        this.ctx.fillRect(x, y, 8, 8);
      }
    });
  }

  drawHUD() {
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = '8px monospace';

    // MARIO
    this.ctx.fillText('MARIO', 24, 16);
    this.ctx.fillText(this.score.toString().padStart(6, '0'), 24, 26);

    // COINS
    this.ctx.fillText(`x${this.coins.toString().padStart(2, '0')}`, 100, 26);

    // WORLD
    this.ctx.fillText('WORLD', 145, 16);
    this.ctx.fillText(this.world, 152, 26);

    // TIME
    this.ctx.fillText('TIME', 200, 16);
    this.ctx.fillText(Math.floor(this.timeLeft).toString().padStart(3, '0'), 205, 26);

    // LIVES (on title)
    if (this.gameState === GameState.Title || this.gameState === GameState.GameOver) {
      this.ctx.fillText(`x ${this.lives}`, 120, 160);
    }
  }

  destroy() {
    this.input.destroy();
  }
}
