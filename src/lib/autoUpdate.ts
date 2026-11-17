import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { AppState } from 'react-native';

// Otomatik güncelleme: uygulama açılınca ve arka plandan dönünce yeni sürüm var mı diye bakar; varsa indirir ve
// uygulamayı kendisi yeniler. Kimsenin "iki kez kapat-aç" ya da düğmeye basması gerekmez.
// Açılışta indirme birkaç saniyeyi geçerse uygulama kullanılırken yeniden başlatılmaz (bildirime dokunup mesaja
// girerken araya girip yarım dakika bekletiyordu): indirilen sürüm, uygulama arka plana gidip dönünce uygulanır.
let checking = false;
let lastCheck = 0;
let pending = false;
const QUICK = 4000;

async function checkAndApply(reloadNow: boolean) {
  if (checking || !Updates.isEnabled || Constants.appOwnership === 'expo') return;
  if (Date.now() - lastCheck < 60_000) return;
  checking = true;
  lastCheck = Date.now();
  const t0 = Date.now();
  try {
    const r = await Updates.checkForUpdateAsync();
    if (r.isAvailable) {
      await Updates.fetchUpdateAsync();
      if (reloadNow || Date.now() - t0 < QUICK) await Updates.reloadAsync();
      else pending = true;
    }
  } catch {
    /* internet yoksa bir sonraki açılışta dener */
  } finally {
    checking = false;
  }
}

export function useAutoUpdate() {
  useEffect(() => {
    checkAndApply(false);
    let leftAt = 0;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') leftAt = Date.now();
      else if (s === 'active' && leftAt) {
        const away = Date.now() - leftAt;
        if (pending && away > 3000) {
          pending = false;
          Updates.reloadAsync().catch(() => {});
        } else if (away > 30_000) checkAndApply(true);
      }
    });
    return () => sub.remove();
  }, []);
}
