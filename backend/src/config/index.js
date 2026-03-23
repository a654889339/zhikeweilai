require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '5302'),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET || 'vino_default_secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3308'),
    name: process.env.DB_NAME || 'vino_db',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'vino_secret_2024',
  },
  wechat: {
    appId: process.env.WECHAT_APPID || '',
    appSecret: process.env.WECHAT_SECRET || '',
  },
  alipay: {
    appId: process.env.ALIPAY_APPID || '',
    privateKey: process.env.ALIPAY_PRIVATE_KEY || '',
    publicKey: process.env.ALIPAY_PUBLIC_KEY || '',
  },
  email: {
    enabled: process.env.EMAIL_ENABLED === 'true',
    host: process.env.EMAIL_HOST || 'smtp.qq.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    username: process.env.EMAIL_USERNAME || '',
    password: process.env.EMAIL_PASSWORD || '',
    from: process.env.EMAIL_FROM || '',
    fromName: process.env.EMAIL_FROM_NAME || 'Vino服务',
  },
  sms: {
    enabled: process.env.SMS_ENABLED === 'true',
    secretId: process.env.TENCENT_SMS_SECRET_ID || '',
    secretKey: process.env.TENCENT_SMS_SECRET_KEY || '',
    smsSdkAppId: process.env.TENCENT_SMS_APP_ID || '',
    signName: process.env.TENCENT_SMS_SIGN_NAME || 'Vino服务',
    templateId: process.env.TENCENT_SMS_TEMPLATE_ID || '',
    codeExpireMinutes: 5,
  },
};
