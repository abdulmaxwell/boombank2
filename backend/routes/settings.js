const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

async function auth(req,res,next){
  const h=req.headers.authorization; if(!h) return res.status(401).json({message:'No auth'});
  try{ const payload=jwt.verify(h.split(' ')[1],process.env.JWT_SECRET); const { rows } = await db.query('SELECT * FROM users WHERE phone=$1 LIMIT 1',[payload.phone]); if(!rows[0]) return res.status(401).json({}); req.user=rows[0]; next(); } catch(e){ return res.status(401).json({}); }
}

router.get('/me', auth, async (req,res)=>{ return res.json({ id:req.user.id, name:req.user.name, phone:req.user.phone, balance:req.user.balance }); });

router.put('/me', auth, async (req,res)=>{
  const { name, password } = req.body;
  if(password){
    const hash = await bcrypt.hash(password,10);
    await db.query('UPDATE users SET name=$1,password_hash=$2 WHERE id=$3',[name||req.user.name, hash, req.user.id]);
  } else {
    await db.query('UPDATE users SET name=$1 WHERE id=$2',[name||req.user.name, req.user.id]);
  }
  return res.json({ ok:true });
});

module.exports = router;
