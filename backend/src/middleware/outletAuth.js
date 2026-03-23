const jwt = require('jsonwebtoken');
const config = require('../config');

const outletAuthMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ code: 401, message: '未登录' });
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    if (decoded.realm !== 'outlet') return res.status(403).json({ code: 403, message: '非服务商账号' });
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ code: 401, message: 'Token已过期' });
  }
};

module.exports = { outletAuthMiddleware };
