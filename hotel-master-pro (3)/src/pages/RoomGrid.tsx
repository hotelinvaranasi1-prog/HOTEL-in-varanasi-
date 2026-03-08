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
  Coffee,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Room, RoomStatus, Booking } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { HOTELS, getHotelByRoom } from '../constants';
import BookingModal from '../components/BookingModal';
import io from 'socket.io-client';

export default function RoomGrid() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [miscChargeBooking, setMiscChargeBooking] = useState<Booking | null>(null);
  const [miscAmount, setMiscAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    setErrorCode(null);
    try {
      const [roomsRes, bookingsRes] = await Promise.all([
        fetch('/api/rooms'),
        fetch('/api/bookings')
      ]);
      
      if (!roomsRes.ok) {
        const errData = await roomsRes.json();
        if (errData.code === 'TABLES_MISSING') {
          setErrorCode('TABLES_MISSING');
        }
        throw new Error(errData.message || errData.error || 'Failed to fetch rooms');
      }
      if (!bookingsRes.ok) {
        const errData = await bookingsRes.json();
        throw new Error(errData.message || errData.error || 'Failed to fetch bookings');
      }

      const roomsData = await roomsRes.json();
      const bookingsData = await bookingsRes.json();
      
      // Deduplicate rooms by number just in case the backend has duplicates
      const uniqueRooms: Room[] = [];
      const seenNumbers = new Set<string>();
      if (Array.isArray(roomsData)) {
        for (const room of roomsData) {
          if (!seenNumbers.has(room.number)) {
            uniqueRooms.push(room);
            seenNumbers.add(room.number);
          }
        }
      }

      setRooms(uniqueRooms);
      setBookings(Array.isArray(bookingsData) ? bookingsData : []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Setup Socket.io
    const socket = io();

    socket.on('room_status_update', (data: { number: string; status: RoomStatus }) => {
      setRooms(prevRooms => 
        prevRooms.map(room => 
          room.number === data.number ? { ...room, status: data.status } : room
        )
      );
    });

    socket.on('booking_update', () => {
      fetchData();
    });

    return () => {
      socket.disconnect();
    };
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
          {rooms.length > 0 && (
            <p className="text-[10px] text-slate-400 mt-1">
              Debug: {rooms.length} rooms loaded. First room: {rooms[0].number} ({typeof rooms[0].number})
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button 
            onClick={fetchData}
            className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all mr-2"
            title="Refresh Data"
          >
            <RefreshCw className={cn("w-5 h-5 text-slate-500", isLoading && "animate-spin")} />
          </button>
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
      ) : error ? (
        <div className="bg-rose-50 p-8 rounded-[2.5rem] border border-rose-100 text-center max-w-2xl mx-auto">
          <div className="bg-rose-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-rose-600" />
          </div>
          <h3 className="text-xl font-bold text-rose-900 mb-2">
            {errorCode === 'TABLES_MISSING' ? 'Database Setup Required' : 'Connection Error'}
          </h3>
          <p className="text-rose-600 mb-6">
            {error}
          </p>
          
          {errorCode === 'TABLES_MISSING' && (
            <div className="bg-white p-6 rounded-2xl border border-rose-200 text-left mb-6 overflow-hidden">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">SQL to run in Supabase Editor:</p>
              <pre className="text-[10px] font-mono bg-slate-50 p-4 rounded-xl overflow-x-auto text-slate-700 whitespace-pre-wrap">
{`CREATE TABLE public.rooms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    number TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'Available',
    last_cleaned TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_number TEXT NOT NULL,
    guest_name TEXT NOT NULL,
    check_in TIMESTAMPTZ,
    check_out TIMESTAMPTZ,
    date DATE,
    booking_type TEXT,
    ota_source TEXT,
    room_price DECIMAL,
    misc_charges DECIMAL,
    total_amount DECIMAL,
    cash_paid DECIMAL,
    online_paid DECIMAL,
    balance_amount DECIMAL,
    commission_amount DECIMAL,
    gst_amount DECIMAL,
    net_income DECIMAL,
    payment_status TEXT,
    booking_status TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Disable RLS for demo
ALTER TABLE public.rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings DISABLE ROW LEVEL SECURITY;`}
              </pre>
              <p className="text-[10px] text-slate-400 mt-3 italic">
                Copy the code above, go to Supabase SQL Editor, paste it, and click "Run". Then refresh this page.
              </p>
            </div>
          )}

          <button 
            onClick={fetchData}
            className="px-6 py-2 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : rooms.length === 0 ? (
        <div className="bg-white p-12 rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
          <div className="bg-slate-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">No Rooms Found</h3>
          <p className="text-slate-500 max-w-sm mx-auto">
            We couldn't find any rooms in the database. Please check if Supabase is configured correctly or try refreshing.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
            <button 
              onClick={fetchData}
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
              Refresh Data
            </button>
            <button 
              onClick={async () => {
                setIsProcessing(true);
                try {
                  const res = await fetch('/api/admin/sync-rooms', { method: 'POST' });
                  if (res.ok) {
                    fetchData();
                  } else {
                    const data = await res.json();
                    alert(`Sync failed: ${data.error || 'Unknown error'}`);
                  }
                } catch (err) {
                  alert('Network error during sync');
                } finally {
                  setIsProcessing(false);
                }
              }}
              disabled={isProcessing}
              className="px-6 py-3 bg-white border-2 border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
              Initialize Default Rooms
            </button>
          </div>
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
                        key={`room-card-${room.id || 'no-id'}-${room.number}-${idx}`}
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
          
          {/* Unassigned Rooms */}
          {(() => {
            const assignedRoomNumbers = new Set(Object.values(HOTELS).flatMap(h => h.rooms));
            const unassignedRooms = rooms.filter(r => !assignedRoomNumbers.has(r.number));
            
            if (unassignedRooms.length === 0) return null;

            return (
              <div key="unassigned-section" className="space-y-6 pt-12 border-t border-dashed border-slate-200">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-black text-slate-400 uppercase tracking-tight">Unassigned Rooms</h2>
                  <div className="h-px flex-1 bg-slate-100" />
                  <span className="text-xs font-bold text-slate-300 uppercase">{unassignedRooms.length} Rooms</span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 opacity-60 grayscale">
                  {unassignedRooms.map((room, idx) => {
                    const config = statusConfig[room.status];
                    return (
                      <motion.button
                        key={`unassigned-room-${room.id || 'no-id'}-${room.number}-${idx}`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setSelectedRoom(room)}
                        className={cn(
                          "relative p-5 rounded-3xl border-2 transition-all text-left overflow-hidden group",
                          config.light,
                          config.border,
                          "shadow-sm"
                        )}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <span className={cn("text-2xl font-black tracking-tighter", config.textColor)}>
                            {room.number}
                          </span>
                          <config.icon className={cn("w-5 h-5", config.textColor)} />
                        </div>
                        <p className={cn("text-xs font-bold uppercase tracking-wider opacity-80", config.textColor)}>
                          {room.status}
                        </p>
                        <div className={cn("absolute bottom-0 left-0 right-0 h-1.5", config.color)} />
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            );
          })()}
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
                          onClick={async () => {
                            if (confirm('Are you sure you want to checkout this room? This will mark the booking as completed and set the room to cleaning status.')) {
                              const res = await fetch(`/api/bookings/${getRoomBooking(selectedRoom.number)!.id}/checkout`, { method: 'POST' });
                              if (res.ok) {
                                fetchData();
                                setSelectedRoom(null);
                              } else {
                                alert('Failed to checkout');
                              }
                            }
                          }}
                          className="w-full flex items-center justify-center gap-2 bg-amber-600 text-white py-4 rounded-2xl font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-100"
                        >
                          <CheckCircle className="w-5 h-5" />
                          Checkout Room
                        </button>
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
