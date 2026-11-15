import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { dayKey } from '../../lib/date';
import { farmAction, PRICE, PRODUCT_NAME, STOCK_EMOJI, type Farm } from '../../lib/farm';
import {
  buyListing,
  createListing,
  loadMarket,
  MARKET_HOURS,
  MARKET_MAX,
  MARKET_MAX_QTY,
  settleMine,
  takeBack,
  traderOffers,
  unitRange,
  type Listing,
} from '../../lib/market';
import { useTheme } from '../../lib/useTheme';
import { Button, Card, ErrorText, Input, Muted, T, Title } from '../ui';

type Who = { coupleId: string; uid: string; name: string; partnerName: string };
const label = (key: string, n: number) => `${STOCK_EMOJI[key] ? `${STOCK_EMOJI[key]} ` : ''}${n} ${PRODUCT_NAME[key] ?? key}`;

// Çiftçi pazarı: başka çiftliklerin ilanları, gezgin tüccar ve kendi tezgâhın. Depodan açılır.
export function FarmMarket({ open, onClose, farm, who }: { open: boolean; onClose: () => void; farm: Farm; who: Who }) {
  const t = useTheme();
  const [tab, setTab] = useState<'al' | 'sat'>('al');
  const [list, setList] = useState<Listing[] | null>(null);
  const [mine, setMine] = useState<Listing[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [sell, setSell] = useState<{ key: string; n: number; unit: number } | null>(null);

  async function refresh() {
    setError('');
    try {
      const s = await settleMine(who);
      setMine(s.open);
      if (s.sold || s.back)
        setMsg(
          [
            s.sold ? `${s.sold} ilanın satıldı: +${s.coins} altın 🧺` : '',
            s.back ? `${s.back} ilanın süresi doldu, ürünler depoya döndü` : '',
          ]
            .filter(Boolean)
            .join(' · '),
        );
      setList(await loadMarket(who.coupleId));
    } catch {
      setList((l) => l ?? []);
      setError('Pazar yüklenemedi; bağlantıyı kontrol edip tekrar dene.');
    }
  }
  useEffect(() => {
    if (!open) return;
    setMsg('');
    setSell(null);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function run(id: string, fn: () => Promise<string | null>, ok: string) {
    if (busy) return;
    setBusy(id);
    setError('');
    setMsg('');
    try {
      const r = await fn();
      if (r) setError(r);
      else {
        setMsg(ok);
        setSell(null);
      }
    } catch {
      setError('Olmadı; bağlantıyı kontrol edip tekrar dene.');
    }
    await refresh();
    setBusy(null);
  }
  const act = async (a: Parameters<typeof farmAction>[4]) => {
    const r = await farmAction(who.coupleId, who.uid, who.name, who.partnerName, a);
    return typeof r === 'string' ? r : null;
  };

  const today = dayKey();
  const got = farm.trader?.day === today ? farm.trader.got : [];
  const offers = traderOffers(today);
  const stock = Object.entries(farm.stock).filter(([k, n]) => n > 0 && PRICE[k]);
  const tabBtn = (id: 'al' | 'sat', text: string) => (
    <Pressable
      onPress={() => setTab(id)}
      style={{
        flex: 1,
        paddingVertical: 10,
        borderRadius: t.radius.pill,
        alignItems: 'center',
        backgroundColor: tab === id ? t.colors.primary : t.colors.primarySoft,
      }}
    >
      <Text
        maxFontSizeMultiplier={1.25}
        style={{ color: tab === id ? t.colors.onPrimary : t.colors.primary, fontWeight: '600', fontFamily: t.fonts.button }}
      >
        {text}
      </Text>
    </Pressable>
  );
  const Step = ({ icon, onPress }: { icon: 'remove' | 'add'; onPress: () => void }) => (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: t.colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={icon} size={20} color={t.colors.primary} />
    </Pressable>
  );

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Title>Çiftçi pazarı</Title>
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Kapat">
              <Ionicons name="close" size={28} color={t.colors.text} />
            </Pressable>
          </View>
          <Muted>{`Diğer çiftliklerle alışveriş. Altının: ${farm.coins}`}</Muted>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {tabBtn('al', 'Satın al')}
            {tabBtn('sat', `Tezgâhım (${mine.length}/${MARKET_MAX})`)}
          </View>
          {!!msg && <Muted style={{ color: t.colors.primary, fontWeight: '600' }}>{msg}</Muted>}
          {!!error && <ErrorText>{error}</ErrorText>}

          {tab === 'al' ? (
            <>
              <Muted style={{ fontWeight: '600' }}>Çiftliklerden</Muted>
              {list === null ? (
                <Muted>Pazar yükleniyor…</Muted>
              ) : list.length ? (
                list.map((l) => (
                  <Card key={l.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <T style={{ fontWeight: '600', fontFamily: t.fonts.button }}>{label(l.key, l.n)}</T>
                      <Muted>{`${l.farm} · seviye ${l.lvl}`}</Muted>
                    </View>
                    <Button
                      label={`${l.price} altın`}
                      busy={busy === l.id}
                      variant={farm.coins >= l.price ? 'primary' : 'secondary'}
                      onPress={() => run(l.id, () => buyListing(who, l), `${label(l.key, l.n)} depona eklendi.`)}
                    />
                  </Card>
                ))
              ) : (
                <Muted>Şu an başka çiftlikten ilan yok. İlk tezgâhı sen kur; bu arada gezgin tüccara bakabilirsin.</Muted>
              )}

              <Muted style={{ fontWeight: '600', marginTop: 6 }}>Gezgin tüccar · bugünün teklifleri</Muted>
              {offers.map((o) => {
                const done = got.includes(o.id);
                return (
                  <Card key={o.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: done ? 0.55 : 1 }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <T style={{ fontWeight: '600', fontFamily: t.fonts.button }}>{label(o.key, o.n)}</T>
                      <Muted>{done ? 'Bugün alındı' : 'Günde bir kez'}</Muted>
                    </View>
                    {!done && (
                      <Button
                        label={`${o.cost} altın`}
                        busy={busy === o.id}
                        variant={farm.coins >= o.cost ? 'primary' : 'secondary'}
                        onPress={() =>
                          run(
                            o.id,
                            () => act({ a: 'trader', i: 0, key: o.key, n: o.n, cost: o.cost, offer: o.id, day: today }),
                            `${label(o.key, o.n)} depona eklendi.`,
                          )
                        }
                      />
                    )}
                  </Card>
                );
              })}
            </>
          ) : !farm.name ? (
            <>
              <Muted>
                Pazarda gerçek adınız görünmez; ilanlarınız çiftlik adıyla çıkar. Önce çiftliğinize bir ad verin (sonra değiştirilebilir).
              </Muted>
              <Input value={name} onChangeText={setName} placeholder="Örn. Papatya Çiftliği" maxLength={22} />
              <Button
                label="Adı kaydet"
                busy={busy === 'name'}
                onPress={() => run('name', () => act({ a: 'rename', i: 0, name }), 'Çiftlik adı kaydedildi.')}
              />
            </>
          ) : (
            <>
              <Muted>{`${farm.name} · ilanlar ${MARKET_HOURS} saat açık kalır, satılmazsa depoya döner.`}</Muted>
              {mine.map((l) => (
                <Card key={l.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T style={{ fontWeight: '600', fontFamily: t.fonts.button }}>{label(l.key, l.n)}</T>
                    <Muted>{`${l.price} altın · ${Math.max(1, Math.round((l.expMs - Date.now()) / 3600000))} saat kaldı`}</Muted>
                  </View>
                  <Button
                    label="Geri çek"
                    variant="secondary"
                    busy={busy === l.id}
                    onPress={() => run(l.id, () => takeBack(who, l.id), 'İlan geri çekildi, ürün depoda.')}
                  />
                </Card>
              ))}

              {mine.length >= MARKET_MAX ? (
                <Muted>Tezgâh dolu. Yeni ilan için birinin satılmasını bekle ya da birini geri çek.</Muted>
              ) : sell ? (
                (() => {
                  const [lo, hi] = unitRange(sell.key);
                  const have = Math.min(farm.stock[sell.key] ?? 0, MARKET_MAX_QTY);
                  return (
                    <Card style={{ gap: 12 }}>
                      <T
                        style={{ fontWeight: '600', fontFamily: t.fonts.button }}
                      >{`${PRODUCT_NAME[sell.key]} · depoda ${farm.stock[sell.key] ?? 0}`}</T>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Muted style={{ flex: 1 }}>Adet</Muted>
                        <Step icon="remove" onPress={() => setSell({ ...sell, n: Math.max(1, sell.n - 1) })} />
                        <T style={{ minWidth: 34, textAlign: 'center', fontWeight: '600' }}>{String(sell.n)}</T>
                        <Step icon="add" onPress={() => setSell({ ...sell, n: Math.min(have, sell.n + 1) })} />
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Muted style={{ flex: 1 }}>{`Tanesi (${lo}-${hi} altın)`}</Muted>
                        <Step
                          icon="remove"
                          onPress={() =>
                            setSell({ ...sell, unit: Math.max(lo, sell.unit - Math.max(1, Math.round(PRICE[sell.key] / 10))) })
                          }
                        />
                        <T style={{ minWidth: 34, textAlign: 'center', fontWeight: '600' }}>{String(sell.unit)}</T>
                        <Step
                          icon="add"
                          onPress={() =>
                            setSell({ ...sell, unit: Math.min(hi, sell.unit + Math.max(1, Math.round(PRICE[sell.key] / 10))) })
                          }
                        />
                      </View>
                      <Muted>{`Sistem fiyatı tanesi ${PRICE[sell.key]} altın. Bu ilan satılırsa ${sell.n * sell.unit} altın kazanırsınız.`}</Muted>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Button
                          style={{ flex: 1 }}
                          label={`İlana koy · ${sell.n * sell.unit} altın`}
                          busy={busy === 'new'}
                          onPress={() => run('new', () => createListing(who, sell.key, sell.n, sell.unit), 'İlan tezgâhta.')}
                        />
                        <Button label="Vazgeç" variant="secondary" onPress={() => setSell(null)} />
                      </View>
                    </Card>
                  );
                })()
              ) : stock.length ? (
                <>
                  <Muted style={{ fontWeight: '600', marginTop: 6 }}>Depodan ilana koy</Muted>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {stock.map(([k, n]) => (
                      <Pressable
                        key={k}
                        onPress={() => setSell({ key: k, n: Math.min(n, 5), unit: PRICE[k] })}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 9,
                          borderRadius: t.radius.pill,
                          backgroundColor: t.colors.primarySoft,
                        }}
                      >
                        <Text
                          maxFontSizeMultiplier={1.25}
                          style={{ color: t.colors.primary, fontWeight: '600', fontFamily: t.fonts.button }}
                        >
                          {label(k, n)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : (
                <Muted>Depo boş. Hasat edip ya da mutfakta bir şeyler yapıp gel.</Muted>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
