import QRCode from 'qrcode';
import { WiFiBill } from '../types';

// Define a compact structure for QR codes to keep them scannable
// We map long keys to short ones to reduce data size
interface QRPayload {
  p: string; // providerName
  c: string; // customerId
  a: number; // amount
  s: string; // status
  m: string; // month
  y: number; // year
  sd?: string; // billingStartDate
  ed?: string; // billingEndDate
  dd?: string; // dueDate
  n?: string; // notes
  u?: string; // userName (customer name)
  ph?: string; // userPhone
}

export const generateBillQRCode = async (bill: WiFiBill): Promise<string> => {
  const payload: QRPayload = {
    p: bill.providerName,
    c: bill.customerId,
    a: bill.amount,
    s: bill.status,
    m: bill.month,
    y: bill.year,
    sd: bill.billingStartDate,
    ed: bill.billingEndDate,
    dd: bill.dueDate,
    n: bill.notes,
    u: bill.userName,
    ph: bill.userPhone
  };

  try {
    // Remove undefined keys to save space
    const cleanPayload = JSON.parse(JSON.stringify(payload));
    const jsonString = JSON.stringify(cleanPayload);
    return await QRCode.toDataURL(jsonString, { margin: 1, width: 200 });
  } catch (err) {
    console.error("QR Generation Error", err);
    return '';
  }
};

export const parseQRPayload = (jsonString: string): Partial<WiFiBill> | null => {
  try {
    const data: QRPayload = JSON.parse(jsonString);
    
    // Basic validation to ensure it's our QR code
    if (!data.p && !data.a) return null;

    return {
      providerName: data.p,
      customerId: data.c,
      amount: data.a,
      status: data.s as any,
      month: data.m,
      year: data.y,
      billingStartDate: data.sd,
      billingEndDate: data.ed,
      dueDate: data.dd,
      notes: data.n,
      userName: data.u,
      userPhone: data.ph
    };
  } catch (e) {
    return null;
  }
};