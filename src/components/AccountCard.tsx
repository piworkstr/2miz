import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { authError, changeEmail, changePassword, refreshVerified, sendVerify, setAuthLang } from '../lib/account';
import { auth, db } from '../lib/firebase';
import { setFarmRemind, useFarmRemind } from '../lib/farmRemind';
import { useL, useLang } from '../lib/i18n';
import { PUSH_TYPES, type PushType } from '../lib/push';
import { useSession } from '../lib/session';
import { useTheme } from '../lib/useTheme';
import { setRemind, useRemind } from './SpecialDays';
import { Button, Card, ErrorText, Input, Muted, T } from './ui';

// Profil > Hesap: e-posta doğrulama durumu, e-posta ve şifre değiştirme.
export function AccountCard() {
  const t = useTheme();
  const l = useL();
  const { lang } = useLang();
  const { user } = useSession();
  const [open, setOpen] = useState<'email' | 'password' | null>(null);
  const [verified, setVerified] = useState(!!auth.currentUser?.emailVerified);
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  if (!user) return null;

  const run = async (key: string, fn: () => Promise<string | void>) => {
    if (busy) return;
    setBusy(key);
    setError('');
    setInfo('');
    setAuthLang(lang);
    try {
      const msg = await fn();
      if (msg) setInfo(msg);
    } catch (e) {
      setError(authError(e, lang));
    } finally {
      setBusy('');
    }
  };
  const toggle = (k: 'email' | 'password') => {
    setOpen(open === k ? null : k);
    setPassword('');
    setEmail('');
    setNext('');
    setAgain('');
    setError('');
    setInfo('');
  };
  const row = (icon: 'mail-outline' | 'key-outline', label: string, k: 'email' | 'password') => (
    <Pressable onPress={() => toggle(k)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
      <Ionicons name={icon} size={20} color={t.colors.primary} />
      <T style={{ flex: 1 }}>{label}</T>
      <Ionicons name={open === k ? 'chevron-up' : 'chevron-down'} size={18} color={t.colors.muted} />
    </Pressable>
  );

  return (
    <Card style={{ gap: 8 }}>
      <T style={{ fontSize: 16, fontWeight: '600', fontFamily: t.fonts.button }}>{l('Hesap', 'Account')}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons
          name={verified ? 'checkmark-circle' : 'alert-circle-outline'}
          size={20}
          color={verified ? t.colors.success : t.colors.muted}
        />
        <View style={{ flex: 1 }}>
          <T>{user.email}</T>
          <Muted style={{ fontSize: 12 }}>
            {verified ? l('E-posta doğrulandı', 'Email verified') : l('E-posta doğrulanmadı', 'Email not verified')}
          </Muted>
        </View>
      </View>
      {!verified && (
        <>
          <Muted style={{ fontSize: 13, lineHeight: 18 }}>
            {l(
              'Şifreni unutursan hesabına bu adresten ulaşırsın. Gönderdiğimiz bağlantıya tıkla, sonra “Doğruladım”a bas.',
              'If you forget your password, this address is how you get back in. Tap the link we send, then press “I verified”.',
            )}
          </Muted>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              style={{ flex: 1 }}
              variant="secondary"
              label={l('Bağlantıyı gönder', 'Send the link')}
              busy={busy === 'send'}
              onPress={() =>
                run('send', async () => {
                  await sendVerify();
                  return l(
                    'Doğrulama e-postası gönderildi. Gereksiz klasörüne de bak.',
                    'Verification email sent. Check your spam folder too.',
                  );
                })
              }
            />
            <Button
              style={{ flex: 1 }}
              label={l('Doğruladım', 'I verified')}
              busy={busy === 'check'}
              onPress={() =>
                run('check', async () => {
                  const ok = await refreshVerified();
                  setVerified(ok);
                  return ok
                    ? l('Teşekkürler, e-postan doğrulandı.', 'Thanks, your email is verified.')
                    : l('Henüz doğrulanmamış görünüyor.', 'It doesn’t look verified yet.');
                })
              }
            />
          </View>
        </>
      )}

      {row('mail-outline', l('E-postayı değiştir', 'Change email'), 'email')}
      {open === 'email' && (
        <View style={{ gap: 8 }}>
          <Input
            placeholder={l('Yeni e-posta', 'New email')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
          />
          <Input placeholder={l('Mevcut şifren', 'Your current password')} value={password} onChangeText={setPassword} secureTextEntry />
          <Button
            label={l('Doğrulama bağlantısı gönder', 'Send verification link')}
            busy={busy === 'email'}
            onPress={() => {
              if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError(l('Geçerli bir e-posta yaz.', 'Enter a valid email.'));
              if (!password) return setError(l('Mevcut şifreni yaz.', 'Enter your current password.'));
              run('email', async () => {
                await changeEmail(password, email);
                setOpen(null);
                return l(
                  `${email.trim()} adresine bağlantı gönderdik. Tıklayınca e-postan değişir; sonra yeni adresle yeniden giriş yapman gerekir.`,
                  `We sent a link to ${email.trim()}. Your email changes once you tap it; you’ll then need to sign in again with the new address.`,
                );
              });
            }}
          />
        </View>
      )}

      {row('key-outline', l('Şifreyi değiştir', 'Change password'), 'password')}
      {open === 'password' && (
        <View style={{ gap: 8 }}>
          <Input placeholder={l('Mevcut şifren', 'Your current password')} value={password} onChangeText={setPassword} secureTextEntry />
          <Input
            placeholder={l('Yeni şifre (en az 6 karakter)', 'New password (at least 6 characters)')}
            value={next}
            onChangeText={setNext}
            secureTextEntry
          />
          <Input placeholder={l('Yeni şifre, tekrar', 'New password, again')} value={again} onChangeText={setAgain} secureTextEntry />
          <Button
            label={l('Şifreyi değiştir', 'Change password')}
            busy={busy === 'password'}
            onPress={() => {
              if (!password) return setError(l('Mevcut şifreni yaz.', 'Enter your current password.'));
              if (next.length < 6)
                return setError(l('Yeni şifre en az 6 karakter olmalı.', 'The new password must be at least 6 characters.'));
              if (next !== again) return setError(l('Yeni şifreler aynı değil.', 'The new passwords don’t match.'));
              run('password', async () => {
                await changePassword(password, next);
                setOpen(null);
                return l('Şifren değişti.', 'Your password was changed.');
              });
            }}
          />
        </View>
      )}
      <ErrorText>{error}</ErrorText>
      {!!info && <T style={{ color: t.colors.success, fontSize: 14 }}>{info}</T>}
    </Card>
  );
}

// Profil > Bildirimler: her bildirim türü ayrı kapatılır. Partnerden gelenler hesapta saklanır (gönderen telefon bakar);
// özel gün ve hasat hatırlatmaları bu telefonda kurulduğu için bu telefonda saklanır.
export function NotifCard() {
  const t = useTheme();
  const l = useL();
  const { lang } = useLang();
  const { user, profile } = useSession();
  const remind = useRemind();
  const farmRemind = useFarmRemind();
  const [off, setOff] = useState<string[] | null>(null); // kayıt beklerken anında tepki
  if (!user) return null;
  const list = off ?? profile?.notifOff ?? [];
  const set = (id: PushType, on: boolean) => {
    const next = on ? list.filter((x) => x !== id) : [...new Set([...list, id])];
    setOff(next);
    updateDoc(doc(db, 'users', user.uid), { notifOff: next }).catch(() => setOff(null));
  };
  const row = (key: string, title: string, hint: string, value: boolean, onChange: (v: boolean) => void) => (
    <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 3 }}>
      <View style={{ flex: 1 }}>
        <T>{title}</T>
        <Muted style={{ fontSize: 12 }}>{hint}</Muted>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: t.colors.primary }} />
    </View>
  );
  return (
    <Card style={{ gap: 6 }}>
      <T style={{ fontSize: 16, fontWeight: '600', fontFamily: t.fonts.button }}>{l('Bildirimler', 'Notifications')}</T>
      {PUSH_TYPES.map((p) =>
        row(p.id, lang === 'en' ? p.en : p.tr, lang === 'en' ? p.hintEn : p.hintTr, !list.includes(p.id), (v) => set(p.id, v)),
      )}
      {row(
        'remind',
        l('Özel gün hatırlatması', 'Special day reminders'),
        l('3 gün önce, 1 gün önce ve o gün 09:00', '3 days before, 1 day before, and on the day at 09:00'),
        remind,
        (v) => void setRemind(v),
      )}
      {row(
        'farm',
        l('Hasat hatırlatması', 'Harvest reminder'),
        l('Ekinler olgunlaşınca ve üretim bitince', 'When crops are ripe and production is done'),
        farmRemind,
        (v) => void setFarmRemind(v),
      )}
      <Muted style={{ fontSize: 12 }}>
        {l(
          'Bir türü kapatınca partnerinin telefonu birkaç dakika içinde o bildirimi göndermeyi bırakır.',
          'When you turn a type off, your partner’s phone stops sending it within a few minutes.',
        )}
      </Muted>
    </Card>
  );
}
