const { z } = require('zod');

const specSchema = z.object({
  label: z.string().min(1).max(60),
  value: z.string().min(1).max(200),
  position: z.number().int().optional(),
});

const variantSchema = z.object({
  color: z.string().min(1).max(40),
  sku: z.string().min(1).max(60),
  stock: z.number().int().min(0).default(0),
  priceDelta: z.number().default(0),
});

const createProductSchema = z.object({
  name: z.string().trim().min(2).max(150),
  brand: z.string().trim().max(80).optional(),
  description: z.string().trim().min(10),
  shortDescription: z.string().trim().max(300).optional(),
  price: z.number().positive(),
  compareAtPrice: z.number().positive().optional(),
  sku: z.string().trim().min(2).max(60),
  categoryId: z.string().uuid().optional(),
  specs: z.array(specSchema).optional(),
  variants: z.array(variantSchema).min(1, 'Au moins une variante (couleur) est requise'),
});

const updateProductSchema = createProductSchema.partial();

const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).optional(),
});

const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

const listProductsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sortBy: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
  search: z.string().optional(),
  category: z.string().optional(),
  minPrice: z.string().optional(),
  maxPrice: z.string().optional(),
});

module.exports = {
  createProductSchema,
  updateProductSchema,
  createCategorySchema,
  createReviewSchema,
  listProductsQuerySchema,
};
