import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-native-qrcode-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Card } from '../../../ui/Surface';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import { restaurantLink } from '../../../app/linking';
import { useMyRestaurants } from '../hooks';
import type { MerchantStackParamList } from '../../../app/navigators/MerchantStack';

type Props = NativeStackScreenProps<MerchantStackParamList, 'MerchantQr'>;

/** QR + ลิงก์ของร้าน (product-spec §11 ข้อ 1 ทางดึงลูกค้าตอนที่มีแต่แอป) */
export function MerchantQrScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { data: shops = [] } = useMyRestaurants();

  const shop = shops.find((s) => s.id === route.params.restaurantId);
  const link = restaurantLink(route.params.restaurantId);

  return (
    <SafeAreaView
      testID="screen-merchant-qr"
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScreenHeader title={t('merchant.qr.title')} onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: p.space.screen,
          paddingBottom: p.space.xl,
          gap: p.space.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Card style={{ alignItems: 'center', gap: p.space.md, paddingVertical: p.space.lg }}>
          <Text variant="h3" numberOfLines={1}>{shop?.name ?? ''}</Text>
          {/* พื้นขาวเสมอ ไม่ใช่สีพื้นของธีม QR บนพื้นสีเข้มในโหมดมืดสแกนไม่ติด */}
          <View style={{ backgroundColor: tokens.surfaceFixedLight, padding: p.space.md, borderRadius: p.radius.md }}>
            <QRCode value={link} size={200} />
          </View>
          <Text variant="small" color="muted" style={{ textAlign: 'center' }}>
            {t('merchant.qr.hint')}
          </Text>
        </Card>

        <Card style={{ gap: p.space.xs }}>
          <Text variant="kicker" color="muted">{t('merchant.qr.linkLabel')}</Text>
          <Text testID="merchant-qr-link" variant="small" selectable>{link}</Text>
          <Text variant="caption" color="faint">{t('merchant.qr.linkHint')}</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
