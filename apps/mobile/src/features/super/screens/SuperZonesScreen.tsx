import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Card, Chip } from '../../../ui/Surface';
import { Field, Input } from '../../../ui/Field';
import { formatBaht } from '../../../lib/format';
import { SUPER_TAB_CLEARANCE } from '../../../app/navigators/SuperAdminTabBar';
import type { Zone, ZoneReport } from '../../../data/types';
import { useSuperZones, useSaveZone } from '../hooks';

type ZoneType = Zone['type'];
const ZONE_TYPES: ZoneType[] = ['university', 'condo_cluster', 'office_district', 'mixed'];

/** จุดกลางกรุงเทพฯ ค่าตั้งต้นของฟอร์ม ไม่ใช่ (0,0) ที่อยู่กลางมหาสมุทร */
const DEFAULT_CENTER = { lat: 13.7563, lng: 100.5018 };

type Draft = { id: string | null; name: string; type: ZoneType; lat: string; lng: string };

const emptyDraft = (): Draft => ({
  id: null, name: '', type: 'mixed',
  lat: String(DEFAULT_CENTER.lat), lng: String(DEFAULT_CENTER.lng),
});

/** SA2 โซน: รายงาน + สร้าง/แก้ */
export function SuperZonesScreen() {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();

  const { data: zones = [], isPending } = useSuperZones();
  const save = useSaveZone();

  /** null = ยังไม่ได้เปิดฟอร์ม ฟอร์มเดียวใช้ทั้งสร้างใหม่และแก้ของเดิม */
  const [draft, setDraft] = useState<Draft | null>(null);

  const lat = Number(draft?.lat);
  const lng = Number(draft?.lng);
  const validCoords = Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  const canSave = !!draft?.name.trim() && validCoords && !save.isPending;

  const startEdit = (z: ZoneReport) => setDraft({
    id: z.id, name: z.name, type: z.type, lat: String(z.lat), lng: String(z.lng),
  });

  return (
    <SafeAreaView
      testID="screen-super-zones"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScrollView
        contentContainerStyle={{
          padding: p.space.screen, paddingBottom: SUPER_TAB_CLEARANCE, gap: p.space.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text variant="h1">{t('super.zones.title')}</Text>
          <Text variant="small" color="muted">{t('super.zones.subtitle')}</Text>
        </View>

        {zones.length === 0 ? (
          <Text testID="super-zones-empty" variant="body" color="muted">
            {isPending ? t('common.loading') : t('super.zones.empty')}
          </Text>
        ) : null}

        {zones.map((z) => (
          <Card key={z.id} testID={`super-zone-${z.id}`}>
            <View style={{ gap: p.space.sm }}>
              <View
                style={{
                  flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
                  gap: p.space.md,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="body" bold numberOfLines={1}>{z.name}</Text>
                  <Text variant="small" color="muted">{t(`super.zones.type.${z.type}`)}</Text>
                </View>
                <Button
                  testID={`btn-edit-zone-${z.id}`}
                  variant="secondary"
                  label={t('super.zones.edit')}
                  onPress={() => startEdit(z)}
                />
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="small" color="muted">{t('super.zones.liveOrders')}</Text>
                <Text variant="small" bold>{z.liveOrders}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="small" color="muted">{t('super.zones.ridersOnline')}</Text>
                <Text variant="small" bold>{z.ridersOnline}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="small" color="muted">{t('super.zones.gmv')}</Text>
                <Text variant="small" bold>{formatBaht(z.gmvSatang)}</Text>
              </View>
            </View>
          </Card>
        ))}

        {draft === null ? (
          <Button
            testID="btn-add-zone"
            label={t('super.zones.add')}
            onPress={() => setDraft(emptyDraft())}
          />
        ) : (
          <Card testID="super-zone-form">
            <View style={{ gap: p.space.md }}>
              <Text variant="h3">
                {draft.id ? t('super.zones.editTitle') : t('super.zones.addTitle')}
              </Text>

              <Field label={t('super.zones.name')}>
                <Input
                  testID="input-zone-name"
                  value={draft.name}
                  onChangeText={(v) => setDraft({ ...draft, name: v })}
                  placeholder={t('super.zones.namePlaceholder')}
                />
              </Field>

              <Field label={t('super.zones.typeLabel')}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: p.space.sm }}>
                  {ZONE_TYPES.map((type) => (
                    <Chip
                      key={type}
                      testID={`zone-type-${type}`}
                      label={t(`super.zones.type.${type}`)}
                      active={draft.type === type}
                      onPress={() => setDraft({ ...draft, type })}
                    />
                  ))}
                </View>
              </Field>

              {/* พิกัดกรอกเป็นตัวเลข ไม่ใช่ปักหมุดบนแผนที่ จุดกลางโซนใช้แค่จัดกลุ่มรายงาน */}
              <View style={{ flexDirection: 'row', gap: p.space.md }}>
                <Field label={t('super.zones.lat')} style={{ flex: 1 }}>
                  <Input
                    testID="input-zone-lat"
                    value={draft.lat}
                    keyboardType="numeric"
                    onChangeText={(v) => setDraft({ ...draft, lat: v })}
                  />
                </Field>
                <Field label={t('super.zones.lng')} style={{ flex: 1 }}>
                  <Input
                    testID="input-zone-lng"
                    value={draft.lng}
                    keyboardType="numeric"
                    onChangeText={(v) => setDraft({ ...draft, lng: v })}
                  />
                </Field>
              </View>

              {!validCoords ? (
                <Text testID="zone-coords-error" variant="small" color="danger">
                  {t('super.zones.badCoords')}
                </Text>
              ) : null}

              <Button
                testID="btn-save-zone"
                label={t('common.save')}
                disabled={!canSave}
                onPress={() => {
                  if (!canSave) return;
                  save.mutate(
                    {
                      id: draft.id,
                      input: { name: draft.name.trim(), type: draft.type, lat, lng },
                    },
                    { onSuccess: () => setDraft(null) },
                  );
                }}
              />
              <Button
                testID="btn-cancel-zone"
                variant="secondary"
                label={t('common.cancel')}
                onPress={() => setDraft(null)}
              />
            </View>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
