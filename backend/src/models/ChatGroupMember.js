const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ChatGroupMember = sequelize.define(
  'ChatGroupMember',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    groupId: { type: DataTypes.INTEGER, allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    role: {
      type: DataTypes.ENUM('owner', 'admin', 'member'),
      allowNull: false,
      defaultValue: 'member',
    },
  },
  {
    tableName: 'chat_group_members',
    timestamps: true,
    updatedAt: false,
    indexes: [{ unique: true, fields: ['groupId', 'userId'], name: 'uniq_group_user' }],
  }
);

module.exports = ChatGroupMember;
