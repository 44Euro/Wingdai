import React, { useState } from 'react';
import { View, ScrollView, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
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
    setGroups((gs) => gs.map((g, i) => (i === gi ? { ...g, choices: g.choices.map((c, j) => (j === ci ? { ...c, ...patch } : c)) } : g)));

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

  const inputStyle = {
    borderWidth: 1.5,
    borderColor: tokens.borderSubtle,
    borderRadius: p.radius.md,
    backgroundColor: tokens.bgRaised,
    color: tokens.textPrimary,
    fontFamily: p.fontFamily.body,
    fontSize: p.fontSize.body,
    paddingHorizontal: p.space.lg,
    paddingVertical: p.space.md,
    minHeight: 48,
  } as const;

  const Stepper = ({ testID, value, onChange, min }: { testID: string; value: number; onChange: (v: number) => void; min: number }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.sm }}>
      <Pressable testID={`${testID}-dec`} onPress={() => onChange(Math.max(min, value - 1))} hitSlop={8} style={{ width: 36, height: 36, borderRadius: p.radius.sm, borderWidth: 1, borderColor: tokens.borderSubtle, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="body">−</Text>
      </Pressable>
      <Text variant="body" style={{ minWidth: 20, textAlign: 'center', fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Pressable testID={`${testID}-inc`} onPress={() => onChange(value + 1)} hitSlop={8} style={{ width: 36, height: 36, borderRadius: p.radius.sm, backgroundColor: tokens.brandSolid, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="body" color="onBrand">+</Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView testID="screen-add-menu-item" edges={['bottom']} style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
      <ScrollView contentContainerStyle={{ padding: p.space.xl, gap: p.space.md }} keyboardShouldPersistTaps="handled">
        <TextInput testID="input-name" placeholder={t('merchant.form.name')} placeholderTextColor={tokens.textMuted} allowFontScaling={false} value={name} onChangeText={setName} style={inputStyle} />
        <TextInput testID="input-desc" placeholder={t('merchant.form.desc')} placeholderTextColor={tokens.textMuted} allowFontScaling={false} value={desc} onChangeText={setDesc} style={inputStyle} />
        <TextInput testID="input-price" placeholder={t('merchant.form.price')} placeholderTextColor={tokens.textMuted} keyboardType="numeric" allowFontScaling={false} value={price} onChangeText={setPrice} style={inputStyle} />

        {/* หมวดหมู่ */}
        <Text variant="small" color="muted">{t('merchant.form.category')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: p.space.sm }}>
          {CATEGORIES.map((c) => {
            const active = c === category;
            return (
              <Pressable key={c} testID={`cat-${c}`} onPress={() => setCategory(c)} style={{ paddingHorizontal: p.space.lg, paddingVertical: p.space.sm, borderRadius: p.radius.full, backgroundColor: active ? tokens.brandSolid : tokens.bgRaised, borderWidth: 1, borderColor: active ? tokens.brandSolid : tokens.borderSubtle }}>
                <Text variant="small" color={active ? 'onBrand' : 'primary'}>{t(`customer.cuisine.${c}`)}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* พร้อมขาย */}
        <Pressable testID="toggle-available" onPress={() => setAvailable((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: p.space.sm }}>
          <Text variant="body">{t('merchant.form.available')}</Text>
          <View style={{ width: 48, height: 28, borderRadius: 14, padding: 3, backgroundColor: available ? tokens.brandSolid : tokens.borderSubtle, alignItems: available ? 'flex-end' : 'flex-start' }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: tokens.bgRaised }} />
          </View>
        </Pressable>

        {/* กลุ่มตัวเลือก (ไม่จำกัด) */}
        <Text variant="h3" style={{ marginTop: p.space.sm }}>{t('merchant.form.options')}</Text>
        {groups.map((g, gi) => (
          <View key={gi} style={{ backgroundColor: tokens.bgRaised, borderRadius: p.radius.md, borderWidth: 1, borderColor: tokens.borderSubtle, padding: p.space.lg, gap: p.space.sm }}>
            <TextInput testID={`input-group-name-${gi}`} placeholder={t('merchant.form.groupName')} placeholderTextColor={tokens.textMuted} allowFontScaling={false} value={g.name} onChangeText={(v) => updateGroup(gi, { name: v })} style={inputStyle} />
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
                <TextInput testID={`input-choice-name-${gi}-${ci}`} placeholder={t('merchant.form.choiceName')} placeholderTextColor={tokens.textMuted} allowFontScaling={false} value={c.name} onChangeText={(v) => updateChoice(gi, ci, { name: v })} style={[inputStyle, { flex: 2 }]} />
                <TextInput testID={`input-choice-price-${gi}-${ci}`} placeholder={t('merchant.form.choicePrice')} placeholderTextColor={tokens.textMuted} keyboardType="numeric" allowFontScaling={false} value={c.price} onChangeText={(v) => updateChoice(gi, ci, { price: v })} style={[inputStyle, { flex: 1 }]} />
              </View>
            ))}
            <Button testID={`btn-add-choice-${gi}`} label={t('merchant.form.addChoice')} variant="secondary" onPress={() => updateGroup(gi, { choices: [...g.choices, { name: '', price: '' }] })} />
            <Pressable testID={`btn-remove-group-${gi}`} onPress={() => setGroups((gs) => gs.filter((_, i) => i !== gi))} hitSlop={8} style={{ alignSelf: 'flex-end', paddingVertical: p.space.xs }}>
              <Text variant="small" style={{ color: tokens.danger }}>{t('merchant.form.removeGroup')}</Text>
            </Pressable>
          </View>
        ))}

        <Button testID="btn-add-group" label={t('merchant.form.addGroup')} variant="secondary" onPress={() => setGroups((gs) => [...gs, { name: '', minSelect: 0, maxSelect: 1, choices: [] }])} />

        <Button testID="btn-save" label={t('merchant.form.save')} disabled={!canSave || createMenuItem.isPending} onPress={save} />
      </ScrollView>
    </SafeAreaView>
  );
}
