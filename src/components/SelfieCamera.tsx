import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, Text, View } from 'react-native';
import { shrink } from '../lib/photos';
import { useTheme } from '../lib/useTheme';
import { Button, Muted } from './ui';

type Props = {
  // base64 JPEG ya da null (yeniden çek)
  value: string | null;
  onChange: (data: string | null) => void;
  hint?: string;
  aspect?: number; // genişlik / yükseklik
};

// O an çekilen fotoğraf (ön ya da arka kamera); galeriden seçim yok, böylece fotoğraf gerçekten o güne ait olur.
export function SelfieCamera({ value, onChange, hint, aspect = 3 / 4 }: Props) {
  const t = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [open, setOpen] = useState(false);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const camera = useRef<CameraView>(null);
  const radius = Math.min(t.radius.card, 14);

  async function start() {
    setError('');
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        setError(res.canAskAgain ? 'Selfie için kamera izni gerekli.' : 'Kamera izni kapalı. Ayarlardan açabilirsin.');
        return;
      }
    }
    setReady(false);
    setOpen(true);
  }

  async function shoot() {
    if (!camera.current || busy) return;
    setBusy(true);
    try {
      const pic = await camera.current.takePictureAsync({ quality: 0.8 });
      if (!pic?.uri) throw new Error('no-uri');
      onChange(await shrink(pic.uri));
      setOpen(false);
    } catch {
      setError(ready ? 'Fotoğraf çekilemedi, tekrar dene.' : 'Kamera hazırlanıyor, bir saniye sonra tekrar dene.');
    } finally {
      setBusy(false);
    }
  }

  if (value) {
    return (
      <View style={{ gap: 8 }}>
        <Image
          source={{ uri: `data:image/jpeg;base64,${value}` }}
          style={{ width: '100%', aspectRatio: aspect, borderRadius: radius }}
        />
        <Pressable onPress={() => onChange(null)} style={{ alignItems: 'center', padding: 6 }}>
          <Text style={{ color: t.colors.primary, fontFamily: t.fonts.body }}>Yeniden çek</Text>
        </Pressable>
      </View>
    );
  }

  if (open) {
    return (
      <View style={{ gap: 10 }}>
        <View style={{ width: '100%', aspectRatio: aspect, borderRadius: radius, overflow: 'hidden', backgroundColor: '#000' }}>
          <CameraView
            ref={camera}
            style={{ flex: 1 }}
            facing={facing}
            mirror={facing === 'front'}
            onCameraReady={() => setReady(true)}
          />
          {/* Kamerayı çevir: önizlemenin üstünde ayrı bir düğme (kamerayı saran dokunma alanı dokunmaları yutabiliyor). */}
          <Pressable
            onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}
            hitSlop={10}
            accessibilityLabel="Kamerayı çevir"
            style={({ pressed }) => ({
              position: 'absolute',
              right: 12,
              bottom: 12,
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: pressed ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.45)',
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            <Ionicons name="camera-reverse-outline" size={28} color="#fff" />
          </Pressable>
          {!ready && (
            <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color="#fff" />
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button style={{ flex: 1 }} label="Vazgeç" variant="secondary" onPress={() => setOpen(false)} />
          <Button style={{ flex: 1 }} label="Çek" onPress={shoot} busy={busy} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      <Pressable
        onPress={start}
        style={({ pressed }) => ({
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: pressed ? t.colors.primary : t.colors.border,
          borderRadius: radius,
          paddingVertical: 26,
          alignItems: 'center',
          gap: 6,
        })}
      >
        <Ionicons name="camera-outline" size={30} color={t.colors.primary} />
        <Text style={{ color: t.colors.primary, fontWeight: '600', fontFamily: t.fonts.button }}>Fotoğraf çek</Text>
        {hint && <Muted style={{ textAlign: 'center', paddingHorizontal: 12 }}>{hint}</Muted>}
      </Pressable>
      {!!error && (
        <Pressable onPress={() => (permission && !permission.canAskAgain ? Linking.openSettings() : start())}>
          <Text style={{ color: t.colors.primary, fontSize: 14, textAlign: 'center' }}>{error}</Text>
        </Pressable>
      )}
    </View>
  );
}
