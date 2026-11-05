import { createContext, useContext, useState, type ReactNode } from 'react';
import type { LoveLanguage } from './loveLanguage';
import type { ThemeId } from './theme';

// Hesap açılmadan önce verilen cevaplar burada tutulur, kayıt olunca profile yazılır.
type Onboarding = {
  loveLanguage: LoveLanguage | null;
  theme: ThemeId | null;
  setLoveLanguage: (l: LoveLanguage) => void;
  setTheme: (t: ThemeId) => void;
};

const Ctx = createContext<Onboarding>({
  loveLanguage: null,
  theme: null,
  setLoveLanguage: () => {},
  setTheme: () => {},
});

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [loveLanguage, setLoveLanguage] = useState<LoveLanguage | null>(null);
  const [theme, setTheme] = useState<ThemeId | null>(null);
  return <Ctx.Provider value={{ loveLanguage, theme, setLoveLanguage, setTheme }}>{children}</Ctx.Provider>;
}

export const useOnboarding = () => useContext(Ctx);
