const Twilio = require('twilio');
const fetch = global.fetch;

const {
  TWILIO_SID,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE,
  TWILIO_FROM,
  FAST2SMS_API_KEY,
  FAST2SMS_SENDER,
} = process.env;

const accountSid = TWILIO_SID || TWILIO_ACCOUNT_SID;
const fromPhone = TWILIO_PHONE || TWILIO_FROM;

async function sendInvoiceSms(to, body) {
  if (accountSid && TWILIO_AUTH_TOKEN && fromPhone) {
    const client = Twilio(accountSid, TWILIO_AUTH_TOKEN);
    return client.messages.create({
      body,
      from: fromPhone,
      to,
    });
  }

  if (FAST2SMS_API_KEY && FAST2SMS_SENDER) {
    if (!fetch) {
      console.warn('Global fetch is not available for Fast2SMS. Skipping SMS to:', to);
      return;
    }

    const result = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        'Authorization': FAST2SMS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        route: 'q',
        sender_id: FAST2SMS_SENDER,
        message: body,
        language: 'english',
        flash: 0,
        numbers: to.replace(/\D/g, ''),
      }),
    });
    return result.json();
  }

  console.warn('No SMS provider configured in .env. Skipping invoice SMS to:', to);
  return;
}

module.exports = { sendInvoiceSms };