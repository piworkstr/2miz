import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../lib/useTheme';
import { Muted } from './ui';

// Sürüm satırı + "Güncellemeyi kontrol et": havadan gelen düzeltmeyi beklemeden indirir ve uygulamayı yeniler.
// Expo Go'da (geliştirme) güncelleme sistemi kapalıdır; orada yalnızca sürüm görünür.
export function UpdateCard() {
  const t = useTheme();
  const [state, setState] = useState<'idle' | 'checking' | 'downloading' | 'none' | 'error'>('idle');
  const version = Constants.expoConfig?.version ?? '?';
  const build = Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode ?? '';
  const upd = Updates.updateId ? Updates.updateId.slice(-6) : Updates.isEmbeddedLaunch ? 'yerleşik' : '';
  const enabled = Updates.isEnabled && Constants.appOwnership !== 'expo';

  async function check() {
    if (state === 'checking' || state === 'downloading') return;
    setState('checking');
    try {
      const r = await Updates.checkForUpdateAsync();
      if (!r.isAvailable) return setState('none');
      setState('downloading');
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch {
      setState('error');
    }
  }

  const label =
    state === 'checking'
      ? 'Bakılıyor…'
      : state === 'downloading'
        ? 'İndiriliyor, uygulama yenilenecek…'
        : state === 'none'
          ? 'Güncel ✓'
          : state === 'error'
            ? 'Bakılamadı, interneti kontrol et'
            : 'Güncellemeyi kontrol et';

  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <Muted style={{ fontSize: 12 }}>
        2miz {version}
        {build ? ` (${build})` : ''}
        {upd ? ` · güncelleme ${upd}` : ''}
        {Constants.appOwnership === 'expo' ? ' · Expo Go' : ''}
      </Muted>
      {enabled && (
        <Pressable onPress={check} hitSlop={8} style={{ padding: 6 }}>
          <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.primary, fontSize: 13, fontWeight: '600' }}>
            {label}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
