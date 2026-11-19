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

export type PushType = 'message' | 'game' | 'trip' | 'wheel' | 'mood' | 'dream' | 'date';
export type PushData = { url: string; type: PushType };

// Profil > Bildirimler'de kapatılabilen türler. Kapalı türler users/{uid}.notifOff içinde durur; gönderen telefon
// bildirimi yollamadan önce alıcının bu listesine bakar (sunucu yok).
export const PUSH_TYPES: { id: PushType; tr: string; en: string; hintTr: string; hintEn: string }[] = [
  {
    id: 'message',
    tr: 'Mesajlar',
    en: 'Messages',
    hintTr: 'Sohbet, sesli mesaj, tepki, ortak takvim',
    hintEn: 'Chat, voice notes, reactions, shared calendar',
  },
  { id: 'game', tr: 'Oyunlar', en: 'Games', hintTr: 'Oyun daveti ve “sıra sende”', hintEn: 'Game invites and “your turn”' },
  {
    id: 'wheel',
    tr: 'Çark ve bonus görev',
    en: 'Wheel and bonus tasks',
    hintTr: 'Partnerin çarkı çevirince',
    hintEn: 'When your partner spins the wheel',
  },
  { id: 'mood', tr: 'Ruh hâli', en: 'Mood', hintTr: 'Partnerin ruh hâlini değiştirince', hintEn: 'When your partner changes their mood' },
  {
    id: 'trip',
    tr: 'Albüm ve seyahat',
    en: 'Album and trips',
    hintTr: 'Yeni fotoğraf, silme isteği',
    hintEn: 'New photos, delete requests',
  },
  { id: 'dream', tr: 'Hayal panosu', en: 'Dream board', hintTr: 'Yeni hayal, gerçekleşen hayal', hintEn: 'New and completed dreams' },
  {
    id: 'date',
    tr: 'Date önerileri',
    en: 'Date proposals',
    hintTr: 'Partnerin date planlayınca',
    hintEn: 'When your partner plans a date',
  },
];

// Sohbet ekranı açıkken yeni mesaj bildirimi üstte çıkmasın (WhatsApp gibi).
let chatOpen = false;
export const setChatOpen = (open: boolean) => {
  chatOpen = open;
};

// Açık olan oyun ekranının bildirimi ("Sıra sende") üstte çıkmasın.
let gameOpen: string | null = null;
export const setGameOpen = (id: string | null) => {
  gameOpen = id;
};

Notifications.setNotificationHandler({
  handleNotification: async (n) => {
    const data = n.request.content.data as Partial<PushData> | undefined;
    const hide =
      data?.url === '/garden' || // çiftlikten bildirim yok (eski sürümdeki partnerden gelse de uygulama açıkken gösterilmez)
      (data?.type === 'message' && chatOpen) ||
      (data?.type === 'game' && !!gameOpen && data.url === `/game/${gameOpen}`);
    return { shouldShowBanner: !hide, shouldShowList: !hide, shouldPlaySound: !hide, shouldSetBadge: false };
  },
});

async function registerToken(uid: string) {
  if (!Device.isDevice) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'bir iz',
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

// Alıcının cihaz anahtarı ve kapattığı türler; 5 dakikada bir yenilenir (ayar değişince çok beklemesin).
const tokens = new Map<string, { to: string | null; off: string[]; at: number }>();

// Partnere bildirim gönderir. Başarısız olursa sessizce geçer; asıl işlem (mesaj vb.) zaten kaydedildi.
export async function notifyPartner(partnerId: string, title: string, body: string, data: PushData) {
  if (data.url === '/garden') return; // çiftlik hiçbir koşulda bildirim göndermez
  try {
    const hit = tokens.get(partnerId);
    if (!hit || Date.now() - hit.at > 5 * 60_000) {
      const d = (await getDoc(doc(db, 'users', partnerId))).data() as { pushToken?: string; notifOff?: string[] } | undefined;
      tokens.set(partnerId, { to: d?.pushToken ?? null, off: d?.notifOff ?? [], at: Date.now() });
    }
    const { to, off } = tokens.get(partnerId)!;
    if (off.includes(data.type)) return; // alıcı bu türü kapatmış
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
