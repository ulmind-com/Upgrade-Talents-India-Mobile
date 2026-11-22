import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";

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
 * Plays the signature soft luxury acoustic feedback chime
 * replicated from Rahul Pandit's Admin panel interaction sound,
 * with synchronized gentle haptic feedback.
 */
/* Nav feedback is haptic only.

   The click tone read as novelty rather than craft: it fired on every tap,
   it could not be turned off from inside the app, and on Android it landed
   a few milliseconds behind the press, so it felt like a glitch instead of
   a response. A light impact says the same thing silently, and matches how
   the rest of the system behaves. The audio pipeline below is left intact
   and unused so re-enabling it is a one-line change if we ever ship a
   sound setting. */
export function playNavFeedback() {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  } catch {}
}
