const jwt = require('jsonwebtoken');
const config = require('../config');
const { User } = require('../models');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');

const generateToken = (user) =>
  jwt.sign({ id: user.id, username: user.username, role: user.role }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });

exports.sendCode = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ code: 400, message: '邮箱不能为空' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ code: 400, message: '邮箱格式不正确' });
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ code: 400, message: '该邮箱已被注册' });
    }

    await emailService.sendVerificationCode(email);
    res.json({ code: 0, message: '验证码已发送' });
  } catch (err) {
    console.error('[Auth] sendCode error:', err.message);
    res.status(400).json({ code: 400, message: err.message || '发送验证码失败' });
  }
};

exports.sendSmsCode = async (req, res) => {
  try {
    const { phone, scene } = req.body;
    if (!phone) return res.status(400).json({ code: 400, message: '手机号不能为空' });
    const normalized = smsService.normalizePhone(phone);
    if (!/^1\d{10}$/.test(normalized)) {
      return res.status(400).json({ code: 400, message: '请输入正确的11位大陆手机号' });
    }
    if (scene === 'register') {
      const existing = await User.findOne({ where: { phone: normalized } });
      if (existing) return res.status(400).json({ code: 400, message: '该手机号已注册' });
    }
    await smsService.sendVerificationCode(phone);
    res.json({ code: 0, message: '验证码已发送' });
  } catch (err) {
    console.error('[Auth] sendSmsCode error:', err.message);
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
      if (!/^1\d{10}$/.test(normalized)) {
        return res.status(400).json({ code: 400, message: '手机号格式不正确' });
      }
      const verify = smsService.verifyCode(phone, smsCode || code);
      if (!verify.valid) return res.status(400).json({ code: 400, message: verify.message });

      const existingPhone = await User.findOne({ where: { phone: normalized } });
      if (existingPhone) return res.status(400).json({ code: 400, message: '该手机号已注册' });

      const baseUsername = username && String(username).trim()
        ? String(username).trim()
        : 'u' + normalized.slice(-8);
      if (baseUsername.toLowerCase() === 'admin') {
        return res.status(400).json({ code: 400, message: '该用户名为系统保留，不可注册' });
      }
      let finalUsername = baseUsername;
      let n = 0;
      while (await User.findOne({ where: { username: finalUsername } })) {
        finalUsername = baseUsername + (++n);
      }
      if (!password || String(password).length < 6) {
        return res.status(400).json({ code: 400, message: '密码长度不能少于6位' });
      }

      const user = await User.create({
        username: finalUsername,
        password,
        email: null,
        phone: normalized,
        nickname: (nickname && String(nickname).trim()) || normalized.slice(0, 3) + '****' + normalized.slice(-4),
      });
      const token = generateToken(user);
      return res.json({ code: 0, data: { token, user } });
    }

    if (!username || !password) {
      return res.status(400).json({ code: 400, message: '用户名和密码不能为空' });
    }
    if (!email) return res.status(400).json({ code: 400, message: '邮箱不能为空' });
    if (!code) return res.status(400).json({ code: 400, message: '验证码不能为空' });
    if (String(username).trim().length < 2 || String(username).trim().length > 50) {
      return res.status(400).json({ code: 400, message: '用户名长度需在2-50个字符之间' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ code: 400, message: '密码长度不能少于6位' });
    }

    const verify = emailService.verifyCode(email, code);
    if (!verify.valid) return res.status(400).json({ code: 400, message: verify.message });

    if (String(username).trim().toLowerCase() === 'admin') {
      return res.status(400).json({ code: 400, message: '该用户名为系统保留，不可注册' });
    }
    const existingUser = await User.findOne({ where: { username: String(username).trim() } });
    if (existingUser) return res.status(400).json({ code: 400, message: '用户名已存在' });
    const existingEmail = await User.findOne({ where: { email } });
    if (existingEmail) return res.status(400).json({ code: 400, message: '该邮箱已被注册' });

    const user = await User.create({
      username: String(username).trim(),
      password,
      email,
      nickname: nickname ? String(nickname).trim() : String(username).trim(),
    });
    const token = generateToken(user);
    res.json({ code: 0, data: { token, user } });
  } catch (err) {
    console.error('[Auth] register error:', err.message);
    res.status(500).json({ code: 500, message: '注册失败，请稍后重试' });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password, phone, code } = req.body;
    if (phone !== undefined && phone !== '') {
      if (!code) return res.status(400).json({ code: 400, message: '验证码不能为空' });
      const normalized = smsService.normalizePhone(phone);
      if (!/^1\d{10}$/.test(normalized)) {
        return res.status(400).json({ code: 400, message: '手机号格式不正确' });
      }
      const verify = smsService.verifyCode(phone, code);
      if (!verify.valid) {
        return res.status(400).json({ code: 400, message: verify.message });
      }
      const user = await User.findOne({ where: { phone: normalized } });
      if (!user) return res.status(400).json({ code: 400, message: '该手机号未注册，请先注册' });
      if (user.status !== 'active') {
        return res.status(403).json({ code: 403, message: '账号已被禁用' });
      }
      const token = generateToken(user);
      return res.json({ code: 0, data: { token, user } });
    }
    if (!username || !password) {
      return res.status(400).json({ code: 400, message: '用户名和密码不能为空' });
    }
    const user = await User.findOne({ where: { username: String(username).trim() } });
    if (!user) {
      return res.status(404).json({ code: 404, message: '账号不存在' });
    }
    if (!(await user.comparePassword(password))) {
      return res.status(401).json({ code: 401, message: '密码错误' });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ code: 403, message: '账号已被禁用' });
    }
    const token = generateToken(user);
    res.json({ code: 0, data: { token, user } });
  } catch (err) {
    console.error('[Auth] login error:', err.message);
    res.status(500).json({ code: 500, message: '登录失败，请稍后重试' });
  }
};

exports.adminGetUsers = async (req, res) => {
  try {
    const { User, Address, Order, UserProduct } = require('../models');
    const { Op } = require('sequelize');
    const { page = 1, pageSize = 50, searchType, q } = req.query;
    const pg = Math.max(1, parseInt(page));
    const ps = Math.max(1, Math.min(200, parseInt(pageSize)));

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

    const { count, rows: users } = await User.findAndCountAll({
      where: userWhere,
      attributes: { exclude: ['password'] },
      include: [
        { model: Address, as: 'addresses', required: false },
      ],
      order: [['createdAt', 'DESC']],
      limit: ps,
      offset: (pg - 1) * ps,
      distinct: true,
    });

    const userIds = users.map(u => u.id);

    const orderCounts = userIds.length ? await Order.findAll({
      attributes: [
        'userId',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'orderCount'],
      ],
      where: { userId: { [Op.in]: userIds } },
      group: ['userId'],
      raw: true,
    }) : [];
    const countMap = {};
    orderCounts.forEach(r => { countMap[r.userId] = parseInt(r.orderCount, 10); });

    const orderRows = userIds.length ? await Order.findAll({
      attributes: ['id', 'userId'],
      where: { userId: { [Op.in]: userIds } },
      order: [['id', 'ASC']],
      raw: true,
    }) : [];
    const orderIdsByUser = {};
    orderRows.forEach(r => {
      if (!orderIdsByUser[r.userId]) orderIdsByUser[r.userId] = [];
      orderIdsByUser[r.userId].push(r.id);
    });

    const boundProducts = userIds.length ? await UserProduct.findAll({
      where: { userId: { [Op.in]: userIds } },
      raw: true,
    }) : [];
    const boundByUser = {};
    boundProducts.forEach(b => {
      if (!boundByUser[b.userId]) boundByUser[b.userId] = [];
      boundByUser[b.userId].push(b.productKey);
    });

    const list = users.map(u => {
      const plain = u.toJSON();
      plain.orderCount = countMap[u.id] || 0;
      plain.orderIds = orderIdsByUser[u.id] || [];
      plain.boundProductKeys = boundByUser[u.id] || [];
      return plain;
    });

    const totalUsers = await User.count();
    const adminCount = await User.count({ where: { role: 'admin' } });
    const studentCount = await User.count({ where: { role: 'student' } });
    const teacherCount = await User.count({ where: { role: 'teacher' } });
    const totalAddresses = await Address.count();

    res.json({
      code: 0,
      data: {
        list,
        total: count,
        page: pg,
        pageSize: ps,
        stats: { totalUsers, adminCount, studentCount, teacherCount, totalAddresses },
      },
    });
  } catch (err) {
    console.error('[Auth] adminGetUsers error:', err.message);
    res.status(500).json({ code: 500, message: '获取用户列表失败' });
  }
};

const USER_ROLES = ['admin', 'student', 'teacher'];

/** 管理端：修改用户角色 */
exports.adminUpdateUserRole = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const role = req.body.role != null ? String(req.body.role).trim() : '';
    if (!id || !USER_ROLES.includes(role)) {
      return res.status(400).json({ code: 400, message: '无效的角色' });
    }
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ code: 404, message: '用户不存在' });
    const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
    if (String(user.username).toLowerCase() === ADMIN_USERNAME.toLowerCase() && role !== 'admin') {
      return res.status(400).json({ code: 400, message: '不能修改默认管理员角色' });
    }
    if (user.role === 'admin' && role !== 'admin') {
      const n = await User.count({ where: { role: 'admin' } });
      if (n <= 1) return res.status(400).json({ code: 400, message: '至少保留一名管理员' });
    }
    user.role = role;
    await user.save();
    res.json({ code: 0, message: '已更新', data: { id: user.id, role: user.role } });
  } catch (err) {
    console.error('[Auth] adminUpdateUserRole error:', err.message);
    res.status(500).json({ code: 500, message: err.message || '更新失败' });
  }
};

/** 管理端：解除用户与商品的绑定 */
exports.adminUnbindProduct = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const productKey = req.params.productKey != null ? String(req.params.productKey).trim() : '';
    if (!userId || !productKey) {
      return res.status(400).json({ code: 400, message: '参数无效' });
    }
    const { UserProduct } = require('../models');
    const n = await UserProduct.destroy({
      where: { userId, productKey },
    });
    if (n === 0) return res.status(404).json({ code: 404, message: '该用户未绑定此商品' });
    res.json({ code: 0, message: '已解除绑定' });
  } catch (err) {
    console.error('[Auth] adminUnbindProduct error:', err.message);
    res.status(500).json({ code: 500, message: err.message || '操作失败' });
  }
};

exports.wxLogin = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ code: 400, message: 'code不能为空' });

    const { appId, appSecret } = config.wechat || {};
    if (!appId || !appSecret) {
      return res.status(500).json({ code: 500, message: '微信配置缺失，请联系管理员' });
    }

    const https = require('https');
    const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`;
    const wxData = await new Promise((resolve, reject) => {
      https.get(wxUrl, (resp) => {
        let data = '';
        resp.on('data', c => (data += c));
        resp.on('end', () => {
          try { resolve(JSON.parse(data)); } catch { reject(new Error('微信接口返回格式错误')); }
        });
      }).on('error', reject);
    });

    if (wxData.errcode) {
      console.error('[Auth] wx jscode2session error:', wxData);
      return res.status(400).json({ code: 400, message: wxData.errmsg || '微信登录失败' });
    }

    const openid = wxData.openid;
    if (!openid) return res.status(400).json({ code: 400, message: '获取openid失败' });

    let user = await User.findOne({ where: { openid } });
    let isNew = false;
    if (!user) {
      const crypto = require('crypto');
      const shortId = crypto.randomBytes(4).toString('hex');
      const randomPwd = crypto.randomBytes(16).toString('hex');
      user = await User.create({
        username: `wx_${shortId}`,
        password: randomPwd,
        nickname: '微信用户',
        openid,
        email: null,
      });
      isNew = true;
    }

    const token = generateToken(user);
    res.json({ code: 0, data: { token, user, isNew } });
  } catch (err) {
    console.error('[Auth] wxLogin error:', err.message);
    res.status(500).json({ code: 500, message: '微信登录失败' });
  }
};

exports.alipayLogin = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ code: 400, message: 'code不能为空' });

    const { appId, privateKey, publicKey } = config.alipay || {};
    if (!appId || !privateKey) {
      return res.status(500).json({ code: 500, message: '支付宝配置缺失，请联系管理员' });
    }

    const AlipaySdk = require('alipay-sdk').default || require('alipay-sdk');
    const sdk = new AlipaySdk({
      appId,
      privateKey,
      alipayPublicKey: publicKey,
    });

    const result = await sdk.exec('alipay.system.oauth.token', {
      grantType: 'authorization_code',
      code,
    });

    const userId = result.userId || result.user_id;
    if (!userId) {
      console.error('[Auth] alipay oauth result:', result);
      return res.status(400).json({ code: 400, message: result.subMsg || '支付宝登录失败' });
    }

    let user = await User.findOne({ where: { alipayId: userId } });
    let isNew = false;
    if (!user) {
      const crypto = require('crypto');
      const shortId = crypto.randomBytes(4).toString('hex');
      const randomPwd = crypto.randomBytes(16).toString('hex');
      user = await User.create({
        username: `ali_${shortId}`,
        password: randomPwd,
        nickname: '支付宝用户',
        alipayId: userId,
        email: null,
      });
      isNew = true;
    }

    const token = generateToken(user);
    res.json({ code: 0, data: { token, user, isNew } });
  } catch (err) {
    console.error('[Auth] alipayLogin error:', err.message);
    res.status(500).json({ code: 500, message: '支付宝登录失败' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ code: 404, message: '用户不存在' });

    const { nickname, avatar } = req.body;
    if (nickname !== undefined) user.nickname = String(nickname).trim() || user.nickname;
    if (avatar !== undefined) user.avatar = String(avatar).trim();
    await user.save({ hooks: false });

    res.json({ code: 0, data: user });
  } catch (err) {
    console.error('[Auth] updateProfile error:', err.message);
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
    const filename = `avatar_${crypto.randomBytes(8).toString('hex')}${ext}`;
    const avatarUrl = await cosUpload.upload(req.file.buffer, filename, req.file.mimetype);

    const user = await User.findByPk(req.user.id);
    if (user) {
      user.avatar = avatarUrl;
      await user.save({ hooks: false });
    }

    res.json({ code: 0, data: { url: avatarUrl } });
  } catch (err) {
    console.error('[Auth] uploadAvatar error:', err.message);
    res.status(500).json({ code: 500, message: '上传失败' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ code: 404, message: '用户不存在' });
    if (user.status !== 'active') {
      return res.status(403).json({ code: 403, message: '账号已被禁用' });
    }
    res.json({ code: 0, data: user });
  } catch (err) {
    console.error('[Auth] getProfile error:', err.message);
    res.status(500).json({ code: 500, message: '获取用户信息失败' });
  }
};

/** 当前用户绑定商品（扫码后调用，序列号作为参数）。一个库存商品只能被一个用户绑定。 */
exports.bindProduct = async (req, res) => {
  try {
    const { sn } = req.body;
    const productKey = sn != null ? String(sn).trim() : '';
    if (!productKey) return res.status(400).json({ code: 400, message: '序列号不能为空' });

    const { InventoryProduct, UserProduct } = require('../models');
    const product = await InventoryProduct.findOne({ where: { serialNumber: productKey } });
    if (!product) return res.status(404).json({ code: 404, message: '未找到该序列号对应的商品' });
    if (product.status !== 'active') return res.status(400).json({ code: 400, message: '商品已下架' });

    const existing = await UserProduct.findOne({ where: { productKey } });
    if (existing) {
      if (existing.userId === req.user.id) {
        const guideSlug = (product.guideSlug && String(product.guideSlug).trim()) ? String(product.guideSlug).trim() : '';
        return res.json({ code: 0, data: { productKey, productName: product.name, guideSlug }, message: '绑定成功' });
      }
      return res.status(400).json({ code: 400, message: '该商品已被其他账号绑定' });
    }
    await UserProduct.create({ userId: req.user.id, productKey });
    const guideSlug = (product.guideSlug && String(product.guideSlug).trim()) ? String(product.guideSlug).trim() : '';
    res.json({ code: 0, data: { productKey, productName: product.name, guideSlug }, message: '绑定成功' });
  } catch (err) {
    console.error('[Auth] bindProduct error:', err.message);
    res.status(500).json({ code: 500, message: err.message || '绑定失败' });
  }
};

/** 上传二维码图片，解码后绑定商品（小程序/网页上传图片用） */
exports.bindByQrImage = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ code: 400, message: '请上传图片' });
    }
    const sharp = require('sharp');
    const jsQR = require('jsqr');
    let buf = req.file.buffer;
    const meta = await sharp(buf).metadata();
    if ((meta.width || 0) > 1200 || (meta.height || 0) > 1200) {
      buf = await sharp(buf).resize(1200, 1200, { fit: 'inside' }).toBuffer();
    }
    const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const arr = new Uint8ClampedArray(data);
    const decoded = jsQR(arr, info.width, info.height);
    if (!decoded || !decoded.data) {
      return res.status(400).json({ code: 400, message: '未能识别二维码，请上传清晰的商品二维码图片' });
    }
    const raw = String(decoded.data).trim();
    let sn = '';
    let guide = '';
    try {
      const url = raw.startsWith('http') ? new URL(raw) : new URL(raw, 'http://dummy');
      sn = url.searchParams.get('sn') || '';
      guide = url.searchParams.get('guide') || '';
    } catch {
      const snMatch = raw.match(/[?&]sn=([^&]+)/);
      const guideMatch = raw.match(/[?&]guide=([^&]+)/);
      if (snMatch) sn = decodeURIComponent(snMatch[1].replace(/\+/g, ' '));
      if (guideMatch) guide = decodeURIComponent(guideMatch[1].replace(/\+/g, ' '));
    }
    sn = sn.trim();
    if (!sn) {
      return res.status(400).json({ code: 400, message: '二维码中未包含序列号，请使用商品绑定二维码' });
    }
    const { InventoryProduct, UserProduct } = require('../models');
    const product = await InventoryProduct.findOne({ where: { serialNumber: sn } });
    if (!product) return res.status(404).json({ code: 404, message: '未找到该序列号对应的商品' });
    if (product.status !== 'active') return res.status(400).json({ code: 400, message: '商品已下架' });
    const existing = await UserProduct.findOne({ where: { productKey: sn } });
    if (existing) {
      if (existing.userId === req.user.id) {
        const guideSlug = (product.guideSlug && String(product.guideSlug).trim()) ? String(product.guideSlug).trim() : (guide || '');
        return res.json({ code: 0, data: { productKey: sn, productName: product.name, guideSlug }, message: '绑定成功' });
      }
      return res.status(400).json({ code: 400, message: '该商品已被其他账号绑定' });
    }
    await UserProduct.create({ userId: req.user.id, productKey: sn });
    const guideSlug = (product.guideSlug && String(product.guideSlug).trim()) ? String(product.guideSlug).trim() : (guide || '');
    res.json({ code: 0, data: { productKey: sn, productName: product.name, guideSlug }, message: '绑定成功' });
  } catch (err) {
    console.error('[Auth] bindByQrImage error:', err.message);
    res.status(500).json({ code: 500, message: err.message || '绑定失败' });
  }
};

/** 当前用户已绑定的商品列表（含种类、名称、序列号、绑定时间） */
exports.myProducts = async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const { UserProduct, InventoryProduct, InventoryCategory, DeviceGuide, ProductCategory } = require('../models');
    const list = await UserProduct.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
    });
    const keys = list.map(l => l.productKey);
    const products = await InventoryProduct.findAll({
      where: { serialNumber: keys },
      include: [{ model: InventoryCategory, as: 'category', attributes: ['id', 'name'] }],
    });

    const rawSlugs = products
      .map(p => ((p.guideSlug && String(p.guideSlug).trim()) ? String(p.guideSlug).trim() : ''))
      .filter(Boolean);
    const slugExistsRows = rawSlugs.length
      ? await DeviceGuide.findAll({
        where: { slug: { [Op.in]: [...new Set(rawSlugs)] }, status: 'active' },
        attributes: ['slug'],
      })
      : [];
    const validSlugSet = new Set(slugExistsRows.map(r => r.slug).filter(Boolean));

    const invCatNames = [...new Set(products.map(p => (p.category && p.category.name) || '').filter(Boolean))];
    const productCats = invCatNames.length
      ? await ProductCategory.findAll({ where: { name: { [Op.in]: invCatNames } }, attributes: ['id', 'name'] })
      : [];
    const invNameToPcId = {};
    productCats.forEach(pc => { invNameToPcId[pc.name] = pc.id; });

    const pcIds = productCats.map(pc => pc.id);
    const defaultSlugByPcId = {};
    if (pcIds.length) {
      const dgList = await DeviceGuide.findAll({
        where: { categoryId: { [Op.in]: pcIds }, status: 'active' },
        attributes: ['slug', 'categoryId', 'sortOrder'],
        order: [['sortOrder', 'ASC'], ['id', 'ASC']],
      });
      dgList.forEach(g => {
        const cid = g.categoryId;
        if (cid != null && g.slug && !defaultSlugByPcId[cid]) defaultSlugByPcId[cid] = String(g.slug).trim();
      });
    }

    const resolveEffectiveSlug = (p) => {
      const raw = (p.guideSlug && String(p.guideSlug).trim()) ? String(p.guideSlug).trim() : '';
      if (raw && validSlugSet.has(raw)) return raw;
      const cn = (p.category && p.category.name) || '';
      const pcId = invNameToPcId[cn];
      if (pcId != null && defaultSlugByPcId[pcId]) return defaultSlugByPcId[pcId];
      return '';
    };

    const infoMap = {};
    const effectiveSlugs = [];
    products.forEach(p => {
      const guideSlug = resolveEffectiveSlug(p);
      if (guideSlug) effectiveSlugs.push(guideSlug);
      infoMap[p.serialNumber] = {
        productName: p.name,
        categoryName: (p.category && p.category.name) || '',
        guideSlug,
      };
    });
    const guideBySlug = {};
    if (effectiveSlugs.length) {
      const guides = await DeviceGuide.findAll({
        where: { slug: { [Op.in]: [...new Set(effectiveSlugs)] } },
        attributes: ['slug', 'iconUrl', 'iconUrlThumb'],
      });
      guides.forEach(g => { guideBySlug[g.slug || ''] = { iconUrl: g.iconUrl || '', iconUrlThumb: g.iconUrlThumb || '' }; });
    }
    const data = list.map(l => {
      const info = infoMap[l.productKey];
      const guide = info && info.guideSlug ? guideBySlug[info.guideSlug] : null;
      return {
        productKey: l.productKey,
        productName: (info && info.productName) || l.productKey,
        categoryName: (info && info.categoryName) || '',
        guideSlug: (info && info.guideSlug) || '',
        iconUrl: (guide && guide.iconUrl) || '',
        iconUrlThumb: (guide && guide.iconUrlThumb) || '',
        boundAt: l.createdAt,
      };
    });
    res.json({ code: 0, data });
  } catch (err) {
    console.error('[Auth] myProducts error:', err.message);
    res.status(500).json({ code: 500, message: '获取失败' });
  }
};

exports.bindPhone = async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ code: 400, message: '手机号和验证码不能为空' });
    }
    const normalized = smsService.normalizePhone(phone);
    if (!/^1\d{10}$/.test(normalized)) {
      return res.status(400).json({ code: 400, message: '手机号格式不正确' });
    }
    const verify = smsService.verifyCode(phone, code);
    if (!verify.valid) {
      return res.status(400).json({ code: 400, message: verify.message });
    }
    const existing = await User.findOne({ where: { phone: normalized } });
    if (existing && existing.id !== req.user.id) {
      return res.status(400).json({ code: 400, message: '该手机号已被其他账号绑定' });
    }
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ code: 404, message: '用户不存在' });
    user.phone = normalized;
    await user.save({ hooks: false });
    res.json({ code: 0, data: user, message: '绑定成功' });
  } catch (err) {
    console.error('[Auth] bindPhone error:', err.message);
    res.status(500).json({ code: 500, message: err.message || '绑定失败' });
  }
};
