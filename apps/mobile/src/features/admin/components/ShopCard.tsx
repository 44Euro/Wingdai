import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { errorText } from '../../../lib/errorText';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Surface';
import { useDecideRestaurant } from '../hooks';
import type { PendingRestaurant } from '../../../data/types';

/** ร้านที่รอตรวจ (product-spec §4.3 §7) */
export function ShopCard({ shop }: { shop: PendingRestaurant }) {
  const { t, i18n } = useTranslation();
  const { primitives: p } = useTheme();
  const decide = useDecideRestaurant();

  // §7 ร้านที่ไม่มีเมนูตั้งต้นอนุมัติไปก็เป็นหน้าว่างสำหรับลูกค้า
  const hasMenu = shop.menuItemCount >= 3;

  return (
    <Card testID={`pending-shop-${shop.id}`}>
      <View style={{ gap: p.space.sm }}>
        <View>
          <Text variant="h3">{shop.name}</Text>
          <Text variant="small" color="muted">{shop.addressText}</Text>
          <Text variant="small" color="muted">
            {shop.ownerName} · {shop.ownerPhone}
          </Text>
        </View>

        <Text variant="small" color={hasMenu ? 'muted' : 'danger'}>
          {t('admin.shopMenuCount', { count: shop.menuItemCount })}
        </Text>

        <View style={{ gap: p.space.sm }}>
          <Button
            testID={`btn-approve-shop-${shop.id}`}
            label={t('admin.approveShop')}
            disabled={decide.isPending || !hasMenu}
            onPress={() => decide.mutate({ restaurantId: shop.id, approve: true })}
          />
        </View>

        {decide.isError ? (
          <Text testID="shop-decide-error" variant="small" color="danger">
            {errorText(decide.error, t, i18n.language)}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
