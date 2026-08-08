import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Card, Chip, Toggle } from '../../../ui/Surface';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import { formatBaht } from '../../../lib/format';
import { useFilterStore } from '../filterStore';
import { DEFAULT_FILTERS, isDefaultFilters, type PriceTier, type SortKey } from '../filters';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';

type Props = NativeStackScreenProps<CustomerStackParamList, 'Filters'>;

const SORTS: SortKey[] = ['recommended', 'nearest', 'topRated', 'fastest'];
/** เพดานค่าส่งเป็นสตางค์ ตรงกับขั้นค่าส่งจริง (ฐาน ฿15 + ฿6/กม.) ไม่ใช่เลขกลม ๆ ที่ไม่มีร้านตรง */
const FEE_CAPS = [2100, 2700, 3300] as const;
const RATINGS = [4.0, 4.5] as const;
const TIERS: PriceTier[] = [1, 2, 3];

/** C35 ตัวกรองผลค้นหา */
export function FiltersScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const saved = useFilterStore((s) => s.filters);
  const apply = useFilterStore((s) => s.setFilters);

  // แก้ในเครื่องจนกว่าจะกด "ดูผลลัพธ์" กรองสดทุกครั้งที่แตะจะทำให้จอผลลัพธ์กระพริบข้างหลัง
  const [draft, setDraft] = useState(saved);

  return (
    <SafeAreaView
      testID="screen-filters"
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScreenHeader
        title={t('customer.filters.title')}
        onBack={() => navigation.goBack()}
        right={
          isDefaultFilters(draft) ? undefined : (
            <Pressable
              testID="btn-reset-filters"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => setDraft(DEFAULT_FILTERS)}
            >
              <Text variant="small" color="brand" bold>{t('customer.filters.reset')}</Text>
            </Pressable>
          )
        }
      />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: p.space.screen,
          paddingBottom: p.space.xl,
          gap: p.space.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Section title={t('customer.filters.sortBy')}>
          {SORTS.map((key) => (
            <Chip
              key={key}
              testID={`sort-${key}`}
              label={t(`customer.filters.sort.${key}`)}
              active={draft.sort === key}
              onPress={() => setDraft({ ...draft, sort: key })}
            />
          ))}
        </Section>

        <Section title={t('customer.filters.maxFee')}>
          {FEE_CAPS.map((cap) => (
            <Chip
              key={cap}
              testID={`fee-${cap}`}
              label={formatBaht(cap)}
              active={draft.maxDeliveryFeeSatang === cap}
              onPress={() =>
                setDraft({
                  ...draft,
                  // แตะซ้ำที่อันที่เลือกอยู่ = เอาออก ไม่ต้องหาปุ่มยกเลิกแยก
                  maxDeliveryFeeSatang: draft.maxDeliveryFeeSatang === cap ? null : cap,
                })
              }
            />
          ))}
        </Section>

        <Section title={t('customer.filters.minRating')}>
          {RATINGS.map((stars) => (
            <Chip
              key={stars}
              testID={`rating-${stars}`}
              label={`★ ${stars.toFixed(1)}+`}
              active={draft.minRating === stars}
              onPress={() =>
                setDraft({ ...draft, minRating: draft.minRating === stars ? null : stars })
              }
            />
          ))}
        </Section>

        <Section title={t('customer.filters.priceTier')}>
          {TIERS.map((tier) => (
            <Chip
              key={tier}
              testID={`tier-${tier}`}
              label={'฿'.repeat(tier)}
              active={draft.priceTiers.includes(tier)}
              onPress={() =>
                setDraft({
                  ...draft,
                  priceTiers: draft.priceTiers.includes(tier)
                    ? draft.priceTiers.filter((x) => x !== tier)
                    : [...draft.priceTiers, tier],
                })
              }
            />
          ))}
        </Section>

        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.md }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="body" bold>{t('customer.filters.openOnly')}</Text>
            <Text variant="caption" color="muted">{t('customer.filters.openOnlyHint')}</Text>
          </View>
          <Toggle
            testID="toggle-open-only"
            value={draft.openOnly}
            accessibilityLabel={t('customer.filters.openOnly')}
            onValueChange={(v) => setDraft({ ...draft, openOnly: v })}
          />
        </Card>

        <Button
          testID="btn-apply-filters"
          label={t('customer.filters.apply')}
          onPress={() => {
            apply(draft);
            navigation.goBack();
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { primitives: p } = useTheme();
  return (
    <View style={{ gap: p.space.sm }}>
      <Text variant="kicker" color="muted">{title}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: p.space.sm }}>{children}</View>
    </View>
  );
}
