import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import type { MerchantStackParamList } from '../../../app/navigators/MerchantStack';

type Props = NativeStackScreenProps<MerchantStackParamList, 'AddMenuItem'>;

export function AddMenuItemScreen(_props: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  return (
    <SafeAreaView testID="screen-add-menu-item" edges={['bottom']} style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
      <View style={{ padding: p.space.xl }}>
        <Text variant="h1">{t('merchant.form.title')}</Text>
      </View>
    </SafeAreaView>
  );
}
