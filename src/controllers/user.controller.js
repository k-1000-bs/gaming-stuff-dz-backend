const prisma = require('../config/prisma');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

exports.listAddresses = catchAsync(async (req, res) => {
  const addresses = await prisma.address.findMany({
    where: { userId: req.user.id },
    orderBy: { isDefault: 'desc' },
  });
  res.status(200).json({ status: 'success', data: addresses });
});

exports.addAddress = catchAsync(async (req, res) => {
  if (req.body.isDefault) {
    await prisma.address.updateMany({ where: { userId: req.user.id }, data: { isDefault: false } });
  }
  const address = await prisma.address.create({ data: { ...req.body, userId: req.user.id } });
  res.status(201).json({ status: 'success', data: address });
});

exports.deleteAddress = catchAsync(async (req, res, next) => {
  const address = await prisma.address.findUnique({ where: { id: req.params.id } });
  if (!address || address.userId !== req.user.id) {
    return next(new AppError('Adresse introuvable.', 404));
  }
  await prisma.address.delete({ where: { id: req.params.id } });
  res.status(204).json({ status: 'success', data: null });
});

exports.listNotifications = catchAsync(async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.status(200).json({ status: 'success', data: notifications });
});

exports.markNotificationRead = catchAsync(async (req, res, next) => {
  const notif = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!notif || notif.userId !== req.user.id) return next(new AppError('Notification introuvable.', 404));
  const updated = await prisma.notification.update({ where: { id: notif.id }, data: { isRead: true } });
  res.status(200).json({ status: 'success', data: updated });
});
