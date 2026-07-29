const crypto = require('crypto');
const prisma = require('../config/prisma');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { getPagination, buildMeta } = require('../utils/pagination');
const { sendOrderConfirmationEmail } = require('../utils/email');

function generateOrderNumber() {
  const date = new Date();
  const y = date.getFullYear().toString().slice(-2);
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `GSDZ-${y}${m}-${rand}`;
}

async function applyCoupon(code, subtotal) {
  if (!code) return { discount: 0, coupon: null };

  const coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
  const now = new Date();

  if (
    !coupon ||
    !coupon.isActive ||
    (coupon.startsAt && coupon.startsAt > now) ||
    (coupon.expiresAt && coupon.expiresAt < now) ||
    (coupon.maxUses && coupon.usedCount >= coupon.maxUses) ||
    (coupon.minOrderTotal && subtotal < Number(coupon.minOrderTotal))
  ) {
    throw new AppError('Ce code promo est invalide ou expiré.', 400);
  }

  const discount = coupon.percentOff
    ? (subtotal * coupon.percentOff) / 100
    : Number(coupon.amountOff || 0);

  return { discount: Math.min(discount, subtotal), coupon };
}

// ------------------------------------------------------------------
// POST /api/orders — création à partir du panier de l'utilisateur
// ------------------------------------------------------------------
exports.createOrder = catchAsync(async (req, res, next) => {
  const { addressId, address, paymentMethod, couponCode, notes } = req.body;

  const cart = await prisma.cart.findUnique({
    where: { userId: req.user.id },
    include: { items: { include: { product: true, variant: true } } },
  });

  if (!cart || cart.items.length === 0) {
    return next(new AppError('Votre panier est vide.', 400));
  }

  // Vérification du stock avant toute écriture
  for (const item of cart.items) {
    if (item.variant && item.variant.stock < item.quantity) {
      return next(new AppError(`Stock insuffisant pour "${item.product.name}".`, 409));
    }
  }

  const subtotal = cart.items.reduce((sum, item) => {
    const unit = Number(item.product.price) + Number(item.variant?.priceDelta || 0);
    return sum + unit * item.quantity;
  }, 0);

  const { discount, coupon } = await applyCoupon(couponCode, subtotal);
  const shippingFee = 0; // à adapter selon la logique de livraison (ex: par wilaya)
  const total = subtotal - discount + shippingFee;

  const order = await prisma.$transaction(async (tx) => {
    let finalAddressId = addressId;
    if (!finalAddressId && address) {
      const created = await tx.address.create({ data: { ...address, userId: req.user.id } });
      finalAddressId = created.id;
    }

    const newOrder = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId: req.user.id,
        addressId: finalAddressId,
        subtotal,
        discount,
        shippingFee,
        total,
        paymentMethod,
        couponId: coupon?.id,
        notes,
        items: {
          create: cart.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice: Number(item.product.price) + Number(item.variant?.priceDelta || 0),
          })),
        },
        invoice: {
          create: { invoiceNumber: `INV-${Date.now()}` },
        },
        shipment: { create: {} },
      },
      include: { items: true, invoice: true, shipment: true },
    });

    // Décrément du stock par variante
    for (const item of cart.items) {
      if (item.variantId) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { decrement: item.quantity } },
        });
      }
    }

    if (coupon) {
      await tx.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } });
    }

    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

    await tx.notification.create({
      data: {
        userId: req.user.id,
        type: 'ORDER_STATUS',
        title: 'Commande confirmée',
        message: `Votre commande #${newOrder.orderNumber} a bien été enregistrée.`,
      },
    });

    return newOrder;
  });

  sendOrderConfirmationEmail(req.user, order); // asynchrone, ne bloque pas la réponse

  res.status(201).json({ status: 'success', data: order });
});

// ------------------------------------------------------------------
// GET /api/orders — historique des commandes de l'utilisateur connecté
// ------------------------------------------------------------------
exports.getMyOrders = catchAsync(async (req, res) => {
  const { page, limit, skip, take } = getPagination(req.query);

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where: { userId: req.user.id },
      include: { items: { include: { product: true } }, invoice: true, shipment: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.order.count({ where: { userId: req.user.id } }),
  ]);

  res.status(200).json({ status: 'success', data: items, meta: buildMeta({ page, limit, total }) });
});

// ------------------------------------------------------------------
// GET /api/orders/:id
// ------------------------------------------------------------------
exports.getOrder = catchAsync(async (req, res, next) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: { include: { product: true, variant: true } }, invoice: true, shipment: true, address: true },
  });
  if (!order) return next(new AppError('Commande introuvable.', 404));
  if (order.userId !== req.user.id && !['ADMIN', 'MODERATOR'].includes(req.user.role)) {
    return next(new AppError("Vous n'avez pas accès à cette commande.", 403));
  }
  res.status(200).json({ status: 'success', data: order });
});

// ------------------------------------------------------------------
// GET /api/admin/orders — toutes les commandes (admin/modérateur)
// ------------------------------------------------------------------
exports.listAllOrders = catchAsync(async (req, res) => {
  const { page, limit, skip, take } = getPagination(req.query);
  const where = req.query.status ? { status: req.query.status } : {};

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { user: { select: { fullName: true, email: true } }, items: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.order.count({ where }),
  ]);

  res.status(200).json({ status: 'success', data: items, meta: buildMeta({ page, limit, total }) });
});

// ------------------------------------------------------------------
// PATCH /api/admin/orders/:id/status
// ------------------------------------------------------------------
exports.updateOrderStatus = catchAsync(async (req, res, next) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return next(new AppError('Commande introuvable.', 404));

  const updated = await prisma.order.update({
    where: { id: req.params.id },
    data: { status: req.body.status },
  });

  await prisma.notification.create({
    data: {
      userId: order.userId,
      type: 'ORDER_STATUS',
      title: 'Mise à jour de votre commande',
      message: `Votre commande #${order.orderNumber} est maintenant : ${req.body.status}.`,
    },
  });

  res.status(200).json({ status: 'success', data: updated });
});
