import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit2, 
  CheckCircle, 
  XCircle, 
  Trash2, 
  Loader2, 
  AlertCircle,
  Clock,
  Wrench,
  Check,
  X,
  PlusCircle,
  Coffee
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Room, RoomStatus, Booking } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { HOTELS, getHotelByRoom } from '../constants';
import BookingModal from '../components/BookingModal';

export default function RoomGrid() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [miscChargeBooking, setMiscChargeBooking] = useState<Booking | null>(null);
  const [miscAmount, setMiscAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [roomsRes, bookingsRes] = await Promise.all([
        fetch('/api/rooms'),
        fetch('/api/bookings')
      ]);
      const roomsData = await roomsRes.json();
      const bookingsData = await bookingsRes.json();
      setRooms(roomsData);
      setBookings(bookingsData);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStatusChange = async (roomNumber: string, newStatus: RoomStatus) => {
    try {
      await fetch(`/api/rooms/${roomNumber}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchData();
      setSelectedRoom(null);
    } catch (err) {
      console.error(err);
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
        fetchData();
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

  const getRoomBooking = (roomNumber: string) => {
    return bookings.find(b => b.room_number === roomNumber && b.booking_status === 'Active');
  };

  const statusConfig = {
    Available: { color: "bg-emerald-500", text: "Available", icon: CheckCircle, light: "bg-emerald-50", border: "border-emerald-200", textColor: "text-emerald-700" },
    Occupied: { color: "bg-rose-500", text: "Occupied", icon: AlertCircle, light: "bg-rose-50", border: "border-rose-200", textColor: "text-rose-700" },
    Cleaning: { color: "bg-amber-500", text: "Cleaning", icon: Clock, light: "bg-amber-50", border: "border-amber-200", textColor: "text-amber-700" },
    Maintenance: { color: "bg-slate-500", text: "Maintenance", icon: Wrench, light: "bg-slate-50", border: "border-slate-200", textColor: "text-slate-700" },
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Room Status Grid</h1>
          <p className="text-slate-500">Real-time overview of all rooms.</p>
        </div>
        <div className="flex gap-2">
          {Object.entries(statusConfig).map(([status, config]) => (
            <div key={`legend-${status}`} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border rounded-full text-xs font-medium text-slate-600">
              <div className={cn("w-2 h-2 rounded-full", config.color)} />
              {status}
            </div>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      ) : (
        <div className="space-y-12">
          {(Object.keys(HOTELS) as Array<keyof typeof HOTELS>).map((hotelKey) => {
            const hotel = HOTELS[hotelKey];
            const hotelRooms = rooms.filter(r => hotel.rooms.includes(r.number));
            
            if (hotelRooms.length === 0) return null;

            return (
              <div key={`hotel-section-${hotelKey}`} className="space-y-6">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">{hotel.name}</h2>
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-xs font-bold text-slate-400 uppercase">{hotelRooms.length} Rooms</span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {hotelRooms.map((room, idx) => {
                    const config = statusConfig[room.status];
                    const booking = getRoomBooking(room.number);
                    
                    return (
                      <motion.button
                        key={`room-${room.id || room.number}-${idx}`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setSelectedRoom(room)}
                        className={cn(
                          "relative p-5 rounded-3xl border-2 transition-all text-left overflow-hidden group",
                          config.light,
                          config.border,
                          selectedRoom?.id === room.id ? "ring-4 ring-indigo-500/20 shadow-lg" : "shadow-sm"
                        )}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <span className={cn("text-2xl font-black tracking-tighter", config.textColor)}>
                            {room.number}
                          </span>
                          <config.icon className={cn("w-5 h-5", config.textColor)} />
                        </div>
                        
                        <div className="space-y-1">
                          <p className={cn("text-xs font-bold uppercase tracking-wider opacity-80", config.textColor)}>
                            {room.status}
                          </p>
                          {booking && (
                            <p className={cn("text-sm font-medium truncate", config.textColor)}>
                              {booking.guest_name || 'Guest'}
                            </p>
                          )}
                        </div>

                        {/* Status Indicator Bar */}
                        <div className={cn("absolute bottom-0 left-0 right-0 h-1.5", config.color)} />
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          
        </div>
      )}

      {/* Room Action Modal */}
      <AnimatePresence>
        {selectedRoom && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setSelectedRoom(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-3xl font-black text-slate-900">Room {selectedRoom.number}</h2>
                    <p className="text-slate-500 font-medium">Manage room status and bookings</p>
                  </div>
                  <button 
                    onClick={() => setSelectedRoom(null)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Status Selection */}
                  <div>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Change Status</p>
                    <div className="grid grid-cols-2 gap-3">
                      {(Object.keys(statusConfig) as RoomStatus[]).map((status) => {
                        const config = statusConfig[status];
                        const isActive = selectedRoom.status === status;
                        return (
                          <button
                            key={`status-btn-${status}`}
                            onClick={() => handleStatusChange(selectedRoom.number, status)}
                            className={cn(
                              "flex items-center gap-3 p-4 rounded-2xl border-2 transition-all font-bold text-sm",
                              isActive 
                                ? cn(config.border, config.light, config.textColor)
                                : "border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200"
                            )}
                          >
                            <div className={cn("w-2.5 h-2.5 rounded-full", config.color)} />
                            {status}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="h-px bg-slate-100" />

                  {/* Actions */}
                  <div className="space-y-3">
                    {selectedRoom.status === 'Available' && (
                      <button
                        onClick={() => {
                          setEditingBooking(null);
                          setIsBookingModalOpen(true);
                        }}
                        className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                      >
                        <Plus className="w-5 h-5" />
                        Add New Booking
                      </button>
                    )}

                    {getRoomBooking(selectedRoom.number) && (
                      <>
                        <button
                          onClick={() => {
                            setEditingBooking(getRoomBooking(selectedRoom.number)!);
                            setIsBookingModalOpen(true);
                          }}
                          className="w-full flex items-center justify-center gap-2 bg-white border-2 border-slate-200 text-slate-700 py-4 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                        >
                          <Edit2 className="w-5 h-5" />
                          Edit Booking
                        </button>
                        <button
                          onClick={() => setMiscChargeBooking(getRoomBooking(selectedRoom.number)!)}
                          className="w-full flex items-center justify-center gap-2 bg-amber-50 text-amber-600 py-4 rounded-2xl font-bold hover:bg-amber-100 transition-all"
                        >
                          <PlusCircle className="w-5 h-5" />
                          Add Misc Charge
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm('Are you sure you want to cancel this booking? This will also make the room available.')) {
                              const res = await fetch(`/api/bookings/${getRoomBooking(selectedRoom.number)!.id}/cancel`, { method: 'POST' });
                              if (res.ok) {
                                fetchData();
                                setSelectedRoom(null);
                              } else {
                                alert('Failed to cancel booking');
                              }
                            }
                          }}
                          className="w-full flex items-center justify-center gap-2 bg-rose-50 text-rose-600 py-4 rounded-2xl font-bold hover:bg-rose-100 transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                          Cancel Booking
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={() => {
          setIsBookingModalOpen(false);
          setSelectedRoom(null);
          fetchData();
        }}
        roomNumber={selectedRoom?.number || ''}
        booking={editingBooking}
      />

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
