import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { WiFiBill, Language, BillStatus, UserProfile } from "../types";
import { generateBillQRCode } from "./qrService";

export const generateBillPDF = async (bill: WiFiBill, lang: Language, currentProfile?: UserProfile) => {
  // Use bill's stored details, fallback to current profile if bill is old
  const companyName = bill.companyName || currentProfile?.companyName;
  const companyAddress = bill.companyAddress || currentProfile?.companyAddress;
  const companyNumber = bill.companyNumber || currentProfile?.companyNumber;
  const companyLogo = bill.companyLogo || currentProfile?.companyLogo;
  
  const userName = bill.userName || currentProfile?.userName;
  const userPhone = bill.userPhone || currentProfile?.userPhone;
  const userEmail = bill.email || currentProfile?.email;
  const presentAddress = bill.presentAddress || currentProfile?.presentAddress;
  const profilePhoto = bill.profilePhoto || currentProfile?.profilePhoto;

  // Generate QR Code
  const qrCodeDataUrl = await generateBillQRCode(bill);

  // Create a temporary container for the receipt
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.top = '-9999px';
  container.style.left = '-9999px';
  container.style.width = '595px'; // A4 width in px at 72dpi approx
  container.style.minHeight = '842px';
  container.style.backgroundColor = '#ffffff';
  container.style.fontFamily = lang === Language.BANGLA ? "'Noto Serif Bengali', serif" : "'Inter', sans-serif";
  container.style.padding = '40px';
  container.style.boxSizing = 'border-box';

  const t = (en: string, bn: string) => lang === Language.BANGLA ? bn : en;

  // HTML Content
  container.innerHTML = `
    <div style="border: 2px solid #e5e7eb; padding: 30px; border-radius: 12px; position: relative; overflow: hidden;">
      
      <!-- Top Section with QR and Logo -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 1px dashed #e5e7eb; padding-bottom: 20px;">
          <!-- Left: Company Info -->
          <div style="flex: 1;">
            ${companyLogo ? `<img src="${companyLogo}" style="max-height: 50px; margin-bottom: 10px;" />` : ''}
            ${companyName ? `<h2 style="font-size: 22px; font-weight: bold; margin: 0; color: #1f2937;">${companyName}</h2>` : ''}
            ${companyAddress ? `<p style="color: #6b7280; font-size: 12px; margin: 4px 0;">${companyAddress}</p>` : ''}
            ${companyNumber ? `<p style="color: #6b7280; font-size: 12px; margin: 0;">${t('Reg No:', 'রেজি নং:')} ${companyNumber}</p>` : ''}
          </div>

          <!-- Right: QR Code -->
          <div style="text-align: right;">
             <img src="${qrCodeDataUrl}" style="width: 80px; height: 80px;" />
             <p style="font-size: 10px; color: #9ca3af; margin-top: 4px;">${t('Scan for details', 'বিস্তারিত জানতে স্ক্যান করুন')}</p>
          </div>
      </div>

      <!-- Title Section -->
      <div style="text-align: center; margin-bottom: 30px; color: #2563eb;">
        <h1 style="font-size: 32px; font-weight: bold; margin: 0;">${t('WiFi Bill Receipt', 'ওয়াইফাই বিল রসিদ')}</h1>
        <p style="color: #6b7280; margin-top: 5px;">${t('Notebook Record', 'নোটবুক রেকর্ড')}</p>
      </div>
      
      <!-- Date -->
      <div style="display: flex; justify-content: space-between; margin-bottom: 20px; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px;">
        <span style="color: #6b7280;">${t('Date', 'তারিখ')}:</span>
        <span style="font-weight: 500;">${new Date(bill.createdAt).toLocaleDateString()}</span>
      </div>

      <!-- Main Bill Details -->
      <div style="margin-bottom: 30px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <strong style="color: #374151;">${t('Provider', 'প্রোভাইডার')}:</strong>
          <span style="font-weight: bold; font-size: 18px;">${bill.providerName}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <strong style="color: #374151;">${t('Customer ID', 'গ্রাহক আইডি')}:</strong>
          <span>${bill.customerId || '-'}</span>
        </div>
        
        <!-- Billing Cycle Section -->
        <div style="background-color: #f3f4f6; padding: 10px; border-radius: 6px; margin: 15px 0;">
            <div style="font-size: 12px; font-weight: bold; color: #6b7280; margin-bottom: 8px; text-transform: uppercase;">${t('Billing Cycle', 'বিলিং চক্র')}</div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
              <strong style="color: #374151; font-size: 14px;">${t('Billing Month', 'বিলের মাস')}:</strong>
              <span style="font-weight: 600;">${bill.month} ${bill.year}</span>
            </div>
            ${bill.billingStartDate && bill.billingEndDate ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 13px;">
              <span style="color: #4b5563;">${t('Period', 'সময়কাল')}:</span>
              <span>${bill.billingStartDate} ${t('to', 'থেকে')} ${bill.billingEndDate}</span>
            </div>
            ` : ''}
            ${bill.dueDate ? `
            <div style="display: flex; justify-content: space-between; font-size: 13px;">
              <span style="color: #dc2626;">${t('Due Date', 'মেয়াদ')}:</span>
              <span style="color: #dc2626; font-weight: 600;">${bill.dueDate}</span>
            </div>` : ''}
        </div>
      </div>

      <!-- Amount Block -->
      <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 30px; border: 1px solid #e5e7eb;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 16px; font-weight: bold; color: #374151;">${t('Total Amount', 'মোট পরিমাণ')}</span>
          <span style="font-size: 24px; font-weight: bold; color: #000;">৳ ${bill.amount}</span>
        </div>
      </div>

      <!-- Payment Status -->
      <div style="margin-bottom: 30px;">
         <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <strong style="color: #374151;">${t('Status', 'অবস্থা')}:</strong>
          <span style="font-weight: bold; color: ${bill.status === BillStatus.PAID ? '#16a34a' : '#dc2626'}; text-transform: uppercase;">
            ${bill.status}
          </span>
        </div>
        ${bill.paymentMethod ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <strong style="color: #374151;">${t('Payment Method', 'পরিশোধের মাধ্যম')}:</strong>
          <span>${bill.paymentMethod}</span>
        </div>` : ''}
         ${bill.paymentDate ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <strong style="color: #374151;">${t('Payment Date', 'পরিশোধের তারিখ')}:</strong>
          <span>${bill.paymentDate}</span>
        </div>` : ''}
      </div>

      <!-- User Identity Section -->
      ${(userName || userPhone || userEmail || presentAddress) ? `
      <div style="margin-top: 20px; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px; display: flex; gap: 15px; align-items: center;">
        ${profilePhoto ? `
          <div style="width: 60px; height: 60px; border-radius: 50%; overflow: hidden; border: 2px solid #e5e7eb; flex-shrink: 0;">
            <img src="${profilePhoto}" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>
        ` : ''}
        
        <div style="flex-grow: 1;">
            <p style="font-size: 12px; color: #6b7280; margin-bottom: 4px; text-transform: uppercase; font-weight: bold;">${t('User Identity', 'ব্যবহারকারীর পরিচয়')}</p>
            ${userName ? `<div style="font-weight: 600; font-size: 15px; color: #111827;">${userName}</div>` : ''}
            
            <div style="margin-top: 4px; font-size: 13px; color: #4b5563;">
                ${userPhone ? `<div>📞 ${userPhone}</div>` : ''}
                ${userEmail ? `<div>✉️ ${userEmail}</div>` : ''}
            </div>
            
            ${presentAddress ? `
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #f3f4f6; font-size: 13px; color: #4b5563;">
                <span style="font-weight: 500;">📍 ${t('Present Address', 'বর্তমান ঠিকানা')}:</span> ${presentAddress}
            </div>
            ` : ''}
        </div>
      </div>
      ` : ''}

      <!-- Notes -->
      ${bill.notes ? `
      <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 20px;">
        <strong style="display: block; color: #374151; margin-bottom: 5px;">${t('Notes', 'নোট')}:</strong>
        <p style="color: #6b7280; font-style: italic; white-space: pre-wrap;">${bill.notes}</p>
      </div>
      ` : ''}

      <!-- Footer -->
      <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 10px;">
        Generated by WiFi Notebook
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2, // Higher resolution
      backgroundColor: '#ffffff',
      useCORS: true // Important for images
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const imgWidth = 210; // A4 width in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    pdf.save(`Bill_${bill.providerName}_${bill.month}.pdf`);

  } catch (error) {
    console.error("PDF Generation failed", error);
    alert(lang === Language.BANGLA ? "পিডিএফ তৈরি করা যায়নি" : "Could not generate PDF");
  } finally {
    document.body.removeChild(container);
  }
};