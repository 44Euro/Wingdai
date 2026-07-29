import React, { useState } from 'react';
import { View, TextInput, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Icon } from '../../../ui/Icon';
import { PhotoBlock } from '../../../ui/Surface';
import { deliveryFeeLabel } from '../deliveryFeeLabel';
import { openStateLabel } from '../openStateLabel';
import { formatBaht, ratingLabel, distanceLabel, joinMeta } from '../../../lib/format';
import { useSearchRestaurants } from '../hooks';
import { useFilterStore } from '../filterStore';
import { applyFilters, isDefaultFilters } from '../filters';
import { CUISINE_ICON } from '../cuisineIcon';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';
import type { Restaurant } from '../../../data/types';

type Props = NativeStackScreenProps<CustomerStackParamList, 'Search'>;

/** C2 ช่องค้นหาโฟกัสอยู่แล้วตั้งแต่เปิดจอ + ลิงก์ยกเลิกข้าง ๆ + ผลลัพธ์เป็นแถวแนวนอน */
export function SearchScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const [query, setQuery] = useState('');
  const { data: found } = useSearchRestaurants(query);
  const filters = useFilterStore((s) => s.filters);

  const typing = query.trim().length > 0;
  /** C35 กรองในเครื่อง ไม่ยิงคำขอใหม่ทุกครั้งที่แตะตัวกรอง */
  const results = applyFilters(found ?? [], filters);

  return (
    <SafeAreaView testID="screen-search" edges={['top']} style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: p.space.md,
          paddingHorizontal: p.space.screen,
          paddingTop: p.space.sm,
          paddingBottom: p.space.md,
        }}
      >
        <View
          style={[
            {
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: p.space.sm,
              backgroundColor: tokens.bgRaised,
              borderWidth: 2,
              borderColor: tokens.brandAccent,
              borderRadius: p.radius.md,
              paddingHorizontal: p.space.lg,
            },
            p.shadow.card,
          ]}
        >
          <Icon name="search" color={tokens.brandAccent} size={18} strokeWidth={2.2} />
          <TextInput
            testID="input-search"
            accessibilityLabel={t('customer.search.placeholder')}
            placeholder={t('customer.search.placeholder')}
            placeholderTextColor={tokens.textFaint}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            allowFontScaling={false}
            value={query}
            onChangeText={setQuery}
            style={{
              flex: 1,
              paddingVertical: 12,
              minHeight: 48,
              color: tokens.textPrimary,
              fontFamily: p.fontFamily.bodyBold,
              fontSize: p.fontSize.small,
            }}
          />
        </View>
        {/* C35 ทางเข้าตัวกรอง มีจุดบอกเมื่อตั้งค่าไว้ ไม่งั้นคนลืมว่ากรองอยู่แล้วงงว่าร้านหายไปไหน */}
        <Pressable
          testID="btn-open-filters"
          accessibilityRole="button"
          accessibilityLabel={t('customer.filters.title')}
          onPress={() => navigation.navigate('Filters')}
          hitSlop={10}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <Text variant="small" color={isDefaultFilters(filters) ? 'muted' : 'brand'} bold>
            {isDefaultFilters(filters)
              ? t('customer.filters.title')
              : `${t('customer.filters.title')} •`}
          </Text>
        </Pressable>
        <Pressable
          testID="link-search-cancel"
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <Text variant="small" color="link" bold>
            {t('customer.search.cancel')}
          </Text>
        </Pressable>
      </View>

      {!typing ? (
        <Text
          testID="search-prompt"
          variant="body"
          color="muted"
          style={{ paddingHorizontal: p.space.screen, paddingTop: p.space.md }}
        >
          {t('customer.search.prompt')}
        </Text>
      ) : (
        <>
          <Text
            testID="search-results-count"
            variant="kicker"
            color="muted"
            style={{ paddingHorizontal: p.space.screen, paddingBottom: p.space.sm }}
          >
            {t('customer.search.results', { count: results?.length ?? 0 })}
          </Text>
          {results && results.length === 0 ? (
            <Text
              testID="search-empty"
              variant="body"
              color="muted"
              style={{ paddingHorizontal: p.space.screen, paddingTop: p.space.md }}
            >
              {t('customer.search.empty')}
            </Text>
          ) : (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: p.space.screen,
                paddingBottom: p.space.xl,
                gap: p.space.md,
              }}
            >
              {(results ?? []).map((r) => (
                <SearchResultRow
                  key={r.id}
                  r={r}
                  onPress={() => navigation.navigate('RestaurantDetail', { restaurantId: r.id })}
                />
              ))}
            </ScrollView>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

/** แถวผลค้นหาตาม C2: รูป 62px + ชื่อ + "หมวด ★ คะแนน ระยะ" + "นาที ค่าส่ง" */
function SearchResultRow({ r, onPress }: { r: Restaurant; onPress: () => void }) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  return (
    <Pressable
      testID={`search-result-${r.id}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 13,
          backgroundColor: tokens.bgRaised,
          borderRadius: p.radius.lg,
          padding: p.space.md,
          // ร้านปิดหรี่ลงเหมือนจอแรก ข้อมูลชุดเดียวกันต้องอ่านได้เหมือนกันทุกจอ
          opacity: pressed ? 0.9 : r.isOpen ? 1 : 0.6,
        },
        p.shadow.card,
      ]}
    >
      <PhotoBlock icon={CUISINE_ICON[r.cuisine]} size={62} radius={15} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="body" bold numberOfLines={1}>
          {r.name}
        </Text>
        {/* ร้านที่ปิดอยู่บอกสถานะแทนคะแนน เพราะกดสั่งไม่ได้ (กฎเดียวกับ C1) */}
        <Text variant="caption" color="muted" numberOfLines={1} style={{ marginTop: 2 }}>
          {joinMeta(
            t(`customer.cuisine.${r.cuisine}`),
            r.isOpen ? ratingLabel(r.rating) : openStateLabel(r, t),
            distanceLabel(r.distanceKm, t('customer.home.km')),
          )}
        </Text>
        <Text variant="kicker" color="onTealTint" numberOfLines={1} style={{ marginTop: 6 }}>
          {r.prepTimeMinutes} {t('customer.home.minutes')} · {deliveryFeeLabel(r.distanceKm, t)}{' '}
          {t('customer.search.deliveryFee')}
        </Text>
      </View>
    </Pressable>
  );
}
