<img width="1002" height="550" alt="image" src="https://github.com/user-attachments/assets/79bf9ba8-6d1b-4370-b8d5-e8c26513c3c8" />

<img width="1584" height="873" alt="image" src="https://github.com/user-attachments/assets/c351c160-39de-45ae-a8e4-e840e003dfc4" />

<img width="876" height="586" alt="image" src="https://github.com/user-attachments/assets/ca0a128a-4197-4638-98af-444b8d3dbf1b" />

<img width="558" height="633" alt="image" src="https://github.com/user-attachments/assets/e3e595b3-95cc-4c16-a9c0-4df2bd6de918" />

Castle Ravenloft 3D 🧛🏰
An immersive, fully-featured 3D digital tabletop adaptation of the classic cooperative board game Dungeons & Dragons: Castle Ravenloft. Built with React, TypeScript, Three.js (React Three Fiber), Cannon-es physics, and Zustand.

This project translates the physical board game mechanics—such as modular tile exploration, tactical hero and monster turn phases, card draws, combat rolls, and Campaign scenarios—into a polished, responsive 3D web experience complete with dynamic lighting, gothic design aesthetics, and a deterministic AI engine.

🌌 Project Overview
Castle Ravenloft 3D lets you control a band of legendary heroes exploring the crypts of Barovia, fighting deadly monsters, disarming traps, and confronting Count Strahd von Zarovich himself. The game board is generated dynamically as you explore, placing and rotating tiles in real-time. Action is split between tactical movement/combat and resolving high-stakes encounter and treasure card drafts.

🎥 Key Game Mechanics
Modular Dungeon Exploration: Draw and place tiles dynamically. The game checks for valid rotations, blocks placements when overlapping existing layout coordinates, and detects deck exhaustion.
Complete Rules Engine: Implements the full board game loop (Hero Phase -> Exploration Phase -> Villain Phase), level-up progression, healing surges, traps, and status conditions (like frightened, poisoned, or immobilized).
Tactical Monster AI: Enemy behaviors are modeled as pure functions. Monsters pathfind towards heroes, verify lines of sight, select optimal tactics (melee attacks, ranged blasts, healing), and dynamically shift behaviors when transitioning between boss phases (e.g., Count Strahd changing tactics when falling under 50% HP).
Campaign Scenarios: Includes full digital rules and objectives for all 13 official adventures from the board game plus 5 custom scenarios (such as Find the Icon of Ravenloft, Reset the Beacon, Klak's Infernal Artifact, and Daylight Assault).
Power Card Selection: A complete interface for choosing and confirming At-Will, Utility, and Daily powers for 5 distinct hero classes matching official rules limits.
🎨 Visuals & Gothic Theme
The UI is designed to feel dark, premium, and atmospheric:

Color Palette: HSL-tailored colors featuring a deep void background (#050505), blood-red accents (#8b0000), and antique gold highlights (#c0a060).
Typography: Gothic and medieval fonts loaded from Google Fonts:
Gothic Headers: Cinzel
Accent Callouts: MedievalSharp
Body Copy: Outfit
Dynamic Panels: UI containers utilize .gothic-panel styles featuring glare overlays, sleek crimson border glows, and custom gothic scrollbars.
Positional 3D elements: Includes custom procedural fallbacks, 3D animated dice rolls (D20 physics calculations), torch fire particles, and dynamic shadows.
🛠️ Tech Stack & Key Libraries
Core Framework: React 18 + TypeScript 5
Build System: Vite 5
3D Engine: React Three Fiber (R3F) & Three.js
Physics Engine: Cannon-es & @react-three/cannon
State Management: Zustand 4 (integrated with subscribeWithSelector middleware for optimized reactive renders)
Audio System: Custom HTML5 Audio manager driving atmospheric loops and positional game triggers.
Styling: Vanilla CSS & CSS Variables for total graphic flexibility without the overhead of utility utility-first libraries.
📁 Repository Structure

castle-ravenloft-3d/
├── .agents/                 # AI agent execution configurations
├── docs/                    # Game documentation, rules guides, audits
├── public/                  # Static assets
│   ├── audio/               # Ambient gothic tracks and sound effects
│   └── models/              # GLB models for heroes, monsters, and environments
├── src/
│   ├── assets/              # Shared visual assets and global styles
│   ├── audio/               # AudioReact components and HTML5 Audio API drivers
│   ├── components/
│   │   ├── 3d/              # R3F components (Scene, Tiles, Heroes, Monsters, Dice, Torches)
│   │   ├── effects/         # Custom UI transitions and fade effects
│   │   ├── interaction/     # 3D interaction logic and mouse/keyboard controllers
│   │   ├── settings/        # Settings and debug panels
│   │   ├── tutorial/        # Dynamic in-game help overlays and tutorial panels
│   │   └── ui/              # HUD (Action Bar, Sidebars, Cards, Modals, Overlays)
│   ├── contexts/            # React Context bindings (e.g., TilePlacementContext)
│   ├── data/                # Hardcoded database JSONs (Heroes, Monsters, Tiles, Cards)
│   ├── game/
│   │   ├── ai/              # Monster tactics, behavior trees, and boss phase logic
│   │   ├── engine/          # Pure functions for Combat, Tiles, Treasures, and Encounters
│   │   ├── scenarios/       # Objective trackers and special scenario rules
│   │   └── types.ts         # Global TypeScript interface definitions
│   ├── hooks/               # Custom hooks (game actions, controls, transitions)
│   ├── store/               # Zustand sliced game store definitions
│   ├── testing/             # Node.js integration tests and diagnostics tools
│   ├── utils/               # Model loaders, error boundaries, and helpers
│   ├── App.tsx              # Application layout root
│   ├── main.tsx             # DOM entrypoint
│   └── index.css            # Gothic stylesheet variables and keyframe animations
├── runTests.ts              # Node test runner entrypoint
├── tsconfig.json            # Strict TypeScript configuration
└── vite.config.ts           # Vite server configuration
⚡ Architecture & Code Patterns
1. Pure Game Engine Functions
To maximize maintainability and avoid side-effect bugs, game systems are separated from the state wrapper. Core mechanics are implemented as pure static functions within dedicated engine classes:

TileSystem: Coordinates tile coords assignment, edge connections, and valid rotations.
CombatSystem: Resolves hit chances, damage applications, and experience gain.
MonsterAI: Calculates pathfinding (Manhattan Distance, BFS tile graphs), line-of-sight checks, and tactics triggers.
AbilitySystem: Evaluates triggers, target counts, and effects (such as healing and condition markers).
These systems take a read-only GameState object, perform computations, and return a new state snapshot without mutating original values.

2. Slices State Pattern (Zustand)
Game state is managed via a single Zustand store built from specialized slices:

coreSlice (turn phases, active hero tracking, game state initialization)
combatSlice (attack actions, XP pile, combat logging)
cardSlice (drawing, revealing, and resolving Encounter and Treasure cards)
powerSlice (hero card select limits, Daily/Utility powers cooldown states)
conditionSlice (condition markers lifetime tracking)
tokenSlice (spawning, searching, and updating brazier/coffin tokens)
Stores utilize the subscribeWithSelector middleware to ensure component re-renders are triggered only by fine-grained selector modifications.

3. Asset Resilience (DUMMY_MODE)
To facilitate smooth development across varying environments, the system features a robust Asset Resilience Fallback:

A global DUMMY_MODE flag (configured via VITE_DUMMY_MODE in Vite env) toggles asset loading.
When DUMMY_MODE is active, the engine bypasses heavy .glb model loads and audio files.
Components procedural fallbacks (Cylinders for heroes, Boxes for tiles, Spheres for tokens) are generated instantly, allowing full gameplay testing without setting up the full asset compilation pipeline.
🧪 Testing Suite
The project features a comprehensive integration testing suite that executes completely inside a headless Node environment.

Test Entry Point: 
runTests.ts
 at the root level.
What is verified:
Full game loop setup and player actions.
Tile rotation, connection graphs, and edge boundaries.
Monster AI behaviors, path chasers, and line of sight.
Trap placements and trigger damage.
Cooldown timers and daily power flipping.
All 13 adventures and custom scenarios triggers (coffin searches, boss phase shifts).
Explicit verify parameters to guarantee that state operations do not mutate previous store configurations.
Run the test suite using:

bash

npx tsx runTests.ts
🚀 Getting Started
Prerequisites
Node.js (v18 or higher recommended)
npm (packaged with Node)
Installation
Clone the repository and install all dependencies:

bash

npm install
Running the Development Server
Launch the local Vite server (running on port 3000 by default):

bash

npm run dev
Running Type-checking
Validate strict TypeScript compilation across the project:

bash

npm run typecheck
Building for Production
Compile TypeScript and bundle assets for optimized hosting:

bash

npm run build
Preview the production build locally:

bash

npm run preview
