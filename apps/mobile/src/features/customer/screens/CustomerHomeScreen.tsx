import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Icon } from '../../../ui/Icon';
import { Card, Chip, PhotoBlock } from '../../../ui/Surface';
import { CUISINE_ICON } from '../cuisineIcon';
import { TAB_BAR_CLEARANCE } from '../../../app/navigators/WingdaiTabBar';
import { useAuthStore } from '../../auth/authStore';
import { DELIVERY_FEE } from '../../cart/pricing';
import { formatBaht } from '../../../lib/format';
import { useRestaurants } from '../hooks';
import type { CustomerStackParamList, CustomerTabParamList } from '../../../app/navigators/CustomerStack';
import type { CuisineCategory, Restaurant } from '../../../data/types';

// Home อยู่ในแท็บ แต่ navigate ไป RestaurantDetail ซึ่งอยู่ใน stack แม่ → composite
type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'CustomerHome'>,
  NativeStackScreenProps<CustomerStackParamList>
>;
const CATEGORIES: (CuisineCategory | 'all')[] = ['all', 'rice', 'noodle', 'somtam', 'drink', 'dessert'];

export function CustomerHomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { data: restaurants = [] } = useRestaurants();
  const account = useAuthStore((s) => s.account);
  const [cat, setCat] = useState<CuisineCategory | 'all'>('all');

  const shown = cat === 'all' ? restaurants : restaurants.filter((r) => r.cuisine === cat);

  return (
    <SafeAreaView testID="screen-customer-home" edges={['top']} style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE, gap: p.space.lg }}
        showsVerticalScrollIndicator={false}
      >
        {/* C1 หัวจอ: ที่อยู่จัดส่ง + กระดิ่ง + อักษรย่อผู้ใช้
            ยังไม่มีลูกศรเลือกที่อยู่เพราะจอจัดการที่อยู่ (C9/C29) ยังไม่ได้ทำ — ห้ามวางปุ่มที่กดแล้วไม่เกิดอะไร */}
        <View
          style={{
            paddingHorizontal: p.space.screen,
            paddingTop: p.space.sm,
            flexDirection: 'row',
            alignItems: 'center',
            gap: p.space.md,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="kicker" color="link">{t('customer.home.deliverTo')}</Text>
            <Text variant="bodyLg" bold numberOfLines={1} style={{ marginTop: 2 }}>
              {t('customer.home.defaultAddress')}
            </Text>
          </View>

          <Pressable
            testID="btn-notifications"
            accessibilityRole="button"
            accessibilityLabel={t('customer.home.notifications')}
            onPress={() => navigation.navigate('Inbox')}
            hitSlop={6}
            style={({ pressed }) => [
              {
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: tokens.bgRaised,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.8 : 1,
              },
              p.shadow.card,
            ]}
          >
            <Icon name="inbox" color={tokens.textPrimary} size={21} strokeWidth={2} />
          </Pressable>

          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: tokens.tealSolid,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="body" color="onTeal" bold>
              {(account?.fullName ?? account?.username ?? '?').trim().charAt(0).toUpperCase()}
            </Text>
          </View>
        </View>

        {/* แถบค้นหา — เป็นปุ่มพาไปจอค้นหา ไม่ใช่ช่องกรอกในตัว (ตาม C1 → C2) */}
        <Pressable
          testID="btn-search"
          accessibilityRole="search"
          accessibilityLabel={t('customer.home.searchPlaceholder')}
          onPress={() => navigation.navigate('Search')}
          style={({ pressed }) => [
            {
              marginHorizontal: p.space.screen,
              flexDirection: 'row',
              alignItems: 'center',
              gap: p.space.sm,
              backgroundColor: tokens.bgRaised,
              borderRadius: p.radius.md,
              paddingHorizontal: p.space.lg,
              paddingVertical: 13,
              opacity: pressed ? 0.9 : 1,
            },
            p.shadow.card,
          ]}
        >
          <Icon name="search" color={tokens.textFaint} size={19} strokeWidth={2.2} />
          <Text variant="small" color="faint">
            {t('customer.home.searchPlaceholder')}
          </Text>
        </Pressable>

        {/* แบนเนอร์ประกาศ (ข้อมูลล้วน — ห้ามส่วนลด/ราคาตัด ตาม claude.md §2/§3) */}
        <Card tone="teal" style={{ marginHorizontal: p.space.screen, overflow: 'hidden' }}>
          <Text variant="kicker" style={{ color: p.brand[300] }}>
            {t('customer.home.announcementKicker')}
          </Text>
          <Text variant="bodyLg" color="onTeal" bold style={{ marginTop: 6, maxWidth: '80%' }}>
            {t('customer.home.announcement')}
          </Text>
          <Text variant="caption" color="onTealMuted" style={{ marginTop: 5, maxWidth: '80%' }}>
            {t('customer.home.announcementSub', { count: restaurants.length })}
          </Text>
          <View
            style={{
              position: 'absolute',
              right: -24,
              bottom: -24,
              width: 110,
              height: 110,
              borderRadius: 55,
              backgroundColor: 'rgba(241,90,34,0.35)',
            }}
          />
        </Card>

        {/* ชิปหมวดหมู่ (กรอง client-side) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: p.space.sm, paddingHorizontal: p.space.screen }}
        >
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              testID={`chip-${c}`}
              label={c === 'all' ? t('customer.home.categoryAll') : t(`customer.cuisine.${c}`)}
              active={c === cat}
              onPress={() => setCat(c)}
            />
          ))}
        </ScrollView>

        <View
          style={{
            paddingHorizontal: p.space.screen,
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
          }}
        >
          <Text variant="h2">{t('customer.home.nearby')}</Text>
          <Pressable
            testID="link-see-all"
            accessibilityRole="link"
            onPress={() => navigation.navigate('Categories')}
            hitSlop={10}
          >
            <Text variant="caption" color="link" bold>
              {t('customer.home.seeAll')}
            </Text>
          </Pressable>
        </View>

        {shown.length === 0 ? (
          <Text variant="body" color="muted" style={{ paddingHorizontal: p.space.screen }}>
            {t('customer.home.empty')}
          </Text>
        ) : (
          <View
            style={{
              paddingHorizontal: p.space.screen,
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: p.space.md,
            }}
          >
            {shown.map((r) => (
              <RestaurantCard
                key={r.id}
                r={r}
                onPress={() => navigation.navigate('RestaurantDetail', { restaurantId: r.id })}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** การ์ดร้านสองคอลัมน์ตาม design: รูป + แบดจ์ระยะทาง + ชื่อ + เวลา/ค่าส่ง */
function RestaurantCard({ r, onPress }: { r: Restaurant; onPress: () => void }) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  return (
    <Pressable
      testID={`restaurant-card-${r.id}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        {
          // สองคอลัมน์เสมอ — ห้ามใส่ flexGrow ไม่งั้นการ์ดใบสุดท้ายที่เป็นเลขคี่จะยืดเต็มแถว
          width: '48%',
          backgroundColor: tokens.bgRaised,
          borderRadius: p.radius.xl,
          overflow: 'hidden',
          opacity: pressed ? 0.9 : r.isOpen ? 1 : 0.6,
        },
        p.shadow.raised,
      ]}
    >
      <View>
        <PhotoBlock icon={CUISINE_ICON[r.cuisine]} height={104} radius={0} />
        <View
          style={{
            position: 'absolute',
            top: 9,
            left: 9,
            backgroundColor: tokens.tealSolid,
            paddingHorizontal: p.space.sm,
            paddingVertical: 4,
            borderRadius: p.radius.full,
          }}
        >
          <Text variant="kicker" color="onTeal">
            {r.distanceKm} {t('customer.home.km')}
          </Text>
        </View>
      </View>

      <View style={{ padding: p.space.md, gap: 2 }}>
        <Text variant="body" bold numberOfLines={1}>{r.name}</Text>
        {/* C1 โชว์ "หมวด · ★ คะแนน" — ร้านที่ปิดอยู่บอกสถานะแทนคะแนน เพราะกดสั่งไม่ได้ */}
        <Text variant="caption" color="muted" numberOfLines={1}>
          {t(`customer.cuisine.${r.cuisine}`)} ·{' '}
          {r.isOpen ? `★ ${r.rating.toFixed(1)}` : t('customer.home.closed')}
        </Text>
        <View
          style={{
            marginTop: p.space.sm,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text variant="caption" color="onTealTint" bold numberOfLines={1} style={{ flex: 1 }}>
            {r.prepTimeMinutes} {t('customer.home.minutes')} · {formatBaht(DELIVERY_FEE)}
          </Text>
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 11,
              backgroundColor: tokens.brandAccent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* เครื่องหมายบวกเป็นกราฟิก ไม่ใช่ตัวหนังสือ จึงวางบน brandAccent ได้ */}
            <Icon name="plus" color={tokens.textOnBrand} size={17} strokeWidth={2.8} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}
