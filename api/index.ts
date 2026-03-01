import express from "express";
import { createClient } from "@libsql/client";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const tursoUrl = process.env.TURSO_DATABASE_URL as string;
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN as string;

const db = createClient({
  url: tursoUrl,
  authToken: tursoAuthToken,
});

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Initialize Database Schema
async function initDb() {
  console.log("Initializing database with URL:", tursoUrl);
  try {
    await db.batch([
    `CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT UNIQUE,
      password TEXT,
      major TEXT NOT NULL,
      program TEXT NOT NULL,
      entryYear INTEGER NOT NULL,
      gradYear INTEGER,
      role TEXT NOT NULL,
      wa TEXT,
      nim TEXT,
      photo TEXT,
      email TEXT UNIQUE,
      googleId TEXT UNIQUE,
      bio TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS post_likes (
      postId INTEGER,
      userId INTEGER,
      emoji TEXT,
      PRIMARY KEY(postId, userId)
    )`,
    `CREATE TABLE IF NOT EXISTS post_votes (
      postId INTEGER,
      userId INTEGER,
      optionIndex INTEGER,
      PRIMARY KEY(postId, userId)
    )`,
    `CREATE TABLE IF NOT EXISTS brainstorm_chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS post_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      postId INTEGER,
      userId INTEGER,
      content TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      content TEXT,
      likes INTEGER DEFAULT 0,
      image TEXT,
      poll_json TEXT,
      note TEXT,
      activityLabel TEXT,
      createdAt INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      userId INTEGER NOT NULL,
      expiresAt INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS research (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      author TEXT NOT NULL,
      year INTEGER NOT NULL,
      downloads INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project TEXT NOT NULL,
      roleNeeded TEXT NOT NULL,
      initiator TEXT NOT NULL,
      status TEXT DEFAULT 'Open',
      deadline TEXT NOT NULL,
      wa TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS mentors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      expertise TEXT NOT NULL,
      rating REAL DEFAULT 5.0,
      available INTEGER DEFAULT 1,
      experience TEXT,
      education TEXT,
      achievements TEXT,
      photo TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS banners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      image TEXT NOT NULL,
      link TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      value TEXT NOT NULL,
      icon TEXT NOT NULL,
      color TEXT NOT NULL,
      bg TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      details_json TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      fromUserId INTEGER NOT NULL,
      type TEXT NOT NULL,
      postId INTEGER,
      content TEXT,
      isRead INTEGER DEFAULT 0,
      createdAt INTEGER NOT NULL
    )`
  ], "write");

  // Migrations
  const columns = {
    members: ["bio"],
    posts: ["image", "poll_json", "note", "activityLabel"]
  };

  for (const [table, cols] of Object.entries(columns)) {
    for (const col of cols) {
      try {
        await db.execute(`ALTER TABLE ${table} ADD COLUMN ${col} TEXT`);
      } catch (e: any) {
        // Ignore duplicate column errors
      }
    }
  }

  // Seed Admin
  const adminCheck = await db.execute({
    sql: "SELECT * FROM members WHERE username = ?",
    args: ["admin1"]
  });

  if (adminCheck.rows.length === 0) {
    const hashedPassword = await bcrypt.hash('adm1', 10);
    await db.execute({
      sql: `INSERT INTO members (name, username, password, major, program, entryYear, role, wa, nim, photo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: ['Super Admin', 'admin1', hashedPassword, 'Sistem Informasi', 'Teknologi Informasi', 2020, 'Admin', '081234567890', '00000000', 'https://ui-avatars.com/api/?name=Admin&background=random']
    });
  }

  console.log("Database initialized successfully.");
} catch (err) {
  console.error("Database initialization failed:", err);
}
}

initDb().catch(console.error);

// Middleware to check if user is logged in
const isLoggedInMiddleware = async (req: any, res: any, next: any) => {
  const sessionId = req.cookies.session_id;
  if (!sessionId) return res.status(401).json({ error: "Unauthorized" });
  
  const sessionRes = await db.execute({
    sql: "SELECT * FROM sessions WHERE id = ? AND expiresAt > ?",
    args: [sessionId, Date.now()]
  });
  const session = sessionRes.rows[0] as any;

  if (!session) {
    return res.status(401).json({ error: "Session expired" });
  }
  
  const userRes = await db.execute({
    sql: "SELECT * FROM members WHERE id = ?",
    args: [session.userId]
  });
  const user = userRes.rows[0] as any;

  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }
  
  req.user = user;
  next();
};

// Middleware to check if user is admin
const isAdminMiddleware = async (req: any, res: any, next: any) => {
  const sessionId = req.cookies.session_id;
  if (!sessionId) return res.status(401).json({ error: "Unauthorized" });
  
  const sessionRes = await db.execute({
    sql: "SELECT * FROM sessions WHERE id = ?",
    args: [sessionId]
  });
  const session = sessionRes.rows[0] as any;

  if (!session || session.expiresAt < Date.now()) {
    return res.status(401).json({ error: "Session expired" });
  }
  
  const userRes = await db.execute({
    sql: "SELECT * FROM members WHERE id = ?",
    args: [session.userId]
  });
  const user = userRes.rows[0] as any;

  if (!user || user.role !== 'Admin') {
    return res.status(403).json({ error: "Forbidden: Admin access required" });
  }
  
  req.user = user;
  next();
};

// --- AUTH ROUTES ---
app.post("/api/auth/register", isAdminMiddleware, async (req, res) => {
  const { name, username, password, major, program, entryYear, gradYear, role, wa, nim, photo } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.execute({
      sql: `INSERT INTO members (name, username, password, major, program, entryYear, gradYear, role, wa, nim, photo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [name, username, hashedPassword, major, program, entryYear, gradYear, role, wa, nim, photo]
    });
    res.json({ id: Number(result.lastInsertRowid) });
  } catch (err: any) {
    if (err.message.includes("UNIQUE constraint failed")) {
      res.status(400).json({ error: "Username sudah digunakan" });
    } else {
      res.status(500).json({ error: "Gagal mendaftarkan member" });
    }
  }
});

app.post("/api/auth/public-register", async (req, res) => {
  const { name, username, password, major, program, entryYear, wa, nim } = req.body;
  if (!username || !password || !name) return res.status(400).json({ error: "Nama, username, dan password wajib diisi" });

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;
  if (!passwordRegex.test(password)) return res.status(400).json({ error: "Password minimal 6 karakter." });

  try {
    const existing = await db.execute({ sql: "SELECT id FROM members WHERE username = ?", args: [username] });
    if (existing.rows.length > 0) return res.status(400).json({ error: "Username sudah digunakan" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const defaultPhoto = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
    
    const result = await db.execute({
      sql: `INSERT INTO members (name, username, password, major, program, entryYear, role, wa, nim, photo)
            VALUES (?, ?, ?, ?, ?, ?, 'Anggota', ?, ?, ?)`,
      args: [name, username, hashedPassword, major, program, entryYear, wa, nim, defaultPhoto]
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
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ error: "Username atau password salah" });
    }

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
  if (!session) {
    res.clearCookie("session_id");
    return res.json(null);
  }

  const userRes = await db.execute({ sql: "SELECT * FROM members WHERE id = ?", args: [session.userId] });
  res.json(userRes.rows[0]);
});

app.post("/api/auth/logout", async (req, res) => {
  const sessionId = req.cookies.session_id;
  if (sessionId) await db.execute({ sql: "DELETE FROM sessions WHERE id = ?", args: [sessionId] });
  res.clearCookie("session_id");
  res.json({ success: true });
});

// --- ROUTES LAINNYA ---
app.get("/api/posts", async (req, res) => {
  try {
    const postsRes = await db.execute(`
      SELECT posts.*, members.username as authorUsername, members.photo as authorPhoto, members.role as authorRole, members.name as authorName
      FROM posts
      JOIN members ON posts.userId = members.id
      ORDER BY posts.createdAt DESC
    `);
    const posts = postsRes.rows as any[];

    const enhancedPosts = await Promise.all(posts.map(async post => {
      const likesRes = await db.execute({ sql: "SELECT userId, emoji FROM post_likes WHERE postId = ?", args: [post.id] });
      const commentsRes = await db.execute({
        sql: `SELECT post_comments.*, members.username as authorUsername, members.photo as authorPhoto
              FROM post_comments
              JOIN members ON post_comments.userId = members.id
              WHERE postId = ?
              ORDER BY createdAt ASC`,
        args: [post.id]
      });
      return {
        ...post,
        likes: likesRes.rows,
        comments: commentsRes.rows,
        poll: post.poll_json ? JSON.parse(post.poll_json) : null
      };
    }));
    res.json(enhancedPosts);
  } catch(e) { res.json([]) }
});

app.get("/api/members", async (req, res) => {
  try {
    const result = await db.execute("SELECT id, name, major, program, entryYear, gradYear, role, wa, nim, photo, username FROM members");
    res.json(result.rows);
  } catch(e) { res.json([]) }
});

app.get("/api/stats", async (req, res) => {
  try {
    const result = await db.execute("SELECT * FROM stats ORDER BY sort_order ASC");
    res.json(result.rows);
  } catch(e) { res.json([]) }
});

app.get("/api/banners", async (req, res) => {
  try {
    const result = await db.execute("SELECT * FROM banners");
    res.json(result.rows);
  } catch(e) { res.json([]) }
});

app.get("/api/announcements", async (req, res) => {
  try {
    const result = await db.execute("SELECT * FROM announcements ORDER BY id DESC");
    res.json(result.rows);
  } catch(e) { res.json([]) }
});

app.get("/api/mentors", async (req, res) => {
  try {
    const result = await db.execute("SELECT * FROM mentors");
    res.json(result.rows);
  } catch(e) { res.json([]) }
});

app.get("/api/research", async (req, res) => {
  try {
    const result = await db.execute("SELECT * FROM research ORDER BY id DESC");
    res.json(result.rows);
  } catch(e) { res.json([]) }
});

app.get("/api/notifications", async (req, res) => {
  res.json([]);
});

// Export app for Vercel
export default app;
