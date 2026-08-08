import React from 'react';
/** ตัวต่อเส้นทาง ไม่ใช่จอ จอจริงคือ `features/chat/ChatScreen.tsx` ซึ่งเป็นตัวที่ */
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChatScreen } from '../chat/ChatScreen';
import type { RiderStackParamList } from '../../app/navigators/RiderStack';

type Props = NativeStackScreenProps<RiderStackParamList, 'RiderChat'>;

/** ไรเดอร์คุยกับลูกค้า (คู่ของ C10) ได้ข้อความสำเร็จรูปคนละชุดกับลูกค้า */
export function RiderChatRoute({ navigation, route }: Props) {
  return (
    <ChatScreen
      orderId={route.params.orderId}
      channel="customer_rider"
      isRiderView
      onBack={() => navigation.goBack()}
    />
  );
}
