import React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { RoleSwitcher } from '../../../app/RoleSwitcher';
import { useMenu } from '../../customer/hooks';
import { useOwnerRestaurantId } from '../hooks';
import { formatBaht } from '../../../lib/format';
import { useAuthStore } from '../../auth/authStore';
import type { MerchantStackParamList } from '../../../app/navigators/MerchantStack';

type Props = NativeStackScreenProps<MerchantStackParamList, 'MerchantMenu'>;

export function MerchantMenuScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const restaurantId = useOwnerRestaurantId();
  const { data: menu = [] } = useMenu(restaurantId ?? '');
  const logout = useAuthStore((s) => s.logout);

  return (
    <SafeAreaView testID="screen-merchant-menu" edges={['top']} style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
      <ScrollView contentContainerStyle={{ padding: p.space.xl, gap: p.space.md }}>
        <Text variant="h1">{t('merchant.menu.title')}</Text>
        <RoleSwitcher />

        <Button
          testID="btn-add-menu"
          label={t('merchant.menu.add')}
          onPress={() => restaurantId && navigation.navigate('AddMenuItem', { restaurantId })}
        />

        {menu.length === 0 ? (
          <Text variant="body" color="muted">{t('merchant.menu.empty')}</Text>
        ) : (
          menu.map((m) => (
            <View
              key={m.id}
              testID={`menu-row-${m.id}`}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: tokens.bgRaised, borderRadius: p.radius.md, borderWidth: 1, borderColor: tokens.borderSubtle, padding: p.space.lg }}
            >
              <View style={{ flex: 1 }}>
                <Text variant="body">{m.name}</Text>
                {m.optionGroups?.length ? (
                  <Text variant="caption" color="muted">{m.optionGroups.length} กลุ่มตัวเลือก</Text>
                ) : null}
              </View>
              <Text variant="small" color="muted">{formatBaht(m.price)}</Text>
            </View>
          ))
        )}

        <Pressable testID="btn-logout" onPress={() => logout()} hitSlop={8} style={{ padding: p.space.lg, alignItems: 'center' }}>
          <Text variant="small" style={{ color: tokens.brandLink }}>{t('merchant.menu.logout')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
