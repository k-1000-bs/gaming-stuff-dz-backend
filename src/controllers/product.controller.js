const slugify = require('slugify');
const prisma = require('../config/prisma');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { getPagination, getSort, buildMeta } = require('../utils/pagination');

const SORTABLE_FIELDS = ['price', 'createdAt', 'name'];

// ------------------------------------------------------------------
// GET /api/products  (public) — recherche + filtres + tri + pagination
// ------------------------------------------------------------------
exports.listProducts = catchAsync(async (req, res) => {
  const { page, limit, skip, take } = getPagination(req.query);
  const orderBy = getSort(req.query, SORTABLE_FIELDS);

  const where = { isActive: true };

  if (req.query.search) {
    where.OR = [
      { name: { contains: req.query.search, mode: 'insensitive' } },
      { brand: { contains: req.query.search, mode: 'insensitive' } },
      { description: { contains: req.query.search, mode: 'insensitive' } },
    ];
  }
  if (req.query.category) {
    where.category = { slug: req.query.category };
  }
  if (req.query.minPrice || req.query.maxPrice) {
    where.price = {};
    if (req.query.minPrice) where.price.gte = parseFloat(req.query.minPrice);
    if (req.query.maxPrice) where.price.lte = parseFloat(req.query.maxPrice);
  }

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      skip,
      take,
      include: { images: true, variants: true, category: true },
    }),
    prisma.product.count({ where }),
  ]);

  res.status(200).json({
    status: 'success',
    data: items,
    meta: buildMeta({ page, limit, total }),
  });
});

// ------------------------------------------------------------------
// GET /api/products/:slug (public)
// ------------------------------------------------------------------
exports.getProduct = catchAsync(async (req, res, next) => {
  const product = await prisma.product.findUnique({
    where: { slug: req.params.slug },
    include: {
      images: true,
      variants: true,
      specs: { orderBy: { position: 'asc' } },
      category: true,
      reviews: {
        where: { isApproved: true },
        include: { user: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!product || !product.isActive) {
    return next(new AppError('Produit introuvable.', 404));
  }
  res.status(200).json({ status: 'success', data: product });
});

// ------------------------------------------------------------------
// POST /api/products (admin/modérateur)
// ------------------------------------------------------------------
exports.createProduct = catchAsync(async (req, res) => {
  const { specs = [], variants, ...rest } = req.body;
  const slug = slugify(`${rest.name}-${Date.now()}`, { lower: true, strict: true });

  const product = await prisma.product.create({
    data: {
      ...rest,
      slug,
      specs: { create: specs },
      variants: { create: variants },
    },
    include: { specs: true, variants: true },
  });

  res.status(201).json({ status: 'success', data: product });
});

// ------------------------------------------------------------------
// PATCH /api/products/:id (admin/modérateur)
// ------------------------------------------------------------------
exports.updateProduct = catchAsync(async (req, res, next) => {
  const { specs, variants, ...rest } = req.body;
  const exists = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!exists) return next(new AppError('Produit introuvable.', 404));

  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: rest,
  });

  res.status(200).json({ status: 'success', data: product });
});

// ------------------------------------------------------------------
// DELETE /api/products/:id (admin)
// ------------------------------------------------------------------
exports.deleteProduct = catchAsync(async (req, res, next) => {
  const exists = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!exists) return next(new AppError('Produit introuvable.', 404));

  // Désactivation plutôt que suppression physique (préserve l'historique des commandes)
  await prisma.product.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.status(204).json({ status: 'success', data: null });
});

// ------------------------------------------------------------------
// POST /api/products/:id/images (admin/modérateur) — après middleware upload
// ------------------------------------------------------------------
exports.addProductImages = catchAsync(async (req, res, next) => {
  if (!req.uploadedFiles?.length) {
    return next(new AppError('Aucun fichier reçu.', 400));
  }
  const images = await prisma.$transaction(
    req.uploadedFiles.map((f, i) =>
      prisma.productImage.create({
        data: { productId: req.params.id, url: f.url, position: i },
      })
    )
  );
  res.status(201).json({ status: 'success', data: images });
});

// ------------------------------------------------------------------
// POST /api/products/:id/reviews (utilisateur connecté)
// ------------------------------------------------------------------
exports.addReview = catchAsync(async (req, res, next) => {
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!product) return next(new AppError('Produit introuvable.', 404));

  const review = await prisma.review.create({
    data: { ...req.body, productId: product.id, userId: req.user.id },
  });
  res.status(201).json({
    status: 'success',
    message: 'Avis soumis, en attente de modération.',
    data: review,
  });
});
