const crypto = require('crypto');

// Generate a secure random string of specified length
function generateSecureToken(length = 64) {
  return crypto.randomBytes(length).toString('hex');
}

// Generate tokens for different purposes
const jwtSecret = generateSecureToken(32);
const cookieSecret = generateSecureToken(32);
const sessionSecret = generateSecureToken(32);
const sessionCryptoSecret = generateSecureToken(32);

console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`COOKIE_SECRET=${cookieSecret}`);
console.log(`SESSION_SECRET=${sessionSecret}`);
console.log(`SESSION_CRYPTO_SECRET=${sessionCryptoSecret}`);