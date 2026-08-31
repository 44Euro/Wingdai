import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import { ChoiceCard } from '../../../ui/ChoiceCard';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';

type Props = NativeStackScreenProps<CustomerStackParamList, 'Settings'>;

// ชื่อภาษาเขียนด้วยภาษาของมันเองเสมอ ไม่แปลตามภาษาที่ใช้อยู่
const LANGUAGES = [
  { code: 'th', label: 'ไทย', descKey: 'settings.langThDesc' },
  { code: 'en', label: 'English', descKey: 'settings.langEnDesc' },
] as const;

/** C12 SY5 ตั้งค่าแอป ภาษาและธีม */
export function SettingsScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const { tokens, primitives: p, scheme, setScheme } = useTheme();

  return (
    <SafeAreaView
      testID="screen-settings"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScreenHeader title={t('settings.title')} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ padding: p.space.lg, gap: p.space.xl }}>
        <View style={{ gap: p.space.sm }}>
          <Text variant="caption" color="muted" bold>{t('settings.language')}</Text>
          {LANGUAGES.map((lang) => (
            <ChoiceCard
              key={lang.code}
              testID={`opt-lang-${lang.code}`}
              title={lang.label}
              description={t(lang.descKey)}
              icon="globe"
              tone="teal"
              selected={i18n.language === lang.code}
              onPress={() => i18n.changeLanguage(lang.code)}
            />
          ))}
        </View>

        <View style={{ gap: p.space.sm }}>
          <Text variant="caption" color="muted" bold>{t('settings.theme')}</Text>
          <ChoiceCard
            testID="opt-theme-light"
            title={t('settings.themeLight')}
            description={t('settings.themeLightDesc')}
            icon="star"
            selected={scheme === 'light'}
            onPress={() => setScheme('light')}
          />
          <ChoiceCard
            testID="opt-theme-dark"
            title={t('settings.themeDark')}
            description={t('settings.themeDarkDesc')}
            icon="moon"
            selected={scheme === 'dark'}
            onPress={() => setScheme('dark')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
