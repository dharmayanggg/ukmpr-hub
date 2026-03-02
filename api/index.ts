import express from "express";
import { createClient } from "@libsql/client";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

// --- KONEKSI TURSO ---
const tursoUrl = process.env.TURSO_DATABASE_URL || "libsql://ukmpr-db-dharmayanggg.aws-ap-northeast-1.turso.io";
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN as string;

const db = createClient({
  url: tursoUrl,
  authToken: tursoAuthToken,
});

const app = express();

// --- PRO FIX: DYNAMIC CORS (Anti Blokir Local & Vercel) ---
app.use((req, res, next) => {
  const origin = req.headers.origin || '*'; // Mengizinkan dari localhost maupun vercel
  res.setHeader('Access-Control-Allow-Origin', origin); 
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

// --- MIDDLEWARES ---
const isLoggedInMiddleware = async (req: any, res: any, next: any) => {
  const sessionId = req.cookies.session_id;
  if (!sessionId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const sessionRes = await db.execute({ sql: "SELECT * FROM sessions WHERE id = ? AND expiresAt > ?", args: [sessionId, Date.now()] });
    if (sessionRes.rows.length === 0) return res.status(401).json({ error: "Session expired" });
    const userRes = await db.execute({ sql: "SELECT * FROM members WHERE id = ?", args: [(sessionRes.rows[0] as any).userId] });
    req.user = userRes.rows[0];
    next();
  } catch(e) { res.status(500).json({ error: "Database error" }); }
};

const isAdminMiddleware = async (req: any, res: any, next: any) => {
  const sessionId = req.cookies.session_id;
  if (!sessionId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const sessionRes = await db.execute({ sql: "SELECT * FROM sessions WHERE id = ? AND expiresAt > ?", args: [sessionId, Date.now()] });
    if (sessionRes.rows.length === 0) return res.status(401).json({ error: "Session expired" });
    const userRes = await db.execute({ sql: "SELECT * FROM members WHERE id = ?", args: [(sessionRes.rows[0] as any).userId] });
    const user = userRes.rows[0] as any;
    if (!user || user.role !== 'Admin') return res.status(403).json({ error: "Forbidden" });
    req.user = user;
    next();
  } catch(e) { res.status(500).json({ error: "Database error" }); }
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
    res.status(201).json({ success: true });
  } catch (err) { res.status(500).json({ error: "Gagal register" }); }
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const userRes = await db.execute({ sql: "SELECT * FROM members WHERE username = ?", args: [username] });
    const user = userRes.rows[0] as any;
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ error: "Username/password salah" });
    const sessionId = crypto.randomUUID();
    await db.execute({ sql: "INSERT INTO sessions (id, userId, expiresAt) VALUES (?, ?, ?)", args: [sessionId, user.id, Date.now() + 604800000] });
    res.cookie("session_id", sessionId, { httpOnly: true, secure: true, sameSite: "none", maxAge: 604800000 });
    res.json({ success: true, user });
  } catch (err) { res.status(500).json({ error: "Login gagal" }); }
});

app.get("/api/auth/me", async (req, res) => {
  const sessionId = req.cookies.session_id;
  if (!sessionId) return res.json(null);
  try {
    const sessionRes = await db.execute({ sql: "SELECT userId FROM sessions WHERE id = ? AND expiresAt > ?", args: [sessionId, Date.now()] });
    if (sessionRes.rows.length === 0) return res.json(null);
    const userRes = await db.execute({ sql: "SELECT * FROM members WHERE id = ?", args: [(sessionRes.rows[0] as any).userId] });
    res.json(userRes.rows[0] || null);
  } catch(e) { res.json(null); }
});

// --- FEED SYSTEM ---
app.get("/api/posts", async (req, res) => {
  try {
    const postsRes = await db.execute(`
      SELECT posts.*, members.username as authorUsername, members.photo as authorPhoto, members.name as authorName
      FROM posts JOIN members
// Handle LIKE (Bisa Like & Unlike)
app.post("/api/posts/:id/like", isLoggedInMiddleware, async (req: any, res: any) => {
  const postId = req.params.id;
  const userId = req.user.id;
  try {
    const existing = await db.execute({ sql: "SELECT * FROM post_likes WHERE postId = ? AND userId = ?", args: [postId, userId] });
    if (existing.rows.length > 0) {
      await db.execute({ sql: "DELETE FROM post_likes WHERE postId = ? AND userId = ?", args: [postId, userId] });
      res.json({ success: true, action: "unliked" });
    } else {
      await db.execute({ sql: "INSERT INTO post_likes (postId, userId, createdAt) VALUES (?, ?, ?)", args: [postId, userId, Date.now()] });
      res.json({ success: true, action: "liked" });
    }
  } catch (err) { res.status(500).json({ error: "Gagal proses like" }); }
});

// Handle KOMENTAR
app.post("/api/posts/:id/comments", isLoggedInMiddleware, async (req: any, res: any) => {
  const postId = req.params.id;
  const userId = req.user.id;
  const { content } = req.body;
  try {
    await db.execute({
      sql: "INSERT INTO post_comments (postId, userId, content, createdAt) VALUES (?, ?, ?, ?)",
      args: [postId, userId, content || "", Date.now()]
    });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Gagal simpan komentar" }); }
});

// --- MENTORS SYSTEM ---
app.get("/api/mentors", async (req, res) => {
  try {
    const result = await db.execute("SELECT * FROM mentors");
    res.json(result.rows);
  } catch(e) { res.json([]); }
});

app.post("/api/mentors", isLoggedInMiddleware, async (req: any, res: any) => {
  const { name, expertise, rating, available, experience, education, achievements, photo } = req.body;
  try {
    await db.execute({
      sql: `INSERT INTO mentors (name, expertise, rating, available, experience, education, achievements, photo) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [name, expertise, rating || 5, available || 1, experience, education, achievements, photo]
    });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Gagal tambah mentor" }); }
});

// --- AUTH & LAINNYA ---
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  const userRes = await db.execute({ sql: "SELECT * FROM members WHERE username = ?", args: [username] });
  const user = userRes.rows[0] as any;
  if (user && await bcrypt.compare(password, user.password)) {
    const sessionId = crypto.randomUUID();
    await db.execute({ sql: "INSERT INTO sessions (id, userId, expiresAt) VALUES (?, ?, ?)", args: [sessionId, user.id, Date.now() + 604800000] });
    res.cookie("session_id", sessionId, { httpOnly: true, secure: true, sameSite: "none", maxAge: 604800000 });
    return res.json({ success: true, user });
  }
  res.status(400).json({ error: "Login gagal" });
});

app.get("/api/auth/me", async (req, res) => {
  const sessionId = req.cookies.session_id;
  if (!sessionId) return res.json(null);
  const sessionRes = await db.execute({ sql: "SELECT userId FROM sessions WHERE id = ? AND expiresAt > ?", args: [sessionId, Date.now()] });
  if (sessionRes.rows.length === 0) return res.json(null);
  const userRes = await db.execute({ sql: "SELECT * FROM members WHERE id = ?", args: [(sessionRes.rows[0] as any).userId] });
  res.json(userRes.rows[0]);
});

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

export default app;
  res.json(userRes.rows[0] || null);
});

// --- FEED (POSTS, LIKES, COMMENTS) ---
app.get("/api/posts", async (req, res) => {
  try {
    const postsRes = await db.execute(`
      SELECT posts.*, members.username as authorUsername, members.photo as authorPhoto, members.role as authorRole, members.name as authorName
      FROM posts JOIN members ON posts.userId = members.id ORDER BY posts.createdAt DESC
    `);
    const posts = postsRes.rows as any[];
    const enhancedPosts = await Promise.all(posts.map(async post => {
      const likesRes = await db.execute({ sql: "SELECT userId FROM post_likes WHERE postId = ?", args: [post.id] });
      const commentsRes = await db.execute({
        sql: `SELECT post_comments.*, members.username as authorUsername, members.photo as authorPhoto FROM post_comments JOIN members ON post_comments.userId = members.id WHERE postId = ? ORDER BY createdAt ASC`, args: [post.id]
      });
      return { ...post, likes: likesRes.rows, comments: commentsRes.rows, poll: post.poll_json ? JSON.parse(post.poll_json) : null };
    }));
    res.json(enhancedPosts);
  } catch(e) { res.json([]); }
});

// Handle LIKE (Toggle Like/Unlike)
app.post("/api/posts/:id/like", isLoggedInMiddleware, async (req: any, res: any) => {
  const postId = req.params.id;
  const userId = req.user.id;
  try {
    const existing = await db.execute({ sql: "SELECT * FROM post_likes WHERE postId = ? AND userId = ?", args: [postId, userId] });
    if (existing.rows.length > 0) {
      await db.execute({ sql: "DELETE FROM post_likes WHERE postId = ? AND userId = ?", args: [postId, userId] });
      res.json({ success: true, action: "unliked" });
    } else {
      await db.execute({ sql: "INSERT INTO post_likes (postId, userId, createdAt) VALUES (?, ?, ?)", args: [postId, userId, Date.now()] });
      res.json({ success: true, action: "liked" });
    }
  } catch (err) { res.status(500).json({ error: "Gagal proses like" }); }
});

// Handle COMMENT
app.post("/api/posts/:id/comments", isLoggedInMiddleware, async (req: any, res: any) => {
  const postId = req.params.id;
  const userId = req.user.id;
  const { content } = req.body;
  try {
    await db.execute({
      sql: "INSERT INTO post_comments (postId, userId, content, createdAt) VALUES (?, ?, ?, ?)",
      args: [postId, userId, content || "", Date.now()]
    });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Gagal simpan komentar" }); }
});

// Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default app;
