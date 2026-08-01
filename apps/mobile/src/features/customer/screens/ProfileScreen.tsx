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
import { useCustomerOrders, useAddresses } from '../hooks';
import { usePaymentStore, PAYMENT_ICON } from '../../payment/paymentStore';
import type { CustomerStackParamList, CustomerTabParamList } from '../../../app/navigators/CustomerStack';

// Profile อยู่ในแท็บ แต่ navigate ไป PaymentMethod ซึ่งอยู่ใน stack แม่ → composite
type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'Profile'>,
  NativeStackScreenProps<CustomerStackParamList>
>;

export function ProfileScreen({ navigation }: Props) {
  const { data: addresses = [] } = useAddresses();
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const account = useAuthStore((s) => s.account);
  const logout = useAuthStore((s) => s.logout);
  const method = usePaymentStore((s) => s.method);
  const { data: orders = [] } = useCustomerOrders();

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

        {/* C8 มีการ์ดตัวเลขสามใบ — เอามาสองใบที่นับจากข้อมูลจริง
            ใบ "Wingdai credit" ไม่เอา เพราะ claude.md §2 แบนกระเป๋าเงิน/แต้ม */}
        <View style={{ flexDirection: 'row', gap: p.space.sm, paddingHorizontal: p.space.screen }}>
          <StatCard testID="stat-orders" value={String(orders.length)} label={t('customer.profile.statOrders')} tone="teal" />
          <StatCard
            testID="stat-delivered"
            value={String(orders.filter((o) => o.status === 'delivered').length)}
            label={t('customer.profile.statDelivered')}
          />
        </View>

        <View style={{ paddingHorizontal: p.space.screen, gap: p.space.lg }}>
          <RoleSwitcher />

          {/* รายการตั้งค่าในการ์ดขาวใบเดียว มีเส้นคั่นบาง ๆ ตาม design */}
          <Card padded={false} style={{ overflow: 'hidden' }}>
            <Pressable
              testID="btn-edit-profile"
              accessibilityRole="button"
              onPress={() => navigation.navigate('EditProfile')}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: p.space.lg,
                paddingHorizontal: p.space.card,
                paddingVertical: 15,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <IconChip name="edit" tone="brand" size={36} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="small" bold>{t('customer.editProfile.title')}</Text>
                <Text variant="caption" color="muted" numberOfLines={1}>
                  {t('customer.editProfile.subtitle')}
                </Text>
              </View>
              <Icon name="chevronRight" color={tokens.textFaint} size={18} strokeWidth={2.4} />
            </Pressable>

            <View style={{ height: 1, backgroundColor: tokens.borderSubtle, marginLeft: 66 }} />

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
              testID="btn-addresses"
              accessibilityRole="button"
              onPress={() => navigation.navigate('Addresses')}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: p.space.lg,
                paddingHorizontal: p.space.card,
                paddingVertical: 15,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <IconChip name="mapPin" tone="teal" size={36} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="small" bold>
                  {t('customer.addresses.title')}
                </Text>
                <Text variant="caption" color="muted" numberOfLines={1}>
                  {addresses.length > 0
                    ? addresses[0]!.addressText
                    : t('customer.addresses.emptyTitle')}
                </Text>
              </View>
              <Icon name="chevronRight" color={tokens.textFaint} size={18} strokeWidth={2.4} />
            </Pressable>

            <View style={{ height: 1, backgroundColor: tokens.borderSubtle, marginLeft: 66 }} />

            {/*
              §4.3 — ร้านเป็น "ความสามารถ" ที่งอกบนบัญชี user ทางเข้าจึงอยู่ในโปรไฟล์
              ไม่ใช่หน้าสมัครแยก และซ่อนไปเมื่อบัญชีนี้มีร้านแล้ว (สลับโหมดที่ role switcher แทน)
            */}
            {account?.accountType === 'user' && (account?.ownedRestaurantIds.length ?? 0) === 0 ? (
              <>
                <Pressable
                  testID="btn-open-restaurant"
                  accessibilityRole="button"
                  onPress={() => navigation.navigate('OpenRestaurant')}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: p.space.lg,
                    paddingHorizontal: p.space.card,
                    paddingVertical: 15,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <IconChip name="store" tone="brand" size={36} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="small" bold>{t('merchant.open.entry')}</Text>
                    <Text variant="caption" color="muted" numberOfLines={1}>
                      {t('merchant.open.title')}
                    </Text>
                  </View>
                  <Icon name="chevronRight" color={tokens.textFaint} size={18} strokeWidth={2.4} />
                </Pressable>

                <View style={{ height: 1, backgroundColor: tokens.borderSubtle, marginLeft: 66 }} />
              </>
            ) : null}

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

/** การ์ดตัวเลขบนโปรไฟล์ตาม C8 — ใบแรกเป็น teal ที่เหลือเป็นการ์ดขาว */
function StatCard({
  testID,
  value,
  label,
  tone = 'raised',
}: {
  testID: string;
  value: string;
  label: string;
  tone?: 'raised' | 'teal';
}) {
  const { primitives: p } = useTheme();
  const onTeal = tone === 'teal';
  return (
    <Card testID={testID} tone={tone} padded={false} style={{ flex: 1, padding: 14, borderRadius: 18 }}>
      <Text variant="h2" color={onTeal ? 'onTeal' : 'primary'}>
        {value}
      </Text>
      <Text variant="kicker" color={onTeal ? 'onTealMuted' : 'muted'} style={{ marginTop: 2 }}>
        {label}
      </Text>
    </Card>
  );
}
