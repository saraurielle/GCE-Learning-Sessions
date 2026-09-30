/**
 * Central error handler. Mounted last in server.js so it catches any
 * error passed via next(err) from any of the three modules' routes.
 */
function errorHandler(err, req, res, next) {
  console.error(err.stack || err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || "Internal server error",
  });
}

module.exports = errorHandler;
