// =============================================================================
// NES SUPER MARIO BROS. — TYPE DEFINITIONS
// =============================================================================

export enum Direction {
  Left = -1,
  Right = 1,
}

export enum GameState {
  Title,
  Playing,
  Dying,           // Death animation in progress
  GameOver,
  LevelClear,      // Flagpole sequence
  CastleEnter,     // Walking to castle
  TimeBonus,       // Converting timer to score
}

export enum PlayerState {
  Small,
  Big,
  Fire,
}

export enum PlayerAction {
  Standing,
  Walking,
  Running,
  Skidding,
  Jumping,
  Falling,
  Climbing,        // Flagpole
  Dying,
  Growing,         // Power-up animation
  Shrinking,       // Damage animation
}

export enum EntityType {
  Player,
  Goomba,
  KoopaTroopa,
  KoopaShell,
  PiranhaPlant,
  BulletBill,
  HammerBro,
  Mushroom,
  FireFlower,
  Star,
  OneUp,
  Coin,            // Popped coin from block
  BrickDebris,
  Fireball,        // Mario's fireball
  FlagFlag,        // The flag on the pole
}

export enum EnemyState {
  Walking,
  Squished,        // Goomba squished, waiting to disappear
  Shell,           // Koopa in shell (stationary)
  ShellMoving,     // Shell kicked and sliding
  Emerging,        // Koopa coming out of shell
  Dead,            // Fell off screen / killed by shell
}

export enum TileType {
  Air = 0,
  Ground = 1,
  Brick = 2,
  HardBlock = 3,
  QuestionBlock = 4,
  UsedBlock = 5,
  PipeLeft = 6,
  PipeRight = 7,
  PipeTopLeft = 8,
  PipeTopRight = 9,
  FlagPole = 10,
  FlagTop = 11,
  CoinBlock = 12,      // Multi-coin brick
  HiddenBlock = 13,    // Invisible until hit
  CastleBlock = 14,
}

// Block content when bumped
export enum BlockContent {
  Empty,
  Coin,
  MultiCoin,       // Multiple coins (brick)
  Mushroom,        // Becomes FireFlower if Big
  Star,
  OneUp,
}

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;   // A button (Z key)
  run: boolean;    // B button (X key)
  start: boolean;
  select: boolean;
}

// Block metadata for special blocks
export interface BlockData {
  x: number;
  y: number;
  content: BlockContent;
  coinCount?: number;    // For multi-coin blocks
  bumpTimer: number;     // Animation timer
  bumpOffset: number;    // Current Y offset
}

// Spawn point for entities
export interface SpawnPoint {
  type: 'goomba' | 'koopa' | 'piranha' | 'mushroom_block' | 'star_block' | '1up_block';
  x: number;
  y: number;
  spawned: boolean;
}
