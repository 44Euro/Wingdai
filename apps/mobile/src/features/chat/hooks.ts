import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repos } from '../../data';
import type { ChatChannel } from '../../data/types';

/** เธรดแชท (design C10 M10) */
export function useChatThread(orderId: string, channel: ChatChannel) {
  return useQuery({
    queryKey: ['chat', orderId, channel],
    queryFn: () => repos.chat.thread(orderId, channel),
    enabled: !!orderId,
    refetchInterval: 3_000,
  });
}

export function useSendMessage(orderId: string, channel: ChatChannel) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => repos.chat.send(orderId, channel, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat', orderId, channel] }),
  });
}
