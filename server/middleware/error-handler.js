function errorHandler(err, req, res, _next) {
  console.error(err.stack || err.message || err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error'
  });
}

module.exports = errorHandler;
