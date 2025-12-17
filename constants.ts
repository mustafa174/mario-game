// Display
export const SCREEN_WIDTH = 256;
export const SCREEN_HEIGHT = 240;
export const TILE_SIZE = 16;
export const SCALE = 3;

// NES Super Mario Bros Physics Constants (exact values from ROM disassembly)
// All values are in sub-pixels per frame at 60 FPS
export const GRAVITY = 0.1875; // Exact NES gravity (0x30 / 256)
export const MAX_FALL_SPEED = 4.0; // Max fall speed in sub-pixels
export const JUMP_FORCE = -4.0; // Initial jump velocity (negative = up)
export const JUMP_HOLD_FORCE = -0.1875; // Additional force per frame while holding A
export const MAX_JUMP_HOLD_FRAMES = 16; // Max frames to apply jump hold force

// NES acceleration values (walking/running)
export const ACCEL_WALK = 0.09375; // Walking acceleration (0x18 / 256)
export const ACCEL_RUN = 0.15625; // Running acceleration (0x28 / 256)
export const DECEL_WALK = 0.125; // Walking deceleration when releasing button
export const DECEL_RUN = 0.25; // Running deceleration
export const FRICTION_GROUND = 0.875; // Ground friction multiplier (when not accelerating)
export const FRICTION_AIR = 0.96875; // Air friction (0xF8 / 256)

// NES speed caps (in sub-pixels per frame)
export const MAX_SPEED_WALK = 1.5; // Max walking speed
export const MAX_SPEED_RUN = 2.5; // Max running speed

// Enemy stomp bounce
export const BOUNCE_FORCE = -3.5; // Bounce velocity when stomping enemy

// Colors
export const COLOR_SKY = '#5c94fc';
export const COLOR_GROUND = '#c84c0c'; // Brick colorish
export const COLOR_BRICK = '#b83030';
export const COLOR_HARD = '#c84c0c';
export const COLOR_QUESTION = '#fc9838';
export const COLOR_PIPE = '#00a800'; // Standard green
export const COLOR_PIPE_DARK = '#007000'; // Dark green outline

// Entity Constants (NES-accurate)
export const GOOMBA_SPEED = 0.5; // Sub-pixels per frame
export const KOOPA_SPEED = 0.5;
export const SHELL_SPEED = 4.0; // Shell kick speed
export const MUSHROOM_SPEED = 1.0;
export const STAR_SPEED = 1.5; // Star movement speed

export const SPAWN_ZONE = 32; // Pixels outside camera to activate enemies

// NES Timer: Decrements every 21 frames (1 second = 21 frames on NES)
export const TIMER_DECREMENT_INTERVAL = 21;

// Scoring (NES-accurate point values)
export const SCORE_GOOMBA = 100;
export const SCORE_KOOPA = 200;
export const SCORE_SHELL_KILL = 400;
export const SCORE_COIN = 200;
export const SCORE_BRICK_BREAK = 50;
export const SCORE_FLAGPOLE_BASE = 100; // Base score for flagpole
export const SCORE_FLAGPOLE_MULTIPLIER = 50; // Per tile height

// Chain kill scoring (400, 800, 1000, 2000, 4000, 5000, 8000)
export const CHAIN_SCORES = [400, 800, 1000, 2000, 4000, 5000, 8000];

// Power-up durations
export const STAR_DURATION = 600; // Frames of invincibility (10 seconds)
export const POWERUP_SPAWN_DELAY = 10; // Frames before power-up appears from block