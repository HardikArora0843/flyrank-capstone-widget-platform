export const validateBody = (schema) => (req, res, next) => {
  try {
    const parsed = schema.parse(req.body);
    req.body = parsed;
    next();
  } catch (err) {
    if (err.errors) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request payload',
          details: err.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
      });
    }
    next(err);
  }
};

export const validateQuery = (schema) => (req, res, next) => {
  try {
    const parsed = schema.parse(req.query);
    req.query = parsed;
    next();
  } catch (err) {
    if (err.errors) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: err.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
      });
    }
    next(err);
  }
};
