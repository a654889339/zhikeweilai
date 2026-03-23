const { Order, User, OrderLog } = require('../models');
const wechatPay = require('../utils/wechatPayJsapi');

function generateOrderNo() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `VN${y}${m}${d}${h}${mi}${s}${rand}`;
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
    if (!serviceTitle || !price) {
      return res.status(400).json({ code: 400, message: '服务信息不完整' });
    }
    const order = await Order.create({
      orderNo: generateOrderNo(),
      userId: req.user.id,
      serviceId: serviceId || null,
      serviceTitle,
      serviceIcon: serviceIcon || 'setting-o',
      price,
      contactName: contactName || '',
      contactPhone: contactPhone || '',
      address: address || '',
      appointmentTime: appointmentTime || null,
      remark: remark || '',
      status: 'pending',
    });
    res.json({ code: 0, data: order });
  } catch (err) {
    console.error('[Order] create error:', err.message);
    res.status(500).json({ code: 500, message: '创建订单失败' });
  }
};

exports.myOrders = async (req, res) => {
  try {
    const { status, page = 1, pageSize = 10 } = req.query;
    const where = { userId: req.user.id };
    if (status && status !== 'all') {
      where.status = status;
    }
    const pg = Math.max(1, parseInt(page));
    const ps = Math.max(1, Math.min(100, parseInt(pageSize)));
    const { count, rows } = await Order.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: ps,
      offset: (pg - 1) * ps,
    });
    const list = rows.map((o) => {
      const s = STATUS_MAP[o.status] || STATUS_MAP.pending;
      return { ...o.toJSON(), statusText: s.text, statusType: s.type };
    });
    res.json({ code: 0, data: { list, total: count, page: pg, pageSize: ps } });
  } catch (err) {
    console.error('[Order] myOrders error:', err.message);
    res.status(500).json({ code: 500, message: '获取订单失败' });
  }
};

exports.detail = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ code: 404, message: '订单不存在' });
    if (order.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ code: 403, message: '无权查看' });
    }
    const s = STATUS_MAP[order.status] || STATUS_MAP.pending;
    res.json({ code: 0, data: { ...order.toJSON(), statusText: s.text, statusType: s.type } });
  } catch (err) {
    console.error('[Order] detail error:', err.message);
    res.status(500).json({ code: 500, message: '获取订单详情失败' });
  }
};

exports.cancel = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ code: 404, message: '订单不存在' });
    if (order.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ code: 403, message: '无权操作' });
    }
    if (order.status === 'completed' || order.status === 'cancelled') {
      return res.status(400).json({ code: 400, message: '当前状态无法取消' });
    }
    order.status = 'cancelled';
    await order.save();
    res.json({ code: 0, message: '订单已取消' });
  } catch (err) {
    console.error('[Order] cancel error:', err.message);
    res.status(500).json({ code: 500, message: '取消订单失败' });
  }
};

exports.adminList = async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const { status, page = 1, pageSize = 50, orderNo, userId } = req.query;
    const where = {};
    if (status && status !== 'all') where.status = status;
    if (orderNo != null && String(orderNo).trim() !== '') {
      const on = String(orderNo).trim().replace(/%/g, '\\%');
      where.orderNo = { [Op.like]: '%' + on + '%' };
    }
    if (userId != null && String(userId).trim() !== '') {
      const uid = parseInt(userId, 10);
      if (!Number.isNaN(uid) && uid > 0) where.userId = uid;
    }
    const pg = Math.max(1, parseInt(page, 10) || 1);
    const ps = Math.max(1, Math.min(200, parseInt(pageSize, 10) || 50));
    const { count, rows } = await Order.findAndCountAll({
      where,
      include: [{ model: User, as: 'user', attributes: ['id', 'username', 'email', 'nickname', 'phone'] }],
      order: [['createdAt', 'DESC']],
      limit: ps,
      offset: (pg - 1) * ps,
    });
    const list = rows.map((o) => {
      const s = STATUS_MAP[o.status] || STATUS_MAP.pending;
      return { ...o.toJSON(), statusText: s.text, statusType: s.type };
    });
    res.json({ code: 0, data: { list, total: count, page: pg, pageSize: ps } });
  } catch (err) {
    console.error('[Order] adminList error:', err.message);
    res.status(500).json({ code: 500, message: '获取订单列表失败' });
  }
};

exports.adminUpdateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !STATUS_MAP[status]) {
      return res.status(400).json({ code: 400, message: '无效状态' });
    }
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ code: 404, message: '订单不存在' });
    const oldStatus = order.status;
    if (oldStatus !== status) {
      await OrderLog.create({
        orderId: order.id,
        changeType: 'status',
        oldValue: STATUS_MAP[oldStatus]?.text || oldStatus,
        newValue: STATUS_MAP[status]?.text || status,
        operator: req.user.username || 'admin',
      });
    }
    order.status = status;
    await order.save();
    const s = STATUS_MAP[order.status];
    res.json({ code: 0, data: { ...order.toJSON(), statusText: s.text, statusType: s.type } });
  } catch (err) {
    console.error('[Order] adminUpdateStatus error:', err.message);
    res.status(500).json({ code: 500, message: '更新状态失败' });
  }
};

exports.adminStats = async (req, res) => {
  try {
    const total = await Order.count();
    const pending = await Order.count({ where: { status: 'pending' } });
    const processing = await Order.count({ where: { status: 'processing' } });
    const completed = await Order.count({ where: { status: 'completed' } });
    const cancelled = await Order.count({ where: { status: 'cancelled' } });
    res.json({ code: 0, data: { total, pending, processing, completed, cancelled } });
  } catch (err) {
    console.error('[Order] adminStats error:', err.message);
    res.status(500).json({ code: 500, message: '获取统计失败' });
  }
};

exports.adminUpdatePrice = async (req, res) => {
  try {
    const { price } = req.body;
    if (price === undefined || price === null || isNaN(Number(price)) || Number(price) < 0) {
      return res.status(400).json({ code: 400, message: '无效金额' });
    }
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ code: 404, message: '订单不存在' });
    const oldPrice = order.price;
    if (Number(oldPrice) !== Number(price)) {
      await OrderLog.create({
        orderId: order.id,
        changeType: 'price',
        oldValue: `¥${Number(oldPrice).toFixed(2)}`,
        newValue: `¥${Number(price).toFixed(2)}`,
        operator: req.user.username || 'admin',
      });
    }
    order.price = price;
    await order.save();
    res.json({ code: 0, data: order });
  } catch (err) {
    console.error('[Order] adminUpdatePrice error:', err.message);
    res.status(500).json({ code: 500, message: '更新金额失败' });
  }
};

exports.adminAddRemark = async (req, res) => {
  try {
    const { remark } = req.body;
    if (!remark || !remark.trim()) {
      return res.status(400).json({ code: 400, message: '备注不能为空' });
    }
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ code: 404, message: '订单不存在' });
    await OrderLog.create({
      orderId: order.id,
      changeType: 'admin_remark',
      oldValue: '',
      newValue: remark.trim(),
      operator: req.user.username || 'admin',
    });
    order.adminRemark = remark.trim();
    await order.save();
    res.json({ code: 0, message: '备注已添加' });
  } catch (err) {
    console.error('[Order] adminAddRemark error:', err.message);
    res.status(500).json({ code: 500, message: '添加备注失败' });
  }
};

exports.adminLogs = async (req, res) => {
  try {
    const logs = await OrderLog.findAll({
      where: { orderId: req.params.id },
      order: [['createdAt', 'DESC']],
    });
    const order = await Order.findByPk(req.params.id, { attributes: ['id', 'orderNo', 'adminRemark'] });
    res.json({ code: 0, data: { logs, adminRemark: order?.adminRemark || '' } });
  } catch (err) {
    console.error('[Order] adminLogs error:', err.message);
    res.status(500).json({ code: 500, message: '获取变更记录失败' });
  }
};

/** 小程序：待支付订单发起微信支付统一下单，返回 wx.requestPayment 参数 */
exports.payWechatPrepay = async (req, res) => {
  try {
    if (!wechatPay.isPayConfigured()) {
      return res.status(503).json({ code: 503, message: '服务器未配置微信支付' });
    }
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ code: 404, message: '订单不存在' });
    if (order.userId !== req.user.id) return res.status(403).json({ code: 403, message: '无权操作' });
    if (order.status !== 'pending') {
      return res.status(400).json({ code: 400, message: '仅待支付订单可发起支付' });
    }
    const user = await User.findByPk(req.user.id);
    if (!user || !user.openid) {
      return res.status(400).json({ code: 400, message: '请使用微信登录后再支付' });
    }
    const totalFen = Math.round(Number(order.price) * 100);
    if (totalFen < 1) {
      return res.status(400).json({ code: 400, message: '订单金额无效' });
    }
    const prepay = await wechatPay.jsapiPrepay({
      outTradeNo: order.orderNo,
      description: (order.serviceTitle || '服务订单').slice(0, 120),
      totalFen,
      openid: user.openid,
    });
    const prepayId = prepay.prepay_id;
    if (!prepayId) {
      console.error('[Order] jsapi prepay no prepay_id', prepay);
      const msg = prepay.message || '预下单失败';
      return res.status(500).json({ code: 500, message: typeof msg === 'string' ? msg : '预下单失败' });
    }
    const paymentParams = wechatPay.buildMiniProgramPayParams(prepayId);
    res.json({ code: 0, data: paymentParams });
  } catch (err) {
    const wxErr = err.response && err.response.data;
    console.error('[Order] payWechatPrepay error:', wxErr || err.message);
    const msg = (wxErr && (wxErr.message || wxErr.code)) || err.message || '预下单失败';
    res.status(500).json({ code: 500, message: String(msg) });
  }
};

/** 微信支付结果通知（APIv3），成功时订单改为进行中 */
exports.wechatPayNotify = async (req, res) => {
  try {
    const body = req.body;
    if (!body || !body.resource) {
      return res.status(200).json({ code: 'SUCCESS', message: '成功' });
    }
    let data;
    try {
      data = wechatPay.decryptNotifyResource(body.resource);
    } catch (decErr) {
      console.error('[Order] wechat notify decrypt:', decErr.message);
      return res.status(500).json({ code: 'FAIL', message: 'decrypt' });
    }
    const outTradeNo = data.out_trade_no;
    const tradeState = data.trade_state;
    const amountFen = data.amount && data.amount.payer_total != null
      ? data.amount.payer_total
      : (data.amount && data.amount.total);
    if (tradeState !== 'SUCCESS') {
      return res.status(200).json({ code: 'SUCCESS', message: '成功' });
    }
    const order = await Order.findOne({ where: { orderNo: outTradeNo } });
    if (!order) {
      console.error('[Order] wechat notify unknown order', outTradeNo);
      return res.status(200).json({ code: 'SUCCESS', message: '成功' });
    }
    if (order.status !== 'pending') {
      return res.status(200).json({ code: 'SUCCESS', message: '成功' });
    }
    const expectFen = Math.round(Number(order.price) * 100);
    if (Number(amountFen) !== expectFen) {
      console.error('[Order] wechat notify amount mismatch', amountFen, expectFen);
      return res.status(500).json({ code: 'FAIL', message: 'amount' });
    }
    order.status = 'processing';
    await order.save();
    return res.status(200).json({ code: 'SUCCESS', message: '成功' });
  } catch (err) {
    console.error('[Order] wechatPayNotify error:', err.message);
    return res.status(500).json({ code: 'FAIL', message: err.message });
  }
};
