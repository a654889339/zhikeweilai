const { OutletHomeConfig } = require('../models');
const cosUpload = require('../utils/cosUpload');
const path = require('path');

const FIELDS = ['section','title','desc','icon','color','path','price','sortOrder','status','imageUrl','imageUrlThumb'];

exports.list = async (req, res) => {
  try {
    const where = {};
    if (req.query.section) where.section = req.query.section;
    if (!req.query.all) where.status = 'active';
    const items = await OutletHomeConfig.findAll({ where, order: [['section','ASC'],['sortOrder','ASC'],['id','ASC']] });
    const data = items.map(it => {
      const o = it.get ? it.get({ plain: true }) : it;
      const thumb = (o.imageUrlThumb && o.imageUrlThumb.trim()) ? o.imageUrlThumb.trim() : null;
      return { ...o, imageUrlThumb: thumb };
    });
    res.json({ code: 0, data });
  } catch (e) { res.status(500).json({ code: 1, message: e.message }); }
};

exports.create = async (req, res) => {
  try {
    const data = {};
    FIELDS.forEach(f => { if (req.body[f] !== undefined) data[f] = req.body[f]; });
    const item = await OutletHomeConfig.create(data);
    res.json({ code: 0, data: item });
  } catch (e) { res.status(500).json({ code: 1, message: e.message }); }
};

exports.update = async (req, res) => {
  try {
    const item = await OutletHomeConfig.findByPk(req.params.id);
    if (!item) return res.status(404).json({ code: 1, message: '配置不存在' });
    const data = {};
    FIELDS.forEach(f => { if (req.body[f] !== undefined) data[f] = req.body[f]; });
    await item.update(data);
    res.json({ code: 0, data: item });
  } catch (e) { res.status(500).json({ code: 1, message: e.message }); }
};

exports.remove = async (req, res) => {
  try {
    const item = await OutletHomeConfig.findByPk(req.params.id);
    if (!item) return res.status(404).json({ code: 1, message: '配置不存在' });
    await item.destroy();
    res.json({ code: 0, message: '删除成功' });
  } catch (e) { res.status(500).json({ code: 1, message: e.message }); }
};

exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ code: 1, message: '请选择图片文件' });
    const ext = path.extname(req.file.originalname) || '.png';
    const filename = `outlet-homeconfig-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const { url, thumbUrl } = await cosUpload.uploadWithThumb(req.file.buffer, filename, req.file.mimetype);
    res.json({ code: 0, data: { url, thumbUrl: thumbUrl || null } });
  } catch (e) { res.status(500).json({ code: 1, message: e.message }); }
};
