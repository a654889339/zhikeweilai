const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const HomeConfig = sequelize.define('HomeConfig', {
  section: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING(100),
    defaultValue: '',
  },
  desc: {
    type: DataTypes.STRING(200),
    defaultValue: '',
  },
  icon: {
    type: DataTypes.STRING(100),
    defaultValue: '',
  },
  imageUrl: {
    type: DataTypes.STRING(500),
    defaultValue: '',
    comment: '图片URL，用于开场动画logo等',
  },
  imageUrlThumb: {
    type: DataTypes.STRING(500),
    defaultValue: '',
    comment: '缩略图URL，可选，配置后优先加载缩略图再加载原图',
  },
  color: {
    type: DataTypes.STRING(200),
    defaultValue: '',
  },
  path: {
    type: DataTypes.STRING(200),
    defaultValue: '/services',
  },
  price: {
    type: DataTypes.STRING(20),
    defaultValue: '',
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
  tableName: 'home_configs',
  timestamps: true,
});

module.exports = HomeConfig;
