const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { sendSMS } = require('../services/africastalking');

function createToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '30d' });
}

// register
router.post('/register', async (req, res) => {
  const { name, phone, password } = req.body;
  if (!name || !phone || !password) return res.status(400).json({ message: 'Missing fields' });
  const password_hash = await bcrypt.hash(password, 10);
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otp_expires_at = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  try {
    const { rows } = await db.query('INSERT INTO users(name,phone,password_hash,otp,otp_expires_at) VALUES($1,$2,$3,$4,$5) RETURNING *', [name, phone, password_hash, otp, otp_expires_at]);
    try { await sendSMS(phone, `Your BoomBank OTP is ${otp}. Expires in 5 minutes.`); } catch(e){ console.warn('SMS failed', e); }
    return res.json({ message: 'OTP sent' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Registration failed' });
  }
});

// verify otp
router.post('/verify-otp', async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) return res.status(400).json({ message: 'Missing' });
  const { rows } = await db.query('SELECT * FROM users WHERE phone=$1 LIMIT 1', [phone]);
  const user = rows[0];
  if (!user) return res.status(400).json({ message: 'User not found' });
  if (user.verified) return res.json({ token: createToken({ phone }) });
  if (user.otp !== otp) return res.status(400).json({ message: 'Invalid OTP' });
  if (new Date(user.otp_expires_at) < new Date()) return res.status(400).json({ message: 'OTP expired' });
  await db.query('UPDATE users SET verified=true, otp=null, otp_expires_at=null WHERE id=$1', [user.id]);
  return res.json({ token: createToken({ phone }) });
});

// login
router.post('/login', async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) return res.status(400).json({ message: 'Missing' });
  const { rows } = await db.query('SELECT * FROM users WHERE phone=$1 LIMIT 1', [phone]);
  const user = rows[0];
  if (!user) return res.status(400).json({ message: 'User not found' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(400).json({ message: 'Invalid credentials' });
  if (!user.verified) return res.status(403).json({ message: 'Phone not verified' });
  const token = createToken({ phone });
  return res.json({ token });
});

module.exports = router;
