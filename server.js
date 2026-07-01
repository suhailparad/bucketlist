const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');
const SESSION_SECRET = process.env.SESSION_SECRET || 'local-dev-change-me-bucketlist';

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ users: [], buckets: [], tasks: [], sessions: [] }, null, 2));

const readStore = () => JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const writeStore = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => ({
  salt,
  hash: crypto.scryptSync(password, salt, 64).toString('hex')
});
const safeEqual = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const sign = (value) => crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('hex');
const cookieValue = (token) => `${token}.${sign(token)}`;

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h', etag: true }));

function getCookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(v => {
    const [key, ...rest] = v.trim().split('='); return [key, decodeURIComponent(rest.join('='))];
  }));
}

function auth(req, res, next) {
  const raw = getCookies(req).session;
  if (!raw) return res.status(401).json({ error: 'Please sign in to continue.' });
  const [token, signature] = raw.split('.');
  if (!token || !signature || !safeEqual(sign(token), signature)) return res.status(401).json({ error: 'Your session is invalid.' });
  const store = readStore();
  const session = store.sessions.find(s => s.token === token && new Date(s.expiresAt) > new Date());
  const user = session && store.users.find(u => u.id === session.userId);
  if (!user) return res.status(401).json({ error: 'Your session has expired.' });
  req.user = user; req.store = store; req.sessionToken = token; next();
}

function createSession(store, userId, res) {
  const token = crypto.randomBytes(32).toString('hex');
  store.sessions = store.sessions.filter(s => new Date(s.expiresAt) > new Date());
  store.sessions.push({ token, userId, expiresAt: new Date(Date.now() + 30 * 864e5).toISOString() });
  res.setHeader('Set-Cookie', `session=${encodeURIComponent(cookieValue(token))}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
}

app.post('/api/auth/register', (req, res) => {
  const email = normalizeEmail(req.body.email); const password = String(req.body.password || ''); const fullName = String(req.body.fullName || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  if (fullName.length < 2) return res.status(400).json({ error: 'Enter your full name.' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  const store = readStore();
  if (store.users.some(u => u.email === email)) return res.status(409).json({ error: 'An account with this email already exists.' });
  const secured = hashPassword(password); const user = { id: id(), fullName, email, ...secured, createdAt: now() };
  store.users.push(user); createSession(store, user.id, res); writeStore(store);
  res.status(201).json({ user: { email: user.email, fullName: user.fullName } });
});

app.post('/api/auth/login', (req, res) => {
  const email = normalizeEmail(req.body.email); const password = String(req.body.password || ''); const store = readStore();
  const user = store.users.find(u => u.email === email);
  if (!user || !safeEqual(hashPassword(password, user.salt).hash, user.hash)) return res.status(401).json({ error: 'Email or password is incorrect.' });
  createSession(store, user.id, res); writeStore(store); res.json({ user: { email: user.email, fullName: user.fullName || '' } });
});

app.post('/api/auth/logout', auth, (req, res) => {
  req.store.sessions = req.store.sessions.filter(s => s.token !== req.sessionToken); writeStore(req.store);
  res.setHeader('Set-Cookie', 'session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'); res.status(204).end();
});

app.get('/api/me', auth, (req, res) => res.json({ user: { email: req.user.email, fullName: req.user.fullName || '' } }));

app.get('/api/buckets', auth, (req, res) => {
  const buckets = req.store.buckets.filter(b => b.userId === req.user.id).sort((a,b) => a.createdAt.localeCompare(b.createdAt)).map(bucket => ({
    ...bucket, tasks: req.store.tasks.filter(t => t.bucketId === bucket.id && !t.trashedAt).sort((a,b) => a.createdAt.localeCompare(b.createdAt))
  }));
  res.json({ buckets });
});

app.post('/api/buckets', auth, (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 50); const icon = String(req.body.icon || 'sparkles').slice(0, 20);
  if (!name) return res.status(400).json({ error: 'Give your bucket a name.' });
  const bucket = { id: id(), userId: req.user.id, name, icon, createdAt: now() }; req.store.buckets.push(bucket); writeStore(req.store);
  res.status(201).json({ bucket: { ...bucket, tasks: [] } });
});

app.delete('/api/buckets/:bucketId', auth, (req, res) => {
  const bucket = req.store.buckets.find(b => b.id === req.params.bucketId && b.userId === req.user.id);
  if (!bucket) return res.status(404).json({ error: 'Bucket not found.' });
  req.store.buckets = req.store.buckets.filter(b => b.id !== bucket.id); req.store.tasks = req.store.tasks.filter(t => t.bucketId !== bucket.id); writeStore(req.store); res.status(204).end();
});

app.post('/api/buckets/:bucketId/tasks', auth, (req, res) => {
  const bucket = req.store.buckets.find(b => b.id === req.params.bucketId && b.userId === req.user.id); const title = String(req.body.title || '').trim().slice(0, 140);
  if (!bucket) return res.status(404).json({ error: 'Bucket not found.' }); if (!title) return res.status(400).json({ error: 'Write something you want to do.' });
  const task = { id: id(), bucketId: bucket.id, title, completed: false, createdAt: now(), completedAt: null, trashedAt: null }; req.store.tasks.push(task); writeStore(req.store); res.status(201).json({ task });
});

app.patch('/api/tasks/:taskId', auth, (req, res) => {
  const task = req.store.tasks.find(t => t.id === req.params.taskId); const bucket = task && req.store.buckets.find(b => b.id === task.bucketId && b.userId === req.user.id);
  if (!task || !bucket) return res.status(404).json({ error: 'Task not found.' });
  if (typeof req.body.completed === 'boolean') { task.completed = req.body.completed; task.completedAt = task.completed ? now() : null; }
  writeStore(req.store); res.json({ task });
});

app.delete('/api/tasks/:taskId', auth, (req, res) => {
  const task = req.store.tasks.find(t => t.id === req.params.taskId); const bucket = task && req.store.buckets.find(b => b.id === task.bucketId && b.userId === req.user.id);
  if (!task || !bucket) return res.status(404).json({ error: 'Task not found.' }); task.trashedAt = now(); writeStore(req.store); res.status(204).end();
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
app.get('*splat', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Something went wrong. Please try again.' }); });
app.listen(PORT, () => console.log(`Bucketlist is ready at http://localhost:${PORT}`));

module.exports = app;
