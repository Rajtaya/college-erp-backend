const jwt = require('jsonwebtoken');
require('dotenv').config();

module.exports.verify = (requiredRole) => (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (requiredRole && decoded.role !== requiredRole) {
      return res.status(403).json({ error: 'Access forbidden' });
    }
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
