# Audio sources â€” Castle Ravenloft VR (`public/audio/`)

All files below are used under licenses that permit commercial use with no
attribution required. No file was ripped from a video or game. No file
requires a credit line, but sources are recorded here for a clean license record.

## Kenney â€” CC0 1.0 Universal (kenney.nl; all assets free, no attribution required)

| File | Kenney pack file |
|---|---|
| `sfx/tile_place.mp3` | Impact Sounds â€” `impactPlate_heavy_000.ogg` (heavy plate/stone thud) |
| `sfx/dice_roll.mp3` | Casino Audio â€” `dice-shake-1.ogg` + `dice-throw-1.ogg` concatenated (derived edit of two CC0 files) |
| `sfx/card_draw.mp3` | Casino Audio â€” `card-slide-1.ogg` |
| `sfx/card_play.mp3` | Casino Audio â€” `card-place-1.ogg` |
| `sfx/sword_hit.mp3` | Impact Sounds â€” `impactMetal_heavy_000.ogg` |
| `sfx/hero_hurt.mp3` | Impact Sounds â€” `impactPunch_heavy_000.ogg` |
| `sfx/click.mp3` | Interface Sounds â€” `click_001.ogg` |
| `sfx/hover.mp3` | Interface Sounds â€” `tick_001.ogg` |

Kenney packs downloaded as the official zips from kenney.nl (Interface Sounds,
Impact Sounds, RPG Audio, Casino Audio). OGG sources converted to MP3 with
ffmpeg (libmp3lame, VBR q4); the conversion does not change the license.

## Pixabay â€” Pixabay Content License (free for commercial use, no attribution required)

| File | Pixabay item |
|---|---|
| `sfx/monster_die.mp3` | "Aggressive Monster Roar 1" by yodguard â€” pixabay.com/sound-effects/film-special-effects-aggressive-monster-roar-1-533009/ |
| `sfx/spell_cast.mp3` | "Elemental Magic Spell Cast B" by rescopicsound â€” pixabay.com/sound-effects/film-special-effects-elemental-magic-spell-cast-b-228347/ |
| `ambient/dungeon_loop.mp3` | "Deep Monster Breathing Dungeon Ambience Horror SFX" by alesiadavina â€” pixabay.com/sound-effects/film-special-effects-deep-monster-breathing-dungeon-ambience-horror-sfx-541139/ |
| `music/main_theme.mp3` | "Dark Fantasy" by Lux Aeterna â€” pixabay.com/music/ambient-dark-fantasy-music-567686/ |
| `music/boss_theme.mp3` | "Epic Battle Music" by Tunetank â€” pixabay.com/music/adventure-epic-battle-music-347288/ |

Pixabay files downloaded as MP3 from cdn.pixabay.com and placed unchanged.
Music tracks are shippable placeholders; final music direction is the
project owner's call.

## Notes

- The manifest (`src/data/audioManifest.json`) lists "layers" metadata on the
  two music entries only; `src/audio/AudioManager.ts` consumes only each
  track's `src` and `loop` for music, so single-file loops satisfy it â€” no
  separate stem files are needed.
- Files placed 2026-10-24. No other `src/` or `dist/` files were touched.
