export type AccountType = 'user' | 'rider' | 'admin';
export type Capability = 'customer' | 'merchant' | 'rider' | 'admin';
export type RiderApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Account {
  id: string;
  accountType: AccountType;
  username: string;
  fullName: string;
  phone: string;
  /** มีค่าเฉพาะเมื่อ accountType === 'rider' */
  riderApproval?: RiderApprovalStatus;
  ownedRestaurantIds: string[];
}

export interface Restaurant {
  id: string;
  ownerUserId: string;
  name: string;
  isApproved: boolean;
  isOpen: boolean;
}
