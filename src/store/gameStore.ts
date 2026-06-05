import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { GameStore } from './storeTypes';
import { createCoreSlice } from './slices/coreSlice';
import { createCombatSlice } from './slices/combatSlice';
import { createCardSlice } from './slices/cardSlice';
import { createPowerSlice } from './slices/powerSlice';
import { createConditionSlice } from './slices/conditionSlice';
import { createTokenSlice } from './slices/tokenSlice';

export const useGameStore = create<GameStore>()(
  subscribeWithSelector((...a) => ({
    ...createCoreSlice(...a),
    ...createCombatSlice(...a),
    ...createCardSlice(...a),
    ...createPowerSlice(...a),
    ...createConditionSlice(...a),
    ...createTokenSlice(...a),
  }))
);
