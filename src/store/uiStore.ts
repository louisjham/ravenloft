import { create } from 'zustand'
import type { ExplorationState } from '../game/engine/ExplorationStateMachine';

export type ModalType = 'none' | 'scenario_intro' | 'victory' | 'defeat' | 'settings' | 'tutorial' | 'help' | 'experience';

export type InteractionMode = 'none' | 'move' | 'attack' | 'ability' | 'explore';
export type AREntryStage = 'idle' | 'loading' | 'transitioning' | 'guidance' | 'complete';

interface Notification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
}

const DEFAULT_CAMERA = {
  position: [10, 10, 10] as [number, number, number],
  target: [0, 0, 0] as [number, number, number],
  zoom: 1,
  rotation: 0,
};

interface UIStore {
  // State
  activeModal: ModalType
  notifications: Notification[]
  cameraState: {
    position: [number, number, number]
    target: [number, number, number]
    zoom: number
    rotation: number
  }
  isTransitioning: boolean
  tilePlacementError: string | null
  pendingTileRotation: 0 | 90 | 180 | 270
  showTilePlacer: boolean
  interactionMode: InteractionMode
  selectedPowerId: string | null
  hoveredTargetEntityId: string | null
  explorationState: ExplorationState
  isUnboxingMode: boolean
  isXRPresenting: boolean
  showSetupScreen: boolean
  arEntryStage: AREntryStage
  arDirectionStep: number
  arDirectionDismissed: boolean
  xrTableTransform: {
    position: [number, number, number]
    rotationY: number
    scale: number
  }
  xrTableResetRequested: boolean
  resetAllVersion: number
  resetAllRequested: boolean
  requestResetAll: () => void
  clearResetAllRequest: () => void

  // Actions
  setIsUnboxingMode: (enabled: boolean) => void
  setIsXRPresenting: (presenting: boolean) => void
  setShowSetupScreen: (show: boolean) => void
  setAREntryStage: (stage: AREntryStage) => void
  setARDirectionStep: (step: number) => void
  dismissARDirection: () => void
  resetAREntry: () => void
  setXRTableTransform: (transform: { position: [number, number, number]; rotationY: number; scale: number }) => void
  requestXRTableReset: () => void
  clearXRTableResetRequest: () => void
  setExplorationState: (state: ExplorationState) => void
  setInteractionMode: (mode: InteractionMode) => void
  setSelectedPowerId: (id: string | null) => void
  setHoveredTargetEntityId: (id: string | null) => void
  setTilePlacementError: (error: string | null) => void
  rotatePendingTile: () => void
  openTilePlacer: () => void
  closeTilePlacer: () => void
  showModal: (modal: ModalType) => void
  hideModal: () => void
  addNotification: (message: string, type?: Notification['type'], duration?: number) => void
  removeNotification: (id: string) => void

  updateCamera: (updates: Partial<UIStore['cameraState']>) => void
  resetCamera: () => void
  startTransition: () => void
  endTransition: () => void
}

export const useUIStore = create<UIStore>()((set) => ({
  activeModal: 'none',
  isUnboxingMode: false,
  isXRPresenting: false,
  showSetupScreen: false,
  arEntryStage: 'idle',
  arDirectionStep: 1,
  arDirectionDismissed: false,
  setIsXRPresenting: (presenting) => set((state) => ({
    isXRPresenting: presenting,
    // When entering XR from desktop, reset AR entry sequence if idle
    arEntryStage: presenting ? (state.arEntryStage === 'idle' ? 'loading' : state.arEntryStage) : 'idle',
    arDirectionDismissed: presenting ? state.arDirectionDismissed : false,
  })),
  setShowSetupScreen: (show) => set({ showSetupScreen: show }),
  setAREntryStage: (stage) => set({ arEntryStage: stage }),
  setARDirectionStep: (step) => set({ arDirectionStep: step }),
  dismissARDirection: () => set({ arDirectionDismissed: true }),
  resetAREntry: () => set({ arEntryStage: 'idle', arDirectionStep: 1, arDirectionDismissed: false }),
  setIsUnboxingMode: (enabled) => set({ isUnboxingMode: enabled }),
  xrTableTransform: {
    position: [0, 0.75, -1.0],
    rotationY: 0,
    scale: 0.08,
  },
  xrTableResetRequested: false,
  resetAllVersion: 0,
  resetAllRequested: false,
  setXRTableTransform: (transform) => set({ xrTableTransform: transform }),
  requestResetAll: () => set((state) => ({
    resetAllVersion: state.resetAllVersion + 1,
    resetAllRequested: true,
    xrTableResetRequested: true,
    arDirectionDismissed: false,
  })),
  clearResetAllRequest: () => set({ resetAllRequested: false, xrTableResetRequested: false }),
  requestXRTableReset: () => set((state) => ({
    resetAllVersion: state.resetAllVersion + 1,
    resetAllRequested: true,
    xrTableResetRequested: true,
    arDirectionDismissed: false,
  })),
  clearXRTableResetRequest: () => set({ resetAllRequested: false, xrTableResetRequested: false }),
  notifications: [],
  cameraState: { ...DEFAULT_CAMERA },
  isTransitioning: false,
  tilePlacementError: null,
  pendingTileRotation: 0,
  showTilePlacer: false,
  interactionMode: 'none',
  selectedPowerId: null,
  hoveredTargetEntityId: null,
  explorationState: { phase: 'idle' },

  setExplorationState: (state) => set({ explorationState: state }),
  setInteractionMode: (mode) => set({ interactionMode: mode }),
  setSelectedPowerId: (id) => set({ selectedPowerId: id }),
  setHoveredTargetEntityId: (id) => set({ hoveredTargetEntityId: id }),
  setTilePlacementError: (error) => set({ tilePlacementError: error }),
  
  rotatePendingTile: () => set((state) => ({ 
    pendingTileRotation: ((state.pendingTileRotation + 90) % 360) as 0 | 90 | 180 | 270,
    tilePlacementError: null
  })),

  openTilePlacer: () => set({
    showTilePlacer: true,
    pendingTileRotation: 0,
    tilePlacementError: null
  }),

  closeTilePlacer: () => set({
    showTilePlacer: false,
    pendingTileRotation: 0,
    tilePlacementError: null
  }),

  showModal: (modal) => set({ activeModal: modal }),
  hideModal: () => set({ activeModal: 'none' }),

  addNotification: (message, type = 'info', duration) => {
    const id = crypto.randomUUID();
    const notification = { id, message, type, duration };
    set((state) => ({
      notifications: [...state.notifications, notification]
    }));

    setTimeout(() => {
      set((state) => ({
        notifications: state.notifications.filter(n => n.id !== id)
      }));
    }, notification.duration ?? 5000);
  },

  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id)
  })),

  updateCamera: (updates) => set((state) => ({
    cameraState: { ...state.cameraState, ...updates }
  })),

  resetCamera: () => set({
    cameraState: { ...DEFAULT_CAMERA }
  }),

  startTransition: () => set({ isTransitioning: true }),
  endTransition: () => set({ isTransitioning: false })
}))
