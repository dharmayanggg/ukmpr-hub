import express from "express";
import { createClient } from "@libsql/client";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

// --- KONEKSI DATABASE ---
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || "libsql://ukmpr-db-dharmayanggg.aws-ap-northeast-1.turso.io",
  authToken: process.env.TURSO_AUTH_TOKEN as string,
});

const app = express();

// --- CORS & CREDENTIALS ---
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "https://ukmpr-hub.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use(express.json({ limit: "50mb" }));
app.use(cookieParser());

// --- MIDDLEWARE: Cek Login ---
const isLoggedInMiddleware = async (req: any, res: any, next: any) => {
  const sessionId = req.cookies.session_id;
  if (!sessionId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const sessionRes = await db.execute({
      sql: "SELECT * FROM sessions WHERE id = ? AND expiresAt > ?",
      args: [sessionId, Date.now()],
    });
    const session = sessionRes.rows[0] as any;
    if (!session) return res.status(401).json({ error: "Session expired" });

    const userRes = await db.execute({
      sql: "SELECT * FROM members WHERE id = ?",
      args: [session.userId],
    });
    const user = userRes.rows[0] as any;
    if (!user) return res.status(401).json({ error: "User not found" });

    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

// --- HEALTH CHECK ---
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// --- AUTH: Register ---
app.post("/api/auth/register", async (req, res) => {
  const { name, username, password, major, program, entryYear, wa, nim, photo } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const defaultPhoto = photo || null;
    await db.execute({
      sql: `INSERT INTO members (name, username, password, major, program, entryYear, role, wa, nim, photo)
            VALUES (?, ?, ?, ?, ?, ?, 'Anggota', ?, ?, ?)`,
      args: [name || "", username || "", hashedPassword, major || "", program || "", entryYear || 0, wa || null, nim || null, defaultPhoto],
    });
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Gagal register" });
  }
});

// --- AUTH: Login ---
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const userRes = await db.execute({
      sql: "SELECT * FROM members WHERE username = ?",
      args: [username],
    });
    const user = userRes.rows[0] as any;
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ error: "Username atau password salah" });
    }
    const sessionId = crypto.randomUUID();
    const expiresAt = Date.now() + 604800000; // 7 hari
    await db.execute({
      sql: "INSERT INTO sessions (id, userId, expiresAt) VALUES (?, ?, ?)",
      args: [sessionId, user.id, expiresAt],
    });
    res.cookie("session_id", sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 604800000,
    });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: "Login gagal" });
  }
});

// --- AUTH: Me ---
app.get("/api/auth/me", async (req, res) => {
  const sessionId = req.cookies.session_id;
  if (!sessionId) return res.json(null);
  try {
    const sessionRes = await db.execute({
      sql: "SELECT userId FROM sessions WHERE id = ? AND expiresAt > ?",
      args: [sessionId, Date.now()],
    });
    if (sessionRes.rows.length === 0) {
      res.clearCookie("session_id");
      return res.json(null);
    }
    const userRes = await db.execute({
      sql: "SELECT * FROM members WHERE id = ?",
      args: [(sessionRes.rows[0] as any).userId],
    });
    res.json(userRes.rows[0] || null);
  } catch (e) {
    res.json(null);
  }
});

// --- AUTH: Logout ---
app.post("/api/auth/logout", async (req, res) => {
  const sessionId = req.cookies.session_id;
  if (sessionId) {
    await db.execute({ sql: "DELETE FROM sessions WHERE id = ?", args: [sessionId] }).catch(() => {});
  }
  res.clearCookie("session_id");
  res.json({ success: true });
});

// --- POSTS: Get All ---
app.get("/api/posts", async (req, res) => {
  try {
    const postsRes = await db.execute(`
      SELECT posts.*, members.username as authorUsername, members.photo as authorPhoto,
             members.role as authorRole, members.name as authorName
      FROM posts
      JOIN members ON posts.userId = members.id
      ORDER BY posts.createdAt DESC
    `);
    const posts = postsRes.rows as any[];
    const enhancedPosts = await Promise.all(
      posts.map(async (post) => {
        const likesRes = await db.execute({
          sql: "SELECT userId, emoji FROM post_likes WHERE postId = ?",
          args: [post.id],
        });
        const commentsRes = await db.execute({
          sql: `SELECT post_comments.*, members.username as authorUsername, members.photo as authorPhoto
                FROM post_comments
                JOIN members ON post_comments.userId = members.id
                WHERE postId = ? ORDER BY createdAt ASC`,
          args: [post.id],
        });
        const votesRes = await db.execute({
          sql: "SELECT userId, optionIndex FROM post_votes WHERE postId = ?",
          args: [post.id],
        });
        return {
          ...post,
          likes: likesRes.rows,
          comments: commentsRes.rows,
          votes: votesRes.rows,
          poll: post.poll_json ? JSON.parse(post.poll_json) : null,
        };
      })
    );
    res.json(enhancedPosts);
  } catch (e) {
    res.json([]);
  }
});

// --- POSTS: Create ---
app.post("/api/posts", isLoggedInMiddleware, async (req: any, res: any) => {
  const { content, image, poll_json } = req.body;
  try {
    await db.execute({
      sql: "INSERT INTO posts (userId, content, image, poll_json, createdAt) VALUES (?, ?, ?, ?, ?)",
      args: [req.user.id, content || "", image || null, poll_json || null, Date.now()],
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Gagal buat post" });
  }
});

// --- POSTS: Like / Unlike ---
app.post("/api/posts/:id/like", isLoggedInMiddleware, async (req: any, res: any) => {
  const postId = req.params.id;
  const userId = req.user.id;
  const { emoji } = req.body;
  try {
    const existing = await db.execute({
      sql: "SELECT * FROM post_likes WHERE postId = ? AND userId = ?",
      args: [postId, userId],
    });
    if (existing.rows.length > 0) {
      await db.execute({
        sql: "DELETE FROM post_likes WHERE postId = ? AND userId = ?",
        args: [postId, userId],
      });
      res.json({ success: true, action: "unliked" });
    } else {
      await db.execute({
        sql: "INSERT INTO post_likes (postId, userId, emoji) VALUES (?, ?, ?)",
        args: [postId, userId, emoji || "👍"],
      });
      res.json({ success: true, action: "liked" });
    }
  } catch (err) {
    res.status(500).json({ error: "Gagal proses like" });
  }
});

// --- POSTS: Vote ---
app.post("/api/posts/:id/vote", isLoggedInMiddleware, async (req: any, res: any) => {
  const postId = req.params.id;
  const userId = req.user.id;
  const { optionIndex } = req.body;
  try {
    const existing = await db.execute({
      sql: "SELECT * FROM post_votes WHERE postId = ? AND userId = ?",
      args: [postId, userId],
    });
    if (existing.rows.length > 0) {
      await db.execute({
        sql: "UPDATE post_votes SET optionIndex = ? WHERE postId = ? AND userId = ?",
        args: [optionIndex, postId, userId],
      });
    } else {
      await db.execute({
        sql: "INSERT INTO post_votes (postId, userId, optionIndex) VALUES (?, ?, ?)",
        args: [postId, userId, optionIndex],
      });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Gagal vote" });
  }
});

// --- POSTS: Comment ---
app.post("/api/posts/:id/comments", isLoggedInMiddleware, async (req: any, res: any) => {
  const postId = req.params.id;
  const userId = req.user.id;
  const { content } = req.body;
  try {
    await db.execute({
      sql: "INSERT INTO post_comments (postId, userId, content, createdAt) VALUES (?, ?, ?, ?)",
      args: [postId, userId, content || "", Date.now()],
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Gagal simpan komentar" });
  }
});

// --- MENTORS ---
app.get("/api/mentors", async (req, res) => {
  try {
    const result = await db.execute("SELECT * FROM mentors ORDER BY rating DESC");
    res.json(result.rows);
  } catch (e) {
    res.json([]);
  }
});

app.post("/api/mentors", isLoggedInMiddleware, async (req: any, res: any) => {
  const { name, expertise, rating, available, experience, education, achievements, photo } = req.body;
  try {
    await db.execute({
      sql: `INSERT INTO mentors (name, expertise, rating, available, experience, education, achievements, photo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [name, expertise, rating ?? 5, available ?? 1, experience, education, achievements, photo],
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Gagal tambah mentor" });
  }
});

// --- NOTIFICATIONS ---
app.get("/api/notifications", isLoggedInMiddleware, async (req: any, res: any) => {
  try {
    const result = await db.execute({
      sql: "SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC",
      args: [req.user.id],
    });
    res.json(result.rows);
  } catch (e) {
    res.json([]);
  }
});

app.put("/api/notifications/read", isLoggedInMiddleware, async (req: any, res: any) => {
  try {
    await db.execute({
      sql: "UPDATE notifications SET isRead = 1 WHERE userId = ?",
      args: [req.user.id],
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Gagal update notifikasi" });
  }
});

// --- STATS ---
app.get("/api/stats", async (req, res) => {
  try {
    const result = await db.execute("SELECT * FROM stats ORDER BY sort_order ASC");
    res.json(result.rows);
  } catch (e) {
    res.json([]);
  }
});

// --- BANNERS ---
app.get("/api/banners", async (req, res) => {
  try {
    const result = await db.execute("SELECT * FROM banners");
    res.json(result.rows);
  } catch (e) {
    res.json([]);
  }
});

// --- ANNOUNCEMENTS ---
app.get("/api/announcements", async (req, res) => {
  try {
    const result = await db.execute("SELECT * FROM announcements ORDER BY createdAt DESC");
    res.json(result.rows);
  } catch (e) {
    res.json([]);
  }
});

// --- BRAINSTORM CHAT ---
app.get("/api/brainstorm", isLoggedInMiddleware, async (req: any, res: any) => {
  try {
    const result = await db.execute(`
      SELECT brainstorm_chats.*, members.username, members.photo as userPhoto
      FROM brainstorm_chats
      JOIN members ON brainstorm_chats.userId = members.id
      ORDER BY createdAt ASC
    `);
    res.json(result.rows);
  } catch (e) {
    res.json([]);
  }
});

app.post("/api/brainstorm", isLoggedInMiddleware, async (req: any, res: any) => {
  const { role, content } = req.body;
  try {
    await db.execute({
      sql: "INSERT INTO brainstorm_chats (userId, role, content, createdAt) VALUES (?, ?, ?, ?)",
      args: [req.user.id, role || "user", content || "", Date.now()],
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Gagal simpan chat" });
  }
});

// --- MEMBERS (Admin) ---
app.get("/api/members", isLoggedInMiddleware, async (req: any, res: any) => {
  try {
    const result = await db.execute(
      "SELECT id, name, username, major, program, entryYear, gradYear, role, wa, nim, photo, email, bio FROM members ORDER BY name ASC"
    );
    res.json(result.rows);
  } catch (e) {
    res.json([]);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server berjalan di port ${PORT}`);
});

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

export default app;    const result = await db.execute({
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
