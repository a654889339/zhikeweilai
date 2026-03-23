const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OutletHomeConfig = sequelize.define('OutletHomeConfig', {
  section: { type: DataTypes.STRING(50), allowNull: false },
  title: { type: DataTypes.STRING(100), defaultValue: '' },
  desc: { type: DataTypes.STRING(200), defaultValue: '' },
  icon: { type: DataTypes.STRING(100), defaultValue: '' },
  imageUrl: { type: DataTypes.STRING(500), defaultValue: '' },
  imageUrlThumb: { type: DataTypes.STRING(500), defaultValue: '' },
  color: { type: DataTypes.STRING(200), defaultValue: '' },
  path: { type: DataTypes.STRING(200), defaultValue: '/services' },
  price: { type: DataTypes.STRING(20), defaultValue: '' },
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
  status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' },
}, {
  tableName: 'outlet_home_configs',
  timestamps: true,
});

module.exports = OutletHomeConfig;
