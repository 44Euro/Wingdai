import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';

type Props = NativeStackScreenProps<CustomerStackParamList, 'CustomerHome'>;

export function CustomerHomeScreen(_props: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  return (
    <SafeAreaView testID="screen-customer-home" edges={['top']} style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
      <View style={{ padding: p.space.xl }}>
        <Text variant="h1">{t('customer.home.title')}</Text>
      </View>
    </SafeAreaView>
  );
}
