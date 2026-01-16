
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Camera as CameraIcon, Book, Search, Calendar, Wifi, FileText, Loader2, Download, Settings as SettingsIcon, ArrowLeft, User, MapPin, Mail, Phone, Briefcase, Trash2, Save, Share2, Eye, QrCode, X, ChevronDown, Filter, ChevronRight, Copy } from 'lucide-react';
import { BillStatus, Language, WiFiBill, MONTHS_EN, MONTHS_BN, UserProfile } from './types';
import LanguageToggle from './components/LanguageToggle';
import CameraScanner from './components/CameraScanner';
import { generateBillPDF } from './services/pdfService';
import { generateBillQRCode } from './services/qrService';

// Mock storage
const STORAGE_KEY = 'wifi_bills_v1';
const PROFILE_KEY = 'wifi_user_profile_v2';

// Helper to generate a short unique ID
const generateShortId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

export default function App() {
  const [lang, setLang] = useState<Language>(Language.ENGLISH);
  const [bills, setBills] = useState<WiFiBill[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    userId: '',
    companyName: '',
    companyNumber: '',
    companyAddress: '',
    companyLogo: '',
    userName: '',
    userPhone: '',
    email: '',
    role: 'User',
    presentAddress: '',
    profilePhoto: ''
  });
  
  const [view, setView] = useState<'dashboard' | 'add' | 'settings' | 'camera' | 'qrcode' | 'search' | 'customer-detail'>('dashboard');
  const [activeBill, setActiveBill] = useState<Partial<WiFiBill>>({});
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<'all' | 'due' | 'paid'>('all');

  // Load data on mount
  useEffect(() => {
    const savedBills = localStorage.getItem(STORAGE_KEY);
    if (savedBills) {
      setBills(JSON.parse(savedBills));
    }
    const savedProfile = localStorage.getItem(PROFILE_KEY);
    if (savedProfile) {
      const parsed = JSON.parse(savedProfile);
      // Ensure userId exists
      if (!parsed.userId) parsed.userId = generateShortId();
      setUserProfile(prev => ({ ...prev, ...parsed }));
    } else {
       setUserProfile(prev => ({ ...prev, userId: generateShortId() }));
    }
  }, []);

  // Save bills when updated
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bills));
  }, [bills]);

  // Save profile when updated
  useEffect(() => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(userProfile));
  }, [userProfile]);

  const t = (en: string, bn: string) => (lang === Language.BANGLA ? bn : en);

  // Helper to construct a full bill object from partial form data
  const constructBill = (partial: Partial<WiFiBill>): WiFiBill => {
    let billMonth = partial.month;
    let billYear = partial.year;

    // Date Logic
    if (partial.dueDate) {
        const d = new Date(partial.dueDate);
        if (!isNaN(d.getTime())) {
            billMonth = MONTHS_EN[d.getMonth()];
            billYear = d.getFullYear();
        }
    } else if (!partial.id) {
        // New bill default
        const now = new Date();
        billMonth = MONTHS_EN[now.getMonth()];
        billYear = now.getFullYear();
    }
    
    // Fallbacks
    if (!billMonth) billMonth = MONTHS_EN[new Date().getMonth()];
    if (!billYear) billYear = new Date().getFullYear();

    const commonData = {
        month: billMonth,
        year: billYear,
        providerName: partial.providerName || '',
        customerId: partial.customerId || '',
        amount: partial.amount || 0,
        status: partial.status || BillStatus.PENDING,
        paymentMethod: partial.paymentMethod,
        paymentDate: partial.paymentDate,
        dueDate: partial.dueDate,
        billingStartDate: partial.billingStartDate,
        billingEndDate: partial.billingEndDate,
        notes: partial.notes,
        handwrittenImage: partial.handwrittenImage,
        // Include company overrides if they exist in partial
        companyName: partial.companyName,
        companyNumber: partial.companyNumber,
        companyAddress: partial.companyAddress,
    };

    if (partial.id) {
        // Find existing to preserve created date/immutable fields if needed
        const existing = bills.find(b => b.id === partial.id);
        return { ...existing, ...commonData, id: partial.id, createdAt: existing?.createdAt || Date.now() } as WiFiBill;
    } else {
        // Create new bill
        return {
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          ...commonData,
          // Snapshot current profile or use overrides from form
          companyName: commonData.companyName || userProfile.companyName,
          companyNumber: commonData.companyNumber || userProfile.companyNumber,
          companyAddress: commonData.companyAddress || userProfile.companyAddress,
          companyLogo: userProfile.companyLogo,
          userName: userProfile.userName,
          userPhone: userProfile.userPhone,
          email: userProfile.email,
          presentAddress: userProfile.presentAddress,
          profilePhoto: userProfile.profilePhoto,
        } as WiFiBill;
    }
  };

  const saveBillToState = (bill: WiFiBill) => {
      setBills(prev => {
          const exists = prev.some(b => b.id === bill.id);
          if (exists) {
              return prev.map(b => b.id === bill.id ? bill : b);
          }
          return [bill, ...prev];
      });
  };

  const handleSave = (partial: Partial<WiFiBill>) => {
    const bill = constructBill(partial);
    saveBillToState(bill);
    setView('dashboard');
    setActiveBill({});
  };

  const handleSaveAndDownload = async (partial: Partial<WiFiBill>) => {
    setIsSubmitting(true);
    const bill = constructBill(partial);
    saveBillToState(bill);
    await generateBillPDF(bill, lang, userProfile);
    setIsSubmitting(false);
    setView('dashboard');
    setActiveBill({});
  };

  const handleDelete = (id: string) => {
    if (window.confirm(t('Are you sure you want to delete this bill?', 'আপনি কি এই বিলটি মুছে ফেলতে চান?'))) {
      setBills(prev => prev.filter(b => b.id !== id));
      // If we are in detail view, we might want to stay there unless no bills left
      if (view === 'customer-detail') {
          // Check if customer still has bills
           const remaining = bills.filter(b => b.id !== id);
           const customerHasBills = remaining.some(b => b.customerId === selectedCustomerId);
           if (!customerHasBills) setView('search');
      } else {
          setView('dashboard');
          setActiveBill({});
      }
    }
  };

  const handleShare = async (partial: Partial<WiFiBill>) => {
      if (navigator.share) {
          try {
              const name = partial.userName || userProfile.userName || 'N/A';
              const phone = partial.userPhone || userProfile.userPhone;
              
              const shareText = 
`WiFi Bill Receipt
------------------
Provider: ${partial.providerName || 'N/A'}
Amount: ৳${partial.amount || 0}
Status: ${partial.status || 'Pending'}
Month: ${partial.month || ''} ${partial.year || ''}

Customer Info:
Name: ${name}
Customer ID: ${partial.customerId || 'N/A'}
${phone ? `Phone: ${phone}` : ''}

${partial.dueDate ? `Due Date: ${partial.dueDate}` : ''}
${partial.paymentMethod ? `Paid via: ${partial.paymentMethod}` : ''}
${partial.notes ? `\nNotes: ${partial.notes}` : ''}
`;
              
              await navigator.share({
                  title: 'WiFi Bill Record',
                  text: shareText.trim(),
              });
          } catch (error) {
              console.log('Error sharing', error);
          }
      } else {
          alert(t('Sharing is not supported on this browser.', 'এই ব্রাউজারে শেয়ারিং সমর্থিত নয়।'));
      }
  };

  const handleShowQR = async (partial: Partial<WiFiBill>) => {
      const bill = constructBill(partial);
      const url = await generateBillQRCode(bill);
      setQrCodeUrl(url);
      setView('qrcode');
  };

  const handleScanComplete = (extractedData: any, image: string) => {
    if (extractedData) {
      setActiveBill({
        ...activeBill,
        ...extractedData,
        handwrittenImage: extractedData.handwrittenImage || image, 
        status: extractedData.status as BillStatus || BillStatus.PENDING
      });
    } else {
         setActiveBill({
            ...activeBill,
            handwrittenImage: image
        })
    }
    setView('add');
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUserProfile(prev => ({ ...prev, profilePhoto: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUserProfile(prev => ({ ...prev, companyLogo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // --- Search Engine Logic ---
  
  // Aggregate bills into customer profiles
  const customerProfiles = useMemo(() => {
    const profiles: Record<string, {
      customerId: string;
      providerName: string;
      latestName: string;
      latestPhone: string;
      totalBills: number;
      totalDue: number;
      totalPaid: number;
      bills: WiFiBill[];
      lastActive: number;
    }> = {};

    bills.forEach(bill => {
        const id = bill.customerId || 'UNKNOWN';
        if (!profiles[id]) {
            profiles[id] = {
                customerId: id,
                providerName: bill.providerName,
                latestName: bill.userName || '',
                latestPhone: bill.userPhone || '',
                totalBills: 0,
                totalDue: 0,
                totalPaid: 0,
                bills: [],
                lastActive: 0
            };
        }
        
        const p = profiles[id];
        p.bills.push(bill);
        p.totalBills++;
        if (bill.status === BillStatus.PAID) p.totalPaid += (bill.amount || 0);
        else p.totalDue += (bill.amount || 0);
        
        if (bill.createdAt > p.lastActive) {
            p.lastActive = bill.createdAt;
            // Update latest info from most recent bill
            if (bill.userName) p.latestName = bill.userName;
            if (bill.userPhone) p.latestPhone = bill.userPhone;
            if (bill.providerName) p.providerName = bill.providerName;
        }
    });

    return Object.values(profiles).sort((a, b) => b.lastActive - a.lastActive);
  }, [bills]);

  const filteredCustomers = useMemo(() => {
      let result = customerProfiles;
      
      // Text Search
      if (searchQuery) {
          const q = searchQuery.toLowerCase();
          result = result.filter(c => 
             c.customerId.toLowerCase().includes(q) ||
             c.latestName.toLowerCase().includes(q) ||
             c.latestPhone.toLowerCase().includes(q) ||
             c.providerName.toLowerCase().includes(q)
          );
      }

      // Status Filter (Customer has ANY due bill)
      if (searchFilter === 'due') {
          result = result.filter(c => c.totalDue > 0);
      } else if (searchFilter === 'paid') {
           result = result.filter(c => c.totalDue === 0);
      }

      return result;
  }, [customerProfiles, searchQuery, searchFilter]);

  const renderSearch = () => {
      return (
        <div className="space-y-4 animate-in fade-in">
           <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 sticky top-0 z-10">
               <div className="relative mb-3">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                   <input 
                     type="text"
                     placeholder={t('Search by ID, Name, Phone...', 'আইডি, নাম, ফোন নম্বর দিয়ে খুঁজুন...')}
                     className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     autoFocus
                   />
               </div>
               
               <div className="flex gap-2 overflow-x-auto no-scrollbar">
                   <button 
                     onClick={() => setSearchFilter('all')}
                     className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${searchFilter === 'all' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200'}`}
                   >
                       {t('All Users', 'সকল ব্যবহারকারী')}
                   </button>
                   <button 
                     onClick={() => setSearchFilter('due')}
                     className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${searchFilter === 'due' ? 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-600 border-gray-200'}`}
                   >
                       {t('Has Due', 'বাকি আছে')}
                   </button>
                   <button 
                     onClick={() => setSearchFilter('paid')}
                     className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${searchFilter === 'paid' ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-600 border-gray-200'}`}
                   >
                       {t('Fully Paid', 'সম্পূর্ণ পরিশোধিত')}
                   </button>
               </div>
           </div>

           <div className="space-y-3">
               {filteredCustomers.length === 0 ? (
                   <div className="text-center py-10 text-gray-400">
                       <User size={48} className="mx-auto mb-2 opacity-20" />
                       <p>{t('No users found matching your criteria', 'আপনার অনুসন্ধানের সাথে কোনো ব্যবহারকারী পাওয়া যায়নি')}</p>
                   </div>
               ) : (
                   filteredCustomers.map(customer => (
                       <div 
                         key={customer.customerId}
                         onClick={() => {
                             setSelectedCustomerId(customer.customerId);
                             setView('customer-detail');
                         }}
                         className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer flex justify-between items-center group"
                       >
                           <div className="flex items-center gap-3">
                               <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${customer.totalDue > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                   {customer.latestName ? customer.latestName[0].toUpperCase() : <User size={20} />}
                               </div>
                               <div>
                                   <div className="flex items-center gap-2">
                                       <h3 className="font-bold text-gray-800">{customer.latestName || t('Unknown User', 'অজানা ব্যবহারকারী')}</h3>
                                       {customer.totalDue > 0 && <span className="w-2 h-2 rounded-full bg-red-500" />}
                                   </div>
                                   <p className="text-xs text-gray-500 font-mono">ID: {customer.customerId}</p>
                                   <p className="text-xs text-blue-600">{customer.providerName}</p>
                               </div>
                           </div>
                           <div className="text-right">
                               <p className="text-sm font-bold text-gray-900">৳{customer.totalDue > 0 ? customer.totalDue : customer.totalPaid}</p>
                               <p className={`text-xs font-medium ${customer.totalDue > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                   {customer.totalDue > 0 ? t('Due', 'বাকি') : t('Paid', 'পরিশোধিত')}
                               </p>
                           </div>
                           <ChevronRight className="text-gray-300 group-hover:text-gray-500 transition-colors" size={20} />
                       </div>
                   ))
               )}
           </div>
        </div>
      );
  };

  const renderCustomerDetail = () => {
      const customer = customerProfiles.find(c => c.customerId === selectedCustomerId);
      if (!customer) return <div className="p-4 text-center">{t('User not found', 'ব্যবহারকারী পাওয়া যায়নি')}</div>;

      return (
          <div className="animate-in slide-in-from-right duration-300 pb-20">
              {/* Header */}
              <div className="bg-white sticky top-0 z-10 border-b border-gray-200 shadow-sm">
                  <div className="p-4 flex items-center gap-3">
                      <button onClick={() => setView('search')} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
                          <ArrowLeft size={24} className="text-gray-600" />
                      </button>
                      <h2 className="font-bold text-lg">{t('User Profile', 'ব্যবহারকারীর প্রোফাইল')}</h2>
                  </div>
              </div>

              <div className="p-4 space-y-6">
                  {/* Profile Card */}
                  <div className="bg-gradient-to-br from-gray-900 to-gray-800 text-white p-6 rounded-2xl shadow-xl relative overflow-hidden">
                      <div className="flex justify-between items-start z-10 relative">
                          <div className="flex items-center gap-4">
                              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center border-2 border-white/20">
                                  <span className="text-2xl font-bold">{customer.latestName ? customer.latestName[0].toUpperCase() : 'U'}</span>
                              </div>
                              <div>
                                  <h1 className="text-xl font-bold">{customer.latestName || 'Unknown Name'}</h1>
                                  <p className="text-gray-400 font-mono text-sm tracking-wider">{customer.customerId}</p>
                                  <div className="flex items-center gap-2 mt-1 text-xs text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded-full w-fit">
                                      <Wifi size={12} />
                                      {customer.providerName}
                                  </div>
                              </div>
                          </div>
                          <div className="bg-white p-1 rounded-lg">
                              <QrCode className="text-gray-900" size={32} />
                          </div>
                      </div>
                      
                      <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/10 pt-4 z-10 relative">
                          <div>
                              <p className="text-gray-400 text-xs uppercase">{t('Total Due', 'মোট বাকি')}</p>
                              <p className="text-xl font-bold text-red-400">৳ {customer.totalDue}</p>
                          </div>
                          <div>
                              <p className="text-gray-400 text-xs uppercase">{t('Last Paid', 'সর্বশেষ পরিশোধ')}</p>
                              <p className="text-xl font-bold text-green-400">৳ {customer.bills.find(b => b.status === BillStatus.PAID)?.amount || 0}</p>
                          </div>
                      </div>

                      {/* Decorative */}
                      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl -mr-10 -mt-10"></div>
                  </div>

                  {/* Contact Info */}
                  {customer.latestPhone && (
                      <div className="bg-white p-4 rounded-xl border border-gray-200 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                              <div className="bg-green-100 p-2 rounded-full text-green-600">
                                  <Phone size={20} />
                              </div>
                              <div>
                                  <p className="text-xs text-gray-500 uppercase">{t('Mobile', 'মোবাইল')}</p>
                                  <p className="font-medium">{customer.latestPhone}</p>
                              </div>
                          </div>
                          <a href={`tel:${customer.latestPhone}`} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700">
                              {t('Call', 'কল')}
                          </a>
                      </div>
                  )}

                  {/* Bill History */}
                  <div>
                      <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                          <Book size={18} />
                          {t('Bill History', 'বিলের ইতিহাস')}
                      </h3>
                      <div className="space-y-3">
                          {customer.bills.sort((a,b) => b.createdAt - a.createdAt).map(bill => (
                              <div 
                                key={bill.id}
                                onClick={() => {
                                    setActiveBill(bill);
                                    setView('add');
                                }}
                                className="bg-white p-4 rounded-xl border border-gray-200 hover:border-blue-300 transition-colors cursor-pointer"
                              >
                                  <div className="flex justify-between items-start mb-2">
                                      <div>
                                          <p className="font-bold text-gray-800">{bill.month} {bill.year}</p>
                                          <p className="text-xs text-gray-500">{new Date(bill.createdAt).toLocaleDateString()}</p>
                                      </div>
                                      <span className={`px-2 py-1 rounded-md text-xs font-bold ${bill.status === BillStatus.PAID ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                          {bill.status}
                                      </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                      <p className="text-sm font-medium text-gray-600">
                                          {bill.billingStartDate ? `${t('Period', 'সময়')}: ${new Date(bill.billingStartDate).getDate()} - ${new Date(bill.billingEndDate || '').getDate()}` : ''}
                                      </p>
                                      <p className="font-bold text-lg">৳ {bill.amount}</p>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      );
  };

  const renderDashboard = () => {
    const years = Array.from(new Set(bills.map(b => b.year))).sort((a: number, b: number) => b - a);
    if (years.length === 0) years.push(new Date().getFullYear());

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="flex items-center gap-4">
               {userProfile.profilePhoto ? (
                  <img src={userProfile.profilePhoto} alt="Profile" className="w-12 h-12 rounded-full border-2 border-white/50 object-cover" />
               ) : (
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                    <User className="text-white" size={24} />
                  </div>
               )}
               <div>
                 <h2 className="text-xl font-bold font-serif">{userProfile.userName || t('WiFi Notebook', 'ওয়াইফাই নোটবুক')}</h2>
                 <p className="text-blue-200 text-sm font-medium">{userProfile.userPhone || t('Manage your bills', 'আপনার বিল পরিচালনা করুন')}</p>
               </div>
            </div>
            <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                <Wifi className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="flex gap-4 mt-2 relative z-10">
             <div className="bg-black/20 px-4 py-2 rounded-lg flex-1">
                <p className="text-xs text-blue-200 uppercase tracking-wider">{t('Total Paid', 'মোট পরিশোধ')}</p>
                <p className="text-xl font-bold">৳ {bills.filter(b => b.status === BillStatus.PAID).reduce((a,b) => a + (b.amount || 0), 0)}</p>
             </div>
             <div className="bg-black/20 px-4 py-2 rounded-lg flex-1">
                <p className="text-xs text-blue-200 uppercase tracking-wider">{t('Due', 'বাকি')}</p>
                <p className="text-xl font-bold">৳ {bills.filter(b => b.status === BillStatus.DUE).reduce((a,b) => a + (b.amount || 0), 0)}</p>
             </div>
          </div>
          <div className="absolute -right-6 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
        </div>

        <div className="grid grid-cols-2 gap-4">
           <button 
             onClick={() => { 
                 setActiveBill({
                     companyName: userProfile.companyName,
                     companyNumber: userProfile.companyNumber,
                     companyAddress: userProfile.companyAddress
                 }); 
                 setView('add'); 
             }}
             className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
           >
             <div className="bg-green-100 p-3 rounded-full text-green-600">
               <Plus size={24} />
             </div>
             <span className="font-medium text-gray-700">{t('Add New Bill', 'নতুন বিল যোগ করুন')}</span>
           </button>

           <button 
             onClick={() => setView('camera')}
             className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
           >
             <div className="bg-blue-100 p-3 rounded-full text-blue-600">
               <QrCode size={24} />
             </div>
             <span className="font-medium text-gray-700">{t('Scan QR / Bill', 'স্ক্যান QR / বিল')}</span>
           </button>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Book size={20} className="text-gray-500" />
            {t('History', 'ইতিহাস')}
          </h3>

          {bills.length === 0 ? (
            <div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
                <p>{t('No bills recorded yet', 'এখনও কোনো বিল রেকর্ড করা হয়নি')}</p>
            </div>
          ) : (
            years.map(year => (
              <div key={year} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 font-semibold text-gray-600">
                  {t(`${year}`, `${year.toString().replace(/\d/g, d => "০১২৩৪৫৬৭৮৯"[parseInt(d)])}`)}
                </div>
                <div className="divide-y divide-gray-100">
                  {bills.filter(b => b.year === year).map(bill => (
                    <div 
                        key={bill.id} 
                        className="p-4 hover:bg-gray-50 transition-colors flex justify-between items-center group cursor-pointer"
                        onClick={() => {
                            setActiveBill(bill);
                            setView('add');
                        }}
                    >
                      <div className="flex items-start gap-3 flex-1">
                         <div className={`mt-1 w-2 h-2 rounded-full ${bill.status === BillStatus.PAID ? 'bg-green-500' : 'bg-red-500'}`} />
                         <div>
                            <h4 className="font-bold text-gray-800">{bill.providerName || t('Unknown Provider', 'অজানা কোম্পানি')}</h4>
                            <p className="text-sm text-gray-500">
                               {lang === Language.ENGLISH ? bill.month : MONTHS_BN[MONTHS_EN.indexOf(bill.month)]}
                               {bill.billingStartDate ? ` • ${new Date(bill.billingStartDate).getDate()}-${new Date(bill.billingEndDate || '').getDate()}` : ''}
                               <span className="ml-2 font-medium text-gray-900">৳{bill.amount}</span>
                            </p>
                         </div>
                      </div>
                      <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 text-gray-400">
                             {bill.notes && <FileText size={16} className="text-yellow-500" />}
                             {bill.handwrittenImage && <CameraIcon size={16} className="text-blue-400" />}
                          </div>
                          
                          <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                generateBillPDF(bill, lang, userProfile);
                            }}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                            title={t('Download PDF', 'পিডিএফ ডাউনলোড')}
                          >
                             <Download size={18} />
                          </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderSettings = () => {
    return (
       <div className="bg-white min-h-[80vh] rounded-t-3xl shadow-2xl p-6 mt-4 animate-in slide-in-from-bottom-10">
          <div className="flex justify-between items-center mb-6">
             <div className="flex items-center gap-3">
               <button onClick={() => setView('dashboard')} className="text-gray-500 hover:bg-gray-100 p-2 rounded-full">
                 <ArrowLeft size={24} />
               </button>
               <h2 className="text-xl font-bold">{t('Profile & Settings', 'প্রোফাইল ও সেটিংস')}</h2>
             </div>
          </div>
          
          <div className="space-y-8">
             <section className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <div className="flex justify-between items-center mb-2">
                      <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider">{t('My User ID', 'আমার ইউজার আইডি')}</h3>
                      <button 
                        onClick={() => {
                            if (userProfile.userId) {
                                navigator.clipboard.writeText(userProfile.userId);
                                alert(t('Copied ID!', 'আইডি কপি হয়েছে!'));
                            }
                        }}
                        className="text-blue-500 p-1 hover:bg-blue-100 rounded"
                      >
                          <Copy size={16} />
                      </button>
                  </div>
                  <div className="flex items-center gap-3">
                     <div className="text-2xl font-mono font-bold text-gray-800">{userProfile.userId || '...'}</div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                      {t('Share this ID with support if needed.', 'প্রয়োজন হলে এই আইডি সাপোর্টে শেয়ার করুন।')}
                  </p>
             </section>

             <section className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-2 text-blue-600">
                  <User size={20} />
                  <h3 className="font-bold">{t('User Identity', 'ব্যবহারকারীর পরিচয়')}</h3>
                </div>
                
                <div className="flex items-center gap-4">
                   <div className="relative w-20 h-20 bg-gray-100 rounded-full overflow-hidden border-2 border-gray-200">
                      {userProfile.profilePhoto ? (
                        <img src={userProfile.profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <User size={32} />
                        </div>
                      )}
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                   </div>
                   <div className="flex-1">
                      <p className="font-medium text-sm text-gray-700">{t('Profile Photo', 'প্রোফাইল ছবি')}</p>
                      <p className="text-xs text-gray-500">{t('Tap to upload', 'আপলোড করতে ট্যাপ করুন')}</p>
                   </div>
                </div>

                <div className="grid gap-4">
                   <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase">{t('Full Name', 'পুরো নাম')}</label>
                      <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg">
                        <User size={16} className="text-gray-400" />
                        <input 
                          type="text"
                          className="w-full bg-transparent border-none focus:outline-none"
                          placeholder="John Doe"
                          value={userProfile.userName}
                          onChange={(e) => setUserProfile({...userProfile, userName: e.target.value})}
                        />
                      </div>
                   </div>

                   <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase">{t('Mobile Number', 'মোবাইল নম্বর')}</label>
                      <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg">
                        <Phone size={16} className="text-gray-400" />
                        <input 
                          type="tel"
                          className="w-full bg-transparent border-none focus:outline-none"
                          placeholder="017..."
                          value={userProfile.userPhone}
                          onChange={(e) => setUserProfile({...userProfile, userPhone: e.target.value})}
                        />
                      </div>
                   </div>

                   <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase">{t('Email Address', 'ইমেইল ঠিকানা')}</label>
                      <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg">
                        <Mail size={16} className="text-gray-400" />
                        <input 
                          type="email"
                          className="w-full bg-transparent border-none focus:outline-none"
                          placeholder="example@mail.com"
                          value={userProfile.email}
                          onChange={(e) => setUserProfile({...userProfile, email: e.target.value})}
                        />
                      </div>
                   </div>

                   <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase">{t('User Role', 'ভূমিকা')}</label>
                      <select
                        className="w-full p-3 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-blue-500"
                        value={userProfile.role}
                        onChange={(e) => setUserProfile({...userProfile, role: e.target.value as any})}
                      >
                         <option value="User">User</option>
                         <option value="Admin">Admin</option>
                      </select>
                   </div>
                </div>
             </section>

             <section className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-2 text-blue-600">
                  <MapPin size={20} />
                  <h3 className="font-bold">{t('Address Information', 'ঠিকানা তথ্য')}</h3>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase">{t('Present Address', 'বর্তমান ঠিকানা')}</label>
                  <textarea 
                    className="w-full p-3 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                    placeholder="House, Road, Area..."
                    value={userProfile.presentAddress}
                    onChange={(e) => setUserProfile({...userProfile, presentAddress: e.target.value})}
                  />
                </div>
             </section>

             <section className="space-y-4">
               <div className="flex items-center gap-2 border-b pb-2 text-blue-600">
                  <Briefcase size={20} />
                  <h3 className="font-bold">{t('Company Details', 'কোম্পানির তথ্য')}</h3>
               </div>
               
               <div className="flex items-center gap-4 bg-gray-50 p-3 rounded-lg border border-dashed border-gray-300">
                   <div className="relative w-16 h-16 bg-white rounded-lg overflow-hidden border border-gray-200 flex items-center justify-center">
                      {userProfile.companyLogo ? (
                        <img src={userProfile.companyLogo} alt="Logo" className="w-full h-full object-contain" />
                      ) : (
                        <Briefcase size={24} className="text-gray-300" />
                      )}
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                   </div>
                   <div className="flex-1">
                      <p className="font-medium text-sm text-gray-700">{t('Company Logo', 'কোম্পানির লোগো')}</p>
                      <p className="text-xs text-gray-500">{t('Tap to upload logo', 'লোগো আপলোড করতে ট্যাপ করুন')}</p>
                   </div>
                   {userProfile.companyLogo && (
                       <button onClick={() => setUserProfile(p => ({...p, companyLogo: ''}))} className="text-red-500 p-2">
                           <Trash2 size={16} />
                       </button>
                   )}
               </div>

               <p className="text-xs text-gray-500 italic mb-2">
                 {t('Optional: If you are issuing bills as a business.', 'ঐচ্ছিক: যদি আপনি ব্যবসা হিসেবে বিল প্রদান করেন।')}
               </p>
               <div className="space-y-4">
                   <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase">{t('Company Name', 'কোম্পানির নাম')}</label>
                      <input 
                        type="text"
                        className="w-full p-3 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-blue-500"
                        placeholder="My ISP"
                        value={userProfile.companyName}
                        onChange={(e) => setUserProfile({...userProfile, companyName: e.target.value})}
                      />
                   </div>
                   <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase">{t('Company Number', 'কোম্পানি নাম্বার')}</label>
                      <input 
                        type="text"
                        className="w-full p-3 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-blue-500"
                        placeholder="REG-123"
                        value={userProfile.companyNumber}
                        onChange={(e) => setUserProfile({...userProfile, companyNumber: e.target.value})}
                      />
                   </div>
                   <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase">{t('Company Address', 'কোম্পানির ঠিকানা')}</label>
                      <textarea 
                        className="w-full p-3 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-blue-500 min-h-[60px]"
                        value={userProfile.companyAddress}
                        onChange={(e) => setUserProfile({...userProfile, companyAddress: e.target.value})}
                      />
                   </div>
               </div>
             </section>

             <button 
                onClick={() => setView('dashboard')}
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-blue-700 active:scale-95 transition-all"
             >
                {t('Save Profile', 'প্রোফাইল সংরক্ষণ করুন')}
             </button>
          </div>
       </div>
    );
  };

  const renderAddBill = () => {
    return (
      <div className="bg-white min-h-[80vh] rounded-t-3xl shadow-2xl p-6 mt-4 animate-in slide-in-from-bottom-10 flex flex-col">
        <div className="flex justify-between items-center mb-6">
           <h2 className="text-xl font-bold">
               {activeBill.id ? t('Edit Bill', 'বিল সম্পাদন করুন') : t('New Bill Entry', 'নতুন বিল এন্ট্রি')}
           </h2>
           <div className="flex gap-2">
               <button 
                 onClick={() => handleShowQR(activeBill)}
                 className="p-2 text-gray-500 hover:bg-blue-50 hover:text-blue-600 rounded-full transition-colors"
                 title="Show QR"
               >
                 <QrCode size={20} />
               </button>
               <button 
                 onClick={() => handleShare(activeBill)}
                 className="p-2 text-gray-500 hover:bg-blue-50 hover:text-blue-600 rounded-full transition-colors"
                 title="Share"
               >
                 <Share2 size={20} />
               </button>
               <button onClick={() => setView('dashboard')} className="text-gray-500 bg-gray-100 p-2 rounded-full hover:bg-gray-200">
                 <Plus className="rotate-45" size={24} />
               </button>
           </div>
        </div>

        <div className="space-y-4 flex-1">
           <div className="mb-6">
              <button 
                onClick={() => setView('camera')}
                className="w-full bg-blue-50 border border-blue-200 p-3 rounded-lg flex items-center justify-center gap-2 text-blue-700 font-medium hover:bg-blue-100 transition-colors"
              >
                 <CameraIcon size={20} />
                 {t('Scan Bill or QR Code', 'স্ক্যান বিল বা QR কোড')}
              </button>
           </div>

           {activeBill.handwrittenImage && (
             <div className="mb-4 relative group">
                <p className="text-sm text-gray-500 mb-1">{t('Attached Note/Image:', 'সংযুক্ত নোট/ছবি:')}</p>
                <div className="h-32 w-full bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                    <img src={activeBill.handwrittenImage} className="w-full h-full object-contain" alt="Attached" />
                </div>
                <button 
                  onClick={() => setActiveBill(prev => ({ ...prev, handwrittenImage: undefined }))}
                  className="absolute top-8 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    <Plus className="rotate-45" size={16} />
                </button>
             </div>
           )}
           
           <div className="bg-gray-50 p-4 rounded-xl space-y-3">
              <h3 className="font-bold text-gray-700 flex items-center gap-2">
                 <Calendar size={16} /> {t('Billing Cycle', 'বিলিং চক্র')}
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase">{t('Start Date', 'শুরুর তারিখ')}</label>
                      <input 
                        type="date"
                        className="w-full p-2 bg-white rounded-lg border border-gray-200"
                        value={activeBill.billingStartDate || ''}
                        onChange={(e) => setActiveBill({...activeBill, billingStartDate: e.target.value})}
                      />
                  </div>
                  <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase">{t('End Date', 'শেষ তারিখ')}</label>
                      <input 
                        type="date"
                        className="w-full p-2 bg-white rounded-lg border border-gray-200"
                        value={activeBill.billingEndDate || ''}
                        onChange={(e) => setActiveBill({...activeBill, billingEndDate: e.target.value})}
                      />
                  </div>
              </div>

               <div className="space-y-1">
                  <label className="text-xs font-semibold text-red-500 uppercase">{t('Due Date / Expiration', 'মেয়াদ শেষ হওয়ার তারিখ')}</label>
                  <input 
                    type="date"
                    className="w-full p-2 bg-red-50 rounded-lg border border-red-100"
                    value={activeBill.dueDate || ''}
                    onChange={(e) => setActiveBill({...activeBill, dueDate: e.target.value})}
                  />
               </div>
           </div>

           <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase">{t('Provider Name', 'আইএসপি / প্রোভাইডার')}</label>
              <input 
                type="text" 
                placeholder={t('e.g. Amber IT', 'যেমন: আম্বার আইটি')}
                className="w-full p-3 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-blue-500"
                value={activeBill.providerName || ''}
                onChange={(e) => setActiveBill({...activeBill, providerName: e.target.value})}
              />
           </div>

           <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase">{t('Customer ID', 'গ্রাহক আইডি')}</label>
              <input 
                type="text" 
                className="w-full p-3 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-blue-500"
                value={activeBill.customerId || ''}
                onChange={(e) => setActiveBill({...activeBill, customerId: e.target.value})}
              />
           </div>

           <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase">{t('Amount (Tk)', 'পরিমাণ (টাকা)')}</label>
                  <input 
                    type="number" 
                    className="w-full p-3 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-blue-500 font-mono text-lg"
                    value={activeBill.amount || ''}
                    onChange={(e) => setActiveBill({...activeBill, amount: parseFloat(e.target.value)})}
                  />
               </div>
               <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase">{t('Status', 'অবস্থা')}</label>
                  <select 
                     className={`w-full p-3 rounded-lg border-none focus:ring-2 focus:ring-blue-500 font-medium ${
                         activeBill.status === BillStatus.PAID ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                     }`}
                     value={activeBill.status || BillStatus.PENDING}
                     onChange={(e) => setActiveBill({...activeBill, status: e.target.value as BillStatus})}
                  >
                     <option value={BillStatus.PAID}>{t('PAID', 'পরিশোধিত')}</option>
                     <option value={BillStatus.DUE}>{t('DUE', 'বাকি')}</option>
                     <option value={BillStatus.PENDING}>{t('PENDING', 'অপেক্ষমান')}</option>
                  </select>
               </div>
           </div>

           <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                   <label className="text-xs font-semibold text-gray-500 uppercase">{t('Payment Method', 'পরিশোধের মাধ্যম')}</label>
                   <select
                        className="w-full p-3 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-blue-500"
                        value={activeBill.paymentMethod || ''}
                        onChange={(e) => setActiveBill({...activeBill, paymentMethod: e.target.value})}
                   >
                       <option value="">{t('Select...', 'বাছাই করুন...')}</option>
                       <option value="bKash">bKash</option>
                       <option value="Nagad">Nagad</option>
                       <option value="Rocket">Rocket</option>
                       <option value="Cash">Cash (নগদ)</option>
                       <option value="Bank">Bank Transfer</option>
                       <option value="Card">Card</option>
                   </select>
               </div>
               <div className="space-y-1">
                   <label className="text-xs font-semibold text-gray-500 uppercase">{t('Payment Date', 'পরিশোধের তারিখ')}</label>
                   <input 
                        type="date"
                        className="w-full p-3 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-blue-500"
                        value={activeBill.paymentDate || ''}
                        onChange={(e) => setActiveBill({...activeBill, paymentDate: e.target.value})}
                   />
               </div>
           </div>

           <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-gray-500 uppercase">{t('Notes', 'নোট')}</label>
              </div>
              <textarea 
                placeholder={t('Add notes...', 'নোট যুক্ত করুন...')}
                className="w-full p-3 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                value={activeBill.notes || ''}
                onChange={(e) => setActiveBill({...activeBill, notes: e.target.value})}
              />
           </div>

           <details className="bg-white border border-gray-200 rounded-xl overflow-hidden group">
               <summary className="p-4 font-bold text-gray-700 cursor-pointer flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition-colors">
                   <span className="flex items-center gap-2"><Briefcase size={16}/> {t('Receipt Header / Company Info', 'রসিদ হেডার / কোম্পানির তথ্য')}</span>
                   <ChevronDown className="group-open:rotate-180 transition-transform text-gray-400" size={16} />
               </summary>
               <div className="p-4 space-y-3 bg-white border-t border-gray-100">
                   <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase">{t('Company Name', 'কোম্পানির নাম')}</label>
                      <input 
                        type="text"
                        className="w-full p-2 bg-gray-50 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500"
                        value={activeBill.companyName || ''}
                        onChange={(e) => setActiveBill({...activeBill, companyName: e.target.value})}
                      />
                   </div>
                   <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase">{t('Company Number', 'কোম্পানি নাম্বার')}</label>
                      <input 
                        type="text"
                        className="w-full p-2 bg-gray-50 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500"
                        value={activeBill.companyNumber || ''}
                        onChange={(e) => setActiveBill({...activeBill, companyNumber: e.target.value})}
                      />
                   </div>
                   <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase">{t('Company Address', 'কোম্পানির ঠিকানা')}</label>
                      <textarea 
                        className="w-full p-2 bg-gray-50 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 min-h-[60px]"
                        value={activeBill.companyAddress || ''}
                        onChange={(e) => setActiveBill({...activeBill, companyAddress: e.target.value})}
                      />
                   </div>
                   
                   <div className="flex justify-between items-center mt-2">
                       <p className="text-xs text-gray-400 italic">
                          {t('These details will appear on the top of the PDF receipt.', 'এই তথ্যগুলো পিডিএফ রসিদের উপরে প্রদর্শিত হবে।')}
                       </p>
                       <button
                          onClick={() => {
                            setUserProfile(prev => ({
                              ...prev,
                              companyName: activeBill.companyName || prev.companyName,
                              companyNumber: activeBill.companyNumber || prev.companyNumber,
                              companyAddress: activeBill.companyAddress || prev.companyAddress
                            }));
                            alert(t('Company details saved as default!', 'কোম্পানির তথ্য ডিফল্ট হিসেবে সংরক্ষিত হয়েছে!'));
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 border border-blue-200 px-2 py-1 rounded bg-blue-50"
                        >
                          <Save size={14} />
                          {t('Save as Default', 'ডিফল্ট হিসেবে সংরক্ষণ করুন')}
                        </button>
                   </div>
               </div>
           </details>

           <div className="mt-8 pt-4 border-t border-gray-100 flex flex-col gap-3 pb-6">
                
                <button 
                    onClick={() => handleSaveAndDownload(activeBill)}
                    disabled={isSubmitting}
                    className="w-full bg-green-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-green-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                    {isSubmitting ? <Loader2 className="animate-spin" /> : <Download size={22} />}
                    {activeBill.id ? t('Update & Download PDF', 'আপডেট ও পিডিএফ ডাউনলোড') : t('Save & Download PDF', 'সেভ ও পিডিএফ ডাউনলোড')}
                </button>

                <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={() => handleSave(activeBill)}
                        className="flex items-center justify-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-xl font-bold hover:bg-blue-100 transition-colors"
                    >
                        <Save size={20} />
                        {activeBill.id ? t('Update', 'আপডেট') : t('Save Only', 'শুধুমাত্র সেভ')}
                    </button>

                    {activeBill.id ? (
                        <button 
                            onClick={() => handleDelete(activeBill.id!)}
                            className="flex items-center justify-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-colors"
                        >
                            <Trash2 size={20} />
                            {t('Delete', 'মুছুন')}
                        </button>
                    ) : (
                         <button 
                            onClick={() => setView('dashboard')}
                            className="flex items-center justify-center gap-2 p-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                        >
                            <ArrowLeft size={20} />
                            {t('Cancel', 'বাতিল')}
                        </button>
                    )}
                </div>
           </div>
        </div>
      </div>
    );
  };

  const renderQRCodeView = () => (
      <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-6 animate-in fade-in">
          <button 
            onClick={() => setView('add')}
            className="absolute top-6 right-6 text-white p-2 bg-white/20 rounded-full"
          >
              <X size={24} />
          </button>
          <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm w-full">
              <h2 className="text-2xl font-bold mb-4 text-center">{t('Bill QR Code', 'বিলের QR কোড')}</h2>
              {qrCodeUrl && <img src={qrCodeUrl} alt="Bill QR" className="w-64 h-64 mb-4" />}
              <p className="text-center text-gray-500 text-sm">
                  {t('Scan this code with another WiFi Notebook app to instantly import these bill details.', 'এই বিলের তথ্য ইমপোর্ট করতে অন্য ওয়াইফাই নোটবুক অ্যাপ দিয়ে এই কোডটি স্ক্যান করুন।')}
              </p>
          </div>
      </div>
  );

  return (
    <div className={`min-h-screen bg-gray-100 font-sans ${lang === Language.BANGLA ? 'font-bengali' : ''}`}>
      <nav className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-md mx-auto px-4 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('dashboard')}>
             <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">W</div>
             <h1 className="font-bold text-lg text-gray-800">WiFi Notebook</h1>
          </div>
          <div className="flex items-center gap-3">
             <LanguageToggle currentLang={lang} onToggle={setLang} />
             <button 
               onClick={() => setView('settings')}
               className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
               title={t('Settings', 'সেটিংস')}
             >
                <SettingsIcon size={20} />
             </button>
          </div>
        </div>
      </nav>

      <main className="max-w-md mx-auto p-4 pb-20">
        {view === 'dashboard' && renderDashboard()}
        {view === 'add' && renderAddBill()}
        {view === 'settings' && renderSettings()}
        {view === 'search' && renderSearch()}
        {view === 'customer-detail' && renderCustomerDetail()}
      </main>

      {view === 'camera' && (
        <CameraScanner 
          onScanComplete={handleScanComplete} 
          onClose={() => setView(activeBill.providerName ? 'add' : 'dashboard')} 
          lang={lang}
        />
      )}

      {view === 'qrcode' && renderQRCodeView()}

      {/* Bottom Navigation */}
      {(view === 'dashboard' || view === 'search' || view === 'customer-detail') && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 z-20">
             <div className="max-w-md mx-auto flex justify-around text-gray-400">
                <button 
                  onClick={() => setView('dashboard')}
                  className={`flex flex-col items-center gap-1 ${view === 'dashboard' ? 'text-blue-600' : 'hover:text-gray-600'}`}
                >
                   <Book size={20} />
                   <span className="text-xs font-medium">{t('Notebook', 'নোটবুক')}</span>
                </button>
                 <button 
                   onClick={() => setView('search')}
                   className={`flex flex-col items-center gap-1 ${view === 'search' || view === 'customer-detail' ? 'text-blue-600' : 'hover:text-gray-600'}`}
                 >
                   <Search size={20} />
                   <span className="text-xs font-medium">{t('Search', 'খুঁজুন')}</span>
                </button>
                 <button className="flex flex-col items-center gap-1 hover:text-gray-600 opacity-50 cursor-not-allowed">
                   <Calendar size={20} />
                   <span className="text-xs font-medium">{t('Stats', 'পরিসংখ্যান')}</span>
                </button>
             </div>
          </div>
      )}
    </div>
  );
};
