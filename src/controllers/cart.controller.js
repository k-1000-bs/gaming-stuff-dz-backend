const prisma = require('../config/prisma');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

async function getOrCreateCart(userId) {
  let cart = await prisma.cart.findUnique({
    where: { userId },
    include: { items: { include: { product: true, variant: true } } },
  });
  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId },
      include: { items: { include: { product: true, variant: true } } },
    });
  }
  return cart;
}

exports.getCart = catchAsync(async (req, res) => {
  const cart = await getOrCreateCart(req.user.id);
  res.status(200).json({ status: 'success', data: cart });
});

exports.addItem = catchAsync(async (req, res, next) => {
  const { productId, variantId, quantity } = req.body;

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || !product.isActive) return next(new AppError('Produit introuvable.', 404));

  if (variantId) {
    const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant || variant.productId !== productId) {
      return next(new AppError('Variante invalide pour ce produit.', 400));
    }
    if (variant.stock < quantity) {
      return next(new AppError(`Stock insuffisant (${variant.stock} disponible(s)).`, 409));
    }
  }

  const cart = await getOrCreateCart(req.user.id);

  const existing = await prisma.cartItem.findUnique({
    where: {
      cartId_productId_variantId: {
        cartId: cart.id,
        productId,
        variantId: variantId || null,
      },
    },
  }).catch(() => null);

  if (existing) {
    await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + quantity },
    });
  } else {
    await prisma.cartItem.create({
      data: { cartId: cart.id, productId, variantId, quantity },
    });
  }

  const updated = await getOrCreateCart(req.user.id);
  res.status(200).json({ status: 'success', data: updated });
});

exports.updateItem = catchAsync(async (req, res, next) => {
  const item = await prisma.cartItem.findUnique({ where: { id: req.params.itemId } });
  const cart = await prisma.cart.findUnique({ where: { userId: req.user.id } });
  if (!item || item.cartId !== cart?.id) return next(new AppError('Article introuvable dans le panier.', 404));

  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity: req.body.quantity } });
  const updated = await getOrCreateCart(req.user.id);
  res.status(200).json({ status: 'success', data: updated });
});

exports.removeItem = catchAsync(async (req, res, next) => {
  const item = await prisma.cartItem.findUnique({ where: { id: req.params.itemId } });
  const cart = await prisma.cart.findUnique({ where: { userId: req.user.id } });
  if (!item || item.cartId !== cart?.id) return next(new AppError('Article introuvable dans le panier.', 404));

  await prisma.cartItem.delete({ where: { id: item.id } });
  const updated = await getOrCreateCart(req.user.id);
  res.status(200).json({ status: 'success', data: updated });
});

exports.clearCart = catchAsync(async (req, res) => {
  const cart = await prisma.cart.findUnique({ where: { userId: req.user.id } });
  if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  res.status(204).json({ status: 'success', data: null });
});
