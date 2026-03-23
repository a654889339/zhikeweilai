const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InventoryCategory = sequelize.define('InventoryCategory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
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
  tableName: 'inventory_categories',
  timestamps: true,
});

module.exports = InventoryCategory;
