const { Op } = require('sequelize');
const {
  ChatGroup,
  ChatGroupMember,
  GroupMessage,
  User,
} = require('../models');

const ALLOWED_ROLES = ['admin', 'student', 'teacher'];

async function assertMember(groupId, userId) {
  const m = await ChatGroupMember.findOne({ where: { groupId, userId } });
  return m;
}

/** 我加入的群组 */
exports.listMine = async (req, res) => {
  try {
    const uid = req.user.id;
    const groups = await ChatGroup.findAll({
      include: [
        {
          model: ChatGroupMember,
          as: 'members',
          where: { userId: uid },
          required: true,
        },
        { model: User, as: 'creator', attributes: ['id', 'username', 'nickname'] },
      ],
      order: [['updatedAt', 'DESC']],
    });
    const list = groups.map((g) => {
      const j = g.toJSON();
      const mem = (j.members && j.members[0]) || {};
      j.myRole = mem.role;
      delete j.members;
      return j;
    });
    res.json({ code: 0, data: list });
  } catch (e) {
    console.error('[ChatGroup] listMine:', e.message);
    res.status(500).json({ code: 1, message: e.message || '加载失败' });
  }
};

/** 创建群组：创建者为 owner */
exports.create = async (req, res) => {
  try {
    const name = (req.body.name && String(req.body.name).trim()) || '';
    if (!name) return res.status(400).json({ code: 1, message: '请输入群组名称' });
    const uid = req.user.id;
    const g = await ChatGroup.create({ name, creatorId: uid });
    await ChatGroupMember.create({ groupId: g.id, userId: uid, role: 'owner' });
    const full = await ChatGroup.findByPk(g.id, {
      include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'nickname'] }],
    });
    res.json({ code: 0, data: full });
  } catch (e) {
    console.error('[ChatGroup] create:', e.message);
    res.status(500).json({ code: 1, message: e.message || '创建失败' });
  }
};

/** 加入群组（需知道群组 ID） */
exports.join = async (req, res) => {
  try {
    const groupId = parseInt(req.params.id, 10);
    if (!groupId) return res.status(400).json({ code: 1, message: '无效的群组' });
    const g = await ChatGroup.findByPk(groupId);
    if (!g) return res.status(404).json({ code: 1, message: '群组不存在' });
    const uid = req.user.id;
    const [row, created] = await ChatGroupMember.findOrCreate({
      where: { groupId, userId: uid },
      defaults: { role: 'member' },
    });
    res.json({ code: 0, data: { joined: true, role: row.role, created } });
  } catch (e) {
    console.error('[ChatGroup] join:', e.message);
    res.status(500).json({ code: 1, message: e.message || '加入失败' });
  }
};

/** 群消息列表 */
exports.listMessages = async (req, res) => {
  try {
    const groupId = parseInt(req.params.id, 10);
    const beforeId = req.query.beforeId ? parseInt(req.query.beforeId, 10) : null;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    if (!groupId) return res.status(400).json({ code: 1, message: '无效的群组' });
    const uid = req.user.id;
    if (!(await assertMember(groupId, uid))) {
      return res.status(403).json({ code: 1, message: '您不在该群组中' });
    }
    const where = { groupId };
    if (beforeId) where.id = { [Op.lt]: beforeId };
    const messages = await GroupMessage.findAll({
      where,
      include: [{ model: User, as: 'user', attributes: ['id', 'username', 'nickname', 'avatar'] }],
      order: [['id', 'DESC']],
      limit,
    });
    res.json({ code: 0, data: messages.reverse() });
  } catch (e) {
    console.error('[ChatGroup] listMessages:', e.message);
    res.status(500).json({ code: 1, message: e.message || '加载失败' });
  }
};

/** 发送文字消息 */
exports.sendMessage = async (req, res) => {
  try {
    const groupId = parseInt(req.params.id, 10);
    const content = (req.body.content && String(req.body.content).trim()) || '';
    const type = req.body.type === 'image' ? 'image' : 'text';
    if (!groupId || !content) return res.status(400).json({ code: 1, message: '内容不能为空' });
    const uid = req.user.id;
    if (!(await assertMember(groupId, uid))) {
      return res.status(403).json({ code: 1, message: '您不在该群组中' });
    }
    const msg = await GroupMessage.create({ groupId, userId: uid, content, type });
    await ChatGroup.update({ updatedAt: new Date() }, { where: { id: groupId } });
    const withUser = await GroupMessage.findByPk(msg.id, {
      include: [{ model: User, as: 'user', attributes: ['id', 'username', 'nickname', 'avatar'] }],
    });
    res.json({ code: 0, data: withUser });
  } catch (e) {
    console.error('[ChatGroup] sendMessage:', e.message);
    res.status(500).json({ code: 1, message: e.message || '发送失败' });
  }
};

/** 上传图片（content 存 URL，type=image） */
exports.uploadImage = async (req, res) => {
  try {
    const groupId = parseInt(req.params.id, 10);
    if (!req.file) return res.status(400).json({ code: 1, message: '请选择图片' });
    if (!groupId) return res.status(400).json({ code: 1, message: '无效的群组' });
    const uid = req.user.id;
    if (!(await assertMember(groupId, uid))) {
      return res.status(403).json({ code: 1, message: '您不在该群组中' });
    }
    const cosUpload = require('../utils/cosUpload');
    const crypto = require('crypto');
    const path = require('path');
    const ext = path.extname(req.file.originalname) || '.png';
    const filename = `gchat_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
    const url = await cosUpload.upload(req.file.buffer, filename, req.file.mimetype);
    const msg = await GroupMessage.create({ groupId, userId: uid, content: url, type: 'image' });
    await ChatGroup.update({ updatedAt: new Date() }, { where: { id: groupId } });
    const withUser = await GroupMessage.findByPk(msg.id, {
      include: [{ model: User, as: 'user', attributes: ['id', 'username', 'nickname', 'avatar'] }],
    });
    res.json({ code: 0, data: withUser });
  } catch (e) {
    console.error('[ChatGroup] uploadImage:', e.message);
    res.status(500).json({ code: 1, message: e.message || '上传失败' });
  }
};

/** 管理端：全部群组及成员 */
exports.adminListAll = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
    const count = await ChatGroup.count();
    const rows = await ChatGroup.findAll({
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username', 'nickname', 'phone'] },
        {
          model: ChatGroupMember,
          as: 'members',
          include: [{ model: User, as: 'user', attributes: ['id', 'username', 'nickname', 'phone'] }],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    const list = rows.map((g) => {
      const j = g.toJSON();
      const members = j.members || [];
      const owners = members.filter((m) => m.role === 'owner');
      const admins = members.filter((m) => m.role === 'admin');
      const normal = members.filter((m) => m.role === 'member');
      return {
        id: j.id,
        name: j.name,
        creator: j.creator,
        createdAt: j.createdAt,
        memberCount: members.length,
        owners,
        admins,
        members: normal,
        allMembers: members,
      };
    });
    res.json({
      code: 0,
      data: { list, total: count, page, pageSize },
    });
  } catch (e) {
    console.error('[ChatGroup] adminListAll:', e.message);
    res.status(500).json({ code: 1, message: e.message || '加载失败' });
  }
};

exports.ALLOWED_USER_ROLES = ALLOWED_ROLES;
