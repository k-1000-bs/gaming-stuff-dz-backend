// Enveloppe chaque controller async : toute exception est transmise
// automatiquement au middleware d'erreurs global (errorHandler.js)
module.exports = function catchAsync(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
