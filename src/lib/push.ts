import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { db } from './firebase';

// Bildirimler Expo'nun bildirim servisi üzerinden gider (Apple ve Google'a o iletir).
// Şimdilik sunucumuz yok: gönderen telefon, partnerin cihaz anahtarına doğrudan bildirim yollar.
// Uygulama büyüyünce bu iş Firebase Functions'a taşınır (bkz. YOL_HARITASI.md).

export type PushData = { url: string; type: 'message' | 'game' | 'trip' | 'wheel' };

// Sohbet ekranı açıkken yeni mesaj bildirimi üstte çıkmasın (WhatsApp gibi).
let chatOpen = false;
export const setChatOpen = (open: boolean) => {
  chatOpen = open;
};

Notifications.setNotificationHandler({
  handleNotification: async (n) => {
    const data = n.request.content.data as Partial<PushData> | undefined;
    const hide = data?.type === 'message' && chatOpen;
    return { shouldShowBanner: !hide, shouldShowList: !hide, shouldPlaySound: !hide, shouldSetBadge: false };
  },
});

async function registerToken(uid: string) {
  if (!Device.isDevice) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'UsDaily',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#E8516A',
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  await updateDoc(doc(db, 'users', uid), { pushToken: token });
}

// Sekmeler açıldığında bir kez: izin ister, cihaz anahtarını kaydeder, bildirime dokununca ilgili ekranı açar.
export function usePushSetup(uid: string | undefined) {
  useEffect(() => {
    if (!uid) return;
    registerToken(uid).catch(() => {});
  }, [uid]);

  useEffect(() => {
    const open = (r: Notifications.NotificationResponse | null) => {
      const url = (r?.notification.request.content.data as Partial<PushData> | undefined)?.url;
      if (url) router.push(url as never);
    };
    // Uygulama kapalıyken bildirime dokunarak açıldıysa.
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      open(last);
      Notifications.clearLastNotificationResponse();
    }
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
}

const tokens = new Map<string, string | null>();

// Partnere bildirim gönderir. Başarısız olursa sessizce geçer; asıl işlem (mesaj vb.) zaten kaydedildi.
export async function notifyPartner(partnerId: string, title: string, body: string, data: PushData) {
  try {
    if (!tokens.has(partnerId)) {
      const s = await getDoc(doc(db, 'users', partnerId));
      tokens.set(partnerId, ((s.data() as { pushToken?: string } | undefined)?.pushToken) ?? null);
    }
    const to = tokens.get(partnerId);
    if (!to) {
      tokens.delete(partnerId); // partner izni sonradan verebilir; bir dahakine yeniden bakılır
      return;
    }
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        title,
        body: body.length > 140 ? `${body.slice(0, 137)}…` : body,
        data,
        sound: 'default',
        channelId: 'default',
        priority: 'high',
      }),
    });
  } catch {
    // ağ yok vb.
  }
}
