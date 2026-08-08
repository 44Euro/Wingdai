import React from 'react';
/** ตัวต่อเส้นทาง ไม่ใช่จอ จอจริงคือ `features/chat/ChatScreen.tsx` ซึ่งเป็นตัวที่ */
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChatScreen } from '../chat/ChatScreen';
import type { CustomerStackParamList } from '../../app/navigators/CustomerStack';

type Props = NativeStackScreenProps<CustomerStackParamList, 'OrderChat'>;

/** C10 ลูกค้าคุยกับไรเดอร์หรือกับร้าน ใช้จอแชทตัวเดียวกับฝั่งร้าน */
export function OrderChatRoute({ navigation, route }: Props) {
  return (
    <ChatScreen
      orderId={route.params.orderId}
      channel={route.params.channel}
      onBack={() => navigation.goBack()}
    />
  );
}
