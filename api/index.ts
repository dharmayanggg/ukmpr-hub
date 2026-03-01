import express from "express";
import { createClient } from "@libsql/client";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tursoUrl = process.env.TURSO_URL || "libsql://ukmpr-db-dharmayanggg.aws-ap-northeast-1.turso.io";
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN || "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJleHAiOjE4MDM4MDE4MjksImlhdCI6MTc3MjI2NTgyOSwiaWQiOiIwMTljYTM0NC03MTAxLTdmMGItODA2NC1lZTM1MGRmODA1ODQiLCJyaWQiOiI5ZmMwMDUxOC04YjNhLTQzZTYtYTJmZi02NjkwNTExZjM1MjAifQ.5jD8ZnjwwtrcZi3uYzz1cRLcvyzmW51bG-cNDHYi485-c46ynYzw936TW8IoVI_hKsFOGX9mHSwCTSKTMWrDDQ";

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

  // Seed Stats if empty
  const statCount = await db.execute("SELECT COUNT(*) as count FROM stats");
  if (Number(statCount.rows[0].count) === 0) {
    const prestasijson = JSON.stringify([
      { title: "Juara 1 PIMNAS 2023", date: "Okt 2023", desc: "Bidang PKM-K (Kewirausahaan)" },
      { title: "Medali Emas Essay Nasional", date: "Agu 2023", desc: "Lomba di Universitas Indonesia" },
      { title: "Juara 2 Debat Ilmiah", date: "Mei 2023", desc: "Tingkat Regional Bali-Nusa" },
      { title: "Best Paper Conference", date: "Mar 2023", desc: "International Student Conference" }
    ]);
    const publikasijson = JSON.stringify([
      { title: "Jurnal Sinta 2: Analisis Data", date: "Des 2023", desc: "Penulis: Tim Riset UKMPR" },
      { title: "Buku: Metodologi Riset Gen Z", date: "Nov 2023", desc: "Penerbit: Gramedia" },
      { title: "Prosiding Internasional IEEE", date: "Sep 2023", desc: "Topik: AI in Education" }
    ]);
    const anggotajson = JSON.stringify([
      { title: "Divisi Penalaran", count: "45 Orang", desc: "Fokus pada pelatihan KTI" },
      { title: "Divisi Riset", count: "52 Orang", desc: "Fokus pada proyek penelitian" },
      { title: "Divisi Humas", count: "30 Orang", desc: "Fokus pada networking" },
      { title: "Divisi Media", count: "29 Orang", desc: "Fokus pada publikasi konten" }
    ]);
    const alumnijson = JSON.stringify([
      { title: "Angkatan 2018", count: "42 Orang", desc: "Telah lulus dan berkarir" },
      { title: "Angkatan 2019", count: "58 Orang", desc: "Telah lulus dan berkarir" },
      { title: "Angkatan 2020", count: "65 Orang", desc: "Sebagian besar telah lulus" },
      { title: "Angkatan 2021", count: "68 Orang", desc: "Sedang proses tugas akhir" }
    ]);

    await db.batch([
      { sql: "INSERT INTO stats (label, value, icon, color, bg, sort_order, details_json) VALUES (?, ?, ?, ?, ?, ?, ?)", args: ['Prestasi', '18', 'Award', 'text-white', 'bg-gradient-to-br from-blue-500 to-blue-700', 0, prestasijson] },
      { sql: "INSERT INTO stats (label, value, icon, color, bg, sort_order, details_json) VALUES (?, ?, ?, ?, ?, ?, ?)", args: ['Publikasi Karya', '24', 'TrendingUp', 'text-white', 'bg-gradient-to-br from-sky-600 to-blue-800', 1, publikasijson] },
      { sql: "INSERT INTO stats (label, value, icon, color, bg, sort_order, details_json) VALUES (?, ?, ?, ?, ?, ?, ?)", args: ['Anggota Aktif', '156', 'Users', 'text-white', 'bg-gradient-to-br from-indigo-600 to-blue-900', 2, anggotajson] },
      { sql: "INSERT INTO stats (label, value, icon, color, bg, sort_order, details_json) VALUES (?, ?, ?, ?, ?, ?, ?)", args: ['Alumni', '233', 'Award', 'text-white', 'bg-gradient-to-br from-cyan-600 to-blue-700', 3, alumnijson] }
    ]);
  }

  // Seed Banners
  const bannerCount = await db.execute("SELECT COUNT(*) as count FROM banners");
  if (Number(bannerCount.rows[0].count) === 0) {
    await db.batch([
      { sql: "INSERT INTO banners (title, image) VALUES (?, ?)", args: ['Banner 1', 'https://storage.googleapis.com/ai-studio-bucket-353083286262-us-west1/Ukmpr/banner1.png'] },
      { sql: "INSERT INTO banners (title, image) VALUES (?, ?)", args: ['Banner 2', 'https://storage.googleapis.com/ai-studio-bucket-353083286262-us-west1/Ukmpr/banner2.png'] },
      { sql: "INSERT INTO banners (title, image) VALUES (?, ?)", args: ['Banner 3', 'https://storage.googleapis.com/ai-studio-bucket-353083286262-us-west1/Ukmpr/banner3.png'] }
    ]);
  }
  console.log("Database initialized successfully.");
} catch (err) {
  console.error("Database initialization failed:", err);
}
}

// Run initDb (in serverless, this might run on every cold start)
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
  if (!passwordRegex.test(password)) return res.status(400).json({ error: "Password minimal 6 karakter, harus mengandung huruf besar, angka, dan karakter unik (@$!%*?&)." });

  try {
    const existing = await db.execute({ sql: "SELECT id FROM members WHERE username = ?", args: [username] });
    if (existing.rows.length > 0) return res.status(400).json({ error: "Username sudah digunakan" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const defaultPhoto = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
    
    const result = await db.execute({
      sql: `INSERT INTO members (name, username, password, major, program, entryYear, role, wa, nim, photo)
            VALUES (?, ?, ?, ?, ?, ?, 'Member', ?, ?, ?)`,
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

// --- POSTS ROUTES ---
app.get("/api/posts", async (req, res) => {
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
});

app.post("/api/posts", async (req, res) => {
  const { userId, content, image, poll, note, activityLabel } = req.body;
  const poll_json = poll ? JSON.stringify(poll) : null;
  const result = await db.execute({
    sql: "INSERT INTO posts (userId, content, image, poll_json, note, activityLabel, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
    args: [userId, content, image, poll_json, note, activityLabel, Date.now()]
  });
  res.json({ id: Number(result.lastInsertRowid) });
});

app.delete("/api/posts/:id", async (req, res) => {
  const sessionId = req.cookies.session_id;
  if (!sessionId) return res.status(401).json({ error: "Unauthorized" });
  const sessionRes = await db.execute({ sql: "SELECT * FROM sessions WHERE id = ?", args: [sessionId] });
  const session = sessionRes.rows[0] as any;
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const postRes = await db.execute({ sql: "SELECT * FROM posts WHERE id = ?", args: [req.params.id] });
  const post = postRes.rows[0] as any;
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (post.userId !== session.userId) return res.status(403).json({ error: "Forbidden" });

  await db.batch([
    { sql: "DELETE FROM posts WHERE id = ?", args: [req.params.id] },
    { sql: "DELETE FROM post_likes WHERE postId = ?", args: [req.params.id] },
    { sql: "DELETE FROM post_comments WHERE postId = ?", args: [req.params.id] }
  ]);
  res.json({ success: true });
});

app.put("/api/posts/:id", async (req, res) => {
  const sessionId = req.cookies.session_id;
  if (!sessionId) return res.status(401).json({ error: "Unauthorized" });
  const sessionRes = await db.execute({ sql: "SELECT * FROM sessions WHERE id = ?", args: [sessionId] });
  const session = sessionRes.rows[0] as any;
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const postRes = await db.execute({ sql: "SELECT * FROM posts WHERE id = ?", args: [req.params.id] });
  const post = postRes.rows[0] as any;
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (post.userId !== session.userId) return res.status(403).json({ error: "Forbidden" });

  const { content, image, poll, note, activityLabel } = req.body;
  const poll_json = poll ? JSON.stringify(poll) : null;
  await db.execute({
    sql: `UPDATE posts SET content = ?, image = ?, poll_json = ?, note = ?, activityLabel = ? WHERE id = ?`,
    args: [content, image, poll_json, note, activityLabel, req.params.id]
  });
  res.json({ success: true });
});

app.post("/api/posts/:id/like", async (req, res) => {
  const { userId, emoji } = req.body;
  const postId = req.params.id;
  const existing = await db.execute({ sql: "SELECT * FROM post_likes WHERE postId = ? AND userId = ?", args: [postId, userId] });
  if (existing.rows.length > 0) {
    await db.execute({ sql: "DELETE FROM post_likes WHERE postId = ? AND userId = ?", args: [postId, userId] });
  } else {
    await db.execute({ sql: "INSERT INTO post_likes (postId, userId, emoji) VALUES (?, ?, ?)", args: [postId, userId, emoji || '❤️'] });
    
    // Create notification
    const postRes = await db.execute({ sql: "SELECT userId FROM posts WHERE id = ?", args: [postId] });
    const post = postRes.rows[0] as any;
    if (post && post.userId !== userId) {
      await db.execute({
        sql: "INSERT INTO notifications (userId, fromUserId, type, postId, createdAt) VALUES (?, ?, ?, ?, ?)",
        args: [post.userId, userId, 'like', postId, Date.now()]
      });
    }
  }
  res.json({ success: true });
});

app.post("/api/posts/:id/comments", async (req, res) => {
  const { userId, content } = req.body;
  const postId = req.params.id;
  const result = await db.execute({
    sql: "INSERT INTO post_comments (postId, userId, content, createdAt) VALUES (?, ?, ?, ?)",
    args: [postId, userId, content, Date.now()]
  });

  // Create notification
  const postRes = await db.execute({ sql: "SELECT userId FROM posts WHERE id = ?", args: [postId] });
  const post = postRes.rows[0] as any;
  if (post && post.userId !== userId) {
    await db.execute({
      sql: "INSERT INTO notifications (userId, fromUserId, type, postId, content, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
      args: [post.userId, userId, 'comment', postId, content, Date.now()]
    });
  }

  res.json({ id: Number(result.lastInsertRowid) });
});

app.post("/api/posts/:id/vote", async (req, res) => {
  const { userId, optionIndex } = req.body;
  const postId = req.params.id;
  try {
    const existing = await db.execute({ sql: "SELECT * FROM post_votes WHERE postId = ? AND userId = ?", args: [postId, userId] });
    if (existing.rows.length > 0) return res.status(400).json({ error: "Anda sudah memberikan suara" });

    await db.execute({ sql: "INSERT INTO post_votes (postId, userId, optionIndex) VALUES (?, ?, ?)", args: [postId, userId, optionIndex] });
    const postRes = await db.execute({ sql: "SELECT poll_json FROM posts WHERE id = ?", args: [postId] });
    const post = postRes.rows[0] as any;
    if (post && post.poll_json) {
      const poll = JSON.parse(post.poll_json);
      if (poll.options[optionIndex]) {
        poll.options[optionIndex].votes += 1;
        await db.execute({ sql: "UPDATE posts SET poll_json = ? WHERE id = ?", args: [JSON.stringify(poll), postId] });
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Gagal memberikan suara" });
  }
});

// --- BRAINSTORMING ---
app.get('/api/brainstorm/history', async (req, res) => {
  const sessionId = req.cookies.session_id;
  if (!sessionId) return res.status(401).json({ error: "Unauthorized" });
  const sessionRes = await db.execute({ sql: "SELECT * FROM sessions WHERE id = ?", args: [sessionId] });
  const session = sessionRes.rows[0] as any;
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const historyRes = await db.execute({
    sql: "SELECT role, content as text, createdAt FROM brainstorm_chats WHERE userId = ? ORDER BY createdAt ASC",
    args: [session.userId]
  });
  res.json(historyRes.rows);
});

app.post('/api/brainstorm/save', async (req, res) => {
  const sessionId = req.cookies.session_id;
  if (!sessionId) return res.status(401).json({ error: "Unauthorized" });
  const sessionRes = await db.execute({ sql: "SELECT * FROM sessions WHERE id = ?", args: [sessionId] });
  const session = sessionRes.rows[0] as any;
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: "Messages array required" });

  let now = Date.now();
  const batch = messages.map(msg => ({
    sql: "INSERT INTO brainstorm_chats (userId, role, content, createdAt) VALUES (?, ?, ?, ?)",
    args: [session.userId, msg.role, msg.content, now++]
  }));
  await db.batch(batch);
  res.json({ success: true });
});

// --- NOTIFICATIONS ---
app.get("/api/notifications", async (req, res) => {
  const sessionId = req.cookies.session_id;
  if (!sessionId) return res.status(401).json({ error: "Unauthorized" });
  const sessionRes = await db.execute({ sql: "SELECT * FROM sessions WHERE id = ?", args: [sessionId] });
  const session = sessionRes.rows[0] as any;
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const result = await db.execute({
    sql: `SELECT notifications.*, members.username as fromUsername, members.photo as fromPhoto
          FROM notifications
          JOIN members ON notifications.fromUserId = members.id
          WHERE notifications.userId = ?
          ORDER BY notifications.createdAt DESC
          LIMIT 50`,
    args: [session.userId]
  });
  res.json(result.rows);
});

app.put("/api/notifications/read", async (req, res) => {
  const sessionId = req.cookies.session_id;
  if (!sessionId) return res.status(401).json({ error: "Unauthorized" });
  const sessionRes = await db.execute({ sql: "SELECT * FROM sessions WHERE id = ?", args: [sessionId] });
  const session = sessionRes.rows[0] as any;
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  await db.execute({ sql: "UPDATE notifications SET isRead = 1 WHERE userId = ?", args: [session.userId] });
  res.json({ success: true });
});

// --- MEMBERS ---
app.get("/api/posts/user/:userId", async (req, res) => {
  const postsRes = await db.execute({
    sql: `SELECT posts.*, members.username as authorUsername, members.photo as authorPhoto, members.role as authorRole, members.name as authorName
          FROM posts
          JOIN members ON posts.userId = members.id
          WHERE posts.userId = ?
          ORDER BY posts.createdAt DESC`,
    args: [req.params.userId]
  });
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
});

app.get("/api/members", async (req, res) => {
  const result = await db.execute("SELECT id, name, major, program, entryYear, gradYear, role, wa, nim, photo, username FROM members");
  res.json(result.rows);
});

app.get("/api/members/username/:username", async (req, res) => {
  const result = await db.execute({
    sql: "SELECT id, name, major, program, entryYear, gradYear, role, wa, nim, photo, username, bio FROM members WHERE username = ?",
    args: [req.params.username]
  });
  if (result.rows.length === 0) return res.status(404).json({ error: "Member not found" });
  res.json(result.rows[0]);
});

app.post("/api/members", async (req, res) => {
  const { name, major, program, entryYear, gradYear, role, wa, nim, photo } = req.body;
  const existing = await db.execute({ sql: "SELECT id FROM members WHERE name = ? AND nim = ?", args: [name, nim] });
  if (existing.rows.length > 0) {
    const id = existing.rows[0].id;
    await db.execute({
      sql: `UPDATE members SET major = ?, program = ?, entryYear = ?, gradYear = ?, role = ?, wa = ?, photo = ? WHERE id = ?`,
      args: [major, program, entryYear, gradYear, role, wa, photo, id]
    });
    res.json({ id, updated: true });
  } else {
    const result = await db.execute({
      sql: `INSERT INTO members (name, major, program, entryYear, gradYear, role, wa, nim, photo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [name, major, program, entryYear, gradYear, role, wa, nim, photo]
    });
    res.json({ id: Number(result.lastInsertRowid), updated: false });
  }
});

app.delete("/api/members/:id", isAdminMiddleware, async (req, res) => {
  await db.execute({ sql: "DELETE FROM members WHERE id = ?", args: [req.params.id] });
  res.json({ success: true });
});

app.put("/api/members/:id", isAdminMiddleware, async (req, res) => {
  const { name, major, program, entryYear, gradYear, role, wa, nim, photo, username, password } = req.body;
  try {
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await db.execute({
        sql: `UPDATE members SET name = ?, major = ?, program = ?, entryYear = ?, gradYear = ?, role = ?, wa = ?, nim = ?, photo = ?, username = ?, password = ? WHERE id = ?`,
        args: [name, major, program, entryYear, gradYear, role, wa, nim, photo, username, hashedPassword, req.params.id]
      });
    } else {
      await db.execute({
        sql: `UPDATE members SET name = ?, major = ?, program = ?, entryYear = ?, gradYear = ?, role = ?, wa = ?, nim = ?, photo = ?, username = ? WHERE id = ?`,
        args: [name, major, program, entryYear, gradYear, role, wa, nim, photo, username, req.params.id]
      });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Gagal memperbarui member" });
  }
});

// --- RESEARCH ---
app.get("/api/research", async (req, res) => {
  const result = await db.execute("SELECT * FROM research ORDER BY id DESC");
  res.json(result.rows);
});

app.post("/api/research", isAdminMiddleware, async (req, res) => {
  const { title, category, author, year } = req.body;
  const result = await db.execute({
    sql: "INSERT INTO research (title, category, author, year) VALUES (?, ?, ?, ?)",
    args: [title, category, author, year]
  });
  res.json({ id: Number(result.lastInsertRowid) });
});

app.put("/api/research/:id", isAdminMiddleware, async (req, res) => {
  const { title, category, author, year } = req.body;
  await db.execute({
    sql: "UPDATE research SET title = ?, category = ?, author = ?, year = ? WHERE id = ?",
    args: [title, category, author, year, req.params.id]
  });
  res.json({ success: true });
});

app.delete("/api/research/:id", isAdminMiddleware, async (req, res) => {
  await db.execute({ sql: "DELETE FROM research WHERE id = ?", args: [req.params.id] });
  res.json({ success: true });
});

// --- ANNOUNCEMENTS ---
app.get("/api/announcements", async (req, res) => {
  const result = await db.execute("SELECT * FROM announcements ORDER BY id DESC");
  res.json(result.rows);
});

app.post("/api/announcements", isLoggedInMiddleware, async (req, res) => {
  const { project, roleNeeded, initiator, deadline, wa } = req.body;
  const result = await db.execute({
    sql: "INSERT INTO announcements (project, roleNeeded, initiator, deadline, wa) VALUES (?, ?, ?, ?, ?)",
    args: [project, roleNeeded, initiator, deadline, wa]
  });
  res.json({ id: Number(result.lastInsertRowid) });
});

app.put("/api/announcements/:id", isAdminMiddleware, async (req, res) => {
  const { project, roleNeeded, initiator, deadline, wa } = req.body;
  await db.execute({
    sql: "UPDATE announcements SET project = ?, roleNeeded = ?, initiator = ?, deadline = ?, wa = ? WHERE id = ?",
    args: [project, roleNeeded, initiator, deadline, wa, req.params.id]
  });
  res.json({ success: true });
});

app.delete("/api/announcements/:id", isAdminMiddleware, async (req, res) => {
  await db.execute({ sql: "DELETE FROM announcements WHERE id = ?", args: [req.params.id] });
  res.json({ success: true });
});

// --- MENTORS ---
app.get("/api/mentors", async (req, res) => {
  const result = await db.execute("SELECT * FROM mentors");
  res.json(result.rows);
});

app.post("/api/mentors", isAdminMiddleware, async (req, res) => {
  const { name, expertise, rating, available, experience, education, achievements, photo } = req.body;
  const result = await db.execute({
    sql: "INSERT INTO mentors (name, expertise, rating, available, experience, education, achievements, photo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    args: [name, expertise, rating, available, experience, education, achievements, photo]
  });
  res.json({ id: Number(result.lastInsertRowid) });
});

app.put("/api/mentors/:id", isAdminMiddleware, async (req, res) => {
  const { name, expertise, rating, available, experience, education, achievements, photo } = req.body;
  await db.execute({
    sql: "UPDATE mentors SET name = ?, expertise = ?, rating = ?, available = ?, experience = ?, education = ?, achievements = ?, photo = ? WHERE id = ?",
    args: [name, expertise, rating, available, experience, education, achievements, photo, req.params.id]
  });
  res.json({ success: true });
});

app.delete("/api/mentors/:id", isAdminMiddleware, async (req, res) => {
  await db.execute({ sql: "DELETE FROM mentors WHERE id = ?", args: [req.params.id] });
  res.json({ success: true });
});

// --- BANNERS ---
app.get("/api/banners", async (req, res) => {
  const result = await db.execute("SELECT * FROM banners");
  res.json(result.rows);
});

app.post("/api/banners", isAdminMiddleware, async (req, res) => {
  const { title, image } = req.body;
  const result = await db.execute({ sql: "INSERT INTO banners (title, image) VALUES (?, ?)", args: [title, image] });
  res.json({ id: Number(result.lastInsertRowid) });
});

app.put("/api/banners/:id", isAdminMiddleware, async (req, res) => {
  const { title, image } = req.body;
  await db.execute({ sql: "UPDATE banners SET title = ?, image = ? WHERE id = ?", args: [title, image, req.params.id] });
  res.json({ success: true });
});

app.delete("/api/banners/:id", isAdminMiddleware, async (req, res) => {
  await db.execute({ sql: "DELETE FROM banners WHERE id = ?", args: [req.params.id] });
  res.json({ success: true });
});

// --- STATS ---
app.get("/api/stats", async (req, res) => {
  const result = await db.execute("SELECT * FROM stats ORDER BY sort_order ASC");
  res.json(result.rows);
});

app.post("/api/stats", isAdminMiddleware, async (req, res) => {
  try {
    const { label, value, icon, color, bg, sort_order, details_json } = req.body;
    const result = await db.execute({
      sql: "INSERT INTO stats (label, value, icon, color, bg, sort_order, details_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [
        label || "Stat Baru", 
        value || "0", 
        icon || "Award", 
        color || "text-white", 
        bg || "bg-gradient-to-br from-blue-500 to-blue-700", 
        sort_order || 0, 
        details_json || "[]"
      ]
    });
    res.json({ id: Number(result.lastInsertRowid) });
  } catch (err: any) {
    console.error("Error creating stat:", err);
    res.status(500).json({ error: err.message || "Gagal membuat stat" });
  }
});

app.put("/api/stats/:id", isAdminMiddleware, async (req, res) => {
  try {
    const { label, value, icon, color, bg, sort_order, details_json } = req.body;
    await db.execute({
      sql: "UPDATE stats SET label = ?, value = ?, icon = ?, color = ?, bg = ?, sort_order = ?, details_json = ? WHERE id = ?",
      args: [
        label || "Stat", 
        value || "0", 
        icon || "Award", 
        color || "text-white", 
        bg || "bg-gradient-to-br from-blue-500 to-blue-700", 
        sort_order || 0, 
        details_json || "[]", 
        req.params.id
      ]
    });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error updating stat:", err);
    res.status(500).json({ error: err.message || "Gagal memperbarui stat" });
  }
});

app.delete("/api/stats/:id", isAdminMiddleware, async (req, res) => {
  await db.execute({ sql: "DELETE FROM stats WHERE id = ?", args: [req.params.id] });
  res.json({ success: true });
});

app.get("/api/stats/:id/details", async (req, res) => {
  const result = await db.execute({ sql: "SELECT * FROM stats WHERE id = ?", args: [req.params.id] });
  const stat = result.rows[0] as any;
  if (!stat) return res.status(404).json({ error: "Stat not found" });
  res.json({ label: stat.label, details: stat.details_json ? JSON.parse(stat.details_json) : [] });
});

// --- PROFILE ---
app.put("/api/profile/me", async (req, res) => {
  const sessionId = req.cookies.session_id;
  if (!sessionId) return res.status(401).json({ error: "Unauthorized" });
  const sessionRes = await db.execute({ sql: "SELECT * FROM sessions WHERE id = ? AND expiresAt > ?", args: [sessionId, Date.now()] });
  const session = sessionRes.rows[0] as any;
  if (!session) return res.status(401).json({ error: "Session expired" });

  const { name, major, program, entryYear, gradYear, role, wa, nim, photo, bio, username } = req.body;
  try {
    await db.execute({
      sql: `UPDATE members SET name = ?, major = ?, program = ?, entryYear = ?, gradYear = ?, role = ?, wa = ?, nim = ?, photo = ?, bio = ?, username = ? WHERE id = ?`,
      args: [name, major, program, entryYear, gradYear, role, wa, nim, photo, bio, username, session.userId]
    });
    const userRes = await db.execute({ sql: "SELECT * FROM members WHERE id = ?", args: [session.userId] });
    res.json({ success: true, user: userRes.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: "Gagal memperbarui profil" });
  }
});

// Vite middleware for development
const startVite = async () => {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "../dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "../dist", "index.html"));
    });
  }
};

startVite().catch(console.error);

// Export app for Vercel
export default app;

// For local development and non-serverless environments
const startServer = () => {
  const PORT = Number(process.env.PORT) || 3000;
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${PORT} is already in use, trying port ${PORT + 1}...`);
      const nextPort = PORT + 1;
      const retryServer = app.listen(nextPort, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${nextPort}`);
      });
      retryServer.on('error', (retryErr: any) => {
        if (retryErr.code === 'EADDRINUSE') {
          console.error(`Ports ${PORT} and ${nextPort} are both in use. Please free up a port.`);
          process.exit(1);
        }
      });
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });
};

startServer();
