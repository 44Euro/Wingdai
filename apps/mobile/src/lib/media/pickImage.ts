import * as ImagePicker from 'expo-image-picker';

/** นามสกุลที่เซิร์ฟเวอร์รับ ตรงกับ ALLOWED_EXT ใน core-api/src/storage/storage.service.ts */
const ALLOWED = ['jpg', 'jpeg', 'png', 'webp', 'heic'];

/** ชนิดไฟล์ที่ picker คืนมา → นามสกุลที่เราใช้ตั้งชื่อไฟล์ */
const FROM_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heic',
};

/** เลือกรูปหนึ่งใบ ห่อ expo-image-picker ไว้ที่ไฟล์นี้ไฟล์เดียว */
export async function pickImage(): Promise<{ uri: string; ext: string } | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    // SDK 57 รับเป็นอาร์เรย์ของสตริง `MediaTypeOptions` เดิมเลิกใช้แล้ว
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.7,
  });

  const asset = result.canceled ? null : result.assets?.[0];
  if (!asset) return null;

  return { uri: asset.uri, ext: extensionOf(asset.mimeType, asset.fileName, asset.uri) };
}

/** หานามสกุลจากสิ่งที่เชื่อถือได้ที่สุดก่อน */
export function extensionOf(
  mimeType?: string | null,
  fileName?: string | null,
  uri?: string | null,
): string {
  const fromMime = mimeType ? FROM_MIME[mimeType.toLowerCase()] : undefined;
  if (fromMime) return fromMime;

  for (const source of [fileName, uri]) {
    const guess = source?.split('?')[0]?.split('.').pop()?.toLowerCase();
    if (guess && ALLOWED.includes(guess)) return guess;
  }
  return 'jpg';
}
