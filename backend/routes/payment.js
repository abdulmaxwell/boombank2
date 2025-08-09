const express = require('express');
const router = express.Router();
const db = require('../db');
const { stkPush } = require('../services/mpesa');
const { notifyAgent } = require('../services/telegram');
const jwt = require('jsonwebtoken');

async function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ message: 'No auth' });
  const token = h.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await db.query('SELECT * FROM users WHERE phone=$1 LIMIT 1', [payload.phone]);
    if (!rows[0]) return res.status(401).json({ message: 'User not found' });
    req.user = rows[0];
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// deposit - STK push
router.post('/deposit', auth, async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ message: 'Invalid amount' });
  const { rows } = await db.query('INSERT INTO transactions(user_id,type,amount,status) VALUES($1,$2,$3,$4) RETURNING *', [req.user.id, 'deposit', amount, 'pending']);
  const tx = rows[0];
  try {
    const mp = await stkPush(req.user.phone, amount, tx.id);
    const checkoutId = mp?.CheckoutRequestID || mp?.ResponseCode || null;
    await db.query('UPDATE transactions SET reference=$1 WHERE id=$2', [checkoutId, tx.id]);
    return res.json({ ok: true, mp });
  } catch (err) {
    console.error('STK error', err);
    await db.query('UPDATE transactions SET status=$1 WHERE id=$2', ['failed', tx.id]);
    return res.status(500).json({ message: 'STK failed' });
  }
});

// mpesa callback
router.post('/mpesa-callback', async (req, res) => {
  try {
    const payload = req.body;
    const callback = payload.Body && payload.Body.stkCallback;
    if (!callback) return res.status(200).send('OK');
    const checkoutId = callback.CheckoutRequestID;
    const resultCode = callback.ResultCode;
    const resultDesc = callback.ResultDesc;
    const { rows } = await db.query('SELECT * FROM transactions WHERE reference=$1 LIMIT 1', [checkoutId]);
    const tx = rows[0];
    if (!tx) {
      console.warn('Unknown checkout id', checkoutId);
      return res.status(200).send('OK');
    }
    if (resultCode === 0) {
      const items = callback.CallbackMetadata?.Item || [];
      const amountItem = items.find(i => i.Name === 'Amount');
      const amount = amountItem ? amountItem.Value : tx.amount;
      await db.query('UPDATE transactions SET status=$1 WHERE id=$2', ['completed', tx.id]);
      const { rows: u } = await db.query('SELECT * FROM users WHERE id=$1', [tx.user_id]);
      const user = u[0];
      const newBal = Number(user.balance) + Number(amount);
      await db.query('UPDATE users SET balance=$1 WHERE id=$2', [newBal, user.id]);
      notifyAgent(`Deposit success for user ${user.phone}: Ksh ${amount}`);
    } else {
      await db.query('UPDATE transactions SET status=$1 WHERE id=$2', ['failed', tx.id]);
      notifyAgent(`Deposit failed for checkout ${checkoutId}: ${resultDesc}`);
    }
    return res.status(200).send('OK');
  } catch (err) {
    console.error('mpesa callback error', err);
    return res.status(500).send('Error');
  }
});

// withdraw - only to registered phone
router.post('/withdraw', auth, async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ message: 'Invalid amount' });
  if (Number(req.user.balance) < Number(amount)) return res.status(400).json({ message: 'Insufficient balance' });
  const { rows } = await db.query('INSERT INTO transactions(user_id,type,amount,status) VALUES($1,$2,$3,$4) RETURNING *', [req.user.id, 'withdraw', amount, 'pending']);
  const tx = rows[0];
  const newBal = Number(req.user.balance) - Number(amount);
  await db.query('UPDATE users SET balance=$1 WHERE id=$2', [newBal, req.user.id]);
  await db.query('UPDATE transactions SET status=$1 WHERE id=$2', ['completed', tx.id]);
  await notifyAgent(`Withdrawal requested by ${req.user.phone}: Ksh ${amount}. Processed.`);
  return res.json({ ok: true, balance: newBal });
});

module.exports = router;
