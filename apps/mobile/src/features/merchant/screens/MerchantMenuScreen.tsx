import React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Icon } from '../../../ui/Icon';
import { Card, PhotoBlock, RoundButton, Toggle } from '../../../ui/Surface';
import { RoleSwitcher } from '../../../app/RoleSwitcher';
import { useMenu } from '../../customer/hooks';
import { useOwnerRestaurantId, useToggleMenuItem } from '../hooks';
import { formatBaht } from '../../../lib/format';
import { useAuthStore } from '../../auth/authStore';
import type { MerchantStackParamList } from '../../../app/navigators/MerchantStack';

type Props = NativeStackScreenProps<MerchantStackParamList, 'MerchantMenu'>;

export function MerchantMenuScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const restaurantId = useOwnerRestaurantId();
  const { data: menu = [] } = useMenu(restaurantId ?? '');
  const toggle = useToggleMenuItem(restaurantId ?? '');
  const logout = useAuthStore((s) => s.logout);

  return (
    <SafeAreaView testID="screen-merchant-menu" edges={['top']} style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: p.space.xxl, gap: p.space.lg }}
        showsVerticalScrollIndicator={false}
      >
        {/* หัวจอ: ชื่อ + ปุ่มบวกสี่เหลี่ยมมนสีแบรนด์ ตาม design (menu manager) */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: p.space.screen,
            paddingTop: p.space.md,
          }}
        >
          {/* จอนี้ถูก push มาจากคิวออร์เดอร์แล้ว จึงต้องมีทางกลับ ไม่ใช่ทางตันของ stack */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.md, flex: 1 }}>
            <RoundButton
              testID="btn-back"
              icon="chevronLeft"
              tone="surface"
              accessibilityLabel={t('common.back')}
              onPress={() => navigation.goBack()}
            />
            <Text variant="h1">{t('merchant.menu.title')}</Text>
          </View>
          <RoundButton
            testID="btn-add-menu"
            icon="plus"
            tone="brand"
            accessibilityLabel={t('merchant.menu.add')}
            onPress={() => restaurantId && navigation.navigate('AddMenuItem', { restaurantId })}
          />
        </View>

        <View style={{ paddingHorizontal: p.space.screen }}>
          <RoleSwitcher />
        </View>

        <View style={{ paddingHorizontal: p.space.screen, gap: p.space.md }}>
          <Text variant="kicker" color="muted">
            {menu.length} {t('merchant.menu.items')}
          </Text>

          {menu.length === 0 ? (
            <Text variant="body" color="muted">{t('merchant.menu.empty')}</Text>
          ) : (
            menu.map((m) => (
              <Card
                key={m.id}
                testID={`menu-row-${m.id}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.md }}
              >
                <PhotoBlock size={52} radius={p.radius.sm} />
                {/* M13 แตะทั้งแถวเพื่อแก้จาน ส่วนสวิตช์ขวามือยังเป็นทางลัด "ของหมด" */}
                <Pressable
                  testID={`btn-edit-${m.id}`}
                  accessibilityRole="button"
                  onPress={() =>
                    restaurantId
                    && navigation.navigate('EditMenuItem', { restaurantId, menuItemId: m.id })
                  }
                  style={{ flex: 1, minWidth: 0 }}
                >
                  <Text variant="small" bold numberOfLines={1}>{m.name}</Text>
                  <Text variant="caption" color="onTealTint" bold style={{ marginTop: 3 }}>
                    {formatBaht(m.price)}
                  </Text>
                  {m.optionGroups?.length ? (
                    <Text variant="caption" color="muted" numberOfLines={1}>
                      {m.optionGroups.length} {t('merchant.menu.optionGroups')}
                    </Text>
                  ) : null}
                </Pressable>
                {/* ปิดของหมดต้องทำได้ทันทีระหว่างวัน ไม่งั้นลูกค้าสั่งของที่ไม่มี */}
                <Toggle
                  testID={`menu-available-${m.id}`}
                  value={m.isAvailable}
                  accessibilityLabel={t('merchant.menu.available')}
                  onValueChange={(isAvailable) =>
                    restaurantId && toggle.mutate({ menuItemId: m.id, isAvailable })
                  }
                />
              </Card>
            ))
          )}
        </View>

        <Pressable
          testID="btn-logout"
          accessibilityRole="button"
          onPress={() => logout()}
          hitSlop={8}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: p.space.sm,
            paddingVertical: p.space.lg,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Icon name="logout" color={tokens.danger} size={18} strokeWidth={2.2} />
          <Text variant="small" color="danger" bold>{t('merchant.menu.logout')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
