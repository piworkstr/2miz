import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { AppState } from 'react-native';

// Otomatik güncelleme: uygulama açılınca ve arka plandan dönünce yeni sürüm var mı diye bakar; varsa indirir ve
// uygulamayı kendisi yeniler. Kimsenin "iki kez kapat-aç" ya da düğmeye basması gerekmez.
// Arka plandan dönüşte yalnızca uygulama en az 30 sn arkada kaldıysa yeniler (yazı yazarken araya girmesin).
let checking = false;
let lastCheck = 0;

async function checkAndApply() {
  if (checking || !Updates.isEnabled || Constants.appOwnership === 'expo') return;
  if (Date.now() - lastCheck < 60_000) return;
  checking = true;
  lastCheck = Date.now();
  try {
    const r = await Updates.checkForUpdateAsync();
    if (r.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch {
    /* internet yoksa bir sonraki açılışta dener */
  } finally {
    checking = false;
  }
}

export function useAutoUpdate() {
  useEffect(() => {
    checkAndApply();
    let leftAt = 0;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') leftAt = Date.now();
      else if (s === 'active' && leftAt && Date.now() - leftAt > 30_000) checkAndApply();
    });
    return () => sub.remove();
  }, []);
}
