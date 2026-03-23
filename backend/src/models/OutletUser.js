const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

const OutletUser = sequelize.define('OutletUser', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  username: { type: DataTypes.STRING(50), allowNull: false },
  email: { type: DataTypes.STRING(255), allowNull: true },
  password: { type: DataTypes.STRING(255), allowNull: false },
  nickname: { type: DataTypes.STRING(100), defaultValue: '' },
  openid: { type: DataTypes.STRING(100), allowNull: true },
  alipayId: { type: DataTypes.STRING(100), allowNull: true },
  avatar: { type: DataTypes.STRING(500), defaultValue: '' },
  phone: { type: DataTypes.STRING(20), defaultValue: '' },
  role: {
    type: DataTypes.ENUM('outlet', 'admin'),
    defaultValue: 'outlet',
  },
  status: {
    type: DataTypes.ENUM('active', 'disabled'),
    defaultValue: 'active',
  },
}, {
  tableName: 'outlet_users',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['username'], name: 'outlet_users_username' },
    { unique: true, fields: ['email'], name: 'outlet_users_email' },
    { unique: true, fields: ['openid'], name: 'outlet_users_openid' },
    { unique: true, fields: ['alipayId'], name: 'outlet_users_alipayId' },
  ],
  hooks: {
    beforeCreate: async (user) => {
      if (!user.password || String(user.password).trim().length === 0) throw new Error('密码不能为空');
      user.password = await bcrypt.hash(user.password, 10);
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        if (!user.password || String(user.password).trim().length === 0) throw new Error('密码不能为空');
        user.password = await bcrypt.hash(user.password, 10);
      }
    },
  },
});

OutletUser.prototype.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

OutletUser.prototype.toJSON = function () {
  const values = { ...this.get() };
  delete values.password;
  return values;
};

module.exports = OutletUser;
