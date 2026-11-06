import { signOut } from 'firebase/auth';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, Muted, Screen, T, Title } from '../../components/ui';
import { auth } from '../../lib/firebase';
import { useSession } from '../../lib/session';
import { DeleteAccount } from '../../components/DeleteAccount';
import { ThemeOption } from '../../components/ThemeOption';
import { LOVE_LANGUAGES, type LoveLanguage } from '../../lib/loveLanguage';
import { THEME_LIST, tx, type Theme } from '../../lib/theme';
import { saveTheme, useTheme } from '../../lib/useTheme';

export default function Profile() {
  const { user, profile, partnerName, couple } = useSession();
  const t = useTheme();
  const [saving, setSaving] = useState<string | null>(null);

  async function choose(theme: Theme) {
    if (!user || theme.id === t.id) return;
    setSaving(theme.id);
    try {
      await saveTheme(user.uid, theme.id);
    } finally {
      setSaving(null);
    }
  }

  return (
    <Screen>
      <Title>{t.copy.tabs.us}</Title>

      <Card style={{ alignItems: 'center' }}>
        <Text style={{ fontFamily: t.fonts.title, fontSize: t.titleSize * 0.9, color: t.colors.primary }}>
          {tx(t, `${profile?.name ?? 'Sen'} & ${partnerName}`)}
        </Text>
        {profile?.loveLanguage && (
          <Muted>Sevgi dilin: {LOVE_LANGUAGES[profile.loveLanguage as LoveLanguage]?.name}</Muted>
        )}
        <View style={{ flexDirection: 'row', gap: 12, alignSelf: 'stretch' }}>
          <Box value={couple?.points ?? 0} label={t.copy.points} />
          <Box value={couple?.streak ?? 0} label={t.copy.streak} />
        </View>
      </Card>

      <View style={{ gap: 4 }}>
        <T style={{ fontSize: 17, fontWeight: '600', fontFamily: t.fonts.button }}>{tx(t, 'Temanı seç')}</T>
        <Muted>Tema sadece senin telefonunu değiştirir, partnerin kendi temasını seçer.</Muted>
      </View>

      {THEME_LIST.map((theme) => (
        <ThemeOption
          key={theme.id}
          theme={theme}
          selected={theme.id === t.id}
          saving={saving === theme.id}
          onPress={() => choose(theme)}
        />
      ))}

      <Button label="Çıkış yap" variant="secondary" onPress={() => signOut(auth)} />
      <DeleteAccount />
    </Screen>
  );
}

function Box({ value, label }: { value: number; label: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: t.colors.bg, borderRadius: Math.min(t.radius.card, 12), padding: 12 }}>
      <T style={{ fontSize: 24, fontWeight: '700' }}>{String(value)}</T>
      <Muted style={{ fontSize: 12, textAlign: 'center' }}>{tx(t, label)}</Muted>
    </View>
  );
}
