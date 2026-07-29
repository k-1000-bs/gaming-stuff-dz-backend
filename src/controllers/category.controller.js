const slugify = require('slugify');
const prisma = require('../config/prisma');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

exports.listCategories = catchAsync(async (req, res) => {
  const categories = await prisma.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { name: 'asc' },
  });
  res.status(200).json({ status: 'success', data: categories });
});

exports.createCategory = catchAsync(async (req, res) => {
  const slug = slugify(req.body.name, { lower: true, strict: true });
  const category = await prisma.category.create({ data: { ...req.body, slug } });
  res.status(201).json({ status: 'success', data: category });
});

exports.updateCategory = catchAsync(async (req, res, next) => {
  const exists = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!exists) return next(new AppError('Catégorie introuvable.', 404));
  const category = await prisma.category.update({ where: { id: req.params.id }, data: req.body });
  res.status(200).json({ status: 'success', data: category });
});

exports.deleteCategory = catchAsync(async (req, res, next) => {
  const exists = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!exists) return next(new AppError('Catégorie introuvable.', 404));
  await prisma.category.delete({ where: { id: req.params.id } });
  res.status(204).json({ status: 'success', data: null });
});
