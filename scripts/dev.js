/**
 * Dev Runner for MeyKural
 * Finds free ports, detects local Wi-Fi / LAN IP,
 * prints connection URLs, and concurrently runs Express backend and Vite client.
 */
const os = require('os');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');

function getLanIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

function checkPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, '0.0.0.0');
  });
}

async function findAvailablePort(startPort, maxAttempts = 20) {
  for (let port = startPort; port < startPort + maxAttempts; port++) {
    if (await checkPortFree(port)) {
      return port;
    }
  }
  throw new Error(`Could not find an available port starting from ${startPort}`);
}

async function startDev() {
  const lanIp = getLanIp();
  const serverPort = await findAvailablePort(3001);
  const clientPort = await findAvailablePort(5173);

  console.log('\n================================================================');
  console.log('🌿 MEYKURAL: TAMIL HACKATHON 2026 (PROBLEM P15)');
  console.log('AI Hallucination Shield for Classical Literature');
  console.log('================================================================');
  console.log(`📱 Client App (Local):    http://localhost:${clientPort}`);
  console.log(`📡 Mobile / LAN (Wi-Fi):  http://${lanIp}:${clientPort}`);
  console.log(`⚙️ Backend Server:        http://localhost:${serverPort}`);
  console.log('----------------------------------------------------------------');
  console.log('💡 Tip: Open the Mobile/Wi-Fi link on your phone to test the PWA');
  console.log('   with offline caching, touch gestures, and full Tamil support!');
  console.log('================================================================\n');

  // Launch Server
  const serverProcess = spawn('node', ['server/index.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(serverPort) },
    stdio: 'inherit',
    shell: true
  });

  // Launch Vite Client
  const clientProcess = spawn(
    'npm',
    ['--prefix', 'client', 'run', 'dev', '--', '--host', '0.0.0.0', '--port', String(clientPort)],
    {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        VITE_SERVER_URL: `http://localhost:${serverPort}`,
        VITE_LAN_URL: `http://${lanIp}:${serverPort}`
      },
      stdio: 'inherit',
      shell: true
    }
  );

  const cleanup = () => {
    console.log('\n🛑 Shutting down MeyKural dev processes...');
    try { serverProcess.kill(); } catch (e) {}
    try { clientProcess.kill(); } catch (e) {}
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

startDev().catch((err) => {
  console.error('Fatal dev error:', err);
  process.exit(1);
});
