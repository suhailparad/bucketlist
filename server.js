require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bucketlist';
const SESSION_SECRET = process.env.SESSION_SECRET || 'local-dev-change-me-bucketlist';

const userSchema = new mongoose.Schema({
  fullName: { type: String, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  salt: { type: String, required: true },
  hash: { type: String, required: true }
}, { timestamps: true });
const bucketSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 50 },
  icon: { type: String, default: 'sparkles', maxlength: 20 }
}, { timestamps: true });
const taskSchema = new mongoose.Schema({
  bucketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bucket', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 140 },
  completed: { type: Boolean, default: false },
  completedAt: { type: Date, default: null },
  trashedAt: { type: Date, default: null }
}, { timestamps: true });
const sessionSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Bucket = mongoose.model('Bucket', bucketSchema);
const Task = mongoose.model('Task', taskSchema);
const Session = mongoose.model('Session', sessionSchema);

let connectionPromise;
function connectDb() {
  if (mongoose.connection.readyState === 1) return Promise.resolve();
  if (!connectionPromise) connectionPromise = mongoose.connect(MONGODB_URI).catch(error => { connectionPromise = null; throw error; });
  return connectionPromise;
}

const normalizeEmail = email => String(email || '').trim().toLowerCase();
const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => ({ salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') });
const safeEqual = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const sign = value => crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('hex');
const cookieValue = token => `${token}.${sign(token)}`;
const serialize = doc => ({ ...doc.toObject(), id: doc._id.toString(), _id: undefined, __v: undefined, createdAt: doc.createdAt.toISOString(), updatedAt: doc.updatedAt.toISOString() });

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h', etag: true }));
app.use('/api', async (req, res, next) => {
  try { await connectDb(); next(); }
  catch (error) { next(error); }
});

function getCookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(value => {
    const [key, ...rest] = value.trim().split('='); return [key, decodeURIComponent(rest.join('='))];
  }));
}

async function auth(req, res, next) {
  const raw = getCookies(req).session;
  if (!raw) return res.status(401).json({ error: 'Please sign in to continue.' });
  const [token, signature] = raw.split('.');
  if (!token || !signature || !safeEqual(sign(token), signature)) return res.status(401).json({ error: 'Your session is invalid.' });
  const session = await Session.findOne({ token, expiresAt: { $gt: new Date() } });
  const user = session && await User.findById(session.userId);
  if (!user) return res.status(401).json({ error: 'Your session has expired.' });
  req.user = user; req.sessionToken = token; next();
}

async function createSession(userId, res) {
  console.log(MONGODB_URI);
  const token = crypto.randomBytes(32).toString('hex');
  await Session.create({ token, userId, expiresAt: new Date(Date.now() + 30 * 864e5) });
  res.setHeader('Set-Cookie', `session=${encodeURIComponent(cookieValue(token))}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
}

app.post('/api/auth/register', async (req, res) => {
  const email = normalizeEmail(req.body.email); const password = String(req.body.password || ''); const fullName = String(req.body.fullName || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  if (fullName.length < 2) return res.status(400).json({ error: 'Enter your full name.' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (await User.exists({ email })) return res.status(409).json({ error: 'An account with this email already exists.' });
  const secured = hashPassword(password); const user = await User.create({ fullName, email, ...secured });
  await createSession(user._id, res); res.status(201).json({ user: { email: user.email, fullName: user.fullName } });
});

app.post('/api/auth/login', async (req, res) => {
  const email = normalizeEmail(req.body.email); const password = String(req.body.password || ''); const user = await User.findOne({ email });
  if (!user || !safeEqual(hashPassword(password, user.salt).hash, user.hash)) return res.status(401).json({ error: 'Email or password is incorrect.' });
  await createSession(user._id, res); res.json({ user: { email: user.email, fullName: user.fullName || '' } });
});

app.post('/api/auth/logout', auth, async (req, res) => {
  await Session.deleteOne({ token: req.sessionToken }); res.setHeader('Set-Cookie', 'session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'); res.status(204).end();
});
app.get('/api/me', auth, (req, res) => res.json({ user: { email: req.user.email, fullName: req.user.fullName || '' } }));

app.get('/api/buckets', auth, async (req, res) => {
  const bucketDocs = await Bucket.find({ userId: req.user._id }).sort({ createdAt: 1 });
  const taskDocs = await Task.find({ bucketId: { $in: bucketDocs.map(b => b._id) }, trashedAt: null }).sort({ createdAt: 1 });
  const buckets = bucketDocs.map(bucket => ({ ...serialize(bucket), tasks: taskDocs.filter(task => task.bucketId.equals(bucket._id)).map(serialize) }));
  res.json({ buckets });
});

app.post('/api/buckets', auth, async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 50); const icon = String(req.body.icon || 'sparkles').slice(0, 20);
  if (!name) return res.status(400).json({ error: 'Give your bucket a name.' });
  const bucket = await Bucket.create({ userId: req.user._id, name, icon }); res.status(201).json({ bucket: { ...serialize(bucket), tasks: [] } });
});

app.delete('/api/buckets/:bucketId', auth, async (req, res) => {
  const bucket = mongoose.isValidObjectId(req.params.bucketId) && await Bucket.findOne({ _id: req.params.bucketId, userId: req.user._id });
  if (!bucket) return res.status(404).json({ error: 'Bucket not found.' });
  await Promise.all([Bucket.deleteOne({ _id: bucket._id }), Task.deleteMany({ bucketId: bucket._id })]); res.status(204).end();
});

app.post('/api/buckets/:bucketId/tasks', auth, async (req, res) => {
  const bucket = mongoose.isValidObjectId(req.params.bucketId) && await Bucket.findOne({ _id: req.params.bucketId, userId: req.user._id }); const title = String(req.body.title || '').trim().slice(0, 140);
  if (!bucket) return res.status(404).json({ error: 'Bucket not found.' }); if (!title) return res.status(400).json({ error: 'Write something you want to do.' });
  const task = await Task.create({ bucketId: bucket._id, title }); res.status(201).json({ task: serialize(task) });
});

async function ownedTask(taskId, userId) {
  if (!mongoose.isValidObjectId(taskId)) return null;
  const task = await Task.findById(taskId); if (!task) return null;
  return await Bucket.exists({ _id: task.bucketId, userId }) ? task : null;
}
app.patch('/api/tasks/:taskId', auth, async (req, res) => {
  const task = await ownedTask(req.params.taskId, req.user._id); if (!task) return res.status(404).json({ error: 'Task not found.' });
  if (typeof req.body.completed === 'boolean') { task.completed = req.body.completed; task.completedAt = task.completed ? new Date() : null; }
  await task.save(); res.json({ task: serialize(task) });
});
app.delete('/api/tasks/:taskId', auth, async (req, res) => {
  const task = await ownedTask(req.params.taskId, req.user._id); if (!task) return res.status(404).json({ error: 'Task not found.' });
  task.trashedAt = new Date(); await task.save(); res.status(204).end();
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
app.get('*splat', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use((err, req, res, next) => {
  console.error(err); if (err?.code === 11000) return res.status(409).json({ error: 'That value is already in use.' }); res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

async function start() {
  try { await connectDb(); app.listen(PORT, () => console.log(`Bucketlist is ready at http://localhost:${PORT}`)); }
  catch (error) { console.error('Could not connect to MongoDB:', error.message); process.exit(1); }
}
if (require.main === module) start();
module.exports = app;
