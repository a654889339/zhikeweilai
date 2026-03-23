const { OutletOrder, OutletUser, OutletOrderLog } = require('../models');

function generateOrderNo() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `OT${y}${m}${d}${h}${mi}${s}${rand}`;
}

const STATUS_MAP = {
  pending: { text: '待支付', type: 'warning' },
  paid: { text: '已支付', type: 'primary' },
  processing: { text: '进行中', type: 'primary' },
  completed: { text: '已完成', type: 'success' },
  cancelled: { text: '已取消', type: 'default' },
};

exports.create = async (req, res) => {
  try {
    const { serviceId, serviceTitle, serviceIcon, price, contactName, contactPhone, address, appointmentTime, remark } = req.body;
    if (!serviceTitle || !price) return res.status(400).json({ code: 400, message: '服务信息不完整' });
    const order = await OutletOrder.create({
      orderNo: generateOrderNo(), userId: req.user.id,
      serviceId: serviceId || null, serviceTitle, serviceIcon: serviceIcon || 'setting-o',
      price, contactName: contactName || '', contactPhone: contactPhone || '',
      address: address || '', appointmentTime: appointmentTime || null, remark: remark || '', status: 'pending',
    });
    res.json({ code: 0, data: order });
  } catch (err) {
    console.error('[OutletOrder] create error:', err.message);
    res.status(500).json({ code: 500, message: '创建订单失败' });
  }
};

exports.myOrders = async (req, res) => {
  try {
    const { status, page = 1, pageSize = 10 } = req.query;
    const where = { userId: req.user.id };
    if (status && status !== 'all') where.status = status;
    const pg = Math.max(1, parseInt(page));
    const ps = Math.max(1, Math.min(100, parseInt(pageSize)));
    const { count, rows } = await OutletOrder.findAndCountAll({ where, order: [['createdAt', 'DESC']], limit: ps, offset: (pg - 1) * ps });
    const list = rows.map(o => { const s = STATUS_MAP[o.status] || STATUS_MAP.pending; return { ...o.toJSON(), statusText: s.text, statusType: s.type }; });
    res.json({ code: 0, data: { list, total: count, page: pg, pageSize: ps } });
  } catch (err) {
    console.error('[OutletOrder] myOrders error:', err.message);
    res.status(500).json({ code: 500, message: '获取订单失败' });
  }
};

exports.detail = async (req, res) => {
  try {
    const order = await OutletOrder.findByPk(req.params.id);
    if (!order) return res.status(404).json({ code: 404, message: '订单不存在' });
    if (order.userId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ code: 403, message: '无权查看' });
    const s = STATUS_MAP[order.status] || STATUS_MAP.pending;
    res.json({ code: 0, data: { ...order.toJSON(), statusText: s.text, statusType: s.type } });
  } catch (err) {
    console.error('[OutletOrder] detail error:', err.message);
    res.status(500).json({ code: 500, message: '获取订单详情失败' });
  }
};

exports.cancel = async (req, res) => {
  try {
    const order = await OutletOrder.findByPk(req.params.id);
    if (!order) return res.status(404).json({ code: 404, message: '订单不存在' });
    if (order.userId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ code: 403, message: '无权操作' });
    if (order.status === 'completed' || order.status === 'cancelled') return res.status(400).json({ code: 400, message: '当前状态无法取消' });
    order.status = 'cancelled';
    await order.save();
    res.json({ code: 0, message: '订单已取消' });
  } catch (err) {
    console.error('[OutletOrder] cancel error:', err.message);
    res.status(500).json({ code: 500, message: '取消订单失败' });
  }
};

exports.adminList = async (req, res) => {
  try {
    const { status, page = 1, pageSize = 20, userId } = req.query;
    const where = {};
    if (status && status !== 'all') where.status = status;
    if (userId) where.userId = parseInt(userId, 10) || 0;
    const { count, rows } = await OutletOrder.findAndCountAll({
      where, include: [{ model: OutletUser, as: 'user', attributes: ['id', 'username', 'email', 'nickname'] }],
      order: [['createdAt', 'DESC']], limit: parseInt(pageSize), offset: (parseInt(page) - 1) * parseInt(pageSize),
    });
    const list = rows.map(o => { const s = STATUS_MAP[o.status] || STATUS_MAP.pending; return { ...o.toJSON(), statusText: s.text, statusType: s.type }; });
    res.json({ code: 0, data: { list, total: count, page: parseInt(page), pageSize: parseInt(pageSize) } });
  } catch (err) {
    console.error('[OutletOrder] adminList error:', err.message);
    res.status(500).json({ code: 500, message: '获取订单列表失败' });
  }
};

exports.adminStats = async (req, res) => {
  try {
    const total = await OutletOrder.count();
    const pending = await OutletOrder.count({ where: { status: 'pending' } });
    const processing = await OutletOrder.count({ where: { status: 'processing' } });
    const completed = await OutletOrder.count({ where: { status: 'completed' } });
    const cancelled = await OutletOrder.count({ where: { status: 'cancelled' } });
    res.json({ code: 0, data: { total, pending, processing, completed, cancelled } });
  } catch (err) {
    console.error('[OutletOrder] adminStats error:', err.message);
    res.status(500).json({ code: 500, message: '获取统计失败' });
  }
};

exports.adminUpdateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !STATUS_MAP[status]) return res.status(400).json({ code: 400, message: '无效状态' });
    const order = await OutletOrder.findByPk(req.params.id);
    if (!order) return res.status(404).json({ code: 404, message: '订单不存在' });
    const oldStatus = order.status;
    if (oldStatus !== status) {
      await OutletOrderLog.create({ orderId: order.id, changeType: 'status', oldValue: STATUS_MAP[oldStatus]?.text || oldStatus, newValue: STATUS_MAP[status]?.text || status, operator: req.user.username || 'admin' });
    }
    order.status = status;
    await order.save();
    const s = STATUS_MAP[order.status];
    res.json({ code: 0, data: { ...order.toJSON(), statusText: s.text, statusType: s.type } });
  } catch (err) {
    console.error('[OutletOrder] adminUpdateStatus error:', err.message);
    res.status(500).json({ code: 500, message: '更新状态失败' });
  }
};

exports.adminUpdatePrice = async (req, res) => {
  try {
    const { price } = req.body;
    if (price === undefined || price === null || isNaN(Number(price)) || Number(price) < 0) return res.status(400).json({ code: 400, message: '无效金额' });
    const order = await OutletOrder.findByPk(req.params.id);
    if (!order) return res.status(404).json({ code: 404, message: '订单不存在' });
    const oldPrice = order.price;
    if (Number(oldPrice) !== Number(price)) {
      await OutletOrderLog.create({ orderId: order.id, changeType: 'price', oldValue: `¥${Number(oldPrice).toFixed(2)}`, newValue: `¥${Number(price).toFixed(2)}`, operator: req.user.username || 'admin' });
    }
    order.price = price;
    await order.save();
    res.json({ code: 0, data: order });
  } catch (err) {
    console.error('[OutletOrder] adminUpdatePrice error:', err.message);
    res.status(500).json({ code: 500, message: '更新金额失败' });
  }
};

exports.adminAddRemark = async (req, res) => {
  try {
    const { remark } = req.body;
    if (!remark || !remark.trim()) return res.status(400).json({ code: 400, message: '备注不能为空' });
    const order = await OutletOrder.findByPk(req.params.id);
    if (!order) return res.status(404).json({ code: 404, message: '订单不存在' });
    await OutletOrderLog.create({ orderId: order.id, changeType: 'admin_remark', oldValue: '', newValue: remark.trim(), operator: req.user.username || 'admin' });
    order.adminRemark = remark.trim();
    await order.save();
    res.json({ code: 0, message: '备注已添加' });
  } catch (err) {
    console.error('[OutletOrder] adminAddRemark error:', err.message);
    res.status(500).json({ code: 500, message: '添加备注失败' });
  }
};

exports.adminLogs = async (req, res) => {
  try {
    const logs = await OutletOrderLog.findAll({ where: { orderId: req.params.id }, order: [['createdAt', 'DESC']] });
    const order = await OutletOrder.findByPk(req.params.id, { attributes: ['id', 'orderNo', 'adminRemark'] });
    res.json({ code: 0, data: { logs, adminRemark: order?.adminRemark || '' } });
  } catch (err) {
    console.error('[OutletOrder] adminLogs error:', err.message);
    res.status(500).json({ code: 500, message: '获取变更记录失败' });
  }
};
