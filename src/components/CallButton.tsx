import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Alert, Linking, Pressable } from 'react-native';
import { db } from '../lib/firebase';
import { useSession } from '../lib/session';

// Partneri telefonla arar (oyun sırasında konuşmak için). Numara partnerin profilinden gelir; yalnızca partner görür.
// Kullanılıyor mu diye her dokunuş "olay" olarak kaydedilir (kurucu çift Biz sekmesinde sayısını görür); numara kaydedilmez.
export function CallButton({ where, color, size = 22 }: { where: string; color: string; size?: number }) {
  const { user, couple, profile, partnerProfile, partnerName } = useSession();
  if (!user || !couple) return null;
  const phone = partnerProfile?.phone?.replace(/[^0-9+]/g, '') ?? '';

  const press = () => {
    addDoc(collection(db, 'feedback'), {
      by: user.uid,
      name: profile?.name ?? '',
      coupleId: couple.id,
      kind: 'olay',
      text: `arama:${where}:${phone ? 'arandi' : 'numara-yok'}`,
      device: '',
      version: Constants.expoConfig?.version ?? '?',
      status: 'yapildi',
      createdAt: serverTimestamp(),
    }).catch(() => {});
    if (!phone) {
      Alert.alert(
        'Numara yok',
        `${partnerName} telefon numarasını eklememiş. Biz sekmesi → profil kartı → Düzenle’den ekleyince buradan arayabilirsin.`,
      );
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('Aranamadı', 'Bu cihazdan arama başlatılamadı.'));
  };

  return (
    <Pressable onPress={press} hitSlop={10} accessibilityLabel={`${partnerName}'i ara`} style={{ opacity: phone ? 1 : 0.55 }}>
      <Ionicons name="call-outline" size={size} color={color} />
    </Pressable>
  );
}
