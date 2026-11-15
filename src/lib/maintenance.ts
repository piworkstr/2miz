import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from './firebase';

// Bakım modu: yönetim panelinden açılır (config/app.maintenance). Açıkken giriş yapmış herkes bakım ekranını görür;
// kurucu çift hariç (uygulamayı denemeye devam edebilsinler). Canlı dinlenir: kapatılınca ekran kendiliğinden açılır.
export type AppConfig = { maintenance?: boolean; message?: string };
export function useMaintenance(uid: string | undefined) {
  const [cfg, setCfg] = useState<AppConfig>({});
  useEffect(() => {
    if (!uid) return setCfg({});
    return onSnapshot(
      doc(db, 'config', 'app'),
      (s) => setCfg((s.data() as AppConfig | undefined) ?? {}),
      () => {},
    );
  }, [uid]);
  return cfg;
}
