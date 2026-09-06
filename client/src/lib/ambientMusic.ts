/**
 * Ambient Lounge Background Music Controller
 * 
 * STRICT & BULLETPROOF POLICY:
 * - Instant, synchronous pause/stop on user interaction (zero delayed bleed).
 * - Exclusively allowed on the CUSTOMER PORTAL side (/portal/*).
 * - STRICTLY MUTED & STOPPED on all Accounting, Admin, ERP, and internal staff routes.
 * - Sequence operation tokens (operationId) prevent async Promise race conditions.
 * - Integrated with Web Audio synthesizer cleanup (stopAllAmbientSound).
 */

import { useState, useEffect } from 'react';
import { stopAllAmbientSound } from './soundEffects';

export interface AmbientTrack {
  id: string;
  title: string;
  artist: string;
  src: string;
}

export const AMBIENT_PLAYLIST: AmbientTrack[] = [
  {
    id: 'ambient-1',
    title: 'Roses (Chill Lo-Fi)',
    artist: 'Urban Atelier Lounge',
    src: '/audio/ambient-1.mp3',
  },
  {
    id: 'ambient-2',
    title: 'I Need You (Chill Lo-Fi)',
    artist: 'Urban Atelier Lounge',
    src: '/audio/ambient-2.mp3',
  },
];

const STORAGE_KEY_ENABLED = 'urban_ambient_enabled';
const STORAGE_KEY_VOLUME = 'urban_ambient_volume';
const DEFAULT_VOLUME = 0.25; // 25% clear, warm mellow background level

export function isCustomerPortalRoute(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/portal');
}

type Listener = () => void;

class AmbientMusicController {
  private audio: HTMLAudioElement | null = null;
  private currentTrackIdx = 0;
  private listeners: Set<Listener> = new Set();
  private userEnabled = false; // Default paused until explicitly played or unlocked
  private shouldPlay = false;
  private targetVolume = DEFAULT_VOLUME;
  private fadeTimer: any = null;
  private routeCheckTimer: any = null;
  private operationId = 0;

  constructor() {
    if (typeof window === 'undefined') return;

    // Load saved preferences
    const savedEnabled = localStorage.getItem(STORAGE_KEY_ENABLED);
    if (savedEnabled !== null) {
      this.userEnabled = savedEnabled === 'true';
    }

    const savedVol = localStorage.getItem(STORAGE_KEY_VOLUME);
    if (savedVol !== null) {
      const parsed = parseFloat(savedVol);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        this.targetVolume = parsed;
      }
    }

    this.setupRouteGuard();
    this.setupAutoplayUnlock();
  }

  private initAudio() {
    if (this.audio) return;
    try {
      this.audio = new Audio(AMBIENT_PLAYLIST[this.currentTrackIdx].src);
      this.audio.preload = 'auto';
      this.audio.volume = this.targetVolume;

      // Auto-advance to next track when finished
      this.audio.addEventListener('ended', () => {
        if (isCustomerPortalRoute() && this.shouldPlay && this.userEnabled) {
          this.nextTrack();
        } else {
          this.stopAndSilence();
        }
      });

      this.audio.addEventListener('play', () => this.notify());
      this.audio.addEventListener('pause', () => this.notify());
      this.audio.addEventListener('error', (e) => {
        console.warn('Ambient audio load notice:', e);
      });
    } catch {
      // Ignore audio initialization errors
    }
  }

  /**
   * Continuous route guard: if user ever leaves /portal to go to Accounting or Admin,
   * immediately kill audio playback.
   */
  private setupRouteGuard() {
    const checkRoute = () => {
      if (!isCustomerPortalRoute() && (this.isPlaying || this.shouldPlay)) {
        this.stopAndSilence();
      }
    };

    window.addEventListener('popstate', checkRoute);
    window.addEventListener('hashchange', checkRoute);
    this.routeCheckTimer = setInterval(checkRoute, 500);
  }

  private setupAutoplayUnlock() {
    const unlock = (e: Event) => {
      // If user clicked directly on an audio toggle button, let the button handler manage it
      const target = e.target as HTMLElement | null;
      if (target && target.closest('[data-ambient-toggle]')) {
        return;
      }

      // Only unlock if on customer portal and user has enabled music
      if (!isCustomerPortalRoute() || !this.userEnabled) {
        return;
      }

      if (!this.audio || this.audio.paused) {
        this.playWithFade();
      }

      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };

    window.addEventListener('pointerdown', unlock, { passive: true, once: true });
    window.addEventListener('keydown', unlock, { passive: true, once: true });
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  public get isPlaying(): boolean {
    return this.shouldPlay && !(this.audio && this.audio.paused && !this.audio.seeking);
  }

  public get isEnabled(): boolean {
    return this.userEnabled;
  }

  public get volume(): number {
    return this.targetVolume;
  }

  public get currentTrack(): AmbientTrack {
    return AMBIENT_PLAYLIST[this.currentTrackIdx] || AMBIENT_PLAYLIST[0];
  }

  /**
   * Instantly stops and silences all music synchronously.
   */
  public stopAndSilence() {
    this.operationId++;
    this.shouldPlay = false;
    clearInterval(this.fadeTimer);

    if (this.audio) {
      try {
        this.audio.pause();
        this.audio.currentTime = 0;
        this.audio.volume = 0;
      } catch {}
    }

    stopAllAmbientSound();
    this.notify();
  }

  /**
   * Instantly pauses music synchronously without delayed bleed.
   */
  public pause() {
    this.operationId++;
    this.shouldPlay = false;
    this.userEnabled = false;
    localStorage.setItem(STORAGE_KEY_ENABLED, 'false');

    clearInterval(this.fadeTimer);

    if (this.audio) {
      try {
        this.audio.pause();
      } catch {}
    }

    stopAllAmbientSound();
    this.notify();
  }

  /**
   * Plays music instantly with warm, direct volume.
   */
  public playWithFade() {
    // STRICT GUARD: Only on customer portal
    if (!isCustomerPortalRoute()) {
      this.stopAndSilence();
      return;
    }

    this.initAudio();
    if (!this.audio) return;

    const op = ++this.operationId;
    this.shouldPlay = true;
    this.userEnabled = true;
    localStorage.setItem(STORAGE_KEY_ENABLED, 'true');

    clearInterval(this.fadeTimer);
    this.audio.volume = this.targetVolume;
    this.notify();

    const promise = this.audio.play();
    if (promise) {
      promise
        .then(() => {
          if (op !== this.operationId || !this.shouldPlay || !isCustomerPortalRoute()) {
            if (this.audio) this.audio.pause();
            return;
          }
          if (this.audio) {
            this.audio.volume = this.targetVolume;
          }
          this.notify();
        })
        .catch((err) => {
          console.debug('Autoplay waiting for interaction on customer portal:', err.message);
        });
    }
  }

  public toggle(): boolean {
    if (!isCustomerPortalRoute()) {
      this.stopAndSilence();
      return false;
    }

    if (this.isPlaying || this.shouldPlay) {
      this.pause();
      return false;
    } else {
      this.playWithFade();
      return true;
    }
  }

  public setVolume(vol: number) {
    const clamped = Math.max(0, Math.min(1, vol));
    this.targetVolume = clamped;
    localStorage.setItem(STORAGE_KEY_VOLUME, clamped.toString());

    if (this.audio && this.shouldPlay) {
      this.audio.volume = clamped;
    }
    this.notify();
  }

  public nextTrack() {
    if (!isCustomerPortalRoute()) {
      this.stopAndSilence();
      return;
    }
    this.currentTrackIdx = (this.currentTrackIdx + 1) % AMBIENT_PLAYLIST.length;
    this.loadCurrentTrack(this.isPlaying || this.shouldPlay);
  }

  public prevTrack() {
    if (!isCustomerPortalRoute()) {
      this.stopAndSilence();
      return;
    }
    this.currentTrackIdx =
      (this.currentTrackIdx - 1 + AMBIENT_PLAYLIST.length) % AMBIENT_PLAYLIST.length;
    this.loadCurrentTrack(this.isPlaying || this.shouldPlay);
  }

  private loadCurrentTrack(autoPlay = true) {
    this.initAudio();
    if (!this.audio) return;
    if (!isCustomerPortalRoute()) {
      this.stopAndSilence();
      return;
    }
    this.audio.src = AMBIENT_PLAYLIST[this.currentTrackIdx].src;
    this.audio.load();
    if (autoPlay) {
      this.playWithFade();
    } else {
      this.notify();
    }
  }
}

// Singleton global controller
export const ambientMusic = new AmbientMusicController();

/**
 * Custom React Hook to consume and control the ambient lounge player
 */
export function useAmbientMusic() {
  const [, setTick] = useState(0);

  useEffect(() => {
    return ambientMusic.subscribe(() => {
      setTick((t) => t + 1);
    });
  }, []);

  return {
    isPlaying: ambientMusic.isPlaying,
    isEnabled: ambientMusic.isEnabled,
    volume: ambientMusic.volume,
    currentTrack: ambientMusic.currentTrack,
    toggle: () => ambientMusic.toggle(),
    pause: () => ambientMusic.pause(),
    setVolume: (v: number) => ambientMusic.setVolume(v),
    nextTrack: () => ambientMusic.nextTrack(),
    prevTrack: () => ambientMusic.prevTrack(),
  };
}
