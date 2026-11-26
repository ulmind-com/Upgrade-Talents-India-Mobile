import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

const NAV_SOUND = require("../../assets/sounds/nav_click.wav");

const POOL_SIZE = 3;
let playerPool: AudioPlayer[] | null = null;
let currentIdx = 0;

function initPool(): AudioPlayer[] {
  if (playerPool) return playerPool;
  playerPool = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    try {
      const p = createAudioPlayer(NAV_SOUND);
      playerPool.push(p);
    } catch {
      break;
    }
  }
  return playerPool;
}

// Web Audio API synthesis (exact match from Astra-Astrology-Admin)
let audioCtx: any = null;
function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass =
      (window as any).AudioContext ||
      (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playWebFeedback() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Master gentle gain (super soft and elegant)
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.045, now);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    // Warm Low-pass filter to eliminate any harsh digital click
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1600, now);
    filter.frequency.exponentialRampToValueAtTime(600, now + 0.08);

    // Primary fundamental tone (gentle sine wave)
    const osc1 = ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now); // E5 note - elegant & celestial
    osc1.frequency.exponentialRampToValueAtTime(523.25, now + 0.07); // gliding down softly to C5

    // Harmonic sparkle (subtle upper overtone)
    const osc2 = ctx.createOscillator();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(1318.5, now); // E6 sparkle
    osc2.frequency.exponentialRampToValueAtTime(1046.5, now + 0.05);

    const osc2Gain = ctx.createGain();
    osc2Gain.gain.setValueAtTime(0.015, now);
    osc2Gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

    osc1.connect(filter);
    osc2.connect(osc2Gain);
    osc2Gain.connect(filter);
    filter.connect(masterGain);
    masterGain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.09);
    osc2.stop(now + 0.09);
  } catch {}
}

/**
 * Tap / popup feedback: the soft click sound plus a light haptic.
 *
 * It had been cut to haptic-only because the click landed a beat late on
 * Android — the player was created on the first tap. Now a small pool is
 * built and preloaded as soon as this module loads, each tap rewinds the next
 * player in the pool (rapid taps never cut each other off), the volume is
 * soft, and it mixes with whatever else is playing instead of pausing it.
 */
let modeSet = false;
function prepare() {
  if (Platform.OS === "web") return;
  if (!modeSet) {
    modeSet = true;
    setAudioModeAsync({ interruptionMode: "mixWithOthers", playsInSilentMode: false } as any).catch(() => {});
  }
  const pool = initPool();
  pool.forEach((p) => {
    try {
      p.volume = 0.55;
    } catch {}
  });
}
// warm up early so the very first tap isn't late
try {
  prepare();
} catch {}

export function playNavFeedback() {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  } catch {}
  if (Platform.OS === "web") {
    playWebFeedback();
    return;
  }
  try {
    const pool = initPool();
    if (!pool.length) return;
    const p = pool[currentIdx];
    currentIdx = (currentIdx + 1) % pool.length;
    p.seekTo(0);
    p.play();
  } catch {}
}
