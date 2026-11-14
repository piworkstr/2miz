import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Card, Input, Loading, Muted, Screen, T, Title } from '../../components/ui';
import { trDate } from '../../lib/date';
import {
  addStamp,
  cardOf,
  CATS,
  codeOf,
  getCode,
  PERIODS,
  redeemReward,
  usePartners,
  usePerks,
  type Partner,
  type Perk,
  type StampResult,
} from '../../lib/perks';
import { useSession, type Couple } from '../../lib/session';
import { tx } from '../../lib/theme';
import { useTheme } from '../../lib/useTheme';

const REWARD_SHOW_MS = 15 * 60_000; // ödül kullanılınca kasada gösterilecek ekranın süresi
const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const hhmm = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// Bir mekanın avantajı: damga kartı ya da indirim kodu.
// "c" parametresi kasadaki karekoddan gelir (uygulama içi okuyucu ya da telefonun kamerası); gelince damga hemen işlenir.
export default function PerkDetail() {
  const t = useTheme();
  const { id, c } = useLocalSearchParams<{ id: string; c?: string }>();
  const { user, couple, profile, partnerName } = useSession();
  const partners = usePartners();
  const perks = usePerks(couple?.id);
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState<StampResult | null>(null);
  const tried = useRef<string | null>(null);

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  // Karekoddan gelen kodu bir kez dene.
  useEffect(() => {
    if (!c || !user || !couple || perks === null || tried.current === c) return;
    tried.current = c;
    addStamp(couple, user.uid, id, c, perks).then(setResult);
  }, [c, user, couple, perks, id]);

  if (!user || !couple || partners === null || perks === null) return <Loading />;
  const p = partners.find((x) => x.id === id && x.active);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/perks'));

  return (
    <Screen>
      <Pressable onPress={back} hitSlop={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Ionicons name="chevron-back" size={22} color={t.colors.text} />
        <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.text, fontSize: 15, fontFamily: t.fonts.body }}>
          {tx(t, 'Avantajlar')}
        </Text>
      </Pressable>
      {!p ? (
        <Muted>Bu mekan şu an listede değil.</Muted>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: (CATS[p.cat] ?? CATS.diger).soft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={(CATS[p.cat] ?? CATS.diger).icon} size={24} color={(CATS[p.cat] ?? CATS.diger).color} />
            </View>
            <View style={{ flex: 1 }}>
              <Title>{p.name}</Title>
            </View>
          </View>
          <Muted>{[p.area, p.city].filter(Boolean).join(' · ')}</Muted>
          {p.type === 'stamp' ? (
            <StampCard
              p={p}
              perks={perks}
              couple={couple}
              uid={user.uid}
              names={`${profile?.name ?? 'Sen'} ve ${partnerName}`}
              now={now}
              result={result}
              onResult={setResult}
            />
          ) : (
            <CodeCard p={p} perks={perks} couple={couple} uid={user.uid} now={now} />
          )}
          {!!p.note && <Muted>{p.note}</Muted>}
        </>
      )}
    </Screen>
  );
}

function StampCard(props: {
  p: Partner;
  perks: Perk[];
  couple: Couple;
  uid: string;
  names: string;
  now: number;
  result: StampResult | null;
  onResult: (r: StampResult | null) => void;
}) {
  const { p, perks, couple, uid, now, result } = props;
  const t = useTheme();
  const card = cardOf(p, perks, now);
  const [manual, setManual] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const lastRedeem = perks.filter((x) => x.pid === p.id && x.t === 'redeem').sort((a, b) => b.atMs - a.atMs)[0];
  const showing = lastRedeem && now - lastRedeem.atMs < REWARD_SHOW_MS ? lastRedeem : null;
  const who = (id: string) => couple.names?.[id] ?? '';

  async function enter() {
    if (code.trim().length !== 6 || busy) return;
    setBusy(true);
    props.onResult(await addStamp(couple, uid, p.id, code.trim(), perks));
    setBusy(false);
    setCode('');
  }
  async function redeem() {
    if (busy) return;
    setBusy(true);
    try {
      await redeemReward(couple, uid, p, perks);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {showing && (
        <Card style={{ backgroundColor: t.colors.successSoft, borderColor: t.colors.success, alignItems: 'center', gap: 6 }}>
          <Ionicons name="gift" size={36} color={t.colors.success} />
          <T style={{ fontSize: 20, fontWeight: '700', color: t.colors.success, textAlign: 'center' }}>Ödül geçerli</T>
          <T style={{ textAlign: 'center' }}>{p.offer}</T>
          <Muted style={{ textAlign: 'center' }}>
            {`Bu ekranı kasada gösterin · ${hhmm(showing.atMs)} · kalan ${clock(showing.atMs + REWARD_SHOW_MS - now)}`}
          </Muted>
        </Card>
      )}

      <Card style={{ backgroundColor: t.colors.primarySoft, borderColor: t.colors.primarySoft, gap: 14 }}>
        <View style={{ gap: 2 }}>
          <T style={{ fontSize: 17, fontWeight: '700', color: t.colors.onPrimarySoft }}>{p.offer}</T>
          <Muted>{`${props.names}’in ortak kartı`}</Muted>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {Array.from({ length: card.goal }, (_, i) => (
            <View
              key={i}
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: i < card.filled ? t.colors.primary : 'transparent',
                borderWidth: i < card.filled ? 0 : 1.5,
                borderStyle: 'dashed',
                borderColor: t.colors.primary,
              }}
            >
              {i < card.filled && <Ionicons name="heart" size={20} color={t.colors.onPrimary} />}
            </View>
          ))}
        </View>
        <T style={{ color: t.colors.onPrimarySoft, fontWeight: '600' }}>
          {card.reward ? 'Kart doldu, ödülünüz hazır 🎁' : `${card.goal - card.filled} damga kaldı`}
        </T>
      </Card>

      {result === 'ok' && <Note icon="checkmark-circle" color={t.colors.success} text="Damga eklendi. Afiyet olsun!" />}
      {result === 'today' && <Note icon="time" color={t.colors.muted} text="Bugün bu mekandan damganızı aldınız. Yarın yine bekleriz." />}
      {result === 'bad' && (
        <Note icon="alert-circle" color={t.colors.primary} text="Kod geçmedi. Kasadaki karttaki kodu yeniden okutun ya da elle girin." />
      )}

      {card.reward ? (
        <>
          <Button label="Kasadayım, ödülü kullan" onPress={redeem} busy={busy} />
          <Muted style={{ textAlign: 'center' }}>Dokununca ödül ekranı açılır ve kart sıfırlanır; kasada görevliye gösterin.</Muted>
        </>
      ) : card.today ? (
        <Muted style={{ textAlign: 'center' }}>Bugünkü damga alındı. Günde bir damga işlenir.</Muted>
      ) : (
        <>
          <Button label="Kasadaki kodu okut" onPress={() => router.push('/perks/scan')} />
          {manual ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Input
                value={code}
                onChangeText={(v) =>
                  setCode(
                    v
                      .replace(/[^0-9a-fA-F]/g, '')
                      .slice(0, 6)
                      .toUpperCase(),
                  )
                }
                placeholder="Karttaki 6 haneli kod"
                autoCapitalize="characters"
                autoCorrect={false}
                style={{ flex: 1, letterSpacing: 2 }}
              />
              <Button label="Ekle" onPress={enter} busy={busy} style={{ minHeight: 50 }} />
            </View>
          ) : (
            <Pressable onPress={() => setManual(true)} style={{ alignSelf: 'center', paddingVertical: 4 }}>
              <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.primary, fontWeight: '600', fontFamily: t.fonts.button }}>
                {tx(t, 'Kodu elle gir')}
              </Text>
            </Pressable>
          )}
        </>
      )}

      <Muted>
        {p.welcome && !card.used ? 'İlk damganız bizden: ilk okutmada iki damga işlenir. ' : ''}
        İkiniz de damga ekleyebilirsiniz; kart ortaktır. Günde bir damga işlenir.
      </Muted>
      {card.last && (
        <Muted
          style={{ fontSize: 12 }}
        >{`Son damga: ${trDate(new Date(card.last.atMs))}${who(card.last.by) ? `, ${who(card.last.by)}` : ''}`}</Muted>
      )}
    </>
  );
}

function CodeCard({ p, perks, couple, uid, now }: { p: Partner; perks: Perk[]; couple: Couple; uid: string; now: number }) {
  const t = useTheme();
  const st = codeOf(p, perks, now);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function show() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await getCode(couple, uid, p, perks);
    } catch {
      setError('Kod alınamadı; bağlantıyı kontrol edip tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  }
  const rule =
    st.period === 'none'
      ? `Kod ${p.ttlMin ?? 15} dakika geçerlidir.`
      : `Kod tek kullanımlıktır ve ${p.ttlMin ?? 15} dakika geçerlidir; ${PERIODS[st.period].toLocaleLowerCase('tr')} alınabilir.`;
  return (
    <>
      <Card style={{ gap: 4 }}>
        <T style={{ fontSize: 17, fontWeight: '700' }}>{p.offer}</T>
        <Muted>{rule}</Muted>
      </Card>
      {st.live ? (
        <Card style={{ alignItems: 'center', gap: 8, borderColor: t.colors.success, backgroundColor: t.colors.successSoft }}>
          <Muted>Bu ekranı görevliye gösterin</Muted>
          <Text
            maxFontSizeMultiplier={1.1}
            selectable
            style={{ fontSize: 34, fontWeight: '800', letterSpacing: 3, color: t.colors.text, fontVariant: ['tabular-nums'] }}
          >
            {st.live.code}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="time-outline" size={16} color={t.colors.success} />
            <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.success, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
              {`${clock(st.expiresAt - now)} geçerli`}
            </Text>
          </View>
        </Card>
      ) : st.canGet ? (
        <>
          <Button label="Kasadayım, kodu göster" onPress={show} busy={busy} />
          <Muted style={{ textAlign: 'center' }}>Kodu mekandayken alın; süre dokunduğunuz an başlar.</Muted>
        </>
      ) : (
        <Note
          icon="checkmark-circle"
          color={t.colors.muted}
          text={`Bu dönemki hakkınızı kullandınız.${st.nextAt ? ` Yenisi ${trDate(new Date(st.nextAt))} günü açılır.` : ''}`}
        />
      )}
      {!!error && <Note icon="alert-circle" color={t.colors.primary} text={error} />}
    </>
  );
}

function Note({ icon, color, text }: { icon: keyof typeof Ionicons.glyphMap; color: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Ionicons name={icon} size={20} color={color} />
      <T style={{ flex: 1 }}>{text}</T>
    </View>
  );
}
