import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Calendar, 
  Download, 
  TrendingUp, 
  Wallet, 
  Globe, 
  FileSpreadsheet,
  Loader2,
  Send,
  FileText,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Booking } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { HOTELS, getHotelByRoom } from '../constants';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Reports() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reportType, setReportType] = useState<'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'>('daily');
  const [selectedHotel, setSelectedHotel] = useState<'ALL' | 'KASHI' | 'VARANASI'>('ALL');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSending, setIsSending] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const fetchBookings = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/bookings');
        const data = await res.json();
        setBookings(data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchBookings();
  }, []);

  const getFilteredBookings = () => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    return bookings.filter(b => {
      if (b.booking_status === 'Cancelled') return false;
      
      // Hotel Filter
      if (selectedHotel !== 'ALL') {
        const hotel = getHotelByRoom(b.room_number);
        if (hotel !== selectedHotel) return false;
      }
      
      const bDate = new Date(b.date);
      if (reportType === 'daily') {
        return b.date === today;
      } else if (reportType === 'weekly') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        return bDate >= weekAgo;
      } else if (reportType === 'monthly') {
        const monthAgo = new Date();
        monthAgo.setMonth(now.getMonth() - 1);
        return bDate >= monthAgo;
      } else if (reportType === 'yearly') {
        const yearAgo = new Date();
        yearAgo.setFullYear(now.getFullYear() - 1);
        return bDate >= yearAgo;
      } else {
        return b.date >= startDate && b.date <= endDate;
      }
    });
  };

  const filtered = getFilteredBookings();
  
  const stats = {
    totalBookings: filtered.length,
    totalRevenue: filtered.reduce((acc, curr) => acc + curr.total_amount, 0),
    totalCash: filtered.reduce((acc, curr) => acc + curr.cash_paid, 0),
    totalOnline: filtered.reduce((acc, curr) => acc + curr.online_paid, 0),
    totalCommission: filtered.reduce((acc, curr) => acc + curr.commission_amount, 0),
    netIncome: filtered.reduce((acc, curr) => acc + curr.net_income, 0),
  };

  const getFilename = () => {
    const filenameDate = reportType === 'custom' 
      ? `${startDate}_to_${endDate}`
      : new Date().toISOString().split('T')[0];
    const hotelSuffix = selectedHotel !== 'ALL' ? `_${selectedHotel}` : '';
    return `Hotel_Report_${reportType}${hotelSuffix}_${filenameDate}`;
  };

  const generateExcelBlob = () => {
    const data = filtered.map(b => ({
      Date: b.date,
      'Room': b.room_number,
      'Guest': b.guest_name,
      'Type': b.booking_type,
      'Source': b.ota_source || 'N/A',
      'Total': b.total_amount,
      'Cash': b.cash_paid,
      'Online': b.online_paid,
      'Comm': b.commission_amount,
      'Status': b.payment_status
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  };

  const generatePDFBlob = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    const hotelTitle = selectedHotel !== 'ALL' ? ` - ${HOTELS[selectedHotel].name}` : '';
    doc.text(`Hotel Financial Report${hotelTitle}`, 14, 22);
    doc.setFontSize(14);
    doc.text(`Period: ${reportType.toUpperCase()}`, 14, 30);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 38);
    
    // Summary Section
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('Summary', 14, 50);
    doc.setFontSize(10);
    doc.text(`Total Bookings: ${stats.totalBookings}`, 14, 57);
    doc.text(`Total Revenue: Rs. ${stats.totalRevenue}`, 14, 63);
    doc.text(`Net Income: Rs. ${stats.netIncome}`, 14, 69);

    const tableData = filtered.map(b => [
      b.date,
      b.room_number,
      b.guest_name || 'N/A',
      b.booking_type,
      b.total_amount,
      b.cash_paid,
      b.online_paid,
      b.payment_status
    ]);

    autoTable(doc, {
      startY: 80,
      head: [['Date', 'Room', 'Guest', 'Type', 'Total', 'Cash', 'Online', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold' },
    });

    return doc.output('blob');
  };

  const exportToExcel = () => {
    const blob = generateExcelBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${getFilename()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    const blob = generatePDFBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${getFilename()}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sendToTelegram = async (format: 'excel' | 'pdf') => {
    setIsSending(true);
    try {
      const settingsRes = await fetch('/api/settings');
      const settings = await settingsRes.json();

      if (!settings.telegram_bot_token || !settings.telegram_chat_id || settings.telegram_enabled !== 'true') {
        alert("Telegram is not configured or enabled in Settings.");
        return;
      }

      const blob = format === 'excel' ? generateExcelBlob() : generatePDFBlob();
      const filename = `${getFilename()}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      
      const formData = new FormData();
      formData.append('chat_id', settings.telegram_chat_id);
      formData.append('document', blob, filename);
      const hotelName = selectedHotel !== 'ALL' ? `🏨 *${HOTELS[selectedHotel].name}*` : '🏨 *All Hotels*';
      formData.append('caption', `${hotelName}\nType: ${reportType}\nDate: ${new Date().toLocaleDateString()}\nTotal Revenue: ₹${stats.totalRevenue}`);
      formData.append('parse_mode', 'Markdown');

      const res = await fetch(`https://api.telegram.org/bot${settings.telegram_bot_token}/sendDocument`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        const err = await res.json();
        alert(`Failed to send to Telegram: ${err.description || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while sending to Telegram.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Financial Reports</h1>
          <p className="text-slate-500">Analyze your hotel's performance.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-white p-1 rounded-2xl border border-slate-200">
            {(['ALL', 'KASHI', 'VARANASI'] as const).map((hotel) => (
              <button
                key={`hotel-tab-${hotel}`}
                onClick={() => setSelectedHotel(hotel)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all",
                  selectedHotel === hotel 
                    ? "bg-slate-900 text-white shadow-md shadow-slate-100" 
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                {hotel === 'ALL' ? 'All Hotels' : hotel === 'KASHI' ? 'Kashi' : 'Varanasi'}
              </button>
            ))}
          </div>

          <div className="flex bg-white p-1 rounded-2xl border border-slate-200">
            {(['daily', 'weekly', 'monthly', 'yearly', 'custom'] as const).map((type) => (
              <button
                key={`report-tab-${type}`}
                onClick={() => setReportType(type)}
                className={cn(
                  "px-6 py-2 rounded-xl text-sm font-bold capitalize transition-all",
                  reportType === type 
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" 
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                {type}
              </button>
            ))}
          </div>

          {reportType === 'custom' && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-slate-200"
            >
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-sm font-medium border-none focus:ring-2 focus:ring-indigo-500 outline-none text-slate-600"
              />
              <span className="text-slate-400 font-bold text-xs uppercase">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-sm font-medium border-none focus:ring-2 focus:ring-indigo-500 outline-none text-slate-600"
              />
            </motion.div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <ReportCard label="Total Bookings" value={stats.totalBookings} icon={Calendar} color="indigo" />
            <ReportCard label="Total Revenue" value={formatCurrency(stats.totalRevenue)} icon={TrendingUp} color="emerald" />
            <ReportCard label="Cash Collected" value={formatCurrency(stats.totalCash)} icon={Wallet} color="blue" />
            <ReportCard label="Online Collected" value={formatCurrency(stats.totalOnline)} icon={Globe} color="purple" />
            <ReportCard label="OTA Commission" value={formatCurrency(stats.totalCommission)} icon={BarChart3} color="orange" />
            <ReportCard label="Net Income" value={formatCurrency(stats.netIncome)} icon={TrendingUp} color="emerald" highlight />
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="bg-emerald-50 p-4 rounded-2xl">
                  <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Excel Reports</h3>
                  <p className="text-slate-500 text-sm">Download or send the detailed {reportType} Excel report.</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <button 
                  onClick={exportToExcel}
                  className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                >
                  <Download className="w-5 h-5" />
                  Download Excel
                </button>
                <button 
                  onClick={() => sendToTelegram('excel')}
                  disabled={isSending}
                  className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
                >
                  {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  Send to Telegram
                </button>
              </div>
            </div>

            <div className="h-px bg-slate-100" />

            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="bg-rose-50 p-4 rounded-2xl">
                  <FileText className="w-8 h-8 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">PDF Reports</h3>
                  <p className="text-slate-500 text-sm">Download or send the professional {reportType} PDF report.</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <button 
                  onClick={exportToPDF}
                  className="flex items-center justify-center gap-2 bg-rose-600 text-white px-6 py-4 rounded-2xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-100"
                >
                  <Download className="w-5 h-5" />
                  Download PDF
                </button>
                <button 
                  onClick={() => sendToTelegram('pdf')}
                  disabled={isSending}
                  className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
                >
                  {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  Send to Telegram
                </button>
              </div>
            </div>

            <AnimatePresence>
              {showSuccess && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="flex items-center justify-center gap-2 text-emerald-600 font-bold bg-emerald-50 py-3 rounded-2xl"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Report sent to Telegram successfully!
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );
}

function ReportCard({ label, value, icon: Icon, color, highlight }: any) {
  const colors: any = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-purple-50 text-purple-600",
    orange: "bg-orange-50 text-orange-600",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "p-6 rounded-3xl border border-slate-100 shadow-sm",
        highlight ? "bg-slate-900 text-white border-slate-900" : "bg-white"
      )}
    >
      <div className="flex items-center gap-4">
        <div className={cn("p-3 rounded-2xl", colors[color] || "bg-slate-50")}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className={cn("text-xs font-bold uppercase tracking-widest", highlight ? "text-slate-400" : "text-slate-500")}>
            {label}
          </p>
          <p className="text-2xl font-black mt-1">{value}</p>
        </div>
      </div>
    </motion.div>
  );
}
