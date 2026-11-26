import type { ReactNode } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Card, ErrorText, Input, Loading, Muted, Screen, T, Title } from '../../components/ui';
import {
  COSTS,
  createCoupon,
  FREE_COUPON_LIMIT,
  CouponError,
  IDEAS,
  IDEAS_EN,
  markUsed,
  PREMIUM_LIMITS_ENABLED,
  redeemCoupon,
  removeCoupon,
  useCoupons,
  walletOf,
  type Coupon,
} from '../../lib/coupons';
import { useL, useLang } from '../../lib/i18n';
import { useSession } from '../../lib/session';
import { tx } from '../../lib/theme';
import { useTheme } from '../../lib/useTheme';

export default function Coupons() {
  const t = useTheme();
  const l = useL();
  const { user, couple, partnerId, partnerName } = useSession();
  const coupons = useCoupons(couple?.id);
  const [adding, setAdding] = useState(false);
  // Ana sayfadaki "Kupon yaz" kısayolu doğrudan yazma alanını açar.
  const { new: openNew } = useLocalSearchParams<{ new?: string }>();
  useEffect(() => {
    if (openNew) setAdding(true);
  }, [openNew]);

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
          <Muted style={{ fontSize: 13 }}>{tx(t, l(`${t.copy.points} harcayabilirsin`, `${t.copy.points} to spend`))}</Muted>
        </View>
      </View>

      <HowItWorks partnerName={partnerName} open={coupons.length === 0} />

      {owedToMe.length > 0 && (
        <Section
          title={l(`${partnerName} sana borçlu`, `${partnerName} owes you`)}
          hint={l('Açtığın kuponlar. Yerine getirdiğinde o işaretleyecek.', 'Coupons you opened. They’ll mark them once they deliver.')}
        >
          {owedToMe.map((c) => (
            <Ticket key={c.id} coupon={c} badge={l('Açıldı', 'Opened')} />
          ))}
        </Section>
      )}

      <Section
        title={l(`${partnerName}'in kuponları`, `${partnerName}'s coupons`)}
        hint={
          forSale.length
            ? l('Puanınla bir kupon aç, gerçek hayatta tadını çıkar.', 'Open one with your points and enjoy it in real life.')
            : l(`${partnerName} henüz kupon yazmadı.`, `${partnerName} hasn't written any coupons yet.`)
        }
      >
        {forSale.map((c) => (
          <RedeemTicket key={c.id} coupon={c} coupleId={couple.id} uid={user.uid} wallet={wallet} />
        ))}
      </Section>

      <Section
        title={l('Senin kuponların', 'Your coupons')}
        hint={l(`${partnerName} bunları puanıyla açabilir.`, `${partnerName} can open these with their points.`)}
      >
        {mine.map((c) => (
          <MyTicket key={c.id} coupon={c} coupleId={couple.id} partnerName={partnerName} />
        ))}
        {adding ? (
          <NewCoupon coupleId={couple.id} uid={user.uid} onDone={() => setAdding(false)} />
        ) : atLimit ? (
          <Muted>
            {l(
              `Ücretsiz planda aynı anda ${FREE_COUPON_LIMIT} kupon yazabilirsin. Premium ile sınırsız.`,
              `On the free plan you can have ${FREE_COUPON_LIMIT} coupons at a time. Unlimited with Premium.`,
            )}
          </Muted>
        ) : (
          <Button label={l('Yeni kupon yaz', 'Write a new coupon')} variant="secondary" onPress={() => setAdding(true)} />
        )}
      </Section>

      {used.length > 0 && (
        <Section title={l('Kullanılanlar', 'Used')}>
          {used.map((c) => (
            <Ticket key={c.id} coupon={c} faded badge={l('Kullanıldı', 'Used')} />
          ))}
        </Section>
      )}
    </Screen>
  );
}

// "Buranın olayı ne?" — kuponların mantığı üç adımda. Hiç kupon yokken açık gelir, sonra tek dokunuşla açılır.
function HowItWorks({ partnerName, open: openAtStart }: { partnerName: string; open: boolean }) {
  const t = useTheme();
  const l = useL();
  const [open, setOpen] = useState(openAtStart);
  const steps = [
    [
      'create-outline',
      l('Kupon yaz', 'Write a coupon'),
      l(
        `Partnerine vermek istediğin bir sözü yaz: "Kahvaltı benden", "Bir akşam telefonsuz". Bir de puan fiyatı koy.`,
        `Write a promise for your partner: "Breakfast is on me", "A phone-free evening". Then set a price in points.`,
      ),
    ],
    [
      'star-outline',
      l('Puan birikir', 'Points add up'),
      l(
        'Günlük görevleri birlikte tamamladıkça ortak puanınız artar. İkiniz de aynı kasadan harcarsınız.',
        'Your shared points grow as you finish daily tasks together. You both spend from the same pot.',
      ),
    ],
    [
      'gift-outline',
      l('Kuponu aç', 'Open a coupon'),
      l(
        `${partnerName} puanıyla kuponunu açar; sen sözünü gerçek hayatta yerine getirince "Yapıldı" dersin. Tersi de aynı.`,
        `${partnerName} opens your coupon with points; once you keep your promise in real life, you mark it done. Same the other way around.`,
      ),
    ],
  ] as const;
  return (
    <View style={{ borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius.card, padding: 14, gap: 10 }}>
      <Pressable onPress={() => setOpen((o) => !o)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="help-circle-outline" size={20} color={t.colors.primary} />
        <T style={{ flex: 1, fontWeight: '600', fontFamily: t.fonts.button }}>
          {tx(t, l('Kuponlar nasıl çalışır?', 'How do coupons work?'))}
        </T>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={t.colors.muted} />
      </Pressable>
      {open &&
        steps.map(([icon, title, text]) => (
          <View key={title} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <Ionicons name={icon} size={20} color={t.colors.primary} style={{ marginTop: 1 }} />
            <View style={{ flex: 1, gap: 2 }}>
              <T style={{ fontWeight: '600' }}>{title}</T>
              <Muted style={{ fontSize: 13 }}>{text}</Muted>
            </View>
          </View>
        ))}
    </View>
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
  const l = useL();
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
          {coupon.cost} {l('puan', 'pts')}
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
  const l = useL();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const short = wallet < coupon.cost;

  async function redeem() {
    setError('');
    if (short)
      return setError(
        l(
          `${coupon.cost - wallet} puan daha lazım. Görevleri tamamladıkça birikir.`,
          `You need ${coupon.cost - wallet} more points. They add up as you finish tasks.`,
        ),
      );
    setBusy(true);
    try {
      await redeemCoupon(coupleId, coupon.id, uid);
    } catch (e) {
      const code = e instanceof CouponError ? e.code : null;
      setError(
        code === 'notfound'
          ? l('Kupon bulunamadı.', 'Coupon not found.')
          : code === 'taken'
            ? l('Bu kupon zaten açılmış.', 'This coupon is already open.')
            : code === 'own'
              ? l('Kendi kuponunu açamazsın.', "You can't open your own coupon.")
              : code === 'short'
                ? l('Yeterli puanın yok.', "You don't have enough points.")
                : l('Kupon açılamadı.', "Couldn't open the coupon."),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Ticket coupon={coupon}>
      <Button
        label={l(`${coupon.cost} puanla aç`, `Open for ${coupon.cost} points`)}
        variant={short ? 'secondary' : 'primary'}
        onPress={redeem}
        busy={busy}
      />
      <ErrorText>{error}</ErrorText>
    </Ticket>
  );
}

function MyTicket({ coupon, coupleId, partnerName }: { coupon: Coupon; coupleId: string; partnerName: string }) {
  const t = useTheme();
  const l = useL();
  const [busy, setBusy] = useState(false);

  if (coupon.status === 'redeemed') {
    return (
      <Ticket coupon={coupon} badge={l(`${partnerName} açtı`, `${partnerName} opened it`)}>
        <Muted style={{ fontSize: 13 }}>{l('Sözünü tuttuğunda işaretle.', 'Mark it once you’ve kept your promise.')}</Muted>
        <Button
          label={l('Yerine getirdim', 'Done')}
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
          {l('Kaldır', 'Remove')}
        </Text>
      </Pressable>
    </Ticket>
  );
}

function NewCoupon({ coupleId, uid, onDone }: { coupleId: string; uid: string; onDone: () => void }) {
  const t = useTheme();
  const l = useL();
  const { lang } = useLang();
  const ideas = lang === 'en' ? IDEAS_EN : IDEAS;
  const [title, setTitle] = useState('');
  const [cost, setCost] = useState(20);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setError('');
    if (!title.trim()) return setError(l('Kuponun ne olduğunu yaz.', 'Write what the coupon is for.'));
    setBusy(true);
    try {
      await createCoupon(coupleId, uid, title, cost);
      onDone();
    } catch {
      setError(l('Kaydedilemedi, tekrar dene.', "Couldn't save, please try again."));
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
      <Input
        placeholder={l('Kuponun ne? Örn. Kahvaltı benden', 'What’s the coupon? e.g. Breakfast is on me')}
        value={title}
        onChangeText={setTitle}
        maxLength={60}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {ideas.map((idea) => (
          <Pressable key={idea} onPress={() => setTitle(idea)} style={chip(title === idea)}>
            <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.text, fontSize: 13 }}>
              {idea}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <Muted style={{ fontSize: 13 }}>{l('Kaç puan değerinde?', 'How many points is it worth?')}</Muted>
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
        <Button style={{ flex: 1 }} label={l('Vazgeç', 'Cancel')} variant="secondary" onPress={onDone} />
        <Button style={{ flex: 1 }} label={l('Kaydet', 'Save')} onPress={save} busy={busy} />
      </View>
    </Card>
  );
}
