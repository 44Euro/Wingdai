import React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Icon } from '../../../ui/Icon';
import { Card, IconChip } from '../../../ui/Surface';
import { TAB_BAR_CLEARANCE } from '../../../app/navigators/WingdaiTabBar';
import { RoleSwitcher } from '../../../app/RoleSwitcher';
import { useAuthStore } from '../../auth/authStore';
import { usePaymentStore, PAYMENT_ICON } from '../../payment/paymentStore';
import type { CustomerStackParamList, CustomerTabParamList } from '../../../app/navigators/CustomerStack';

// Profile อยู่ในแท็บ แต่ navigate ไป PaymentMethod ซึ่งอยู่ใน stack แม่ → composite
type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'Profile'>,
  NativeStackScreenProps<CustomerStackParamList>
>;

export function ProfileScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const account = useAuthStore((s) => s.account);
  const logout = useAuthStore((s) => s.logout);
  const method = usePaymentStore((s) => s.method);

  const initial = (account?.fullName ?? account?.username ?? '?').trim().charAt(0).toUpperCase();

  return (
    <SafeAreaView testID="screen-profile" edges={['top']} style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE, gap: p.space.lg }}
        showsVerticalScrollIndicator={false}
      >
        {/* หัวโปรไฟล์: อวาตาร์สี่เหลี่ยมมน + ชื่อ + เบอร์ ตาม design */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: p.space.lg,
            paddingHorizontal: p.space.screen,
            paddingTop: p.space.lg,
          }}
        >
          <View
            style={{
              width: 66,
              height: 66,
              borderRadius: p.radius.xl,
              backgroundColor: tokens.tealSolid,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="h2" color="onTeal">{initial}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="h2" numberOfLines={1}>{account?.fullName ?? ''}</Text>
            <Text variant="caption" color="muted" numberOfLines={1}>@{account?.username ?? ''}</Text>
            <Text variant="caption" color="muted" numberOfLines={1}>
              {t('customer.profile.phone')} · {account?.phone ?? ''}
            </Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: p.space.screen, gap: p.space.lg }}>
          <RoleSwitcher />

          {/* รายการตั้งค่าในการ์ดขาวใบเดียว มีเส้นคั่นบาง ๆ ตาม design */}
          <Card padded={false} style={{ overflow: 'hidden' }}>
            <Pressable
              testID="btn-payment-method"
              accessibilityRole="button"
              onPress={() => navigation.navigate('PaymentMethod')}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: p.space.lg,
                paddingHorizontal: p.space.card,
                paddingVertical: 15,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <IconChip name={PAYMENT_ICON[method]} tone="brand" size={36} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="small" bold>
                  {t('customer.payment.title')}
                </Text>
                <Text variant="caption" color="muted" numberOfLines={1}>
                  {t(`customer.payment.method.${method}.title`)}
                </Text>
              </View>
              <Icon name="chevronRight" color={tokens.textFaint} size={18} strokeWidth={2.4} />
            </Pressable>

            <View style={{ height: 1, backgroundColor: tokens.borderSubtle, marginLeft: 66 }} />

            <Pressable
              testID="btn-logout"
              accessibilityRole="button"
              onPress={() => logout()}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: p.space.lg,
                paddingHorizontal: p.space.card,
                paddingVertical: 15,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <IconChip name="logout" tone="neutral" size={36} />
              <Text variant="small" color="danger" bold style={{ flex: 1 }}>
                {t('customer.profile.logout')}
              </Text>
              <Icon name="chevronRight" color={tokens.textFaint} size={18} strokeWidth={2.4} />
            </Pressable>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
