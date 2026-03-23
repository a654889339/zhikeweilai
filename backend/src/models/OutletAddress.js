const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OutletAddress = sequelize.define('OutletAddress', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  contactName: { type: DataTypes.STRING(50), allowNull: false },
  contactPhone: { type: DataTypes.STRING(20), allowNull: false },
  country: { type: DataTypes.STRING(50), defaultValue: '中国大陆' },
  customCountry: { type: DataTypes.STRING(100), defaultValue: '' },
  province: { type: DataTypes.STRING(50), defaultValue: '' },
  city: { type: DataTypes.STRING(50), defaultValue: '' },
  district: { type: DataTypes.STRING(50), defaultValue: '' },
  detailAddress: { type: DataTypes.STRING(500), defaultValue: '' },
  isDefault: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  tableName: 'outlet_addresses',
  timestamps: true,
});

module.exports = OutletAddress;
