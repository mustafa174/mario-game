import {
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  TILE_SIZE,
  GRAVITY,
  MAX_FALL_SPEED,
  ACCEL_WALK,
  ACCEL_RUN,
  DECEL_WALK,
  DECEL_RUN,
  FRICTION_GROUND,
  FRICTION_AIR,
  MAX_SPEED_WALK,
  MAX_SPEED_RUN,
  JUMP_FORCE,
  JUMP_HOLD_FORCE,
  MAX_JUMP_HOLD_FRAMES,
  BOUNCE_FORCE,
  GOOMBA_SPEED,
  KOOPA_SPEED,
  SHELL_SPEED,
  MUSHROOM_SPEED,
  STAR_SPEED,
  TIMER_DECREMENT_INTERVAL,
  SCORE_GOOMBA,
  SCORE_KOOPA,
  SCORE_SHELL_KILL,
  SCORE_COIN,
  SCORE_BRICK_BREAK,
  SCORE_FLAGPOLE_BASE,
  SCORE_FLAGPOLE_MULTIPLIER,
  CHAIN_SCORES,
  STAR_DURATION,
  POWERUP_SPAWN_DELAY,
  COLOR_SKY,
  COLOR_GROUND,
  COLOR_BRICK,
  COLOR_QUESTION,
  COLOR_PIPE,
  COLOR_PIPE_DARK,
} from '../constants';
import {
  GameState,
  EntityType,
  TileType,
  Box,
  Direction,
  InputState,
} from '../types';
import { InputManager } from './input';
import { audioManager } from './audio';
import { getLevelData } from './level';

class Entity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  type: EntityType;
  dead: boolean = false;
  grounded: boolean = false;
  dir: Direction = Direction.Left;

  constructor(type: EntityType, x: number, y: number, w: number, h: number) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.width = w;
    this.height = h;
    this.vx = 0;
    this.vy = 0;
  }
}

class Enemy extends Entity {
  active: boolean = false;
  state: 'walk' | 'shell' | 'shell_slide' = 'walk';
  shellTimer: number = 0;
  kickTimer: number = 0; // Timer before shell can be kicked again
  spawnX: number = 0; // Original spawn position

  constructor(type: EntityType, x: number, y: number) {
    super(type, x, y, 16, 16);
    this.vx = -GOOMBA_SPEED;
    this.spawnX = x;
  }
}

class PowerUp extends Entity {
  active: boolean = false;
  spawnTimer: number = 0;
  type: EntityType.Mushroom | EntityType.FireFlower | EntityType.Star;

  constructor(type: EntityType.Mushroom | EntityType.FireFlower | EntityType.Star, x: number, y: number) {
    super(type, x, y, 16, 16);
    this.type = type;
    this.vy = -2.0; // Initial upward velocity for mushroom/flower
    if (type === EntityType.Mushroom) {
      this.vx = MUSHROOM_SPEED; // Moves right initially
    } else if (type === EntityType.Star) {
      this.vx = STAR_SPEED;
    }
  }
}

class Player extends Entity {
  jumpFrames: number = 0;
  isJumping: boolean = false;
  jumpReleased: boolean = true; // Prevents bunny hopping
  isBig: boolean = false;
  hasFire: boolean = false;
  starTimer: number = 0; // Invincibility timer
  iframeTimer: number = 0; // Damage invincibility
  deathTimer: number = 0; // Death animation timer
  lives: number = 3;

  constructor() {
    super(EntityType.Player, 50, 100, 14, 14); // NES collision box size (small Mario)
  }

  getActualHeight(): number {
    return this.isBig ? 28 : 14; // Big Mario is 2 tiles tall
  }
}

class Particle extends Entity {
  life: number = 60;
  constructor(x: number, y: number, vx: number, vy: number) {
    super(EntityType.Particle, x, y, 4, 4);
    this.vx = vx;
    this.vy = vy;
  }
}

export class GameEngine {
  ctx: CanvasRenderingContext2D;
  input: InputManager;
  state: GameState = GameState.Title;
  
  player: Player;
  enemies: Enemy[] = [];
  powerUps: PowerUp[] = [];
  particles: Particle[] = [];
  
  level: { tiles: number[][]; width: number; height: number };
  cameraX: number = 0;
  
  timeLeft: number = 400;
  timerFrameCounter: number = 0; // Frame counter for timer decrement
  score: number = 0;
  coins: number = 0;
  world: string = '1-1';
  
  // Flagpole/end level state
  flagpoleGrabbed: boolean = false;
  flagpoleScore: number = 0;
  flagpoleTimer: number = 0;
  endLevelState: 'none' | 'sliding' | 'walking' | 'complete' = 'none';
  
  // Chain kill tracking
  lastKillTime: number = 0;
  chainKillCount: number = 0;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.input = new InputManager();
    this.player = new Player();
    // Initialize with empty data, reset() will load the actual level
    this.level = { tiles: [], width: 0, height: 0 };
    this.reset();
  }

  reset() {
    // Reload Level Data to reset bricks/enemies
    const data = getLevelData();
    this.level = {
        tiles: data.tiles,
        width: data.width,
        height: data.height
    };

    // Reset Entities
    this.enemies = [];
    data.entities.forEach(e => {
        if (e.type === 'goomba') {
            this.enemies.push(new Enemy(EntityType.Goomba, e.x, e.y));
        } else if (e.type === 'koopa') {
            const k = new Enemy(EntityType.Koopa, e.x, e.y);
            k.height = 24; // Taller
            k.y -= 8;
            this.enemies.push(k);
        }
    });
    
    this.particles = [];
    this.powerUps = [];

    // Reset Player
    this.player.x = 40;
    this.player.y = 192; 
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.dead = false;
    this.player.isBig = false;
    this.player.hasFire = false;
    this.player.isJumping = false;
    this.player.jumpReleased = true;
    this.player.jumpFrames = 0;
    this.player.dir = Direction.Right;
    this.player.starTimer = 0;
    this.player.iframeTimer = 0;
    this.player.deathTimer = 0;

    this.cameraX = 0;
    this.state = GameState.Title;
    this.timeLeft = 400;
    this.timerFrameCounter = 0;
    this.score = 0;
    this.coins = 0;
    this.flagpoleGrabbed = false;
    this.flagpoleScore = 0;
    this.flagpoleTimer = 0;
    this.endLevelState = 'none';
    this.lastKillTime = 0;
    this.chainKillCount = 0;
  }

  update() {
    const input = this.input.poll();

    if (this.state === GameState.Title) {
      if (input.start || input.jump) {
        this.state = GameState.Playing;
        audioManager.init(); // Ensure audio context starts on user interaction
      }
      return;
    }

    if (this.state === GameState.Playing) {
        this.updatePlayer(input);
        this.updateEnemies();
        this.updatePowerUps();
        this.updateParticles();
        this.updateCamera();
        
        // NES Timer: Decrements every 21 frames (1 second = 21 frames on NES)
        this.timerFrameCounter++;
        if (this.timerFrameCounter >= TIMER_DECREMENT_INTERVAL) {
            this.timerFrameCounter = 0;
            if (this.timeLeft > 0) {
                this.timeLeft--;
            }
            if (this.timeLeft <= 0) {
                this.killPlayer();
            }
        }
        
        // Check pit death (below screen)
        if (this.player.y > SCREEN_HEIGHT + 16) {
            this.killPlayer();
        }
    } else if (this.state === GameState.LevelClear) {
        this.updateEndLevel();
    } else if (this.state === GameState.GameOver) {
        this.updateGameOver();
    }
  }

  updatePlayer(input: InputState) {
    if (this.player.dead) {
      // Death animation
      this.player.deathTimer++;
      if (this.player.deathTimer < 60) {
        // Mario bounces up then falls
        if (this.player.deathTimer === 1) {
          this.player.vy = -4.0; // Initial bounce
        }
        this.player.vy += GRAVITY;
        this.player.y += this.player.vy;
      } else if (this.player.deathTimer >= 120) {
        // Reset after death animation
        this.reset();
        this.state = GameState.Playing;
      }
      return;
    }

    // Star invincibility timer
    if (this.player.starTimer > 0) {
      this.player.starTimer--;
      if (this.player.starTimer === 0) {
        // Star effect ends
      }
    }

    // Damage invincibility (blinking)
    if (this.player.iframeTimer > 0) {
      this.player.iframeTimer--;
    }

    // Horizontal Movement - NES-accurate acceleration/deceleration
    const maxSpeed = input.run ? MAX_SPEED_RUN : MAX_SPEED_WALK;
    const accel = input.run ? ACCEL_RUN : ACCEL_WALK;
    const decel = input.run ? DECEL_RUN : DECEL_WALK;

    if (input.left) {
        // NES: If moving opposite direction, decelerate faster (skid)
        if (this.player.vx > 0) {
            this.player.vx -= decel * 2;
            if (this.player.vx < 0) this.player.vx = 0;
        } else {
            this.player.vx -= accel;
        }
        this.player.dir = Direction.Left;
    } else if (input.right) {
        if (this.player.vx < 0) {
            this.player.vx += decel * 2;
            if (this.player.vx > 0) this.player.vx = 0;
        } else {
            this.player.vx += accel;
        }
        this.player.dir = Direction.Right;
    } else {
        // NES: Decelerate when not pressing direction
        if (this.player.vx > 0) {
            this.player.vx -= decel;
            if (this.player.vx < 0) this.player.vx = 0;
        } else if (this.player.vx < 0) {
            this.player.vx += decel;
            if (this.player.vx > 0) this.player.vx = 0;
        }
    }

    // Cap speed
    if (this.player.vx > maxSpeed) this.player.vx = maxSpeed;
    if (this.player.vx < -maxSpeed) this.player.vx = -maxSpeed;

    // Mid-air control (NES allows limited air control)
    if (!this.player.grounded && (input.left || input.right)) {
        const airAccel = accel * 0.5; // Reduced air acceleration
        if (input.left && this.player.vx > -maxSpeed) {
            this.player.vx -= airAccel;
        } else if (input.right && this.player.vx < maxSpeed) {
            this.player.vx += airAccel;
        }
    }

    // Reset jump release
    if (!input.jump) {
        this.player.jumpReleased = true;
        this.player.jumpFrames = MAX_JUMP_HOLD_FRAMES; // Stop adding force
    }

    // Jumping - NES variable jump height
    if (input.jump && this.player.jumpReleased && this.player.grounded) {
        this.player.isJumping = true;
        this.player.grounded = false;
        this.player.jumpReleased = false;
        this.player.vy = JUMP_FORCE; // Negative value = up
        this.player.jumpFrames = 0;
        audioManager.playJump();
    }

    // Variable jump height: holding A adds upward force for limited frames
    if (input.jump && this.player.isJumping && this.player.jumpFrames < MAX_JUMP_HOLD_FRAMES) {
        this.player.vy += JUMP_HOLD_FORCE; // Negative value = upward
        this.player.jumpFrames++;
    } else if (!input.jump) {
        // Stop applying jump force when button released
        this.player.jumpFrames = MAX_JUMP_HOLD_FRAMES;
    }

    // Gravity
    this.player.vy += GRAVITY;
    if (this.player.vy > MAX_FALL_SPEED) this.player.vy = MAX_FALL_SPEED;

    // Apply Velocity X (axis-separated collision)
    this.player.x += this.player.vx;
    this.checkTileCollision(this.player, true);

    // Apply Velocity Y
    this.player.y += this.player.vy;
    this.player.grounded = false; // Assume falling until collision says otherwise
    this.checkTileCollision(this.player, false);

    // Constrain to Camera (NES: can't go backward)
    if (this.player.x < this.cameraX) {
        this.player.x = this.cameraX;
        this.player.vx = 0;
    }
  }

  updateEnemies() {
    this.enemies.forEach(e => {
        if (e.dead) return;

        // Activation (NES: enemies activate when Mario gets close)
        if (!e.active) {
            if (e.x < this.cameraX + SCREEN_WIDTH + SPAWN_ZONE && e.x > this.cameraX - SPAWN_ZONE) {
                e.active = true;
            } else {
                return;
            }
        } else {
            // Deactivate if too far behind camera
            if (e.x < this.cameraX - 64 || e.y > SCREEN_HEIGHT + 32) {
                e.active = false;
                return;
            }
        }

        // Shell mechanics
        if (e.state === 'shell') {
            e.shellTimer++;
            // Shell can be kicked again after timer expires
            if (e.shellTimer > 0 && e.vx === 0) {
                e.kickTimer++;
                if (e.kickTimer > 120) { // 2 seconds
                    e.state = 'walk';
                    e.kickTimer = 0;
                    e.shellTimer = 0;
                    // Koopa emerges from shell
                    if (e.type === EntityType.Koopa) {
                        e.vx = -KOOPA_SPEED;
                    }
                }
            }
        }

        // Gravity
        e.vy += GRAVITY;
        if (e.vy > MAX_FALL_SPEED) e.vy = MAX_FALL_SPEED;

        // Move X
        e.x += e.vx;
        this.checkTileCollision(e, true);

        // Move Y
        e.y += e.vy;
        e.grounded = false;
        this.checkTileCollision(e, false);

        // NES: Goombas walk off ledges, Koopas turn around
        if (e.state === 'walk' && e.grounded) {
            if (e.type === EntityType.Koopa) {
                // Check if about to walk off ledge
                const checkX = e.vx > 0 ? e.x + e.width : e.x - 1;
                const checkY = e.y + e.height;
                const tileX = Math.floor(checkX / TILE_SIZE);
                const tileY = Math.floor(checkY / TILE_SIZE);
                
                if (tileY >= this.level.tiles.length || 
                    tileX < 0 || tileX >= this.level.tiles[0].length ||
                    this.level.tiles[tileY][tileX] === TileType.Air) {
                    // About to fall off, turn around
                    e.vx = -e.vx;
                }
            }
        }
        
        // Enemy-enemy collisions (shell kills other enemies)
        if (e.state === 'shell_slide' && e.vx !== 0) {
            this.enemies.forEach(other => {
                if (other !== e && !other.dead && other.active && 
                    other.state === 'walk' && this.checkEntityCollision(e, other)) {
                    this.killEnemy(other, true);
                    // Chain kill scoring
                    this.addChainKillScore();
                }
            });
        }
        
        // Interactions with Player
        if (!this.player.dead && this.checkEntityCollision(this.player, e)) {
            this.resolvePlayerEnemyCollision(e);
        }
    });
  }

  resolvePlayerEnemyCollision(e: Enemy) {
      if (this.player.dead || this.player.iframeTimer > 0) return;

      // Star invincibility: kill enemy on contact
      if (this.player.starTimer > 0) {
          this.killEnemy(e, false);
          this.addChainKillScore();
          return;
      }

      // Shell sliding: kick or stop it
      if (e.state === 'shell' || e.state === 'shell_slide') {
          if (e.vx === 0) {
              // Kick shell
              e.state = 'shell_slide';
              e.vx = this.player.dir === Direction.Right ? SHELL_SPEED : -SHELL_SPEED;
              e.kickTimer = 0;
              audioManager.playStomp();
          } else {
              // Hit by sliding shell = damage
              this.damagePlayer();
          }
          return;
      }

      // Check Stomp: Player moving down, Player bottom overlaps enemy top
      const playerHeight = this.player.isBig ? 28 : this.player.height;
      const playerBottom = this.player.y + playerHeight;
      const enemyTop = e.y;
      const stompThreshold = 4; // NES stomp detection threshold

      if (this.player.vy > 0 && playerBottom <= enemyTop + stompThreshold) {
          // STOMP
          this.player.vy = BOUNCE_FORCE; // Negative value = up
          this.player.isJumping = true;
          this.player.jumpFrames = 0;
          this.player.jumpReleased = false; // Allow jump boost if holding A
          audioManager.playStomp();
          
          if (e.type === EntityType.Goomba) {
              this.killEnemy(e, false);
              this.addScore(SCORE_GOOMBA);
          } else if (e.type === EntityType.Koopa) {
              // Koopa turns into shell
              e.state = 'shell';
              e.vx = 0;
              e.shellTimer = 0;
              e.kickTimer = 0;
              e.height = 16; // Shell is shorter
              e.y += 8; // Adjust position
              this.addScore(SCORE_KOOPA);
          }
      } else {
          // SIDE HIT = DAMAGE
          this.damagePlayer();
      }
  }

  killEnemy(enemy: Enemy, isShellKill: boolean) {
      enemy.dead = true;
      if (isShellKill) {
          this.addScore(SCORE_SHELL_KILL);
      }
      // Spawn death particle
      this.particles.push(new Particle(enemy.x, enemy.y, 0, -1.0));
  }

  addChainKillScore() {
      const currentFrame = this.timerFrameCounter + (400 - this.timeLeft) * TIMER_DECREMENT_INTERVAL;
      // Chain kills must happen within ~1 second
      if (currentFrame - this.lastKillTime < 60) {
          this.chainKillCount++;
      } else {
          this.chainKillCount = 0;
      }
      this.lastKillTime = currentFrame;
      
      const scoreIndex = Math.min(this.chainKillCount, CHAIN_SCORES.length - 1);
      this.addScore(CHAIN_SCORES[scoreIndex]);
  }

  addScore(points: number) {
      this.score += points;
      // 1-Up at 100 coins (handled elsewhere)
  }

  damagePlayer() {
      if (this.player.starTimer > 0 || this.player.iframeTimer > 0) return;
      
      if (this.player.isBig) {
          // Shrink Mario
          this.player.isBig = false;
          this.player.hasFire = false;
          this.player.iframeTimer = 120; // 2 seconds invincibility
          this.player.y += 8; // Adjust height
      } else {
          // Death
          this.killPlayer();
      }
  }

  killPlayer() {
      if (this.player.dead) return;
      this.player.dead = true;
      this.player.deathTimer = 0;
      this.player.vx = 0;
      audioManager.playDie();
      
      this.player.lives--;
      if (this.player.lives <= 0) {
          this.state = GameState.GameOver;
      }
      // Death animation handled in updatePlayer
  }

  updateGameOver() {
      // Game over screen - wait for input to restart
      // For now, auto-restart after delay
  }

  updateEndLevel() {
      this.flagpoleTimer++;
      
      if (this.endLevelState === 'none' && this.flagpoleGrabbed) {
          // Calculate score based on flagpole height
          const flagpoleY = this.getFlagpoleY();
          const heightTiles = Math.floor((this.player.y - flagpoleY) / TILE_SIZE);
          this.flagpoleScore = SCORE_FLAGPOLE_BASE + (heightTiles * SCORE_FLAGPOLE_MULTIPLIER);
          this.addScore(this.flagpoleScore);
          
          // Slide down flagpole
          this.endLevelState = 'sliding';
          this.player.x = this.getFlagpoleX() + 4; // Align with pole
      }
      
      if (this.endLevelState === 'sliding') {
          // Slide down
          if (this.player.y < this.getFlagpoleY() + 13 * TILE_SIZE) {
              this.player.y += 2.0; // Slide speed
          } else {
              // Landed, walk to castle
              this.endLevelState = 'walking';
              this.player.grounded = true;
              this.player.vx = 1.0; // Walk right
          }
      }
      
      if (this.endLevelState === 'walking') {
          // Walk off screen
          this.player.x += this.player.vx;
          if (this.player.x > this.level.width) {
              this.endLevelState = 'complete';
              // Convert remaining time to score
              this.addScore(this.timeLeft * 50);
              // Level complete - would transition to next level
              setTimeout(() => {
                  this.reset();
                  this.state = GameState.Playing;
              }, 2000);
          }
      }
  }

  getFlagpoleX(): number {
      // Find flagpole in level
      for (let y = 0; y < this.level.tiles.length; y++) {
          for (let x = 0; x < this.level.tiles[y].length; x++) {
              if (this.level.tiles[y][x] === TileType.FlagPole) {
                  return x * TILE_SIZE;
              }
          }
      }
      return 0;
  }

  getFlagpoleY(): number {
      for (let y = 0; y < this.level.tiles.length; y++) {
          for (let x = 0; x < this.level.tiles[y].length; x++) {
              if (this.level.tiles[y][x] === TileType.FlagTop) {
                  return y * TILE_SIZE;
              }
          }
      }
      return 0;
  }

  updatePowerUps() {
      this.powerUps = this.powerUps.filter(p => {
          if (!p.active) {
              p.spawnTimer++;
              if (p.spawnTimer >= POWERUP_SPAWN_DELAY) {
                  p.active = true;
              }
              return true;
          }
          
          // Gravity for mushroom/flower
          if (p.type === EntityType.Mushroom || p.type === EntityType.FireFlower) {
              p.vy += GRAVITY;
              if (p.vy > MAX_FALL_SPEED) p.vy = MAX_FALL_SPEED;
          }
          
          // Movement
          p.x += p.vx;
          p.y += p.vy;
          
          // Collision with tiles
          this.checkTileCollision(p, true);
          this.checkTileCollision(p, false);
          
          // Mushroom reverses on wall
          if (p.type === EntityType.Mushroom && p.grounded) {
              const checkX = p.vx > 0 ? p.x + p.width : p.x - 1;
              const tileX = Math.floor(checkX / TILE_SIZE);
              const tileY = Math.floor(p.y / TILE_SIZE);
              
              if (tileX >= 0 && tileX < this.level.tiles[0].length &&
                  tileY >= 0 && tileY < this.level.tiles.length &&
                  this.isSolid(this.level.tiles[tileY][tileX])) {
                  p.vx = -p.vx;
              }
          }
          
          // Collision with player
          if (!this.player.dead && this.checkEntityCollision(this.player, p)) {
              this.collectPowerUp(p);
              return false; // Remove power-up
          }
          
          // Despawn if off screen
          if (p.x < this.cameraX - 32 || p.x > this.cameraX + SCREEN_WIDTH + 32 ||
              p.y > SCREEN_HEIGHT + 32) {
              return false;
          }
          
          return true;
      });
  }

  collectPowerUp(powerUp: PowerUp) {
      if (powerUp.type === EntityType.Mushroom) {
          if (!this.player.isBig) {
              this.player.isBig = true;
              this.player.y -= 8; // Grow upward
          }
          audioManager.playPowerUp();
      } else if (powerUp.type === EntityType.FireFlower) {
          if (this.player.isBig) {
              this.player.hasFire = true;
          } else {
              this.player.isBig = true;
              this.player.y -= 8;
          }
          audioManager.playPowerUp();
      } else if (powerUp.type === EntityType.Star) {
          this.player.starTimer = STAR_DURATION;
          audioManager.playPowerUp(); // Would play star music
      }
  }

  updateParticles() {
      this.particles = this.particles.filter(p => p.life > 0);
      this.particles.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.life--;
      });
  }

  checkTileCollision(entity: Entity, isXAxis: boolean) {
    // Get actual height (for big Mario)
    const entityHeight = (entity === this.player && this.player.isBig) ? 28 : entity.height;
    
    const startX = Math.floor(entity.x / TILE_SIZE);
    const endX = Math.floor((entity.x + entity.width - 0.1) / TILE_SIZE);
    const startY = Math.floor(entity.y / TILE_SIZE);
    const endY = Math.floor((entity.y + entityHeight - 0.1) / TILE_SIZE);

    for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
            if (y < 0 || y >= this.level.tiles.length) continue;
            
            const tile = this.level.tiles[y][x];
            if (this.isSolid(tile)) {
                if (isXAxis) {
                    if (entity.vx > 0) {
                        entity.x = x * TILE_SIZE - entity.width;
                        entity.vx = 0;
                        if (entity instanceof Enemy) entity.vx = -entity.vx; // Turn around
                    } else if (entity.vx < 0) {
                        entity.x = (x + 1) * TILE_SIZE;
                        entity.vx = 0;
                        if (entity instanceof Enemy) entity.vx = -entity.vx;
                    }
                } else {
                    if (entity.vy > 0) {
                        entity.y = y * TILE_SIZE - entityHeight;
                        entity.vy = 0;
                        entity.grounded = true;
                        // Reset jumping flag when player lands
                        if (entity === this.player) {
                            this.player.isJumping = false;
                        }
                    } else if (entity.vy < 0) {
                        entity.y = (y + 1) * TILE_SIZE;
                        entity.vy = 0;
                        // Head bump block interaction
                        if (entity === this.player) {
                            this.handleBlockBump(x, y);
                        }
                    }
                }
                return; // Resolved collision
            } else if ((tile === TileType.FlagPole || tile === TileType.FlagTop) && entity === this.player && !this.flagpoleGrabbed) {
                // Grab flagpole
                this.flagpoleGrabbed = true;
                this.state = GameState.LevelClear;
                this.player.vx = 0;
                this.player.vy = 0;
                audioManager.playCoin(); // Flagpole sound
            }
        }
    }
  }

  handleBlockBump(x: number, y: number) {
      const tile = this.level.tiles[y][x];
      if (tile === TileType.QuestionBlock) {
          this.level.tiles[y][x] = TileType.UsedBlock;
          
          // NES: Question blocks can contain coins or power-ups
          // For now, spawn coin (would check level data for power-up blocks)
          this.coins++;
          if (this.coins >= 100) {
              this.coins = 0;
              this.player.lives++;
              // 1-Up sound
          }
          this.addScore(SCORE_COIN);
          audioManager.playCoin();
          
          // Spawn power-up if this is a power-up block (would check level data)
          // For demo, spawn mushroom from first question block
          if (x === 5 && y === 5) { // Example: first question block
              this.spawnPowerUp(EntityType.Mushroom, x * TILE_SIZE, y * TILE_SIZE);
          }
      } else if (tile === TileType.Brick) {
          if (this.player.isBig) {
              this.level.tiles[y][x] = TileType.Air;
              this.addScore(SCORE_BRICK_BREAK);
              audioManager.playStomp();
              // Spawn brick particles
              for (let i = 0; i < 4; i++) {
                  this.particles.push(new Particle(
                      x * TILE_SIZE + 8,
                      y * TILE_SIZE + 8,
                      (Math.random() - 0.5) * 2,
                      -Math.random() * 2
                  ));
              }
          } else {
              // Just bump sound
              audioManager.playStomp();
          }
      }
  }

  spawnPowerUp(type: EntityType.Mushroom | EntityType.FireFlower | EntityType.Star, x: number, y: number) {
      const powerUp = new PowerUp(type, x, y);
      powerUp.active = false; // Spawns after delay
      powerUp.spawnTimer = 0;
      this.powerUps.push(powerUp);
  }

  isSolid(tile: number): boolean {
      return tile !== TileType.Air && tile !== TileType.FlagPole && tile !== TileType.FlagTop;
  }

  checkEntityCollision(e1: Entity, e2: Entity): boolean {
      // Get actual heights
      const e1Height = (e1 === this.player && this.player.isBig) ? 28 : e1.height;
      const e2Height = (e2 === this.player && this.player.isBig) ? 28 : e2.height;
      
      return (
          e1.x < e2.x + e2.width &&
          e1.x + e1.width > e2.x &&
          e1.y < e2.y + e2Height &&
          e1.y + e1Height > e2.y
      );
  }

  updateCamera() {
      // NES Camera: Follows Mario with offset, no backward scrolling
      // Mario stays at ~100 pixels from left edge of screen
      const cameraOffset = 100;
      let targetX = this.player.x - cameraOffset;
      
      // Can't scroll backward
      if (targetX < 0) targetX = 0;
      if (targetX < this.cameraX) {
          // Don't scroll backward
          return;
      }
      
      // Smooth forward scrolling (NES does instant, but we'll allow slight smoothing)
      if (targetX > this.cameraX) {
          this.cameraX = targetX; // NES: instant scroll
      }
      
      // Clamp to level end
      const maxCam = Math.max(0, this.level.width - SCREEN_WIDTH);
      if (this.cameraX > maxCam) this.cameraX = maxCam;
  }

  draw() {
    // Clear
    this.ctx.fillStyle = COLOR_SKY;
    this.ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    if (this.state === GameState.Title) {
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '16px PressStart2P'; // Fallback
        this.ctx.fillText("REACT MARIO CLONE", 40, 100);
        this.ctx.font = '8px PressStart2P';
        this.ctx.fillText("PRESS ENTER TO START", 70, 150);
        return;
    }

    this.ctx.save();
    this.ctx.translate(-Math.floor(this.cameraX), 0);

    // Draw Map
    const startCol = Math.floor(this.cameraX / TILE_SIZE);
    const endCol = startCol + (SCREEN_WIDTH / TILE_SIZE) + 1;

    for (let y = 0; y < this.level.tiles.length; y++) {
        for (let x = startCol; x <= endCol; x++) {
            if (x >= this.level.tiles[0].length) continue;
            const tile = this.level.tiles[y][x];
            if (tile !== TileType.Air) {
                this.drawTile(x, y, tile);
            }
        }
    }

    // Draw Entities
    this.drawEntity(this.player);
    this.enemies.forEach(e => {
        if (e.active) this.drawEntity(e);
    });
    this.powerUps.forEach(p => {
        if (p.active) this.drawEntity(p);
    });

    this.ctx.restore();
    
    // HUD
    this.drawHUD();

    if (this.state === GameState.GameOver) {
        this.ctx.fillStyle = 'rgba(0,0,0,0.8)';
        this.ctx.fillRect(0,0,SCREEN_WIDTH, SCREEN_HEIGHT);
        this.ctx.fillStyle = '#FFF';
        this.ctx.fillText("GAME OVER", 100, 120);
    }
  }

  drawTile(gx: number, gy: number, type: number) {
      const x = gx * TILE_SIZE;
      const y = gy * TILE_SIZE;

      switch(type) {
          case TileType.Ground:
              this.ctx.fillStyle = COLOR_GROUND;
              this.ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
              // Detail
              this.ctx.fillStyle = '#000';
              this.ctx.fillRect(x + 2, y + 2, 2, 2);
              break;
          case TileType.Brick:
              this.ctx.fillStyle = COLOR_BRICK;
              this.ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
              this.ctx.fillStyle = '#000';
              this.ctx.strokeRect(x+0.5, y+0.5, TILE_SIZE-1, TILE_SIZE-1);
              break;
          case TileType.QuestionBlock:
              this.ctx.fillStyle = COLOR_QUESTION;
              this.ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
              this.ctx.fillStyle = '#440000';
              this.ctx.fillText("?", x+4, y+12);
              break;
           case TileType.UsedBlock:
              this.ctx.fillStyle = '#664444';
              this.ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
              break;
           case TileType.PipeLeft:
           case TileType.PipeRight:
           case TileType.PipeTopLeft:
           case TileType.PipeTopRight:
              this.ctx.fillStyle = COLOR_PIPE;
              this.ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
              this.ctx.lineWidth = 2;
              this.ctx.strokeStyle = COLOR_PIPE_DARK;
              this.ctx.strokeRect(x,y,TILE_SIZE, TILE_SIZE);
              break;
           case TileType.FlagPole:
           case TileType.FlagTop:
               this.ctx.fillStyle = '#20d020';
               this.ctx.fillRect(x+6, y, 4, TILE_SIZE);
               break;
      }
  }

  drawEntity(e: Entity) {
      // Star invincibility flashing
      const isFlashing = (e.type === EntityType.Player && 
                         (this.player.starTimer > 0 || this.player.iframeTimer > 0)) &&
                         (Math.floor(this.timerFrameCounter / 4) % 2 === 0);
      
      if (isFlashing && e.type === EntityType.Player) {
          // Don't draw during flash frames
          return;
      }

      let color = '#FF0000';
      if (e.type === EntityType.Player) {
          color = e.dead ? '#555' : (this.player.starTimer > 0 ? '#FFFF00' : '#d02020');
          // Draw big Mario taller
          if (this.player.isBig && !this.player.dead) {
              this.ctx.fillStyle = color;
              this.ctx.fillRect(Math.floor(e.x), Math.floor(e.y), e.width, e.height);
              // Top half
              this.ctx.fillRect(Math.floor(e.x), Math.floor(e.y) - 14, e.width, 14);
          } else {
              this.ctx.fillStyle = color;
              this.ctx.fillRect(Math.floor(e.x), Math.floor(e.y), e.width, e.height);
          }
      } else if (e.type === EntityType.Goomba) {
          color = '#804000';
          this.ctx.fillStyle = color;
          this.ctx.fillRect(Math.floor(e.x), Math.floor(e.y), e.width, e.height);
      } else if (e.type === EntityType.Koopa) {
          if ((e as Enemy).state === 'shell' || (e as Enemy).state === 'shell_slide') {
              color = '#804000'; // Shell color
          } else {
              color = '#00a020'; // Koopa color
          }
          this.ctx.fillStyle = color;
          this.ctx.fillRect(Math.floor(e.x), Math.floor(e.y), e.width, (e as Enemy).state === 'shell' ? 16 : e.height);
      } else if (e.type === EntityType.Mushroom) {
          this.ctx.fillStyle = '#FF0000';
          this.ctx.fillRect(Math.floor(e.x) + 2, Math.floor(e.y), 12, 16);
          this.ctx.fillStyle = '#FFFFFF';
          this.ctx.fillRect(Math.floor(e.x) + 4, Math.floor(e.y) + 2, 8, 4);
      } else if (e.type === EntityType.FireFlower) {
          this.ctx.fillStyle = '#FF0000';
          this.ctx.fillRect(Math.floor(e.x) + 4, Math.floor(e.y), 8, 16);
          this.ctx.fillStyle = '#FFFF00';
          this.ctx.fillRect(Math.floor(e.x) + 6, Math.floor(e.y) + 4, 4, 4);
      } else if (e.type === EntityType.Star) {
          this.ctx.fillStyle = '#FFFF00';
          this.ctx.fillRect(Math.floor(e.x) + 4, Math.floor(e.y) + 4, 8, 8);
      }
      
      // Eyes/Face direction for enemies
      if (!e.dead && (e.type === EntityType.Goomba || e.type === EntityType.Koopa)) {
        this.ctx.fillStyle = '#FFF';
        if (e.dir === Direction.Right) {
             this.ctx.fillRect(Math.floor(e.x) + e.width - 4, Math.floor(e.y) + 4, 2, 4);
        } else {
             this.ctx.fillRect(Math.floor(e.x) + 2, Math.floor(e.y) + 4, 2, 4);
        }
      }
  }

  drawHUD() {
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.font = '8px monospace';
      this.ctx.fillText(`MARIO`, 20, 16);
      this.ctx.fillText(`${this.score.toString().padStart(6, '0')}`, 20, 26);
      
      this.ctx.fillText(`COINS`, 90, 16);
      this.ctx.fillText(`x${this.coins.toString().padStart(2, '0')}`, 95, 26);
      
      this.ctx.fillText(`WORLD`, 150, 16);
      this.ctx.fillText(this.world, 155, 26);
      
      this.ctx.fillText(`TIME`, 210, 16);
      this.ctx.fillText(`${Math.floor(this.timeLeft)}`, 215, 26);
      
      // Lives
      this.ctx.fillText(`LIVES`, 20, SCREEN_HEIGHT - 20);
      this.ctx.fillText(`${this.player.lives}`, 20, SCREEN_HEIGHT - 10);
  }

  destroy() {
    this.input.destroy();
  }
}