const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProductCategory = sequelize.define('ProductCategory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  parentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  thumbnailUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  enableSub: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
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
  tableName: 'product_categories',
  timestamps: true,
});

module.exports = ProductCategory;
