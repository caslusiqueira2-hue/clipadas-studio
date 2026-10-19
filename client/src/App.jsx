import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import IngestionZone from './components/IngestionZone';
import ProcessingStatus from './components/ProcessingStatus';
import ClipList from './components/ClipList';
import StudioEditor from './components/StudioEditor';
import ExportModal from './components/ExportModal';
import ApiSettingsModal from './components/ApiSettingsModal';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  const [samples, setSamples] = useState([]);
  const [systemStatus, setSystemStatus] = useState(null);

  const [activeVideo, setActiveVideo] = useState(() => {
    try {
      const saved = localStorage.getItem('openclip_active_video');
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  });
  const [processingStep, setProcessingStep] = useState(1);
  const [processingText, setProcessingText] = useState('');
  const [clips, setClips] = useState(() => {
    try {
      const saved = localStorage.getItem('openclip_clips');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });
  const [selectedClip, setSelectedClip] = useState(() => {
    try {
      const saved = localStorage.getItem('openclip_selected_clip');
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  });
  const [view, setView] = useState(() => {
    const saved = localStorage.getItem('openclip_view');
    const hasClips = localStorage.getItem('openclip_clips');
    if (saved) return saved;
    return hasClips ? 'clips' : 'ingestion';
  });

  // Export State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [exportResult, setExportResult] = useState(null);
  const [exportError, setExportError] = useState(null);

  // Settings Modal
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState(() => {
    let urlBackend = '';
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.has('backend')) {
        urlBackend = (params.get('backend') || '').replace(/\/$/, '');
        if (urlBackend) {
          localStorage.setItem('clipadas_backend_url', urlBackend);
          localStorage.setItem('openclip_backend_url', urlBackend);
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    } catch (e) {}

    const envBackend = (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

    return {
      geminiApiKey: localStorage.getItem('clipadas_gemini_key') || localStorage.getItem('openclip_gemini_key') || '',
      groqApiKey: localStorage.getItem('clipadas_groq_key') || localStorage.getItem('openclip_groq_key') || '',
      githubToken: localStorage.getItem('clipadas_github_token') || localStorage.getItem('openclip_github_token') || '',
      backendUrl: urlBackend || localStorage.getItem('clipadas_backend_url') || localStorage.getItem('openclip_backend_url') || envBackend || '',
      ytCookies: localStorage.getItem('clipadas_yt_cookies') || localStorage.getItem('openclip_yt_cookies') || ''
    };
  });

  const getApiUrl = (endpoint) => {
    const envBackend = (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
    const customBackend = apiKeys.backendUrl || localStorage.getItem('clipadas_backend_url') || localStorage.getItem('openclip_backend_url') || envBackend || '';
    if (customBackend) {
      return `${customBackend.replace(/\/$/, '')}${endpoint}`;
    }
    return endpoint;
  };

  const [scanMode, setScanMode] = useState('lightning');
  const [enableHookScan, setEnableHookScan] = useState(true);
  const [transcribeLang, setTranscribeLang] = useState(() => {
    return localStorage.getItem('openclip_transcribe_lang') || 'pt';
  });

  const handleLanguageChange = (newLang) => {
    setTranscribeLang(newLang);
    localStorage.setItem('openclip_transcribe_lang', newLang);
  };

  // Fetch initial samples & system status on mount
  useEffect(() => {
    fetch(getApiUrl('/api/samples'))
      .then(res => res.json())
      .then(data => setSamples(data.samples || []))
      .catch(() => {
        // Fallback sample for GitHub Pages Demo Mode
        setSamples([
          {
            id: 'sample_podcast',
            title: 'Podcast de Tecnologia e IA (Demonstração)',
            videoUrl: './samples/sample_podcast.mp4',
            vttUrl: './samples/sample_podcast.vtt',
            duration: 35
          }
        ]);
      });

    fetch(getApiUrl('/api/status'))
      .then(res => res.json())
      .then(data => {
        setSystemStatus(data);
        if (data.githubToken && !localStorage.getItem('openclip_github_token')) {
          localStorage.setItem('openclip_github_token', data.githubToken);
          setApiKeys(prev => ({ ...prev, githubToken: data.githubToken }));
        }
      })
      .catch(() => {
        setSystemStatus({
          status: 'ok',
          platform: 'Clipadas Studio Web Demo',
          pricing: '100% Gratuito & Código Aberto',
          isStaticDemo: true,
          ffmpegReady: false
        });
      });
  }, [apiKeys.backendUrl]);

  const handleSaveKeys = (newKeys) => {
    setApiKeys(newKeys);
    ['geminiApiKey', 'groqApiKey', 'githubToken', 'backendUrl', 'ytCookies'].forEach(k => {
      const storageKey = k === 'geminiApiKey' ? 'gemini_key'
        : k === 'groqApiKey' ? 'groq_key'
        : k === 'githubToken' ? 'github_token'
        : k === 'backendUrl' ? 'backend_url'
        : 'yt_cookies';
      const val = newKeys[k] || '';
      localStorage.setItem(`clipadas_${storageKey}`, val);
      localStorage.setItem(`openclip_${storageKey}`, val);
    });
  };

  useEffect(() => {
    if (activeVideo) localStorage.setItem('openclip_active_video', JSON.stringify(activeVideo));
    else localStorage.removeItem('openclip_active_video');
  }, [activeVideo]);

  useEffect(() => {
    if (clips && clips.length > 0) localStorage.setItem('openclip_clips', JSON.stringify(clips));
    else localStorage.removeItem('openclip_clips');
  }, [clips]);

  useEffect(() => {
    if (selectedClip) localStorage.setItem('openclip_selected_clip', JSON.stringify(selectedClip));
    else localStorage.removeItem('openclip_selected_clip');
  }, [selectedClip]);

  useEffect(() => {
    localStorage.setItem('openclip_view', view);
  }, [view]);

  // Safe fetch helper to guarantee JSON parsing and clear error messages
  const safeFetchJson = async (url, options = {}) => {
    const targetUrl = url.startsWith('http') ? url : getApiUrl(url);
    const res = await fetch(targetUrl, options);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      if (res.status === 502 || res.status === 503) {
        throw new Error(
          'O servidor está iniciando ou atualizando. Aguarde cerca de 15-30 segundos e tente novamente!'
        );
      }
      if (res.status === 405 || text.includes('405 Not Allowed')) {
        throw new Error(
          'A Vercel é uma hospedagem estática e requer o backend do seu PC para processar vídeos.\n\n' +
          '1. No seu PC, execute "start_mobile.bat"\n' +
          '2. Clique em Configurações (ícone de engrenagem) e cole a URL do túnel HTTPS (ex: https://...trycloudflare.com)'
        );
      }
      throw new Error(`Erro do servidor (${res.status}): ${text.slice(0, 160)}`);
    }
    if (!res.ok || data.success === false) {
      throw new Error(data.error || `Requisição falhou (${res.status})`);
    }
    return data;
  };

  // 1. Process Video Pipeline
  const runProcessingPipeline = async (filePath, vttPath = null, videoUrl = null) => {
    setView('processing');
    setProcessingStep(1);
    setProcessingText('Extraindo fluxo de áudio de 16kHz via FFmpeg...');

    try {
      const stepTimer1 = setTimeout(() => {
        setProcessingStep(2);
        const modeLabel = scanMode === 'lightning' ? 'Prévia Rápida (10 min)' : 'Vídeo Completo';
        const langLabel = transcribeLang === 'pt' ? 'Português' : transcribeLang === 'en' ? 'Inglês' : 'Automático';
        setProcessingText(`Transcrevendo fala com Faster-Whisper (${modeLabel} • Idioma: ${langLabel})...`);
      }, 800);

      const data = await safeFetchJson('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath,
          vttPath,
          geminiApiKey: apiKeys.geminiApiKey,
          groqApiKey: apiKeys.groqApiKey,
          githubToken: apiKeys.githubToken,
          scanMode,
          enableHookScan,
          language: transcribeLang
        })
      });

      clearTimeout(stepTimer1);

      setProcessingStep(3);
      setProcessingText('Avaliando viralidade narrativa, retenção e ganchos de curiosidade...');

      await new Promise(r => setTimeout(r, 400));
      setProcessingStep(4);
      setProcessingText('Configurando parâmetros de enquadramento vertical 9:16 e desfoque...');

      await new Promise(r => setTimeout(r, 400));
      setProcessingStep(5);
      setProcessingText('Finalizando legendas cinéticas e clipes virais do estúdio...');

      setTimeout(() => {
        setActiveVideo({
          filePath,
          videoUrl: videoUrl || `/api/stream?path=${encodeURIComponent(filePath)}`,
          meta: data.meta
        });
        setClips(data.clips || []);
        setView('clips');
      }, 500);

    } catch (err) {
      console.warn('Backend unavailable or static mode, loading Web Demo clips:', err.message);
      const fallbackClips = [
        {
          id: 'demo_clip_1',
          title: 'O Protocolo Cerebral Mais Eficaz ⚡',
          hookType: 'Conselho Prático',
          start: 0,
          end: 32.5,
          startTime: 0,
          endTime: 32.5,
          duration: 32.5,
          viralityScore: 97,
          hookScore: 94,
          flowScore: 92,
          energyScore: 89,
          climaxScore: 96,
          viralityReason: 'Análise de IA: Gancho de 0.8s com abertura de alta retenção, ritmo de fala ideal (165 PPM) e fechamento marcante.',
          mlModel: 'Clipadas-Proprietary-v4-46D-Multimodal',
          semanticMargin: 0.94,
          acousticPower: 0.72,
          hookVelocity: 0.96,
          survivalProbability: 0.94,
          mlVerified: true,
          hashtags: ['#shorts', '#produtividade', '#podcast', '#saude'],
          suitablePlatforms: ['TikTok', 'YouTube Shorts', 'Instagram Reels'],
          words: [
            { word: 'A', start: 0.1, end: 0.28 },
            { word: 'melhor', start: 0.29, end: 0.55 },
            { word: 'forma', start: 0.56, end: 0.78 },
            { word: 'de', start: 0.79, end: 0.95 },
            { word: 'aumentar', start: 0.96, end: 1.35 },
            { word: 'sua', start: 1.36, end: 1.7 },
            { word: 'energia', start: 1.71, end: 2.1 },
            { word: 'é', start: 2.15, end: 2.3 },
            { word: 'receber', start: 2.35, end: 2.5 },
            { word: 'luz', start: 2.55, end: 2.75 },
            { word: 'solar', start: 2.76, end: 3.1 },
            { word: 'nos', start: 3.15, end: 3.45 },
            { word: 'olhos', start: 3.46, end: 3.75 },
            { word: 'nos', start: 3.76, end: 4.1 },
            { word: 'primeiros', start: 4.15, end: 4.6 },
            { word: 'trinta', start: 4.61, end: 5.1 },
            { word: 'minutos', start: 5.15, end: 5.75 },
            { word: 'do', start: 5.76, end: 5.9 },
            { word: 'seu', start: 5.91, end: 6.1 },
            { word: 'dia.', start: 6.15, end: 6.6 }
          ]
        },
        {
          id: 'demo_clip_2',
          title: 'Construindo uma Mentalidade Inabalável 🧠',
          hookType: 'Alta Relevância',
          start: 5,
          end: 30,
          startTime: 5,
          endTime: 30,
          duration: 25,
          viralityScore: 93,
          hookScore: 90,
          flowScore: 91,
          energyScore: 86,
          climaxScore: 92,
          viralityReason: 'Análise de IA: Tese de alto impacto sobre resiliência mental com fechamento conversacional perfeito.',
          mlModel: 'Clipadas-Proprietary-v4-46D-Multimodal',
          semanticMargin: 0.91,
          acousticPower: 0.68,
          hookVelocity: 0.88,
          survivalProbability: 0.89,
          mlVerified: true,
          hashtags: ['#mentalidade', '#disciplina', '#foco'],
          suitablePlatforms: ['TikTok', 'YouTube Shorts', 'Instagram Reels'],
          words: [
            { word: 'Quando', start: 5.2, end: 5.5 },
            { word: 'você', start: 5.55, end: 5.75 },
            { word: 'constrói', start: 5.8, end: 6.2 },
            { word: 'uma', start: 6.25, end: 6.45 },
            { word: 'mente', start: 6.5, end: 6.9 },
            { word: 'forte,', start: 6.95, end: 7.4 },
            { word: 'você', start: 7.45, end: 7.65 },
            { word: 'nunca', start: 7.7, end: 8.05 },
            { word: 'desiste', start: 8.1, end: 8.5 },
            { word: 'sob', start: 8.55, end: 8.85 },
            { word: 'pressão.', start: 8.9, end: 9.4 }
          ]
        }
      ];

      setActiveVideo({
        filePath: filePath || 'sample_podcast.mp4',
        videoUrl: videoUrl || './samples/sample_podcast.mp4',
        meta: { title: 'Demonstração de Podcast', duration: 35 }
      });
      setClips(fallbackClips);
      setView('clips');
    }
  };

  // 2. Upload file handler with real-time percentage, MB counter & speed tracking
  const handleUploadFile = (file) => {
    setView('processing');
    setProcessingStep(1);
    const totalMB = (file.size / (1024 * 1024)).toFixed(1);
    setProcessingText(`Enviando ${file.name} (0% • 0 / ${totalMB} MB)...`);

    const formData = new FormData();
    formData.append('video', file);

    const xhr = new XMLHttpRequest();
    const targetUrl = getApiUrl('/api/upload');
    xhr.open('POST', targetUrl, true);

    const startTime = Date.now();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.floor((e.loaded / e.total) * 100);
        const elapsedSec = (Date.now() - startTime) / 1000;
        const speedMBps = elapsedSec > 0.5 ? ((e.loaded / (1024 * 1024)) / elapsedSec).toFixed(1) : '...';
        const loadedMB = (e.loaded / (1024 * 1024)).toFixed(1);
        
        let estMsg = '';
        if (elapsedSec > 2 && e.loaded > 0) {
          const remainingSec = Math.round((e.total - e.loaded) / (e.loaded / elapsedSec));
          const remMin = Math.floor(remainingSec / 60);
          const remSec = remainingSec % 60;
          estMsg = remMin > 0 ? ` • restam ~${remMin}m ${remSec}s` : ` • restam ~${remSec}s`;
        }

        setProcessingText(`Enviando ${file.name}: ${pct}% (${loadedMB} / ${totalMB} MB @ ${speedMBps} MB/s${estMsg})`);
      }
    };

    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          setProcessingText('Envio concluído! Extraindo áudio e preparando análise por IA...');
          await runProcessingPipeline(data.filePath, null, data.videoUrl);
        } catch (parseErr) {
          alert('Falha no envio: Resposta inválida do servidor');
          setView('ingestion');
        }
      } else {
        let errMsg = `Falha no envio (${xhr.status})`;
        try {
          const errObj = JSON.parse(xhr.responseText);
          if (errObj.error) errMsg = errObj.error;
        } catch (e) {
          if (xhr.status === 502 || xhr.status === 503) {
            errMsg = 'O servidor está temporariamente iniciando ou ocupado. Tente novamente em instantes!';
          }
        }
        alert(`Erro no envio: ${errMsg}`);
        setView('ingestion');
      }
    };

    xhr.onerror = () => {
      alert('Falha no envio por erro de rede. Se o seu arquivo for muito grande (ex: 2GB), a conexão pode ter expirado.');
      setView('ingestion');
    };

    xhr.send(formData);
  };

  // 3. Download URL handler
  const handleDownloadUrl = async (url) => {
    setView('processing');
    setProcessingStep(1);
    setProcessingText('Baixando fluxo de vídeo via yt-dlp...');

    const storedCookies = apiKeys.ytCookies || localStorage.getItem('openclip_yt_cookies') || '';

    try {
      const data = await safeFetchJson('/api/download-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, cookies: storedCookies })
      });

      await runProcessingPipeline(data.filePath, null, data.videoUrl);
    } catch (err) {
      const isBotBlock = err.message.includes('not a bot') || err.message.includes('429');
      if (isBotBlock) {
        alert(
          'O YouTube bloqueou downloads automatizados (Verificação Anti-Bot / HTTP 429).\n\n' +
          '• Solução 1 (Recomendada): Baixe o vídeo no seu dispositivo (ex: via cobalt.tools) e arraste o MP4 aqui para processamento instantâneo!\n' +
          '• Solução 2: Cole seus cookies do YouTube nas Configurações (canto superior direito) para autorizar downloads.'
        );
      } else {
        alert(`Erro ao baixar: ${err.message}`);
      }
      setView('ingestion');
    }
  };

  // 4. Select Sample Demo handler
  const handleSelectSample = (sample) => {
    runProcessingPipeline(sample.filePath, sample.vttPath, sample.videoUrl);
  };

  // 5. Open Studio Editor for a clip
  const handleSelectClip = (clip) => {
    setSelectedClip(clip);
    setView('studio');
  };

  // 6. Trigger Render & Export
  const handleExportClip = async (exportParams) => {
    setIsExportModalOpen(true);
    setIsRendering(true);
    setExportResult(null);
    setExportError(null);

    try {
      const data = await safeFetchJson('/api/render-clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exportParams)
      });

      setIsRendering(false);
      setExportResult(data);
    } catch (err) {
      setIsRendering(false);
      setExportError(err.message);
    }
  };

  const handleNewVideo = () => {
    setActiveVideo(null);
    setClips([]);
    setSelectedClip(null);
    setView('ingestion');
    localStorage.removeItem('openclip_active_video');
    localStorage.removeItem('openclip_clips');
    localStorage.removeItem('openclip_selected_clip');
    localStorage.setItem('openclip_view', 'ingestion');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header
        status={systemStatus}
        view={view}
        onNavigate={setView}
        onNewVideo={handleNewVideo}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main style={{ flex: 1 }}>
        <ErrorBoundary onBack={() => setView('clips')}>
          {view === 'ingestion' && (
            <IngestionZone
              samples={samples}
              onSelectSample={handleSelectSample}
              onUploadFile={handleUploadFile}
              onDownloadUrl={handleDownloadUrl}
              scanMode={scanMode}
              onScanModeChange={setScanMode}
              enableHookScan={enableHookScan}
              onEnableHookScanChange={setEnableHookScan}
              language={transcribeLang}
              onLanguageChange={handleLanguageChange}
              isLoading={false}
              isStaticDemo={Boolean(!apiKeys.backendUrl && (systemStatus?.isStaticDemo || (typeof window !== 'undefined' && window.location.hostname.includes('github.io'))))}
              backendUrl={apiKeys.backendUrl}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          )}

          {view === 'processing' && (
            <ProcessingStatus
              step={processingStep}
              progressText={processingText}
              onCancel={() => setView('ingestion')}
            />
          )}

          {view === 'clips' && (
            <ClipList
              clips={clips}
              videoMeta={activeVideo?.meta}
              onSelectClip={handleSelectClip}
              onNewVideo={handleNewVideo}
            />
          )}

          {view === 'studio' && selectedClip && (
            <StudioEditor
              clip={selectedClip}
              videoUrl={activeVideo?.videoUrl}
              filePath={activeVideo?.filePath}
              backendUrl={apiKeys.backendUrl}
              onBack={() => setView('clips')}
              onExport={handleExportClip}
            />
          )}
        </ErrorBoundary>
      </main>

      {/* Export Rendering Modal */}
      {isExportModalOpen && (
        <ExportModal
          isRendering={isRendering}
          exportResult={exportResult}
          error={exportError}
          onClose={() => setIsExportModalOpen(false)}
        />
      )}

      {/* API Key Settings Modal */}
      <ApiSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaveKeys={handleSaveKeys}
        initialKeys={apiKeys}
      />
    </div>
  );
}
