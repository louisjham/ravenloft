import { create } from 'zustand'

export type ModalType = 'none' | 'scenario_intro' | 'victory' | 'defeat' | 'settings' | 'tutorial' | 'help' | 'experience';

interface Notification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
}

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

  // Actions
  setTilePlacementError: (error: string | null) => void
  rotatePendingTile: () => void
  openTilePlacer: () => void
  closeTilePlacer: () => void
  showModal: (modal: ModalType) => void
  hideModal: () => void
  addNotification: (message: string, type?: Notification['type']) => void
  removeNotification: (id: string) => void

  updateCamera: (updates: Partial<UIStore['cameraState']>) => void
  resetCamera: () => void
  startTransition: () => void
  endTransition: () => void
}

export const useUIStore = create<UIStore>()((set) => ({
  activeModal: 'none',
  notifications: [],
  cameraState: {
    position: [10, 10, 10],
    target: [0, 0, 0],
    zoom: 1,
    rotation: 0
  },
  isTransitioning: false,
  tilePlacementError: null,
  pendingTileRotation: 0,
  showTilePlacer: false,

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

  addNotification: (message, type = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    set((state) => ({
      notifications: [...state.notifications, { id, message, type }]
    }));

    // Auto remove after 5s
    setTimeout(() => {
      set((state) => ({
        notifications: state.notifications.filter(n => n.id !== id)
      }));
    }, 5000);
  },

  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id)
  })),

  updateCamera: (updates) => set((state) => ({
    cameraState: { ...state.cameraState, ...updates }
  })),

  resetCamera: () => set({
    cameraState: {
      position: [10, 10, 10],
      target: [0, 0, 0],
      zoom: 1,
      rotation: 0
    }
  }),

  startTransition: () => set({ isTransitioning: true }),
  endTransition: () => set({ isTransitioning: false })
}))
