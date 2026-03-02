import express from "express";
import { createClient } from "@libsql/client";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL as string,
  authToken: process.env.TURSO_AUTH_TOKEN as string,
});

const app = express();

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use(express.json({ limit: "50mb" }));
app.use(cookieParser());

const auth = async (req: any, res: any, next: any) => {
  const sessionId = req.cookies.session_id;
  if (!sessionId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const s = await db.execute({ sql: "SELECT * FROM sessions WHERE id = ? AND expiresAt > ?", args: [sessionId, Date.now()] });
    if (!s.rows[0]) return res.status(401).json({ error: "Session expired" });
    const u = await db.execute({ sql: "SELECT * FROM members WHERE id = ?", args: [(s.rows[0] as any).userId] });
    if (!u.rows[0]) return res.status(401).json({ error: "User not found" });
    req.user = u.rows[0];
    next();
  } catch { res.status(500).json({ error: "Server error" }); }
};

const adminAuth = async (req: any, res: any, next: any) => {
  await auth(req, res, () => {
    if ((req.user as any)?.role !== 'Admin') return res.status(403).json({ error: "Forbidden" });
    next();
  });
};

app.get("/api/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

// AUTH
app.post("/api/auth/public-register", async (req, res) => {
  const { name, username, password, major, program, entryYear, wa, nim, photo, role } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    await db.execute({
      sql: `INSERT INTO members (name, username, password, major, program, entryYear, role, wa, nim, photo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [name||"", username||"", hashed, major||"", program||"", entryYear||0, role||"Anggota", wa||null, nim||null, photo||null],
    });
    res.status(201).json({ success: true });
  } catch (err: any) { 
    res.status(500).json({ error: err.message || "Gagal register" }); 
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const r = await db.execute({ sql: "SELECT * FROM members WHERE username = ?", args: [username] });
    const user = r.rows[0] as any;
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ error: "Username atau password salah" });
    const sessionId = crypto.randomUUID();
    await db.execute({ sql: "INSERT INTO sessions (id, userId, expiresAt) VALUES (?, ?, ?)", args: [sessionId, user.id, Date.now()+604800000] });
    res.cookie("session_id", sessionId, { httpOnly: true, secure: true, sameSite: "none", maxAge: 604800000 });
    res.json({ success: true, user });
  } catch { res.status(500).json({ error: "Login gagal" }); }
});

app.get("/api/auth/me", async (req, res) => {
  const sessionId = req.cookies.session_id;
  if (!sessionId) return res.json(null);
  try {
    const s = await db.execute({ sql: "SELECT userId FROM sessions WHERE id = ? AND expiresAt > ?", args: [sessionId, Date.now()] });
    if (!s.rows[0]) { res.clearCookie("session_id"); return res.json(null); }
    const u = await db.execute({ sql: "SELECT * FROM members WHERE id = ?", args: [(s.rows[0] as any).userId] });
    res.json(u.rows[0] || null);
  } catch { res.json(null); }
});

app.post("/api/auth/logout", async (req, res) => {
  const sessionId = req.cookies.session_id;
  if (sessionId) await db.execute({ sql: "DELETE FROM sessions WHERE id = ?", args: [sessionId] }).catch(()=>{});
  res.clearCookie("session_id");
  res.json({ success: true });
});

// PROFILE
app.put("/api/profile/me", auth, async (req: any, res: any) => {
  const { name, username, bio, photo } = req.body;
  try {
    await db.execute({ sql: "UPDATE members SET name=?, username=?, bio=?, photo=? WHERE id=?", args: [name, username, bio||null, photo||null, req.user.id] });
    const u = await db.execute({ sql: "SELECT * FROM members WHERE id=?", args: [req.user.id] });
    res.json({ success: true, user: u.rows[0] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POSTS
app.get("/api/posts", async (req, res) => {
  try {
    const p = await db.execute(`SELECT posts.*, members.username as authorUsername, members.photo as authorPhoto, members.role as authorRole, members.name as authorName FROM posts JOIN members ON posts.userId = members.id ORDER BY posts.createdAt DESC`);
    const enhanced = await Promise.all((p.rows as any[]).map(async post => {
      const likes = await db.execute({ sql: "SELECT userId, emoji FROM post_likes WHERE postId=?", args: [post.id] });
      const comments = await db.execute({ sql: `SELECT post_comments.*, members.username as authorUsername, members.photo as authorPhoto FROM post_comments JOIN members ON post_comments.userId=members.id WHERE postId=? ORDER BY createdAt ASC`, args: [post.id] });
      const votes = await db.execute({ sql: "SELECT userId, optionIndex FROM post_votes WHERE postId=?", args: [post.id] });
      return { ...post, likes: likes.rows, comments: comments.rows, votes: votes.rows, poll: post.poll_json ? JSON.parse(post.poll_json) : null };
    }));
    res.json(enhanced);
  } catch { res.json([]); }
});

app.post("/api/posts", auth, async (req: any, res: any) => {
  const { content, image, poll_json } = req.body;
  try {
    await db.execute({ sql: "INSERT INTO posts (userId, content, image, poll_json, createdAt) VALUES (?,?,?,?,?)", args: [req.user.id, content||"", image||null, poll_json||null, Date.now()] });
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Gagal buat post" }); }
});

app.delete("/api/posts/:id", auth, async (req: any, res: any) => {
  try {
    await db.execute({ sql: "DELETE FROM posts WHERE id=? AND userId=?", args: [req.params.id, req.user.id] });
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Gagal hapus post" }); }
});

app.post("/api/posts/:id/like", auth, async (req: any, res: any) => {
  const { emoji } = req.body;
  try {
    const ex = await db.execute({ sql: "SELECT * FROM post_likes WHERE postId=? AND userId=?", args: [req.params.id, req.user.id] });
    if (ex.rows.length > 0) {
      await db.execute({ sql: "DELETE FROM post_likes WHERE postId=? AND userId=?", args: [req.params.id, req.user.id] });
      res.json({ success: true, action: "unliked" });
    } else {
      await db.execute({ sql: "INSERT INTO post_likes (postId, userId, emoji) VALUES (?,?,?)", args: [req.params.id, req.user.id, emoji||"👍"] });
      res.json({ success: true, action: "liked" });
    }
  } catch { res.status(500).json({ error: "Gagal like" }); }
});

app.post("/api/posts/:id/vote", auth, async (req: any, res: any) => {
  const { optionIndex } = req.body;
  try {
    const ex = await db.execute({ sql: "SELECT * FROM post_votes WHERE postId=? AND userId=?", args: [req.params.id, req.user.id] });
    if (ex.rows.length > 0) {
      await db.execute({ sql: "UPDATE post_votes SET optionIndex=? WHERE postId=? AND userId=?", args: [optionIndex, req.params.id, req.user.id] });
    } else {
      await db.execute({ sql: "INSERT INTO post_votes (postId, userId, optionIndex) VALUES (?,?,?)", args: [req.params.id, req.user.id, optionIndex] });
    }
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Gagal vote" }); }
});

app.post("/api/posts/:id/comments", auth, async (req: any, res: any) => {
  const { content } = req.body;
  try {
    await db.execute({ sql: "INSERT INTO post_comments (postId, userId, content, createdAt) VALUES (?,?,?,?)", args: [req.params.id, req.user.id, content||"", Date.now()] });
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Gagal komentar" }); }
});

// STATS
app.get("/api/stats", async (req, res) => {
  try { res.json((await db.execute("SELECT * FROM stats ORDER BY sort_order ASC")).rows); } catch { res.json([]); }
});
app.get("/api/stats/:id/details", async (req, res) => {
  try {
    const r = await db.execute({ sql: "SELECT details_json FROM stats WHERE id=?", args: [req.params.id] });
    res.json(r.rows[0] ? JSON.parse((r.rows[0] as any).details_json || "[]") : []);
  } catch { res.json([]); }
});
app.post("/api/stats", adminAuth, async (req: any, res: any) => {
  const { label, value, icon, color, bg, sort_order, details_json } = req.body;
  try {
    await db.execute({ sql: "INSERT INTO stats (label, value, icon, color, bg, sort_order, details_json) VALUES (?,?,?,?,?,?,?)", args: [label, value, icon, color||"text-white", bg, sort_order||0, details_json||"[]"] });
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});
app.put("/api/stats/:id", adminAuth, async (req: any, res: any) => {
  const { label, value, icon, color, bg, sort_order, details_json } = req.body;
  try {
    await db.execute({ sql: "UPDATE stats SET label=?,value=?,icon=?,color=?,bg=?,sort_order=?,details_json=? WHERE id=?", args: [label, value, icon, color||"text-white", bg, sort_order||0, details_json||"[]", req.params.id] });
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Gagal update stat" }); }
});
app.delete("/api/stats/:id", adminAuth, async (req: any, res: any) => {
  try { await db.execute({ sql: "DELETE FROM stats WHERE id=?", args: [req.params.id] }); res.json({ success: true }); }
  catch { res.status(500).json({ error: "Gagal hapus stat" }); }
});

// BANNERS
app.get("/api/banners", async (req, res) => {
  try { res.json((await db.execute("SELECT * FROM banners")).rows); } catch { res.json([]); }
});
app.post("/api/banners", adminAuth, async (req: any, res: any) => {
  const { title, image, link } = req.body;
  try {
    await db.execute({ sql: "INSERT INTO banners (title, image, link) VALUES (?,?,?)", args: [title, image, link||null] });
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Gagal tambah banner" }); }
});
app.put("/api/banners/:id", adminAuth, async (req: any, res: any) => {
  const { title, image, link } = req.body;
  try {
    await db.execute({ sql: "UPDATE banners SET title=?,image=?,link=? WHERE id=?", args: [title, image, link||null, req.params.id] });
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Gagal update banner" }); }
});
app.delete("/api/banners/:id", adminAuth, async (req: any, res: any) => {
  try { await db.execute({ sql: "DELETE FROM banners WHERE id=?", args: [req.params.id] }); res.json({ success: true }); }
  catch { res.status(500).json({ error: "Gagal hapus banner" }); }
});

// ANNOUNCEMENTS
app.get("/api/announcements", async (req, res) => {
  try { res.json((await db.execute("SELECT * FROM announcements ORDER BY createdAt DESC")).rows); } catch { res.json([]); }
});
app.post("/api/announcements", auth, async (req: any, res: any) => {
  const { project, roleNeeded, initiator, deadline, wa } = req.body;
  try {
    await db.execute({ sql: "INSERT INTO announcements (project, roleNeeded, initiator, deadline, wa, createdAt) VALUES (?,?,?,?,?,?)", args: [project, roleNeeded, initiator, deadline||null, wa||null, Date.now()] });
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});
app.put("/api/announcements/:id", adminAuth, async (req: any, res: any) => {
  const { project, roleNeeded, initiator, deadline, wa } = req.body;
  try {
    await db.execute({ sql: "UPDATE announcements SET project=?,roleNeeded=?,initiator=?,deadline=?,wa=? WHERE id=?", args: [project, roleNeeded, initiator, deadline||null, wa||null, req.params.id] });
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Gagal update pengumuman" }); }
});
app.delete("/api/announcements/:id", adminAuth, async (req: any, res: any) => {
  try { await db.execute({ sql: "DELETE FROM announcements WHERE id=?", args: [req.params.id] }); res.json({ success: true }); }
  catch { res.status(500).json({ error: "Gagal hapus pengumuman" }); }
});

// RESEARCH
app.get("/api/research", async (req, res) => {
  try { res.json((await db.execute("SELECT * FROM research ORDER BY year DESC")).rows); } catch { res.json([]); }
});
app.post("/api/research", auth, async (req: any, res: any) => {
  const { title, category, author, year } = req.body;
  try {
    await db.execute({ sql: "INSERT INTO research (title, category, author, year) VALUES (?,?,?,?)", args: [title, category, author, year] });
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Gagal tambah riset" }); }
});
app.put("/api/research/:id", adminAuth, async (req: any, res: any) => {
  const { title, category, author, year } = req.body;
  try {
    await db.execute({ sql: "UPDATE research SET title=?,category=?,author=?,year=? WHERE id=?", args: [title, category, author, year, req.params.id] });
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Gagal update riset" }); }
});
app.delete("/api/research/:id", adminAuth, async (req: any, res: any) => {
  try { await db.execute({ sql: "DELETE FROM research WHERE id=?", args: [req.params.id] }); res.json({ success: true }); }
  catch { res.status(500).json({ error: "Gagal hapus riset" }); }
});

// MENTORS
app.get("/api/mentors", async (req, res) => {
  try { res.json((await db.execute("SELECT * FROM mentors ORDER BY rating DESC")).rows); } catch { res.json([]); }
});
app.post("/api/mentors", adminAuth, async (req: any, res: any) => {
  const { name, expertise, rating, available, experience, education, achievements, photo } = req.body;
  try {
    await db.execute({ sql: "INSERT INTO mentors (name, expertise, rating, available, experience, education, achievements, photo) VALUES (?,?,?,?,?,?,?,?)", args: [name, expertise, rating??5, available??1, experience, education, achievements, photo] });
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Gagal tambah mentor" }); }
});
app.put("/api/mentors/:id", adminAuth, async (req: any, res: any) => {
  const { name, expertise, rating, available, experience, education, achievements, photo } = req.body;
  try {
    await db.execute({ sql: "UPDATE mentors SET name=?,expertise=?,rating=?,available=?,experience=?,education=?,achievements=?,photo=? WHERE id=?", args: [name, expertise, rating??5, available??1, experience, education, achievements, photo, req.params.id] });
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Gagal update mentor" }); }
});
app.delete("/api/mentors/:id", adminAuth, async (req: any, res: any) => {
  try { await db.execute({ sql: "DELETE FROM mentors WHERE id=?", args: [req.params.id] }); res.json({ success: true }); }
  catch { res.status(500).json({ error: "Gagal hapus mentor" }); }
});

// MEMBERS
app.get("/api/members", auth, async (req: any, res: any) => {
  try { res.json((await db.execute("SELECT id,name,username,major,program,entryYear,gradYear,role,wa,nim,photo,email,bio FROM members ORDER BY name ASC")).rows); }
  catch { res.json([]); }
});
app.put("/api/members/:id", adminAuth, async (req: any, res: any) => {
  const { name, username, nim, role, major, program, entryYear, gradYear, wa, photo, password } = req.body;
  try {
    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      await db.execute({ sql: "UPDATE members SET name=?,username=?,nim=?,role=?,major=?,program=?,entryYear=?,gradYear=?,wa=?,photo=?,password=? WHERE id=?", args: [name,username,nim,role,major,program,entryYear,gradYear||null,wa,photo,hashed,req.params.id] });
    } else {
      await db.execute({ sql: "UPDATE members SET name=?,username=?,nim=?,role=?,major=?,program=?,entryYear=?,gradYear=?,wa=?,photo=? WHERE id=?", args: [name,username,nim,role,major,program,entryYear,gradYear||null,wa,photo,req.params.id] });
    }
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/members/:id", adminAuth, async (req: any, res: any) => {
  try { await db.execute({ sql: "DELETE FROM members WHERE id=?", args: [req.params.id] }); res.json({ success: true }); }
  catch { res.status(500).json({ error: "Gagal hapus member" }); }
});

// NOTIFICATIONS
app.get("/api/notifications", auth, async (req: any, res: any) => {
  try { res.json((await db.execute({ sql: "SELECT * FROM notifications WHERE userId=? ORDER BY createdAt DESC", args: [req.user.id] })).rows); }
  catch { res.json([]); }
});
app.put("/api/notifications/read", auth, async (req: any, res: any) => {
  try { await db.execute({ sql: "UPDATE notifications SET isRead=1 WHERE userId=?", args: [req.user.id] }); res.json({ success: true }); }
  catch { res.status(500).json({ error: "Gagal update notifikasi" }); }
});

// BRAINSTORM
app.get("/api/brainstorm/history", auth, async (req: any, res: any) => {
  try { res.json((await db.execute({ sql: "SELECT * FROM brainstorm_chats WHERE userId=? ORDER BY createdAt ASC", args: [req.user.id] })).rows); }
  catch { res.json([]); }
});
app.post("/api/brainstorm/save", auth, async (req: any, res: any) => {
  const { role, content } = req.body;
  try {
    await db.execute({ sql: "INSERT INTO brainstorm_chats (userId, role, content, createdAt) VALUES (?,?,?,?)", args: [req.user.id, role||"user", content||"", Date.now()] });
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Gagal simpan chat" }); }
});

export default app;
