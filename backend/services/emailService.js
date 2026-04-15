const nodemailer = require('nodemailer');

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM } = process.env;

function createTransporter() {
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

async function sendInvoiceEmail({ to, subject, text, attachments }) {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn('SMTP configuration missing in .env. Skipping invoice email to:', to);
    return;
  }

  const fromAddress = EMAIL_FROM || SMTP_USER;

  const message = {
    from: fromAddress,
    to,
    subject,
    text,
    html: `<p>${text}</p>`,
    attachments,
  };

  return transporter.sendMail(message);
}

module.exports = { sendInvoiceEmail };