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
import { SkeletonCards } from '../../../ui/motion';
import { CUISINE_ICON } from '../cuisineIcon';
import { TAB_BAR_CLEARANCE } from '../../../app/navigators/WingdaiTabBar';
import { useAuthStore } from '../../auth/authStore';
import { deliveryFeeLabel } from '../deliveryFeeLabel';
import { openStateLabel } from '../openStateLabel';
import { formatBaht, ratingLabel, joinMeta } from '../../../lib/format';
import { useRestaurants, useNotifications, useDefaultAddress } from '../hooks';
import { countUnread } from '../notifications';
import type { CustomerStackParamList, CustomerTabParamList } from '../../../app/navigators/CustomerStack';
import type { CuisineCategory, Restaurant } from '../../../data/types';
import { AnnouncementCarousel } from '../components/AnnouncementCarousel';

// Home อยู่ในแท็บ แต่ navigate ไป RestaurantDetail ซึ่งอยู่ใน stack แม่ → composite
type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'CustomerHome'>,
  NativeStackScreenProps<CustomerStackParamList>
>;
const CATEGORIES: (CuisineCategory | 'all')[] = ['all', 'rice', 'noodle', 'somtam', 'drink', 'dessert'];

export function CustomerHomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { data: restaurants = [], isLoading } = useRestaurants();
  const account = useAuthStore((s) => s.account);
  const [cat, setCat] = useState<CuisineCategory | 'all'>('all');
  const unread = countUnread(useNotifications());
  const defaultAddress = useDefaultAddress();

  const shown = cat === 'all' ? restaurants : restaurants.filter((r) => r.cuisine === cat);

  return (
    <SafeAreaView testID="screen-customer-home" edges={['top']} style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE, gap: p.space.lg }}
        showsVerticalScrollIndicator={false}
      >
        {/* C1 หัวจอ: ที่อยู่จัดส่ง + กระดิ่ง + อักษรย่อผู้ใช้ */}
        <View
          style={{
            paddingHorizontal: p.space.screen,
            paddingTop: p.space.sm,
            flexDirection: 'row',
            alignItems: 'center',
            gap: p.space.md,
          }}
        >
          {/* ที่อยู่จริงของผู้ใช้ ไม่ใช่ข้อความตายตัว ก่อนหน้านี้ตรงนี้โชว์ "อารีย์ ซอยอารีย์ 1" */}
          <Pressable
            testID="btn-header-address"
            accessibilityRole="button"
            accessibilityLabel={t('customer.home.deliverTo')}
            onPress={() => navigation.navigate(defaultAddress ? 'Addresses' : 'AddAddress')}
            style={({ pressed }) => ({ flex: 1, minWidth: 0, opacity: pressed ? 0.7 : 1 })}
          >
            <Text variant="kicker" color="link">{t('customer.home.deliverTo')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <Text
                testID="header-address"
                variant="bodyLg"
                bold
                numberOfLines={1}
                color={defaultAddress ? 'primary' : 'muted'}
                style={{ flexShrink: 1 }}
              >
                {defaultAddress?.addressText ?? t('customer.home.noAddress')}
              </Text>
              <Icon name="chevronDown" color={tokens.textFaint} size={16} strokeWidth={2.4} />
            </View>
          </Pressable>

          <Pressable
            testID="btn-notifications"
            accessibilityRole="button"
            accessibilityLabel={t('customer.home.notifications')}
            onPress={() => navigation.navigate('Notifications')}
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
            {/* จุดส้มขึ้นจริงตามจำนวนที่ยังไม่อ่าน ไม่ได้วาดไว้ตายตัว */}
            {unread > 0 ? (
              <View
                testID="notifications-dot"
                style={{
                  position: 'absolute',
                  top: 9,
                  right: 10,
                  width: 9,
                  height: 9,
                  borderRadius: 4.5,
                  backgroundColor: tokens.brandAccent,
                  borderWidth: 2,
                  borderColor: tokens.bgRaised,
                }}
              />
            ) : null}
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

        {/* แถบค้นหา เป็นปุ่มพาไปจอค้นหา ไม่ใช่ช่องกรอกในตัว (ตาม C1 → C2) */}
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

        <AnnouncementCarousel restaurantCount={restaurants.length} />

        {/* ชิปหมวดหมู่ (กรอง client-side) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{
            alignItems: 'center', gap: p.space.sm, paddingHorizontal: p.space.screen }}
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

        {/* ระหว่างโหลดเคยขึ้นข้อความ "ไม่มีร้าน" ซึ่งอ่านเหมือนแอปว่างเปล่า ไม่ใช่กำลังรอ */}
        {isLoading ? (
          <View style={{ paddingHorizontal: p.space.screen }}>
            <SkeletonCards testID="home-skeleton" count={3} />
          </View>
        ) : shown.length === 0 ? (
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
          // สองคอลัมน์เสมอ ห้ามใส่ flexGrow ไม่งั้นการ์ดใบสุดท้ายที่เป็นเลขคี่จะยืดเต็มแถว
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
        <PhotoBlock icon={CUISINE_ICON[r.cuisine]} uri={r.photoUrl} height={104} radius={0} />
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
        {/* C1 โชว์ "หมวด ★ คะแนน" ร้านที่ปิดอยู่บอกสถานะแทนคะแนน เพราะกดสั่งไม่ได้ */}
        <Text variant="caption" color="muted" numberOfLines={1}>
          {joinMeta(
            t(`customer.cuisine.${r.cuisine}`),
            r.isOpen ? ratingLabel(r.rating) : openStateLabel(r, t),
          )}
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
            {r.prepTimeMinutes} {t('customer.home.minutes')} · {deliveryFeeLabel(r.distanceKm, t)}
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
