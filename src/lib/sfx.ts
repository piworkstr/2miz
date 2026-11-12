import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

// Küçük oyun sesleri. Telefon sessizdeyse çalmaz (iOS varsayılanı); ses çıkmasa da hafif titreşim verir.
const SRC = {
  tas: require('../../assets/sfx/tas.wav'),
  kir: require('../../assets/sfx/kir.wav'),
  zar: require('../../assets/sfx/zar.wav'),
} as const;
export type Sfx = keyof typeof SRC;

const players: Partial<Record<Sfx, AudioPlayer>> = {};

// Ses kapatılabilir (işte, okulda); seçim telefonda saklanır. Titreşim açık kalır.
const KEY = '2miz.sfxMuted';
let muted = false;
AsyncStorage.getItem(KEY)
  .then((v) => (muted = v === '1'))
  .catch(() => {});
export const sfxMuted = () => muted;
export function setSfxMuted(m: boolean) {
  muted = m;
  AsyncStorage.setItem(KEY, m ? '1' : '0').catch(() => {});
}

export function sfx(name: Sfx) {
  try {
    if (muted) throw new Error('sessiz');
    const p = (players[name] ??= createAudioPlayer(SRC[name]));
    p.volume = name === 'tas' ? 0.6 : 0.8;
    p.seekTo(0);
    p.play();
  } catch {
    /* ses çalamıyorsa oyun yine sürer */
  }
  if (name === 'kir') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  else if (name === 'tas') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
