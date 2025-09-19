// smtp-test.js
const nodemailer = require('nodemailer');
(async () => {
  const t = nodemailer.createTransport({
    host: process.env.MAIL_HOST || 'smtp.mailersend.net',
    port: Number(process.env.MAIL_PORT || 587),
    secure: false,
    auth: { user: process.env.MAIL_USERNAME, pass: process.env.MAIL_PASSWORD },
  });
  try {
    await t.verify();
    console.log('SMTP OK');
  } catch (e) {
    console.error('SMTP FAIL:', e.message);
  }
})();
