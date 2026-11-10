import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { DEMO_COUPLE } from '../lib/demoPersona';
import { EN_OPEN, LANGS, useL, useLang, type Lang } from '../lib/i18n';
import { useSession } from '../lib/session';
import { useTheme } from '../lib/useTheme';
import { Card, Muted, T } from './ui';

// Uygulama dili. İngilizce herkese açılana kadar (EN_OPEN) yalnız kurucu çift görür ve dener.
export function LanguageCard() {
  const t = useTheme();
  const l = useL();
  const { couple } = useSession();
  const { lang, setLang } = useLang();
  const [busy, setBusy] = useState<Lang | null>(null);
  if (!EN_OPEN && couple?.id !== DEMO_COUPLE) return null;

  async function choose(id: Lang) {
    if (id === lang) return;
    setBusy(id);
    try {
      await setLang(id);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card style={{ gap: 8 }}>
      <T style={{ fontSize: 16, fontWeight: '600', fontFamily: t.fonts.button }}>{l('Dil', 'Language')}</T>
      {!EN_OPEN && (
        <Muted style={{ fontSize: 12 }}>
          {l(
            'İngilizce yalnız sizde açık; çevrilen ekranlar: tanışma, kayıt, sekmeler ve tema metinleri. Diğerleri sırayla gelecek.',
            'English is only on for you; translated so far: onboarding, sign-up, tabs and theme texts. More to come.',
          )}
        </Muted>
      )}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {LANGS.map((o) => {
          const on = lang === o.id;
          return (
            <Pressable
              key={o.id}
              onPress={() => choose(o.id)}
              disabled={busy !== null}
              style={{
                flex: 1,
                alignItems: 'center',
                padding: 10,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: on ? t.colors.primary : t.colors.border,
                backgroundColor: on ? t.colors.primarySoft : 'transparent',
                opacity: busy && busy !== o.id ? 0.5 : 1,
              }}
            >
              <Text maxFontSizeMultiplier={1.25} style={{ fontWeight: '700', color: on ? t.colors.onPrimarySoft : t.colors.text }}>
                {busy === o.id ? '…' : o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}
