import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Wallet, 
  Globe, 
  User, 
  Clock, 
  AlertCircle,
  RefreshCw,
  Hotel as HotelIcon
} from 'lucide-react';
import { motion } from 'motion/react';
import { Summary } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { HOTELS, getHotelByRoom } from '../constants';

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [hotelBookings, setHotelBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [summaryRes, hotelRes] = await Promise.all([
        fetch('/api/reports/summary'),
        fetch('/api/reports/summary/hotels')
      ]);
      const summaryData = await summaryRes.json();
      const hotelData = await hotelRes.json();
      setSummary(summaryData);
      setHotelBookings(Array.isArray(hotelData) ? hotelData : []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getHotelStats = (hotelKey: keyof typeof HOTELS) => {
    const filtered = hotelBookings.filter(b => getHotelByRoom(b.room_number) === hotelKey);
    return {
      revenue: filtered.reduce((acc, curr) => acc + curr.total_amount, 0),
      cash: filtered.reduce((acc, curr) => acc + curr.cash_paid, 0),
      online: filtered.reduce((acc, curr) => acc + curr.online_paid, 0),
      count: filtered.length
    };
  };

  const stats = [
    { 
      label: "Today's Revenue", 
      value: formatCurrency(summary?.total_revenue || 0), 
      icon: TrendingUp, 
      color: "text-emerald-600", 
      bg: "bg-emerald-50" 
    },
    { 
      label: "Cash Payments", 
      value: formatCurrency(summary?.total_cash || 0), 
      icon: Wallet, 
      color: "text-blue-600", 
      bg: "bg-blue-50" 
    },
    { 
      label: "Online Payments", 
      value: formatCurrency(summary?.total_online || 0), 
      icon: Globe, 
      color: "text-purple-600", 
      bg: "bg-purple-50" 
    },
    { 
      label: "OTA Bookings", 
      value: summary?.ota_count || 0, 
      icon: Globe, 
      color: "text-orange-600", 
      bg: "bg-orange-50" 
    },
    { 
      label: "Walk-in Bookings", 
      value: summary?.walkin_count || 0, 
      icon: User, 
      color: "text-indigo-600", 
      bg: "bg-indigo-50" 
    },
    { 
      label: "Pending Payments", 
      value: formatCurrency(summary?.pending_payments || 0), 
      icon: AlertCircle, 
      color: "text-red-600", 
      bg: "bg-red-50" 
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500">Welcome back, here's what's happening today.</p>
        </div>
        <button 
          onClick={fetchData}
          className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all"
        >
          <RefreshCw className={cn("w-5 h-5 text-slate-500", isLoading && "animate-spin")} />
        </button>
      </div>

      {/* Hotel Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(Object.keys(HOTELS) as Array<keyof typeof HOTELS>).map((hotelKey) => {
          const hotel = HOTELS[hotelKey];
          const hotelStats = getHotelStats(hotelKey);
          return (
            <motion.div
              key={`hotel-summary-${hotelKey}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden relative"
            >
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-slate-900 p-2 rounded-xl text-white">
                    <HotelIcon className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">{hotel.name}</h2>
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Revenue</p>
                    <p className="text-2xl font-black text-slate-900">{formatCurrency(hotelStats.revenue)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Bookings</p>
                    <p className="text-2xl font-black text-slate-900">{hotelStats.count}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Cash</p>
                    <p className="text-lg font-bold text-emerald-600">{formatCurrency(hotelStats.cash)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Online</p>
                    <p className="text-lg font-bold text-purple-600">{formatCurrency(hotelStats.online)}</p>
                  </div>
                </div>
              </div>
              <HotelIcon className="absolute -right-8 -bottom-8 w-48 h-48 text-slate-50 opacity-[0.03] rotate-12" />
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat, idx) => (
          <motion.div
            key={`stat-${stat.label}-${idx}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-4">
              <div className={cn("p-3 rounded-2xl", stat.bg)}>
                <stat.icon className={cn("w-6 h-6", stat.color)} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions or Recent Activity could go here */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-6">Recent Activity</h2>
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="bg-emerald-100 p-2 rounded-full">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">New booking for Room 105</p>
                <p className="text-xs text-slate-500">2 minutes ago • Walk-in</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="bg-blue-100 p-2 rounded-full">
                <Wallet className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">Payment received for Room 201</p>
                <p className="text-xs text-slate-500">15 minutes ago • ₹2,500 Cash</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-indigo-600 p-8 rounded-3xl shadow-lg shadow-indigo-200 text-white relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-xl font-bold mb-2">Staff Tip</h2>
            <p className="text-indigo-100 text-sm leading-relaxed">
              Remember to mark rooms as "Cleaning" immediately after checkout to keep the inventory up to date for new guests.
            </p>
            <button className="mt-6 bg-white text-indigo-600 px-6 py-2 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-colors">
              View Room Grid
            </button>
          </div>
          <HotelIcon className="absolute -right-8 -bottom-8 w-48 h-48 text-indigo-500/30 rotate-12" />
        </div>
      </div>
    </div>
  );
}
