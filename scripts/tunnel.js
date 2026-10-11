const ngrok = require('@expo/ngrok');
(async () => {
  const url = await ngrok.connect({ addr: 8090, proto: 'http', configPath: '/tmp/f1-ngrok.yml', onStatusChange: s => console.log('status', s) });
  console.log('URL', url);
})().catch(e => { console.error('ERR', e); process.exit(1); });
