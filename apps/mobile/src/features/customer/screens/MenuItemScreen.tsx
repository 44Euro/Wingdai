import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { Badge, PhotoBlock, RoundButton } from '../../../ui/Surface';
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
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        <View>
          <PhotoBlock height={200} radius={0} />
          <View style={{ position: 'absolute', top: p.space.lg, left: p.space.lg }}>
            <RoundButton icon="chevronLeft" onPress={() => navigation.goBack()} accessibilityLabel={t('common.back')} />
          </View>
        </View>

        <View style={{ paddingHorizontal: p.space.screen, paddingTop: p.space.lg, gap: p.space.xs }}>
          <Text variant="h1">{item?.name ?? ''}</Text>
          {item?.description ? <Text variant="small" color="muted">{item.description}</Text> : null}
          <Text variant="h3" color="brand" style={{ marginTop: p.space.xs }}>{formatBaht(item?.price ?? 0)}</Text>
        </View>

        <View style={{ paddingHorizontal: p.space.screen, paddingTop: p.space.lg, gap: p.space.lg }}>
          {groups.map((g) => (
            <View key={g.id} style={{ gap: p.space.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text variant="bodyLg" bold>{g.name}</Text>
                <Badge
                  label={g.minSelect >= 1 ? t('customer.item.required') : t('customer.item.optional')}
                  tone={g.minSelect >= 1 ? 'brand' : 'neutral'}
                />
              </View>

              {g.choices.map((c) => {
                const isSel = (selected[g.id] ?? []).includes(c.id);
                const isRadio = g.maxSelect === 1;
                return (
                  <Pressable
                    key={c.id}
                    testID={`choice-${c.id}`}
                    accessibilityRole={isRadio ? 'radio' : 'checkbox'}
                    accessibilityState={{ checked: isSel }}
                    onPress={() => toggle(g, c.id)}
                    style={({ pressed }) => [
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: p.space.md,
                        backgroundColor: tokens.bgRaised,
                        borderRadius: p.radius.lg,
                        borderWidth: 2,
                        borderColor: isSel ? tokens.brandAccent : 'transparent',
                        paddingHorizontal: p.space.lg,
                        paddingVertical: 14,
                        minHeight: 56,
                        opacity: pressed ? 0.9 : 1,
                      },
                      p.shadow.card,
                    ]}
                  >
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: isRadio ? 12 : 8,
                        borderWidth: isSel ? 0 : 2,
                        borderColor: tokens.borderSubtle,
                        backgroundColor: isSel ? tokens.brandAccent : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isSel ? <Icon name="check" color="#FFFFFF" size={14} strokeWidth={3.4} /> : null}
                    </View>
                    <Text variant="body" style={{ flex: 1 }} numberOfLines={2}>{c.name}</Text>
                    {c.priceDelta > 0 ? (
                      <Text variant="small" color="onTealTint" bold>+{formatBaht(c.priceDelta)}</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))}

          {/* จำนวน */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              alignSelf: 'flex-start',
              gap: p.space.md,
              backgroundColor: tokens.bgRaised,
              borderRadius: p.radius.full,
              padding: 6,
              marginTop: p.space.xs,
            }}
          >
            <Pressable
              testID="mi-qty-dec"
              accessibilityRole="button"
              accessibilityLabel="ลดจำนวน"
              onPress={() => setQuantity((q) => Math.max(1, q - 1))}
              hitSlop={10}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: tokens.bgSunken, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="minus" color={tokens.textPrimary} size={18} strokeWidth={2.8} />
            </Pressable>
            <Text variant="body" bold style={{ minWidth: 22, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
              {quantity}
            </Text>
            <Pressable
              testID="mi-qty-inc"
              accessibilityRole="button"
              accessibilityLabel="เพิ่มจำนวน"
              onPress={() => setQuantity((q) => q + 1)}
              hitSlop={10}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: tokens.brandAccent, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="plus" color="#FFFFFF" size={18} strokeWidth={2.8} />
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: p.space.screen, paddingBottom: p.space.lg, paddingTop: p.space.sm }}>
        <Button
          testID="btn-add-to-basket"
          label={t('customer.item.addToBasket')}
          trailingLabel={formatBaht(total)}
          disabled={!item || !requiredSatisfied}
          onPress={add}
        />
      </View>
    </SafeAreaView>
  );
}
