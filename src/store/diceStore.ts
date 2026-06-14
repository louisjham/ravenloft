import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { getEntityDiceProfile } from '../game/engine/DiceProfiles';

export type DicePhase = 
  | 'idle'              // No dice roll happening
  | 'announcing'        // Showing announcement text
  | 'waiting_for_roll'  // "Press Space to Roll" prompt (skipped for auto-rolls)
  | 'rolling'           // Die is tumbling (physics active)
  | 'settling'          // Die coming to rest
  | 'showing_result'    // Result displayed, "Press Space to continue"
  | 'dismissing';       // Scoop up animation + particles

export type DiceRollType = 
  | 'hero_attack'       // Hero attacking a monster
  | 'monster_attack'    // Monster attacking a hero
  | 'trap_disable'      // Hero trying to disable a trap (targetAC holds the DC)
  | 'ability_check'     // Monster ability conditional roll
  | 'event_attack';     // Event-attack card

export interface DiceStore {
  // State
  phase: DicePhase;
  rollType: DiceRollType | null;
  isAutoRoll: boolean;
  
  // Entity Profile
  diceColor: string;
  physicsProfile: {
    mass: number;
    friction: number;
    restitution: number;
    impulseMultiplier: number;
    dropHeight: number;
  };
  dismissEffect: string;

  // Roll Context
  rollerId: string | null;
  rollerName: string;
  targetId: string | null;
  targetName: string;
  announcementText: string;
  
  // Results
  result: number | null;
  attackBonus: number;
  targetAC: number | null;
  isHit: boolean | null;
  isCritical: boolean;
  damage: number | null;
  
  // 3D placement
  worldPosition: [number, number, number];
  
  // Callback
  _onComplete: (() => void) | null;

  // Actions
  requestRoll: (params: {
    rollType: DiceRollType;
    rollerId: string;
    rollerName: string;
    targetId?: string;
    targetName?: string;
    announcementText: string;
    attackBonus?: number;
    targetAC?: number;
    damage?: number;
    worldPosition: [number, number, number];
    isAutoRoll?: boolean;
    onComplete: () => void;
  }) => void;

  finishAnnouncement: () => void;
  playerRoll: () => void;
  settleResult: () => void;
  dismiss: () => void;
  reset: () => void;
  isActive: () => boolean;
  cancelRoll: () => void;
}

const DEFAULT_PHYSICS = {
  mass: 1,
  friction: 0.4,
  restitution: 0.35,
  impulseMultiplier: 1,
  dropHeight: 2,
};

const initialState = {
  phase: 'idle' as DicePhase,
  rollType: null,
  isAutoRoll: false,
  
  diceColor: '#cc1111',
  physicsProfile: DEFAULT_PHYSICS,
  dismissEffect: 'fire',

  rollerId: null,
  rollerName: '',
  targetId: null,
  targetName: '',
  announcementText: '',
  
  result: null,
  attackBonus: 0,
  targetAC: null,
  isHit: null,
  isCritical: false,
  damage: null,
  
  worldPosition: [0, 0, 0] as [number, number, number],
  _onComplete: null,
};

export const useDiceStore = create<DiceStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    requestRoll: (params) => {
      const profile = getEntityDiceProfile(params.rollerId, params.rollerName, params.rollType);
      
      set({
        ...initialState,
        rollType: params.rollType,
        rollerId: params.rollerId,
        rollerName: params.rollerName,
        announcementText: params.announcementText,
        worldPosition: params.worldPosition,
        targetId: params.targetId ?? null,
        targetName: params.targetName ?? '',
        attackBonus: params.attackBonus ?? 0,
        // For trap_disable, pass the trap's DC as targetAC (no attackBonus is added)
        // For attack rolls, pass the target's AC as targetAC
        targetAC: params.targetAC ?? null,
        damage: params.damage ?? null,
        isAutoRoll: params.isAutoRoll ?? false,
        phase: 'announcing',
        _onComplete: params.onComplete,
        
        diceColor: profile.color,
        physicsProfile: profile.physics,
        dismissEffect: profile.particleEffect,
      });

      // Auto transition after announcement (shorter for responsive feel)
      setTimeout(() => {
        const { phase } = get();
        if (phase === 'announcing') {
          get().finishAnnouncement();
        }
      }, 400);
    },

    finishAnnouncement: () => {
      const { isAutoRoll } = get();
      if (isAutoRoll) {
        // Skip wait step for monsters
        get().playerRoll();
      } else {
        set({ phase: 'waiting_for_roll' });
      }
    },

    playerRoll: () => {
      const state = get();
      if (state.phase !== 'waiting_for_roll' && state.phase !== 'announcing') return;

      const result = Math.floor(Math.random() * 20) + 1;
      const isCritical = result === 20;
      let isHit: boolean | null = null;
      
      if (state.targetAC !== null) {
        // For trap_disable, targetAC holds the DC (difficulty class); no attackBonus is added
        // For attack rolls, targetAC is the target's Armor Class
        if (state.rollType === 'trap_disable') {
          isHit = isCritical || (result >= state.targetAC);
        } else {
          isHit = isCritical || (result + state.attackBonus >= state.targetAC);
        }
      }

      set({
        phase: 'rolling',
        result,
        isCritical,
        isHit,
        // Override dismiss effect on crit
        dismissEffect: isCritical ? 'lightning' : state.dismissEffect,
      });
    },

    settleResult: () => {
      const { phase } = get();
      if (phase === 'rolling') {
        set({ phase: 'showing_result' });
      }
    },

    dismiss: () => {
      const { phase } = get();
      if (phase === 'showing_result') {
        set({ phase: 'dismissing' });
        
        // Auto reset after dismiss animation (shorter for responsive feel)
        setTimeout(() => {
          get().reset();
        }, 300);
      }
    },

    reset: () => {
      const { _onComplete } = get();
      if (_onComplete) {
        _onComplete();
      }
      set({ ...initialState });
    },

    isActive: () => get().phase !== 'idle',
    cancelRoll: () => {
      set({
        phase: 'idle',
        _onComplete: null,
        result: null,
        rollType: null,
      });
    },
  }))
);
