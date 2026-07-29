/**
 * Construit { skip, take, page, limit } à partir de req.query
 */
function getPagination(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 12, 1), 100);
  const skip = (page - 1) * limit;
  return { page, limit, skip, take: limit };
}

function getSort(query, allowedFields, defaultField = 'createdAt') {
  const field = allowedFields.includes(query.sortBy) ? query.sortBy : defaultField;
  const order = query.order === 'asc' ? 'asc' : 'desc';
  return { [field]: order };
}

function buildMeta({ page, limit, total }) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  };
}

module.exports = { getPagination, getSort, buildMeta };
