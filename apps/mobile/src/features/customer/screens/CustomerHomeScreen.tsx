import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { useRestaurants } from '../hooks';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';
import type { CuisineCategory, Restaurant } from '../../../data/types';

type Props = NativeStackScreenProps<CustomerStackParamList, 'CustomerHome'>;
const CATEGORIES: (CuisineCategory | 'all')[] = ['all', 'rice', 'noodle', 'somtam', 'drink', 'dessert'];

export function CustomerHomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { data: restaurants = [] } = useRestaurants();
  const [cat, setCat] = useState<CuisineCategory | 'all'>('all');

  const shown = cat === 'all' ? restaurants : restaurants.filter((r) => r.cuisine === cat);

  return (
    <SafeAreaView testID="screen-customer-home" edges={['top']} style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
      <ScrollView contentContainerStyle={{ padding: p.space.xl, gap: p.space.lg }} showsVerticalScrollIndicator={false}>
        <Text variant="h1">{t('customer.home.title')}</Text>

        {/* แบนเนอร์ประกาศ (ข้อมูลล้วน — ห้ามส่วนลด/ราคาตัด ตาม claude.md §2/§3) */}
        <View style={{ backgroundColor: tokens.bgRaised, borderRadius: p.radius.md, borderWidth: 1, borderColor: tokens.borderSubtle, padding: p.space.lg }}>
          <Text variant="small" color="muted">{t('customer.home.announcement')}</Text>
        </View>

        {/* ชิปหมวดหมู่ (กรอง client-side) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: p.space.sm }}>
          {CATEGORIES.map((c) => {
            const active = c === cat;
            return (
              <Pressable
                key={c}
                testID={`chip-${c}`}
                onPress={() => setCat(c)}
                hitSlop={6}
                style={{
                  paddingHorizontal: p.space.lg,
                  paddingVertical: p.space.sm,
                  borderRadius: p.radius.full,
                  backgroundColor: active ? tokens.brandSolid : tokens.bgRaised,
                  borderWidth: 1,
                  borderColor: active ? tokens.brandSolid : tokens.borderSubtle,
                }}
              >
                <Text variant="small" color={active ? 'onBrand' : 'primary'}>
                  {c === 'all' ? t('customer.home.categoryAll') : t(`customer.cuisine.${c}`)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {shown.length === 0 ? (
          <Text variant="body" color="muted">{t('customer.home.empty')}</Text>
        ) : (
          shown.map((r) => (
            <RestaurantCard key={r.id} r={r} onPress={() => navigation.navigate('RestaurantDetail', { restaurantId: r.id })} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function RestaurantCard({ r, onPress }: { r: Restaurant; onPress: () => void }) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  return (
    <Pressable
      testID={`restaurant-card-${r.id}`}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: tokens.bgRaised,
        borderRadius: p.radius.lg,
        borderWidth: 1,
        borderColor: tokens.borderSubtle,
        padding: p.space.lg,
        opacity: pressed ? 0.9 : r.isOpen ? 1 : 0.6,
        gap: p.space.xs,
      })}
    >
      <View style={{ height: 96, borderRadius: p.radius.md, backgroundColor: tokens.brandAccent, opacity: 0.18 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="h3">{r.name}</Text>
        <Text variant="caption" color={r.isOpen ? 'brand' : 'muted'}>
          {r.isOpen ? t('customer.home.open') : t('customer.home.closed')}
        </Text>
      </View>
      <Text variant="small" color="muted">
        {t(`customer.cuisine.${r.cuisine}`)} · {r.distanceKm} {t('customer.home.km')} · {r.prepTimeMinutes} {t('customer.home.minutes')}
      </Text>
    </Pressable>
  );
}
