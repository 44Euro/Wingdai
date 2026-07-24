import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { useMenu } from '../hooks';
import { useCartStore, type SelectedChoice } from '../../cart/cartStore';
import { formatBaht } from '../../../lib/format';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';
import type { OptionGroup } from '../../../data/types';

type Props = NativeStackScreenProps<CustomerStackParamList, 'MenuItem'>;

export function MenuItemScreen({ navigation, route }: Props) {
  const { restaurantId, menuItemId } = route.params;
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { data: menu = [] } = useMenu(restaurantId);
  const addLine = useCartStore((s) => s.addLine);
  const item = menu.find((m) => m.id === menuItemId);
  const groups: OptionGroup[] = item?.optionGroups ?? [];

  // selected: groupId -> choiceIds
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);

  function toggle(group: OptionGroup, choiceId: string) {
    setSelected((prev) => {
      const cur = prev[group.id] ?? [];
      if (group.maxSelect === 1) return { ...prev, [group.id]: [choiceId] };
      if (cur.includes(choiceId)) return { ...prev, [group.id]: cur.filter((c) => c !== choiceId) };
      if (cur.length >= group.maxSelect) return prev; // เต็มแล้ว
      return { ...prev, [group.id]: [...cur, choiceId] };
    });
  }

  const requiredSatisfied = groups.every((g) => (selected[g.id]?.length ?? 0) >= g.minSelect);

  function buildChoices(): SelectedChoice[] {
    const out: SelectedChoice[] = [];
    for (const g of groups) {
      for (const cid of selected[g.id] ?? []) {
        const choice = g.choices.find((c) => c.id === cid);
        if (choice) out.push({ groupId: g.id, choiceId: cid, name: choice.name, priceDelta: choice.priceDelta });
      }
    }
    return out;
  }

  const choices = buildChoices();
  const unitPrice = (item?.price ?? 0) + choices.reduce((s, c) => s + c.priceDelta, 0);
  const total = unitPrice * quantity;

  function add() {
    if (!item || !requiredSatisfied) return;
    addLine(restaurantId, { menuItem: item, selectedChoices: choices, quantity });
    navigation.goBack();
  }

  return (
    <SafeAreaView testID="screen-menu-item" edges={['bottom']} style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
      <ScrollView contentContainerStyle={{ padding: p.space.xl, gap: p.space.lg, paddingBottom: 120 }}>
        <View style={{ height: 160, borderRadius: p.radius.lg, backgroundColor: tokens.brandAccent, opacity: 0.18 }} />
        <View style={{ gap: p.space.xs }}>
          <Text variant="h1">{item?.name ?? ''}</Text>
          {item?.description ? <Text variant="small" color="muted">{item.description}</Text> : null}
          <Text variant="h3">{formatBaht(item?.price ?? 0)}</Text>
        </View>

        {groups.map((g) => (
          <View key={g.id} style={{ gap: p.space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text variant="h3">{g.name}</Text>
              <View style={{ backgroundColor: tokens.bgRaised, borderWidth: 1, borderColor: tokens.borderSubtle, borderRadius: p.radius.full, paddingHorizontal: p.space.md, paddingVertical: 2 }}>
                <Text variant="caption" color="muted">{g.minSelect >= 1 ? t('customer.item.required') : t('customer.item.optional')}</Text>
              </View>
            </View>
            {g.choices.map((c) => {
              const isSel = (selected[g.id] ?? []).includes(c.id);
              return (
                <Pressable
                  key={c.id}
                  testID={`choice-${c.id}`}
                  onPress={() => toggle(g, c.id)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.md, backgroundColor: tokens.bgRaised, borderRadius: p.radius.md, borderWidth: 1.5, borderColor: isSel ? tokens.brandSolid : tokens.borderSubtle, padding: p.space.lg, minHeight: 48 }}
                >
                  <View style={{ width: 22, height: 22, borderRadius: g.maxSelect === 1 ? 11 : 6, borderWidth: 2, borderColor: isSel ? tokens.brandSolid : tokens.borderSubtle, backgroundColor: isSel ? tokens.brandSolid : 'transparent' }} />
                  <Text variant="body" style={{ flex: 1 }}>{c.name}</Text>
                  {c.priceDelta > 0 ? <Text variant="small" color="muted">+{formatBaht(c.priceDelta)}</Text> : null}
                </Pressable>
              );
            })}
          </View>
        ))}

        {/* จำนวน */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.lg }}>
          <Pressable testID="mi-qty-dec" onPress={() => setQuantity((q) => Math.max(1, q - 1))} hitSlop={8} style={{ width: 44, height: 44, borderRadius: p.radius.md, borderWidth: 1, borderColor: tokens.borderSubtle, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="h3">−</Text>
          </Pressable>
          <Text variant="body" style={{ minWidth: 24, textAlign: 'center', fontVariant: ['tabular-nums'] }}>{quantity}</Text>
          <Pressable testID="mi-qty-inc" onPress={() => setQuantity((q) => q + 1)} hitSlop={8} style={{ width: 44, height: 44, borderRadius: p.radius.md, backgroundColor: tokens.brandSolid, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="h3" color="onBrand">+</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={{ padding: p.space.xl, borderTopWidth: 1, borderTopColor: tokens.borderSubtle, backgroundColor: tokens.bgSurface }}>
        <Button
          testID="btn-add-to-basket"
          label={`${t('customer.item.addToBasket')} · ${formatBaht(total)}`}
          disabled={!item || !requiredSatisfied}
          onPress={add}
        />
      </View>
    </SafeAreaView>
  );
}
