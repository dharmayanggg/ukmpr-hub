import express from "express";
import { createClient } from "@libsql/client";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

// Koneksi Database Vercel -> Turso
const tursoUrl = process.env.TURSO_DATABASE_URL as string;
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN as string;

const db = createClient({
  url: tursoUrl,
  authToken: tursoAuthToken,
});

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

// --- HEALTH CHECK ---
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// --- MIDDLEWARES ---
const isLoggedInMiddleware = async (req: any, res: any, next: any) => {
  const sessionId = req.cookies.session_id;
  if (!sessionId) return res.status(401).json({ error: "Unauthorized" });
  const sessionRes = await db.execute({ sql: "SELECT * FROM sessions WHERE id = ? AND expiresAt > ?", args: [sessionId, Date.now()] });
  const session = sessionRes.rows[0] as any;
  if (!session) return res.status(401).json({ error: "Session expired" });
  const userRes = await db.execute({ sql: "SELECT * FROM members WHERE id = ?", args: [session.userId] });
  const user = userRes.rows[0] as any;
  if (!user) return res.status(401).json({ error: "User not found" });
  req.user = user;
  next();
};

const isAdminMiddleware = async (req: any, res: any, next: any) => {
  const sessionId = req.cookies.session_id;
  if (!sessionId) return res.status(401).json({ error: "Unauthorized" });
  const sessionRes = await db.execute({ sql: "SELECT * FROM sessions WHERE id = ?", args: [sessionId] });
  const session = sessionRes.rows[0] as any;
  if (!session || session.expiresAt < Date.now()) return res.status(401).json({ error: "Session expired" });
  const userRes = await db.execute({ sql: "SELECT * FROM members WHERE id = ?", args: [session.userId] });
  const user = userRes.rows[0] as any;
  if (!user || user.role !== 'Admin') return res.status(403).json({ error: "Forbidden: Admin access required" });
  req.user = user;
  next();
};

// --- AUTHENTICATION ---
app.post("/api/auth/public-register", async (req, res) => {
  const { name, username, password, major, program, entryYear, wa, nim } = req.body;
  try {
    const existing = await db.execute({ sql: "SELECT id FROM members WHERE username = ?", args: [username || ""] });
    if (existing.rows.length > 0) return res.status(400).json({ error: "Username sudah digunakan" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const defaultPhoto = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "User")}&background=random`;
    
    const result = await db.execute({
      sql: `INSERT INTO members (name, username, password, major, program, entryYear, role, wa, nim, photo) VALUES (?, ?, ?, ?, ?, ?, 'Anggota', ?, ?, ?)`,
      args: [name || "", username || "", hashedPassword, major || "", program || "", entryYear || 0, wa || null, nim || null, defaultPhoto]
    });
    
    const userId = Number(result.lastInsertRowid);
    const sessionId = crypto.randomUUID();
    const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7;
    await db.execute({ sql: "INSERT INTO sessions (id, userId, expiresAt) VALUES (?, ?, ?)", args: [sessionId, userId, expiresAt] });

    res.cookie("session_id", sessionId, { httpOnly: true, secure: true, sameSite: "none", maxAge: 1000 * 60 * 60 * 24 * 7 });
    const userRes = await db.execute({ sql: "SELECT * FROM members WHERE id = ?", args: [userId] });
    res.status(201).json({ success: true, user: userRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Terjadi kesalahan pada server" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const userRes = await db.execute({ sql: "SELECT * FROM members WHERE username = ?", args: [username] });
    const user = userRes.rows[0] as any;
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ error: "Username atau password salah" });

    const sessionId = crypto.randomUUID();
    const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7;
    await db.execute({ sql: "INSERT INTO sessions (id, userId, expiresAt) VALUES (?, ?, ?)", args: [sessionId, user.id, expiresAt] });

    res.cookie("session_id", sessionId, { httpOnly: true, secure: true, sameSite: "none", maxAge: 1000 * 60 * 60 * 24 * 7 });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: "Login gagal" });
  }
});

app.get("/api/auth/me", async (req, res) => {
  const sessionId = req.cookies.session_id;
  if (!sessionId) return res.json(null);
  const sessionRes = await db.execute({ sql: "SELECT * FROM sessions WHERE id = ? AND expiresAt > ?", args: [sessionId, Date.now()] });
  const session = sessionRes.rows[0] as any;
  if (!session) { res.clearCookie("session_id"); return res.json(null); }
  const userRes = await db.execute({ sql: "SELECT * FROM members WHERE id = ?", args: [session.userId] });
  res.json(userRes.rows[0] || null);
});

app.post("/api/auth/logout", async (req, res) => {
  const sessionId = req.cookies.session_id;
  if (sessionId) await db.execute({ sql: "DELETE FROM sessions WHERE id = ?", args: [sessionId] });
  res.clearCookie("session_id");
  res.json({ success: true });
});

// --- PROFILE UPDATE (SAPU JAGAT) ---
app.put("/api/profile/me", async (req, res) => {
  const sessionId = req.cookies.session_id;
  if (!sessionId) return res.status(401).json({ error: "Unauthorized" });

  const sessionRes = await db.execute({ sql: "SELECT * FROM sessions WHERE id = ? AND expiresAt > ?", args: [sessionId, Date.now()] });
  const session = sessionRes.rows[0] as any;
  if (!session) return res.status(401).json({ error: "Session expired" });

  const oldDataRes = await db.execute({ sql: "SELECT * FROM members WHERE id = ?", args: [session.userId] });
  const oldData = oldDataRes.rows[0] as any;

  const { name, major, program, entryYear, gradYear, role, wa, nim, photo, bio, username } = req.body;

  try {
    await db.execute({
      sql: `UPDATE members SET name = ?, major = ?, program = ?, entryYear = ?, gradYear = ?, role = ?, wa = ?, nim = ?, photo = ?, bio = ?, username = ? WHERE id = ?`,
      args: [
        name || oldData.name,
        major || oldData.major || "",
        program || oldData.program || "",
        entryYear || oldData.entryYear || 0,
        gradYear !== undefined ? gradYear : (oldData.gradYear || null),
        role || oldData.role,
        wa !== undefined ? wa : (oldData.wa || null),
        nim !== undefined ? nim : (oldData.nim || null),
        photo !== undefined ? photo : (oldData.photo || null),
        bio !== undefined ? bio : (oldData.bio || null),
        username || oldData.username,
        session.userId
      ]
    });
    const userRes = await db.execute({ sql: "SELECT * FROM members WHERE id = ?", args: [session.userId] });
    res.json({ success: true, user: userRes.rows[0] });
  } catch (err: any) {
    console.error("Profile Error:", err);
    res.status(500).json({ error: "Gagal memperbarui profil" });
  }
});

// --- FEED (POSTS) ---
app.get("/api/posts", async (req, res) => {
  try {
    const postsRes = await db.execute(`
      SELECT posts.*, members.username as authorUsername, members.photo as authorPhoto, members.role as authorRole, members.name as authorName
      FROM posts JOIN members ON posts.userId = members.id ORDER BY posts.createdAt DESC
    `);
    const posts = postsRes.rows as any[];
    const enhancedPosts = await Promise.all(posts.map(async post => {
      const likesRes = await db.execute({ sql: "SELECT userId, emoji FROM post_likes WHERE postId = ?", args: [post.id] });
      const commentsRes = await db.execute({
        sql: `SELECT post_comments.*, members.username as authorUsername, members.photo as authorPhoto FROM post_comments JOIN members ON post_comments.userId = members.id WHERE postId = ? ORDER BY createdAt ASC`, args: [post.id]
      });
      return { ...post, likes: likesRes.rows, comments: commentsRes.rows, poll: post.poll_json ? JSON.parse(post.poll_json) : null };
    }));
    res.json(enhancedPosts);
  } catch(e) { res.json([]); }
});

app.post("/api/posts", async (req, res) => {
  const { userId, content, image, poll, note, activityLabel } = req.body;
  const poll_json = poll ? JSON.stringify(poll) : null;
  try {
    const result = await db.execute({
      sql: "INSERT INTO posts (userId, content, image, poll_json, note, activityLabel, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [userId, content || "", image || null, poll_json || null, note || null, activityLabel || null, Date.now()]
    });
    res.json({ id: Number(result.lastInsertRowid) });
  } catch (err) { res.status(500).json({ error: "Gagal posting" }); }
});

// --- ALL OTHER FEATURES (ADMIN PANEL, dll) ---
// --- ALL OTHER FEATURES (ADMIN PANEL, dll) ---

// MEMBER MANAGEMENT (ADMIN)
app.get("/api/members", async (req, res) => {
  try { 
    const result = await db.execute("SELECT id, name, major, program, entryYear, gradYear, role, wa, nim, photo, username, bio FROM members"); 
    res.json(result.rows); 
  } catch(e) { res.json([]); }
});

app.put("/api/members/:id", isAdminMiddleware, async (req: any, res: any) => {
  const { name, major, program, entryYear, gradYear, role, wa, nim, photo, username, password } = req.body;
  try {
    // Cek apakah username dipakai orang lain (selain member ini sendiri)
    const checkUser = await db.execute({
      sql: "SELECT id FROM members WHERE username = ? AND id != ?",
      args: [username || "", req.params.id]
    });
    if (checkUser.rows.length > 0) return res.status(400).json({ error: "Username sudah digunakan orang lain" });

    if (password && password.trim() !== "") {
      const hashedPassword = await bcrypt.hash(password, 10);
      await db.execute({
        sql: `UPDATE members SET name = ?, major = ?, program = ?, entryYear = ?, gradYear = ?, role = ?, wa = ?, nim = ?, photo = ?, username = ?, password = ? WHERE id = ?`,
        args: [name || "", major || "", program || "", entryYear || 0, gradYear || null, role || "Anggota", wa || null, nim || null, photo || null, username || "", hashedPassword, req.params.id]
      });
    } else {
      await db.execute({
        sql: `UPDATE members SET name = ?, major = ?, program = ?, entryYear = ?, gradYear = ?, role = ?, wa = ?, nim = ?, photo = ?, username = ? WHERE id = ?`,
        args: [name || "", major || "", program || "", entryYear || 0, gradYear || null, role || "Anggota", wa || null, nim || null, photo || null, username || "", req.params.id]
      });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Gagal memperbarui member di database" });
  }
});

app.delete("/api/members/:id", isAdminMiddleware, async (req, res) => {
  try {
    await db.execute({ sql: "DELETE FROM members WHERE id = ?", args: [req.params.id] });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: "Gagal menghapus member" }); }
});

// RESEARCH MANAGEMENT
app.get("/api/research", async (req, res) => {
  try { 
    const result = await db.execute("SELECT * FROM research ORDER BY id DESC"); 
    res.json(result.rows); 
  } catch(e) { res.json([]); }
});

app.post("/api/research", isAdminMiddleware, async (req, res) => {
  const { title, category, author, year } = req.body;
  try {
    const result = await db.execute({
      sql: "INSERT INTO research (title, category, author, year) VALUES (?, ?, ?, ?)",
      args: [title || "Tanpa Judul", category || "PKM", author || "Anonim", year || 2026]
    });
    res.json({ id: Number(result.lastInsertRowid) });
  } catch(err) { res.status(500).json({ error: "Gagal menambah riset" }); }
});

app.delete("/api/research/:id", isAdminMiddleware, async (req, res) => {
  try {
    await db.execute({ sql: "DELETE FROM research WHERE id = ?", args: [req.params.id] });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: "Gagal menghapus riset" }); }
});

// STATS MANAGEMENT
app.get("/api/stats", async (req, res) => {
  try { 
    const result = await db.execute("SELECT * FROM stats ORDER BY sort_order ASC"); 
    res.json(result.rows); 
  } catch(e) { res.json([]); }
});

app.post("/api/stats", isAdminMiddleware, async (req, res) => {
  try {
    const { label, value, icon, color, bg, sort_order, details_json } = req.body;
    const result = await db.execute({
      sql: "INSERT INTO stats (label, value, icon, color, bg, sort_order, details_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [label || "Stat Baru", value || "0", icon || "Award", color || "text-white", bg || "bg-gradient-to-br from-blue-500 to-blue-700", sort_order || 0, details_json || "[]"]
    });
    res.json({ id: Number(result.lastInsertRowid) });
  } catch (err) { res.status(500).json({ error: "Gagal membuat stat" }); }
});

app.delete("/api/stats/:id", isAdminMiddleware, async (req, res) => {
  try {
    await db.execute({ sql: "DELETE FROM stats WHERE id = ?", args: [req.params.id] });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: "Gagal menghapus stat" }); }
});

// --- MENTOR MANAGEMENT ---
app.get("/api/mentors", async (req, res) => {
  try { 
    const result = await db.execute("SELECT * FROM mentors"); 
    res.json(result.rows); 
  } catch(e) { res.json([]); }
});

app.post("/api/mentors", isAdminMiddleware, async (req, res) => {
  const { name, expertise, rating, available, experience, education, achievements, photo } = req.body;
  try {
    const result = await db.execute({
      sql: "INSERT INTO mentors (name, expertise, rating, available, experience, education, achievements, photo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      args: [
        name || "Nama Mentor", 
        expertise || "Bidang Keahlian", 
        rating || 5, 
        available !== undefined ? available : 1, 
        experience || "-", 
        education || "-", 
        achievements || "-", 
        photo || "https://ui-avatars.com/api/?name=Mentor&background=random"
      ]
    });
    res.json({ id: Number(result.lastInsertRowid) });
  } catch(err) { 
    res.status(500).json({ error: "Gagal menambah mentor" }); 
  }
});

app.delete("/api/mentors/:id", isAdminMiddleware, async (req, res) => {
  try {
    await db.execute({ sql: "DELETE FROM mentors WHERE id = ?", args: [req.params.id] });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: "Gagal menghapus mentor" }); }
});

// --- BANNERS & NOTIF ---
app.get("/api/banners", async (req, res) => {
  try { 
    const result = await db.execute("SELECT * FROM banners"); 
    res.json(result.rows); 
  } catch(e) { res.json([]); }
});

app.get("/api/notifications", async (req, res) => { 
  res.json([]); 
});

// Khusus Vercel
export default app;
