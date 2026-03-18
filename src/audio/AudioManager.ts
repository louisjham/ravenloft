import { useGameStore } from '../store/gameStore';
import audioManifest from '../data/audioManifest.json';
import { DUMMY_MODE } from '../utils/modelLoader';

export class AudioManager {
  private static instance: AudioManager;
  private musicAudio: HTMLAudioElement | null = null;
  private ambientAudio: HTMLAudioElement | null = null;
  private sfxCache: Map<string, HTMLAudioElement> = new Map();

  private constructor() {}

  public static getInstance(): AudioManager {
    if (!this.instance) {
      this.instance = new AudioManager();
    }
    return this.instance;
  }

  public playMusic(trackId: string, fadeTime: number = 1000) {
    const track = (audioManifest.music as any)[trackId];
    if (!track) return;

    if (this.musicAudio) {
      this.stopMusic(fadeTime);
    }

    this.musicAudio = new Audio(track.src);
    this.musicAudio.loop = track.loop;
    this.musicAudio.volume = 0; // Start muted for fade in

    if (DUMMY_MODE) {
      console.log(`[Audio Dummy] Playing music: ${trackId}`);
    } else {
      this.musicAudio.play().catch(e => console.warn('Audio play failed', e));
    }

    this.fadeAudio(this.musicAudio, this.getMusicVolume(), fadeTime);
  }

  public stopMusic(fadeTime: number = 1000) {
    if (this.musicAudio) {
      this.fadeAudio(this.musicAudio, 0, fadeTime, () => {
        this.musicAudio?.pause();
        this.musicAudio = null;
      });
    }
  }

  public playSound(soundId: string) {
    const sfx = (audioManifest.sfx as any)[soundId];
    if (!sfx) return;

    const audio = new Audio(sfx.src);
    audio.volume = sfx.volume * this.getSFXVolume();
    
    if (DUMMY_MODE) {
      console.log(`[Audio Dummy] Playing SFX: ${soundId}`);
    } else {
      audio.play().catch(e => console.warn('SFX play failed', e));
    }
  }

  public playAmbient(ambientId: string) {
    const ambient = (audioManifest.ambient as any)[ambientId];
    if (!ambient) return;

    if (this.ambientAudio) {
      this.ambientAudio.pause();
    }

    this.ambientAudio = new Audio(ambient.src);
    this.ambientAudio.loop = true;
    this.ambientAudio.volume = ambient.volume * this.getSFXVolume();

    if (DUMMY_MODE) {
      console.log(`[Audio Dummy] Playing Ambient: ${ambientId}`);
    } else {
      this.ambientAudio.play().catch(e => console.warn('Ambient play failed', e));
    }
  }

  public setMasterVolume(v: number) {
    // This would typically involve a gain node if we used Web Audio API fully
    // For now, we update the store which components react to
  }

  private getMusicVolume(): number {
    const settings = useGameStore.getState().settings;
    return settings.musicVolume * settings.masterVolume;
  }

  private getSFXVolume(): number {
    const settings = useGameStore.getState().settings;
    return settings.sfxVolume * settings.masterVolume;
  }

  private fadeAudio(audio: HTMLAudioElement, targetVolume: number, duration: number, onComplete?: () => void) {
    const startVolume = audio.volume;
    const startTime = performance.now();

    const update = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      audio.volume = startVolume + (targetVolume - startVolume) * progress;

      if (progress < 1) {
        requestAnimationFrame(update);
      } else if (onComplete) {
        onComplete();
      }
    };

    requestAnimationFrame(update);
  }
}
