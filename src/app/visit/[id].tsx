import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { farmOf, type Farm } from '../../lib/farm';
import { leaveVisit, loadPublicFarm, type PublicChar } from '../../lib/farmVisit';
import { useSession } from '../../lib/session';
import { FarmVisit } from '../garden';

// Başka bir çiftin çiftliğini gez (salt okunur). Ziyaret, çiftliğin sahibine "kim uğradı" olarak görünür.
export default function VisitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { couple, user, profile, partnerName } = useSession();
  const [state, setState] = useState<{ farm: Farm; title: string; chars: PublicChar[] } | 'none' | null>(null);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/garden'));

  useEffect(() => {
    if (!id) return;
    let alive = true;
    loadPublicFarm(id)
      .then((r) => {
        if (!alive) return;
        setState(r ? { farm: r.farm, title: `${r.name} · seviye ${r.lvl}`, chars: r.chars } : 'none');
        const mine = couple ? farmOf(couple) : null;
        if (r && couple && mine?.name && !mine.closed) void leaveVisit(id, couple.id, mine.name);
      })
      .catch(() => alive && setState('none'));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (state && state !== 'none')
    return (
      <FarmVisit
        farm={state.farm}
        title={state.title}
        chars={state.chars}
        hostId={id}
        who={couple && user ? { coupleId: couple.id, uid: user.uid, name: profile?.name ?? 'Ben', partnerName } : undefined}
        coins={couple ? farmOf(couple).coins : undefined}
        onClose={close}
      />
    );
  return (
    <View style={{ flex: 1, backgroundColor: '#FFF8F3', alignItems: 'center', justifyContent: 'center', padding: 30, gap: 14 }}>
      {state === null ? (
        <ActivityIndicator color="#6DB33F" />
      ) : (
        <>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#2B1D22', textAlign: 'center' }}>Bu çiftlik şu an ziyarete kapalı.</Text>
          <Pressable onPress={close} style={{ backgroundColor: '#6DB33F', borderRadius: 14, paddingHorizontal: 22, paddingVertical: 12 }}>
            <Text style={{ color: '#fff', fontWeight: '800' }}>Geri dön</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
