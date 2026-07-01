const qdrant = require('qdrant-client');
const api = new qdrant.Api({ baseUrl: 'http://localhost:6333' });

console.log('--- root methods ---');
console.log(Object.keys(api));

const namespaces = ['collections', 'points', 'snapshots', 'cluster', 'aliases'];
for (const ns of namespaces) {
  if (api[ns]) {
    console.log(`--- ${ns} methods ---`);
    console.log(Object.keys(api[ns]));
  } else {
    console.log(`--- namespace ${ns} does not exist ---`);
  }
}
