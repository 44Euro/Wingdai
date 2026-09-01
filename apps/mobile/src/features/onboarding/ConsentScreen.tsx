import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../ui/Text';
import { Card } from '../../ui/Surface';
import { ScreenHeader } from '../../ui/ScreenHeader';
import type { AuthStackParamList } from '../../app/navigators/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'Consent'>;

/** หัวข้อที่ PDPA บังคับให้ต้องแจ้ง เรียงตามลำดับที่คนอ่านแล้วเข้าใจง่ายที่สุด */
const SECTIONS = ['collect', 'purpose', 'retain', 'share', 'rights', 'contact'] as const;

/** A8 อ่านอย่างเดียว การกดยอมรับอยู่ที่ช่องติ๊กบนจอสมัคร ไม่ใช่ที่นี่ */
export function ConsentScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();

  return (
    <SafeAreaView
      testID="screen-consent"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScreenHeader title={t('consent.title')} onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{ padding: p.space.screen, paddingTop: 0, gap: p.space.lg }}
        showsVerticalScrollIndicator={false}
      >
        {/* คนอ่านต้องรู้ตั้งแต่บรรทัดแรกว่านี่ไม่ใช่เอกสารที่ใช้อ้างได้จริง */}
        <Card testID="consent-demo-notice" tone="teal">
          <Text variant="small" color="onTeal">{t('consent.demoNotice')}</Text>
        </Card>

        <Text variant="body" color="muted">{t('consent.intro')}</Text>

        {SECTIONS.map((key) => (
          <View key={key} testID={`consent-section-${key}`} style={{ gap: p.space.xs }}>
            <Text variant="h3">{t(`consent.section.${key}.title`)}</Text>
            <Text variant="small" color="muted">{t(`consent.section.${key}.body`)}</Text>
          </View>
        ))}

        <Text variant="caption" color="muted">{t('consent.updated')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
