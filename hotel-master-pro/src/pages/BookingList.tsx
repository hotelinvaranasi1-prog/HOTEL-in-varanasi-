import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Download,
  MoreVertical,
  Wallet,
  Globe,
  Loader2,
  Check,
  PlusCircle,
  Coffee
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Booking, BookingType, PaymentStatus, BookingStatus } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { HOTELS, getHotelByRoom } from '../constants';
import BookingModal from '../components/BookingModal';

export default function BookingList() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<BookingType | 'All'>('All');
  const [filterPayment, setFilterPayment] = useState<PaymentStatus | 'All'>('All');
  const [filterStatus, setFilterStatus] = useState<BookingStatus | 'All'>('All');
  
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [quickPayBooking, setQuickPayBooking] = useState<Booking | null>(null);
  const [miscChargeBooking, setMiscChargeBooking] = useState<Booking | null>(null);
  const [miscAmount, setMiscAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

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

  useEffect(() => {
    fetchBookings();
  }, []);

  const filteredBookings = bookings.filter(b => {
    const matchesSearch = 
      b.room_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.guest_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'All' || b.booking_type === filterType;
    const matchesPayment = filterPayment === 'All' || b.payment_status === filterPayment;
    const matchesStatus = filterStatus === 'All' || b.booking_status === filterStatus;
    
    return matchesSearch && matchesType && matchesPayment && matchesStatus;
  });

  const handleQuickPay = async (id: number, method: 'cash' | 'online', amount: number) => {
    try {
      await fetch(`/api/bookings/${id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, amount }),
      });
      setQuickPayBooking(null);
      fetchBookings();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancel = async (id: number) => {
    if (confirm('Are you sure you want to cancel this booking? This will also make the room available.')) {
      try {
        const res = await fetch(`/api/bookings/${id}/cancel`, { method: 'POST' });
        if (res.ok) {
          fetchBookings();
        } else {
          alert('Failed to cancel booking');
        }
      } catch (err) {
        console.error(err);
        alert('Error cancelling booking');
      }
    }
  };

  const handleAddMisc = async () => {
    if (!miscChargeBooking || !miscAmount || isNaN(Number(miscAmount))) return;
    
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/bookings/${miscChargeBooking.id}/misc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(miscAmount) }),
      });
      
      if (res.ok) {
        setMiscChargeBooking(null);
        setMiscAmount('');
        fetchBookings();
      } else {
        alert('Failed to add miscellaneous charge');
      }
    } catch (err) {
      console.error(err);
      alert('Error adding miscellaneous charge');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Booking Records</h1>
          <p className="text-slate-500">View and manage all guest bookings.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search room or guest..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none w-full md:w-64"
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select 
          value={filterType} 
          onChange={e => setFilterType(e.target.value as any)}
          className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none"
        >
          <option value="All">All Types</option>
          <option value="Walk-in">Walk-in</option>
          <option value="OTA">OTA</option>
        </select>
        <select 
          value={filterPayment} 
          onChange={e => setFilterPayment(e.target.value as any)}
          className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none"
        >
          <option value="All">All Payments</option>
          <option value="Paid">Paid</option>
          <option value="Unpaid">Unpaid</option>
        </select>
        <select 
          value={filterStatus} 
          onChange={e => setFilterStatus(e.target.value as any)}
          className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none"
        >
          <option value="All">All Status</option>
          <option value="Active">Active</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Room</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Guest</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Type</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Total</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Balance</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-medium">
                    No bookings found.
                  </td>
                </tr>
              ) : filteredBookings.map((b, idx) => (
                <tr 
                  key={`booking-${b.id || idx}-${idx}`} 
                  className={cn(
                    "hover:bg-slate-50/50 transition-colors",
                    b.booking_status === 'Cancelled' && "opacity-60 bg-slate-50/30 grayscale"
                  )}
                >
                  <td className="px-6 py-4 text-sm font-medium text-slate-600">{b.date}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-black w-fit">
                        {b.room_number}
                      </span>
                      {getHotelByRoom(b.room_number) && (
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          {getHotelByRoom(b.room_number) === 'KASHI' ? 'Kashi' : 'Varanasi'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-900">{b.guest_name || 'N/A'}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-700">{b.booking_type}</span>
                      {b.ota_source && <span className="text-[10px] text-slate-400 font-bold uppercase">{b.ota_source}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-900">{formatCurrency(b.total_amount)}</td>
                  <td className="px-6 py-4">
                    <span className={cn("text-sm font-bold", b.balance_amount > 0 ? "text-rose-500" : "text-emerald-500")}>
                      {formatCurrency(b.balance_amount)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase w-fit",
                        b.payment_status === 'Paid' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                      )}>
                        {b.payment_status}
                      </span>
                      {b.booking_status === 'Cancelled' && (
                        <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full text-[10px] font-bold uppercase w-fit">
                          Cancelled
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          setEditingBooking(b);
                          setIsModalOpen(true);
                        }}
                        className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {b.balance_amount > 0 && b.booking_status === 'Active' && (
                        <button 
                          onClick={() => setQuickPayBooking(b)}
                          className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors"
                          title="Quick Pay"
                        >
                          <Wallet className="w-4 h-4" />
                        </button>
                      )}
                      {b.booking_status === 'Active' && (
                        <button 
                          onClick={() => setMiscChargeBooking(b)}
                          className="p-2 hover:bg-amber-50 text-amber-600 rounded-lg transition-colors"
                          title="Add Miscellaneous"
                        >
                          <PlusCircle className="w-4 h-4" />
                        </button>
                      )}
                      {b.booking_status === 'Active' && (
                        <button 
                          onClick={() => handleCancel(b.id)}
                          className="p-2 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors"
                          title="Cancel"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <BookingModal 
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingBooking(null);
          fetchBookings();
        }}
        roomNumber={editingBooking?.room_number || ''}
        booking={editingBooking}
      />

      {/* Quick Pay Modal */}
      <AnimatePresence>
        {quickPayBooking && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setQuickPayBooking(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-white rounded-[2rem] shadow-2xl p-8"
            >
              <h3 className="text-xl font-bold text-slate-900 mb-2">Quick Pay</h3>
              <p className="text-slate-500 text-sm mb-6">
                Receive payment for Room {quickPayBooking.room_number}. 
                Balance: <span className="font-bold text-rose-500">{formatCurrency(quickPayBooking.balance_amount)}</span>
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => handleQuickPay(quickPayBooking.id, 'cash', quickPayBooking.balance_amount)}
                  className="w-full flex items-center justify-between p-4 bg-emerald-50 border-2 border-emerald-100 rounded-2xl group hover:border-emerald-500 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-500 p-2 rounded-xl text-white">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-emerald-700">Cash Payment</span>
                  </div>
                  <Check className="w-5 h-5 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>

                <button
                  onClick={() => handleQuickPay(quickPayBooking.id, 'online', quickPayBooking.balance_amount)}
                  className="w-full flex items-center justify-between p-4 bg-blue-50 border-2 border-blue-100 rounded-2xl group hover:border-blue-500 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-500 p-2 rounded-xl text-white">
                      <Globe className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-blue-700">Online Payment</span>
                  </div>
                  <Check className="w-5 h-5 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>

              <button
                onClick={() => setQuickPayBooking(null)}
                className="w-full mt-6 py-3 text-slate-400 font-bold hover:text-slate-600 transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Miscellaneous Modal */}
      <AnimatePresence>
        {miscChargeBooking && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setMiscChargeBooking(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-white rounded-[2rem] shadow-2xl p-8"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-amber-100 p-3 rounded-2xl text-amber-600">
                  <Coffee className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Add Misc Charge</h3>
                  <p className="text-slate-500 text-sm">Room {miscChargeBooking.room_number}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={miscAmount}
                    onChange={e => setMiscAmount(e.target.value)}
                    placeholder="Enter amount..."
                    autoFocus
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none font-bold text-lg"
                  />
                </div>

                <button
                  onClick={handleAddMisc}
                  disabled={isProcessing || !miscAmount}
                  className="w-full py-4 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 text-white rounded-2xl font-bold shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <PlusCircle className="w-5 h-5" />
                      Add Charge
                    </>
                  )}
                </button>

                <button
                  onClick={() => setMiscChargeBooking(null)}
                  className="w-full py-3 text-slate-400 font-bold hover:text-slate-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
