export enum Direction {
  Left = -1,
  Right = 1,
}

export enum GameState {
  Title,
  Playing,
  GameOver,
  LevelClear,
}

export enum EntityType {
  Player,
  Goomba,
  Koopa,
  Mushroom,
  Star,
  FireFlower,
  Particle,
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
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean; // A
  run: boolean; // B
  start: boolean;
  select: boolean;
}