// =============================================================================
// NES SUPER MARIO BROS. ACCURATE CONSTANTS
// Values derived from NES ROM disassembly (fixed-point converted to float)
// =============================================================================

// Display (NES resolution)
export const SCREEN_WIDTH = 256;
export const SCREEN_HEIGHT = 240;
export const TILE_SIZE = 16;
export const SCALE = 3;

// =============================================================================
// PHYSICS — NES uses 8.8 fixed-point (256 subpixels per pixel)
// These are the EXACT values from the ROM, converted to pixels/frame
// =============================================================================

// Gravity — NES has TWO gravity values
// When A is HELD and Mario is moving UP: lighter gravity
// When A is RELEASED or Mario is moving DOWN: heavier gravity
export const GRAVITY_A_HELD = 0.1875;      // $0030 / 256 = 0.1875
export const GRAVITY_A_RELEASED = 0.375;   // $0060 / 256 = 0.375 (approx, varies)
export const GRAVITY_FALLING = 0.4375;     // $0070 / 256 = 0.4375

export const MAX_FALL_SPEED = 4.0;         // $0400 / 256 = 4.0

// Jump initial velocities — NES varies based on horizontal speed
// Small Mario values:
export const JUMP_VEL_SLOW = -4.0;         // When moving slow or stationary
export const JUMP_VEL_MED = -4.0;          // When walking
export const JUMP_VEL_FAST = -5.0;         // When running at max speed

// Horizontal movement — NES uses acceleration tables
export const ACCEL_WALK = 0.046875;        // $000C / 256 (ground accel)
export const ACCEL_RUN = 0.046875;         // Same base accel, just higher max
export const ACCEL_AIR = 0.046875;         // Air control same as ground

export const DECEL_RELEASE = 0.0625;       // $0010 / 256 (letting go of d-pad)
export const DECEL_SKID = 0.125;           // $0020 / 256 (skidding)

export const MAX_WALK_SPEED = 1.5625;      // $0190 / 256
export const MAX_RUN_SPEED = 2.5625;       // $0290 / 256

export const FRICTION_GROUND = 0.9375;     // NES applies per-frame decel, not multiplier
export const MIN_WALK_SPEED = 0.0625;      // Below this, snap to 0

// Bounce force when stomping enemy — depends on A held
export const STOMP_BOUNCE_LOW = -4.0;      // A not held
export const STOMP_BOUNCE_HIGH = -5.0;     // A held

// =============================================================================
// ENEMY CONSTANTS — NES values
// =============================================================================

export const GOOMBA_SPEED = 0.375;         // $0060 / 256
export const KOOPA_SPEED = 0.375;          // Same as Goomba
export const SHELL_SPEED = 3.0;            // $0300 / 256 — kicked shell
export const MUSHROOM_SPEED = 0.75;        // $00C0 / 256
export const STAR_SPEED = 1.5;             // Bouncing star

// Frames enemies stay squished before disappearing
export const GOOMBA_SQUISH_FRAMES = 30;
export const SHELL_WAKE_FRAMES = 300;      // ~5 seconds before Koopa emerges

// =============================================================================
// COLORS — NES Palette approximations
// =============================================================================

export const COLOR_SKY = '#5c94fc';
export const COLOR_GROUND = '#c84c0c';
export const COLOR_BRICK = '#b83030';
export const COLOR_HARD = '#c84c0c';
export const COLOR_QUESTION = '#fc9838';
export const COLOR_QUESTION_DARK = '#c84c0c';
export const COLOR_USED = '#888888';
export const COLOR_PIPE = '#00a800';
export const COLOR_PIPE_DARK = '#005800';
export const COLOR_MARIO = '#b13e1d';
export const COLOR_MARIO_PANTS = '#6b6ecf';
export const COLOR_GOOMBA = '#c84c0c';
export const COLOR_KOOPA_GREEN = '#00a800';
export const COLOR_KOOPA_SHELL = '#00a800';

// =============================================================================
// GAME CONSTANTS
// =============================================================================

export const STARTING_LIVES = 3;
export const COINS_FOR_1UP = 100;
export const TIMER_START = 400;
export const TIMER_TICK_FRAMES = 24;       // Timer decrements every 24 frames (~0.4s)
export const TIMER_WARNING = 100;          // Speed up music at 100

// Invincibility frames after taking damage
export const DAMAGE_IFRAMES = 120;         // 2 seconds

// Star power duration
export const STAR_DURATION = 720;          // ~12 seconds

// Score values
export const SCORE_COIN = 200;
export const SCORE_BLOCK = 200;
export const SCORE_MUSHROOM = 1000;
export const SCORE_FIREFLOWER = 1000;
export const SCORE_STAR = 1000;
export const SCORE_1UP = 0;                // 1-UP gives no points

// Chain kill scores (exact NES values)
export const CHAIN_SCORES = [100, 200, 400, 500, 800, 1000, 2000, 4000, 5000, 8000];
// After 8000, every subsequent kill in chain = 1UP

// Flagpole scores based on height
export const FLAG_SCORES = [100, 400, 800, 2000, 5000];

// =============================================================================
// TIMING
// =============================================================================

export const DEATH_JUMP_FRAMES = 60;       // Frames of death jump before falling
export const DEATH_FALL_FRAMES = 120;      // Frames to fall off screen
export const LEVEL_CLEAR_WALK_SPEED = 1.0; // Walk to castle speed
export const FLAG_SLIDE_SPEED = 2.0;       // Slide down flagpole speed

// Block bump animation
export const BLOCK_BUMP_HEIGHT = 8;        // Pixels block moves up
export const BLOCK_BUMP_FRAMES = 8;        // Duration of bump
