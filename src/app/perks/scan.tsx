import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { parseStampLink } from '../../lib/perks';

// Kasadaki karekodu okur ve damgayı işlemek üzere mekan ekranına döner.
export default function PerkScan() {
  const [permission, requestPermission] = useCameraPermissions();
  const [wrong, setWrong] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) requestPermission();
  }, [permission, requestPermission]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/perks'));

  function onScan(data: string) {
    if (done.current) return;
    const hit = parseStampLink(data);
    if (!hit) {
      setWrong(true);
      return;
    }
    done.current = true;
    // Mekan ekranına kodla dön; yığında yoksa açılır.
    router.dismissTo(`/perks/${hit.pid}?c=${hit.code}`);
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {permission?.granted && (
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => onScan(data)}
        />
      )}
      <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="box-none">
        <Pressable onPress={close} hitSlop={12} accessibilityLabel="Kapat" style={{ alignSelf: 'flex-end', padding: 16 }}>
          <Ionicons name="close" size={30} color="#fff" />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 }} pointerEvents="box-none">
          {permission?.granted ? (
            <View style={{ width: 240, height: 240, borderRadius: 24, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)' }} />
          ) : (
            <>
              <Text style={{ color: '#fff', fontSize: 16, textAlign: 'center' }}>
                Karekodu okumak için kamera izni gerekiyor. İzin vermek istemezsen karttaki kodu elle de girebilirsin.
              </Text>
              {permission && !permission.canAskAgain && (
                <Pressable onPress={() => Linking.openSettings()} style={{ padding: 12, borderRadius: 24, backgroundColor: '#fff' }}>
                  <Text style={{ fontWeight: '700' }}>Ayarları aç</Text>
                </Pressable>
              )}
            </>
          )}
          <Text style={{ color: '#fff', fontSize: 15, textAlign: 'center', fontWeight: '600' }}>
            {wrong ? 'Bu bir 2miz kasa kodu değil. Kasadaki 2miz kartını okutun.' : 'Kasadaki 2miz kartının karekodunu çerçeveye getirin'}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}
