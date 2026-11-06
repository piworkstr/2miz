import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { shrink } from '../lib/photos';

// Tam ekran anlık kamera: galeriden seçim yok. Çekilen fotoğraf onaylanınca gönderilir.
export function ChatCamera({ open, onClose, onSend }: { open: boolean; onClose: () => void; onSend: (data: string) => Promise<void> }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [ready, setReady] = useState(false);
  const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const camera = useRef<CameraView>(null);

  function flip() {
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
  }

  // Önizlemeye çift dokununca kamera döner.
  const lastTap = useRef(0);
  function doubleTapFlip() {
    const now = Date.now();
    if (now - lastTap.current < 300) flip();
    lastTap.current = now;
  }

  function close() {
    setShot(null);
    setReady(false);
    setError('');
    onClose();
  }

  // Kamera çevrildiğinde "hazır" olayı her cihazda tekrar gelmeyebiliyor; bu yüzden hazır
  // bilgisini beklemeden çekmeyi deneriz ve hata olursa ekranda gösteririz.
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
    if (!shot) return;
    setBusy(true);
    try {
      await onSend(shot);
      close();
    } finally {
      setBusy(false);
    }
  }

  const round = (bg: string) => ({
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: bg,
  });

  return (
    <Modal visible={open} animationType="slide" onRequestClose={close} onShow={() => {
      if (!permission?.granted) requestPermission();
    }}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16 }}>
            <Pressable onPress={close} hitSlop={12} accessibilityLabel="Kapat">
              <Ionicons name="close" size={30} color="#fff" />
            </Pressable>
          </View>

          <View style={{ flex: 1, marginHorizontal: 12, borderRadius: 18, overflow: 'hidden', backgroundColor: '#111' }}>
            {shot ? (
              <Image source={{ uri: `data:image/jpeg;base64,${shot}` }} style={{ flex: 1 }} resizeMode="cover" />
            ) : permission?.granted ? (
              <Pressable style={{ flex: 1 }} onPress={doubleTapFlip}>
                <CameraView
                  ref={camera}
                  style={{ flex: 1 }}
                  facing={facing}
                  mirror={facing === 'front'}
                  onCameraReady={() => setReady(true)}
                />
              </Pressable>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 40, paddingVertical: 24 }}>
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
                <View style={{ width: 56 }} />
                <Pressable
                  onPress={take}
                  accessibilityLabel="Çek"
                  style={{ width: 76, height: 76, borderRadius: 38, borderWidth: 5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}
                >
                  {busy ? <ActivityIndicator color="#fff" /> : <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: '#fff' }} />}
                </Pressable>
                <Pressable onPress={flip} hitSlop={10} style={round('rgba(255,255,255,0.18)')} accessibilityLabel="Kamerayı çevir">
                  <Ionicons name="camera-reverse-outline" size={28} color="#fff" />
                </Pressable>
              </>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
