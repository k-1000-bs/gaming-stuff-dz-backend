const prisma = require('../config/prisma');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { getPagination, buildMeta } = require('../utils/pagination');

// ------------------------------------------------------------------
// GET /api/admin/dashboard — statistiques générales
// ------------------------------------------------------------------
exports.getDashboardStats = catchAsync(async (req, res) => {
  const [userCount, productCount, orderCount, revenueAgg, pendingOrders, lowStock] = await Promise.all([
    prisma.user.count(),
    prisma.product.count({ where: { isActive: true } }),
    prisma.order.count(),
    prisma.order.aggregate({
      _sum: { total: true },
      where: { paymentStatus: 'PAID' },
    }),
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.productVariant.findMany({
      where: { stock: { lt: 5 } },
      include: { product: { select: { name: true } } },
      take: 10,
    }),
  ]);

  const recentOrders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { user: { select: { fullName: true, email: true } } },
  });

  res.status(200).json({
    status: 'success',
    data: {
      userCount,
      productCount,
      orderCount,
      pendingOrders,
      totalRevenue: revenueAgg._sum.total || 0,
      lowStockVariants: lowStock,
      recentOrders,
    },
  });
});

// ------------------------------------------------------------------
// GET /api/admin/users — liste + recherche + pagination (admin uniquement)
// ------------------------------------------------------------------
exports.listUsers = catchAsync(async (req, res) => {
  const { page, limit, skip, take } = getPagination(req.query);
  const where = req.query.search
    ? {
        OR: [
          { fullName: { contains: req.query.search, mode: 'insensitive' } },
          { email: { contains: req.query.search, mode: 'insensitive' } },
        ],
      }
    : {};

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true, fullName: true, email: true, role: true, isActive: true,
        isEmailVerified: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.user.count({ where }),
  ]);

  res.status(200).json({ status: 'success', data: items, meta: buildMeta({ page, limit, total }) });
});

// ------------------------------------------------------------------
// PATCH /api/admin/users/:id/role
// ------------------------------------------------------------------
exports.updateUserRole = catchAsync(async (req, res, next) => {
  const { role } = req.body;
  if (!['ADMIN', 'MODERATOR', 'USER'].includes(role)) {
    return next(new AppError('Rôle invalide.', 400));
  }
  if (req.params.id === req.user.id) {
    return next(new AppError('Vous ne pouvez pas modifier votre propre rôle.', 400));
  }
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { role } });
  res.status(200).json({ status: 'success', data: { id: user.id, role: user.role } });
});

// ------------------------------------------------------------------
// PATCH /api/admin/users/:id/status — activer / désactiver un compte
// ------------------------------------------------------------------
exports.toggleUserStatus = catchAsync(async (req, res, next) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) return next(new AppError('Utilisateur introuvable.', 404));
  if (target.id === req.user.id) {
    return next(new AppError('Vous ne pouvez pas désactiver votre propre compte.', 400));
  }
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { isActive: !target.isActive },
  });
  res.status(200).json({ status: 'success', data: { id: user.id, isActive: user.isActive } });
});
