const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ChatGroup = sequelize.define(
  'ChatGroup',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    creatorId: { type: DataTypes.INTEGER, allowNull: false },
  },
  { tableName: 'chat_groups', timestamps: true }
);

module.exports = ChatGroup;
