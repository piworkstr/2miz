import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { signOut } from 'firebase/auth';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { CoupleInfoCard, daysTogether } from '../../components/CoupleInfoCard';
import { DeleteAccount } from '../../components/DeleteAccount';
import { EndCouple } from '../../components/EndCouple';
import { PetNames } from '../../components/PetNames';
import { ThemeOption } from '../../components/ThemeOption';
import { Button, Card, Muted, Screen, T, Title } from '../../components/ui';
import { activeMood, MOODS } from '../../lib/avatar';
import { prettyDate } from '../../lib/date';
import { useUpcomingDates } from '../../lib/dates';
import { auth } from '../../lib/firebase';
import { LOVE_LANGUAGES, type LoveLanguage } from '../../lib/loveLanguage';
import { useSession, type Couple, type Profile } from '../../lib/session';
import { birthdayLabel, daysUntilYearly, LOVE_TIPS, nextMilestone, useCoupleStats } from '../../lib/stats';
import { THEME_LIST, tx, type Theme } from '../../lib/theme';
import { saveTheme, useTheme } from '../../lib/useTheme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const STATUS: Record<NonNullable<Couple['status']>, string> = {
  sevgili: 'Sevgili',
  nisanli: 'Nişanlı',
  evli: 'Evli',
  uzak: 'Uzak mesafe',
};

export default function Profile() {
  const { user, profile, partnerName, partnerProfile, couple } = useSession();
  const t = useTheme();
  const stats = useCoupleStats(couple?.id);
  const dates = useUpcomingDates(couple?.id);
  const [saving, setSaving] = useState<string | null>(null);
  const [themesOpen, setThemesOpen] = useState(false);

  if (!user || !couple) return null;
  const myName = profile?.name ?? 'Sen';
  const nextDate = dates.find((d) => d.status === 'confirmed');

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

      <StoryCard couple={couple} myName={myName} partnerName={partnerName} />
      <CoupleInfoCard />

      <Section title="Birbirinizi tanıyın">
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <PersonCard name={myName} p={profile} />
          <PersonCard name={partnerName} p={partnerProfile} partner />
        </View>
        <PetNames />
        <SharedInterests a={profile?.interests} b={partnerProfile?.interests} />
        {partnerProfile?.loveLanguage && (
          <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: t.colors.primarySoft, borderColor: t.colors.primarySoft }}>
            <Ionicons name="bulb-outline" size={20} color={t.colors.primary} />
            <T style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>
              {LOVE_TIPS[partnerProfile.loveLanguage as LoveLanguage]?.(partnerName)}
            </T>
          </Card>
        )}
      </Section>

      <Section title="Hikayeniz rakamlarla">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Stat icon="checkmark-done-outline" value={stats?.days} label="birlikte tamamlanan gün" />
          <Stat icon="flame-outline" value={couple.bestStreak ?? couple.streak ?? 0} label="en uzun seri" />
          <Stat icon="images-outline" value={stats?.photos} label="anı (selfie)" />
          <Stat icon="game-controller-outline" value={stats?.games} label="oynanan oyun" />
          <Stat icon="gift-outline" value={stats?.coupons} label="kullanılan kupon" />
          <Stat icon={t.id === 'asko' ? 'heart' : 'star-outline'} value={couple.points ?? 0} label={`toplam ${t.copy.points}`} />
        </View>
      </Section>

      {nextDate && (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Ionicons name="calendar" size={24} color={t.colors.primary} />
          <View style={{ flex: 1 }}>
            <Muted style={{ fontSize: 13 }}>Sıradaki date</Muted>
            <T style={{ fontWeight: '600' }}>{prettyDate(nextDate.id)}</T>
          </View>
        </Card>
      )}

      <Section title="Görünüm">
        <Pressable
          onPress={() => setThemesOpen(!themesOpen)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}
        >
          <Ionicons name="color-palette-outline" size={20} color={t.colors.primary} />
          <T style={{ flex: 1 }}>Tema: {t.name}</T>
          <Ionicons name={themesOpen ? 'chevron-up' : 'chevron-down'} size={18} color={t.colors.muted} />
        </Pressable>
        {themesOpen && (
          <>
            <Muted>Tema sadece senin telefonunu değiştirir, {partnerName} kendi temasını seçer.</Muted>
            {THEME_LIST.map((theme) => (
              <ThemeOption key={theme.id} theme={theme} selected={theme.id === t.id} saving={saving === theme.id} onPress={() => choose(theme)} />
            ))}
          </>
        )}
      </Section>

      <Button label="Çıkış yap" variant="secondary" onPress={() => signOut(auth)} />
      <EndCouple />
      <DeleteAccount />
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: 10 }}>
      <T style={{ fontSize: 17, fontWeight: '600', fontFamily: t.fonts.button }}>{tx(t, title)}</T>
      {children}
    </View>
  );
}

// Üst kart: isimler, ilişki durumu, gün sayacı ve sıradaki özel gün.
function StoryCard({ couple, myName, partnerName }: { couple: Couple; myName: string; partnerName: string }) {
  const t = useTheme();
  const on = t.colors.onPrimary;
  const count = couple.startDate ? daysTogether(couple.startDate) : null;
  const anniv = couple.startDate ? daysUntilYearly(couple.startDate) : null;
  const mile = count ? nextMilestone(count) : null;

  // Yıl dönümü mü yoksa yuvarlak gün mü daha yakın, onu göster.
  const upcoming =
    anniv && mile
      ? anniv.days === 0
        ? `Bugün ${anniv.years}. yıl dönümünüz!`
        : mile.inDays < anniv.days
          ? `${mile.at}. gününüze ${mile.inDays} gün kaldı`
          : `${anniv.years}. yıl dönümünüze ${anniv.days} gün kaldı`
      : null;

  return (
    <View style={{ backgroundColor: t.colors.primary, borderRadius: Math.max(t.radius.card, 6), padding: 20, gap: 10 }}>
      <Text style={{ fontFamily: t.fonts.title, fontSize: t.titleSize * 0.95, lineHeight: t.titleSize * 1.15, color: on }}>
        {tx(t, `${myName} & ${partnerName}`)}
      </Text>
      {couple.status && (
        <Text
          style={{
            alignSelf: 'flex-start',
            color: t.colors.primary,
            backgroundColor: on,
            fontSize: 12,
            fontWeight: '700',
            paddingHorizontal: 10,
            paddingVertical: 3,
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          {tx(t, STATUS[couple.status])}
        </Text>
      )}
      {count ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Text style={{ fontSize: 44, fontWeight: '800', color: on, fontVariant: ['tabular-nums'] }}>{count}</Text>
            <Text style={{ fontSize: 16, color: on, fontFamily: t.fonts.body }}>gündür birliktesiniz</Text>
          </View>
          <Text style={{ color: on, opacity: 0.9, fontSize: 14, fontFamily: t.fonts.body }}>
            Başlangıç: {prettyDate(couple.startDate!)}{upcoming ? `\n${upcoming}` : ''}
          </Text>
        </>
      ) : (
        <Text style={{ color: on, fontSize: 14, fontFamily: t.fonts.body }}>
          Ne zamandan beri birlikte olduğunuzu ekleyin, gün sayacınız burada başlasın.
        </Text>
      )}
    </View>
  );
}

function PersonCard({ name, p, partner }: { name: string; p: Profile | null; partner?: boolean }) {
  const t = useTheme();
  const lang = p?.loveLanguage ? LOVE_LANGUAGES[p.loveLanguage as LoveLanguage] : null;
  const bday = p?.birthDate ? daysUntilYearly(p.birthDate) : null;
  return (
    <Card style={{ flex: 1, gap: 8, padding: 14, backgroundColor: partner ? t.colors.primarySoft : t.colors.card }}>
      <Pressable onPress={partner ? undefined : () => router.push('/avatar')} disabled={partner} style={{ alignItems: 'center', gap: 4 }}>
        <Avatar p={p} name={name} size={64} />
        {!partner && <Text style={{ fontSize: 12, color: t.colors.primary, fontWeight: '600' }}>{p?.avatar ? 'Avatarı düzenle' : 'Avatar oluştur'}</Text>}
      </Pressable>
      <T style={{ fontWeight: '700', fontSize: 16 }} >{name}</T>
      {activeMood(p?.mood) && (
        <Line icon="happy-outline" label="Ruh hali" value={`${MOODS[activeMood(p?.mood)!].emoji} ${MOODS[activeMood(p?.mood)!].label}`} />
      )}
      <Line icon="heart-outline" label="Sevgi dili" value={lang?.name ?? 'Test çözülmedi'} />
      {p?.birthDate && (
        <Line
          icon="gift-outline"
          label="Doğum günü"
          value={`${birthdayLabel(p.birthDate)}${bday ? (bday.days === 0 ? ' · bugün!' : ` · ${bday.days} gün`) : ''}`}
        />
      )}
      {!!p?.interests?.length && <Line icon="sparkles-outline" label="Sevdikleri" value={p.interests.slice(0, 4).join(', ')} />}
    </Card>
  );
}

function Line({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Ionicons name={icon} size={13} color={t.colors.muted} />
        <Muted style={{ fontSize: 12 }}>{label}</Muted>
      </View>
      <T style={{ fontSize: 14 }}>{value}</T>
    </View>
  );
}

function SharedInterests({ a, b }: { a?: string[]; b?: string[] }) {
  const t = useTheme();
  if (!a?.length || !b?.length) return null;
  const common = a.filter((x) => b.includes(x));
  return (
    <View style={{ gap: 6 }}>
      <Muted style={{ fontSize: 13 }}>
        {common.length ? 'İkinizin de sevdikleri' : 'Ortak ilgi alanınız henüz yok, birbirinizinkini keşfedin'}
      </Muted>
      {!!common.length && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {common.map((c) => (
            <Text
              key={c}
              style={{
                color: t.colors.primary,
                backgroundColor: t.colors.primarySoft,
                fontWeight: '600',
                fontSize: 13,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: t.radius.pill + 6,
                overflow: 'hidden',
              }}
            >
              {c}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function Stat({ icon, value, label }: { icon: IconName; value: number | undefined; label: string }) {
  const t = useTheme();
  return (
    <View
      style={{
        width: '48%',
        flexGrow: 1,
        backgroundColor: t.colors.card,
        borderWidth: 1,
        borderColor: t.colors.border,
        borderRadius: Math.min(t.radius.card, 14),
        padding: 14,
        gap: 4,
      }}
    >
      <Ionicons name={icon} size={20} color={t.colors.primary} />
      <Text style={{ fontSize: 26, fontWeight: '700', color: t.colors.text, fontVariant: ['tabular-nums'] }}>
        {value === undefined ? '–' : value}
      </Text>
      <Muted style={{ fontSize: 12 }}>{tx(t, label)}</Muted>
    </View>
  );
}
