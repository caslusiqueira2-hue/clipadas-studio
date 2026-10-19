const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const cloudflaredBin = path.join(__dirname, '..', 'bin', 'cloudflared.exe');

let qrcode = null;
try {
  qrcode = require('qrcode-terminal');
} catch (e) {}

// Check if local server is already running
function isServerRunning(port = 5000) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/status`, (res) => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1200, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function start() {
  console.log('\x1b[36m%s\x1b[0m', '============================================================');
  console.log('\x1b[1m\x1b[35m%s\x1b[0m', '   🚀 CLIPADAS STUDIO — MODO NUVEM & CELULAR (OPÇÃO 1)');
  console.log('\x1b[36m%s\x1b[0m', '============================================================');

  let serverProc = null;
  const running = await isServerRunning(5000);
  if (!running) {
    console.log('\x1b[33m%s\x1b[0m', '⏳ Iniciando servidor backend do Clipadas (porta 5000)...');
    serverProc = spawn('node', [path.join(__dirname, 'server.js')], {
      stdio: 'inherit',
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });
    await new Promise(r => setTimeout(r, 2000));
  } else {
    console.log('\x1b[32m%s\x1b[0m', '✅ Servidor backend já está em execução na porta 5000.');
  }

  if (!fs.existsSync(cloudflaredBin)) {
    console.error(`\x1b[31m[ERRO] Binário cloudflared não encontrado em: ${cloudflaredBin}\x1b[0m`);
    process.exit(1);
  }

  console.log('\x1b[34m%s\x1b[0m', '🌐 Criando túnel seguro HTTPS via Cloudflare...');

  const tunnelProc = spawn(cloudflaredBin, ['tunnel', '--url', 'http://localhost:5000'], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let tunnelUrl = null;
  const regex = /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/;

  const onOutput = (chunk) => {
    const text = chunk.toString();
    const match = text.match(regex);
    if (match && !tunnelUrl) {
      tunnelUrl = match[0];
      fs.writeFileSync(path.join(__dirname, 'tunnel_url.txt'), tunnelUrl, 'utf8');
      fs.writeFileSync(path.join(__dirname, 'tunnel_info.json'), JSON.stringify({
        url: tunnelUrl,
        createdAt: new Date().toISOString()
      }, null, 2), 'utf8');

      console.log('\n\x1b[32m%s\x1b[0m', '============================================================');
      console.log('\x1b[1m\x1b[32m%s\x1b[0m', '   🎉 TÚNEL ATIVO COM SUCESSO!');
      console.log('\x1b[32m%s\x1b[0m', '============================================================');
      console.log('\x1b[1m\x1b[37mBackend Público (HTTPS):\x1b[0m \x1b[36m' + tunnelUrl + '\x1b[0m');
      console.log('\n\x1b[1m\x1b[33m📲 COMO CONECTAR NO SEU CELULAR:\x1b[0m');
      console.log('1. Se você já fez deploy do frontend na Vercel (ex: \x1b[35mhttps://clipadas.vercel.app\x1b[0m),');
      console.log('   acesse no navegador do celular:');
      console.log(`   👉 \x1b[1m\x1b[36mhttps://SEU-APP.vercel.app/?backend=${tunnelUrl}\x1b[0m`);
      console.log('\n2. Ou teste abrindo o link do túnel diretamente:');
      console.log(`   👉 \x1b[36m${tunnelUrl}/api/status\x1b[0m`);

      if (qrcode) {
        console.log('\n\x1b[1m\x1b[37m📷 Ou aponte a câmera do celular para este QR Code:\x1b[0m');
        qrcode.generate(tunnelUrl, { small: true });
      }
      console.log('\x1b[32m%s\x1b[0m', '============================================================\n');
    }
  };

  tunnelProc.stdout.on('data', onOutput);
  tunnelProc.stderr.on('data', onOutput);

  tunnelProc.on('close', (code) => {
    console.log(`Cloudflared finalizou com código ${code}`);
    if (serverProc) serverProc.kill();
    process.exit(code || 0);
  });

  const cleanExit = () => {
    console.log('\nEncerrando túnel e serviços...');
    try { tunnelProc.kill(); } catch (e) {}
    try { if (serverProc) serverProc.kill(); } catch (e) {}
    process.exit(0);
  };

  process.on('SIGINT', cleanExit);
  process.on('SIGTERM', cleanExit);
}

start().catch(err => {
  console.error('Erro ao iniciar túnel:', err);
});
