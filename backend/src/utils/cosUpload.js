const COS = require('cos-nodejs-sdk-v5');
const path = require('path');

const Bucket = 'itsyourturnmy-1256887166';
const Region = 'ap-singapore';
const CosBaseUrl = `https://${Bucket}.cos.${Region}.myqcloud.com`;

const THUMB_MAX_WIDTH = 400;
const THUMB_JPEG_QUALITY = 82;

let cosClient = null;

function getClient() {
  if (cosClient) return cosClient;
  const secretId = process.env.COS_SECRET_ID;
  const secretKey = process.env.COS_SECRET_KEY;
  if (!secretId || !secretKey) {
    console.warn('[COS] Missing COS_SECRET_ID or COS_SECRET_KEY');
    return null;
  }
  cosClient = new COS({ SecretId: secretId, SecretKey: secretKey });
  return cosClient;
}

/** 根据原图 URL 推导缩略图 URL（仅对本站 COS 地址有效） */
function getThumbUrl(originalUrl) {
  if (!originalUrl || typeof originalUrl !== 'string') return null;
  const base = `${CosBaseUrl}/vino/uploads/`;
  if (!originalUrl.startsWith(base)) return null;
  const suffix = originalUrl.slice(base.length);
  if (!suffix || suffix.includes('thumb/')) return null;
  return `${CosBaseUrl}/vino/uploads/thumb/${suffix}`;
}

/** 判断 URL 是否为本 COS 桶的上传地址（可用于决定是否生成缩略图） */
function isCosUploadUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return url.startsWith(CosBaseUrl + '/vino/uploads/') && !url.includes('/vino/uploads/thumb/');
}

/** 使用 sharp 生成缩略图 buffer（最大宽 maxWidth，保持比例） */
async function generateThumbBuffer(inputBuffer, contentType, maxWidth = THUMB_MAX_WIDTH) {
  try {
    const sharp = require('sharp');
    let pipeline = sharp(inputBuffer).resize(maxWidth, null, { withoutEnlargement: true });
    const lower = (contentType || '').toLowerCase();
    if (lower.includes('png')) {
      pipeline = pipeline.png({ compressionLevel: 6 });
      return { buffer: await pipeline.toBuffer(), contentType: 'image/png' };
    }
    if (lower.includes('webp')) {
      pipeline = pipeline.webp({ quality: 80 });
      return { buffer: await pipeline.toBuffer(), contentType: 'image/webp' };
    }
    pipeline = pipeline.jpeg({ quality: THUMB_JPEG_QUALITY });
    return { buffer: await pipeline.toBuffer(), contentType: 'image/jpeg' };
  } catch (e) {
    console.warn('[COS] generateThumbBuffer error:', e.message);
    return null;
  }
}

function upload(buffer, filename, contentType) {
  return new Promise((resolve, reject) => {
    const client = getClient();
    if (!client) return reject(new Error('COS not configured'));
    const key = `vino/uploads/${filename}`;
    client.putObject({
      Bucket,
      Region,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }, (err) => {
      if (err) return reject(err);
      resolve(`${CosBaseUrl}/${key}`);
    });
  });
}

/** 上传到缩略图目录 vino/uploads/thumb/ */
function uploadThumb(buffer, filename, contentType) {
  return new Promise((resolve, reject) => {
    const client = getClient();
    if (!client) return reject(new Error('COS not configured'));
    const key = `vino/uploads/thumb/${filename}`;
    client.putObject({
      Bucket,
      Region,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }, (err) => {
      if (err) return reject(err);
      resolve(`${CosBaseUrl}/${key}`);
    });
  });
}

/** 上传原图并生成并上传缩略图，返回 { url, thumbUrl }；缩略图失败时 thumbUrl 为 null。opts.maxWidth 可指定缩略图最大宽（默认 400） */
async function uploadWithThumb(buffer, filename, contentType, opts = {}) {
  const url = await upload(buffer, filename, contentType);
  const thumbResult = await generateThumbBuffer(buffer, contentType, opts.maxWidth);
  let thumbUrl = null;
  if (thumbResult && thumbResult.buffer) {
    try {
      thumbUrl = await uploadThumb(thumbResult.buffer, filename, thumbResult.contentType);
    } catch (e) {
      console.warn('[COS] uploadThumb error:', e.message);
    }
  }
  return { url, thumbUrl };
}

module.exports = {
  upload,
  uploadThumb,
  uploadWithThumb,
  getThumbUrl,
  isCosUploadUrl,
  generateThumbBuffer,
  CosBaseUrl,
};
