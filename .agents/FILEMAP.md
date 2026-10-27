# Castle Ravenloft - per-file catalog (src/)

Generated Oct 25, 2026 from the repo as it stands. Companion to
`.agents/CODEBASE.md`: that file is the map of layers and how they
connect; this file is the line-item index of every file under `src/`.
One line per file: path plus purpose. Paths are relative to the repo
root. If this file disagrees with the code, the code wins.
Count verified Oct 25, 2026: 211 files under src/ (CODEBASE.md says
210; this catalog covers all 211 found).

## src/ (root)

- `src/App.tsx` - App shell: composes the 3D scene, physics, controllers, and UI overlay inside an error boundary.
- `src/index.css` - Global stylesheet: gothic theme variables, fonts, and keyframe animations.
- `src/main.tsx` - Entry point: preloads models and assets, mounts App in StrictMode.
- `src/vite-env.d.ts` - Vite client type reference.

## src/audio/

- `src/audio/AudioManager.ts` - Audio playback manager class.
- `src/audio/AudioReactComponent.tsx` - React bridge component that wires audio into the render tree.
- `src/audio/MusicSystem.ts` - Music system: setup, boss, and end music scoring.
- `src/audio/SoundLibrary.ts` - Sound-effect catalog used by the audio systems.
- `src/audio/SpatialAudio.ts` - Positional (3D) audio handling.

## src/components/3d/

- `src/components/3d/Billboard3D.tsx` - Billboard sprites (heroes, monsters, villains) rendered by category.
- `src/components/3d/Card3D.tsx` - 3D card rendering on the tabletop.
- `src/components/3d/D20Geometry.ts` - D20 mesh geometry, face-to-number mapping, and number textures.
- `src/components/3d/Dice3D.tsx` - 3D die mesh; result comes from the settled face.
- `src/components/3d/DiceArena.tsx` - Dice rolling arena for thrown dice.
- `src/components/3d/DiceDismissEffect.tsx` - Dismiss animation for dice after a roll.
- `src/components/3d/DungeonBoard.tsx` - Dungeon board assembly; TavernProps3D currently unmounted from it.
- `src/components/3d/DungeonWalls.tsx` - Dungeon wall geometry around the board.
- `src/components/3d/Effects.tsx` - Visual effects: fire particles and related dressing.
- `src/components/3d/ExplorationArrow.tsx` - Arrow marking the current exploration point.
- `src/components/3d/ExplorationLayer.tsx` - Exploration interaction layer over the board.
- `src/components/3d/GamePiece.tsx` - Generic 3D game piece renderer.
- `src/components/3d/Hero3D.tsx` - 3D hero figure rendering.
- `src/components/3d/MagicalTorches.tsx` - Magical torch dressing.
- `src/components/3d/Monster3D.tsx` - 3D monster figure rendering.
- `src/components/3d/MonsterAIIndicator.tsx` - Indicator showing monster AI card/behavior state.
- `src/components/3d/PhysicsGroundPlane.tsx` - Physics ground plane and shadow catcher for the table.
- `src/components/3d/Scene.tsx` - 3D scene root (canvas content) for the game view.
- `src/components/3d/TableSurface.tsx` - Tabletop surface: warm wood finish, sized from scenario data.
- `src/components/3d/TavernProps3D.tsx` - Tavern prop dressing; kept on disk, currently unmounted.
- `src/components/3d/Tile3D.tsx` - 3D dungeon tile rendering; defines TILE_SIZE.
- `src/components/3d/Token3D.tsx` - Game tokens rendered on tiles (coffins, treasure, traps, etc.).

## src/components/3d/environment/

- `src/components/3d/environment/DungeonChamber.tsx` - Dungeon chamber dressing; WallTorches and HangingSkeletons currently unmounted from it.
- `src/components/3d/environment/GothicBookshelf.tsx` - Gothic bookshelf dressing prop.
- `src/components/3d/environment/HangingSkeleton.tsx` - Hanging skeleton dressing prop; kept on disk, currently unmounted.
- `src/components/3d/environment/WallTorch.tsx` - Wall torch dressing prop; kept on disk, currently unmounted.
- `src/components/3d/environment/WeaponRack.tsx` - Weapon rack dressing prop.

## src/components/effects/

- `src/components/effects/Transitions.tsx` - Scene, turn, and phase transition animations.

## src/components/interaction/

- `src/components/interaction/CompanionAIController.tsx` - Controller for companion AI behavior in the scene.
- `src/components/interaction/EntityInteraction.tsx` - Click/hover interaction handling for entities.
- `src/components/interaction/GameController.tsx` - Central interaction controller for gameplay input.
- `src/components/interaction/TileInteraction.tsx` - Tile click/placement interaction handling.

## src/components/settings/

- `src/components/settings/AudioSettings.tsx` - Audio settings panel.

## src/components/tutorial/

- `src/components/tutorial/TutorialSystem.tsx` - Tutorial overlay, tooltips, and F1 Quick Reference modal.

## src/components/ui/

- `src/components/ui/ActionBar.tsx` - Hero action bar (available actions for the active hero).
- `src/components/ui/ActionPrompt.tsx` - Prompt panel for the current required action.
- `src/components/ui/ActionPromptAnimated.tsx` - Animated variant of the action prompt.
- `src/components/ui/CardHand.tsx` - Player card hand display.
- `src/components/ui/CombatEncounterView.css` - Styles for the slim combat HUD.
- `src/components/ui/CombatEncounterView.tsx` - Slim HUD shown during ongoing combat; clicks pass through to the board.
- `src/components/ui/CombatLog.tsx` - Combat log display.
- `src/components/ui/ConditionMarkers.tsx` - Condition icons for entities (stunned, poisoned, slowed, etc.).
- `src/components/ui/Dialog.tsx` - Generic dialog component.
- `src/components/ui/DiceAnnouncementOverlay.css` - Styles for the dice announcement overlay.
- `src/components/ui/DiceAnnouncementOverlay.tsx` - Overlay announcing dice results.
- `src/components/ui/EncounterCardOverlay.css` - Styles for the right-side encounter card panel.
- `src/components/ui/EncounterCardOverlay.tsx` - Right-side panel for encounter card resolution (advance, target, dismiss, cancel).
- `src/components/ui/ExperiencePanel.tsx` - Experience pile and leveling display.
- `src/components/ui/FortuneResolutionModal.tsx` - Modal for resolving fortune card effects.
- `src/components/ui/HallOfHeroesOverlay.tsx` - Hall of Heroes overlay (hero selection/review).
- `src/components/ui/HeroPanel.tsx` - Active hero status panel.
- `src/components/ui/LoadJourneyOverlay.tsx` - Saved-journey load overlay.
- `src/components/ui/MainMenu.tsx` - Main menu screen.
- `src/components/ui/MovablePanel.tsx` - Draggable/movable panel container.
- `src/components/ui/OptionsOverlay.tsx` - Options overlay (game options).
- `src/components/ui/PartySidebar.tsx` - Party sidebar showing all heroes.
- `src/components/ui/PauseMenu.tsx` - Pause menu.
- `src/components/ui/PowerCardDisplay.tsx` - Power card display component.
- `src/components/ui/PowerSelectionScreen.tsx` - Level-up power selection screen.
- `src/components/ui/RotationPicker.tsx` - Tile rotation picker during placement.
- `src/components/ui/ScenarioIntro.tsx` - Scenario introduction display.
- `src/components/ui/ScenarioPanel.tsx` - Scenario status panel.
- `src/components/ui/ScenarioSetupScreen.tsx` - Scenario setup screen (hero/scenario selection).
- `src/components/ui/SettingsPanel.tsx` - Settings panel.
- `src/components/ui/TargetSelection.tsx` - Target picker plus getLegalTargets helper.
- `src/components/ui/TreasureCardPanel.tsx` - Treasure card panel: view and use assigned treasure cards.
- `src/components/ui/TurnIndicator.tsx` - Current turn/phase indicator.
- `src/components/ui/UIOverlay.tsx` - Composition of the 2D UI overlay layers.
- `src/components/ui/VictoryScreen.tsx` - Victory screen.
- `src/components/ui/VillainPhaseOverlay.tsx` - Villain phase card display (active villain, queue progress).
- `src/components/ui/XRControlsOverlay.tsx` - XR controls overlay.

## src/components/ui/cards/

- `src/components/ui/cards/CardFace.tsx` - Card face/back rendering (front art, card backs by type).
- `src/components/ui/cards/CardFlip.tsx` - Card flip animation wrapper around CardFace.

## src/contexts/

- `src/contexts/TilePlacementContext.tsx` - React context and hook for tile placement state.

## src/data/

- `src/data/audioManifest.json` - Audio manifest: 2 music tracks, 10 sound effects, 1 ambient loop (dungeon_loop).
- `src/data/billboardAssets.ts` - Billboard image asset map and lookups by category, hero, monster, villain.
- `src/data/boss-phases.json` - Boss phase tables for 3 bosses: Strahd, Vampire Lord, Young Red Dragon.
- `src/data/heroes.json` - 5 hero definitions.
- `src/data/monsters.json` - 61 engine monster definitions (stats, abilities, behavior).
- `src/data/powerCardLoader.ts` - Power-card lookup API (all cards, by hero, by type).
- `src/data/powerCards.json` - 50 power cards.
- `src/data/scenarios.json` - 3 legacy scenario entries (older format; current scenarios live in data/scenarios/).
- `src/data/tiles.json` - 41 tile definitions, each with a boneSquare at (1,1).
- `src/data/tokenMap.ts` - Token-id to image-asset maps (coffin, monster, encounter, item, condition, HP, surge, reaction, marker, adventure, misc).

## src/data/cards/

- `src/data/cards/encounters.json` - 56 encounter card entries (mechanics only; no flavorText field - verified flavor text lives in card-source-truth).
- `src/data/cards/items.json` - 15 item card entries.
- `src/data/cards/monsters.json` - 72 monster card entries (spawn/effect cards, distinct from the 61 engine monster definitions).
- `src/data/cards/treasures.json` - 61 treasure card entries.

## src/data/cards/hero-abilities/

- `src/data/cards/hero-abilities/alissa.json` - 2 ability cards for Alissa.
- `src/data/cards/hero-abilities/arjhan.json` - 2 ability cards for Arjhan.
- `src/data/cards/hero-abilities/immeril.json` - 2 ability cards for Immeril.
- `src/data/cards/hero-abilities/kat.json` - 2 ability cards for Kat (Backstab, Stealth).
- `src/data/cards/hero-abilities/thorgrim.json` - 2 ability cards for Thorgrim.

## src/data/scenarios/

- `src/data/scenarios/adventure_01.json` - Scenario: Escape the Tomb (Easy) - find the Secret Stairway tile.
- `src/data/scenarios/adventure_02.json` - Scenario: Find the Icon of The Shadowhold (Medium) - find the hidden Chapel.
- `src/data/scenarios/adventure_03.json` - Scenario: Klak's Infernal Artifact (Hard) - defeat Klak and destroy the artifact.
- `src/data/scenarios/adventure_04.json` - Scenario: Daylight Assault (Medium) - collect 12 treasure cards and escape.
- `src/data/scenarios/adventure_05.json` - Scenario: The Final Transformation (Hard) - find the Dark Fountain and cure Kavan.
- `src/data/scenarios/adventure_06.json` - Scenario: Destroy the Dracolich (Hard) - find the Arcane Circle and defeat Varkath.
- `src/data/scenarios/adventure_07.json` - Scenario: Adventure Impossible (Hard) - three villains with lair packets; 0 surges.
- `src/data/scenarios/adventure_08.json` - Scenario: Horror of the Howling Hag (Hard) - find companions, defeat the Hag.
- `src/data/scenarios/adventure_09.json` - Scenario: Gauntlet of Terror (Medium) - prevent monsters escaping into the dungeon.
- `src/data/scenarios/adventure_10.json` - Scenario: Blood and Fog (Medium) - escape through the Secret Stairway.
- `src/data/scenarios/adventure_11.json` - Scenario: Rampaging Golem (Medium) - destroy or pacify the Flesh Golem.
- `src/data/scenarios/adventure_12.json` - Scenario: The Hunt for Nekrula, Part 1 (Hard) - defeat Nekrula's bodyguard.
- `src/data/scenarios/adventure_13.json` - Scenario: The Hunt for Nekrula, Part 2 (Hard) - find Nekrula's crypt and destroy him.
- `src/data/scenarios/adventure_tome_of_strahd.json` - Scenario: The Tome of Nekrula (Hard) - find the Tome treasure.
- `src/data/scenarios/scenario1.json` - Scenario: Find Nekrula's Coffin (Easy).
- `src/data/scenarios/scenario2.json` - Scenario: Reset the Beacon (Medium).
- `src/data/scenarios/scenario3.json` - Scenario: Escape the Dungeon (Hard) - 1 surge.
- `src/data/scenarios/scenario4.json` - Scenario: The Hunt for the Crown (Medium).
- `src/data/scenarios/scenario5.json` - Scenario: Rescue the Adventurer (Hard).

## src/game/

- `src/game/constants.ts` - Core game constants and id lists (phases, card ids, scenario ids, tile ids).
- `src/game/dataLoader.ts` - DataLoader: loads the JSON game data for the engine.
- `src/game/types.ts` - Shared game types: conditions, powers, treasures, encounters, entities, positions, tiles, cards.

## src/game/ai/

- `src/game/ai/AbilitySystem.ts` - Pure monster ability execution (no mutation, no side effects).
- `src/game/ai/BossPhases.ts` - Boss phase logic.
- `src/game/ai/MonsterAI.ts` - Monster decision-making (class-level AI coordinator).
- `src/game/ai/Pathfinding.ts` - Pathfinding for monster movement.
- `src/game/ai/ThreatAssessment.ts` - Threat assessment for monster targeting decisions.

## src/game/ai/behaviors/

- `src/game/ai/behaviors/AbilityLibrary.ts` - Ability lookup table and getter.
- `src/game/ai/behaviors/BossTactics.ts` - Boss tactics definitions and getter.
- `src/game/ai/behaviors/GargoyleBehavior.ts` - Gargoyle monster behavior.
- `src/game/ai/behaviors/GhostBehavior.ts` - Ghost monster behavior.
- `src/game/ai/behaviors/GoblinBehavior.ts` - Goblin monster behavior.
- `src/game/ai/behaviors/SkeletonBehavior.ts` - Skeleton monster behavior.
- `src/game/ai/behaviors/StrahdBehavior.ts` - Strahd (villain) behavior.
- `src/game/ai/behaviors/VampireBehavior.ts` - Vampire monster behavior.
- `src/game/ai/behaviors/WolfBehavior.ts` - Wolf monster behavior.
- `src/game/ai/behaviors/ZombieBehavior.ts` - Zombie monster behavior.

## src/game/engine/

- `src/game/engine/ActionResolver.ts` - Resolves hero/monster actions into state changes.
- `src/game/engine/CardResolutionSystem.ts` - Card effect resolution state machine.
- `src/game/engine/CombatAdapter.ts` - Adapter between combat resolution and the dice/store layer.
- `src/game/engine/CombatEncounterSystem.ts` - Combat-encounter flow (combat triggered by encounters).
- `src/game/engine/CombatSystem.ts` - Core combat: attacks, damage, defeat.
- `src/game/engine/ConditionSystem.ts` - Condition application, expiry, and effects.
- `src/game/engine/DiceProfiles.ts` - Single source of truth for dice physics profiles per entity.
- `src/game/engine/EncounterSystem.ts` - Encounter draw and resolution, including advanceCardResolution and cancel paths.
- `src/game/engine/ExperienceSystem.ts` - Experience pile, leveling, and power unlocks.
- `src/game/engine/ExplorationStateMachine.ts` - Tile exploration/placement state machine (rotation, placement attempts, redraw).
- `src/game/engine/HeroTurnUtils.ts` - Hero turn-flag resets.
- `src/game/engine/LogUtils.ts` - Chronicle log entry helpers and encounter outcome formatting.
- `src/game/engine/MonsterAI.ts` - Engine-side monster helpers: distance, line of sight, adjacency, tactics, trap resolution (pure functions).
- `src/game/engine/PowerSelectionSystem.ts` - Level-up power selection constraints and validation.
- `src/game/engine/PowerSystem.ts` - Power card execution.
- `src/game/engine/TileSystem.ts` - Tile placement, rotation, boneSquare handling, and exploration monster spawns.
- `src/game/engine/TokenSystem.ts` - Token placement on explored tiles, search action, coffin reveal logic.
- `src/game/engine/TreasureSystem.ts` - Treasure draw, assignment, and use.
- `src/game/engine/tabletopDimensions.ts` - Data-derived tabletop sizing from scenario tile piles (48-unit / 12x12 minimum).

## src/game/progression/

- `src/game/progression/SaveSystem.ts` - Save slots and journey persistence.

## src/game/scenarios/

- `src/game/scenarios/Events.ts` - Scenario event system.
- `src/game/scenarios/Objectives.ts` - Scenario objective tracking.
- `src/game/scenarios/ScenarioManager.ts` - Loads a scenario; owns start and lair tiles.

## src/hooks/

- `src/hooks/useCardResolution.ts` - Hook bridging card resolution state to components.
- `src/hooks/useCombatEncounterEvaluator.ts` - Hook evaluating combat-encounter state for display.
- `src/hooks/useExplorationControls.ts` - Hook for exploration/placement controls.
- `src/hooks/useGameActions.ts` - Hook exposing game actions to components.
- `src/hooks/useGameTransition.ts` - Hook for timed game transitions.
- `src/hooks/useKeyboard.ts` - Keyboard input handling hook.
- `src/hooks/useSelection.ts` - Selection state hook.
- `src/hooks/useTreasurePanel.ts` - Hook for treasure panel state.

## src/store/

- `src/store/diceStore.ts` - Zustand store for dice state (phase, roll type).
- `src/store/gameStore.ts` - Main Zustand game store.
- `src/store/storeTypes.ts` - Store slice interfaces (combat, card, power, condition, token, core).
- `src/store/uiStore.ts` - Zustand UI store (modals, interaction mode).

## src/store/slices/

- `src/store/slices/cardSlice.ts` - Card slice: card resolution state, including dismissCardResolution.
- `src/store/slices/combatSlice.ts` - Combat slice of game state.
- `src/store/slices/conditionSlice.ts` - Condition slice of game state.
- `src/store/slices/coreSlice.ts` - Core slice of game state (turn, phase, entities).
- `src/store/slices/powerSlice.ts` - Power slice of game state.
- `src/store/slices/tokenSlice.ts` - Token slice of game state.
- `src/store/slices/villainPhaseLogic.ts` - Villain phase: queue building, activation, trap results.

## src/testing/

- `src/testing/ability-system-tests.ts` - AbilitySystem/BossPhases tests plus test-state factories.
- `src/testing/blessing-mechanics-tests.ts` - Blessing mechanics test runner.
- `src/testing/integrationTests.ts` - Integration tests: full game loop, treasure system, AI stress, card expansion.
- `src/testing/test-villain-phase.ts` - Villain phase logic check.
- `src/testing/testUtils.ts` - Test utilities: console capture helpers.
- `src/testing/tile-placement-diagnostics.ts` - Tile placement diagnostics generator and logger.

## src/utils/

- `src/utils/accessibility.ts` - Accessibility: colorblind modes, screen reader announcements, high contrast, key bindings.
- `src/utils/animationQueue.ts` - Animation queue for sequencing visual effects.
- `src/utils/assetPreloader.ts` - Preloads key textures/assets at startup.
- `src/utils/devEnv.ts` - Dev-environment detection (isDev).
- `src/utils/errorHandling.tsx` - Global error boundary and game error logging.
- `src/utils/modelLoader.ts` - Hero/monster model paths, model hooks, preloading.
- `src/utils/performance.ts` - Performance: FPS counter, entity pooling, LOD, texture paths.
- `src/utils/shuffle.ts` - Array shuffle helper.

## src/xr/

- `src/xr/XRHaptics.ts` - WebXR gamepad haptic feedback profiles (Quest Touch controllers).
- `src/xr/XRInteractionBridge.tsx` - Bridge between XR interaction and game actions.
- `src/xr/XRTabletopRig.tsx` - XR tabletop rig (table anchoring in AR space).

## src/xr/cards/

- `src/xr/cards/CardHandDock3D.tsx` - 3D card hand dock in XR space.
- `src/xr/cards/CardTextureGenerator.ts` - Card image path and texture lookups (fronts and backs).
- `src/xr/cards/PhysicalCard3D.tsx` - Grabbable physical card in XR space.
- `src/xr/cards/SpatialCardPresenter3D.tsx` - Spatial card presenter for XR display.
- `src/xr/cards/SpatialFortuneDialog3D.tsx` - Spatial fortune dialog in XR space.

## src/xr/hud/

- `src/xr/hud/XRTabletopHUD3D.tsx` - XR tabletop HUD.

## src/xr/menus/

- `src/xr/menus/XRMainMenu3D.tsx` - XR main menu.
- `src/xr/menus/XRSetupStage3D.tsx` - XR setup stage (game setup in AR space).

## src/xr/unboxing/

- `src/xr/unboxing/GrabbableBox3D.tsx` - Grabbable box for the unboxing sequence.
- `src/xr/unboxing/GrabbablePiece3D.tsx` - Grabbable game piece for the unboxing sequence.
- `src/xr/unboxing/PhysicalTile3D.tsx` - Physical tile for the unboxing sequence.
- `src/xr/unboxing/PhysicalToken3D.tsx` - Physical token for the unboxing sequence.
- `src/xr/unboxing/XRUnboxingStage3D.tsx` - Unboxing stage orchestrating the XR unboxing sequence.
