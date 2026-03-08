export type RoomStatus = 'Available' | 'Occupied' | 'Cleaning' | 'Maintenance';

export interface Room {
  id: number;
  number: string;
  status: RoomStatus;
}

export type BookingType = 'Walk-in' | 'OTA';
export type PaymentStatus = 'Paid' | 'Unpaid';
export type BookingStatus = 'Active' | 'Cancelled';

export interface Booking {
  id: number;
  date: string;
  room_number: string;
  guest_name: string;
  booking_type: BookingType;
  ota_source?: string;
  room_price: number;
  misc_charges: number;
  total_amount: number;
  cash_paid: number;
  online_paid: number;
  balance_amount: number;
  commission_amount: number;
  gst_amount: number;
  net_income: number;
  payment_status: PaymentStatus;
  booking_status: BookingStatus;
  created_at: string;
}

export interface Summary {
  total_revenue: number;
  total_cash: number;
  total_online: number;
  ota_count: number;
  walkin_count: number;
  pending_payments: number;
}
