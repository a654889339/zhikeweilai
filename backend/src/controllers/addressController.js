const { Address } = require('../models');

exports.list = async (req, res) => {
  try {
    const addresses = await Address.findAll({
      where: { userId: req.user.id },
      order: [['isDefault', 'DESC'], ['updatedAt', 'DESC']],
    });
    res.json({ code: 0, data: addresses });
  } catch (err) {
    console.error('[Address] list error:', err.message);
    res.status(500).json({ code: 500, message: '获取地址列表失败' });
  }
};

exports.create = async (req, res) => {
  try {
    const { contactName, contactPhone, country, customCountry, province, city, district, detailAddress, isDefault } = req.body;
    if (!contactName || !contactPhone) {
      return res.status(400).json({ code: 400, message: '联系人和电话不能为空' });
    }
    if (!country) {
      return res.status(400).json({ code: 400, message: '请选择国家/地区' });
    }
    if (!detailAddress) {
      return res.status(400).json({ code: 400, message: '请填写详细地址' });
    }
    if (isDefault) {
      await Address.update({ isDefault: false }, { where: { userId: req.user.id } });
    }
    const address = await Address.create({
      userId: req.user.id,
      contactName: contactName.trim(),
      contactPhone: contactPhone.trim(),
      country: country || '中国大陆',
      customCountry: customCountry?.trim() || '',
      province: province?.trim() || '',
      city: city?.trim() || '',
      district: district?.trim() || '',
      detailAddress: detailAddress.trim(),
      isDefault: !!isDefault,
    });
    res.json({ code: 0, data: address });
  } catch (err) {
    console.error('[Address] create error:', err.message);
    res.status(500).json({ code: 500, message: '创建地址失败' });
  }
};

exports.update = async (req, res) => {
  try {
    const address = await Address.findByPk(req.params.id);
    if (!address) return res.status(404).json({ code: 404, message: '地址不存在' });
    if (address.userId !== req.user.id) return res.status(403).json({ code: 403, message: '无权操作' });

    const { contactName, contactPhone, country, customCountry, province, city, district, detailAddress, isDefault } = req.body;
    if (isDefault && !address.isDefault) {
      await Address.update({ isDefault: false }, { where: { userId: req.user.id } });
    }
    await address.update({
      contactName: contactName?.trim() || address.contactName,
      contactPhone: contactPhone?.trim() || address.contactPhone,
      country: country || address.country,
      customCountry: customCountry !== undefined ? customCountry.trim() : address.customCountry,
      province: province !== undefined ? province.trim() : address.province,
      city: city !== undefined ? city.trim() : address.city,
      district: district !== undefined ? district.trim() : address.district,
      detailAddress: detailAddress?.trim() || address.detailAddress,
      isDefault: isDefault !== undefined ? !!isDefault : address.isDefault,
    });
    res.json({ code: 0, data: address });
  } catch (err) {
    console.error('[Address] update error:', err.message);
    res.status(500).json({ code: 500, message: '更新地址失败' });
  }
};

exports.remove = async (req, res) => {
  try {
    const address = await Address.findByPk(req.params.id);
    if (!address) return res.status(404).json({ code: 404, message: '地址不存在' });
    if (address.userId !== req.user.id) return res.status(403).json({ code: 403, message: '无权操作' });
    await address.destroy();
    res.json({ code: 0, message: '删除成功' });
  } catch (err) {
    console.error('[Address] remove error:', err.message);
    res.status(500).json({ code: 500, message: '删除地址失败' });
  }
};

exports.setDefault = async (req, res) => {
  try {
    const address = await Address.findByPk(req.params.id);
    if (!address) return res.status(404).json({ code: 404, message: '地址不存在' });
    if (address.userId !== req.user.id) return res.status(403).json({ code: 403, message: '无权操作' });
    await Address.update({ isDefault: false }, { where: { userId: req.user.id } });
    address.isDefault = true;
    await address.save();
    res.json({ code: 0, data: address });
  } catch (err) {
    console.error('[Address] setDefault error:', err.message);
    res.status(500).json({ code: 500, message: '设置默认地址失败' });
  }
};
