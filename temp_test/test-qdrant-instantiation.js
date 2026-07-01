try {
  const qdrant = require('qdrant-client');
  console.log('qdrant keys:', Object.keys(qdrant));
  // Let's see if we can instantiate Api
  const api = new qdrant.Api({
    baseUrl: 'http://localhost:6333'
  });
  console.log('Api instance keys:', Object.keys(api));
} catch (e) {
  console.error('Instantiation failed:', e);
}
