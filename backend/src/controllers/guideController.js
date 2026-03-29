const path = require('path');
const { DeviceGuide, ProductCategory } = require('../models');
const cosUpload = require('../utils/cosUpload');

function attachGuideThumbUrls(guide) {
  const g = guide.get ? guide.get({ plain: true }) : guide;
  return {
    ...g,
    iconUrlThumb: (g.iconUrlThumb && g.iconUrlThumb.trim()) ? g.iconUrlThumb.trim() : (cosUpload.getThumbUrl(g.iconUrl) || null),
    coverImageThumb: (g.coverImageThumb && g.coverImageThumb.trim()) ? g.coverImageThumb.trim() : (cosUpload.getThumbUrl(g.coverImage) || null),
    qrcodeUrlThumb: cosUpload.getThumbUrl(g.qrcodeUrl) || null,
  };
}

/** 前台：获取商品种类列表（仅启用） */
exports.categories = async (req, res) => {
  try {
    const list = await ProductCategory.findAll({
      where: { status: 'active' },
      order: [['sortOrder', 'ASC'], ['id', 'ASC']],
      attributes: ['id', 'parentId', 'name', 'sortOrder', 'thumbnailUrl', 'enableSub', 'status'],
    });
    const all = (list || []).map((c) => (c.get ? c.get({ plain: true }) : c));
    const byParent = new Map();
    all.forEach((c) => {
      const pid = Number(c.parentId || 0);
      if (!byParent.has(pid)) byParent.set(pid, []);
      byParent.get(pid).push(c);
    });
    const sortArr = (arr) => arr.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.id ?? 0) - (b.id ?? 0));
    for (const arr of byParent.values()) sortArr(arr);
    const attach = (node) => {
      const children = byParent.get(Number(node.id)) || [];
      return { ...node, children: children.map(attach) };
    };
    res.json({ code: 0, data: (byParent.get(0) || []).map(attach) });
  } catch (err) {
    console.error('[Guide] categories error:', err.message);
    res.status(500).json({ code: 500, message: '获取种类失败' });
  }
};

exports.list = async (req, res) => {
  try {
    const { categoryId } = req.query;
    const where = { status: 'active' };
    if (categoryId != null && categoryId !== '') where.categoryId = categoryId;
    const guides = await DeviceGuide.findAll({
      where,
      order: [['sortOrder', 'ASC'], ['id', 'ASC']],
    });
    res.json({ code: 0, data: guides.map(attachGuideThumbUrls) });
  } catch (err) {
    console.error('[Guide] list error:', err.message);
    res.status(500).json({ code: 500, message: '获取列表失败' });
  }
};

exports.detail = async (req, res) => {
  try {
    const param = req.params.id;
    const guide = /^\d+$/.test(param)
      ? await DeviceGuide.findByPk(param)
      : await DeviceGuide.findOne({ where: { slug: param } });
    if (!guide) return res.status(404).json({ code: 404, message: '不存在' });
    res.json({ code: 0, data: attachGuideThumbUrls(guide) });
  } catch (err) {
    console.error('[Guide] detail error:', err.message);
    res.status(500).json({ code: 500, message: '获取详情失败' });
  }
};

exports.adminList = async (req, res) => {
  try {
    const guides = await DeviceGuide.findAll({
      include: [{ model: require('../models').ProductCategory, as: 'category', attributes: ['id', 'name'] }],
      order: [['sortOrder', 'ASC'], ['id', 'ASC']],
    });
    res.json({ code: 0, data: guides.map(attachGuideThumbUrls) });
  } catch (err) {
    console.error('[Guide] adminList error:', err.message);
    res.status(500).json({ code: 500, message: '获取列表失败' });
  }
};

const GUIDE_FIELDS = [
  'name','slug','subtitle','icon','iconUrl','iconUrlThumb','emoji','gradient','badge',
  'categoryId','tags','sections','sortOrder','status',
  'coverImage','coverImageThumb','showcaseVideo','description','mediaItems','helpItems',
];

exports.create = async (req, res) => {
  try {
    const { name, slug } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ code: 400, message: '名称不能为空' });
    if (!slug || !slug.trim()) return res.status(400).json({ code: 400, message: '英文描述不能为空' });
    const existing = await DeviceGuide.findOne({ where: { slug: slug.trim() } });
    if (existing) return res.status(400).json({ code: 400, message: '英文描述 "' + slug + '" 已被使用' });
    const data = {};
    GUIDE_FIELDS.forEach(f => { if (req.body[f] !== undefined) data[f] = req.body[f]; });
    data.name = name.trim();
    data.slug = slug.trim();
    if (data.subtitle) data.subtitle = data.subtitle.trim();
    if (data.badge) data.badge = data.badge.trim();
    const guide = await DeviceGuide.create(data);
    res.json({ code: 0, data: guide });
  } catch (err) {
    console.error('[Guide] create error:', err.message);
    const msg = err.message || '创建失败';
    res.status(500).json({ code: 500, message: msg });
  }
};

exports.update = async (req, res) => {
  try {
    const guide = await DeviceGuide.findByPk(req.params.id);
    if (!guide) return res.status(404).json({ code: 404, message: '不存在' });
    const data = {};
    GUIDE_FIELDS.forEach(f => { if (req.body[f] !== undefined) data[f] = req.body[f]; });
    if (data.name) data.name = data.name.trim();
    if (data.slug) {
      data.slug = data.slug.trim();
      const { Op } = require('sequelize');
      const dup = await DeviceGuide.findOne({ where: { slug: data.slug, id: { [Op.ne]: guide.id } } });
      if (dup) return res.status(400).json({ code: 400, message: '英文描述 "' + data.slug + '" 已被使用' });
    }
    if (data.subtitle) data.subtitle = data.subtitle.trim();
    if (data.badge !== undefined) data.badge = (data.badge || '').trim();
    await guide.update(data);
    res.json({ code: 0, data: guide });
  } catch (err) {
    console.error('[Guide] update error:', err.message);
    const msg = err.message || '更新失败';
    res.status(500).json({ code: 500, message: msg });
  }
};

exports.remove = async (req, res) => {
  try {
    const guide = await DeviceGuide.findByPk(req.params.id);
    if (!guide) return res.status(404).json({ code: 404, message: '不存在' });
    await guide.destroy();
    res.json({ code: 0, message: '删除成功' });
  } catch (err) {
    console.error('[Guide] remove error:', err.message);
    res.status(500).json({ code: 500, message: '删除失败' });
  }
};

exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ code: 400, message: '未选择文件' });
    const ext = path.extname(req.file.originalname) || '.bin';
    const filename = `guide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const isImage = (req.file.mimetype || '').startsWith('image/');
    const result = isImage
      ? await cosUpload.uploadWithThumb(req.file.buffer, filename, req.file.mimetype)
      : { url: await cosUpload.upload(req.file.buffer, filename, req.file.mimetype), thumbUrl: null };
    res.json({ code: 0, data: { url: result.url, thumbUrl: result.thumbUrl || null } });
  } catch (err) {
    console.error('[Guide] uploadFile error:', err.message);
    res.status(500).json({ code: 500, message: '上传失败: ' + err.message });
  }
};

exports.generateQRCode = async (req, res) => {
  try {
    const QRCode = require('qrcode');
    const guide = await DeviceGuide.findByPk(req.params.id);
    if (!guide) return res.status(404).json({ code: 1, message: '商品不存在' });
    const forceRegen = req.body && req.body.force;
    if (guide.qrcodeUrl && !forceRegen) return res.json({ code: 0, data: { url: guide.qrcodeUrl } });
    const frontendBase = process.env.FRONTEND_URL || 'http://106.54.50.88:5301';
    const pageUrl = frontendBase + '/guide/' + (guide.slug || guide.id);
    const buffer = await QRCode.toBuffer(pageUrl, { width: 400, margin: 2, type: 'png' });
    const filename = `qrcode_guide_${guide.id}_${Date.now()}.png`;
    const { url: cosUrl } = await cosUpload.uploadWithThumb(buffer, filename, 'image/png', { maxWidth: 120 });
    guide.qrcodeUrl = cosUrl;
    await guide.save();
    res.json({ code: 0, data: { url: cosUrl } });
  } catch (err) {
    console.error('[Guide] generateQRCode error:', err.message);
    res.status(500).json({ code: 1, message: '生成失败: ' + err.message });
  }
};
