import React, { createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { primitives, semanticLight, semanticDark } from './tokens';
import type { SemanticTokens, Primitives } from './tokens';

type Scheme = 'light' | 'dark';

type ThemeValue = {
  tokens: SemanticTokens;
  primitives: Primitives;
  scheme: Scheme;
  setScheme: (s: Scheme) => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({
  children,
  forceScheme,
}: {
  children: React.ReactNode;
  forceScheme?: Scheme;
}) {
  const system = useColorScheme();
  const [override, setOverride] = useState<Scheme | null>(forceScheme ?? null);
  const scheme: Scheme = override ?? (system === 'dark' ? 'dark' : 'light');

  const value = useMemo<ThemeValue>(
    () => ({
      tokens: scheme === 'dark' ? semanticDark : semanticLight,
      primitives,
      scheme,
      setScheme: setOverride,
    }),
    [scheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme ต้องอยู่ภายใน ThemeProvider');
  return ctx;
}
