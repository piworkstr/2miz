import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useL } from '../lib/i18n';
import { useTheme } from '../lib/useTheme';
import { Muted } from './ui';

// Sürüm satırı + "Güncellemeyi kontrol et": havadan gelen düzeltmeyi beklemeden indirir ve uygulamayı yeniler.
// Expo Go'da (geliştirme) güncelleme sistemi kapalıdır; orada yalnızca sürüm görünür.
export function UpdateCard() {
  const t = useTheme();
  const l = useL();
  const [state, setState] = useState<'idle' | 'checking' | 'downloading' | 'none' | 'error'>('idle');
  const version = Constants.expoConfig?.version ?? '?';
  const build = Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode ?? '';
  const upd = Updates.updateId ? Updates.updateId.slice(-6) : Updates.isEmbeddedLaunch ? l('yerleşik', 'built-in') : '';
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
      ? l('Bakılıyor…', 'Checking…')
      : state === 'downloading'
        ? l('İndiriliyor, uygulama yenilenecek…', 'Downloading, the app will reload…')
        : state === 'none'
          ? l('Güncel ✓', 'Up to date ✓')
          : state === 'error'
            ? l('Bakılamadı, interneti kontrol et', "Couldn't check, check your internet")
            : l('Güncellemeyi kontrol et', 'Check for updates');

  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <Muted style={{ fontSize: 12 }}>
        bir iz {version}
        {build ? ` (${build})` : ''}
        {upd ? ` · ${l('güncelleme', 'update')} ${upd}` : ''}
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
