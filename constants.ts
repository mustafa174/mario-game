// Display
export const SCREEN_WIDTH = 256;
export const SCREEN_HEIGHT = 240;
export const TILE_SIZE = 16;
export const SCALE = 3;

// Physics (Approximate NES values converted to 60FPS floating point)
export const GRAVITY = 0.4; // Sub-pixel gravity
export const MAX_FALL_SPEED = 4.5;
export const JUMP_FORCE = 5.0; // Initial impulse
export const JUMP_HOLD_FORCE = 0.22; // Added while holding A
export const MAX_JUMP_HOLD_FRAMES = 14; // How long holding A affects height

export const ACCEL_WALK = 0.09; // Acceleration on ground
export const ACCEL_RUN = 0.14; // Acceleration when holding B
export const FRICTION_GROUND = 0.85; // Velocity multiplier (simple friction model)
export const FRICTION_AIR = 0.96; // Air resistance

export const MAX_SPEED_WALK = 1.6;
export const MAX_SPEED_RUN = 2.9;

export const BOUNCE_FORCE = 4.0; // Force when stomping enemy

// Colors
export const COLOR_SKY = '#5c94fc';
export const COLOR_GROUND = '#c84c0c'; // Brick colorish
export const COLOR_BRICK = '#b83030';
export const COLOR_HARD = '#c84c0c';
export const COLOR_QUESTION = '#fc9838';
export const COLOR_PIPE = '#00a800'; // Standard green
export const COLOR_PIPE_DARK = '#007000'; // Dark green outline

// Entity Constants
export const GOOMBA_SPEED = 0.5;
export const KOOPA_SPEED = 0.5;
export const SHELL_SPEED = 3.5;
export const MUSHROOM_SPEED = 1.0;

export const SPAWN_ZONE = 32; // Pixels outside camera to activate