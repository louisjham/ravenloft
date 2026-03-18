import { AudioManager } from './AudioManager';

export const SoundLibrary = {
  UI: {
    click: () => AudioManager.getInstance().playSound('click'),
    hover: () => AudioManager.getInstance().playSound('hover'),
    error: () => AudioManager.getInstance().playSound('hover'), // Placeholder
  },
  Game: {
    tilePlace: () => AudioManager.getInstance().playSound('tile_place'),
    diceRoll: () => AudioManager.getInstance().playSound('dice_roll'),
    cardDraw: () => AudioManager.getInstance().playSound('card_draw'),
    cardPlay: () => AudioManager.getInstance().playSound('card_play'),
  },
  Combat: {
    hit: () => AudioManager.getInstance().playSound('sword_hit'),
    spell: () => AudioManager.getInstance().playSound('spell_cast'),
    hurt: () => AudioManager.getInstance().playSound('hero_hurt'),
    death: () => AudioManager.getInstance().playSound('monster_die'),
  }
};
