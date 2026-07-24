import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';

export function InboxScreen() {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  return (
    <SafeAreaView
      testID="screen-inbox"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface, alignItems: 'center', justifyContent: 'center', padding: p.space.xl }}
    >
      <Text variant="body" color="muted">{t('customer.inbox.empty')}</Text>
    </SafeAreaView>
  );
}
