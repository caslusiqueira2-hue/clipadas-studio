const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const localBinYtDlp = path.join(__dirname, '..', 'bin', 'yt-dlp');
const defaultLocalYtDlp = path.join(process.env.HOME || '/home/parag', '.local/bin/yt-dlp');

function resolveYtDlpBin() {
  if (process.env.YTDLP_PATH && fs.existsSync(process.env.YTDLP_PATH)) {
    return { bin: process.env.YTDLP_PATH, args: [] };
  }

  if (process.platform === 'win32') {
    const pythonCandidates = [
      path.join(process.env.LOCALAPPDATA || '', 'Python', 'pythoncore-3.12-64', 'Scripts', 'yt-dlp.exe'),
      path.join(process.env.APPDATA || '', 'Python', 'Python312', 'Scripts', 'yt-dlp.exe'),
      path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Programs', 'Python', 'Python312', 'Scripts', 'yt-dlp.exe')
    ];
    for (const cand of pythonCandidates) {
      if (fs.existsSync(cand)) return { bin: cand, args: [] };
    }
    try {
      const whereOut = require('child_process').execSync('where.exe yt-dlp.exe 2>nul').toString().trim().split(/\r?\n/)[0];
      if (whereOut && fs.existsSync(whereOut)) return { bin: whereOut, args: [] };
    } catch (e) {}
    return { bin: 'python', args: ['-m', 'yt_dlp'] };
  }

  if (fs.existsSync(localBinYtDlp)) {
    try { fs.chmodSync(localBinYtDlp, 0o755); } catch (e) {}
    return { bin: localBinYtDlp, args: [] };
  }
  if (fs.existsSync(defaultLocalYtDlp)) {
    return { bin: defaultLocalYtDlp, args: [] };
  }
  try {
    const whichOut = require('child_process').execSync('which yt-dlp 2>/dev/null').toString().trim();
    if (whichOut && fs.existsSync(whichOut)) return { bin: whichOut, args: [] };
  } catch (e) {}
  return { bin: 'yt-dlp', args: [] };
}

let ffmpegStaticPath = '';
try {
  ffmpegStaticPath = require('ffmpeg-static');
} catch (e) {}

/**
 * Downloads a video from URL (YouTube, Vimeo, etc.)
 */
function downloadUrl(url, outputDir, onProgress = null, customCookies = null) {
  return new Promise((resolve, reject) => {
    const fileId = `dl_${Date.now()}`;
    const outputTemplate = path.join(outputDir, `${fileId}.%(ext)s`);

    const isYouTube = /youtu\.?be/i.test(url);
    const cookieFile = path.join(__dirname, '../yt-cookies.txt');
    
    let cookieArgs = ['--no-cookies'];
    let tempCookiePath = null;

    if (customCookies && customCookies.trim()) {
      tempCookiePath = path.join(os.tmpdir(), `yt_cookies_${Date.now()}.txt`);
      try {
        fs.writeFileSync(tempCookiePath, customCookies.trim(), 'utf-8');
        cookieArgs = ['--cookies', tempCookiePath];
      } catch (e) {}
    } else if (process.env.YOUTUBE_COOKIES_BASE64) {
      tempCookiePath = path.join(os.tmpdir(), 'yt_cookies.txt');
      try {
        fs.writeFileSync(tempCookiePath, Buffer.from(process.env.YOUTUBE_COOKIES_BASE64, 'base64').toString('utf-8'));
        cookieArgs = ['--cookies', tempCookiePath];
      } catch (e) {}
    } else if (process.env.YOUTUBE_COOKIES) {
      tempCookiePath = path.join(os.tmpdir(), 'yt_cookies.txt');
      try {
        fs.writeFileSync(tempCookiePath, process.env.YOUTUBE_COOKIES);
        cookieArgs = ['--cookies', tempCookiePath];
      } catch (e) {}
    } else if (fs.existsSync(cookieFile)) {
      cookieArgs = ['--cookies', cookieFile];
    }

    const hasCookies = cookieArgs[0] === '--cookies';
    // Fallback chain for cloud datacenter anti-bot bypass when no cookies are provided
    const extractorArgs = (isYouTube && !hasCookies)
      ? ['--extractor-args', 'youtube:player_client=tv_downgraded,mweb,web_embedded']
      : [];

    const ffmpegArgs = (ffmpegStaticPath && fs.existsSync(ffmpegStaticPath))
      ? ['--ffmpeg-location', ffmpegStaticPath]
      : [];

    const args = [
      '--format', 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best',
      '--merge-output-format', 'mp4',
      ...extractorArgs,
      ...ffmpegArgs,
      '--js-runtimes', 'node',
      '-N', '4',                        // 4 fragments to avoid datacenter burst rate-limiting
      '--buffer-size', '16M',           // 16MB download buffer
      '--http-chunk-size', '10M',       // 10MB chunk size
      '-o', outputTemplate,
      '--no-playlist',
      ...cookieArgs,
      url
    ];

    const ytdlp = resolveYtDlpBin();
    const spawnBin = ytdlp.bin;
    const spawnArgs = [...ytdlp.args, ...args];

    const sep = path.delimiter;
    const extraPaths = [
      path.dirname(localBinYtDlp),
      ffmpegStaticPath ? path.dirname(ffmpegStaticPath) : '',
      process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Python', 'pythoncore-3.12-64', 'Scripts') : ''
    ].filter(Boolean).join(sep);

    const proc = spawn(spawnBin, spawnArgs, {
      env: {
        ...process.env,
        PATH: `${extraPaths}${sep}${process.env.PATH || ''}`
      }
    });

    let stderr = '';
    let stdout = '';

    proc.on('error', err => {
      console.error('yt-dlp execution error:', err);
      reject(new Error(`Failed to run yt-dlp (${spawnBin}): ${err.message}`));
    });

    proc.stdout.on('data', data => {
      const text = data.toString();
      stdout += text;
      const progressMatch = text.match(/(\d{1,3}\.\d)%/);
      if (progressMatch && onProgress) {
        onProgress(parseFloat(progressMatch[1]));
      }
    });

    proc.stderr.on('data', data => {
      stderr += data.toString();
    });

    proc.on('close', code => {
      if (code === 0) {
        // Find the resulting file
        const expectedFile = path.join(outputDir, `${fileId}.mp4`);
        if (fs.existsSync(expectedFile)) {
          resolve({ filePath: expectedFile, fileId });
        } else {
          // Look for any file with prefix
          const files = fs.readdirSync(outputDir).filter(f => f.startsWith(fileId));
          if (files.length > 0) {
            resolve({ filePath: path.join(outputDir, files[0]), fileId });
          } else {
            reject(new Error('Downloaded file not found on disk'));
          }
        }
      } else {
        reject(new Error(`yt-dlp failed (code ${code}): ${stderr || stdout}`));
      }
    });
  });
}

module.exports = {
  downloadUrl,
  resolveYtDlpBin
};

