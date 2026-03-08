import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

let supabase: any = null;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.warn("⚠️ SUPABASE_URL or SUPABASE_ANON_KEY is missing. Database features will not work.");
}

async function seedRooms() {
  if (!supabase) return;
  
  try {
    const { count, error: countError } = await supabase
      .from('rooms')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      if (countError.code === 'PGRST116' || countError.message?.includes('does not exist')) {
        console.error('❌ Supabase table "rooms" does not exist. Please run the SQL setup script in Supabase dashboard.');
      } else {
        console.error('Error checking room count:', countError);
      }
      return;
    }

    if (count === 0) {
      console.log('Seeding rooms...');
      const roomsToSeed = [];
      for (let i = 101; i <= 110; i++) roomsToSeed.push({ number: i.toString(), status: 'Available' });
      for (let i = 201; i <= 210; i++) roomsToSeed.push({ number: i.toString(), status: 'Available' });
      roomsToSeed.push({ number: '301', status: 'Available' });
      roomsToSeed.push({ number: '302', status: 'Available' });

      const { error: insertError } = await supabase.from('rooms').insert(roomsToSeed);
      if (insertError) {
        console.error('Error seeding rooms:', insertError);
      } else {
        console.log('Rooms seeded successfully.');
      }
    }
  } catch (err) {
    console.error('Unexpected error during seeding:', err);
  }
}

async function startServer() {
  try {
    await seedRooms();
  } catch (e) {
    console.error("Failed to seed rooms, continuing anyway...", e);
  }
  
  const app = express();
  app.use(express.json());

  // API Routes
  
  // Auth (Simple)
  app.post("/api/login", (req, res) => {
    const { password } = req.body;
    if (password === "admin123") { // Simple hardcoded password for staff
      res.json({ success: true, token: "staff-token-123" });
    } else {
      res.status(401).json({ success: false, message: "Invalid password" });
    }
  });

  // Rooms
  app.get("/api/rooms", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const { data, error } = await supabase.from('rooms').select('*').order('number');
    if (error) return res.status(500).json(error);
    res.json(data);
  });

  app.patch("/api/rooms/:number/status", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const { number } = req.params;
    const { status } = req.body;
    const { error } = await supabase.from('rooms').update({ status }).eq('number', number);
    if (error) return res.status(500).json(error);
    res.json({ success: true });
  });

  // Bookings
  app.get("/api/bookings", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const { data, error } = await supabase.from('bookings').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json(error);
    res.json(data);
  });

  app.post("/api/bookings", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const b = req.body;
    
    // Calculate totals
    const total_amount = (Number(b.room_price) || 0) + (Number(b.misc_charges) || 0);
    const balance_amount = total_amount - (Number(b.cash_paid) || 0) - (Number(b.online_paid) || 0);
    const payment_status = balance_amount <= 0 ? 'Paid' : 'Unpaid';
    
    let commission_amount = 0;
    let gst_amount = 0;
    let net_income = total_amount;

    if (b.booking_type === 'OTA') {
      commission_amount = Number(b.commission_amount) || 0;
      gst_amount = 0; 
      net_income = total_amount - commission_amount;
    }

    const { data, error } = await supabase.from('bookings').insert([{
      date: b.date,
      room_number: b.room_number,
      guest_name: b.guest_name,
      booking_type: b.booking_type,
      ota_source: b.ota_source,
      room_price: b.room_price,
      misc_charges: b.misc_charges,
      total_amount,
      cash_paid: b.cash_paid,
      online_paid: b.online_paid,
      balance_amount,
      commission_amount,
      gst_amount,
      net_income,
      payment_status,
      booking_status: 'Active'
    }]).select();

    if (error) return res.status(500).json(error);

    // Update room status to Occupied
    await supabase.from('rooms').update({ status: 'Occupied' }).eq('number', b.room_number);

    // Telegram Notification
    const { data: settings } = await supabase.from('settings').select('*');
    const settingsMap = settings?.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});

    if (settingsMap?.telegram_enabled === 'true') {
      const botToken = settingsMap.telegram_bot_token;
      const chatId = settingsMap.telegram_chat_id;
      
      if (botToken && chatId) {
        const message = `🏨 *New Booking Added*\n\nRoom: ${b.room_number}\nGuest: ${b.guest_name || 'N/A'}\nType: ${b.booking_type}\nTotal: ₹${total_amount}\nStatus: ${payment_status}`;
        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' })
        }).catch(err => console.error("Telegram error:", err));
      }
    }

    res.json({ success: true, id: data[0].id });
  });

  app.put("/api/bookings/:id", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const { id } = req.params;
    const b = req.body;

    const total_amount = (Number(b.room_price) || 0) + (Number(b.misc_charges) || 0);
    const balance_amount = total_amount - (Number(b.cash_paid) || 0) - (Number(b.online_paid) || 0);
    const payment_status = balance_amount <= 0 ? 'Paid' : 'Unpaid';
    
    let commission_amount = 0;
    let gst_amount = 0;
    let net_income = total_amount;

    if (b.booking_type === 'OTA') {
      commission_amount = Number(b.commission_amount) || 0;
      gst_amount = 0;
      net_income = total_amount - commission_amount;
    }

    const { error } = await supabase.from('bookings').update({
      date: b.date,
      room_number: b.room_number,
      guest_name: b.guest_name,
      booking_type: b.booking_type,
      ota_source: b.ota_source,
      room_price: b.room_price,
      misc_charges: b.misc_charges,
      total_amount,
      cash_paid: b.cash_paid,
      online_paid: b.online_paid,
      balance_amount,
      commission_amount,
      gst_amount,
      net_income,
      payment_status,
      booking_status: b.booking_status
    }).eq('id', id);

    if (error) return res.status(500).json(error);
    res.json({ success: true });
  });

  app.post("/api/bookings/:id/cancel", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const { id } = req.params;
    const { data: booking } = await supabase.from('bookings').select('room_number').eq('id', id).single();
    
    await supabase.from('bookings').update({ booking_status: 'Cancelled' }).eq('id', id);
    if (booking) {
      await supabase.from('rooms').update({ status: 'Available' }).eq('number', booking.room_number);
    }
    res.json({ success: true });
  });

  app.post("/api/bookings/:id/misc", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const { id } = req.params;
    const { amount } = req.body;
    
    const { data: booking } = await supabase.from('bookings').select('*').eq('id', id).single();
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    const newMisc = (Number(booking.misc_charges) || 0) + (Number(amount) || 0);
    const newTotal = (Number(booking.room_price) || 0) + newMisc;
    const newBalance = newTotal - (Number(booking.cash_paid) || 0) - (Number(booking.online_paid) || 0);
    const newStatus = newBalance <= 0 ? 'Paid' : 'Unpaid';
    
    let net_income = newTotal;
    if (booking.booking_type === 'OTA') {
      net_income = newTotal - (Number(booking.commission_amount) || 0);
    }

    const { error } = await supabase.from('bookings').update({ 
      misc_charges: newMisc, 
      total_amount: newTotal, 
      balance_amount: newBalance, 
      payment_status: newStatus, 
      net_income 
    }).eq('id', id);

    if (error) return res.status(500).json(error);
    res.json({ success: true });
  });

  app.post("/api/bookings/:id/pay", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const { id } = req.params;
    const { method, amount } = req.body;
    
    const { data: booking } = await supabase.from('bookings').select('*').eq('id', id).single();
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    const newCash = method === 'cash' ? booking.cash_paid + amount : booking.cash_paid;
    const newOnline = method === 'online' ? booking.online_paid + amount : booking.online_paid;
    const newBalance = booking.total_amount - newCash - newOnline;
    const newStatus = newBalance <= 0 ? 'Paid' : 'Unpaid';

    const { error } = await supabase.from('bookings').update({ 
      cash_paid: newCash, 
      online_paid: newOnline, 
      balance_amount: newBalance, 
      payment_status: newStatus 
    }).eq('id', id);

    if (error) return res.status(500).json(error);
    res.json({ success: true });
  });

  // Settings
  app.get("/api/settings", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const { data, error } = await supabase.from('settings').select('*');
    if (error) return res.status(500).json(error);
    const settingsObj = data.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});
    res.json(settingsObj);
  });

  app.post("/api/settings", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const settings = req.body;
    for (const [key, value] of Object.entries(settings)) {
      await supabase.from('settings').upsert({ key, value: String(value) });
    }
    res.json({ success: true });
  });

  // Reports
  app.get("/api/reports/summary", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase.from('bookings')
      .select('*')
      .eq('date', today)
      .eq('booking_status', 'Active');

    if (error) return res.status(500).json(error);

    const summary = data.reduce((acc, b) => {
      acc.total_revenue += b.total_amount;
      acc.total_cash += b.cash_paid;
      acc.total_online += b.online_paid;
      if (b.booking_type === 'OTA') acc.ota_count++;
      if (b.booking_type === 'Walk-in') acc.walkin_count++;
      acc.pending_payments += b.balance_amount;
      return acc;
    }, {
      total_revenue: 0,
      total_cash: 0,
      total_online: 0,
      ota_count: 0,
      walkin_count: 0,
      pending_payments: 0
    });

    res.json(summary);
  });

  app.get("/api/reports/summary/hotels", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase.from('bookings')
      .select('room_number, total_amount, cash_paid, online_paid, booking_type, balance_amount')
      .eq('date', today)
      .eq('booking_status', 'Active');
    
    if (error) return res.status(500).json(error);
    res.json(data);
  });

  // Vite Integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
