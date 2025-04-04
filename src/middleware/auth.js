const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  // Check for token in multiple places
  const authHeader = req.header('Authorization');
  const tokenFromHeader = authHeader ? authHeader.replace('Bearer ', '') : null;
  const tokenFromCookie = req.cookies?.token;
  
  const token = tokenFromHeader || tokenFromCookie;
  
  if (!token) {
    return res.status(401).json({ 
      status: 'error',
      message: 'Acceso denegado: autenticación requerida' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check token expiration with a buffer period
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp - now < 300) { // less than 5 minutes left
      // Create new token with extended expiry
      const newToken = jwt.sign(
        { userId: decoded.userId, email: decoded.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
      );
      
      // Set new token in response
      res.cookie('token', newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 1 day
      });
      
      if (tokenFromHeader) {
        res.setHeader('New-Authorization', `Bearer ${newToken}`);
      }
    }
    
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        status: 'error',
        message: 'Sesión expirada, inicie sesión nuevamente' 
      });
    }
    
    return res.status(401).json({ 
      status: 'error',
      message: 'Token inválido o manipulado' 
    });
  }
};

module.exports = auth;