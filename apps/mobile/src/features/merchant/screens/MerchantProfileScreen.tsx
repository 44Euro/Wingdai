import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Surface';
import { RoleSwitcher } from '../../../app/RoleSwitcher';
import { useAuthStore } from '../../auth/authStore';
import { useMyRestaurants } from '../hooks';
import { MERCHANT_TAB_CLEARANCE } from '../../../app/navigators/MerchantTabBar';
import type { MerchantStackParamList, MerchantTabParamList } from '../../../app/navigators/MerchantStack';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MerchantTabParamList, 'MerchantProfile'>,
  NativeStackScreenProps<MerchantStackParamList>
>;

/** แท็บร้านของฉัน ที่เดียวที่สลับโหมดและออกจากระบบได้ */
export function MerchantProfileScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const account = useAuthStore((s) => s.account);
  const logout = useAuthStore((s) => s.logout);
  const { data: shops = [] } = useMyRestaurants();
  const shop = shops[0];

  return (
    <SafeAreaView
      testID="screen-merchant-profile"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScrollView
        contentContainerStyle={{
          padding: p.space.screen,
          paddingBottom: MERCHANT_TAB_CLEARANCE,
          gap: p.space.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="h1">{t('merchant.profile.title')}</Text>

        <Card>
          <View style={{ gap: 3 }}>
            <Text testID="merchant-profile-shop" variant="h3" numberOfLines={1}>
              {shop?.name ?? t('merchant.profile.noShop')}
            </Text>
            <Text variant="caption" color="muted">{t('merchant.profile.owner')}</Text>
            <Text variant="small" color="muted" numberOfLines={1}>
              {account?.fullName ?? ''} · {account?.phone ?? ''}
            </Text>
          </View>
        </Card>

        {/* การตั้งค่าของร้านอยู่รวมกันที่นี่ ไม่ใช่ปนอยู่กับจอยอดขาย */}
        {shop ? (
          <>
            <Button
              testID="btn-go-hours"
              variant="secondary"
              label={t('merchant.hours.title')}
              onPress={() => navigation.navigate('MerchantHours', { restaurantId: shop.id })}
            />
            <Button
              testID="btn-go-qr"
              variant="secondary"
              label={t('merchant.qr.title')}
              onPress={() => navigation.navigate('MerchantQr', { restaurantId: shop.id })}
            />
            <Button
              testID="btn-go-reviews"
              variant="secondary"
              label={t('reviews.title')}
              onPress={() => navigation.navigate('MerchantReviews', { restaurantId: shop.id })}
            />
          </>
        ) : null}

        <RoleSwitcher />

        <Button
          testID="btn-logout"
          variant="secondary"
          label={t('customer.profile.logout')}
          onPress={() => logout()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
