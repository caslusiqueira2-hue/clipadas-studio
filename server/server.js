const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Auto-detect GitHub Student Plan token from local gh CLI
let autoGithubToken = '';
try {
  const { execSync } = require('child_process');
  autoGithubToken = execSync('gh auth token', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  if (autoGithubToken) {
    process.env.GITHUB_TOKEN = process.env.GITHUB_TOKEN || autoGithubToken;
    console.log('✨ Automatically detected GitHub Student Plan authentication from gh CLI!');
  }
} catch (e) {}

const {
  probeVideo,
  normalizeWebVideo,
  generateClipPreview,
  trackSubject,
  extractAudio,
  generateThumbnail,
  renderShortClip,
  FFMPEG_BIN,
  FFPROBE_BIN
} = require('./services/ffmpegService');
const { transcribeAudio } = require('./services/transcribeService');
const { discoverViralClips, findBestTeaserHook } = require('./services/viralityService');
const { generateAssSubtitles } = require('./services/subtitleService');
const { downloadUrl, resolveYtDlpBin } = require('./services/downloaderService');
const { calculateJumpCuts } = require('./services/jumpCutService');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const UPLOAD_DIR = path.join(__dirname, 'uploads');
const PREVIEW_DIR = path.join(UPLOAD_DIR, 'previews');
const EXPORT_DIR = path.join(__dirname, 'exports');
const SAMPLES_DIR = path.join(__dirname, 'samples');
const SFX_DIR = path.join(__dirname, 'assets', 'sfx');

[UPLOAD_DIR, PREVIEW_DIR, EXPORT_DIR, SAMPLES_DIR, SFX_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Configure Multer storage for high-capacity video uploads (up to 4GB)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    const ext = path.extname(file.originalname) || '.mp4';
    cb(null, `upload_${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 * 1024 } // 4GB max
});

// Serve static exports, samples & streamer SFX
app.use('/exports', express.static(EXPORT_DIR));
app.use('/samples', express.static(SAMPLES_DIR));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use('/sfx', express.static(SFX_DIR));

/**
 * Fast Dedicated Clip Preview Endpoint
 * Generates and streams lightweight, browser-optimized, frame-accurate clip MP4s in ~0.1s
 * Eliminates 2GB streaming lag and browser decoding errors
 */
app.get('/api/clip-preview', async (req, res) => {
  const filePath = req.query.filePath || req.query.path;
  const startTime = Math.max(0, parseFloat(req.query.startTime || req.query.start || 0));
  const duration = Math.max(0.5, parseFloat(req.query.duration || 30));

  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Video file not found' });
  }

  try {
    const crypto = require('crypto');
    const hash = crypto.createHash('md5')
      .update(`${filePath}_${startTime.toFixed(2)}_${duration.toFixed(2)}`)
      .digest('hex').slice(0, 14);
    const previewPath = path.join(PREVIEW_DIR, `preview_${hash}.mp4`);

    await generateClipPreview(filePath, startTime, duration, previewPath);

    const stat = fs.statSync(previewPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(previewPath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      });
      file.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Accept-Ranges': 'bytes',
        'Content-Type': 'video/mp4',
      });
      fs.createReadStream(previewPath).pipe(res);
    }
  } catch (err) {
    console.error('Clip preview error:', err);
    res.status(500).json({ error: `Clip preview generation failed: ${err.message}` });
  }
});

/**
 * HTTP 206 Partial Content Video Streaming Endpoint
 * Enables smooth HTML5 video scrubbing and prevents browser playback errors on large files
 */
app.get('/api/stream', (req, res) => {
  const filePath = req.query.path;
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).send('Video file not found');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Accept-Ranges': 'bytes',
      'Content-Type': 'video/mp4',
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
});

/**
 * Health & Capabilities Check
 */
app.get('/api/status', (req, res) => {
  const ghTok = process.env.GITHUB_TOKEN || autoGithubToken || '';
  let ytdlpResolved = 'unknown';
  try {
    const resolved = resolveYtDlpBin ? resolveYtDlpBin() : 'not-imported';
    ytdlpResolved = typeof resolved === 'object' ? `${resolved.bin} ${resolved.args.join(' ')}`.trim() : String(resolved);
  } catch (e) {
    ytdlpResolved = e.message;
  }

  let pythonCv2Status = 'unknown';
  try {
    const pythonCmd = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
    const py = require('child_process').execSync(`"${pythonCmd}" -c "import cv2; print(cv2.__version__)"`).toString().trim();
    pythonCv2Status = `cv2 ${py}`;
  } catch (e) {
    pythonCv2Status = `error: ${e.message}`;
  }

  res.json({
    status: 'ok',
    version: '1.0.1',
    platform: 'Clipadas Studio',
    pricing: '100% Gratuito & Código Aberto',
    hasGroqKey: Boolean(process.env.GROQ_API_KEY),
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    hasGithubToken: Boolean(ghTok),
    githubToken: ghTok,
    ffmpegReady: true,
    ffmpegBin: FFMPEG_BIN,
    ffprobeBin: FFPROBE_BIN,
    ytdlpReady: Boolean(ytdlpResolved),
    ytdlpPath: ytdlpResolved,
    pythonCv2Status
  });
});

/**
 * Live Key Verification Endpoint for Groq & Google Gemini
 */
app.get('/api/test-keys', async (req, res) => {
  const results = {
    groq: { configured: Boolean(process.env.GROQ_API_KEY) },
    gemini: { configured: Boolean(process.env.GEMINI_API_KEY) }
  };

  if (process.env.GROQ_API_KEY) {
    try {
      const resp = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` }
      });
      results.groq.valid = resp.ok;
      results.groq.status = resp.status;
      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        results.groq.error = errJson.error?.message || `HTTP ${resp.status}`;
      }
    } catch (e) {
      results.groq.valid = false;
      results.groq.error = e.message;
    }
  }

  if (process.env.GEMINI_API_KEY) {
    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
      results.gemini.valid = resp.ok;
      results.gemini.status = resp.status;
      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        results.gemini.error = errJson.error?.message || `HTTP ${resp.status}`;
      }
    } catch (e) {
      results.gemini.valid = false;
      results.gemini.error = e.message;
    }
  }

  const ytCookiesRaw = process.env.YOUTUBE_COOKIES || (process.env.YOUTUBE_COOKIES_BASE64 ? Buffer.from(process.env.YOUTUBE_COOKIES_BASE64, 'base64').toString('utf-8') : '');
  const ytCookieFile = path.join(__dirname, 'yt-cookies.txt');
  const hasLocalFile = fs.existsSync(ytCookieFile);
  const os = require('os');

  results.youtube = {
    configured: Boolean(ytCookiesRaw || hasLocalFile),
    cookieSize: ytCookiesRaw ? ytCookiesRaw.length : (hasLocalFile ? fs.statSync(ytCookieFile).size : 0),
    format: ytCookiesRaw.includes('\t') ? 'Netscape (Valid)' : (ytCookiesRaw ? 'Raw String' : 'None')
  };

  if (results.youtube.configured) {
    try {
      const { spawnSync } = require('child_process');
      const tempCookie = path.join(os.tmpdir(), `test_yt_${Date.now()}.txt`);
      if (ytCookiesRaw) {
        fs.writeFileSync(tempCookie, ytCookiesRaw, 'utf-8');
      }
      const cookieArg = ytCookiesRaw ? ['--cookies', tempCookie] : ['--cookies', ytCookieFile];
      const ytdlpInfo = resolveYtDlpBin();
      const testProc = spawnSync(ytdlpInfo.bin, [
        ...ytdlpInfo.args,
        ...cookieArg,
        '--dump-single-json',
        '--no-playlist',
        '--skip-download',
        'https://www.youtube.com/watch?v=jNQXAC9IVRw'
      ], { encoding: 'utf-8', timeout: 15000 });

      try { if (fs.existsSync(tempCookie)) fs.unlinkSync(tempCookie); } catch (e) {}

      if (testProc.status === 0 && testProc.stdout) {
        const parsed = JSON.parse(testProc.stdout);
        results.youtube.valid = true;
        results.youtube.testVideo = parsed.title;
        results.youtube.status = 200;
      } else {
        results.youtube.valid = false;
        results.youtube.error = (testProc.stderr || testProc.stdout || 'Probing failed').slice(0, 160);
      }
    } catch (ytErr) {
      results.youtube.valid = false;
      results.youtube.error = ytErr.message;
    }
  }

  res.json(results);
});

/**
 * Get Built-in Sample Videos for instant testing
 */
app.get('/api/samples', (req, res) => {
  const sampleMp4 = path.join(SAMPLES_DIR, 'sample_podcast.mp4');
  const sampleVtt = path.join(SAMPLES_DIR, 'sample_podcast.vtt');
  const samples = [];

  if (fs.existsSync(sampleMp4)) {
    samples.push({
      id: 'sample_podcast_ai',
      title: 'AI Leverage & The Future of Work (Podcast)',
      duration: 30.3,
      videoUrl: '/samples/sample_podcast.mp4',
      filePath: sampleMp4,
      vttPath: fs.existsSync(sampleVtt) ? sampleVtt : null,
      thumbnail: null,
      description: 'Studio demo podcast discussion on automation and asymmetric leverage.'
    });
  }

  const hydeParkMp4 = path.join(UPLOAD_DIR, 'upload_1789150429519_y64pxm.mp4');
  if (fs.existsSync(hydeParkMp4)) {
    samples.push({
      id: 'sample_hyde_park_debate',
      title: 'Debate & Street Interview (Hyde Park)',
      duration: 38.0,
      videoUrl: `/api/stream?path=${encodeURIComponent(hydeParkMp4)}`,
      filePath: hydeParkMp4,
      vttPath: null,
      thumbnail: null,
      description: 'Street debate at Speakers Corner. Demonstrates dual-speaker split-screen framing & 30-40s clips.'
    });
  }

  res.json({ samples });
});

/**
 * Upload Video Endpoint with robust Multer error catching
 */
app.post('/api/upload', (req, res) => {
  upload.single('video')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          error: 'The uploaded file exceeds the 4GB limit. Please choose a smaller video or use a public URL link.'
        });
      }
      return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No video file provided' });
    }

    try {
      let filePath = req.file.path;
      filePath = await normalizeWebVideo(filePath);
      const meta = await probeVideo(filePath);

      res.json({
        success: true,
        videoId: path.basename(filePath, path.extname(filePath)),
        filePath,
        fileName: req.file.originalname,
        videoUrl: `/api/stream?path=${encodeURIComponent(filePath)}`,
        meta
      });
    } catch (probeErr) {
      console.error('Upload probe error:', probeErr);
      res.status(500).json({ success: false, error: `Failed to inspect video: ${probeErr.message}` });
    }
  });
});

/**
 * Download URL (YouTube, Vimeo, etc.)
 */
app.post('/api/download-url', async (req, res) => {
  const { url, cookies } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    const result = await downloadUrl(url, UPLOAD_DIR, null, cookies);
    let filePath = result.filePath;
    filePath = await normalizeWebVideo(filePath);
    const meta = await probeVideo(filePath);

    res.json({
      success: true,
      videoId: result.fileId,
      filePath,
      videoUrl: `/api/stream?path=${encodeURIComponent(filePath)}`,
      meta
    });
  } catch (err) {
    console.error('Download URL error:', err);
    res.status(500).json({ error: `Download failed: ${err.message}` });
  }
});

/**
 * Master Pipeline: Ingest -> Probe -> Transcribe -> Viral Clip Detection
 */
app.post('/api/process', async (req, res) => {
  const { filePath, vttPath, geminiApiKey, groqApiKey, githubToken, scanMode = 'lightning', enableHookScan = true, language = 'pt' } = req.body;

  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(400).json({ error: 'Valid filePath is required' });
  }

  try {
    // 1+2. Probe video metadata AND extract audio in parallel for speed
    const audioPath = path.join(UPLOAD_DIR, `${path.basename(filePath, path.extname(filePath))}_audio.wav`);
    const [meta] = await Promise.all([
      probeVideo(filePath),
      extractAudio(filePath, audioPath)
    ]);

    // 3. Transcription (Lightning mode pre-trims long files for fast 30s processing on CPU)
    const transcript = await transcribeAudio(audioPath, {
      groqApiKey,
      existingVttPath: vttPath,
      estimatedDuration: meta.duration,
      scanMode,
      language
    });

    // 4. AI Virality Scoring & Complete Narrative Clip Discovery
    const clips = await discoverViralClips(
      transcript.words,
      transcript.text,
      meta.duration,
      { geminiApiKey, groqApiKey, githubToken: githubToken || process.env.GITHUB_TOKEN },
      { enableHookScan, audioPath, filePath }
    );

    res.json({
      success: true,
      meta,
      transcript,
      clips
    });
  } catch (err) {
    console.error('Process error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * AI Entity / Subject Motion Tracking Endpoint
 * Runs YOLOv8n ONNX to detect speaker's horizontal center coordinates across the clip
 */
app.get('/api/clip-tracking', async (req, res) => {
  const filePath = req.query.filePath || req.query.path;
  const startTime = Math.max(0, parseFloat(req.query.startTime || req.query.start || 0));
  const duration = Math.max(0.5, parseFloat(req.query.duration || 30));

  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Video file not found' });
  }

  try {
    const trackingData = await trackSubject(filePath, startTime, duration);
    res.json(trackingData);
  } catch (err) {
    console.warn('Tracking endpoint error:', err);
    res.json({ avgXPercent: 50.0, trajectory: [] });
  }
});

/**
 * Smart Jump-Cut & Dead-Air Removal Calculation Endpoint
 */
app.post('/api/jump-cuts', (req, res) => {
  const { words = [], startTime = 0, duration = 30, silenceThreshold = 'balanced', deletedIndices = [] } = req.body;
  const clipEnd = startTime + duration;
  const result = calculateJumpCuts(words, startTime, clipEnd, silenceThreshold, deletedIndices);
  const teaserHook = findBestTeaserHook(words, startTime, clipEnd);
  res.json({ ...result, teaserHook });
});

/**
 * Endpoint to discover or refresh candidate viral teaser hooks for a clip
 */
app.post('/api/find-hook', (req, res) => {
  const { words = [], startTime = 0, duration = 30 } = req.body;
  const clipEnd = startTime + duration;
  const hook = findBestTeaserHook(words, startTime, clipEnd);
  res.json(hook);
});

/**
 * Render High-Res Short Clip with 9:16 Auto-Crop, Subject Tracking, Burned Subtitles & SFX
 */
app.post('/api/render-clip', async (req, res) => {
  const {
    filePath,
    clipId = 'clip',
    startTime = 0,
    duration = 30,
    aspectRatio = '9:16',
    reframeMode = 'smart_track', // 'smart_track' | 'split_stacked' | 'crop_center' | 'blur_fill'
    targetXPercent = 50.0,
    speakerLeftPercent = 30.0,
    speakerRightPercent = 70.0,
    trajectory = [],
    sfxEvents = [],
    sfxVolume = 0.40,
    enablePunchInZoom = true,
    style = 'hormozi',
    fontSize = 58,
    words = [],
    segments = [],
    burnSubtitles = true,
    enableSpotlight = false,
    hookBannerText = null,
    showHookBanner = true,
    coverOriginalSubtitles = true,
    teaserHook = null
  } = req.body;

  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(400).json({ error: 'Valid filePath required' });
  }

  try {
    let effectiveTrajectory = trajectory || [];
    if (reframeMode === 'smart_track' && effectiveTrajectory.length < 2) {
      try {
        console.log(`[Render] Computing dynamic subject tracking trajectory for ${clipId}...`);
        const tracking = await trackSubject(filePath, startTime, duration);
        if (tracking && tracking.trajectory && tracking.trajectory.length >= 2) {
          effectiveTrajectory = tracking.trajectory;
          console.log(`[Render] Auto-computed ${effectiveTrajectory.length} trajectory points.`);
        }
      } catch (trackErr) {
        console.warn('[Render] Auto-tracking error:', trackErr.message);
      }
    }

    let assPath = null;
    const hasTeaser = teaserHook && teaserHook.active && typeof teaserHook.start === 'number';
    const teaserStart = hasTeaser ? Math.max(0, teaserHook.start) : 0;
    const teaserDur = hasTeaser ? Math.max(1.2, Math.min(4.5, (teaserHook.end || (teaserStart + 2.5)) - teaserStart)) : 0;

    const nonDeletedWords = (words || []).filter(w => !w.deleted);

    if (burnSubtitles && nonDeletedWords.length > 0) {
      // Adjust word timings relative to clip start (and offset by teaserDur if teaser hook is prepended)
      const relativeWords = nonDeletedWords.map(w => ({
        ...w,
        start: Math.max(0, (w.start - startTime) + (hasTeaser ? teaserDur : 0)),
        end: Math.max(0.1, (w.end - startTime) + (hasTeaser ? teaserDur : 0))
      })).filter(w => w.end > 0);

      const assContent = generateAssSubtitles(relativeWords, {
        style,
        fontSize,
        videoWidth: 1080,
        videoHeight: 1920,
        hookBannerText: showHookBanner ? hookBannerText : null,
        clipDuration: duration + (hasTeaser ? teaserDur : 0)
      });

      assPath = path.join(EXPORT_DIR, `sub_${Date.now()}_${clipId}.ass`);
      fs.writeFileSync(assPath, assContent, 'utf8');
    }

    const outputFileName = `clipadas_${Date.now()}_${clipId}.mp4`;
    const outputPath = path.join(EXPORT_DIR, outputFileName);

    await renderShortClip({
      inputPath: filePath,
      outputPath,
      startTime,
      duration,
      aspectRatio,
      reframeMode,
      targetXPercent,
      speakerLeftPercent,
      speakerRightPercent,
      trajectory: effectiveTrajectory,
      segments,
      sfxEvents,
      sfxVolume,
      enablePunchInZoom,
      words: nonDeletedWords,
      subtitlesAssPath: assPath,
      enableSpotlight,
      teaserHook,
      coverOriginalSubtitles
    });

    res.json({
      success: true,
      fileName: outputFileName,
      downloadUrl: `/exports/${outputFileName}`,
      fullPath: outputPath
    });
  } catch (err) {
    console.error('Render clip error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Global Error Handler to guarantee JSON responses
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  if (!res.headersSent) {
    res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Internal server error'
    });
  }
});

// Serve static frontend in production if built
const clientDistPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/exports') || req.path.startsWith('/samples') || req.path.startsWith('/sfx')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

const server = app.listen(PORT, () => {
  console.log(`🚀 Clipadas Studio API Server running on http://localhost:${PORT}`);
});
server.setTimeout(0);
server.keepAliveTimeout = 300000;
server.headersTimeout = 305000;
