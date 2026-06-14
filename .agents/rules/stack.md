## Stack Contract
- React 18 functional components only. No class components.
- TypeScript strict mode is ON. Never use `any`. Prefer `unknown` with narrowing.
- Three.js version is ^0.169.0. Import from `three` directly; never use CDN globals.
- Use @react-three/fiber for ALL scene composition. Never manipulate Three.js objects
  imperatively outside of `useFrame` or `useEffect` with proper ref guards.
- Use @react-three/drei helpers over hand-rolling equivalents (e.g., use `<Html>`,
  `<useGLTF>`, `<Environment>` from drei before implementing from scratch).
- Physics via @react-three/cannon only. Do not introduce rapier or any other engine.
- Post-processing effects via @react-three/postprocessing only.
- State: game logic in gameStore.ts (sliced Zustand), UI overlays in uiStore.ts only.
  Never add game state to uiStore, never add UI state to gameStore.