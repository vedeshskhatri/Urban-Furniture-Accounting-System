// Web Audio API organic sound generator for Japandi architecture experience
// Zero external files, 100% offline-first.

let audioCtx: AudioContext | null = null;
let ambientSource: AudioNode | null = null;
let ambientGain: GainNode | null = null;
let isAmbientPlaying = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Play an organic, warm wooden tap sound for UI interactions
 */
export function playWoodClick(pitchMod = 1.0) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    // Warm resonant wooden frequency: 720Hz dropping fast to 220Hz
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(720 * pitchMod, now);
    osc.frequency.exponentialRampToValueAtTime(180 * pitchMod, now + 0.04);

    // Warm resonant bandpass filter to emulate hollow hardwood
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(480 * pitchMod, now);
    filter.Q.setValueAtTime(6.0, now);

    // Sharp percussive transient with quick decay (45ms)
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  } catch {
    // Ignore audio errors gracefully
  }
}

/**
 * Play soft metal chime for success actions (e.g. quote generated, payment settled)
 */
export function playChimeSuccess() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 (harmonic chime)

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.001, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 1.25);
    });
  } catch {
    // Ignore
  }
}

/**
 * Toggle subtle Japandi bamboo breeze / gentle rain ambient soundscape
 */
export function toggleAmbientSoundscape(onState?: boolean): boolean {
  try {
    const ctx = getAudioContext();
    if (!ctx) return false;

    if (onState !== undefined) {
      if (onState === isAmbientPlaying) return isAmbientPlaying;
    }

    if (isAmbientPlaying) {
      if (ambientGain) {
        ambientGain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.8);
        setTimeout(() => {
          ambientSource?.disconnect();
          ambientSource = null;
          isAmbientPlaying = false;
        }, 850);
      }
      return false;
    } else {
      // Synthesize pink noise for rain/breeze
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        output[i] *= 0.11;
        b6 = white * 0.115926;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      // Filter to simulate soft garden breeze & bamboo leaf rustle
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 1.2);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      whiteNoise.start(ctx.currentTime);
      ambientSource = whiteNoise;
      ambientGain = gain;
      isAmbientPlaying = true;
      return true;
    }
  } catch {
    return false;
  }
}

/**
 * Instantly stop any synthesized ambient background sound
 */
export function stopAllAmbientSound() {
  try {
    if (ambientGain && audioCtx) {
      ambientGain.gain.setValueAtTime(0, audioCtx.currentTime);
    }
    if (ambientSource) {
      ambientSource.disconnect();
      ambientSource = null;
    }
    isAmbientPlaying = false;
  } catch {
    // Ignore
  }
}
