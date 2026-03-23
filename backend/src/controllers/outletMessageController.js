const { OutletMessage, OutletUser } = require('../models');
const { Op } = require('sequelize');

exports.myMessages = async (req, res) => {
  try {
    const messages = await OutletMessage.findAll({ where: { userId: req.user.id }, order: [['createdAt', 'ASC']] });
    await OutletMessage.update({ read: true }, { where: { userId: req.user.id, sender: 'admin', read: false } });
    res.json({ code: 0, data: messages });
  } catch (e) { res.status(500).json({ code: 1, message: e.message }); }
};

exports.send = async (req, res) => {
  try {
    const { content, type } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ code: 1, message: '消息不能为空' });
    const msg = await OutletMessage.create({ userId: req.user.id, sender: 'user', content: content.trim(), type: type === 'image' ? 'image' : 'text' });
    res.json({ code: 0, data: msg });
  } catch (e) { res.status(500).json({ code: 1, message: e.message }); }
};

exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ code: 1, message: '请选择图片' });
    const cosUpload = require('../utils/cosUpload');
    const crypto = require('crypto');
    const path = require('path');
    const ext = path.extname(req.file.originalname) || '.png';
    const filename = `outlet_chat_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
    const url = await cosUpload.upload(req.file.buffer, filename, req.file.mimetype);
    res.json({ code: 0, data: { url } });
  } catch (e) { res.status(500).json({ code: 1, message: '上传失败' }); }
};

exports.unreadCount = async (req, res) => {
  try {
    const count = await OutletMessage.count({ where: { userId: req.user.id, sender: 'admin', read: false } });
    res.json({ code: 0, data: count });
  } catch (e) { res.status(500).json({ code: 1, message: e.message }); }
};

exports.adminConversations = async (req, res) => {
  try {
    const users = await OutletUser.findAll({
      attributes: ['id', 'username', 'nickname', 'avatar'],
      include: [{ model: OutletMessage, as: 'messages', attributes: ['id', 'content', 'sender', 'read', 'type', 'createdAt'], order: [['createdAt', 'DESC']], limit: 1 }],
    });
    const list = users.filter(u => u.messages && u.messages.length > 0).map(u => {
      const last = u.messages[0];
      return { userId: u.id, username: u.username, nickname: u.nickname || u.username, avatar: u.avatar || '', lastMessage: last.content, lastTime: last.createdAt, lastSender: last.sender, lastType: last.type || 'text' };
    }).sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));
    const unreadCounts = await OutletMessage.findAll({
      attributes: ['userId', [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'cnt']],
      where: { sender: 'user', read: false }, group: ['userId'], raw: true,
    });
    const unreadMap = {};
    unreadCounts.forEach(r => { unreadMap[r.userId] = parseInt(r.cnt); });
    list.forEach(c => { c.unread = unreadMap[c.userId] || 0; });
    res.json({ code: 0, data: list });
  } catch (e) { res.status(500).json({ code: 1, message: e.message }); }
};

exports.adminGetMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const messages = await OutletMessage.findAll({ where: { userId }, order: [['createdAt', 'ASC']] });
    await OutletMessage.update({ read: true }, { where: { userId, sender: 'user', read: false } });
    res.json({ code: 0, data: messages });
  } catch (e) { res.status(500).json({ code: 1, message: e.message }); }
};

exports.adminReply = async (req, res) => {
  try {
    const { userId } = req.params;
    const { content, type } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ code: 1, message: '消息不能为空' });
    const msg = await OutletMessage.create({ userId: parseInt(userId), sender: 'admin', content: content.trim(), type: type === 'image' ? 'image' : 'text' });
    res.json({ code: 0, data: msg });
  } catch (e) { res.status(500).json({ code: 1, message: e.message }); }
};
