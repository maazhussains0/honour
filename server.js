// Honour backend for Habib Public School (no dependencies). Run: node server.js -> http://localhost:3000
// Optional email (password-reset OTP): set SMTP_HOST, SMTP_PORT(465), SMTP_USER, SMTP_PASS, SMTP_FROM. Without them the OTP is printed in this console.
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), tls = require('tls');
const PORT = process.env.PORT || 3000, DBF = path.join(__dirname, 'data.json'), PAGE = path.join(__dirname, 'index.html'), V = 5, DOM = 'habibschools.edu.pk';
const LEVELS = ['XI', 'XII'], GROUPS = ['CS-1A', 'CS-1B', 'CS-1C', 'PRE-ENG', 'PRE-MED'], CLASSES = LEVELS.flatMap(l => GROUPS.map(g => l + ' ' + g));
// Honour Score weights by the person being rated: [studies|teaching, punctuality, behaviour|communication]
const WS = { student: [.40, .25, .35], teacher: [.35, .35, .30] };
const pad = n => String(n).padStart(2, '0'), clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const hash = (p, salt) => crypto.scryptSync(p, salt, 32).toString('hex');
const mk = (o, pass) => { const salt = crypto.randomBytes(16).toString('hex'); return { ...o, salt, hash: hash(pass, salt) }; };
const weigh = (vals, role, warn) => clamp(Math.round(vals.reduce((a, v, i) => a + v * WS[role][i], 0) - (warn ? 10 : 0)));
const subOf = u => u.role === 'student' ? u.cls : u.role === 'teacher' ? u.subject : 'Head of Department';
const today = () => { const t = new Date(); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; };
const dayOf = (w, k) => new Date(Date.UTC(2024, 0, 1 + w * 7 + k)).toISOString().slice(0, 10);
const cw = () => { const t = new Date(); t.setHours(0, 0, 0, 0); const d = t.getDay(); t.setDate(t.getDate() - (d === 0 ? 6 : d === 6 ? 5 : d - 1)); return Math.round((Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) - Date.UTC(2024, 0, 1)) / 6048e5); };

let db;
const save = () => fs.writeFileSync(DBF, JSON.stringify(db));
function seedDb() {
  const W = cw(), CL = CLASSES, secs = g => g === 'all' ? CL : CL.filter(c => g.some(x => c.endsWith(x)));
  db = { v: V, users: [], ratings: [], sessions: {}, audit: [] };
  // Generic demo accounts: no real names. Replace with the school's real accounts when going live.
  const SB = [72,88,55,36,15,66,58,71,84,62,46,72,91,40,79,53,69,28,77,60,85,44,67,74,31,82,57,64,49,70];
  SB.forEach((b, i) => db.users.push(mk({ role: 'student', name: 'Student ' + pad(i + 1), email: 'student' + pad(i + 1) + '@' + DOM, parentEmail: 'parent.student' + pad(i + 1) + '@mail.com', cls: CL[Math.floor(i / 3)], base: b }, 'student123')));
  const TT = [['English','all',66],['Urdu','all',82],['Maths',['CS-1A','CS-1B','CS-1C','PRE-ENG'],48],['Physics',['PRE-ENG','PRE-MED','CS-1A','CS-1B'],90],['Chemistry',['PRE-ENG','PRE-MED'],35],['Biology',['PRE-MED'],73],['Computer Science',['CS-1A','CS-1B','CS-1C'],58],['Islamiat / Pak Studies','all',68]];
  TT.forEach(([s, g, b], i) => { const un = 'teacher' + pad(i + 1); db.users.push(mk({ role: 'teacher', name: 'Teacher ' + pad(i + 1), username: un, email: un + '@' + DOM, subject: s, sections: secs(g), base: b }, 'teacher123')); });
  db.users.push(mk({ role: 'hod', name: 'HOD', username: 'hod', email: 'hod@' + DOM }, 'hod123'));
  const G = { student: ['Participates actively', 'Submits work on time', 'Helps classmates', 'Big improvement lately'], teacher: ['Explains concepts clearly', 'Always on time', 'Easy to approach', 'Makes class interesting'] };
  const B = { student: ['Often late to class', 'Distracts others', 'Incomplete homework', 'Needs to focus'], teacher: ['Goes too fast', 'Rarely gives feedback', 'Hard to reach after class', 'Too much homework'] };
  const OFF = [-3, 0, 2, 1]; // 4 past weeks, 3 different raters each, spread over Mon-Fri
  db.users.filter(u => u.role !== 'hod').forEach(u => {
    const pool = u.role === 'student' ? db.users.filter(t => t.role === 'teacher' && t.sections.includes(u.cls)) : db.users.filter(s => s.role === 'student' && u.sections.includes(s.cls));
    OFF.forEach((o, wi) => [-6, 0, 6].forEach((d, k) => { const s0 = clamp(u.base + o + d), vals = [clamp(s0 + 5), s0, clamp(s0 - 5)], warn = u.role === 'student' && s0 < 30;
      db.ratings.push({ by: pool[(wi * 3 + k) % pool.length].name, to: u.name, vals, warn, s: weigh(vals, u.role, warn), w: W - 4 + wi, d: dayOf(W - 4 + wi, (wi + k * 2) % 5), good: s0 >= 45 ? G[u.role][(wi + k) % 4] : '', bad: s0 < 80 ? B[u.role][(wi + k + 1) % 4] : '' }); }));
  });
  db.users.forEach(u => delete u.base);
  const add = (by, to, vals, good) => db.ratings.push({ by, to, vals, warn: false, s: weigh(vals, db.users.find(x => x.name === to).role, false), w: W, d: today(), good, bad: '' });
  add('Student 01', 'Teacher 01', [84, 80, 88], 'Clear and patient'); add('Teacher 03', 'Student 02', [90, 92, 88], 'Always prepared');
  save();
}
try { db = JSON.parse(fs.readFileSync(DBF, 'utf8')); } catch (e) {}
if (!db || db.v !== V) { if (fs.existsSync(DBF)) fs.renameSync(DBF, DBF + '.old'); seedDb(); }

const rsOf = (n, w = 1e9) => db.ratings.filter(x => x.to === n && x.w <= w);
const avg = rs => rs.length < 3 ? null : Math.round(rs.reduce((a, x) => a + x.s, 0) / rs.length);
function listFor(u, secq, w) {
  const done = n => db.ratings.some(r => r.by === u.name && r.to === n && r.w === w);
  if (u.role === 'student') return { sec: null, list: db.users.filter(x => x.role === 'teacher' && x.sections.includes(u.cls)).map(t => ({ name: t.name, sub: t.subject, done: done(t.name) })) };
  const sec = u.sections.includes(secq) ? secq : u.sections[0];
  return { sec, list: db.users.filter(x => x.role === 'student' && x.cls === sec).map(x => ({ name: x.name, sub: x.cls, done: done(x.name) })) };
}
const inRange = (rs, g) => g ? rs.filter(x => x.d >= g.from && x.d <= g.to) : rs;
function stats(n, c, g) {
  const all = rsOf(n), rs = inRange(all, g), ok = rs.length >= 3, weekly = [];
  for (let k = c - 5; k <= c; k++) { const a = all.filter(x => x.w === k); weekly.push({ w: k, v: avg(a), n: a.length }); }
  const txt = k => rs.filter(x => x[k]).slice(-6).reverse().map(x => x[k]);
  return { overall: avg(all), score: avg(rs), count: rs.length, total: all.length, week: c, weekly, cats: ok ? [0, 1, 2].map(i => Math.round(rs.reduce((a, x) => a + x.vals[i], 0) / rs.length)) : null, good: ok ? txt('good') : [], bad: ok ? txt('bad') : [] };
}

// ---- email (SMTP over TLS, port 465) ----
function mail(to, subject, text) {
  return new Promise((ok, no) => {
    const E = process.env;
    if (!E.SMTP_HOST) { console.log(`\n[email not configured - printed here instead]\nTo: ${to}\nSubject: ${subject}\n${text}\n`); return ok(false); }
    const s = tls.connect({ host: E.SMTP_HOST, port: +(E.SMTP_PORT || 465), servername: E.SMTP_HOST }), b64 = x => Buffer.from(x).toString('base64'), from = E.SMTP_FROM || E.SMTP_USER;
    const msg = `From: Honour <${from}>\r\nTo: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${text.replace(/\n\./g, '\n..')}\r\n.`;
    const cmds = [null, 'EHLO honour.local', 'AUTH LOGIN', b64(E.SMTP_USER), b64(E.SMTP_PASS), `MAIL FROM:<${from}>`, `RCPT TO:<${to}>`, 'DATA', msg, 'QUIT'];
    let i = 0, buf = ''; const t = setTimeout(() => { s.destroy(); no(new Error('SMTP timeout')); }, 15000);
    s.on('error', e => { clearTimeout(t); no(e); });
    s.on('data', d => { buf += d; let m; while ((m = /^(\d{3}) .*\r?\n/m.exec(buf))) { buf = buf.slice(m.index + m[0].length); if (+m[1] >= 400) { clearTimeout(t); s.destroy(); return no(new Error('SMTP ' + m[1])); } i++; if (i >= cmds.length) { clearTimeout(t); s.end(); return ok(true); } s.write(cmds[i] + '\r\n'); } });
  });
}

const J = (res, code, obj, h = {}) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...h }); res.end(JSON.stringify(obj)); };
const authed = req => { const m = /honour=([a-f0-9]+)/.exec(req.headers.cookie || ''); const n = m && db.sessions[m[1]]; return n && db.users.find(u => u.name === n); };
const body = req => new Promise((ok, no) => { let b = ''; req.on('data', c => { b += c; if (b.length > 2e4) { req.destroy(); no(); } }); req.on('end', () => { try { ok(JSON.parse(b || '{}')); } catch (e) { ok({}); } }); });
const tries = {}; const limited = (ip, max = 10, ms = 6e4) => { const t = Date.now(), k = ip + max; tries[k] = (tries[k] || []).filter(x => t - x < ms); tries[k].push(t); return tries[k].length > max; };
const cookie = (t, age) => `honour=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}`;
const me = u => ({ name: u.name, role: u.role, sub: subOf(u), sections: u.sections || [], week: cw() });
const start = (res, u) => { const t = crypto.randomBytes(24).toString('hex'); db.sessions[t] = u.name; save(); J(res, 200, me(u), { 'Set-Cookie': cookie(t, 604800) }); };
const S = (v, n = 80) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const hodOnly = (res, u) => u.role !== 'hod' && (J(res, 403, { error: 'HOD only' }), true);
const noHod = (res, u) => u.role === 'hod' && (J(res, 403, { error: 'Not for HOD' }), true);
const key = u => u.role === 'student' ? u.email.split('@')[0] : u.username;
const uid = v => { v = S(v).toLowerCase(); const i = v.indexOf('@'); if (i < 0) return { l: v }; return v.slice(i + 1) === DOM ? { l: v.slice(0, i) } : { err: 'Use your @' + DOM + ' account' }; };
const ISO = /^\d{4}-\d\d-\d\d$/;
const rng = url => { let f = url.searchParams.get('from'), t = url.searchParams.get('to'); if (!ISO.test(f || '')) return null; if (!ISO.test(t || '')) t = f; return f <= t ? { from: f, to: t } : { from: t, to: f }; };
const findUser = (role, id) => { const i = uid(id); return i.err ? null : db.users.find(x => x.role === role && key(x) === i.l); };
const otpHash = (o, u) => crypto.createHash('sha256').update(o + u.salt).digest('hex');
const pub = ({ s, vals, w, d, good, bad }) => ({ s, vals, w, d, good, bad }); // never includes the rater

const R = {
  'GET /api/config': (req, res) => J(res, 200, { demo: process.env.DEMO !== '0' }),
  'POST /api/login': async (req, res) => {
    if (limited(req.socket.remoteAddress)) return J(res, 429, { error: 'Too many attempts. Wait a minute.' });
    const b = await body(req), id = uid(b.id); if (id.err) return J(res, 400, { error: id.err });
    const u = db.users.find(x => x.role === b.role && key(x) === id.l);
    if (!u || !crypto.timingSafeEqual(Buffer.from(hash(String(b.pass || ''), u.salt)), Buffer.from(u.hash))) return J(res, 401, { error: 'Wrong details' });
    start(res, u);
  },
  // Password reset: step 1 emails a 6-digit code (valid 10 min). The reply is the same whether or not the account exists.
  'POST /api/forgot': async (req, res) => {
    if (limited(req.socket.remoteAddress, 5, 6e5)) return J(res, 429, { error: 'Too many requests. Try again later.' });
    const b = await body(req), u = findUser(b.role, b.id);
    if (u && u.email && !(u.otp && Date.now() - u.otp.at < 6e4)) {
      const code = String(crypto.randomInt(100000, 1000000)); u.otp = { h: otpHash(code, u), at: Date.now(), exp: Date.now() + 6e5, tries: 0 }; save();
      mail(u.email, 'Your Honour password reset code', `Your code is ${code}\n\nIt expires in 10 minutes. If you did not ask for this, ignore this email.`).catch(e => console.error('Email failed:', e.message));
    }
    J(res, 200, { ok: 1 });
  },
  'POST /api/reset': async (req, res) => {
    if (limited(req.socket.remoteAddress, 10, 6e5)) return J(res, 429, { error: 'Too many attempts. Try again later.' });
    const b = await body(req), u = findUser(b.role, b.id), pass = String(b.pass || ''), bad = () => J(res, 400, { error: 'Invalid or expired code' });
    if (!u || !u.otp || Date.now() > u.otp.exp || u.otp.tries >= 5) return bad();
    if (pass.length < 6) return J(res, 400, { error: 'Password: at least 6 characters' });
    u.otp.tries++; if (!crypto.timingSafeEqual(Buffer.from(otpHash(String(b.otp || ''), u)), Buffer.from(u.otp.h))) { save(); return bad(); }
    u.salt = crypto.randomBytes(16).toString('hex'); u.hash = hash(pass, u.salt); delete u.otp;
    for (const t of Object.keys(db.sessions)) if (db.sessions[t] === u.name) delete db.sessions[t]; // sign out everywhere
    save(); J(res, 200, { ok: 1 });
  },
  'POST /api/logout': (req, res) => { const m = /honour=([a-f0-9]+)/.exec(req.headers.cookie || ''); if (m) { delete db.sessions[m[1]]; save(); } J(res, 200, { ok: 1 }, { 'Set-Cookie': cookie('', 0) }); },
  'GET /api/me': (req, res, u) => J(res, 200, me(u)),
  'GET /api/home': (req, res, u, url) => {
    if (noHod(res, u)) return; const c = cw(), w = clamp(parseInt(url.searchParams.get('w')) || c, c - 12, c), L = listFor(u, url.searchParams.get('sec'), w), all = rsOf(u.name), ok = all.length >= 3;
    J(res, 200, { score: avg(all), week: c, viewWeek: w, minWeek: c - 12, sections: u.sections || [], sec: L.sec, targets: L.list,
      recent: ok ? rsOf(u.name, w).sort((a, b) => b.d.localeCompare(a.d)).slice(0, 4).map(pub) : [] });
  },
  'GET /api/targets': (req, res, u, url) => { if (noHod(res, u)) return; const L = listFor(u, url.searchParams.get('sec'), cw()); J(res, 200, { week: cw(), sections: u.sections || [], sec: L.sec, targets: L.list }); },
  'GET /api/feedbacks': (req, res, u, url) => {
    if (noHod(res, u)) return; const all = rsOf(u.name), ok = all.length >= 3, sort = url.searchParams.get('sort') || 'new';
    const cmp = { new: (a, b) => b.d.localeCompare(a.d), old: (a, b) => a.d.localeCompare(b.d), high: (a, b) => b.s - a.s, low: (a, b) => a.s - b.s }[sort] || ((a, b) => b.d.localeCompare(a.d));
    const items = ok ? inRange(all, rng(url)).sort(cmp).slice(0, 200).map(pub) : [];
    J(res, 200, { week: cw(), locked: !ok, total: ok ? all.length : 0, items });
  },
  'POST /api/rate': async (req, res, u) => {
    if (noHod(res, u)) return; const b = await body(req), c = cw();
    const t = db.users.find(x => x.name === b.target), ok = t && (u.role === 'student' ? t.role === 'teacher' && t.sections.includes(u.cls) : t.role === 'student' && u.sections.includes(t.cls));
    if (!ok) return J(res, 403, { error: u.role === 'student' ? 'You can only rate your own teachers' : 'You can only rate students in your classes' });
    if (!Array.isArray(b.vals) || b.vals.length !== 3 || b.vals.some(v => !Number.isFinite(v) || v < 0 || v > 100)) return J(res, 400, { error: 'Give 3 scores from 0 to 100' });
    if (u.role === 'student' && b.declared !== true) return J(res, 400, { error: 'Declaration required' });
    if (db.ratings.some(r => r.by === u.name && r.to === t.name && r.w === c)) return J(res, 409, { error: 'Already rated this week' });
    const vals = b.vals.map(Math.round), warn = u.role === 'teacher' && b.warn === true; // only teachers can give a final warning
    db.ratings.push({ by: u.name, to: t.name, vals, warn, s: weigh(vals, t.role, warn), w: c, d: today(), good: S(b.good, 140), bad: S(b.bad, 140) }); save(); J(res, 200, { ok: 1 });
  },
  'POST /api/sections': async (req, res, u) => {
    if (u.role !== 'teacher') return J(res, 403, { error: 'Teachers only' });
    const b = await body(req), secs = (Array.isArray(b.sections) ? b.sections : []).filter(s => CLASSES.includes(s));
    if (!secs.length) return J(res, 400, { error: 'Pick at least one class' });
    u.sections = secs; save(); J(res, 200, me(u));
  },
  'GET /api/profile': (req, res, u, url) => noHod(res, u) || J(res, 200, { name: u.name, role: u.role, sub: subOf(u), ...stats(u.name, cw(), rng(url)) }),
  // ---- HOD only ----
  'GET /api/cases': (req, res, u) => hodOnly(res, u) || J(res, 200, { week: cw(), people: db.users.filter(x => x.role !== 'hod').map(x => ({ name: x.name, role: x.role, sub: subOf(x), score: avg(rsOf(x.name)), count: rsOf(x.name).length, reviewed: !!x.rev })) }),
  'GET /api/person': (req, res, u, url) => {
    if (hodOnly(res, u)) return; const p = db.users.find(x => x.name === url.searchParams.get('name') && x.role !== 'hod'); if (!p) return J(res, 404, { error: 'Not found' });
    J(res, 200, { name: p.name, role: p.role, sub: subOf(p), parent: p.parentEmail || null, reviewed: !!p.rev, ...stats(p.name, cw(), rng(url)) });
  },
  'POST /api/reviewed': async (req, res, u) => {
    if (hodOnly(res, u)) return; const b = await body(req), p = db.users.find(x => x.name === b.name && x.role !== 'hod'); if (!p) return J(res, 404, { error: 'Not found' });
    p.rev = b.value === true; db.audit.unshift({ t: new Date().toISOString(), hod: u.name, target: p.name, kind: p.rev ? 'reviewed' : 'unreviewed' }); save(); J(res, 200, { ok: 1 });
  },
  'GET /api/raters': (req, res, u, url) => {
    if (hodOnly(res, u)) return; const n = url.searchParams.get('name'); if (!db.users.some(x => x.name === n)) return J(res, 404, { error: 'Not found' });
    db.audit.unshift({ t: new Date().toISOString(), hod: u.name, target: n, kind: 'lookup' }); save(); // every lookup is logged
    J(res, 200, { raters: db.ratings.filter(x => x.to === n).map(({ by, s, warn, w, d, good, bad }) => ({ by, s, warn, w, d, good, bad })) });
  },
  'GET /api/audit': (req, res, u) => hodOnly(res, u) || J(res, 200, { week: cw(), audit: db.audit.slice(0, 100) }),
};
const PUBLIC = ['GET /api/config', 'POST /api/login', 'POST /api/forgot', 'POST /api/reset', 'POST /api/logout'];
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x'), k = req.method + ' ' + url.pathname;
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(fs.readFileSync(PAGE)); }
    const h = R[k]; if (!h) return J(res, 404, { error: 'Not found' });
    if (req.method === 'POST' && !/json/.test(req.headers['content-type'] || '')) return J(res, 415, { error: 'JSON only' });
    const u = authed(req); if (!u && !PUBLIC.includes(k)) return J(res, 401, { error: 'Please sign in' });
    await h(req, res, u, url);
  } catch (e) { console.error(e); J(res, 500, { error: 'Server error' }); }
}).listen(PORT, () => console.log('Honour running at http://localhost:' + PORT));
