const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DeviceGuide = sequelize.define('DeviceGuide', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  slug: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  subtitle: {
    type: DataTypes.STRING(200),
    defaultValue: '',
  },
  icon: {
    type: DataTypes.STRING(100),
    defaultValue: 'setting-o',
  },
  iconUrl: {
    type: DataTypes.STRING(500),
    defaultValue: '',
  },
  iconUrlThumb: {
    type: DataTypes.STRING(500),
    defaultValue: '',
    comment: '图标缩略图URL，可选',
  },
  emoji: {
    type: DataTypes.STRING(20),
    defaultValue: '',
  },
  gradient: {
    type: DataTypes.STRING(300),
    defaultValue: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
  },
  badge: {
    type: DataTypes.STRING(20),
    defaultValue: '',
  },
  tags: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const raw = this.getDataValue('tags');
      try { return JSON.parse(raw || '[]'); } catch { return []; }
    },
    set(val) {
      this.setDataValue('tags', JSON.stringify(val || []));
    },
  },
  sections: {
    type: DataTypes.TEXT('long'),
    allowNull: true,
    get() {
      const raw = this.getDataValue('sections');
      try { return JSON.parse(raw || '[]'); } catch { return []; }
    },
    set(val) {
      this.setDataValue('sections', JSON.stringify(val || []));
    },
  },
  coverImage: {
    type: DataTypes.STRING(500),
    defaultValue: '',
  },
  coverImageThumb: {
    type: DataTypes.STRING(500),
    defaultValue: '',
    comment: '封面缩略图URL，可选',
  },
  showcaseVideo: {
    type: DataTypes.STRING(500),
    defaultValue: '',
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  mediaItems: {
    type: DataTypes.TEXT('long'),
    allowNull: true,
    get() {
      const raw = this.getDataValue('mediaItems');
      try { return JSON.parse(raw || '[]'); } catch { return []; }
    },
    set(val) {
      this.setDataValue('mediaItems', JSON.stringify(val || []));
    },
  },
  helpItems: {
    type: DataTypes.TEXT('long'),
    allowNull: true,
    get() {
      const raw = this.getDataValue('helpItems');
      try { return JSON.parse(raw || '[]'); } catch { return []; }
    },
    set(val) {
      this.setDataValue('helpItems', JSON.stringify(val || []));
    },
  },
  categoryId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '所属商品种类 ID',
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  qrcodeUrl: {
    type: DataTypes.STRING(500),
    defaultValue: '',
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active',
  },
}, {
  tableName: 'device_guides',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['slug'], name: 'slug' },
  ],
});

module.exports = DeviceGuide;
