const { webcrypto } = require('crypto');

Object.defineProperty(global, 'window', {
  value: {
    crypto: webcrypto
  },
  writable: true
});
