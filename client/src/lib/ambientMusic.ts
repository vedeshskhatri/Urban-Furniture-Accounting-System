/**
 * Ambient Lounge Background Music Controller
 * 
 * STRICT POLICY:
 * - Exclusively allowed on the CUSTOMER PORTAL side (/portal/*).
 * - STRICTLY MUTED & STOPPED on all Accounting, Admin, ERP, and internal staff routes.
 * - If a user navigates away from /portal to the ERP, music instantly stops and silences.
 * - 100% offline-first, served locally from /audio/
 * - Seamlessly loops through the playlist
 * - Gentle, unobtrusive default volume (~12-14%)
 * - Smooth fade-in and fade-out transitions
 */

import { useState, useEffect } from 'react';

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
const DEFAULT_VOLUME = 0.12; // 12% mellow, non-intrusive background level

export function isCustomerPortalRoute(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/portal');
}

type Listener = () => void;

class AmbientMusicController {
  private audio: HTMLAudioElement | null = null;
  private currentTrackIdx = 0;
  private listeners: Set<Listener> = new Set();
  private userEnabled = true;
  private targetVolume = DEFAULT_VOLUME;
  private isFading = false;
  private fadeTimer: any = null;
  private routeCheckTimer: any = null;

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

    // Only initialize and set up autoplay if already on customer portal
    this.setupAutoplayUnlock();
    this.setupRouteGuard();
  }

  private initAudio() {
    if (this.audio) return;
    try {
      this.audio = new Audio(AMBIENT_PLAYLIST[this.currentTrackIdx].src);
      this.audio.preload = 'auto';
      this.audio.volume = this.targetVolume;

      // Auto-advance to next track when finished
      this.audio.addEventListener('ended', () => {
        if (isCustomerPortalRoute()) {
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
      if (!isCustomerPortalRoute() && this.isPlaying) {
        this.stopAndSilence();
      }
    };

    window.addEventListener('popstate', checkRoute);
    window.addEventListener('hashchange', checkRoute);
    // Lightweight 500ms safety poll for SPA client-side navigations
    this.routeCheckTimer = setInterval(checkRoute, 500);
  }

  private setupAutoplayUnlock() {
    const unlock = () => {
      // STRICT CHECK: Only start audio if user is on the customer portal!
      // NEVER trigger on Accounting, Admin, or ERP pages.
      if (!isCustomerPortalRoute()) {
        return;
      }

      if (this.userEnabled && (!this.audio || this.audio.paused)) {
        this.playWithFade();
      }

      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };

    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
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
    return !!(this.audio && !this.audio.paused && !this.audio.ended);
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
   * Instantly stops and silences all music.
   * Called whenever leaving the customer portal or entering accounting/admin.
   */
  public stopAndSilence() {
    clearInterval(this.fadeTimer);
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
    this.notify();
  }

  public playWithFade() {
    // STRICT GUARD: If not on customer portal, abort immediately!
    if (!isCustomerPortalRoute()) {
      this.stopAndSilence();
      return;
    }

    this.initAudio();
    if (!this.audio) return;

    this.userEnabled = true;
    localStorage.setItem(STORAGE_KEY_ENABLED, 'true');

    clearInterval(this.fadeTimer);
    this.audio.volume = 0;

    const promise = this.audio.play();
    if (promise) {
      promise
        .then(() => {
          // Double check we haven't navigated away during async play
          if (!isCustomerPortalRoute()) {
            this.stopAndSilence();
            return;
          }

          this.isFading = true;
          const steps = 16;
          const stepTime = 50; // 800ms total fade-in
          let step = 0;
          this.fadeTimer = setInterval(() => {
            step++;
            if (!this.audio || !isCustomerPortalRoute()) {
              clearInterval(this.fadeTimer);
              if (!isCustomerPortalRoute()) this.stopAndSilence();
              return;
            }
            const currentVol = (this.targetVolume * step) / steps;
            this.audio.volume = Math.min(this.targetVolume, Math.max(0, currentVol));
            if (step >= steps) {
              clearInterval(this.fadeTimer);
              this.isFading = false;
            }
          }, stepTime);
          this.notify();
        })
        .catch((err) => {
          console.debug('Autoplay waiting for user interaction on customer portal:', err.message);
        });
    }
  }

  public pauseWithFade() {
    if (!this.audio) return;
    this.userEnabled = false;
    localStorage.setItem(STORAGE_KEY_ENABLED, 'false');

    clearInterval(this.fadeTimer);
    const startVol = this.audio.volume;
    const steps = 10;
    const stepTime = 35; // 350ms fade-out
    let step = 0;

    this.fadeTimer = setInterval(() => {
      step++;
      if (!this.audio) {
        clearInterval(this.fadeTimer);
        return;
      }
      const currentVol = startVol * (1 - step / steps);
      this.audio.volume = Math.max(0, currentVol);
      if (step >= steps) {
        clearInterval(this.fadeTimer);
        this.audio.pause();
        this.notify();
      }
    }, stepTime);
  }

  public toggle(): boolean {
    if (!isCustomerPortalRoute()) {
      this.stopAndSilence();
      return false;
    }

    if (this.isPlaying) {
      this.pauseWithFade();
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

    if (this.audio && !this.isFading) {
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
    this.loadCurrentTrack(this.isPlaying || this.userEnabled);
  }

  public prevTrack() {
    if (!isCustomerPortalRoute()) {
      this.stopAndSilence();
      return;
    }
    this.currentTrackIdx =
      (this.currentTrackIdx - 1 + AMBIENT_PLAYLIST.length) % AMBIENT_PLAYLIST.length;
    this.loadCurrentTrack(this.isPlaying || this.userEnabled);
  }

  private loadCurrentTrack(autoPlay = true) {
    if (!this.audio) return;
    if (!isCustomerPortalRoute()) {
      this.stopAndSilence();
      return;
    }
    const wasPlaying = this.isPlaying;
    this.audio.src = AMBIENT_PLAYLIST[this.currentTrackIdx].src;
    this.audio.load();
    if (wasPlaying || autoPlay) {
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
    setVolume: (v: number) => ambientMusic.setVolume(v),
    nextTrack: () => ambientMusic.nextTrack(),
    prevTrack: () => ambientMusic.prevTrack(),
  };
}
