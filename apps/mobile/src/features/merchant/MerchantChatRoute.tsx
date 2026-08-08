import React from 'react';
/** ตัวต่อเส้นทาง ไม่ใช่จอ จอจริงคือ `features/chat/ChatScreen.tsx` ซึ่งเป็นตัวที่ */
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChatScreen } from '../chat/ChatScreen';
import type { MerchantStackParamList } from '../../app/navigators/MerchantStack';

type Props = NativeStackScreenProps<MerchantStackParamList, 'MerchantChat'>;

/** M10 ร้านคุยกับลูกค้า ช่องนี้ช่องเดียว ร้านไม่มีทางเข้าช่องที่ลูกค้าคุยกับไรเดอร์ */
export function MerchantChatRoute({ navigation, route }: Props) {
  return (
    <ChatScreen
      orderId={route.params.orderId}
      channel="customer_merchant"
      onBack={() => navigation.goBack()}
    />
  );
}
