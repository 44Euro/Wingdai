import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { Card, Chip, Toggle } from '../../../ui/Surface';
import { Field, Input } from '../../../ui/Field';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import { useCreateMenuItem } from '../hooks';
import type { MerchantStackParamList } from '../../../app/navigators/MerchantStack';
import type { CuisineCategory, OptionGroup } from '../../../data/types';

type Props = NativeStackScreenProps<MerchantStackParamList, 'AddMenuItem'>;

type DraftChoice = { name: string; price: string };
type DraftGroup = { name: string; minSelect: number; maxSelect: number; choices: DraftChoice[] };

const CATEGORIES: CuisineCategory[] = ['rice', 'noodle', 'somtam', 'drink', 'dessert'];
const toSatang = (baht: string) => Math.round((parseFloat(baht) || 0) * 100);

export function AddMenuItemScreen({ navigation, route }: Props) {
  const { restaurantId } = route.params;
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const createMenuItem = useCreateMenuItem(restaurantId);

  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<CuisineCategory>('rice');
  const [available, setAvailable] = useState(true);
  const [groups, setGroups] = useState<DraftGroup[]>([]);

  const updateGroup = (gi: number, patch: Partial<DraftGroup>) =>
    setGroups((gs) => gs.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  const updateChoice = (gi: number, ci: number, patch: Partial<DraftChoice>) =>
    setGroups((gs) =>
      gs.map((g, i) =>
        i === gi ? { ...g, choices: g.choices.map((c, j) => (j === ci ? { ...c, ...patch } : c)) } : g,
      ),
    );

  const canSave = name.trim() !== '' && toSatang(price) > 0;

  function save() {
    if (!canSave) return;
    const optionGroups: OptionGroup[] = groups
      .filter((g) => g.name.trim() && g.choices.some((c) => c.name.trim()))
      .map((g, gi) => ({
        id: `g-${gi}`,
        name: g.name.trim(),
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        choices: g.choices
          .filter((c) => c.name.trim())
          .map((c, ci) => ({ id: `g-${gi}-c-${ci}`, name: c.name.trim(), priceDelta: toSatang(c.price) })),
      }));
    createMenuItem.mutate(
      {
        restaurantId,
        name: name.trim(),
        description: desc.trim() || undefined,
        price: toSatang(price),
        category,
        isAvailable: available,
        optionGroups: optionGroups.length ? optionGroups : undefined,
      },
      { onSuccess: () => navigation.goBack() },
    );
  }

  return (
    <SafeAreaView testID="screen-add-menu-item" edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
      <ScreenHeader title={t('merchant.form.title')} onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: p.space.screen, paddingBottom: p.space.xl, gap: p.space.lg }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Field label={t('merchant.form.name')}>
          <Input testID="input-name" value={name} onChangeText={setName} />
        </Field>

        <Field label={t('merchant.form.desc')}>
          <Input
            testID="input-desc"
            value={desc}
            onChangeText={setDesc}
            multiline
            style={{ minHeight: 72, textAlignVertical: 'top' }}
          />
        </Field>

        <Field label={t('merchant.form.price')}>
          <Input
            testID="input-price"
            keyboardType="numeric"
            value={price}
            onChangeText={setPrice}
          />
        </Field>

        <Field label={t('merchant.form.category')}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: p.space.sm }}>
            {CATEGORIES.map((c) => (
              <Chip
                key={c}
                testID={`cat-${c}`}
                label={t(`customer.cuisine.${c}`)}
                active={c === category}
                onPress={() => setCategory(c)}
              />
            ))}
          </View>
        </Field>

        <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="body" bold>{t('merchant.form.available')}</Text>
          <Toggle
            testID="toggle-available"
            value={available}
            onValueChange={setAvailable}
            accessibilityLabel={t('merchant.form.available')}
          />
        </Card>

        {/* กลุ่มตัวเลือก — เจ้าของร้านกดเพิ่มได้ไม่จำกัดจำนวน */}
        <Text variant="h3" style={{ marginTop: p.space.xs }}>{t('merchant.form.options')}</Text>

        {groups.map((g, gi) => (
          <Card key={gi} style={{ gap: p.space.md }}>
            <Input
              testID={`input-group-name-${gi}`}
              placeholder={t('merchant.form.groupName')}
              value={g.name}
              onChangeText={(v) => updateGroup(gi, { name: v })}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="small" color="muted">{t('merchant.form.min')}</Text>
              <Stepper testID={`group-min-${gi}`} value={g.minSelect} min={0} onChange={(v) => updateGroup(gi, { minSelect: v })} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="small" color="muted">{t('merchant.form.max')}</Text>
              <Stepper testID={`group-max-${gi}`} value={g.maxSelect} min={1} onChange={(v) => updateGroup(gi, { maxSelect: v })} />
            </View>

            {g.choices.map((c, ci) => (
              <View key={ci} style={{ flexDirection: 'row', gap: p.space.sm }}>
                <Input
                  testID={`input-choice-name-${gi}-${ci}`}
                  placeholder={t('merchant.form.choiceName')}
                  value={c.name}
                  onChangeText={(v) => updateChoice(gi, ci, { name: v })}
                  containerStyle={{ flex: 2 }}
                />
                <Input
                  testID={`input-choice-price-${gi}-${ci}`}
                  placeholder={t('merchant.form.choicePrice')}
                  keyboardType="numeric"
                  value={c.price}
                  onChangeText={(v) => updateChoice(gi, ci, { price: v })}
                  containerStyle={{ flex: 1.2 }}
                />
              </View>
            ))}

            <Button
              testID={`btn-add-choice-${gi}`}
              label={t('merchant.form.addChoice')}
              variant="secondary"
              onPress={() => updateGroup(gi, { choices: [...g.choices, { name: '', price: '' }] })}
            />

            <Pressable
              testID={`btn-remove-group-${gi}`}
              accessibilityRole="button"
              onPress={() => setGroups((gs) => gs.filter((_, i) => i !== gi))}
              hitSlop={8}
              style={({ pressed }) => ({ alignSelf: 'flex-end', paddingVertical: p.space.xs, opacity: pressed ? 0.7 : 1 })}
            >
              <Text variant="small" color="danger" bold>{t('merchant.form.removeGroup')}</Text>
            </Pressable>
          </Card>
        ))}

        <Button
          testID="btn-add-group"
          label={t('merchant.form.addGroup')}
          variant="secondary"
          onPress={() => setGroups((gs) => [...gs, { name: '', minSelect: 0, maxSelect: 1, choices: [] }])}
        />
      </ScrollView>

      <View style={{ paddingHorizontal: p.space.screen, paddingBottom: p.space.lg, paddingTop: p.space.sm }}>
        <Button
          testID="btn-save"
          label={t('merchant.form.save')}
          disabled={!canSave || createMenuItem.isPending}
          onPress={save}
        />
      </View>
    </SafeAreaView>
  );
}

function Stepper({
  testID,
  value,
  onChange,
  min,
}: {
  testID: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
}) {
  const { tokens, primitives: p } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: p.space.sm,
        backgroundColor: tokens.bgSunken,
        borderRadius: p.radius.full,
        padding: 4,
      }}
    >
      <Pressable
        testID={`${testID}-dec`}
        accessibilityRole="button"
        accessibilityLabel="ลด"
        onPress={() => onChange(Math.max(min, value - 1))}
        hitSlop={8}
        style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: tokens.bgRaised, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="minus" color={tokens.textPrimary} size={16} strokeWidth={2.8} />
      </Pressable>
      <Text variant="small" bold style={{ minWidth: 18, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      <Pressable
        testID={`${testID}-inc`}
        accessibilityRole="button"
        accessibilityLabel="เพิ่ม"
        onPress={() => onChange(value + 1)}
        hitSlop={8}
        style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: tokens.brandAccent, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="plus" color="#FFFFFF" size={16} strokeWidth={2.8} />
      </Pressable>
    </View>
  );
}
