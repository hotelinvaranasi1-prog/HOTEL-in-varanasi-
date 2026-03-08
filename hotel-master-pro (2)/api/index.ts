import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createClient } from '@supabase/supabase-js';
import { createServer } from "http";
import { Server } from "socket.io";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

let supabase: any = null;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.warn("âš ï¸ SUPABASE_URL or SUPABASE_ANON_KEY is missing. Database features will not work.");
}

async function syncRooms() {
  if (!supabase) return;
  
  try {
    const roomsToEnsure = [
      // Hotel in Kashi
      { number: '101', status: 'Available' },
      { number: '102', status: 'Available' },
      { number: '103', status: 'Available' },
      { number: '104', status: 'Available' },
      { number: '105', status: 'Available' },
      // Hotel in Varanasi
      { number: '201', status: 'Available' },
      { number: '202', status: 'Available' },
      { number: '203', status: 'Available' },
      { number: '204', status: 'Available' },
      { number: '205', status: 'Available' },
      { number: '301', status: 'Available' },
      { number: '302', status: 'Available' },
    ];

    const { data: existingRooms, error: fetchError } = await supabase
      .from('rooms')
      .select('number');

    if (fetchError) {
      if (fetchError.code === '42P01' || fetchError.message?.includes('relation "rooms" does not exist') || fetchError.message?.includes('schema cache')) {
        console.error('âŒ DATABASE ERROR: The "rooms" table does not exist in Supabase.');
        console.error('Please run the SQL schema in your Supabase Dashboard SQL Editor.');
      } else {
        console.error('Error fetching existing rooms:', fetchError);
      }
      return;
    }

    const existingNumbers = new Set(existingRooms?.map((r: any) => r.number) || []);
    const roomsToInsert = roomsToEnsure.filter(r => !existingNumbers.has(r.number));

    if (roomsToInsert.length > 0) {
      const { error: insertError } = await supabase.from('rooms').insert(roomsToInsert);
      if (insertError) {
        console.error('Error inserting missing rooms:', insertError);
      }
    }
  } catch (err) {
    console.error('Unexpected error during room sync:', err);
  }
}

async function startServer() {
  // Only sync rooms if not in serverless or if explicitly requested
  if (!process.env.VERCEL) {
    try {
      await syncRooms();
    } catch (e) {}
  }
  
  const app = express();
  const httpServer = createServer(app);
  
  // Socket.IO setup - Note: This will not work on Vercel Serverless Functions
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PATCH", "PUT"]
    }
  });

  io.on("connection", (socket) => {
    socket.on("disconnect", () => {});
  });

  app.use(express.json());

  // API Routes
  app.post("/api/login", (req, res) => {
    const { password } = req.body;
    if (password === "admin123") {
      res.json({ success: true, token: "staff-token-123" });
    } else {
      res.status(401).json({ success: false, message: "Invalid password" });
    }
  });

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
    io.emit("room_status_update", { number, status });
    res.json({ success: true });
  });

  app.get("/api/bookings", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const { data, error } = await supabase.from('bookings').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json(error);
    res.json(data);
  });

  app.post("/api/bookings", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const b = req.body;
    const total_amount = (Number(b.room_price) || 0) + (Number(b.misc_charges) || 0);
    const balance_amount = total_amount - (Number(b.cash_paid) || 0) - (Number(b.online_paid) || 0);
    const payment_status = balance_amount <= 0 ? 'Paid' : 'Unpaid';
    
    let commission_amount = 0;
    let net_income = total_amount;

    if (b.booking_type === 'OTA') {
      commission_amount = Number(b.commission_amount) || 0;
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
      gst_amount: 0,
      net_income,
      payment_status,
      booking_status: 'Active'
    }]).select();

    if (error) return res.status(500).json(error);

    await supabase.from('rooms').update({ status: 'Occupied' }).eq('number', b.room_number);
    io.emit("room_status_update", { number: b.room_number, status: 'Occupied' });

    // Telegram Notification
    try {
      const { data: settings } = await supabase.from('settings').select('*');
      const settingsMap = settings?.reduce((acc: any, curr: any) => {
        acc[curr.key] = curr.value;
        return acc;
      }, {});

      if (settingsMap?.telegram_enabled === 'true') {
        const botToken = settingsMap.telegram_bot_token;
        const chatId = settingsMap.telegram_chat_id;
        if (botToken && chatId) {
          const message = `ðŸ¨ *New Booking Added*\n\nRoom: ${b.room_number}\nGuest: ${b.guest_name || 'N/A'}\nType: ${b.booking_type}\nTotal: â‚¹${total_amount}\nStatus: ${payment_status}`;
          fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' })
          }).catch(() => {});
        }
      }
    } catch (e) {}

    res.json({ success: true, id: data[0].id });
    io.emit("booking_update");
  });

  app.put("/api/bookings/:id", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const { id } = req.params;
    const b = req.body;
    const total_amount = (Number(b.room_price) || 0) + (Number(b.misc_charges) || 0);
    const balance_amount = total_amount - (Number(b.cash_paid) || 0) - (Number(b.online_paid) || 0);
    const payment_status = balance_amount <= 0 ? 'Paid' : 'Unpaid';
    
    let commission_amount = 0;
    let net_income = total_amount;
    if (b.booking_type === 'OTA') {
      commission_amount = Number(b.commission_amount) || 0;
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
      io.emit("room_status_update", { number: booking.room_number, status: 'Available' });
    }
    io.emit("booking_update");
    res.json({ success: true });
  });

  app.post("/api/bookings/:id/checkout", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const { id } = req.params;
    const { data: booking } = await supabase.from('bookings').select('room_number').eq('id', id).single();
    if (booking) {
      await supabase.from('bookings').update({ booking_status: 'Completed' }).eq('id', id);
      await supabase.from('rooms').update({ status: 'Cleaning' }).eq('number', booking.room_number);
      io.emit("room_status_update", { number: booking.room_number, status: 'Cleaning' });
      io.emit("booking_update");
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
    if (booking.booking_type === 'OTA') net_income = newTotal - (Number(booking.commission_amount) || 0);
    const { error } = await supabase.from('bookings').update({ 
      misc_charges: newMisc, total_amount: newTotal, balance_amount: newBalance, payment_status: newStatus, net_income 
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
      cash_paid: newCash, online_paid: newOnline, balance_amount: newBalance, payment_status: newStatus 
    }).eq('id', id);
    if (error) return res.status(500).json(error);
    res.json({ success: true });
  });

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

  app.get("/api/reports/summary", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase.from('bookings').select('*').eq('date', today).eq('booking_status', 'Active');
    if (error) return res.status(500).json(error);
    const summary = data.reduce((acc, b) => {
      acc.total_revenue += b.total_amount;
      acc.total_cash += b.cash_paid;
      acc.total_online += b.online_paid;
      if (b.booking_type === 'OTA') acc.ota_count++;
      if (b.booking_type === 'Walk-in') acc.walkin_count++;
      acc.pending_payments += b.balance_amount;
      return acc;
    }, { total_revenue: 0, total_cash: 0, total_online: 0, ota_count: 0, walkin_count: 0, pending_payments: 0 });
    res.json(summary);
  });

  app.get("/api/reports/summary/hotels", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase.from('bookings')
      .select('room_number, total_amount, cash_paid, online_paid, booking_type, balance_amount')
      .eq('date', today).eq('booking_status', 'Active');
    if (error) return res.status(500).json(error);
    res.json(data);
  });

  app.post("/api/admin/sync-rooms", async (req, res) => {
    try {
      await syncRooms();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Serve static files in production
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    const distPath = path.join(__dirname, "../dist");
    app.use(express.static(distPath));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  if (!process.env.VERCEL) {
    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  }

  return app;
}

const appPromise = startServer();
export default appPromise;
