import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { signOut } from 'firebase/auth';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tour } from '../components/Tour';
import { Button, ErrorText, Input, Muted } from '../components/ui';
import { COSTS, IDEAS } from '../lib/coupons';
import { auth } from '../lib/firebase';
import { useL, useLang } from '../lib/i18n';
import {
  clearCouponDraft,
  inviteMessage,
  loadCouponDraft,
  loadInvite,
  markTour,
  saveCouponDraft,
  saveInvite,
  sentLabel,
  tourSeen,
  type CouponDraft,
  type InviteState,
} from '../lib/invite';
import { createInvite, joinInvite } from '../lib/pairing';
import { useSession } from '../lib/session';
import { useTheme } from '../lib/useTheme';

const ROSE = '#E8516A';
const BLUSH = '#FFE3E6';

// Partner henüz katılmadıysa: üstte davet, altta o gelene kadar yapılacak hazırlık listesi.
export default function Pair() {
  const { profile, user } = useSession();
  const { colors } = useTheme();
  const { lang } = useLang();
  const l = useL();
  const insets = useSafeAreaInsets();
  const uid = user?.uid;
  const myName = profile?.name || user?.displayName || 'Ben';

  const [invite, setInvite] = useState<InviteState | null>(null);
  const [draft, setDraft] = useState<CouponDraft | null>(null);
  const [toured, setToured] = useState(false);
  const [open, setOpen] = useState<'join' | 'coupon' | null>(null);
  const [tour, setTour] = useState(false);
  const [partnerCode, setPartnerCode] = useState('');
  const [couponTitle, setCouponTitle] = useState('');
  const [busy, setBusy] = useState<'send' | 'join' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!uid) return;
    loadInvite(uid).then(setInvite);
    loadCouponDraft(uid).then((d) => {
      setDraft(d);
      if (d) setCouponTitle(d.title);
    });
    tourSeen('pair').then(setToured);
  }, [uid]);

  async function onSend() {
    if (!uid) return;
    setError('');
    setBusy('send');
    try {
      const code = invite?.code ?? (await createInvite(myName));
      const first = !invite?.sentAt;
      if (!invite) {
        setInvite({ code });
        saveInvite(uid, { code });
      }
      const res = await Share.share({ message: inviteMessage(code, lang, !first) });
      if (res.action !== Share.dismissedAction) {
        const next = { code, sentAt: Date.now() };
        setInvite(next);
        saveInvite(uid, next);
      }
    } catch {
      setError(l('Davet hazırlanamadı, tekrar dene.', 'Could not prepare the invite, try again.'));
    } finally {
      setBusy(null);
    }
  }

  async function onJoin() {
    setError('');
    if (partnerCode.trim().length !== 6) return setError(l('Kod 6 karakter olmalı.', 'The code has 6 characters.'));
    setBusy('join');
    try {
      await joinInvite(partnerCode, myName);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : l('Eşleşme yapılamadı.', 'Could not pair.'));
    } finally {
      setBusy(null);
    }
  }

  function onSaveCoupon() {
    if (!uid) return;
    const title = couponTitle.trim();
    if (!title) {
      setDraft(null);
      clearCouponDraft(uid);
    } else {
      const d = { title, cost: COSTS[1] };
      setDraft(d);
      saveCouponDraft(uid, d);
    }
    setOpen(null);
  }

  const steps: { id: string; done: boolean; label: string; sub?: string; onPress?: () => void; body?: ReactNode }[] = [];
  if (profile?.loveLanguage) steps.push({ id: 'test', done: true, label: l('Sevgi dili testi', 'Love language quiz') });
  steps.push({
    id: 'avatar',
    done: !!profile?.avatar,
    label: l('Karakterini tasarla', 'Design your character'),
    onPress: () => router.push('/avatar'),
  });
  steps.push({
    id: 'coupon',
    done: !!draft,
    label: l('Partnerine ilk kuponu yaz', 'Write your partner a first coupon'),
    sub: draft ? `“${draft.title}”` : l('Katılınca onu bekliyor olacak', 'It will be waiting when they join'),
    onPress: () => setOpen(open === 'coupon' ? null : 'coupon'),
    body:
      open === 'coupon' ? (
        <View style={{ gap: 10, paddingBottom: 12 }}>
          <Input
            placeholder={l('Sabah kahvaltısı benden', 'Breakfast is on me')}
            value={couponTitle}
            onChangeText={setCouponTitle}
            maxLength={60}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {IDEAS.slice(0, 4).map((idea) => (
              <Pressable
                key={idea}
                onPress={() => setCouponTitle(idea)}
                style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 }}
              >
                <Text maxFontSizeMultiplier={1.2} style={{ fontSize: 13, color: colors.muted }}>
                  {idea}
                </Text>
              </Pressable>
            ))}
          </View>
          <Button label={l('Kaydet', 'Save')} variant="secondary" onPress={onSaveCoupon} />
        </View>
      ) : null,
  });
  steps.push({ id: 'tour', done: toured, label: l('Uygulamayı gez', 'Take a look around'), onPress: () => setTour(true) });
  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <View style={{ backgroundColor: ROSE, paddingTop: insets.top + 26, paddingBottom: 24, paddingHorizontal: 24, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFF6EE', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="person" size={30} color={ROSE} />
          </View>
          <Ionicons name="heart" size={22} color="#fff" />
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              borderWidth: 2,
              borderStyle: 'dashed',
              borderColor: BLUSH,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="add" size={30} color={BLUSH} />
          </View>
        </View>
        <Text maxFontSizeMultiplier={1.2} style={{ color: '#fff', fontSize: 24, fontWeight: '700', marginTop: 14, textAlign: 'center' }}>
          {l('Bir iz daha eksik', 'One mark is missing')}
        </Text>
        <Text maxFontSizeMultiplier={1.25} style={{ color: BLUSH, fontSize: 15, marginTop: 4, textAlign: 'center' }}>
          {l('Partnerini davet et, yolculuk başlasın', 'Invite your partner and begin')}
        </Text>

        <Pressable
          onPress={busy ? undefined : onSend}
          style={({ pressed }) => ({
            marginTop: 16,
            alignSelf: 'stretch',
            minHeight: 52,
            borderRadius: 26,
            backgroundColor: '#fff',
            flexDirection: 'row',
            gap: 8,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed || busy === 'send' ? 0.8 : 1,
          })}
        >
          <Ionicons name="paper-plane" size={18} color="#B93A55" />
          <Text maxFontSizeMultiplier={1.25} style={{ color: '#B93A55', fontSize: 16, fontWeight: '700' }}>
            {invite?.sentAt ? l('Tekrar hatırlat', 'Remind again') : l('Daveti gönder', 'Send the invite')}
          </Text>
        </Pressable>
        {invite && (
          <Text maxFontSizeMultiplier={1.25} style={{ color: BLUSH, fontSize: 14, marginTop: 10, textAlign: 'center' }}>
            {invite.sentAt ? `${sentLabel(invite.sentAt, lang)} · ` : ''}
            {l('Davet kodun', 'Your code')}: <Text style={{ color: '#fff', fontWeight: '700', letterSpacing: 3 }}>{invite.code}</Text>
          </Text>
        )}
      </View>

      <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 4 }}>
        <Pressable
          onPress={() => setOpen(open === 'join' ? null : 'join')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}
        >
          <Ionicons name="key-outline" size={20} color={colors.primary} />
          <Text maxFontSizeMultiplier={1.25} style={{ flex: 1, fontSize: 15, color: colors.text, fontWeight: '600' }}>
            {l('Partnerin sana kod mu gönderdi?', 'Did your partner send you a code?')}
          </Text>
          <Ionicons name={open === 'join' ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
        </Pressable>
        {open === 'join' && (
          <View style={{ gap: 10, paddingBottom: 8 }}>
            <Input
              placeholder="ABC123"
              value={partnerCode}
              onChangeText={(v) => setPartnerCode(v.toUpperCase())}
              autoCapitalize="characters"
              maxLength={6}
              style={{ fontSize: 22, letterSpacing: 6, textAlign: 'center' }}
            />
            <Button label={l('Eşleş', 'Pair')} onPress={onJoin} busy={busy === 'join'} />
          </View>
        )}
        <ErrorText>{error}</ErrorText>

        <Muted style={{ marginTop: 6 }}>
          {allDone
            ? l('Hazırsın, sıra partnerinde', 'You are ready, over to your partner')
            : `${l('Hazırlık', 'Getting ready')} · ${doneCount} / ${steps.length}`}
        </Muted>
        {steps.map((s, n) => (
          <View key={s.id} style={{ borderBottomWidth: n === steps.length - 1 ? 0 : 1, borderBottomColor: colors.border }}>
            <Pressable
              onPress={s.onPress}
              disabled={!s.onPress}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: s.done ? ROSE : 'transparent',
                  borderWidth: s.done ? 0 : 1.5,
                  borderColor: '#E7A9B4',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {s.done && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
              <View style={{ flex: 1 }}>
                <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 16, color: colors.text }}>
                  {s.label}
                </Text>
                {s.sub && <Muted style={{ fontSize: 13 }}>{s.sub}</Muted>}
              </View>
              {s.onPress && <Ionicons name="chevron-forward" size={18} color={colors.muted} />}
            </Pressable>
            {s.body}
          </View>
        ))}

        <Pressable onPress={() => signOut(auth).then(() => router.replace('/welcome'))} style={{ alignItems: 'center', padding: 16 }}>
          <Text maxFontSizeMultiplier={1.25} style={{ color: colors.muted }}>
            {l('Çıkış yap', 'Sign out')}
          </Text>
        </Pressable>
      </View>

      <Tour
        id="app"
        visible={tour}
        onClose={() => {
          setTour(false);
          setToured(true);
          markTour('pair');
          markTour('app');
        }}
      />
    </ScrollView>
  );
}
