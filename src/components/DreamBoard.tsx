import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import {
  addDream,
  completeDream,
  dateLabel,
  DREAM_COINS,
  DREAM_MAX,
  DREAM_TITLE_MAX,
  dreamPhoto,
  dreamUri,
  editDream,
  leftLabel,
  migrateNote,
  money,
  MONTHS_SHORT,
  parseMoney,
  removeDream,
  reopenDream,
  useDreams,
  type Dream,
} from '../lib/board';
import { notifyPartner } from '../lib/push';
import { useSession, type Couple } from '../lib/session';
import { useTheme } from '../lib/useTheme';
import { Card, Muted } from './ui';

// Ortak hayal panosu: iki sütunlu kartlar; karta dokununca düzenleme kartı açılır.
type Filter = 'all' | 'open' | 'done';
const TINTS = ['#FDE7EA', '#E6F1FB', '#FAEEDA', '#EAF3DE', '#EEEDFE'];
const GREEN = '#4E8E2A';

async function pickPhoto(): Promise<string | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  if (res.canceled || !res.assets.length) return null;
  return dreamPhoto(res.assets[0].uri);
}

export function DreamBoard({ couple, uid }: { couple: Couple; uid: string }) {
  const t = useTheme();
  const dreams = useDreams(couple.id);
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<Dream | 'new' | null>(null);
  const [toast, setToast] = useState('');

  // Eski tek hayal notu ilk karta taşınır.
  const moved = useRef(false);
  useEffect(() => {
    if (!dreams || moved.current || !couple.dreamNote?.trim()) return;
    moved.current = true;
    migrateNote(couple, uid).catch(() => {
      moved.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dreams, couple.dreamNote]);

  const all = dreams ?? [];
  const doneN = all.filter((d) => d.done).length;
  const shown = all.filter((d) => (filter === 'all' ? true : filter === 'done' ? !!d.done : !d.done));
  const say = (s: string) => {
    setToast(s);
    setTimeout(() => setToast(''), 3500);
  };
  const chip = (id: Filter, label: string) => (
    <Pressable
      key={id}
      onPress={() => setFilter(id)}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: filter === id ? t.colors.primary : t.colors.border,
        backgroundColor: filter === id ? t.colors.primary : 'transparent',
      }}
    >
      <Text
        maxFontSizeMultiplier={1.2}
        style={{ fontSize: 12, fontWeight: '700', color: filter === id ? t.colors.onPrimary : t.colors.muted }}
      >
        {label}
      </Text>
    </Pressable>
  );

  return (
    <Card style={{ gap: 10, padding: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text
          maxFontSizeMultiplier={1.25}
          style={{ flex: 1, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, color: t.colors.primary }}
        >
          HAYAL PANOMUZ
        </Text>
        {all.length > 0 && (
          <Muted style={{ fontSize: 12 }}>
            {doneN} / {all.length} gerçekleşti
          </Muted>
        )}
      </View>
      {all.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {chip('all', 'Hepsi')}
          {chip('open', 'Bekleyen')}
          {chip('done', 'Gerçekleşen')}
        </View>
      )}
      {dreams === null ? (
        <ActivityIndicator color={t.colors.primary} />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
          {shown.map((d, k) => (
            <DreamTile key={d.id} d={d} tint={TINTS[k % TINTS.length]} onPress={() => setOpen(d)} />
          ))}
          {filter !== 'done' && all.length < DREAM_MAX && (
            <Pressable
              onPress={() => setOpen('new')}
              accessibilityLabel="Hayal ekle"
              style={{
                width: '48.5%',
                minHeight: 150,
                borderRadius: 14,
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: t.colors.border,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <Ionicons name="add" size={28} color={t.colors.primary} />
              <Text maxFontSizeMultiplier={1.2} style={{ color: t.colors.muted, fontWeight: '700', fontSize: 13 }}>
                Hayal ekle
              </Text>
            </Pressable>
          )}
          {filter === 'done' && shown.length === 0 && <Muted style={{ fontSize: 13 }}>Gerçekleşen hayal burada görünür.</Muted>}
        </View>
      )}
      {all.length === 0 && dreams !== null && (
        <Muted style={{ fontSize: 13, lineHeight: 18 }}>
          Birlikte gerçekleştirmek istediklerinizi ekleyin: bir yolculuk, bir ev, bir konser. İkiniz de görür ve düzenlersiniz.
        </Muted>
      )}
      {!!toast && (
        <Text maxFontSizeMultiplier={1.2} style={{ color: GREEN, fontWeight: '700', fontSize: 13 }}>
          {toast}
        </Text>
      )}
      {open && (
        <DreamEditor
          coupleId={couple.id}
          uid={uid}
          dream={open === 'new' ? null : (all.find((d) => d.id === open.id) ?? open)}
          onClose={() => setOpen(null)}
          onSay={say}
        />
      )}
    </Card>
  );
}

function DreamTile({ d, tint, onPress }: { d: Dream; tint: string; onPress: () => void }) {
  const t = useTheme();
  const pic = d.done ? (d.donePhoto ?? d.photo) : d.photo;
  const meta = [dateLabel(d.date), d.budget ? money(d.budget) : ''].filter(Boolean).join(' · ');
  const pct = d.budget && d.saved ? Math.min(100, Math.round((d.saved / d.budget) * 100)) : 0;
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: '48.5%',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: t.colors.border,
        overflow: 'hidden',
        backgroundColor: t.colors.card,
      }}
    >
      <View style={{ height: 96, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
        {pic ? (
          <Image source={{ uri: dreamUri(pic) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <Ionicons name="sparkles-outline" size={26} color="#B98A93" />
        )}
        {!!d.done && (
          <View
            style={{
              position: 'absolute',
              right: 6,
              top: 6,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 3,
              backgroundColor: GREEN,
              borderRadius: 999,
              paddingHorizontal: 7,
              paddingVertical: 3,
            }}
          >
            <Ionicons name="checkmark" size={12} color="#fff" />
            <Text maxFontSizeMultiplier={1.0} style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>
              Gerçekleşti
            </Text>
          </View>
        )}
      </View>
      <View style={{ padding: 9, gap: 3 }}>
        <Text maxFontSizeMultiplier={1.2} numberOfLines={2} style={{ fontSize: 14, fontWeight: '700', color: t.colors.text }}>
          {d.title}
        </Text>
        {!!meta && (
          <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={{ fontSize: 12, color: t.colors.muted }}>
            {meta}
          </Text>
        )}
        {!d.done && pct > 0 && (
          <>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: t.colors.border, overflow: 'hidden', marginTop: 2 }}>
              <View style={{ width: `${pct}%`, height: 6, backgroundColor: t.colors.primary }} />
            </View>
            <Text maxFontSizeMultiplier={1.2} style={{ fontSize: 11, color: t.colors.muted }}>
              {money(d.saved!)} birikti
            </Text>
          </>
        )}
        {!d.done && pct === 0 && !!leftLabel(d.date) && (
          <Text maxFontSizeMultiplier={1.2} style={{ fontSize: 11, color: t.colors.muted }}>
            {leftLabel(d.date)}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

function DreamEditor({
  coupleId,
  uid,
  dream,
  onClose,
  onSay,
}: {
  coupleId: string;
  uid: string;
  dream: Dream | null;
  onClose: () => void;
  onSay: (s: string) => void;
}) {
  const t = useTheme();
  const { partnerId, profile } = useSession();
  const tell = (title: string, body: string) => {
    if (partnerId) void notifyPartner(partnerId, title, body, { type: 'dream', url: '/dreams' });
  };
  const myName = profile?.name ?? 'Partnerin';
  const thisYear = new Date().getFullYear();
  const [title, setTitle] = useState(dream?.title ?? '');
  const [photo, setPhoto] = useState<string | undefined>(dream?.photo);
  const [year, setYear] = useState(dream?.date?.split('-')[0] ?? '');
  const [month, setMonth] = useState<number | null>(dream?.date?.includes('-') ? parseInt(dream.date.split('-')[1], 10) : null);
  const [budget, setBudget] = useState(dream?.budget ? String(dream.budget) : '');
  const [saved, setSaved] = useState(dream?.saved ? String(dream.saved) : '');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [askDelete, setAskDelete] = useState(false);

  const y = parseInt(year, 10);
  const yearOk = year === '' || (Number.isFinite(y) && y >= thisYear - 1 && y <= thisYear + 60);
  const run = async (key: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    setError('');
    try {
      await fn();
    } catch {
      setError('Kaydedilemedi. Bağlantını kontrol edip yeniden dene.');
    } finally {
      setBusy('');
    }
  };
  const input = () => ({
    title,
    photo,
    date: year && yearOk ? (month ? `${y}-${String(month).padStart(2, '0')}` : String(y)) : undefined,
    budget: parseMoney(budget),
    saved: parseMoney(saved),
  });
  const save = () => {
    if (title.trim().length < 2) return setError('Hayale bir ad yaz.');
    if (!yearOk) return setError(`Hedef yılı ${thisYear} ile ${thisYear + 60} arasında olmalı.`);
    run('save', async () => {
      if (dream) await editDream(coupleId, dream.id, input());
      else {
        await addDream(coupleId, uid, input());
        tell(`${myName} panoya bir hayal ekledi ✨`, title.trim());
      }
      onClose();
    });
  };
  const choose = (set: (b64: string) => void, key: string) =>
    run(key, async () => {
      const b = await pickPhoto();
      if (b) set(b);
    });
  const field = {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.card,
    paddingHorizontal: 12,
    fontSize: 15,
    color: t.colors.text,
  };
  const label = { fontSize: 12, fontWeight: '700' as const, color: t.colors.muted };
  const btn = (bg: string) => ({ borderRadius: 14, paddingVertical: 12, alignItems: 'center' as const, backgroundColor: bg });

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(30,20,10,0.5)', justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Kapat" />
        <View style={{ backgroundColor: t.colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' }}>
          <ScrollView
            contentContainerStyle={{ padding: 18, paddingBottom: 34, gap: 10 }}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text maxFontSizeMultiplier={1.2} style={{ flex: 1, fontSize: 20, fontWeight: '800', color: t.colors.text }}>
                {dream ? 'Hayali düzenle' : 'Yeni hayal'}
              </Text>
              <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Kapat">
                <Ionicons name="close" size={24} color={t.colors.muted} />
              </Pressable>
            </View>

            <Pressable
              onPress={() => choose(setPhoto, 'photo')}
              style={{
                height: 130,
                borderRadius: 14,
                borderWidth: photo ? 0 : 1.5,
                borderStyle: 'dashed',
                borderColor: t.colors.border,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {busy === 'photo' ? (
                <ActivityIndicator color={t.colors.primary} />
              ) : photo ? (
                <Image source={{ uri: dreamUri(photo) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="camera-outline" size={20} color={t.colors.muted} />
                  <Text maxFontSizeMultiplier={1.2} style={{ color: t.colors.muted, fontWeight: '700' }}>
                    Fotoğraf seç
                  </Text>
                </View>
              )}
            </Pressable>
            {!!photo && (
              <View style={{ flexDirection: 'row', gap: 14 }}>
                <Pressable onPress={() => choose(setPhoto, 'photo')}>
                  <Text maxFontSizeMultiplier={1.2} style={{ color: t.colors.primary, fontWeight: '700', fontSize: 13 }}>
                    Fotoğrafı değiştir
                  </Text>
                </Pressable>
                <Pressable onPress={() => setPhoto(undefined)}>
                  <Text maxFontSizeMultiplier={1.2} style={{ color: t.colors.muted, fontWeight: '700', fontSize: 13 }}>
                    Kaldır
                  </Text>
                </Pressable>
              </View>
            )}

            <Text maxFontSizeMultiplier={1.2} style={label}>
              Hayal
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Birlikte Paris’e gitmek"
              placeholderTextColor={t.colors.muted}
              maxLength={Math.max(DREAM_TITLE_MAX, dream?.title.length ?? 0)}
              style={field}
            />

            <Text maxFontSizeMultiplier={1.2} style={label}>
              Hedef tarih (isteğe bağlı)
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput
                value={year}
                onChangeText={(v) => setYear(v.replace(/[^\d]/g, ''))}
                placeholder={String(thisYear + 1)}
                placeholderTextColor={t.colors.muted}
                keyboardType="number-pad"
                maxLength={4}
                style={[field, { width: 90 }]}
              />
              <Muted style={{ flex: 1, fontSize: 12 }}>Yılı yaz; istersen aşağıdan ayı da seç.</Muted>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {MONTHS_SHORT.map((m, k) => {
                const on = month === k + 1;
                return (
                  <Pressable
                    key={m}
                    onPress={() => setMonth(on ? null : k + 1)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: on ? t.colors.primary : t.colors.border,
                      backgroundColor: on ? t.colors.primary : 'transparent',
                    }}
                  >
                    <Text
                      maxFontSizeMultiplier={1.2}
                      style={{ fontSize: 12, fontWeight: '700', color: on ? t.colors.onPrimary : t.colors.muted }}
                    >
                      {m}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text maxFontSizeMultiplier={1.2} style={label}>
                  Tahmini bütçe (TL)
                </Text>
                <TextInput
                  value={budget}
                  onChangeText={(v) => setBudget(v.replace(/[^\d]/g, ''))}
                  placeholder="120000"
                  placeholderTextColor={t.colors.muted}
                  keyboardType="number-pad"
                  maxLength={10}
                  style={field}
                />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text maxFontSizeMultiplier={1.2} style={label}>
                  Biriken (TL)
                </Text>
                <TextInput
                  value={saved}
                  onChangeText={(v) => setSaved(v.replace(/[^\d]/g, ''))}
                  placeholder="0"
                  placeholderTextColor={t.colors.muted}
                  keyboardType="number-pad"
                  maxLength={10}
                  style={field}
                />
              </View>
            </View>
            <Muted style={{ fontSize: 12 }}>Fotoğraf, tarih ve bütçe isteğe bağlı.</Muted>

            {!!error && (
              <Text maxFontSizeMultiplier={1.2} style={{ color: '#C0392B', fontSize: 13, fontWeight: '700' }}>
                {error}
              </Text>
            )}
            <Pressable onPress={save} style={btn(t.colors.primary)}>
              {busy === 'save' ? (
                <ActivityIndicator color={t.colors.onPrimary} />
              ) : (
                <Text maxFontSizeMultiplier={1.2} style={{ color: t.colors.onPrimary, fontWeight: '800', fontSize: 15 }}>
                  {dream ? 'Kaydet' : 'Panoya ekle'}
                </Text>
              )}
            </Pressable>

            {dream && !dream.done && (
              <>
                <Pressable
                  onPress={() =>
                    run('done', async () => {
                      const first = await completeDream(coupleId, dream);
                      tell(`${myName} bir hayali gerçekleşti olarak işaretledi 🎉`, dream.title);
                      onSay(first ? `Tebrikler! Çiftlik kumbarasına ${DREAM_COINS} altın eklendi.` : 'Gerçekleşti olarak işaretlendi.');
                      onClose();
                    })
                  }
                  style={btn(GREEN)}
                >
                  {busy === 'done' ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text maxFontSizeMultiplier={1.2} style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
                      Gerçekleşti olarak işaretle
                    </Text>
                  )}
                </Pressable>
                <Pressable
                  onPress={() =>
                    run('donePhoto', async () => {
                      const b = await pickPhoto();
                      if (!b) return;
                      const first = await completeDream(coupleId, dream, b);
                      tell(`${myName} bir hayali gerçekleşti olarak işaretledi 🎉`, dream.title);
                      onSay(first ? `Tebrikler! Çiftlik kumbarasına ${DREAM_COINS} altın eklendi.` : 'Gerçekleşti olarak işaretlendi.');
                      onClose();
                    })
                  }
                  style={{ alignItems: 'center', paddingVertical: 4 }}
                >
                  {busy === 'donePhoto' ? (
                    <ActivityIndicator color={GREEN} />
                  ) : (
                    <Text maxFontSizeMultiplier={1.2} style={{ color: GREEN, fontWeight: '700', fontSize: 13 }}>
                      Anı fotoğrafıyla işaretle
                    </Text>
                  )}
                </Pressable>
              </>
            )}
            {dream?.done && (
              <Pressable
                onPress={() =>
                  run('reopen', async () => {
                    await reopenDream(coupleId, dream.id);
                    onClose();
                  })
                }
                style={btn(t.colors.border)}
              >
                <Text maxFontSizeMultiplier={1.2} style={{ color: t.colors.text, fontWeight: '800' }}>
                  Henüz gerçekleşmedi
                </Text>
              </Pressable>
            )}
            {dream &&
              (askDelete ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Muted style={{ flex: 1, fontSize: 13 }}>Bu hayal ikinizin panosundan silinsin mi? Geri alınamaz.</Muted>
                  <Pressable onPress={() => setAskDelete(false)}>
                    <Text maxFontSizeMultiplier={1.2} style={{ color: t.colors.muted, fontWeight: '700' }}>
                      Vazgeç
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      run('delete', async () => {
                        await removeDream(coupleId, dream.id);
                        onClose();
                      })
                    }
                  >
                    <Text maxFontSizeMultiplier={1.2} style={{ color: '#C0392B', fontWeight: '800' }}>
                      Sil
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={() => setAskDelete(true)} style={{ alignItems: 'center', paddingVertical: 4 }}>
                  <Text maxFontSizeMultiplier={1.2} style={{ color: '#C0392B', fontWeight: '700', fontSize: 13 }}>
                    Hayali sil
                  </Text>
                </Pressable>
              ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
