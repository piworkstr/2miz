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
import { openPlus, usePlus } from '../../lib/plus';
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

      <StoryCard couple={couple} myName={myName} partnerName={partnerName} me={profile} partner={partnerProfile} />
      <CoupleInfoCard />
      <PlusCard />

      <Section title="Birbirinizi tanıyın">
        <AboutUs myName={myName} partnerName={partnerName} me={profile} partner={partnerProfile} />
        {partnerProfile?.loveLanguage && (
          <Card
            style={{
              flexDirection: 'row',
              gap: 10,
              alignItems: 'flex-start',
              backgroundColor: t.colors.primarySoft,
              borderColor: t.colors.primarySoft,
            }}
          >
            <Ionicons name="bulb-outline" size={20} color={t.colors.primary} />
            <T style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>{LOVE_TIPS[partnerProfile.loveLanguage as LoveLanguage]?.(partnerName)}</T>
          </Card>
        )}
        <PetNames />
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
              <ThemeOption
                key={theme.id}
                theme={theme}
                selected={theme.id === t.id}
                saving={saving === theme.id}
                onPress={() => choose(theme)}
              />
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

// Her zaman görünen 2miz Plus kartı: açıksa kimin hediye ettiği ve bitiş tarihi.
function PlusCard() {
  const t = useTheme();
  const { user, partnerName } = useSession();
  const plus = usePlus();
  const until = plus.until ? new Date(plus.until).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) : '';
  const line = plus.paid
    ? `${plus.by === user?.uid ? 'Sen' : partnerName} ikinize hediye etti${until ? ` · ${until}’e kadar` : ''}`
    : plus.beta
      ? 'Beta boyunca her şey açık'
      : 'Sınırsız çark, oyun ve seyahat albümü';
  return (
    <Pressable
      onPress={() => openPlus('card')}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        borderRadius: t.radius.card,
        backgroundColor: t.colors.primarySoft,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Ionicons name={plus.paid ? 'gift' : 'heart'} size={24} color={t.colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.colors.onPrimarySoft, fontSize: 16, fontWeight: '700', fontFamily: t.fonts.button }}>2miz Plus</Text>
        <Text style={{ color: t.colors.onPrimarySoft, fontSize: 13, opacity: 0.85 }}>{line}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={t.colors.onPrimarySoft} />
    </Pressable>
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
function StoryCard({
  couple,
  myName,
  partnerName,
  me,
  partner,
}: {
  couple: Couple;
  myName: string;
  partnerName: string;
  me: Profile | null;
  partner: Profile | null;
}) {
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
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ borderRadius: 32, borderWidth: 3, borderColor: on, backgroundColor: on }}>
          <Avatar p={me} name={myName} size={56} showMood={false} />
        </View>
        <View style={{ marginLeft: -12, borderRadius: 32, borderWidth: 3, borderColor: on, backgroundColor: on }}>
          <Avatar p={partner} name={partnerName} size={56} showMood={false} />
        </View>
      </View>
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
          <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 8 }}>
            <Text style={{ fontSize: 44, fontWeight: '800', color: on, fontVariant: ['tabular-nums'] }}>{count}</Text>
            <Text style={{ fontSize: 16, color: on, fontFamily: t.fonts.body }}>gündür birlikte</Text>
          </View>
          <Text style={{ color: on, opacity: 0.9, fontSize: 14, fontFamily: t.fonts.body }}>
            Başlangıç: {prettyDate(couple.startDate!)}
            {upcoming ? `\n${upcoming}` : ''}
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

// İkinizi yan yana karşılaştıran tek kart: avatar ve ruh hali, sevgi dili, doğum günü, sevdikleri.
function AboutUs({
  myName,
  partnerName,
  me,
  partner,
}: {
  myName: string;
  partnerName: string;
  me: Profile | null;
  partner: Profile | null;
}) {
  const t = useTheme();
  const people = [
    { name: myName, p: me, mine: true },
    { name: partnerName, p: partner, mine: false },
  ];
  const lang = (p: Profile | null) => (p?.loveLanguage ? LOVE_LANGUAGES[p.loveLanguage as LoveLanguage]?.name : null) ?? 'Test çözülmedi';
  const bday = (p: Profile | null) => {
    if (!p?.birthDate) return '–';
    const d = daysUntilYearly(p.birthDate);
    return `${birthdayLabel(p.birthDate)}\n${d.days === 0 ? 'bugün! 🎂' : `${d.days} gün kaldı`}`;
  };
  const common = (me?.interests ?? []).filter((x) => partner?.interests?.includes(x));

  const row = (icon: IconName, label: string, values: [string, string]) => (
    <View style={{ gap: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: t.colors.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Ionicons name={icon} size={14} color={t.colors.muted} />
        <Muted style={{ fontSize: 12 }}>{label}</Muted>
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {values.map((v, i) => (
          <Text key={i} style={{ flex: 1, fontSize: 14, lineHeight: 19, color: t.colors.text, fontFamily: t.fonts.body }}>
            {v}
          </Text>
        ))}
      </View>
    </View>
  );

  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {people.map(({ name, p, mine }) => {
          const mood = activeMood(p?.mood);
          return (
            <Pressable key={name} disabled={!mine} onPress={() => router.push('/avatar')} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <View>
                <Avatar p={p} name={name} size={64} />
                {mine && (
                  <View
                    style={{
                      position: 'absolute',
                      left: -2,
                      bottom: -2,
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: t.colors.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 2,
                      borderColor: t.colors.card,
                    }}
                  >
                    <Ionicons name="pencil" size={12} color={t.colors.onPrimary} />
                  </View>
                )}
              </View>
              <T style={{ fontWeight: '700', fontSize: 16 }}>{name}</T>
              <Muted style={{ fontSize: 12 }}>{mood ? `${MOODS[mood].emoji} ${MOODS[mood].label}` : mine ? 'Avatarı düzenle' : ' '}</Muted>
            </Pressable>
          );
        })}
      </View>
      {row('heart-outline', 'Sevgi dili', [lang(me), lang(partner)])}
      {row('gift-outline', 'Doğum günü', [bday(me), bday(partner)])}
      {row('sparkles-outline', 'Sevdikleri', [
        me?.interests?.slice(0, 4).join(', ') || '–',
        partner?.interests?.slice(0, 4).join(', ') || '–',
      ])}
      {!!common.length && (
        <View style={{ gap: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: t.colors.border }}>
          <Muted style={{ fontSize: 12 }}>İkinizin de sevdikleri</Muted>
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
                  borderRadius: 12,
                  overflow: 'hidden',
                }}
              >
                {c}
              </Text>
            ))}
          </View>
        </View>
      )}
    </Card>
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
