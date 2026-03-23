const crypto = require('crypto');
const config = require('../config');

const CODE_EXPIRE_MS = (config.sms && config.sms.codeExpireMinutes
  ? config.sms.codeExpireMinutes
  : 5) * 60 * 1000;
const SEND_COOLDOWN_MS = 60 * 1000;
const verificationCodes = new Map();
const sendRecords = new Map();

function generateCode() {
  const num = crypto.randomInt(100000, 999999);
  return String(num);
}

function normalizePhone(phone) {
  const p = String(phone).replace(/\s/g, '');
  if (/^1\d{10}$/.test(p)) return p;
  if (p.startsWith('+86')) return p.replace(/^\+86/, '').trim();
  return p;
}

function canSend(phone) {
  const key = normalizePhone(phone);
  const record = sendRecords.get(key);
  if (!record) return { allowed: true };

  if (Date.now() - record.lastSend < SEND_COOLDOWN_MS) {
    const wait = Math.ceil((SEND_COOLDOWN_MS - (Date.now() - record.lastSend)) / 1000);
    return { allowed: false, message: `发送过于频繁，请 ${wait} 秒后再试` };
  }
  return { allowed: true };
}

async function sendVerificationCode(phone) {
  if (!config.sms || !config.sms.enabled) {
    throw new Error('短信服务未启用，请配置 TENCENT_SMS_* 环境变量并设置 SMS_ENABLED=true');
  }
  const key = normalizePhone(phone);
  if (!/^1\d{10}$/.test(key)) {
    throw new Error('请输入正确的11位大陆手机号');
  }

  const check = canSend(phone);
  if (!check.allowed) throw new Error(check.message);

  const code = generateCode();
  const tencentcloud = require('tencentcloud-sdk-nodejs');
  const SmsClient = tencentcloud.sms.v20210111.Client;
  const client = new SmsClient({
    credential: {
      secretId: config.sms.secretId,
      secretKey: config.sms.secretKey,
    },
    region: 'ap-guangzhou',
    profile: { httpProfile: { endpoint: 'sms.tencentcloudapi.com' } },
  });

  await client.SendSms({
    SmsSdkAppId: config.sms.smsSdkAppId,
    SignName: config.sms.signName,
    TemplateId: config.sms.templateId,
    PhoneNumberSet: ['+86' + key],
    TemplateParamSet: [code, String(config.sms.codeExpireMinutes || 5)],
  });

  verificationCodes.set(key, {
    code,
    expiresAt: Date.now() + CODE_EXPIRE_MS,
    used: false,
  });
  sendRecords.set(key, { lastSend: Date.now() });

  console.log(`[SMS] Verification code sent to ${key}`);
  return true;
}

function verifyCode(phone, code) {
  const key = normalizePhone(phone);
  const vc = verificationCodes.get(key);
  if (!vc) return { valid: false, message: '请先获取验证码' };
  if (vc.used) return { valid: false, message: '验证码已使用，请重新获取' };
  if (Date.now() > vc.expiresAt) {
    verificationCodes.delete(key);
    return { valid: false, message: '验证码已过期，请重新获取' };
  }
  if (vc.code !== String(code).trim()) {
    return { valid: false, message: '验证码错误' };
  }
  vc.used = true;
  return { valid: true };
}

module.exports = { sendVerificationCode, verifyCode, normalizePhone };
