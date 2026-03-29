const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  nickname: {
    type: DataTypes.STRING(100),
    defaultValue: '',
  },
  openid: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  alipayId: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  avatar: {
    type: DataTypes.STRING(500),
    defaultValue: '',
  },
  phone: {
    type: DataTypes.STRING(20),
    defaultValue: '',
  },
  role: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'student',
  },
  status: {
    type: DataTypes.ENUM('active', 'disabled'),
    defaultValue: 'active',
  },
}, {
  tableName: 'users',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['username'], name: 'username' },
    { unique: true, fields: ['email'], name: 'email' },
    { unique: true, fields: ['openid'], name: 'openid' },
    { unique: true, fields: ['alipayId'], name: 'alipayId' },
  ],
  hooks: {
    beforeCreate: async (user) => {
      if (!user.password || String(user.password).trim().length === 0) {
        throw new Error('密码不能为空');
      }
      user.password = await bcrypt.hash(user.password, 10);
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        if (!user.password || String(user.password).trim().length === 0) {
          throw new Error('密码不能为空');
        }
        user.password = await bcrypt.hash(user.password, 10);
      }
    },
  },
});

User.prototype.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

User.prototype.toJSON = function () {
  const values = { ...this.get() };
  delete values.password;
  return values;
};

module.exports = User;
