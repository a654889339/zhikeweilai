const { Op } = require('sequelize');
const HomeConfig = require('../models/HomeConfig');
const { DeviceGuide } = require('../models');
const cosUpload = require('../utils/cosUpload');

/** 从 URL 下载图片 buffer */
async function fetchImageBuffer(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Vino-Backend/1.0' } });
  if (!res.ok) return null;
  const arr = await res.arrayBuffer();
  return Buffer.from(arr);
}

/** 从 COS 原图 URL 提取 object key 中的文件名（vino/uploads/xxx => xxx） */
function filenameFromCosUrl(url) {
  if (!url || !url.startsWith(cosUpload.CosBaseUrl + '/vino/uploads/')) return null;
  const path = url.slice((cosUpload.CosBaseUrl + '/vino/uploads/').length);
  if (!path || path.includes('thumb/')) return null;
  return path;
}

/** 为已有图片批量生成缩略图并上传到 COS（仅处理本 COS 桶内的图片） */
exports.generateThumbs = async (req, res) => {
  try {
    const results = { processed: 0, failed: 0, skipped: 0 };
    const urlsToProcess = new Set();

    const guides = await DeviceGuide.findAll({
      attributes: ['id', 'iconUrl', 'coverImage', 'qrcodeUrl'],
    });
    for (const g of guides) {
      if (cosUpload.isCosUploadUrl(g.iconUrl)) urlsToProcess.add(g.iconUrl);
      if (cosUpload.isCosUploadUrl(g.coverImage)) urlsToProcess.add(g.coverImage);
      if (cosUpload.isCosUploadUrl(g.qrcodeUrl)) urlsToProcess.add(g.qrcodeUrl);
    }

    const homeConfigs = await HomeConfig.findAll({
      attributes: ['id', 'imageUrl'],
      where: { imageUrl: { [Op.ne]: '' } },
    });
    for (const h of homeConfigs) {
      if (h.imageUrl && cosUpload.isCosUploadUrl(h.imageUrl)) urlsToProcess.add(h.imageUrl);
    }

    for (const url of urlsToProcess) {
      const filename = filenameFromCosUrl(url);
      if (!filename) {
        results.skipped++;
        continue;
      }
      try {
        const buffer = await fetchImageBuffer(url);
        if (!buffer || buffer.length === 0) {
          results.skipped++;
          continue;
        }
        let contentType = 'image/jpeg';
        try {
          const sharp = require('sharp');
          const meta = await sharp(buffer).metadata();
          if (meta.format) contentType = 'image/' + meta.format;
        } catch (_) {}
        const thumbResult = await cosUpload.generateThumbBuffer(buffer, contentType);
        if (!thumbResult || !thumbResult.buffer) {
          results.skipped++;
          continue;
        }
        await cosUpload.uploadThumb(thumbResult.buffer, filename, thumbResult.contentType);
        results.processed++;
      } catch (e) {
        console.warn('[Admin] generateThumb failed for', url, e.message);
        results.failed++;
      }
    }

    res.json({
      code: 0,
      data: {
        message: `已处理 ${results.processed} 张缩略图，失败 ${results.failed}，跳过 ${results.skipped}`,
        ...results,
      },
    });
  } catch (e) {
    console.error('[Admin] generateThumbs error:', e.message);
    res.status(500).json({ code: 1, message: e.message || '生成缩略图失败' });
  }
};
