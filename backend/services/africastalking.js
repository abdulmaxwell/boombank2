const Africastalking = require('africastalking');
const username = process.env.AT_USERNAME;
const apiKey = process.env.AT_API_KEY;
let sms = null;
if (username && apiKey) {
  const at = Africastalking({ apiKey, username });
  sms = at.SMS;
}

async function sendSMS(to, message) {
  if (!sms) {
    console.warn('AfricaTalking not configured, skipping SMS');
    return null;
  }
  try {
    const res = await sms.send({ to, message, from: process.env.AT_SENDER_ID || undefined });
    return res;
  } catch (err) {
    console.error('AT send error', err);
    throw err;
  }
}

module.exports = { sendSMS };
