import Ionicons from '@expo/vector-icons/Ionicons';
import {
  AudioQuality,
  getRecordingPermissionsAsync,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from 'expo-audio';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useVoiceFile, VOICE_MAX_MS, type Message } from '../lib/chat';
import { useTheme } from '../lib/useTheme';

// Konuşma için yeterli, küçük dosya: tek kanal, 32 kbps AAC (1 dakika ≈ 240 KB).
const VOICE_OPTS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  sampleRate: 22050,
  numberOfChannels: 1,
  bitRate: 32000,
  ios: { ...RecordingPresets.HIGH_QUALITY.ios, audioQuality: AudioQuality.LOW },
};

export const fmt = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// Basılı tut → kaydet, bırak → gönder. Bırakırken parmağı yukarı kaydırırsan iptal.
export function useVoice(onDone: (uri: string, ms: number) => void) {
  const recorder = useAudioRecorder(VOICE_OPTS);
  const state = useAudioRecorderState(recorder, 200);
  const [recording, setRecording] = useState(false);
  const [hint, setHint] = useState('');
  const pressing = useRef(false);
  const active = useRef(false);
  const startedAt = useRef(0);

  async function start() {
    pressing.current = true;
    setHint('');
    const perm = await getRecordingPermissionsAsync();
    if (!perm.granted) {
      const r = await requestRecordingPermissionsAsync();
      setHint(r.granted ? 'İzin verildi. Kaydetmek için mikrofona basılı tut.' : 'Sesli mesaj için mikrofon izni gerekli (Ayarlar).');
      pressing.current = false;
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      active.current = true;
      startedAt.current = Date.now();
      setRecording(true);
      // Hazırlanırken parmak kalktıysa kısa kayıt sayılır ve gönderilmez.
      if (!pressing.current) await stop(false);
    } catch {
      setHint('Kayıt başlatılamadı, tekrar dene.');
    }
  }

  async function stop(send: boolean) {
    pressing.current = false;
    if (!active.current) return;
    active.current = false;
    setRecording(false);
    const ms = Date.now() - startedAt.current;
    try {
      await recorder.stop();
    } catch {
      // zaten durmuş
    }
    setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    if (!send) return;
    if (ms < 800) {
      setHint('Kaydetmek için mikrofona basılı tut, bırakınca gönderilir.');
      return;
    }
    if (recorder.uri) onDone(recorder.uri, Math.min(ms, VOICE_MAX_MS));
  }

  // En fazla 1 dakika: süre dolunca kendiliğinden gönderilir.
  useEffect(() => {
    if (recording && state.durationMillis >= VOICE_MAX_MS) stop(true);
  }, [state.durationMillis]); // eslint-disable-line react-hooks/exhaustive-deps

  return { recording, ms: state.durationMillis, hint, setHint, start, stop };
}

// Sesli mesaj balonu: oynat/durdur, dalga çubukları ve süre.
export function VoicePlayer({ coupleId, m, mine }: { coupleId: string; m: Message; mine: boolean }) {
  const uri = useVoiceFile(coupleId, m.id, true);
  const t = useTheme();
  const fg = mine ? t.colors.onPrimary : t.colors.primary;
  if (!uri) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, width: 220 }}>
        <ActivityIndicator color={fg} />
        <Text style={{ color: mine ? t.colors.onPrimary : t.colors.text }}>{fmt(m.audioMs ?? 0)}</Text>
      </View>
    );
  }
  return <Player uri={uri} id={m.id} ms={m.audioMs ?? 0} mine={mine} />;
}

function Player({ uri, id, ms, mine }: { uri: string; id: string; ms: number; mine: boolean }) {
  const t = useTheme();
  const player = useAudioPlayer({ uri });
  const st = useAudioPlayerStatus(player);
  const dur = st.duration > 0 ? st.duration * 1000 : ms;
  const pos = Math.min(st.currentTime * 1000, dur);
  const progress = dur > 0 ? pos / dur : 0;
  const fg = mine ? t.colors.onPrimary : t.colors.primary;
  const dim = mine ? 'rgba(255,255,255,0.4)' : t.colors.border;

  // Mesaja özel ama her açılışta aynı görünen dalga çubukları.
  const bars = useMemo(() => {
    let h = 0;
    for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return Array.from({ length: 26 }, (_, i) => {
      h = (h * 1103515245 + 12345 + i) >>> 0;
      return 6 + (h % 18);
    });
  }, [id]);

  async function toggle() {
    if (st.playing) {
      player.pause();
      return;
    }
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
    if (st.didJustFinish || pos >= dur - 150) await player.seekTo(0);
    player.play();
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 8, width: 230 }}>
      <Pressable onPress={toggle} hitSlop={8} accessibilityLabel={st.playing ? 'Durdur' : 'Oynat'}>
        <Ionicons name={st.playing ? 'pause' : 'play'} size={26} color={fg} />
      </Pressable>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 26 }}>
        {bars.map((b, i) => (
          <View key={i} style={{ flex: 1, height: b, borderRadius: 2, backgroundColor: i / bars.length < progress ? fg : dim }} />
        ))}
      </View>
      <Text style={{ fontSize: 12, color: mine ? t.colors.onPrimary : t.colors.muted, minWidth: 30 }}>
        {fmt(st.playing || pos > 0 ? pos : dur)}
      </Text>
    </View>
  );
}
