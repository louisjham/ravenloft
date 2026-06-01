import { AudioManager } from './AudioManager';
import { GamePhase } from '../game/types';

export class MusicSystem {
  private lastPhase: GamePhase | null = null;

  public updateMusicForState(phase: GamePhase, isBossActive: boolean) {
    if (this.lastPhase === phase) return;
    this.lastPhase = phase;

    const manager = AudioManager.getInstance();

    if (isBossActive) {
      manager.playMusic('boss_theme');
      return;
    }

    switch (phase) {
      case 'setup':
        manager.playMusic('main_theme');
        break;
      case 'monster':
        // Perhaps switch to a more tense version or layer
        break;
      case 'end':
        manager.stopMusic(2000);
        break;
      default:
        // Default exploration music
        break;
    }
  }

  public triggerStinger(type: 'critical' | 'spawn' | 'victory') {
    // Stingers are short musical punctuation marks
    const manager = AudioManager.getInstance();
    switch (type) {
      case 'critical':
        manager.playSound('spell_cast'); // Placeholder
        break;
      case 'victory':
        // Play victory stinger
        break;
    }
  }
}
