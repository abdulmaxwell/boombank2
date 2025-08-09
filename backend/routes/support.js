const express = require('express');
const router = express.Router();
const { notifyAgent } = require('../services/telegram');
const fetch = require('node-fetch');

router.post('/', async (req, res) => {
  const { message, mode } = req.body; // mode: 'demo' or 'real'
  if (!message) return res.status(400).json({ message: 'No message' });

  // If OPENAI_API_KEY present, try to get an automated assistant reply restricted to the platform.
  if (process.env.OPENAI_API_KEY) {
    try {
      const systemPrompt = `You are BoomBank customer-support assistant. You MUST only answer questions related to the BoomBank betting platform: registration, login, staking, betting rules, deposits (M-Pesa), withdrawals, account settings, and support workflow. If user asks for anything else (legal, document sending, medical, illegal actions), respond: "I can only help with BoomBank platform questions. Please contact support or wait for an agent." Keep answers concise and actionable.`;
      const body = {
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        max_tokens: 400,
        temperature: 0.0
      };
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify(body)
      });
      const j = await resp.json();
      const reply = j?.choices?.[0]?.message?.content || null;
      if (reply) return res.json({ reply, source: 'openai' });
    } catch (e) {
      console.error('OpenAI support error', e);
    }
  }

  // Fallback: notify agent via Telegram and ask user to wait or use WhatsApp link.
  try {
    await notifyAgent(`<b>Support request</b>\nMode: ${mode || 'demo'}\nMessage: ${message}`);
  } catch (e) {
    console.warn('Telegram notify failed', e);
  }

  const whatsapp = 'https://wa.me/254743518481';
  return res.json({
    reply: 'Please wait for the next available agent to connect to you. Alternatively chat on WhatsApp.',
    whatsapp
  });
});

module.exports = router;
