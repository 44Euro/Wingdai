import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { repos } from '../../data';
import { usePaymentStore } from './paymentStore';

/** ดึงค่าจาก `GET /config` แล้วป้อนเข้า `paymentStore` */
export function usePlatformConfig() {
  const setAvailable = usePaymentStore((s) => s.setAvailable);

  const query = useQuery({
    queryKey: ['config'],
    queryFn: () => repos.config.get(),
    // ค่าพวกนี้เปลี่ยนไม่บ่อย แต่ต้องไม่ค้างข้ามวัน แอดมินปิดเงินสดแล้วต้องมีผลโดยไม่ต้องปิดแอป
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });

  const methods = query.data?.paymentMethods;
  useEffect(() => {
    if (methods) setAvailable(methods);
  }, [methods, setAvailable]);

  return query;
}
