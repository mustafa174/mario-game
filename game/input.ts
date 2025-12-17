import { InputState } from '../types';

export class InputManager {
  keys: { [key: string]: boolean } = {};
  
  constructor() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  destroy() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    this.keys[e.code] = true;
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
  };

  poll(): InputState {
    return {
      left: this.keys['ArrowLeft'] || this.keys['KeyA'],
      right: this.keys['ArrowRight'] || this.keys['KeyD'],
      up: this.keys['ArrowUp'] || this.keys['KeyW'],
      down: this.keys['ArrowDown'] || this.keys['KeyS'],
      jump: this.keys['KeyZ'] || this.keys['Space'] || this.keys['KeyK'], // A button
      run: this.keys['KeyX'] || this.keys['KeyJ'], // B button
      start: this.keys['Enter'],
      select: this.keys['ShiftLeft'] || this.keys['ShiftRight'],
    };
  }
}