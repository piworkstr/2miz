import { AccountCard, NotifCard } from '../../components/AccountCard';
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
import { ProfileEditCard } from '../../components/ProfileEditCard';
import { ThemeOption } from '../../components/ThemeOption';
import { Button, Card, Muted, Screen, T, Title } from '../../components/ui';
import { activeMood, MOODS, moodLabel } from '../../lib/avatar';
import { enDate, prettyDate, trDate } from '../../lib/date';
import { useUpcomingDates } from '../../lib/dates';
import { useL } from '../../lib/i18n';
import { interestLabel } from '../../lib/interests';
import { auth } from '../../lib/firebase';
import { loveLanguage as loveLanguageOf, type LoveLanguage } from '../../lib/loveLanguage';
import { openPlus, usePlus } from '../../lib/plus';
import { useSession, type Couple, type Profile } from '../../lib/session';
import { Hint } from '../../components/Hint';
import { LivingChips } from '../../components/LivingCard';
import { FeedbackCard } from '../../components/FeedbackCard';
import { GuideCard } from '../../components/GuideCard';
import { UpdateCard } from '../../components/UpdateCard';
import { PersonaCard } from '../../components/PersonaCard';
import { LanguageCard } from '../../components/LanguageCard';
import { birthdayLabel, daysUntilYearly, LOVE_TIPS, LOVE_TIPS_EN, nextMilestone, useCoupleStats } from '../../lib/stats';
import { themeList, tx, type Theme } from '../../lib/theme';
import { saveTheme, useTheme } from '../../lib/useTheme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const STATUS: Record<NonNullable<Couple['status']>, { tr: string; en: string }> = {
  sevgili: { tr: 'Sevgili', en: 'Dating' },
  nisanli: { tr: 'Nişanlı', en: 'Engaged' },
  evli: { tr: 'Evli', en: 'Married' },
  uzak: { tr: 'Uzak mesafe', en: 'Long distance' },
};

export default function Profile() {
  const { user, profile, partnerName, partnerProfile, couple } = useSession();
  const t = useTheme();
  const l = useL();
  const stats = useCoupleStats(couple?.id);
  const dates = useUpcomingDates(couple?.id);
  const [saving, setSaving] = useState<string | null>(null);
  const [themesOpen, setThemesOpen] = useState(false);

  if (!user || !couple) return null;
  const myName = profile?.name ?? l('Sen', 'You');
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
      <ProfileEditCard />
      <CoupleInfoCard />
      <Card style={{ gap: 8, zIndex: 5 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <T style={{ flex: 1, fontSize: 16, fontWeight: '600', fontFamily: t.fonts.button }}>
            {tx(t, l('Nasıl yaşıyorsunuz?', 'How do you live?'))}
          </T>
          <Hint id="living">
            {l(
              'Günlük görevler buna göre seçilir: ayrı yaşıyorsanız "kahvaltı hazırla" gibi ev içi görevler çıkmaz, uzak mesafedeyseniz yalnız uzaktan yapılabilenler gelir. İkiniz de değiştirebilirsiniz.',
              'Daily tasks are picked based on this: if you live apart, at-home tasks like "make breakfast" won\'t come up; if you\'re long distance, you only get tasks you can do apart. Either of you can change it.',
            )}
          </Hint>
        </View>
        <LivingChips compact />
      </Card>
      <PersonaCard />
      <LanguageCard />
      <GuideCard />
      <NotifCard />
      <AccountCard />
      <FeedbackCard />
      <PlusCard />

      <Section title={l('Birbirinizi tanıyın', 'Get to know each other')}>
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
            <T style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>
              {(t.lang === 'en' ? LOVE_TIPS_EN : LOVE_TIPS)[partnerProfile.loveLanguage as LoveLanguage]?.(partnerName)}
            </T>
          </Card>
        )}
        <PetNames />
      </Section>

      <Section title={l('Hikayeniz rakamlarla', 'Your story in numbers')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Stat icon="checkmark-done-outline" value={stats?.days} label={l('birlikte tamamlanan gün', 'days completed together')} />
          <Stat icon="flame-outline" value={couple.bestStreak ?? couple.streak ?? 0} label={l('en uzun seri', 'longest streak')} />
          <Stat icon="images-outline" value={stats?.photos} label={l('anı (selfie)', 'memories (selfies)')} />
          <Stat icon="game-controller-outline" value={stats?.games} label={l('oynanan oyun', 'games played')} />
          <Stat icon="gift-outline" value={stats?.coupons} label={l('kullanılan kupon', 'coupons used')} />
          <Stat
            icon={t.id === 'asko' ? 'heart' : 'star-outline'}
            value={couple.points ?? 0}
            label={l(`toplam ${t.copy.points}`, `total ${t.copy.points}`)}
          />
        </View>
      </Section>

      {nextDate && (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Ionicons name="calendar" size={24} color={t.colors.primary} />
          <View style={{ flex: 1 }}>
            <Muted style={{ fontSize: 13 }}>{l('Sıradaki date', 'Next date')}</Muted>
            <T style={{ fontWeight: '600' }}>{prettyDate(nextDate.id, t.lang)}</T>
          </View>
        </Card>
      )}

      <Section title={l('Görünüm', 'Appearance')}>
        <Pressable
          onPress={() => setThemesOpen(!themesOpen)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}
        >
          <Ionicons name="color-palette-outline" size={20} color={t.colors.primary} />
          <T style={{ flex: 1 }}>
            {l('Tema', 'Theme')}: {t.name}
          </T>
          <Ionicons name={themesOpen ? 'chevron-up' : 'chevron-down'} size={18} color={t.colors.muted} />
        </Pressable>
        {themesOpen && (
          <>
            <Muted>
              {l(
                `Tema sadece senin telefonunu değiştirir, ${partnerName} kendi temasını seçer.`,
                `The theme only changes your phone; ${partnerName} picks their own.`,
              )}
            </Muted>
            {themeList(t.lang).map((theme) => (
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

      <Button label={l('Çıkış yap', 'Sign out')} variant="secondary" onPress={() => signOut(auth).then(() => router.replace('/welcome'))} />
      <EndCouple />
      <DeleteAccount />
      <UpdateCard />
    </Screen>
  );
}

// Her zaman görünen bir iz Plus kartı: açıksa kimin hediye ettiği ve bitiş tarihi.
function PlusCard() {
  const t = useTheme();
  const { user, partnerName } = useSession();
  const l = useL();
  const plus = usePlus();
  const en = t.lang === 'en';
  const until = plus.until ? (en ? enDate(new Date(plus.until), { year: true }) : trDate(new Date(plus.until))) : '';
  const giver = plus.by === 'hediye' ? 'bir iz' : plus.by === user?.uid ? l('Sen', 'You') : partnerName;
  const line = plus.paid
    ? en
      ? `${giver} gifted it to you both${until ? ` · until ${until}` : ''}`
      : `${giver} ikinize hediye etti${until ? ` · ${until}’e kadar` : ''}`
    : plus.beta
      ? l('Beta boyunca her şey açık', 'Everything is open during the beta')
      : l('Sınırsız çark, oyun ve seyahat albümü', 'Unlimited wheel, games and travel albums');
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
        <Text
          maxFontSizeMultiplier={1.25}
          style={{ color: t.colors.onPrimarySoft, fontSize: 16, fontWeight: '700', fontFamily: t.fonts.button }}
        >
          bir iz Plus
        </Text>
        <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.onPrimarySoft, fontSize: 13, opacity: 0.85 }}>
          {line}
        </Text>
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
  const l = useL();
  const on = t.colors.onPrimary;
  const count = couple.startDate ? daysTogether(couple.startDate) : null;
  const anniv = couple.startDate ? daysUntilYearly(couple.startDate) : null;
  const mile = count ? nextMilestone(count) : null;

  // Yıl dönümü mü yoksa yuvarlak gün mü daha yakın, onu göster.
  const upcoming =
    anniv && mile
      ? anniv.days === 0
        ? l(`Bugün ${anniv.years}. yıl dönümünüz!`, `Today is your ${ordinal(anniv.years)} anniversary!`)
        : mile.inDays < anniv.days
          ? l(`${mile.at}. gününüze ${mile.inDays} gün kaldı`, `${dayWord(mile.inDays)} to your day ${mile.at}`)
          : l(
              `${anniv.years}. yıl dönümünüze ${anniv.days} gün kaldı`,
              `${dayWord(anniv.days)} to your ${ordinal(anniv.years)} anniversary`,
            )
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
      <Text
        maxFontSizeMultiplier={1.25}
        style={{ fontFamily: t.fonts.title, fontSize: t.titleSize * 0.95, lineHeight: t.titleSize * 1.15, color: on }}
      >
        {tx(t, `${myName} & ${partnerName}`)}
      </Text>
      {couple.status && (
        <Text
          maxFontSizeMultiplier={1.25}
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
          {tx(t, STATUS[couple.status][t.lang])}
        </Text>
      )}
      {count ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 8 }}>
            <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 44, fontWeight: '800', color: on, fontVariant: ['tabular-nums'] }}>
              {count}
            </Text>
            <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 16, color: on, fontFamily: t.fonts.body }}>
              {l('gündür birlikte', count === 1 ? 'day together' : 'days together')}
            </Text>
          </View>
          <Text maxFontSizeMultiplier={1.25} style={{ color: on, opacity: 0.9, fontSize: 14, fontFamily: t.fonts.body }}>
            {l('Başlangıç', 'Since')}: {prettyDate(couple.startDate!, t.lang)}
            {upcoming ? `\n${upcoming}` : ''}
          </Text>
        </>
      ) : (
        <Text maxFontSizeMultiplier={1.25} style={{ color: on, fontSize: 14, fontFamily: t.fonts.body }}>
          {l(
            'Ne zamandan beri birlikte olduğunuzu ekleyin, gün sayacınız burada başlasın.',
            'Add when you got together and your day counter starts here.',
          )}
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
  const l = useL();
  const people = [
    { name: myName, p: me, mine: true },
    { name: partnerName, p: partner, mine: false },
  ];
  const lang = (p: Profile | null) =>
    (p?.loveLanguage ? loveLanguageOf(p.loveLanguage as LoveLanguage, t.lang)?.name : null) ?? l('Test çözülmedi', 'Quiz not taken');
  const bday = (p: Profile | null) => {
    if (!p?.birthDate) return '–';
    const d = daysUntilYearly(p.birthDate);
    return `${birthdayLabel(p.birthDate, t.lang)}\n${d.days === 0 ? l('bugün! 🎂', 'today! 🎂') : l(`${d.days} gün kaldı`, `in ${dayWord(d.days)}`)}`;
  };
  const common = (me?.interests ?? []).filter((x) => partner?.interests?.includes(x));
  const likes = (p: Profile | null) => (p?.interests ?? []).map((i) => interestLabel(i, t.lang)).join(', ');

  const row = (icon: IconName, label: string, values: [string, string]) => (
    <View style={{ gap: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: t.colors.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Ionicons name={icon} size={14} color={t.colors.muted} />
        <Muted style={{ fontSize: 12 }}>{label}</Muted>
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {values.map((v, i) => (
          <Text
            maxFontSizeMultiplier={1.25}
            key={i}
            style={{ flex: 1, fontSize: 14, lineHeight: 19, color: t.colors.text, fontFamily: t.fonts.body }}
          >
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
              <Muted style={{ fontSize: 12 }}>
                {mood ? `${MOODS[mood].emoji} ${moodLabel(mood, t.lang)}` : mine ? l('Avatarı düzenle', 'Edit avatar') : ' '}
              </Muted>
            </Pressable>
          );
        })}
      </View>
      {row('heart-outline', l('Sevgi dili', 'Love language'), [lang(me), lang(partner)])}
      {row('gift-outline', l('Doğum günü', 'Birthday'), [bday(me), bday(partner)])}
      {row('sparkles-outline', l('Sevdikleri', 'Likes'), [
        likes(me) || l('Henüz eklemedin · üstteki “Düzenle”den ekle', 'Nothing yet · add some with “Edit” above'),
        likes(partner) || l('Henüz eklemedi', 'Nothing yet'),
      ])}
      {!!common.length && (
        <View style={{ gap: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: t.colors.border }}>
          <Muted style={{ fontSize: 12 }}>{l('İkinizin de sevdikleri', 'You both like')}</Muted>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {common.map((c) => (
              <Text
                maxFontSizeMultiplier={1.25}
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
                {interestLabel(c, t.lang)}
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
      <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 26, fontWeight: '700', color: t.colors.text, fontVariant: ['tabular-nums'] }}>
        {value === undefined ? '–' : value}
      </Text>
      <Muted style={{ fontSize: 12 }}>{tx(t, label)}</Muted>
    </View>
  );
}

// İngilizce sayı yazımı: 1 day / 3 days, 1st / 2nd / 3rd / 11th.
const dayWord = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;
function ordinal(n: number) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${s}`;
}
