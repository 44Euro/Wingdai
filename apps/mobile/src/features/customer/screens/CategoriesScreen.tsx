import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Card, IconChip } from '../../../ui/Surface';
import { Icon, IconName } from '../../../ui/Icon';
import { useRestaurants } from '../hooks';
import { formatBaht } from '../../../lib/format';
import { DELIVERY_FEE } from '../../cart/pricing';
import { TAB_BAR_CLEARANCE } from '../../../app/navigators/WingdaiTabBar';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';
import type { CuisineCategory } from '../../../data/types';

const CATEGORIES: CuisineCategory[] = ['rice', 'noodle', 'somtam', 'drink', 'dessert'];

const CATEGORY_ICON: Record<CuisineCategory, IconName> = {
  rice: 'rice',
  noodle: 'noodle',
  somtam: 'somtam',
  drink: 'drink',
  dessert: 'dessert',
};

// จอนี้อยู่ในแท็บ แต่ navigate ข้ามไป RestaurantDetail ที่อยู่บน stack แม่
// จึงประกาศ props ด้วย ParamList ของ stack แม่ ไม่ใช่ของแท็บ
type Props = NativeStackScreenProps<CustomerStackParamList>;

/** C15 — กริดหมวดอาหาร กดแล้วสลับเป็นรายชื่อร้านในหมวดนั้นในจอเดียวกัน */
export function CategoriesScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { data: restaurants } = useRestaurants();
  const [selected, setSelected] = useState<CuisineCategory | null>(null);

  const all = restaurants ?? [];
  const countOf = (c: CuisineCategory) => all.filter((r) => r.cuisine === c).length;
  const inSelected = selected ? all.filter((r) => r.cuisine === selected) : [];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
      contentContainerStyle={{
        padding: p.space.screen,
        paddingBottom: TAB_BAR_CLEARANCE,
        gap: p.space.lg,
      }}
    >
      <View style={{ gap: p.space.xs }}>
        <Text variant="h1">{t('customer.categories.title')}</Text>
        <Text variant="small" color="muted">
          {selected ? t(`customer.cuisine.${selected}`) : t('customer.categories.subtitle')}
        </Text>
      </View>

      {selected === null ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: p.space.md }}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c}
              testID={`category-${c}`}
              accessibilityRole="button"
              accessibilityLabel={t(`customer.cuisine.${c}`)}
              onPress={() => setSelected(c)}
              style={({ pressed }) => ({
                width: '47%',
                minHeight: 44,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              })}
            >
              <Card style={{ gap: p.space.sm }}>
                <IconChip name={CATEGORY_ICON[c]} tone="brand" />
                <Text variant="body" bold>
                  {t(`customer.cuisine.${c}`)}
                </Text>
                <Text variant="caption" color="faint">
                  {t('customer.categories.count', { count: countOf(c) })}
                </Text>
              </Card>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={{ gap: p.space.md }}>
          <Pressable
            testID="category-clear"
            accessibilityRole="button"
            accessibilityLabel={t('customer.categories.clear')}
            onPress={() => setSelected(null)}
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.xs }}>
              <Icon name="chevronLeft" color={tokens.brandLink} size={18} />
              <Text variant="small" color="link" bold>
                {t('customer.categories.clear')}
              </Text>
            </View>
          </Pressable>

          {inSelected.length === 0 ? (
            <Text variant="small" color="muted">
              {t('customer.categories.empty')}
            </Text>
          ) : (
            inSelected.map((r) => (
              <Pressable
                key={r.id}
                testID={`category-restaurant-${r.id}`}
                accessibilityRole="button"
                accessibilityLabel={r.name}
                onPress={() => navigation.navigate('RestaurantDetail', { restaurantId: r.id })}
                style={({ pressed }) => ({ minHeight: 44, transform: [{ scale: pressed ? 0.98 : 1 }] })}
              >
                <Card style={{ gap: p.space.xs }}>
                  <Text variant="body" bold>
                    {r.name}
                  </Text>
                  <Text variant="caption" color="muted">
                    {t(`customer.cuisine.${r.cuisine}`)} · ★ {r.rating.toFixed(1)}
                  </Text>
                  <Text variant="caption" color="faint">
                    {r.prepTimeMinutes} min · {formatBaht(DELIVERY_FEE)}
                  </Text>
                </Card>
              </Pressable>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}
