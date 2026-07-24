import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';

export function ProfileScreen() {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  return (
    <SafeAreaView testID="screen-profile" edges={['top']} style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
      <View style={{ padding: p.space.xl }}>
        <Text variant="h1">{t('customer.profile.title')}</Text>
      </View>
    </SafeAreaView>
  );
}
