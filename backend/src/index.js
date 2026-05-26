import 'dotenv/config';
import dns from 'node:dns';
import { buildApp } from './app.js';
import { openConnection } from './db.js';

// Working around a Windows quirk where c-ares refuses SRV lookups against
// Atlas. Forcing public resolvers + IPv4-first reliably solves it both
// locally and on hosts that ship with weird default DNS.
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['1.1.1.1', '8.8.8.8']);

const port = Number(process.env.PORT) || 4100;

async function boot() {
  await openConnection(process.env.MONGODB_URI);
  console.log('mongo: ok');
  const app = buildApp();
  app.listen(port, () => console.log(`taskflow: listening on :${port}`));
}

boot().catch((e) => {
  console.error('boot failed:', e.message);
  process.exit(1);
});
