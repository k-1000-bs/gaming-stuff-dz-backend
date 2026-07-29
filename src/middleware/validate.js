/**
 * validate(schema) valide req.body (ou req.query/req.params selon target)
 * et renvoie une erreur 422 lisible en cas d'échec (interceptée par errorHandler).
 */
function validate(schema, target = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      return next(result.error); // traité comme ZodError par errorHandler.js
    }
    req[target] = result.data;
    next();
  };
}

module.exports = validate;
