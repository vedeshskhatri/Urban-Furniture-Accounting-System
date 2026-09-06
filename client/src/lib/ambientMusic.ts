/**
 * Ambient Music — DISABLED
 * Music has been removed from the site per product decision.
 * Stubs are kept so existing imports compile without changes.
 */
import { useState, useEffect } from 'react';

export const ambientMusic = {
  isPlaying: false,
  isEnabled: false,
  volume: 0,
  currentTrack: { src: '', title: '', artist: '' },
  stopAndSilence: () => {},
  pause: () => {},
  playWithFade: () => {},
  toggle: () => false,
  setVolume: (_v: number) => {},
  nextTrack: () => {},
  prevTrack: () => {},
  subscribe: (_listener: () => void) => () => {},
};

export function useAmbientMusic() {
  const [, setTick] = useState(0);
  useEffect(() => {}, []);
  return {
    isPlaying: false,
    isEnabled: false,
    volume: 0,
    currentTrack: { src: '', title: '', artist: '' },
    toggle: () => false,
    pause: () => {},
    setVolume: (_v: number) => {},
    nextTrack: () => {},
    prevTrack: () => {},
  };
}
