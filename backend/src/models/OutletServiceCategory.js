const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OutletServiceCategory = sequelize.define('OutletServiceCategory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  key: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '前端分组用，如 repair, clean, inspect, data',
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active',
  },
}, {
  tableName: 'outlet_service_categories',
  timestamps: true,
});

module.exports = OutletServiceCategory;

