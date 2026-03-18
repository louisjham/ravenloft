# Castle Ravenloft 3D - Prompt Series Quick Guide

## Overview

This document provides a quick reference for using the agent prompt series located in `/home/z/my-project/agents.md`.

## Prompt Sequence Summary

| Prompt | Name | Purpose | Output |
|--------|------|---------|--------|
| 0 | System Instructions | Set expert domain, lock design decisions | Agent context |
| 1 | Project Scaffolding | Create project structure | Working empty app |
| 2 | Data Structures | Define all game data as JSON | Typed data layer |
| 3 | Game Rules Engine | Implement core mechanics | Text-playable game |
| 4 | 3D Rendering | Build visual scene | Rendered game board |
| 5 | User Interface | Create UI overlays | Complete HUD |
| 6 | State Management | Connect UI to engine | Interactive game |
| 7 | AI & Monster Behavior | Implement enemy intelligence | Challenging AI |
| 8 | Audio System | Add sound & music | Immersive audio |
| 9 | Scenarios | Implement all 5 scenarios | Complete content |
| 10 | Polish & Integration | Optimize and finalize | Production-ready |

## How to Use

### Starting Fresh
1. Read `agents.md` completely
2. Run Prompt 0 to set agent context
3. Execute prompts 1-10 in order
4. Update execution log after each prompt

### Continuing Work
1. Read `agents.md` to understand current state
2. Check "EXECUTION LOG" section for completed prompts
3. Run the next pending prompt
4. Update execution log with new completion

### Context Preservation
After each prompt execution, the agent should update `agents.md` with:
- Completed status
- Files created/modified
- Key patterns discovered
- Any deviations from plan

## Key Design Decisions (Locked)

```
Tech Stack:
- Frontend: React + TypeScript + Three.js (R3F)
- State: Zustand
- Build: Vite

Art Direction:
- Dark gothic horror palette
- Painted miniature aesthetic
- Isometric camera with rotation
- Diegetic UI elements

Performance:
- 60fps target
- 50 entity limit
- LOD system required
```

## File Paths

| Component | Location |
|-----------|----------|
| Main prompts | `/home/z/my-project/agents.md` |
| This guide | `/home/z/my-project/download/Castle_Ravenloft_Prompt_Guide.md` |
| Work log | `/home/z/my-project/worklog.md` |
| Generated assets | `/home/z/my-project/download/` |

## Token Efficiency Tips

1. **Reference, don't repeat**: Prompts reference previous outputs by file path
2. **Incremental context**: Each prompt builds on known state
3. **Locked decisions**: Design choices made once, never revisited
4. **Clear completion criteria**: Each prompt has specific output requirements

## Estimated Timeline

| Prompt | Complexity | Est. Output |
|--------|------------|-------------|
| 0 | Low | Context only |
| 1 | Medium | ~20 files |
| 2 | High | ~15 data files |
| 3 | Very High | ~10 engine files |
| 4 | Very High | ~15 component files |
| 5 | High | ~15 component files |
| 6 | High | ~10 files |
| 7 | High | ~10 AI files |
| 8 | Medium | ~8 audio files |
| 9 | Medium | ~10 scenario files |
| 10 | Medium | ~10 utility files |

---

*For detailed prompt content, see `/home/z/my-project/agents.md`*
