import React, { useState } from 'react';
import { X, Key, ShieldCheck, Zap, Sparkles, Server } from 'lucide-react';

export default function ApiSettingsModal({ isOpen, onClose, onSaveKeys, initialKeys }) {
  const [geminiKey, setGeminiKey] = useState(initialKeys?.geminiApiKey || '');
  const [groqKey, setGroqKey] = useState(initialKeys?.groqApiKey || '');
  const [githubToken, setGithubToken] = useState(initialKeys?.githubToken || '');
  const [backendUrl, setBackendUrl] = useState(initialKeys?.backendUrl || '');
  const [ytCookies, setYtCookies] = useState(initialKeys?.ytCookies || '');

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveKeys({
      geminiApiKey: geminiKey.trim(),
      groqApiKey: groqKey.trim(),
      githubToken: githubToken.trim(),
      backendUrl: backendUrl.trim().replace(/\/$/, ''),
      ytCookies: ytCookies.trim()
    });
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        maxWidth: '500px',
        width: '100%',
        padding: '28px',
        position: 'relative'
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(255, 255, 255, 0.06)',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)'
          }}
        >
          <X size={16} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'rgba(99, 102, 241, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Key size={18} color="#818cf8" />
          </div>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 700 }}>
            Configurações dos Motores de IA
          </h3>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 14px',
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: 'var(--radius-sm)',
          color: '#34d399',
          fontSize: '0.8rem',
          marginBottom: '20px'
        }}>
          <ShieldCheck size={16} />
          <span>100% Opcional: A plataforma funciona de forma completa e local sem chaves!</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
          <div>
            <label style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
              Chave de API do Google Gemini (Plano Gratuito)
            </label>
            <input
              type="password"
              placeholder="AIzaSy..."
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--border-subtle)',
                color: '#ffffff',
                fontSize: '0.88rem'
              }}
            />
            <p style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              Ativa o Gemini 1.5 Flash para pontuação narrativa e viralidade avançada. Gratuito em Google AI Studio.
            </p>
          </div>

          <div>
            <label style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
              Chave de API Groq Whisper (Transcrição Ultra-Rápida)
            </label>
            <input
              type="password"
              placeholder="gsk_..."
              value={groqKey}
              onChange={(e) => setGroqKey(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--border-subtle)',
                color: '#ffffff',
                fontSize: '0.88rem'
              }}
            />
            <p style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              Ativa o modelo Whisper Large-v3 na nuvem a ~100x a velocidade em tempo real. Gratuito em console.groq.com.
            </p>
          </div>

          <div>
            <label style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={14} color="#818cf8" />
              Token do GitHub / Plano Estudante (Personal Access Token)
            </label>
            <input
              type="password"
              placeholder="ghp_... ou github_pat_..."
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--border-subtle)',
                color: '#ffffff',
                fontSize: '0.88rem'
              }}
            />
            <p style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              Desbloqueia os <strong>GitHub Models</strong> (Meta-Llama-3.3-70B e GPT-4o-mini) gratuitamente para seleção de ganchos virais.
            </p>
          </div>

          <div>
            <label style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Server size={14} color="#818cf8" />
              URL do Servidor Backend (Opcional)
            </label>
            <input
              type="text"
              placeholder="ex: http://localhost:5000 ou https://seu-backend.onrender.com"
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--border-subtle)',
                color: '#ffffff',
                fontSize: '0.88rem'
              }}
            />
            <p style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              Deixe em branco ao executar localmente no seu computador via <code>npm run dev</code>.
            </p>
          </div>

          <div>
            <label style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={14} color="#f59e0b" />
              Cookies do YouTube (Opcional - Evita Bloqueios do YouTube)
            </label>
            <textarea
              rows={2}
              placeholder="Cole o conteúdo de cookies.txt (formato Netscape) para autorizar downloads protegidos..."
              value={ytCookies}
              onChange={(e) => setYtCookies(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--border-subtle)',
                color: '#ffffff',
                fontSize: '0.82rem',
                fontFamily: 'monospace',
                resize: 'vertical'
              }}
            />
            <p style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              Exporte usando a extensão <em>"Get cookies.txt LOCALLY"</em> logado no YouTube. Armazenado apenas no seu navegador.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button onClick={handleSave} className="btn-primary">
            Salvar Configurações
          </button>
        </div>
      </div>
    </div>
  );
}
