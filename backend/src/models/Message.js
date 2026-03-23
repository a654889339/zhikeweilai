const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * 聊天消息模型
 * 用于用户与后台客服之间的即时消息通信
 * 每条消息归属于一个用户（userId），发送方通过 sender 区分（user/admin）
 */
const Message = sequelize.define('Message', {
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  // 'user' = 用户发送, 'admin' = 管理员回复
  sender: {
    type: DataTypes.ENUM('user', 'admin'),
    allowNull: false,
    defaultValue: 'user',
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  // 'text' = 普通文本, 'image' = 图片消息（content 存图片 URL）
  type: {
    type: DataTypes.STRING(10),
    defaultValue: 'text',
  },
  // 已读标记：用户查看时标记 admin 消息已读，管理员查看时标记 user 消息已读
  read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  tableName: 'messages',
  timestamps: true,
});

module.exports = Message;
