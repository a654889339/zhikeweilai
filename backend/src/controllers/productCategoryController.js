const { ProductCategory } = require('../models');
const path = require('path');
const cosUpload = require('../utils/cosUpload');

function normBool(v) {
  if (v === true || v === false) return v;
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

function buildCategoryTree(list) {
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
  return (byParent.get(0) || []).map(attach);
}

exports.list = async (req, res) => {
  try {
    const list = await ProductCategory.findAll({
      order: [['sortOrder', 'ASC'], ['id', 'ASC']],
    });
    res.json({ code: 0, data: buildCategoryTree(list) });
  } catch (err) {
    console.error('[ProductCategory] list error:', err.message);
    res.status(500).json({ code: 500, message: '获取种类列表失败' });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, sortOrder, status, thumbnailUrl, parentId, enableSub } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ code: 400, message: '种类名称不能为空' });
    const pid = parseInt(parentId, 10) || 0;
    const isChild = pid > 0;
    const cat = await ProductCategory.create({
      parentId: pid,
      name: name.trim(),
      thumbnailUrl: thumbnailUrl ? String(thumbnailUrl).trim() : null,
      enableSub: isChild ? false : normBool(enableSub),
      sortOrder: parseInt(sortOrder, 10) || 0,
      status: status || 'active',
    });
    res.json({ code: 0, data: cat });
  } catch (err) {
    console.error('[ProductCategory] create error:', err.message);
    res.status(500).json({ code: 500, message: '创建失败' });
  }
};

exports.update = async (req, res) => {
  try {
    const cat = await ProductCategory.findByPk(req.params.id);
    if (!cat) return res.status(404).json({ code: 404, message: '种类不存在' });
    const { name, sortOrder, status, thumbnailUrl, parentId, enableSub } = req.body;
    if (name !== undefined) cat.name = name.trim();
    if (sortOrder !== undefined) cat.sortOrder = parseInt(sortOrder, 10) || 0;
    if (status !== undefined) cat.status = status;
    if (thumbnailUrl !== undefined) cat.thumbnailUrl = thumbnailUrl ? String(thumbnailUrl).trim() : null;
    if (parentId !== undefined) cat.parentId = parseInt(parentId, 10) || 0;
    if (enableSub !== undefined) cat.enableSub = (parseInt(cat.parentId, 10) || 0) > 0 ? false : normBool(enableSub);
    await cat.save();
    res.json({ code: 0, data: cat });
  } catch (err) {
    console.error('[ProductCategory] update error:', err.message);
    res.status(500).json({ code: 500, message: '更新失败' });
  }
};

exports.uploadThumb = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ code: 400, message: '未选择文件' });
    const mime = req.file.mimetype || '';
    if (!mime.startsWith('image/')) return res.status(400).json({ code: 400, message: '仅支持上传图片' });
    const ext = path.extname(req.file.originalname) || '.png';
    const filename = `product-category-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const { url, thumbUrl } = await cosUpload.uploadWithThumb(req.file.buffer, filename, mime, { maxWidth: 240 });
    res.json({ code: 0, data: { url, thumbUrl: thumbUrl || null } });
  } catch (err) {
    console.error('[ProductCategory] uploadThumb error:', err.message);
    res.status(500).json({ code: 500, message: '上传失败: ' + err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const cat = await ProductCategory.findByPk(req.params.id);
    if (!cat) return res.status(404).json({ code: 404, message: '种类不存在' });
    const childCount = await ProductCategory.count({ where: { parentId: cat.id } });
    if (childCount > 0) {
      return res.status(400).json({ code: 400, message: '请先删除该种类下的二级分类' });
    }
    await cat.destroy();
    res.json({ code: 0, message: '删除成功' });
  } catch (err) {
    console.error('[ProductCategory] remove error:', err.message);
    res.status(500).json({ code: 500, message: '删除失败' });
  }
};
