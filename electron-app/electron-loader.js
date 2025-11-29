const path = require('path');
require('ts-node').register({
  project: path.join(__dirname, 'tsconfig.main.json'),
  transpileOnly: true
});
require('./src/main/main.ts');

