import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { approveDelete, cancelDelete, delKey, requestDelete, type DelKind } from '../lib/delreq';
import { useSession } from '../lib/session';
import { useTheme } from '../lib/useTheme';
import { inkColor } from './Polaroid';

// Ortak albümde silme: tek başına silinmez, partner onaylar.
// open: kullanıcı uzun basıp silmek istedi (istek düğmeleri görünür). Bekleyen istek varsa her zaman görünür.
export function DeleteRequest({
  kind,
  id,
  label,
  url,
  open,
  onClose,
  doDelete,
  dark,
}: {
  kind: DelKind;
  id: string;
  label: string;
  url: string;
  open: boolean;
  onClose: () => void;
  doDelete: () => Promise<void>;
  dark?: boolean; // koyu zemin (seyahat ekranı)
}) {
  const t = useTheme();
  const { user, couple, partnerId, partnerName, profile } = useSession();
  const [busy, setBusy] = useState(false);
  if (!user || !couple) return null;
  const req = couple.delReq?.[delKey(kind, id)];
  if (!req && !open) return null;
  const ink = dark ? '#fff' : inkColor;
  const muted = dark ? 'rgba(255,255,255,0.7)' : t.colors.muted;
  const btn = (text: string, onPress: () => void, danger?: boolean) => (
    <Pressable
      key={text}
      disabled={busy}
      onPress={onPress}
      style={{
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: danger ? '#C0392B' : 'transparent',
        borderWidth: danger ? 0 : 1,
        borderColor: dark ? 'rgba(255,255,255,0.4)' : '#D9CCC6',
      }}
    >
      <Text maxFontSizeMultiplier={1.25} style={{ color: danger ? '#fff' : ink, fontWeight: '600' }}>
        {text}
      </Text>
    </Pressable>
  );
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch {
      /* sessiz; ekran tazelenince durum görünür */
    } finally {
      setBusy(false);
      onClose();
    }
  };
  let text: string;
  let buttons;
  if (!req) {
    text = `Ortak albümden silmek için ${partnerName}'in onayı gerekir.`;
    buttons = [
      btn(
        'Silmeyi iste',
        () =>
          run(() => requestDelete(couple.id, { kind, id, by: user.uid, label }, partnerId ?? undefined, profile?.name ?? 'Partnerin', url)),
        true,
      ),
      btn('Vazgeç', onClose),
    ];
  } else if (req.by === user.uid) {
    text = `Silme isteği gönderildi. ${partnerName} onaylayınca silinecek.`;
    buttons = [btn('İsteği geri al', () => run(() => cancelDelete(couple.id, kind, id)))];
  } else {
    text = `${partnerName} bunu silmek istiyor. Onaylıyor musun?`;
    buttons = [
      btn('Sil', () => run(() => approveDelete(couple.id, kind, id, doDelete)), true),
      btn('Kalsın', () => run(() => cancelDelete(couple.id, kind, id))),
    ];
  }
  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <Text maxFontSizeMultiplier={1.25} style={{ color: muted, fontSize: 13, textAlign: 'center' }}>
        {text}
      </Text>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, alignItems: 'center' }}>
        {busy ? <ActivityIndicator color={t.colors.primary} /> : buttons}
      </View>
    </View>
  );
}
