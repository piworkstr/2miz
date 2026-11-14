import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AlbumOptions } from '../lib/albumLayout';
import { createOrder, tl, type Price } from '../lib/orders';
import { useSession } from '../lib/session';
import { useTheme } from '../lib/useTheme';
import { Button, Card, ErrorText, Input, Muted, T, Title } from './ui';

// Albüm sipariş formu: teslimat bilgisi ve tutar özeti. Ödeme şimdilik uygulama dışında alınır.
export function AlbumOrderForm(props: {
  visible: boolean;
  onClose: () => void;
  onDone: () => void;
  opts: AlbumOptions;
  pageCount: number;
  price: Price;
  plusPct: number;
}) {
  const { visible, onClose, opts, pageCount, price } = props;
  const t = useTheme();
  const { user, couple, profile, partnerName } = useSession();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function send() {
    if (!user || !couple || busy) return;
    if (name.trim().length < 5 || !name.trim().includes(' ')) return setError('Teslim alacak kişinin adını ve soyadını yazın.');
    if (phone.replace(/\D/g, '').length < 10) return setError('Kargo için ulaşılabilecek bir telefon numarası yazın.');
    if (address.trim().length < 10) return setError('Açık adresi yazın (mahalle, sokak, kapı no).');
    if (city.trim().length < 3) return setError('İlçe ve ili yazın.');
    setBusy(true);
    setError('');
    try {
      await createOrder(couple.id, user.uid, `${profile?.name ?? ''} ve ${partnerName}`, opts, pageCount, price, {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        city: city.trim(),
      });
      props.onDone();
    } catch {
      setError('Sipariş gönderilemedi; bağlantıyı kontrol edip tekrar deneyin.');
      setBusy(false);
    }
  }

  const line = (label: string, value: string, opt: { bold?: boolean; color?: string } = {}) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <T style={{ fontWeight: opt.bold ? '700' : '400', color: opt.color ?? t.colors.text }}>{label}</T>
      <T style={{ fontWeight: opt.bold ? '700' : '400', color: opt.color ?? t.colors.text }}>{value}</T>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Kapat" style={{ alignSelf: 'flex-end' }}>
            <Ionicons name="close" size={28} color={t.colors.text} />
          </Pressable>
          <Title>Albümü bastır</Title>
          <Muted>{`${opts.size === '21x21' ? '21×21 cm' : opts.size} · ${pageCount} sayfa. Albüm, önizlemede gördüğünüz haliyle basılır.`}</Muted>

          <T style={{ fontWeight: '600', marginTop: 4 }}>Teslimat</T>
          <Input value={name} onChangeText={setName} placeholder="Ad soyad" autoCapitalize="words" maxLength={60} />
          <Input value={phone} onChangeText={setPhone} placeholder="Telefon" keyboardType="phone-pad" maxLength={20} />
          <Input
            value={address}
            onChangeText={setAddress}
            placeholder="Adres (mahalle, sokak, kapı no)"
            multiline
            maxLength={240}
            style={{ minHeight: 76, textAlignVertical: 'top' }}
          />
          <Input value={city} onChangeText={setCity} placeholder="İlçe, il" autoCapitalize="words" maxLength={60} />

          <Card style={{ gap: 6 }}>
            {line(`Albüm · ${pageCount} sayfa`, tl(price.album))}
            {price.discount > 0 && line(`Plus indirimi %${props.plusPct}`, `−${tl(price.discount)}`, { color: t.colors.success })}
            {line('Kargo', price.shipping ? tl(price.shipping) : 'Ücretsiz')}
            <View style={{ height: 1, backgroundColor: t.colors.border, marginVertical: 2 }} />
            {line('Toplam', tl(price.total), { bold: true })}
          </Card>
          <Muted>
            Ödeme şimdilik uygulama dışında alınır: siparişinizi gönderince ödeme için sizinle iletişime geçeriz; ödeme alınınca albüm
            baskıya girer. Adres ve telefonunuz yalnızca bu siparişin teslimatı için kullanılır.
          </Muted>
          <ErrorText>{error}</ErrorText>
          <Button label={`Siparişi gönder · ${tl(price.total)}`} onPress={send} busy={busy} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
