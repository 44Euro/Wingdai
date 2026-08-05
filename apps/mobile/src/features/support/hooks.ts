import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repos } from '../../data';
import type { TicketStatus } from '../../data/types';
import type { OpenTicketInput } from '../../data/repositories';

/** ตั๋วของฉัน (design AD4 ฝั่งลูกค้า) */
export function useMyTickets() {
  return useQuery({ queryKey: ['support', 'mine'], queryFn: () => repos.support.mine() });
}

export function useTicketThread(ticketId: string) {
  return useQuery({
    queryKey: ['support', 'thread', ticketId],
    queryFn: () => repos.support.thread(ticketId),
    enabled: ticketId.length > 0,
  });
}

export function useOpenTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: OpenTicketInput) => repos.support.open(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support'] }),
  });
}

export function useReplyToTicket(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => repos.support.reply(ticketId, body),
    // ล้างทั้งก้อน ['support'] เพราะจำนวนข้อความในรายการเปลี่ยนตามด้วย
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support'] }),
  });
}

/** คิวตั๋วฝั่งแอดมิน (design AD4) */
export function useAdminTickets(status?: TicketStatus) {
  return useQuery({
    queryKey: ['admin', 'tickets', status ?? 'all'],
    queryFn: () => repos.admin.tickets(status),
    refetchInterval: 30_000,
  });
}

export function useCloseTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ticketId: string) => repos.admin.closeTicket(ticketId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tickets'] });
      qc.invalidateQueries({ queryKey: ['support'] });
    },
  });
}
