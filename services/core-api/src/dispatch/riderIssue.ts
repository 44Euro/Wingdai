/** ปัญหาที่ไรเดอร์แจ้งระหว่างส่ง (design R9) */
export const RIDER_ISSUE_KINDS = [
  'cannot_reach_customer',
  'bad_address',
  'accident',
] as const;

export type RiderIssueKind = (typeof RIDER_ISSUE_KINDS)[number];

/** สถานะที่แจ้งปัญหาได้ */
export const ISSUE_REPORTABLE_STATUSES = ['accepted', 'preparing', 'picked_up'] as const;

export function canReportIssue(status: string): boolean {
  return (ISSUE_REPORTABLE_STATUSES as readonly string[]).includes(status);
}
