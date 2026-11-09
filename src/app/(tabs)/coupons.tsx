import type { ReactNode } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Card, ErrorText, Input, Loading, Muted, Screen, T, Title } from '../../components/ui';
import {
  COSTS,
  createCoupon,
  FREE_COUPON_LIMIT,
  IDEAS,
  markUsed,
  PREMIUM_LIMITS_ENABLED,
  redeemCoupon,
  removeCoupon,
  useCoupons,
  walletOf,
  type Coupon,
} from '../../lib/coupons';
import { useSession } from '../../lib/session';
import { tx } from '../../lib/theme';
import { useTheme } from '../../lib/useTheme';

export default function Coupons() {
  const t = useTheme();
  const { user, couple, partnerId, partnerName } = useSession();
  const coupons = useCoupons(couple?.id);
  const [adding, setAdding] = useState(false);

  if (!user || !couple || !partnerId || coupons === null) return <Loading />;

  const wallet = walletOf(couple, user.uid);
  const theirs = coupons.filter((c) => c.owner === partnerId && c.status !== 'used');
  const mine = coupons.filter((c) => c.owner === user.uid && c.status !== 'used');
  const owedToMe = theirs.filter((c) => c.status === 'redeemed');
  const forSale = theirs.filter((c) => c.status === 'active');
  const used = coupons.filter((c) => c.status === 'used').slice(0, 10);
  const myActive = mine.filter((c) => c.status === 'active').length;
  const atLimit = PREMIUM_LIMITS_ENABLED && myActive >= FREE_COUPON_LIMIT;

  return (
    <Screen>
      <Title>{t.copy.tabs.coupons}</Title>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: t.colors.primarySoft,
          borderRadius: t.radius.card,
          padding: 16,
        }}
      >
        <Ionicons name={t.id === 'asko' ? 'heart' : 'star'} size={26} color={t.colors.primary} />
        <View style={{ flex: 1 }}>
          <T style={{ fontSize: 24, fontWeight: '700', fontFamily: t.fonts.button }}>{String(wallet)}</T>
          <Muted style={{ fontSize: 13 }}>{tx(t, `${t.copy.points} harcayabilirsin`)}</Muted>
        </View>
      </View>

      {owedToMe.length > 0 && (
        <Section title={`${partnerName} sana borçlu`} hint="Açtığın kuponlar. Yerine getirdiğinde o işaretleyecek.">
          {owedToMe.map((c) => (
            <Ticket key={c.id} coupon={c} badge="Açıldı" />
          ))}
        </Section>
      )}

      <Section
        title={`${partnerName}'in kuponları`}
        hint={forSale.length ? 'Puanınla bir kupon aç, gerçek hayatta tadını çıkar.' : `${partnerName} henüz kupon yazmadı.`}
      >
        {forSale.map((c) => (
          <RedeemTicket key={c.id} coupon={c} coupleId={couple.id} uid={user.uid} wallet={wallet} />
        ))}
      </Section>

      <Section title="Senin kuponların" hint={`${partnerName} bunları puanıyla açabilir.`}>
        {mine.map((c) => (
          <MyTicket key={c.id} coupon={c} coupleId={couple.id} partnerName={partnerName} />
        ))}
        {adding ? (
          <NewCoupon coupleId={couple.id} uid={user.uid} onDone={() => setAdding(false)} />
        ) : atLimit ? (
          <Muted>Ücretsiz planda aynı anda {FREE_COUPON_LIMIT} kupon yazabilirsin. Premium ile sınırsız.</Muted>
        ) : (
          <Button label="Yeni kupon yaz" variant="secondary" onPress={() => setAdding(true)} />
        )}
      </Section>

      {used.length > 0 && (
        <Section title="Kullanılanlar">
          {used.map((c) => (
            <Ticket key={c.id} coupon={c} faded badge="Kullanıldı" />
          ))}
        </Section>
      )}
    </Screen>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: 10 }}>
      <View style={{ gap: 2 }}>
        <T style={{ fontSize: 17, fontWeight: '600', fontFamily: t.fonts.button }}>{tx(t, title)}</T>
        {hint && <Muted style={{ fontSize: 13 }}>{hint}</Muted>}
      </View>
      {children}
    </View>
  );
}

function Ticket({ coupon, badge, faded, children }: { coupon: Coupon; badge?: string; faded?: boolean; children?: ReactNode }) {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.colors.card,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: faded ? t.colors.border : t.colors.primary,
        borderRadius: Math.min(t.radius.card, 14),
        padding: 14,
        gap: 10,
        opacity: faded ? 0.6 : 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <Text
          maxFontSizeMultiplier={1.25}
          style={{ flex: 1, fontFamily: t.fonts.note, fontSize: 25, lineHeight: 28, color: t.colors.text }}
        >
          {coupon.title}
        </Text>
        <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.primary, fontWeight: '700', fontSize: 14 }}>
          {coupon.cost} puan
        </Text>
      </View>
      {badge && (
        <Text
          maxFontSizeMultiplier={1.25}
          style={{
            alignSelf: 'flex-start',
            backgroundColor: t.colors.primarySoft,
            color: t.colors.primary,
            fontSize: 12,
            fontWeight: '600',
            paddingHorizontal: 9,
            paddingVertical: 3,
            borderRadius: t.radius.pill,
            overflow: 'hidden',
          }}
        >
          {badge}
        </Text>
      )}
      {children}
    </View>
  );
}

function RedeemTicket({ coupon, coupleId, uid, wallet }: { coupon: Coupon; coupleId: string; uid: string; wallet: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const short = wallet < coupon.cost;

  async function redeem() {
    setError('');
    if (short) return setError(`${coupon.cost - wallet} puan daha lazım. Görevleri tamamladıkça birikir.`);
    setBusy(true);
    try {
      await redeemCoupon(coupleId, coupon.id, uid);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kupon açılamadı.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Ticket coupon={coupon}>
      <Button label={`${coupon.cost} puanla aç`} variant={short ? 'secondary' : 'primary'} onPress={redeem} busy={busy} />
      <ErrorText>{error}</ErrorText>
    </Ticket>
  );
}

function MyTicket({ coupon, coupleId, partnerName }: { coupon: Coupon; coupleId: string; partnerName: string }) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);

  if (coupon.status === 'redeemed') {
    return (
      <Ticket coupon={coupon} badge={`${partnerName} açtı`}>
        <Muted style={{ fontSize: 13 }}>Sözünü tuttuğunda işaretle.</Muted>
        <Button
          label="Yerine getirdim"
          busy={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await markUsed(coupleId, coupon.id);
            } finally {
              setBusy(false);
            }
          }}
        />
      </Ticket>
    );
  }

  return (
    <Ticket coupon={coupon}>
      <Pressable onPress={() => removeCoupon(coupleId, coupon.id)} hitSlop={8} style={{ alignSelf: 'flex-end' }}>
        <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.muted, fontSize: 13 }}>
          Kaldır
        </Text>
      </Pressable>
    </Ticket>
  );
}

function NewCoupon({ coupleId, uid, onDone }: { coupleId: string; uid: string; onDone: () => void }) {
  const t = useTheme();
  const [title, setTitle] = useState('');
  const [cost, setCost] = useState(20);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setError('');
    if (!title.trim()) return setError('Kuponun ne olduğunu yaz.');
    setBusy(true);
    try {
      await createCoupon(coupleId, uid, title, cost);
      onDone();
    } catch {
      setError('Kaydedilemedi, tekrar dene.');
      setBusy(false);
    }
  }

  const chip = (on: boolean) => ({
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: t.radius.pill + 8,
    borderWidth: 1.5,
    borderColor: on ? t.colors.primary : t.colors.border,
    backgroundColor: on ? t.colors.primarySoft : t.colors.card,
  });

  return (
    <Card>
      <Input placeholder="Kuponun ne? Örn. Kahvaltı benden" value={title} onChangeText={setTitle} maxLength={60} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {IDEAS.map((idea) => (
          <Pressable key={idea} onPress={() => setTitle(idea)} style={chip(title === idea)}>
            <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.text, fontSize: 13 }}>
              {idea}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <Muted style={{ fontSize: 13 }}>Kaç puan değerinde?</Muted>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {COSTS.map((c) => (
          <Pressable key={c} onPress={() => setCost(c)} style={chip(cost === c)}>
            <Text maxFontSizeMultiplier={1.25} style={{ color: cost === c ? t.colors.primary : t.colors.text, fontWeight: '600' }}>
              {c}
            </Text>
          </Pressable>
        ))}
      </View>
      <ErrorText>{error}</ErrorText>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button style={{ flex: 1 }} label="Vazgeç" variant="secondary" onPress={onDone} />
        <Button style={{ flex: 1 }} label="Kaydet" onPress={save} busy={busy} />
      </View>
    </Card>
  );
}
