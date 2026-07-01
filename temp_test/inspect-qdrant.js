try {
  const { Api } = require('qdrant-client');
  console.log('Api prototype keys:', Object.keys(Api.prototype));
} catch (e) {
  console.error('Error:', e);
}
