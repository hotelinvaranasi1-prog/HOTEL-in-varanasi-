import React, { useState, useEffect } from 'react';
import { X, Loader2, Save, Calculator } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Booking, BookingType } from '../types';
import { cn } from '../lib/utils';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomNumber: string;
  booking?: Booking | null;
}

export default function BookingModal({ isOpen, onClose, roomNumber, booking }: BookingModalProps) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    room_number: roomNumber,
    guest_name: '',
    booking_type: 'Walk-in' as BookingType,
    ota_source: 'Booking.com',
    room_price: 0,
    misc_charges: 0,
    cash_paid: 0,
    online_paid: 0,
    commission_amount: 0,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (booking) {
      setFormData({
        date: booking.date,
        room_number: booking.room_number,
        guest_name: booking.guest_name,
        booking_type: booking.booking_type,
        ota_source: booking.ota_source || 'Booking.com',
        room_price: booking.room_price,
        misc_charges: booking.misc_charges,
        cash_paid: booking.cash_paid,
        online_paid: booking.online_paid,
        commission_amount: booking.commission_amount,
      });
    } else {
      setFormData(prev => ({ ...prev, room_number: roomNumber }));
    }
  }, [booking, roomNumber, isOpen]);

  const totalAmount = (Number(formData.room_price) || 0) + (Number(formData.misc_charges) || 0);
  const balanceAmount = totalAmount - (Number(formData.cash_paid) || 0) - (Number(formData.online_paid) || 0);

  const handleActualSubmit = async () => {
    setIsLoading(true);
    try {
      const url = booking ? `/api/bookings/${booking.id}` : '/api/bookings';
      const method = booking ? 'PUT' : 'POST';
      
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      setShowConfirm(false);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfirm(true);
  };

  const otaSources = ['Booking.com', 'MakeMyTrip', 'Agoda', 'Expedia', 'Goibibo', 'Others'];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl my-8"
          >
            <form onSubmit={handleSubmit} className="p-8 md:p-10">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-black text-slate-900">
                    {booking ? 'Edit Booking' : 'New Booking'}
                  </h2>
                  <p className="text-slate-500 font-medium">Room {formData.room_number}</p>
                </div>
                <button 
                  type="button"
                  onClick={onClose}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Column: Basic Info */}
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Check-in Date</label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={e => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Guest Name</label>
                    <input
                      type="text"
                      value={formData.guest_name}
                      onChange={e => setFormData({ ...formData, guest_name: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="John Doe"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Booking Type</label>
                    <div className="flex gap-2">
                      {['Walk-in', 'OTA'].map((type, idx) => (
                        <button
                          key={`booking-type-${type}-${idx}`}
                          type="button"
                          onClick={() => setFormData({ ...formData, booking_type: type as BookingType })}
                          className={cn(
                            "flex-1 py-3 rounded-2xl font-bold border-2 transition-all",
                            formData.booking_type === type 
                              ? "bg-indigo-50 border-indigo-600 text-indigo-600"
                              : "bg-slate-50 border-slate-100 text-slate-400"
                          )}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {formData.booking_type === 'OTA' && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                      <label className="block text-sm font-bold text-slate-700 mb-2">OTA Source</label>
                      <select
                        value={formData.ota_source}
                        onChange={e => setFormData({ ...formData, ota_source: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        {otaSources.map((s, idx) => <option key={`ota-source-${s}-${idx}`} value={s}>{s}</option>)}
                      </select>
                    </motion.div>
                  )}
                </div>

                {/* Right Column: Financials */}
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Room Price</label>
                      <input
                        type="number"
                        value={formData.room_price}
                        onChange={e => setFormData({ ...formData, room_price: Number(e.target.value) })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Misc Charges</label>
                      <input
                        type="number"
                        value={formData.misc_charges}
                        onChange={e => setFormData({ ...formData, misc_charges: Number(e.target.value) })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="bg-slate-900 p-6 rounded-3xl text-white">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">Total Amount</span>
                      <span className="text-2xl font-black">₹{totalAmount}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">Balance</span>
                      <span className={cn("text-lg font-bold", balanceAmount > 0 ? "text-rose-400" : "text-emerald-400")}>
                        ₹{balanceAmount}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Cash Paid</label>
                      <input
                        type="number"
                        value={formData.cash_paid}
                        onChange={e => setFormData({ ...formData, cash_paid: Number(e.target.value) })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Online Paid</label>
                      <input
                        type="number"
                        value={formData.online_paid}
                        onChange={e => setFormData({ ...formData, online_paid: Number(e.target.value) })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  {formData.booking_type === 'OTA' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <label className="block text-sm font-bold text-slate-700 mb-2">OTA Commission Amount</label>
                      <input
                        type="number"
                        value={formData.commission_amount}
                        onChange={e => setFormData({ ...formData, commission_amount: Number(e.target.value) })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="Enter amount"
                      />
                    </motion.div>
                  )}
                </div>
              </div>

              <div className="mt-10 flex gap-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-[2] px-6 py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Save Booking</>}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
              onClick={() => setShowConfirm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-[2rem] shadow-2xl p-8 text-center"
            >
              <div className="bg-indigo-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Calculator className="w-8 h-8 text-indigo-600" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">Confirm Booking</h3>
              <p className="text-slate-500 font-medium mb-8">
                Are you sure you want to save this booking for Room <span className="text-indigo-600 font-bold">{formData.room_number}</span>?
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleActualSubmit}
                  disabled={isLoading}
                  className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Yes, Save Booking'}
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={isLoading}
                  className="w-full py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                >
                  No, Go Back
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}
