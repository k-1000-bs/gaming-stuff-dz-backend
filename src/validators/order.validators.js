const { z } = require('zod');

const addToCartSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  quantity: z.number().int().min(1).max(20).default(1),
});

const updateCartItemSchema = z.object({
  quantity: z.number().int().min(1).max(20),
});

const addressSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(8).max(20),
  wilaya: z.string().trim().min(2).max(60),
  commune: z.string().trim().min(2).max(80),
  addressLine: z.string().trim().min(3).max(200),
  isDefault: z.boolean().optional(),
});

const createOrderSchema = z.object({
  addressId: z.string().uuid().optional(),
  address: addressSchema.optional(),
  paymentMethod: z.enum(['COD', 'CARD']).default('COD'),
  couponCode: z.string().trim().optional(),
  notes: z.string().trim().max(500).optional(),
}).refine((data) => data.addressId || data.address, {
  message: 'Une adresse de livraison est requise',
  path: ['address'],
});

const updateOrderStatusSchema = z.object({
  status: z.enum([
    'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED',
  ]),
});

const createCouponSchema = z.object({
  code: z.string().trim().toUpperCase().min(3).max(30),
  description: z.string().trim().max(200).optional(),
  percentOff: z.number().int().min(1).max(100).optional(),
  amountOff: z.number().positive().optional(),
  minOrderTotal: z.number().positive().optional(),
  maxUses: z.number().int().positive().optional(),
  startsAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
}).refine((d) => d.percentOff || d.amountOff, {
  message: 'Indiquez percentOff ou amountOff',
});

module.exports = {
  addToCartSchema,
  updateCartItemSchema,
  addressSchema,
  createOrderSchema,
  updateOrderStatusSchema,
  createCouponSchema,
};
