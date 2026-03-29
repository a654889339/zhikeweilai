const nodemailer = require('nodemailer');
const crypto = require('crypto');
const config = require('../config');

const CODE_EXPIRE_MS = 5 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;
const MAX_SEND_PER_HOUR = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000;
const SEND_COOLDOWN_MS = 60 * 1000;

const verificationCodes = new Map();
const sendRecords = new Map();

function generateCode() {
  const buf = crypto.randomBytes(3);
  const num = buf.readUIntBE(0, 3) % 1000000;
  return String(num).padStart(6, '0');
}

function createTransporter() {
  return nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.port === 465,
    auth: {
      user: config.email.username,
      pass: config.email.password,
    },
  });
}

function canSend(email) {
  const record = sendRecords.get(email);
  if (!record) return { allowed: true };

  if (Date.now() - record.lastSend < SEND_COOLDOWN_MS) {
    const wait = Math.ceil((SEND_COOLDOWN_MS - (Date.now() - record.lastSend)) / 1000);
    return { allowed: false, message: `发送过于频繁，请 ${wait} 秒后再试` };
  }

  const oneHourAgo = Date.now() - 3600000;
  record.times = record.times.filter((t) => t > oneHourAgo);
  if (record.times.length >= MAX_SEND_PER_HOUR) {
    return { allowed: false, message: '已超过每小时发送上限，请稍后再试' };
  }

  return { allowed: true };
}

async function sendVerificationCode(email) {
  if (!config.email.enabled) {
    throw new Error('邮件服务未启用');
  }

  const check = canSend(email);
  if (!check.allowed) {
    throw new Error(check.message);
  }

  const code = generateCode();
  const transporter = createTransporter();
  const { getCompanyName } = require('../utils/companyConfig');
  const companyName = await getCompanyName();

  const fromName = companyName || config.email.fromName || '';
  const from = fromName
    ? `"${fromName}" <${config.email.from}>`
    : config.email.from;

  await transporter.sendMail({
    from,
    to: email,
    subject: `${companyName} 服务 - 邮箱验证码`,
    html: `
      <div style="max-width:480px;margin:0 auto;font-family:sans-serif;">
        <div style="background:#B91C1C;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0;">
          <h2 style="margin:0;">${companyName} 服务</h2>
        </div>
        <div style="border:1px solid #eee;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
          <p>您好，您的邮箱验证码为：</p>
          <div style="text-align:center;margin:24px 0;">
            <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#B91C1C;">${code}</span>
          </div>
          <p style="color:#666;font-size:13px;">验证码 5 分钟内有效，请勿泄露给他人。</p>
          <p style="color:#999;font-size:12px;margin-top:24px;">如非本人操作，请忽略此邮件。</p>
        </div>
      </div>
    `,
  });

  verificationCodes.set(email, {
    code,
    expiresAt: Date.now() + CODE_EXPIRE_MS,
    attempts: 0,
    used: false,
    lockedUntil: 0,
  });

  const record = sendRecords.get(email) || { times: [], lastSend: 0 };
  record.times.push(Date.now());
  record.lastSend = Date.now();
  sendRecords.set(email, record);

  console.log(`[Email] Verification code sent to ${email}`);
  return true;
}

function verifyCode(email, code) {
  const vc = verificationCodes.get(email);
  if (!vc) return { valid: false, message: '请先获取验证码' };

  if (vc.lockedUntil > Date.now()) {
    return { valid: false, message: '验证次数过多，请稍后再试' };
  }

  if (vc.attempts >= MAX_VERIFY_ATTEMPTS) {
    vc.lockedUntil = Date.now() + LOCK_DURATION_MS;
    vc.attempts = 0;
    return { valid: false, message: '验证次数过多，已锁定 30 分钟' };
  }

  vc.attempts++;

  if (vc.used) {
    return { valid: false, message: '验证码已使用，请重新获取' };
  }
  if (Date.now() > vc.expiresAt) {
    verificationCodes.delete(email);
    return { valid: false, message: '验证码已过期，请重新获取' };
  }
  if (vc.code !== code) {
    return { valid: false, message: '验证码错误' };
  }

  vc.used = true;
  return { valid: true };
}

module.exports = { sendVerificationCode, verifyCode };
