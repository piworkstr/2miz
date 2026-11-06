import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sendMessage } from '../lib/chat';
import { shrink } from '../lib/photos';
import { useSession } from '../lib/session';

// Mesajlar için tam ekran anlık kamera (galeriden seçim yok).
// Ayrı bir sayfa olarak açılır; açılır pencere içinde iPhone kamerası dokunmaları yutabiliyor.
export default function CameraScreen() {
  const { user, couple, partnerId, profile } = useSession();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [ready, setReady] = useState(false);
  const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const camera = useRef<CameraView>(null);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) requestPermission();
  }, [permission, requestPermission]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/chat'));

  async function take() {
    if (!camera.current || busy) return;
    setError('');
    setBusy(true);
    try {
      const pic = await camera.current.takePictureAsync({ quality: 0.8 });
      if (!pic?.uri) throw new Error('no-uri');
      setShot(await shrink(pic.uri));
    } catch {
      setError(ready ? 'Fotoğraf çekilemedi, tekrar dene.' : 'Kamera hazırlanıyor, bir saniye sonra tekrar dene.');
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!shot || !user || !couple || busy) return;
    setBusy(true);
    setError('');
    try {
      await sendMessage(couple.id, user.uid, '', shot, { to: partnerId, fromName: profile?.name ?? 'Partnerin' });
      close();
    } catch {
      setError('Gönderilemedi, tekrar dene.');
      setBusy(false);
    }
  }

  const round = (bg: string) => ({
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: bg,
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', padding: 12 }}>
          <Pressable onPress={close} hitSlop={16} style={round('rgba(255,255,255,0.15)')} accessibilityLabel="Kapat">
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
        </View>

        <View style={{ flex: 1, marginHorizontal: 12, borderRadius: 18, overflow: 'hidden', backgroundColor: '#111' }}>
          {shot ? (
            <Image source={{ uri: `data:image/jpeg;base64,${shot}` }} style={{ flex: 1 }} resizeMode="cover" />
          ) : permission?.granted ? (
            <CameraView
              ref={camera}
              style={{ flex: 1 }}
              facing={facing}
              mirror={facing === 'front'}
              onCameraReady={() => setReady(true)}
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
              <Text style={{ color: '#fff', textAlign: 'center' }}>Fotoğraf göndermek için kamera izni gerekli.</Text>
              <Pressable onPress={() => (permission?.canAskAgain === false ? Linking.openSettings() : requestPermission())}>
                <Text style={{ color: '#FF8FA3', fontWeight: '600' }}>
                  {permission?.canAskAgain === false ? 'Ayarlardan izin ver' : 'İzin ver'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {!!error && <Text style={{ color: '#FF8FA3', textAlign: 'center', marginTop: 10 }}>{error}</Text>}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', paddingVertical: 22 }}>
          {shot ? (
            <>
              <Pressable onPress={() => setShot(null)} style={round('rgba(255,255,255,0.15)')} accessibilityLabel="Yeniden çek">
                <Ionicons name="refresh" size={26} color="#fff" />
              </Pressable>
              <Pressable onPress={send} style={round('#E8516A')} accessibilityLabel="Gönder">
                {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={24} color="#fff" />}
              </Pressable>
            </>
          ) : (
            <>
              <View style={{ width: 60 }} />
              <Pressable
                onPress={take}
                accessibilityLabel="Çek"
                style={({ pressed }) => ({
                  width: 78,
                  height: 78,
                  borderRadius: 39,
                  borderWidth: 5,
                  borderColor: '#fff',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' }} />}
              </Pressable>
              <Pressable
                onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
                hitSlop={10}
                style={round('rgba(255,255,255,0.18)')}
                accessibilityLabel="Kamerayı çevir"
              >
                <Ionicons name="camera-reverse-outline" size={28} color="#fff" />
              </Pressable>
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
