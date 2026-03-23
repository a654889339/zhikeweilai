const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OrderLog = sequelize.define('OrderLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  orderId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  changeType: {
    type: DataTypes.ENUM('status', 'price', 'admin_remark'),
    allowNull: false,
  },
  oldValue: {
    type: DataTypes.STRING(500),
    defaultValue: '',
  },
  newValue: {
    type: DataTypes.STRING(500),
    defaultValue: '',
  },
  operator: {
    type: DataTypes.STRING(100),
    defaultValue: 'system',
  },
}, {
  tableName: 'order_logs',
  timestamps: true,
  updatedAt: false,
});

module.exports = OrderLog;
