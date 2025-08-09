const express = require('express');
const router = express.Router();
const db = require('../db');
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

// create game
router.post('/create', auth, async (req, res) => {
  const { betAmount, bombsCount } = req.body;
  if (!betAmount) return res.status(400).json({ message: 'Missing bet' });
  const gridSize = 25;
  const bombs = [];
  const totalBombs = bombsCount || Math.max(1, Math.floor(gridSize * 0.2));
  while (bombs.length < totalBombs) {
    const idx = Math.floor(Math.random() * gridSize);
    if (!bombs.includes(idx)) bombs.push(idx);
  }
  const grid = { bombs, revealed: [] };
  const { rows } = await db.query('INSERT INTO games(user_id,bet_amount,grid,result) VALUES($1,$2,$3,$4) RETURNING *', [req.user.id, betAmount, grid, null]);
  return res.json({ ok: true, game: rows[0] });
});

// reveal tile
router.post('/reveal', auth, async (req, res) => {
  const { gameId, index } = req.body;
  const { rows } = await db.query('SELECT * FROM games WHERE id=$1 LIMIT 1', [gameId]);
  const game = rows[0];
  if (!game) return res.status(400).json({ message: 'Game not found' });
  const grid = game.grid;
  if (grid.bombs.includes(index)) {
    await db.query('UPDATE games SET result=$1 WHERE id=$2', ['loss', game.id]);
    await db.query('INSERT INTO transactions(user_id,type,amount,status) VALUES($1,$2,$3,$4)', [game.user_id, 'game_loss', game.bet_amount, 'completed']);
    return res.json({ bomb: true });
  }
  grid.revealed.push(index);
  await db.query('UPDATE games SET grid=$1 WHERE id=$2', [grid, game.id]);
  const multiplier = 1 + (grid.revealed.length * 0.1);
  return res.json({ bomb: false, multiplier });
});

// cashout
router.post('/cashout', auth, async (req, res) => {
  const { gameId } = req.body;
  const { rows } = await db.query('SELECT * FROM games WHERE id=$1 LIMIT 1', [gameId]);
  const game = rows[0];
  if (!game) return res.status(400).json({ message: 'Game not found' });
  if (game.result) return res.status(400).json({ message: 'Game finished' });
  const revealed = game.grid.revealed.length || 0;
  const multiplier = 1 + (revealed * 0.1);
  const winnings = Number(game.bet_amount) * multiplier;
  await db.query('UPDATE games SET result=$1, multiplier=$2 WHERE id=$3', ['win', multiplier, game.id]);
  const { rows: u } = await db.query('SELECT * FROM users WHERE id=$1', [game.user_id]);
  const user = u[0];
  const newBal = Number(user.balance) + winnings;
  await db.query('UPDATE users SET balance=$1 WHERE id=$2', [newBal, user.id]);
  await db.query('INSERT INTO transactions(user_id,type,amount,status) VALUES($1,$2,$3,$4)', [user.id, 'game_win', winnings, 'completed']);
  return res.json({ ok: true, winnings, balance: newBal });
});

module.exports = router;
