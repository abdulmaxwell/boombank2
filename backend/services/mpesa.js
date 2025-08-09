const axios = require('axios');

const env = process.env.MPESA_ENV === 'production' ? 'production' : 'sandbox';
const oauthUrl = env === 'production'
  ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
  : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
const stkUrl = env === 'production'
  ? 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
  : 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

async function getToken() {
  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  if (!key || !secret) throw new Error('Missing MPESA credentials');
  const auth = Buffer.from(`${key}:${secret}`).toString('base64');
  const res = await axios.get(oauthUrl, { headers: { Authorization: `Basic ${auth}` } });
  return res.data.access_token;
}

async function stkPush(phone, amount, accountRef) {
  const token = await getToken();
  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

  const payload = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Number(amount),
    PartyA: phone,
    PartyB: shortcode,
    PhoneNumber: phone,
    CallBackURL: `${process.env.BASE_URL.replace(/\/$/,'')}/api/payment/mpesa-callback`,
    AccountReference: accountRef,
    TransactionDesc: 'BoomBank Deposit'
  };

  const res = await axios.post(stkUrl, payload, { headers: { Authorization: `Bearer ${token}` } });
  return res.data;
}

module.exports = { stkPush };
