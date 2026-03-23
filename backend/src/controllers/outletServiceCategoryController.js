const { OutletServiceCategory, OutletService } = require('../models');

exports.list = async (req, res) => {
  try {
    const list = await OutletServiceCategory.findAll({
      order: [['sortOrder', 'ASC'], ['id', 'ASC']],
    });
    res.json({ code: 0, data: list });
  } catch (err) {
    console.error('[OutletServiceCategory] list error:', err.message);
    res.status(500).json({ code: 500, message: '获取服务种类列表失败' });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, key, sortOrder, status } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ code: 400, message: '种类名称不能为空' });
    const cat = await OutletServiceCategory.create({
      name: name.trim(),
      key: (key && key.trim()) || null,
      sortOrder: parseInt(sortOrder, 10) || 0,
      status: status || 'active',
    });
    res.json({ code: 0, data: cat });
  } catch (err) {
    console.error('[OutletServiceCategory] create error:', err.message);
    res.status(500).json({ code: 500, message: '创建失败' });
  }
};

exports.update = async (req, res) => {
  try {
    const cat = await OutletServiceCategory.findByPk(req.params.id);
    if (!cat) return res.status(404).json({ code: 404, message: '种类不存在' });
    const { name, key, sortOrder, status } = req.body;
    if (name !== undefined) cat.name = name.trim();
    if (key !== undefined) cat.key = (key && key.trim()) || null;
    if (sortOrder !== undefined) cat.sortOrder = parseInt(sortOrder, 10) || 0;
    if (status !== undefined) cat.status = status;
    await cat.save();
    res.json({ code: 0, data: cat });
  } catch (err) {
    console.error('[OutletServiceCategory] update error:', err.message);
    res.status(500).json({ code: 500, message: '更新失败' });
  }
};

exports.remove = async (req, res) => {
  try {
    const cat = await OutletServiceCategory.findByPk(req.params.id);
    if (!cat) return res.status(404).json({ code: 404, message: '种类不存在' });
    const used = await OutletService.count({ where: { categoryId: cat.id } });
    if (used > 0) return res.status(400).json({ code: 400, message: '该种类下还有具体服务，请先删除或移出后再删种类' });
    await cat.destroy();
    res.json({ code: 0, message: '删除成功' });
  } catch (err) {
    console.error('[OutletServiceCategory] remove error:', err.message);
    res.status(500).json({ code: 500, message: '删除失败' });
  }
};

