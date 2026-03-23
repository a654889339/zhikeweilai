const { ProductCategory } = require('../models');

exports.list = async (req, res) => {
  try {
    const list = await ProductCategory.findAll({
      order: [['sortOrder', 'ASC'], ['id', 'ASC']],
    });
    res.json({ code: 0, data: list });
  } catch (err) {
    console.error('[ProductCategory] list error:', err.message);
    res.status(500).json({ code: 500, message: '获取种类列表失败' });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, sortOrder, status } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ code: 400, message: '种类名称不能为空' });
    const cat = await ProductCategory.create({
      name: name.trim(),
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
    const { name, sortOrder, status } = req.body;
    if (name !== undefined) cat.name = name.trim();
    if (sortOrder !== undefined) cat.sortOrder = parseInt(sortOrder, 10) || 0;
    if (status !== undefined) cat.status = status;
    await cat.save();
    res.json({ code: 0, data: cat });
  } catch (err) {
    console.error('[ProductCategory] update error:', err.message);
    res.status(500).json({ code: 500, message: '更新失败' });
  }
};

exports.remove = async (req, res) => {
  try {
    const cat = await ProductCategory.findByPk(req.params.id);
    if (!cat) return res.status(404).json({ code: 404, message: '种类不存在' });
    await cat.destroy();
    res.json({ code: 0, message: '删除成功' });
  } catch (err) {
    console.error('[ProductCategory] remove error:', err.message);
    res.status(500).json({ code: 500, message: '删除失败' });
  }
};
