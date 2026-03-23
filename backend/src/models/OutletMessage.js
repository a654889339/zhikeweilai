const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OutletMessage = sequelize.define('OutletMessage', {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  sender: { type: DataTypes.ENUM('user', 'admin'), allowNull: false, defaultValue: 'user' },
  content: { type: DataTypes.TEXT, allowNull: false },
  type: { type: DataTypes.STRING(10), defaultValue: 'text' },
  read: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  tableName: 'outlet_messages',
  timestamps: true,
});

module.exports = OutletMessage;
