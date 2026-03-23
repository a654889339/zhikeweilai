const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Service = sequelize.define('Service', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    defaultValue: '',
  },
  icon: {
    type: DataTypes.STRING(500),
    defaultValue: '',
  },
  iconUrl: {
    type: DataTypes.STRING(500),
    defaultValue: '',
    comment: '图标图片 URL，有则前台显示图片，否则显示 icon 图标名',
  },
  cover: {
    type: DataTypes.STRING(500),
    defaultValue: '',
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '兼容旧数据，新数据用 categoryId',
  },
  categoryId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '所属服务种类 ID',
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  originPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: '原价，详情页展示',
  },
  bg: {
    type: DataTypes.STRING(50),
    defaultValue: '#B91C1C',
    comment: '卡片/详情头部背景色',
  },
  bgOpacity: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    comment: '背景色透明度 0-100，100 为不透明，用于前台服务详情头部',
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active',
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  tableName: 'services',
  timestamps: true,
});

module.exports = Service;
