const { Service, ServiceCategory } = require('../models');

const ALLOWED_FIELDS = ['title', 'description', 'icon', 'iconUrl', 'cover', 'category', 'categoryId', 'price', 'originPrice', 'bg', 'bgOpacity', 'status', 'sortOrder'];

const pickFields = (body) => {
  const result = {};
  for (const key of ALLOWED_FIELDS) {
    if (body[key] !== undefined) result[key] = body[key];
  }
  return result;
};

/** 前台：获取服务列表（仅启用），按种类排序，含 category 信息 */
exports.list = async (req, res) => {
  try {
    const { categoryId } = req.query;
    const where = { status: 'active' };
    if (categoryId != null && categoryId !== '') where.categoryId = parseInt(categoryId, 10);

    const rows = await Service.findAll({
      where,
      include: [{ model: ServiceCategory, as: 'serviceCategory', attributes: ['id', 'name', 'key'], where: { status: 'active' }, required: true }],
      order: [
        [{ model: ServiceCategory, as: 'serviceCategory' }, 'sortOrder', 'ASC'],
        ['sortOrder', 'ASC'],
        ['id', 'ASC'],
      ],
    });

    res.json({ code: 0, data: { list: rows } });
  } catch (err) {
    console.error('[Service] list error:', err.message);
    res.status(500).json({ code: 500, message: '获取服务列表失败' });
  }
};

exports.detail = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ code: 400, message: '无效的服务ID' });
    const service = await Service.findByPk(id, {
      include: [{ model: ServiceCategory, as: 'serviceCategory', attributes: ['id', 'name', 'key'] }],
    });
    if (!service) return res.status(404).json({ code: 404, message: '服务不存在' });
    res.json({ code: 0, data: service });
  } catch (err) {
    console.error('[Service] detail error:', err.message);
    res.status(500).json({ code: 500, message: '获取服务详情失败' });
  }
};

/** 后台：获取全部服务（含禁用）及种类 */
exports.adminList = async (req, res) => {
  try {
    const rows = await Service.findAll({
      include: [{ model: ServiceCategory, as: 'serviceCategory', attributes: ['id', 'name', 'key'] }],
      order: [
        [{ model: ServiceCategory, as: 'serviceCategory' }, 'sortOrder', 'ASC'],
        ['sortOrder', 'ASC'],
        ['id', 'ASC'],
      ],
    });
    res.json({ code: 0, data: rows });
  } catch (err) {
    console.error('[Service] adminList error:', err.message);
    res.status(500).json({ code: 500, message: '获取服务列表失败' });
  }
};

exports.create = async (req, res) => {
  try {
    const data = pickFields(req.body);
    if (!data.title || !data.title.trim()) return res.status(400).json({ code: 400, message: '标题不能为空' });
    if (data.categoryId == null && !data.category) return res.status(400).json({ code: 400, message: '请选择服务种类' });
    if (data.price !== undefined) data.price = parseFloat(data.price) || 0;
    if (data.originPrice !== undefined) data.originPrice = parseFloat(data.originPrice) || null;
    if (data.sortOrder !== undefined) data.sortOrder = parseInt(data.sortOrder, 10) || 0;
    if (data.categoryId !== undefined) data.categoryId = parseInt(data.categoryId, 10) || null;
    if (data.bgOpacity !== undefined) {
      const v = parseFloat(data.bgOpacity);
      data.bgOpacity = (v >= 0 && v <= 100) ? v : null;
    }
    const service = await Service.create(data);
    const withCat = await Service.findByPk(service.id, { include: [{ model: ServiceCategory, as: 'serviceCategory' }] });
    res.json({ code: 0, data: withCat || service });
  } catch (err) {
    console.error('[Service] create error:', err.message);
    res.status(500).json({ code: 500, message: '创建服务失败' });
  }
};

exports.update = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ code: 400, message: '无效的服务ID' });
    const service = await Service.findByPk(id);
    if (!service) return res.status(404).json({ code: 404, message: '服务不存在' });
    const data = pickFields(req.body);
    if (data.price !== undefined) data.price = parseFloat(data.price) || 0;
    if (data.originPrice !== undefined) data.originPrice = parseFloat(data.originPrice) || null;
    if (data.sortOrder !== undefined) data.sortOrder = parseInt(data.sortOrder, 10) || 0;
    if (data.categoryId !== undefined) data.categoryId = parseInt(data.categoryId, 10) || null;
    if (data.bgOpacity !== undefined) {
      const v = parseFloat(data.bgOpacity);
      data.bgOpacity = (v >= 0 && v <= 100) ? v : null;
    }
    await service.update(data);
    const withCat = await Service.findByPk(service.id, { include: [{ model: ServiceCategory, as: 'serviceCategory' }] });
    res.json({ code: 0, data: withCat || service });
  } catch (err) {
    console.error('[Service] update error:', err.message);
    res.status(500).json({ code: 500, message: '更新服务失败' });
  }
};

exports.remove = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ code: 400, message: '无效的服务ID' });
    const service = await Service.findByPk(id);
    if (!service) return res.status(404).json({ code: 404, message: '服务不存在' });
    await service.destroy();
    res.json({ code: 0, message: '删除成功' });
  } catch (err) {
    console.error('[Service] remove error:', err.message);
    res.status(500).json({ code: 500, message: '删除服务失败' });
  }
};
