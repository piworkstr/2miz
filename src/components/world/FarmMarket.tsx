import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { dayKey } from '../../lib/date';
import { farmAction, levelOf, PRICE, PRODUCT_NAME, STALL_GOODS, STALL_MAX, STOCK_EMOJI, stallPrice, type Farm } from '../../lib/farm';
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
import { ART, stockArt } from '../../lib/farmArt';

type Who = { coupleId: string; uid: string; name: string; partnerName: string };
const label = (key: string, n: number) => `${n} ${PRODUCT_NAME[key] ?? key}`;

// Çiftliğin kendi renkleri: krem zemin, ahşap çerçeve.
const INK = '#4A2E14';
const MUTED = '#8A6F4A';
const BROWN = '#9A6534';
const CREAM = '#FFF8E8';
const CELL = '#FBFAF6';
const LINE = '#E5C99B';
const SAND = '#F6D58E';
const ROSE = '#E8516A';
const GOLD = '#7A5A00';

function Icon({ k, size }: { k: string; size: number }) {
  const a = stockArt(k);
  if (a) return <Image source={a.src} style={{ width: size, height: size }} resizeMode="contain" />;
  return (
    <Text maxFontSizeMultiplier={1.0} style={{ fontSize: Math.round(size * 0.7), lineHeight: size, height: size, textAlign: 'center' }}>
      {STOCK_EMOJI[k] ?? '📦'}
    </Text>
  );
}
function Coins({ n, size = 14, color = GOLD }: { n: number | string; size?: number; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Image source={ART.coin.src} style={{ width: size + 2, height: size + 2 }} resizeMode="contain" />
      <Text maxFontSizeMultiplier={1.1} style={{ fontWeight: '900', fontSize: size, color }}>
        {n}
      </Text>
    </View>
  );
}
function Heading({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 6 }}>
      <Text maxFontSizeMultiplier={1.15} style={{ flex: 1, fontWeight: '900', fontSize: 18, color: INK }}>
        {title}
      </Text>
      {!!sub && (
        <Text maxFontSizeMultiplier={1.15} style={{ fontSize: 12, color: MUTED }}>
          {sub}
        </Text>
      )}
    </View>
  );
}
const Note = ({ children }: { children: ReactNode }) => (
  <Text maxFontSizeMultiplier={1.2} style={{ color: MUTED, fontSize: 13, lineHeight: 18 }}>
    {children}
  </Text>
);
// Altın fiyatlı düğme: kum rengi; "ana" olan pembe. Yetmeyen altında soluk durur ama basılabilir (uyarı verir).
function Pill({
  children,
  onPress,
  main,
  busy,
  dim,
  flex,
}: {
  children: ReactNode;
  onPress: () => void;
  main?: boolean;
  busy?: boolean;
  dim?: boolean;
  flex?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => ({
        flex: flex ? 1 : undefined,
        minHeight: 40,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: main ? ROSE : SAND,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed || dim ? 0.6 : 1,
      })}
    >
      {busy ? <ActivityIndicator color={main ? '#fff' : INK} /> : children}
    </Pressable>
  );
}
const pillText = (text: string, main?: boolean) => (
  <Text maxFontSizeMultiplier={1.15} style={{ fontWeight: '900', fontSize: 14, color: main ? '#fff' : INK }}>
    {text}
  </Text>
);
function Stepper({ n, onChange, min, max }: { n: number; onChange: (n: number) => void; min: number; max: number }) {
  const btn = (icon: 'remove' | 'add', d: number) => (
    <Pressable
      onPress={() => onChange(Math.min(max, Math.max(min, n + d)))}
      onLongPress={() => onChange(Math.min(max, Math.max(min, n + d * 10)))}
      hitSlop={6}
      style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: SAND, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name={icon} size={20} color={INK} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {btn('remove', -1)}
      <Text maxFontSizeMultiplier={1.1} style={{ minWidth: 30, textAlign: 'center', fontWeight: '900', fontSize: 18, color: INK }}>
        {n}
      </Text>
      {btn('add', 1)}
    </View>
  );
}
const row = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
  padding: 10,
  borderRadius: 16,
  borderWidth: 1.5,
  borderColor: LINE,
  backgroundColor: CELL,
} as const;

// Çiftçi pazarı: başka çiftliklerin ilanları, gezgin tüccar ve kendi tezgâhın. Depodan açılır.
export function FarmMarket({ open, onClose, farm, who }: { open: boolean; onClose: () => void; farm: Farm; who: Who }) {
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<'al' | 'sat'>('al');
  const [list, setList] = useState<Listing[] | null>(null);
  const [mine, setMine] = useState<Listing[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [sell, setSell] = useState<{ key: string; n: number; unit: number } | null>(null);
  const [buy, setBuy] = useState<{ key: string; n: number } | null>(null);

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

  const level = levelOf(farm.xp).level;
  const goods = STALL_GOODS.filter((g) => g.lvl <= level);
  const nextGood = STALL_GOODS.find((g) => g.lvl > level);
  const today = dayKey();
  const got = farm.trader?.day === today ? farm.trader.got : [];
  const offers = traderOffers(today);
  const stock = Object.entries(farm.stock).filter(([k, n]) => n > 0 && PRICE[k]);
  const PAD = 16;
  const GAP = 8;
  const cell4 = Math.floor((Math.min(width, 520) - PAD * 2 - GAP * 3) / 4);
  const cell3 = Math.floor((Math.min(width, 520) - PAD * 2 - GAP * 2) / 3);
  const tabBtn = (id: 'al' | 'sat', text: string) => (
    <Pressable
      onPress={() => setTab(id)}
      style={{
        flex: 1,
        minHeight: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tab === id ? ROSE : CELL,
        borderWidth: tab === id ? 0 : 1.5,
        borderColor: LINE,
      }}
    >
      <Text maxFontSizeMultiplier={1.15} style={{ color: tab === id ? '#fff' : INK, fontWeight: '900', fontSize: 15 }}>
        {text}
      </Text>
    </Pressable>
  );
  // Ürün karesi: resim, ad ve altında fiyat ya da adet.
  const tile = (k: string, w: number, on: boolean, below: ReactNode, onPress: () => void, name?: string) => (
    <Pressable
      key={k}
      onPress={onPress}
      style={{
        width: w,
        paddingVertical: 8,
        paddingHorizontal: 2,
        borderRadius: 14,
        borderWidth: on ? 2.5 : 1.5,
        borderColor: on ? ROSE : LINE,
        backgroundColor: on ? '#FDECEF' : CELL,
        alignItems: 'center',
        gap: 2,
      }}
    >
      <Icon k={k} size={Math.min(54, w - 20)} />
      <Text maxFontSizeMultiplier={1.0} numberOfLines={1} style={{ fontWeight: '800', fontSize: 12, color: INK }}>
        {name ?? PRODUCT_NAME[k] ?? k}
      </Text>
      {below}
    </Pressable>
  );

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: SAND }} edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: PAD, paddingVertical: 10 }}>
          {ART.pazar && <Image source={ART.pazar.src} style={{ width: 96, height: 82 }} resizeMode="contain" />}
          <View style={{ flex: 1, gap: 4 }}>
            <Text maxFontSizeMultiplier={1.1} style={{ fontWeight: '900', fontSize: 24, color: INK }}>
              Çiftçi pazarı
            </Text>
            {!!farm.name && (
              <Text maxFontSizeMultiplier={1.1} numberOfLines={1} style={{ fontSize: 13, color: MUTED }}>
                {farm.name}
              </Text>
            )}
            <View
              style={{
                alignSelf: 'flex-start',
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 14,
                backgroundColor: CREAM,
                borderWidth: 1.5,
                borderColor: BROWN,
              }}
            >
              <Coins n={farm.coins} size={15} />
            </View>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityLabel="Kapat"
            style={{
              alignSelf: 'flex-start',
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: CREAM,
              borderWidth: 1.5,
              borderColor: BROWN,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="close" size={20} color={INK} />
          </Pressable>
        </View>
        <View style={{ height: 4, backgroundColor: BROWN }} />
        <ScrollView
          style={{ flex: 1, backgroundColor: CREAM }}
          contentContainerStyle={{ padding: PAD, gap: 10, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {tabBtn('al', 'Satın al')}
            {tabBtn('sat', `Tezgâhım ${mine.length}/${MARKET_MAX}`)}
          </View>
          {!!msg && (
            <Text maxFontSizeMultiplier={1.2} style={{ color: '#3E7F22', fontWeight: '800', fontSize: 13 }}>
              {msg}
            </Text>
          )}
          {!!error && (
            <Text maxFontSizeMultiplier={1.2} style={{ color: '#B93A55', fontWeight: '800', fontSize: 13 }}>
              {error}
            </Text>
          )}

          {tab === 'al' ? (
            <>
              <Heading title="Tezgâh" sub="her zaman açık · 2 kat fiyat" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
                {goods.map((g) =>
                  tile(g.key, cell4, buy?.key === g.key, <Coins n={stallPrice(g.key)} size={12} />, () =>
                    setBuy(buy?.key === g.key ? null : { key: g.key, n: 1 }),
                  ),
                )}
              </View>
              {buy ? (
                <View style={{ ...row, backgroundColor: '#fff', borderColor: BROWN, borderWidth: 2 }}>
                  <Icon k={buy.key} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text maxFontSizeMultiplier={1.1} numberOfLines={1} style={{ fontWeight: '900', fontSize: 15, color: INK }}>
                      {PRODUCT_NAME[buy.key] ?? buy.key}
                    </Text>
                    <Text maxFontSizeMultiplier={1.1} style={{ fontSize: 12, color: MUTED }}>
                      depoda {farm.stock[buy.key] ?? 0}
                    </Text>
                  </View>
                  <Stepper n={buy.n} min={1} max={STALL_MAX} onChange={(n) => setBuy({ key: buy.key, n })} />
                  <Pill
                    main
                    busy={busy === 'stall'}
                    dim={farm.coins < stallPrice(buy.key, buy.n)}
                    onPress={() =>
                      run('stall', () => act({ a: 'stall', i: 0, key: buy.key, n: buy.n }), `${label(buy.key, buy.n)} depona eklendi.`)
                    }
                  >
                    <Coins n={`Al · ${stallPrice(buy.key, buy.n)}`} size={14} color="#fff" />
                  </Pill>
                </View>
              ) : (
                <Note>
                  Ürüne dokun, adedi seç (artıya basılı tutunca onar onar artar).
                  {nextGood ? ` Sıradaki ürün ${nextGood.lvl}. seviyede açılır.` : ''}
                </Note>
              )}

              <Heading title="Gezgin tüccar" sub="bugünün teklifleri" />
              <View style={{ flexDirection: 'row', gap: GAP }}>
                {offers.map((o) => {
                  const done = got.includes(o.id);
                  return (
                    <View
                      key={o.id}
                      style={{
                        width: cell3,
                        padding: 8,
                        borderRadius: 14,
                        borderWidth: 1.5,
                        borderColor: LINE,
                        backgroundColor: done ? '#EEE4D0' : CELL,
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <View style={{ opacity: done ? 0.45 : 1 }}>
                        <Icon k={o.key} size={54} />
                      </View>
                      <Text maxFontSizeMultiplier={1.0} numberOfLines={1} style={{ fontWeight: '800', fontSize: 13, color: INK }}>
                        {label(o.key, o.n)}
                      </Text>
                      {done ? (
                        <Text maxFontSizeMultiplier={1.0} style={{ fontSize: 12, color: MUTED, lineHeight: 40 }}>
                          Bugün alındı
                        </Text>
                      ) : (
                        <Pill
                          busy={busy === o.id}
                          dim={farm.coins < o.cost}
                          onPress={() =>
                            run(
                              o.id,
                              () => act({ a: 'trader', i: 0, key: o.key, n: o.n, cost: o.cost, offer: o.id, day: today }),
                              `${label(o.key, o.n)} depona eklendi.`,
                            )
                          }
                        >
                          <Coins n={o.cost} size={14} />
                        </Pill>
                      )}
                    </View>
                  );
                })}
              </View>

              <Heading title="Diğer çiftliklerden" />
              {list === null ? (
                <Note>Pazar yükleniyor…</Note>
              ) : list.length ? (
                list.map((l) => (
                  <View key={l.id} style={row}>
                    <Icon k={l.key} size={44} />
                    <View style={{ flex: 1 }}>
                      <Text maxFontSizeMultiplier={1.1} numberOfLines={1} style={{ fontWeight: '900', fontSize: 15, color: INK }}>
                        {label(l.key, l.n)}
                      </Text>
                      <Text maxFontSizeMultiplier={1.1} numberOfLines={1} style={{ fontSize: 12, color: MUTED }}>
                        {`${l.farm} · seviye ${l.lvl}`}
                      </Text>
                    </View>
                    <Pill
                      busy={busy === l.id}
                      dim={farm.coins < l.price}
                      onPress={() => run(l.id, () => buyListing(who, l), `${label(l.key, l.n)} depona eklendi.`)}
                    >
                      <Coins n={l.price} size={14} />
                    </Pill>
                  </View>
                ))
              ) : (
                <Note>Şu an başka çiftlikten ilan yok. İlk ilanı sen koy: “Tezgâhım” sekmesinden.</Note>
              )}
            </>
          ) : !farm.name ? (
            <>
              <Note>
                Pazarda gerçek adınız görünmez; ilanlarınız çiftlik adıyla çıkar. Önce çiftliğinize bir ad verin (sonra değiştirilebilir).
              </Note>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Papatya Çiftliği"
                placeholderTextColor="#B9A27E"
                maxLength={22}
                style={{
                  minHeight: 48,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: LINE,
                  backgroundColor: '#fff',
                  paddingHorizontal: 14,
                  fontSize: 16,
                  color: INK,
                }}
              />
              <Pill
                main
                busy={busy === 'name'}
                onPress={() => run('name', () => act({ a: 'rename', i: 0, name }), 'Çiftlik adı kaydedildi.')}
              >
                {pillText('Adı kaydet', true)}
              </Pill>
            </>
          ) : (
            <>
              <Heading title="İlanlarım" sub={`${MARKET_HOURS} saat açık kalır`} />
              {mine.length === 0 && <Note>Henüz ilanın yok. Aşağıdan bir ürün seçip tezgâha koy; satılmazsa depoya döner.</Note>}
              {mine.map((l) => (
                <View key={l.id} style={row}>
                  <Icon k={l.key} size={44} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text maxFontSizeMultiplier={1.1} numberOfLines={1} style={{ fontWeight: '900', fontSize: 15, color: INK }}>
                      {label(l.key, l.n)}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Coins n={l.price} size={12} />
                      <Text maxFontSizeMultiplier={1.1} style={{ fontSize: 12, color: MUTED }}>
                        · {Math.max(1, Math.round((l.expMs - Date.now()) / 3600000))} saat kaldı
                      </Text>
                    </View>
                  </View>
                  <Pill busy={busy === l.id} onPress={() => run(l.id, () => takeBack(who, l.id), 'İlan geri çekildi, ürün depoda.')}>
                    {pillText('Geri çek')}
                  </Pill>
                </View>
              ))}

              {mine.length >= MARKET_MAX ? (
                <Note>Tezgâh dolu. Yeni ilan için birinin satılmasını bekle ya da birini geri çek.</Note>
              ) : stock.length ? (
                <>
                  <Heading title="Depodan ilana koy" />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
                    {stock.map(([k, n]) =>
                      tile(
                        k,
                        cell4,
                        sell?.key === k,
                        <Text maxFontSizeMultiplier={1.0} style={{ fontWeight: '900', fontSize: 12, color: GOLD }}>
                          ×{n}
                        </Text>,
                        () => setSell(sell?.key === k ? null : { key: k, n: Math.min(n, 5), unit: PRICE[k] }),
                      ),
                    )}
                  </View>
                  {sell &&
                    (() => {
                      const [lo, hi] = unitRange(sell.key);
                      const have = Math.min(farm.stock[sell.key] ?? 0, MARKET_MAX_QTY);
                      const step = Math.max(1, Math.round(PRICE[sell.key] / 10));
                      const line = (text: string, ctl: ReactNode) => (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <Text maxFontSizeMultiplier={1.15} style={{ flex: 1, fontSize: 14, color: INK, fontWeight: '700' }}>
                            {text}
                          </Text>
                          {ctl}
                        </View>
                      );
                      return (
                        <View
                          style={{ gap: 10, padding: 12, borderRadius: 16, borderWidth: 2, borderColor: BROWN, backgroundColor: '#fff' }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <Icon k={sell.key} size={44} />
                            <View style={{ flex: 1 }}>
                              <Text maxFontSizeMultiplier={1.1} style={{ fontWeight: '900', fontSize: 15, color: INK }}>
                                {PRODUCT_NAME[sell.key]}
                              </Text>
                              <Text maxFontSizeMultiplier={1.1} style={{ fontSize: 12, color: MUTED }}>
                                depoda {farm.stock[sell.key] ?? 0} · sistem fiyatı {PRICE[sell.key]}
                              </Text>
                            </View>
                          </View>
                          {line('Adet', <Stepper n={sell.n} min={1} max={have} onChange={(n) => setSell({ ...sell, n })} />)}
                          {line(
                            `Tanesi (${lo}-${hi})`,
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Pressable
                                onPress={() => setSell({ ...sell, unit: Math.max(lo, sell.unit - step) })}
                                hitSlop={6}
                                style={{
                                  width: 34,
                                  height: 34,
                                  borderRadius: 17,
                                  backgroundColor: SAND,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Ionicons name="remove" size={20} color={INK} />
                              </Pressable>
                              <Text
                                maxFontSizeMultiplier={1.1}
                                style={{ minWidth: 30, textAlign: 'center', fontWeight: '900', fontSize: 18, color: INK }}
                              >
                                {sell.unit}
                              </Text>
                              <Pressable
                                onPress={() => setSell({ ...sell, unit: Math.min(hi, sell.unit + step) })}
                                hitSlop={6}
                                style={{
                                  width: 34,
                                  height: 34,
                                  borderRadius: 17,
                                  backgroundColor: SAND,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Ionicons name="add" size={20} color={INK} />
                              </Pressable>
                            </View>,
                          )}
                          <Pill
                            main
                            busy={busy === 'new'}
                            onPress={() => run('new', () => createListing(who, sell.key, sell.n, sell.unit), 'İlan tezgâhta.')}
                          >
                            <Coins n={`İlana koy · ${sell.n * sell.unit}`} size={14} color="#fff" />
                          </Pill>
                        </View>
                      );
                    })()}
                </>
              ) : (
                <Note>Depo boş. Hasat edip ya da atölyede bir şeyler yapıp gel.</Note>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
