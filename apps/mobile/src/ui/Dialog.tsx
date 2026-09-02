import React from 'react';
import { View, Modal, Pressable } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Card } from './Surface';

/**
 * กรอบของป๊อปอัปทุกจอ
 *
 * `Modal` ของ react-native-web วาดลง portal ที่ราก document ซึ่งอยู่นอกกรอบมือถือใน WebFrame
 * ปล่อยไว้แล้วกล่องจะกว้างเท่าหน้าต่างเบราว์เซอร์ทั้งบาน ไม่ใช่เท่าจอโทรศัพท์ที่แอปอยู่
 * จึงต้องคุมความกว้างสูงสุดเองตรงนี้ ไม่ใช่หวังให้กรอบข้างนอกคุมให้
 */
const PHONE_WIDTH = 430;

export function Dialog({
  visible,
  onClose,
  children,
  testID,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  testID?: string;
}) {
  const { primitives: p } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        testID={testID}
        style={{
          flex: 1,
          backgroundColor: 'rgba(27,25,23,0.55)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: p.space.xl,
        }}
      >
        {/* กดพื้นหลังเพื่อปิด เป็นทางออกที่คนคาดหวังจากกล่องแบบนี้ */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="close"
          onPress={onClose}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <View style={{ width: '100%', maxWidth: PHONE_WIDTH - p.space.xl * 2 }}>
          <Card style={{ gap: p.space.md, padding: p.space.xl }}>{children}</Card>
        </View>
      </View>
    </Modal>
  );
}
