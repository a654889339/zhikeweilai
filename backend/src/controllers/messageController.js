const Message = require('../models/Message');
const User = require('../models/User');
const { Op } = require('sequelize');

/**
 * 获取当前用户的所有聊天记录（按时间正序）
 * 同时将管理员发来的未读消息标记为已读
 */
exports.myMessages = async (req, res) => {
  try {
    const messages = await Message.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'ASC']],
    });
    // 标记管理员发来的消息为已读
    await Message.update({ read: true }, {
      where: { userId: req.user.id, sender: 'admin', read: false },
    });
    res.json({ code: 0, data: messages });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message });
  }
};

/**
 * 用户发送消息给客服
 */
exports.send = async (req, res) => {
  try {
    const { content, type } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ code: 1, message: '消息不能为空' });
    const msg = await Message.create({
      userId: req.user.id,
      sender: 'user',
      content: content.trim(),
      type: type === 'image' ? 'image' : 'text',
    });
    res.json({ code: 0, data: msg });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message });
  }
};

/**
 * 用户上传聊天图片到 COS，返回图片 URL
 */
exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ code: 1, message: '请选择图片' });
    const cosUpload = require('../utils/cosUpload');
    const crypto = require('crypto');
    const path = require('path');
    const ext = path.extname(req.file.originalname) || '.png';
    const filename = `chat_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
    const url = await cosUpload.upload(req.file.buffer, filename, req.file.mimetype);
    res.json({ code: 0, data: { url } });
  } catch (e) {
    console.error('[Message] uploadImage error:', e.message);
    res.status(500).json({ code: 1, message: '上传失败' });
  }
};

/**
 * 获取当前用户的未读消息数（仅统计管理员发来的未读消息）
 * 前端每 30 秒轮询此接口，用于悬浮按钮红点提示
 */
exports.unreadCount = async (req, res) => {
  try {
    const count = await Message.count({
      where: { userId: req.user.id, sender: 'admin', read: false },
    });
    res.json({ code: 0, data: count });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message });
  }
};

/**
 * [管理员] 获取会话列表
 * 查询所有有消息的用户，返回每个用户的最后一条消息、未读数等摘要信息
 * 按最后消息时间降序排列
 */
exports.adminConversations = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'username', 'nickname', 'avatar'],
      include: [{
        model: Message,
        as: 'messages',
        attributes: ['id', 'content', 'sender', 'read', 'type', 'createdAt'],
        order: [['createdAt', 'DESC']],
        limit: 1,
      }],
    });
    // 过滤出有消息的用户，组装会话摘要
    const list = users
      .filter(u => u.messages && u.messages.length > 0)
      .map(u => {
        const last = u.messages[0];
        return {
          userId: u.id,
          username: u.username,
          nickname: u.nickname || u.username,
          avatar: u.avatar || '',
          lastMessage: last.content,
          lastTime: last.createdAt,
          lastSender: last.sender,
          lastType: last.type || 'text',
        };
      })
      .sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));

    // 统计每个用户的未读消息数（用户发来的未读消息）
    const unreadCounts = await Message.findAll({
      attributes: ['userId', [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'cnt']],
      where: { sender: 'user', read: false },
      group: ['userId'],
      raw: true,
    });
    const unreadMap = {};
    unreadCounts.forEach(r => { unreadMap[r.userId] = parseInt(r.cnt); });
    list.forEach(c => { c.unread = unreadMap[c.userId] || 0; });

    res.json({ code: 0, data: list });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message });
  }
};

/**
 * [管理员] 获取指定用户的完整聊天记录
 * 同时将该用户发来的未读消息标记为已读
 */
exports.adminGetMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const messages = await Message.findAll({
      where: { userId },
      order: [['createdAt', 'ASC']],
    });
    await Message.update({ read: true }, {
      where: { userId, sender: 'user', read: false },
    });
    res.json({ code: 0, data: messages });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message });
  }
};

/**
 * [管理员] 回复指定用户的消息
 */
exports.adminReply = async (req, res) => {
  try {
    const { userId } = req.params;
    const { content, type } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ code: 1, message: '消息不能为空' });
    const msg = await Message.create({
      userId: parseInt(userId),
      sender: 'admin',
      content: content.trim(),
      type: type === 'image' ? 'image' : 'text',
    });
    res.json({ code: 0, data: msg });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message });
  }
};
