const prisma = require('../config/prisma');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

exports.listCoupons = catchAsync(async (req, res) => {
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  res.status(200).json({ status: 'success', data: coupons });
});

exports.createCoupon = catchAsync(async (req, res) => {
  const coupon = await prisma.coupon.create({ data: req.body });
  res.status(201).json({ status: 'success', data: coupon });
});

exports.updateCoupon = catchAsync(async (req, res, next) => {
  const exists = await prisma.coupon.findUnique({ where: { id: req.params.id } });
  if (!exists) return next(new AppError('Coupon introuvable.', 404));
  const coupon = await prisma.coupon.update({ where: { id: req.params.id }, data: req.body });
  res.status(200).json({ status: 'success', data: coupon });
});

exports.deleteCoupon = catchAsync(async (req, res, next) => {
  const exists = await prisma.coupon.findUnique({ where: { id: req.params.id } });
  if (!exists) return next(new AppError('Coupon introuvable.', 404));
  await prisma.coupon.delete({ where: { id: req.params.id } });
  res.status(204).json({ status: 'success', data: null });
});

// Vérification publique d'un code promo depuis le panier (avant commande)
exports.checkCoupon = catchAsync(async (req, res, next) => {
  const coupon = await prisma.coupon.findUnique({ where: { code: req.params.code.toUpperCase() } });
  const now = new Date();
  if (
    !coupon || !coupon.isActive ||
    (coupon.startsAt && coupon.startsAt > now) ||
    (coupon.expiresAt && coupon.expiresAt < now) ||
    (coupon.maxUses && coupon.usedCount >= coupon.maxUses)
  ) {
    return next(new AppError('Ce code promo est invalide ou expiré.', 400));
  }
  res.status(200).json({
    status: 'success',
    data: { code: coupon.code, percentOff: coupon.percentOff, amountOff: coupon.amountOff, minOrderTotal: coupon.minOrderTotal },
  });
});
