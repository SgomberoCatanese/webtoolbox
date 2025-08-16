// server.js
// Node.js Express + Socket.IO for signaling and temporary file relay
// Tested on Node 18+. Put share.html into ./public and run `npm install` then `npm start`.

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const mime = require('mime');

const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, methods: ['GET','POST'] }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Multer storage -> saves to disk
const storage = multer.diskStorage({
  destination: (req,file,cb)=> cb(null, UPLOAD_DIR),
  filename: (req,file,cb)=> {
    const id = uuidv4();
    const ext = path.extname(file.originalname) || '';
    cb(null, id + ext);
  }
});
const upload = multer({ storage });

// In-memory maps (for demo). For production use DB or S3.
const files = new Map();     // id -> { path, originalName, mime, size, passwordHash, expiresAt }
const sessions = new Map();  // code -> { ownerSocketId, meta, passwordHash, created }

// Helper: generate short code
function genCode(len = 8){
  return uuidv4().replace(/-/g,'').slice(0,len).toUpperCase();
}

/* ===== API: upload file (relay mode) =====
   POST /upload
   FormData: file=<file>, password=<optional>
   Response: { ok:true, id, url, expiresAt }
*/
app.post('/upload', upload.single('file'), async (req,res) => {
  if (!req.file) return res.status(400).json({ ok:false, error: 'no_file' });
  const id = path.basename(req.file.filename, path.extname(req.file.filename));
  const password = req.body.password || null;
  const passwordHash = password ? await bcrypt.hash(password, 10) : null;
  const expiresAt = Date.now() + 24*60*60*1000; // 24 hours
  files.set(id, {
    path: req.file.path,
    originalName: req.file.originalname,
    mime: req.file.mimetype || mime.getType(req.file.originalname) || 'application/octet-stream',
    size: req.file.size,
    passwordHash,
    expiresAt
  });
  const url = `${req.protocol}://${req.get('host')}/file/${id}`;
  return res.json({ ok:true, id, url, expiresAt });
});

/* ===== API: download file =====
   GET /file/:id?p=plainPassword
*/
app.get('/file/:id', async (req,res) => {
  const id = req.params.id;
  const rec = files.get(id);
  if(!rec) return res.status(404).send('Not found or expired');
  if(Date.now() > rec.expiresAt){
    try{ fs.unlinkSync(rec.path); }catch(e){}
    files.delete(id);
    return res.status(404).send('Expired');
  }
  if(rec.passwordHash){
    const provided = req.query.p || req.headers['x-file-password'] || '';
    const ok = await bcrypt.compare(provided, rec.passwordHash);
    if(!ok) return res.status(401).send('Password required or incorrect');
  }
  res.setHeader('Content-Type', rec.mime || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(rec.originalName)}"`);
  const stream = fs.createReadStream(rec.path);
  stream.pipe(res);
});

/* ===== Socket.IO: signaling =====
   Events:
   - create_session: { filename, filesize, filetype, password } -> callback({ok:true, code})
   - join_session: { code } -> callback({ok:true})
   - signal: { code, signal } -> forwarded to other sockets in room(code)
*/
io.on('connection', socket => {
  console.log('socket connected', socket.id);

  socket.on('create_session', async (data, ack) => {
    try{
      const code = genCode(8);
      const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : null;
      sessions.set(code, { ownerSocketId: socket.id, meta: data, passwordHash, created: Date.now() });
      socket.join(code);
      if(ack) ack({ ok:true, code });
      console.log('session created', code);
    }catch(e){
      if(ack) ack({ ok:false, error: e.message });
    }
  });

  socket.on('join_session', (data, ack) => {
    const code = (data && data.code || '').toString().toUpperCase();
    const sess = sessions.get(code);
    if(!sess) return ack && ack({ ok:false, error:'not_found' });
    // if password protected, verify
    if(sess.passwordHash && !data.password){
      return ack && ack({ ok:false, error:'password_required' });
    }
    // password check handled by client (if provided, server doesn't re-check here)
    socket.join(code);
    // notify room that a peer joined
    socket.to(code).emit('peer-joined', { peerId: socket.id });
    if(ack) ack({ ok:true });
    console.log('peer joined', code, socket.id);
  });

  socket.on('signal', (payload, ack) => {
    // payload: { code, signal }
    if(!payload || !payload.code) return ack && ack({ ok:false, error:'bad_payload' });
    const room = payload.code.toString().toUpperCase();
    // forward to others in room
    socket.to(room).emit('signal', { from: socket.id, signal: payload.signal });
    if(ack) ack({ ok:true });
  });

  socket.on('disconnect', ()=> {
    // optional: clean sessions owned by disconnected sender after short timeout
  });
});

/* ===== cleanup expired files and sessions ===== */
setInterval(()=>{
  const now = Date.now();
  for(const [id,rec] of files.entries()){
    if(now > rec.expiresAt){
      try{ fs.unlinkSync(rec.path); }catch(e){}
      files.delete(id);
      console.log('deleted expired file', id);
    }
  }
  // sessions older than 48h
  for(const [code,sess] of sessions.entries()){
    if(now - sess.created > 48*60*60*1000) sessions.delete(code);
  }
}, 60*60*1000); // hourly

server.listen(PORT, ()=> {
  console.log(`Server listening on http://0.0.0.0:${PORT} (serve ./public/share.html).`);
  console.log('Uploads dir:', UPLOAD_DIR);
});
