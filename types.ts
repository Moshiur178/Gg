
export enum Language {
  ENGLISH = 'EN',
  BANGLA = 'BN'
}

export enum BillStatus {
  PAID = 'Paid',
  DUE = 'Due',
  PENDING = 'Pending'
}

export type UserRole = 'User' | 'Admin';

export interface UserProfile {
  // Unique App User ID
  userId?: string;

  // Company/Business Info (from previous requirement)
  companyName: string;
  companyNumber: string;
  companyAddress: string;
  companyLogo?: string; // Base64 data URL
  
  // User Identity (New requirements)
  userName: string; // Full Name
  userPhone: string; // Mobile Number
  email?: string;
  profilePhoto?: string; // Base64 data URL
  role?: UserRole;
  
  // Address Information
  presentAddress?: string;
}

export interface WiFiBill {
  id: string;
  
  // Billing Cycle
  month: string; // Billing Month
  year: number;
  billingStartDate?: string;
  billingEndDate?: string;
  dueDate?: string;

  providerName: string;
  customerId: string;
  amount: number;
  status: BillStatus;
  paymentMethod?: string;
  paymentDate?: string;
  notes?: string;
  handwrittenImage?: string; // Data URL of canvas or photo
  createdAt: number;

  // Snapshot of profile details at time of creation
  companyName?: string;
  companyNumber?: string;
  companyAddress?: string;
  companyLogo?: string;
  userName?: string;
  userPhone?: string;
  email?: string;
  presentAddress?: string;
  profilePhoto?: string;
}

export const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export const MONTHS_BN = [
  "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
  "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"
];
