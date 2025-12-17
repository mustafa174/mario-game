import {
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  TILE_SIZE,
  GRAVITY,
  MAX_FALL_SPEED,
  ACCEL_WALK,
  ACCEL_RUN,
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

  constructor(type: EntityType, x: number, y: number) {
    super(type, x, y, 16, 16);
    this.vx = -GOOMBA_SPEED;
  }
}

class Player extends Entity {
  jumpFrames: number = 0;
  isJumping: boolean = false;
  jumpReleased: boolean = true; // Prevents bunny hopping
  isBig: boolean = false;
  iframeTimer: number = 0;

  constructor() {
    super(EntityType.Player, 50, 100, 14, 14); // Slightly smaller collision box for feel
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
  particles: Particle[] = [];
  
  level: { tiles: number[][]; width: number; height: number };
  cameraX: number = 0;
  
  timeLeft: number = 400;
  score: number = 0;
  coins: number = 0;
  world: string = '1-1';

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

    // Reset Player
    this.player.x = 40;
    this.player.y = 192; 
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.dead = false;
    this.player.isBig = false;
    this.player.isJumping = false;
    this.player.jumpReleased = true;
    this.player.jumpFrames = 0;
    this.player.dir = Direction.Right;

    this.cameraX = 0;
    this.state = GameState.Title;
    this.timeLeft = 400;
    // Note: Score and Coins persist according to some rules, but "start from scratch" implies reset.
    // However, if reset() is called for level restart (death), we might want to keep score.
    // For now, based on "game is over it should start from scratch", we reset score.
    this.score = 0;
    this.coins = 0;
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
        this.updateParticles();
        this.updateCamera();
        
        // Check pit death
        if (this.player.y > SCREEN_HEIGHT + 16) {
            this.killPlayer();
        }
        
        // Timer
        // Note: In a real 60FPS loop, we should decrement time based on frames or delta
        // Here we just decrement loosely for the demo feel
        // Real NES timer is faster than seconds. 
        // We'll roughly decrement every 24 frames for NES speed or just 60 for seconds.
        // For now, let's say 1 second = 60 frames roughly.
        // But to make it visible, we do it in draw or separate logic.
        // We'll leave timeLeft static decrement in update for now? 
        // Actually, let's decrement it slowly.
        this.timeLeft -= 1/60; 
        if (this.timeLeft <= 0) {
            this.killPlayer();
        }
    }
  }

  updatePlayer(input: InputState) {
    if (this.player.dead) return;

    if (this.player.iframeTimer > 0) this.player.iframeTimer--;

    // Horizontal Movement
    const maxSpeed = input.run ? MAX_SPEED_RUN : MAX_SPEED_WALK;
    const accel = input.run ? ACCEL_RUN : ACCEL_WALK;

    if (input.left) {
        if (this.player.vx > 0) this.player.vx -= accel * 2; // Skid turn
        else this.player.vx -= accel;
        this.player.dir = Direction.Left;
    } else if (input.right) {
        if (this.player.vx < 0) this.player.vx += accel * 2;
        else this.player.vx += accel;
        this.player.dir = Direction.Right;
    } else {
        // Friction
        const friction = this.player.grounded ? FRICTION_GROUND : FRICTION_AIR;
        this.player.vx *= friction;
        if (Math.abs(this.player.vx) < 0.1) this.player.vx = 0;
    }

    // Cap speed
    if (this.player.vx > maxSpeed) this.player.vx = maxSpeed;
    if (this.player.vx < -maxSpeed) this.player.vx = -maxSpeed;

    // Reset jump release
    if (!input.jump) {
        this.player.jumpReleased = true;
        this.player.jumpFrames = MAX_JUMP_HOLD_FRAMES; // Stop adding force
    }

    // Jumping
    // Must be grounded, not currently jumping, and have released the button since last jump
    if (input.jump && this.player.jumpReleased && this.player.grounded) {
        this.player.isJumping = true;
        this.player.grounded = false;
        this.player.jumpReleased = false;
        this.player.vy = -JUMP_FORCE;
        this.player.jumpFrames = 0;
        audioManager.playJump();
    }

    // Variable jump height
    if (input.jump && this.player.isJumping && this.player.jumpFrames < MAX_JUMP_HOLD_FRAMES) {
        this.player.vy -= JUMP_HOLD_FORCE;
        this.player.jumpFrames++;
    }

    // Gravity
    this.player.vy += GRAVITY;
    if (this.player.vy > MAX_FALL_SPEED) this.player.vy = MAX_FALL_SPEED;

    // Apply Velocity X
    this.player.x += this.player.vx;
    this.checkTileCollision(this.player, true);

    // Apply Velocity Y
    this.player.y += this.player.vy;
    this.player.grounded = false; // Assume falling until collision says otherwise
    this.checkTileCollision(this.player, false);

    // Constrain to Camera
    if (this.player.x < this.cameraX) {
        this.player.x = this.cameraX;
        this.player.vx = 0;
    }
  }

  updateEnemies() {
    this.enemies.forEach(e => {
        if (e.dead) return;

        // Activation
        if (!e.active) {
            // Spawn if within screen + buffer
            if (e.x < this.cameraX + SCREEN_WIDTH + 32 && e.x > this.cameraX - 32) {
                e.active = true;
            } else {
                return;
            }
        } else {
            // Deactivate if too far
            if (e.x < this.cameraX - 64 || e.y > SCREEN_HEIGHT + 32) {
                e.active = false;
                // e.dead = true; // Despawn
                return;
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

        // Turn around on ledge for basic enemies if desired, but SMB goombas walk off.
        
        // Interactions with Player
        if (this.checkEntityCollision(this.player, e)) {
            this.resolvePlayerEnemyCollision(e);
        }
    });
  }

  resolvePlayerEnemyCollision(e: Enemy) {
      if (this.player.dead) return;

      // Check Stomp: Player moving down, Player bottom is near Enemy top
      const hitBoxY = this.player.y + this.player.height;
      const enemyTop = e.y;
      
      const stompThreshold = 8; // Pixels of leniency

      if (this.player.vy > 0 && hitBoxY < enemyTop + stompThreshold) {
          // STOMP
          this.player.vy = -BOUNCE_FORCE;
          // IMPORTANT: Reset jump state so they can boost jump if they hold A, or just bounce.
          // In SMB, holding A allows higher bounce.
          this.player.isJumping = true; // Treat as jump start for variable height
          this.player.jumpFrames = 0; 
          audioManager.playStomp();
          
          if (e.type === EntityType.Goomba) {
              e.dead = true;
              this.score += 100;
              this.particles.push(new Particle(e.x, e.y, 0, 0)); // Squish effect placeholder
          } else if (e.type === EntityType.Koopa) {
             // Koopa logic...
             e.dead = true; // Simple for now
          }
      } else {
          // DAMAGE
          if (this.player.iframeTimer > 0) return;
          this.killPlayer();
      }
  }

  killPlayer() {
      this.player.dead = true;
      audioManager.playDie();
      this.state = GameState.GameOver;
      // In a full game, we'd pause, play animation, reduce lives.
      setTimeout(() => {
          this.reset();
          this.state = GameState.Playing; // Instant restart for this demo
      }, 3000);
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
    const startX = Math.floor(entity.x / TILE_SIZE);
    const endX = Math.floor((entity.x + entity.width - 0.1) / TILE_SIZE);
    const startY = Math.floor(entity.y / TILE_SIZE);
    const endY = Math.floor((entity.y + entity.height - 0.1) / TILE_SIZE);

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
                        entity.y = y * TILE_SIZE - entity.height;
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
            } else if (tile === TileType.FlagPole && entity === this.player) {
                // Win
                this.state = GameState.LevelClear;
                audioManager.playCoin(); // Placeholder win sound
            }
        }
    }
  }

  handleBlockBump(x: number, y: number) {
      const tile = this.level.tiles[y][x];
      if (tile === TileType.QuestionBlock) {
          this.level.tiles[y][x] = TileType.UsedBlock;
          this.coins++;
          this.score += 200;
          audioManager.playCoin();
          // Spawn block bump effect particle
      } else if (tile === TileType.Brick) {
          if (this.player.isBig) {
              this.level.tiles[y][x] = TileType.Air;
              audioManager.playStomp(); // Break sound
          } else {
              audioManager.playStomp(); // Bump sound
          }
      }
  }

  isSolid(tile: number): boolean {
      return tile !== TileType.Air && tile !== TileType.FlagPole && tile !== TileType.FlagTop;
  }

  checkEntityCollision(e1: Entity, e2: Entity): boolean {
      return (
          e1.x < e2.x + e2.width &&
          e1.x + e1.width > e2.x &&
          e1.y < e2.y + e2.height &&
          e1.y + e1.height > e2.y
      );
  }

  updateCamera() {
      // Player is usually at x=100ish on screen. 
      // Camera X = Player X - 100
      let targetX = this.player.x - 100;
      if (targetX < 0) targetX = 0;
      if (targetX > this.cameraX) {
          this.cameraX = targetX;
      }
      // Clamp to level end
      const maxCam = this.level.width - SCREEN_WIDTH;
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
      let color = '#FF0000';
      if (e.type === EntityType.Player) color = e.dead ? '#555' : '#d02020';
      if (e.type === EntityType.Goomba) color = '#804000';
      if (e.type === EntityType.Koopa) color = '#00a020';

      this.ctx.fillStyle = color;
      this.ctx.fillRect(Math.floor(e.x), Math.floor(e.y), e.width, e.height);
      
      // Eyes/Face direction
      if (!e.dead) {
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
  }

  destroy() {
    this.input.destroy();
  }
}