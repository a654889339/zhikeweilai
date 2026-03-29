const cosUpload = require('../utils/cosUpload');

/**
 * 对 /api 下 JSON 响应中的本桶 COS 对象 URL 替换为短时签名 URL（私有桶可读）。
 */
function cosUrlSigningMiddleware(req, res, next) {
  if (!cosUpload.isSigningEnabled()) return next();
  const origJson = res.json.bind(res);
  res.json = function cosSignedJson(body) {
    cosUpload
      .signCosUrlsDeepAsync(body)
      .then((signed) => origJson(signed))
      .catch((e) => {
        console.warn('[COS sign] middleware:', e.message);
        origJson(body);
      });
  };
  next();
}

module.exports = { cosUrlSigningMiddleware };
