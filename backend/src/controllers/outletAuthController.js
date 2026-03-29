const jwt = require('jsonwebtoken');
const config = require('../config');
const { OutletUser, OutletAddress } = require('../models');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');

const generateToken = (user) =>
  jwt.sign({ id: user.id, username: user.username, role: user.role, realm: 'outlet' }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });

exports.sendCode = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ code: 400, message: '邮箱不能为空' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ code: 400, message: '邮箱格式不正确' });
    const existing = await OutletUser.findOne({ where: { email } });
    if (existing) return res.status(400).json({ code: 400, message: '该邮箱已被注册' });
    await emailService.sendVerificationCode(email);
    res.json({ code: 0, message: '验证码已发送' });
  } catch (err) {
    console.error('[OutletAuth] sendCode error:', err.message);
    res.status(400).json({ code: 400, message: err.message || '发送验证码失败' });
  }
};

exports.sendSmsCode = async (req, res) => {
  try {
    const { phone, scene } = req.body;
    if (!phone) return res.status(400).json({ code: 400, message: '手机号不能为空' });
    const normalized = smsService.normalizePhone(phone);
    if (!/^1\d{10}$/.test(normalized)) return res.status(400).json({ code: 400, message: '请输入正确的11位大陆手机号' });
    if (scene === 'register') {
      const existing = await OutletUser.findOne({ where: { phone: normalized } });
      if (existing) return res.status(400).json({ code: 400, message: '该手机号已注册' });
    }
    await smsService.sendVerificationCode(phone);
    res.json({ code: 0, message: '验证码已发送' });
  } catch (err) {
    console.error('[OutletAuth] sendSmsCode error:', err.message);
    res.status(400).json({ code: 400, message: err.message || '发送验证码失败' });
  }
};

exports.register = async (req, res) => {
  try {
    const { username, password, email, code, nickname, phone, smsCode } = req.body;
    const usePhone = phone != null && String(phone).trim() !== '';

    if (usePhone) {
      if (!smsCode && !code) return res.status(400).json({ code: 400, message: '验证码不能为空' });
      const normalized = smsService.normalizePhone(phone);
      if (!/^1\d{10}$/.test(normalized)) return res.status(400).json({ code: 400, message: '手机号格式不正确' });
      const verify = smsService.verifyCode(phone, smsCode || code);
      if (!verify.valid) return res.status(400).json({ code: 400, message: verify.message });
      const existingPhone = await OutletUser.findOne({ where: { phone: normalized } });
      if (existingPhone) return res.status(400).json({ code: 400, message: '该手机号已注册' });
      const baseUsername = username && String(username).trim() ? String(username).trim() : 'outlet_' + normalized.slice(-8);
      let finalUsername = baseUsername;
      let n = 0;
      while (await OutletUser.findOne({ where: { username: finalUsername } })) { finalUsername = baseUsername + (++n); }
      if (!password || String(password).length < 6) return res.status(400).json({ code: 400, message: '密码长度不能少于6位' });
      const user = await OutletUser.create({
        username: finalUsername, password, email: null, phone: normalized,
        nickname: (nickname && String(nickname).trim()) || normalized.slice(0, 3) + '****' + normalized.slice(-4),
        role: 'outlet',
      });
      return res.json({ code: 0, data: { token: generateToken(user), user } });
    }

    if (!username || !password) return res.status(400).json({ code: 400, message: '用户名和密码不能为空' });
    if (!email) return res.status(400).json({ code: 400, message: '邮箱不能为空' });
    if (!code) return res.status(400).json({ code: 400, message: '验证码不能为空' });
    if (String(username).trim().length < 2 || String(username).trim().length > 50) return res.status(400).json({ code: 400, message: '用户名长度需在2-50个字符之间' });
    if (String(password).length < 6) return res.status(400).json({ code: 400, message: '密码长度不能少于6位' });
    const verify = emailService.verifyCode(email, code);
    if (!verify.valid) return res.status(400).json({ code: 400, message: verify.message });
    const existingUser = await OutletUser.findOne({ where: { username: String(username).trim() } });
    if (existingUser) return res.status(400).json({ code: 400, message: '用户名已存在' });
    const existingEmail = await OutletUser.findOne({ where: { email } });
    if (existingEmail) return res.status(400).json({ code: 400, message: '该邮箱已被注册' });
    const user = await OutletUser.create({
      username: String(username).trim(), password, email,
      nickname: nickname ? String(nickname).trim() : String(username).trim(),
      role: 'outlet',
    });
    res.json({ code: 0, data: { token: generateToken(user), user } });
  } catch (err) {
    console.error('[OutletAuth] register error:', err.message);
    res.status(500).json({ code: 500, message: '注册失败，请稍后重试' });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password, phone, code } = req.body;
    if (phone !== undefined && phone !== '') {
      if (!code) return res.status(400).json({ code: 400, message: '验证码不能为空' });
      const normalized = smsService.normalizePhone(phone);
      if (!/^1\d{10}$/.test(normalized)) return res.status(400).json({ code: 400, message: '手机号格式不正确' });
      const verify = smsService.verifyCode(phone, code);
      if (!verify.valid) return res.status(400).json({ code: 400, message: verify.message });
      const user = await OutletUser.findOne({ where: { phone: normalized } });
      if (!user) return res.status(400).json({ code: 400, message: '该手机号未注册，请先注册' });
      if (user.status !== 'active') return res.status(403).json({ code: 403, message: '账号已被禁用' });
      return res.json({ code: 0, data: { token: generateToken(user), user } });
    }
    if (!username || !password) return res.status(400).json({ code: 400, message: '用户名和密码不能为空' });
    const user = await OutletUser.findOne({ where: { username: String(username).trim() } });
    if (!user) return res.status(404).json({ code: 404, message: '账号不存在' });
    if (!(await user.comparePassword(password))) return res.status(401).json({ code: 401, message: '密码错误' });
    if (user.status !== 'active') return res.status(403).json({ code: 403, message: '账号已被禁用' });
    res.json({ code: 0, data: { token: generateToken(user), user } });
  } catch (err) {
    console.error('[OutletAuth] login error:', err.message);
    res.status(500).json({ code: 500, message: '登录失败，请稍后重试' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await OutletUser.findByPk(req.user.id);
    if (!user) return res.status(404).json({ code: 404, message: '用户不存在' });
    if (user.status !== 'active') return res.status(403).json({ code: 403, message: '账号已被禁用' });
    res.json({ code: 0, data: user });
  } catch (err) {
    console.error('[OutletAuth] getProfile error:', err.message);
    res.status(500).json({ code: 500, message: '获取用户信息失败' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const user = await OutletUser.findByPk(req.user.id);
    if (!user) return res.status(404).json({ code: 404, message: '用户不存在' });
    const { nickname, avatar } = req.body;
    if (nickname !== undefined) user.nickname = String(nickname).trim() || user.nickname;
    if (avatar !== undefined) user.avatar = String(avatar).trim();
    await user.save({ hooks: false });
    res.json({ code: 0, data: user });
  } catch (err) {
    console.error('[OutletAuth] updateProfile error:', err.message);
    res.status(500).json({ code: 500, message: '更新失败' });
  }
};

exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ code: 400, message: '请选择图片' });
    const cosUpload = require('../utils/cosUpload');
    const crypto = require('crypto');
    const path = require('path');
    const ext = path.extname(req.file.originalname) || '.png';
    const filename = `outlet_avatar_${crypto.randomBytes(8).toString('hex')}${ext}`;
    const avatarUrl = await cosUpload.upload(req.file.buffer, filename, req.file.mimetype);
    const user = await OutletUser.findByPk(req.user.id);
    if (user) { user.avatar = avatarUrl; await user.save({ hooks: false }); }
    res.json({ code: 0, data: { url: avatarUrl } });
  } catch (err) {
    console.error('[OutletAuth] uploadAvatar error:', err.message);
    res.status(500).json({ code: 500, message: '上传失败' });
  }
};

exports.bindPhone = async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ code: 400, message: '手机号和验证码不能为空' });
    const normalized = smsService.normalizePhone(phone);
    if (!/^1\d{10}$/.test(normalized)) return res.status(400).json({ code: 400, message: '手机号格式不正确' });
    const verify = smsService.verifyCode(phone, code);
    if (!verify.valid) return res.status(400).json({ code: 400, message: verify.message });
    const existing = await OutletUser.findOne({ where: { phone: normalized } });
    if (existing && existing.id !== req.user.id) return res.status(400).json({ code: 400, message: '该手机号已被其他账号绑定' });
    const user = await OutletUser.findByPk(req.user.id);
    if (!user) return res.status(404).json({ code: 404, message: '用户不存在' });
    user.phone = normalized;
    await user.save({ hooks: false });
    res.json({ code: 0, data: user, message: '绑定成功' });
  } catch (err) {
    console.error('[OutletAuth] bindPhone error:', err.message);
    res.status(500).json({ code: 500, message: err.message || '绑定失败' });
  }
};

exports.adminGetUsers = async (req, res) => {
  try {
    const { page = 1, pageSize = 50, searchType, q } = req.query;
    const pg = Math.max(1, parseInt(page));
    const ps = Math.max(1, Math.min(200, parseInt(pageSize)));
    const { OutletOrder } = require('../models');
    const { Op } = require('sequelize');

    const userWhere = {};
    const kw = q != null ? String(q).trim() : '';
    if (kw && searchType) {
      if (searchType === 'id') {
        const id = parseInt(kw, 10);
        if (!Number.isNaN(id) && id > 0) userWhere.id = id;
        else userWhere.id = -1;
      } else if (searchType === 'username') {
        userWhere.username = { [Op.like]: '%' + kw.replace(/%/g, '\\%') + '%' };
      } else if (searchType === 'phone') {
        userWhere.phone = { [Op.like]: '%' + kw.replace(/%/g, '\\%') + '%' };
      }
    }

    const { count, rows: users } = await OutletUser.findAndCountAll({
      where: userWhere,
      attributes: { exclude: ['password'] },
      include: [{ model: OutletAddress, as: 'addresses', required: false }],
      order: [['createdAt', 'DESC']],
      limit: ps, offset: (pg - 1) * ps, distinct: true,
    });
    const userIds = users.map(u => u.id);
    const orderCounts = userIds.length ? await OutletOrder.findAll({
      attributes: ['userId', [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'orderCount']],
      where: { userId: { [Op.in]: userIds } }, group: ['userId'], raw: true,
    }) : [];
    const countMap = {};
    orderCounts.forEach(r => { countMap[r.userId] = parseInt(r.orderCount, 10); });
    const list = users.map(u => { const p = u.toJSON(); p.orderCount = countMap[u.id] || 0; return p; });
    const totalUsers = await OutletUser.count();
    const outletCount = await OutletUser.count({ where: { role: 'outlet' } });
    const totalAddresses = await OutletAddress.count();
    res.json({ code: 0, data: { list, total: count, page: pg, pageSize: ps, stats: { totalUsers, outletCount, totalAddresses } } });
  } catch (err) {
    console.error('[OutletAuth] adminGetUsers error:', err.message);
    res.status(500).json({ code: 500, message: '获取用户列表失败' });
  }
};

// 管理端查看单个服务商详情：基础信息、地址列表、订单列表
exports.adminGetUserDetail = async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!userId) return res.status(400).json({ code: 400, message: '无效用户ID' });
    const { OutletOrder } = require('../models');
    const user = await OutletUser.findByPk(userId, {
      attributes: { exclude: ['password'] },
      include: [{ model: OutletAddress, as: 'addresses', required: false }],
      order: [[{ model: OutletAddress, as: 'addresses' }, 'createdAt', 'DESC']],
    });
    if (!user) return res.status(404).json({ code: 404, message: '用户不存在' });
    const orders = await OutletOrder.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'orderNo', 'status', 'price', 'createdAt'],
    });
    const STATUS_MAP = {
      pending: '待支付',
      paid: '已支付',
      processing: '进行中',
      completed: '已完成',
      cancelled: '已取消',
    };
    const orderList = orders.map(o => ({
      id: o.id,
      orderNo: o.orderNo,
      status: o.status,
      statusText: STATUS_MAP[o.status] || o.status,
      price: o.price,
      createdAt: o.createdAt,
    }));
    res.json({ code: 0, data: { user, orders: orderList } });
  } catch (err) {
    console.error('[OutletAuth] adminGetUserDetail error:', err.message);
    res.status(500).json({ code: 500, message: '获取用户详情失败' });
  }
};
