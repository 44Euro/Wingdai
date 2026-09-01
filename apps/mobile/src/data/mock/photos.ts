
/**
 * รูปในโหมดข้อมูลจำลอง ชี้ไปบักเก็ตเดียวกับของจริง จอเดโมจะได้ไม่ใช่กล่องเทาทั้งหน้า
 * สร้างจากฐานสาธิตด้วย `npm run db:photos` ฝั่ง core-api คีย์เป็นชื่อร้าน/ชื่อจาน
 */
const BUCKET = 'https://wozjnhkhjfjokehrdqtu.supabase.co/storage/v1/object/public/public-media/catalog';

const FILE_BY_NAME: Record<string, string> = {
  'ก๋วยเตี๋ยวต้มยำเจ๊นิด': 'shop-0829699fa4.jpg',
  'ก๋วยเตี๋ยวเนื้อตุ๋นอารีย์': 'shop-c360e66955.jpg',
  'ก๋วยเตี๋ยวเรือ': 'shop-8e197e6b52.jpg',
  'กาแฟสดอารีย์โรสต์': 'shop-4e48e9a031.jpg',
  'ขนมครกโบราณ': 'shop-3e31815f7f.jpg',
  'ข้าวแกงป้าอ้วน': 'shop-ac387e9e4c.jpg',
  'ข้าวขาหมูตรอกซุง': 'shop-73ee4157e7.jpg',
  'ข้าวต้มสีลม': 'shop-1dbbaf9b1b.jpg',
  'ข้าวมันไก่ประตูน้ำ': 'shop-8cfbdc015d.jpg',
  'ข้าวหมูแดงเจ๊หมวย': 'shop-5e5d17d611.jpg',
  'ครัวมาลี': 'shop-31c0bbce3b.jpg',
  'ชานมไข่มุกอารีย์': 'shop-8092e9830a.jpg',
  'ตำมั่วสาขาอารีย์': 'shop-56d2225504.jpg',
  'น้ำปั่นเจ๊แดง': 'shop-7e4a796f42.jpg',
  'บะหมี่เกี๊ยวกุ้งสะพานควาย': 'shop-addf9afecd.jpg',
  'บิงซูหวานเย็น': 'shop-139c1f7695.jpg',
  'ร้านรออนุมัติ': 'shop-74b00299df.jpg',
  'ราเมนทองหล่อ': 'shop-c5d3b12a47.jpg',
  'โรตีชาชักพหลโยธิน': 'shop-b09ec19ce3.jpg',
  'ส้มตำแซ่บนัว': 'shop-df308d2313.jpg',
  'ส้มตำนัวนัว': 'shop-0601ad8936.jpg',
  'ส้มตำบางนา': 'shop-72c1a1fcfe.jpg',
  'ส้มตำป้านวล': 'shop-3624057e4a.jpg',
  'ก๋วยเตี๋ยวเรือหมู': 'dish-1e22ee1d68.jpg',
  'ก๋วยเตี๋ยวหมูน้ำใส': 'dish-dfa1ec1f6b.jpg',
  'เกาเหลา': 'dish-e24ed728d6.jpg',
  'ไก่ย่าง': 'dish-03caa99010.jpg',
  'ขนมครก': 'dish-f168591b28.jpg',
  'ข้าวกะเพราหมู': 'dish-2e3e78562b.jpg',
  'ข้าวกะเพราหมูสับ': 'dish-b3a1d8b454.jpg',
  'ข้าวไข่เจียว': 'dish-43e68b2aa4.jpg',
  'ข้าวผัดกุ้ง': 'dish-329f7cfe91.jpg',
  'ข้าวผัดหมู': 'dish-932200e4c2.jpg',
  'ข้าวมันไก่': 'dish-13dc8d6b48.jpg',
  'ข้าวหมูทอด': 'dish-258fc12da6.jpg',
  'ข้าวเหนียว': 'dish-abe43fef58.jpg',
  'ชาไทยเย็น': 'dish-b84660051b.jpg',
  'น้ำมะพร้าว': 'dish-2e2c739db4.jpg',
  'น้ำส้มคั้นสด': 'dish-41e19e7d50.jpg',
  'บะหมี่แห้ง': 'dish-1442bfae17.jpg',
  'บัวลอยไข่หวาน': 'dish-6439a2a4e7.jpg',
  'ส้มตำไทย': 'dish-ef6537b2ee.jpg',
  'อเมริกาโน่เย็น': 'dish-0f902d0576.jpg',
  'ไอศกรีมกะทิ': 'dish-10f533dbe1.jpg',
};

/** ไม่มีชื่อนี้ในตาราง = จอวาดกล่องไล่สีตามหมวดแทน ซึ่งเป็นพฤติกรรมเดิม */
export function photoFor(name: string): string | null {
  const file = FILE_BY_NAME[name];
  return file ? `${BUCKET}/${file}` : null;
}
