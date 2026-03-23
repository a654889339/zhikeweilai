/**
 * 微信支付 APIv3 小程序 JSAPI：统一下单、调起支付参数、回调解密
 * 依赖环境变量：WECHAT_APPID、WECHAT_PAY_MCH_ID、WECHAT_PAY_SERIAL_NO、
 * WECHAT_PAY_API_V3_KEY（32 位）、WECHAT_PAY_PRIVATE_KEY（PEM 全文，含换行可用 \n 转义）
 * WECHAT_PAY_NOTIFY_URL（HTTPS 完整回调地址，需在商户平台配置）
 */
const crypto = require('crypto');
const https = require('https');
const axios = require('axios');
const config = require('../config');

function loadPrivateKey() {
  const raw = process.env.WECHAT_PAY_PRIVATE_KEY || '';
  if (!raw) return null;
  return raw.includes('BEGIN') ? raw.replace(/\\n/g, '\n') : raw;
}

function isPayConfigured() {
  return !!(
    config.wechat.appId
    && process.env.WECHAT_PAY_MCH_ID
    && process.env.WECHAT_PAY_SERIAL_NO
    && process.env.WECHAT_PAY_API_V3_KEY
    && loadPrivateKey()
    && process.env.WECHAT_PAY_NOTIFY_URL
  );
}

function buildAuth(method, urlPath, bodyStr) {
  const mchid = process.env.WECHAT_PAY_MCH_ID;
  const serialNo = process.env.WECHAT_PAY_SERIAL_NO;
  const privateKey = loadPrivateKey();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonceStr = crypto.randomBytes(16).toString('hex');
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonceStr}\n${bodyStr}\n`;
  const sign = crypto.createSign('RSA-SHA256').update(message).sign(privateKey, 'base64');
  return `WECHATPAY2-SHA256-RSA2048 mchid="${mchid}",nonce_str="${nonceStr}",timestamp="${timestamp}",serial_no="${serialNo}",signature="${sign}"`;
}

async function postV3(urlPath, bodyObj) {
  const bodyStr = JSON.stringify(bodyObj);
  const auth = buildAuth('POST', urlPath, bodyStr);
  const { data } = await axios.post(`https://api.mch.weixin.qq.com${urlPath}`, bodyStr, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: auth,
    },
    httpsAgent: new https.Agent({ keepAlive: true }),
    timeout: 30000,
  });
  return data;
}

/** 统一下单，返回 prepay_id */
async function jsapiPrepay({ outTradeNo, description, totalFen, openid }) {
  const urlPath = '/v3/pay/transactions/jsapi';
  const body = {
    appid: config.wechat.appId,
    mchid: process.env.WECHAT_PAY_MCH_ID,
    description: description || '服务订单',
    out_trade_no: outTradeNo,
    notify_url: process.env.WECHAT_PAY_NOTIFY_URL,
    amount: { total: totalFen, currency: 'CNY' },
    payer: { openid },
  };
  return postV3(urlPath, body);
}

/** 生成小程序 wx.requestPayment 所需参数 */
function buildMiniProgramPayParams(prepayId) {
  const appId = config.wechat.appId;
  const timeStamp = String(Math.floor(Date.now() / 1000));
  const nonceStr = crypto.randomBytes(16).toString('hex');
  const pkg = `prepay_id=${prepayId}`;
  const signStr = `${appId}\n${timeStamp}\n${nonceStr}\n${pkg}\n`;
  const paySign = crypto.createSign('RSA-SHA256').update(signStr).sign(loadPrivateKey(), 'base64');
  return {
    appId,
    timeStamp,
    nonceStr,
    package: pkg,
    signType: 'RSA',
    paySign,
  };
}

/** 解密支付结果通知 resource */
function decryptNotifyResource(resource) {
  const { ciphertext, associated_data: ad, nonce } = resource;
  const apiV3Key = process.env.WECHAT_PAY_API_V3_KEY || '';
  if (apiV3Key.length !== 32) throw new Error('invalid api v3 key');
  const key = Buffer.from(apiV3Key, 'utf8');
  const nonceBuf = Buffer.from(nonce, 'utf8');
  const buf = Buffer.from(ciphertext, 'base64');
  const authTag = buf.subarray(buf.length - 16);
  const data = buf.subarray(0, buf.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonceBuf);
  decipher.setAuthTag(authTag);
  decipher.setAAD(Buffer.from(ad || '', 'utf8'));
  const plain = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(plain.toString('utf8'));
}

module.exports = {
  isPayConfigured,
  jsapiPrepay,
  buildMiniProgramPayParams,
  decryptNotifyResource,
};
