const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GroupMessage = sequelize.define(
  'GroupMessage',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    groupId: { type: DataTypes.INTEGER, allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    type: { type: DataTypes.STRING(16), defaultValue: 'text' },
  },
  { tableName: 'group_messages', timestamps: true, updatedAt: false }
);

module.exports = GroupMessage;
