const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OutletOrderLog = sequelize.define('OutletOrderLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  orderId: { type: DataTypes.INTEGER, allowNull: false },
  changeType: { type: DataTypes.ENUM('status', 'price', 'admin_remark'), allowNull: false },
  oldValue: { type: DataTypes.STRING(500), defaultValue: '' },
  newValue: { type: DataTypes.STRING(500), defaultValue: '' },
  operator: { type: DataTypes.STRING(100), defaultValue: 'system' },
}, {
  tableName: 'outlet_order_logs',
  timestamps: true,
  updatedAt: false,
});

module.exports = OutletOrderLog;
