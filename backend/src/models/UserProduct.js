const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserProduct = sequelize.define('UserProduct', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  productKey: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '商品序列号（与 InventoryProduct.serialNumber 一致）',
  },
}, {
  tableName: 'user_products',
  timestamps: true,
  updatedAt: false,
  indexes: [
    { unique: true, fields: ['productKey'], name: 'productKey' },
  ],
});

module.exports = UserProduct;
