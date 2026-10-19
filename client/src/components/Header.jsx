import React from 'react';
import { Film, Sliders, ChevronRight, Plus } from 'lucide-react';

export default function Header({ onOpenSettings, status, view = 'ingestion', onNavigate, onNewVideo }) {
  return (
    <header style={{
      margin: '14px 24px 8px 24px',
      padding: '10px 20px',
      borderRadius: 'var(--radius-md)',
      background: 'rgba(11, 14, 23, 0.75)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      border: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'relative',
      zIndex: 30,
      boxShadow: 'var(--glass-specular)'
    }}>
      {/* Brand & Workspace Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div
          onClick={() => onNavigate && onNavigate('ingestion')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: onNavigate ? 'pointer' : 'default',
            userSelect: 'none'
          }}
        >
          {/* Official Brand Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img
              src="/logo.png"
              alt="Clipadas Studio"
              style={{
                height: '36px',
                width: 'auto',
                objectFit: 'contain',
                filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.5))'
              }}
            />
            <span className="badge-minimal" style={{ fontSize: '0.68rem', padding: '1px 7px', marginLeft: '4px' }}>
              Edição Estúdio
            </span>
          </div>
        </div>

        {/* Minimalist Lowkey Breadcrumbs */}
        {view !== 'ingestion' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            paddingLeft: '14px',
            borderLeft: '1px solid var(--border-subtle)',
            fontSize: '0.78rem',
            color: 'var(--text-muted)'
          }}>
            <button
              onClick={() => onNavigate ? onNavigate('ingestion') : onNewVideo && onNewVideo()}
              style={{
                background: 'transparent',
                color: 'var(--text-muted)',
                padding: 0,
                fontSize: 'inherit',
                fontWeight: 500
              }}
              onMouseEnter={(e) => e.target.style.color = '#ffffff'}
              onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
            >
              Início
            </button>
            <ChevronRight size={12} color="var(--text-dim)" />
            {view === 'clips' ? (
              <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>Clipes Virais</span>
            ) : (
              <>
                <button
                  onClick={() => onNavigate && onNavigate('clips')}
                  style={{
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    padding: 0,
                    fontSize: 'inherit',
                    fontWeight: 500
                  }}
                  onMouseEnter={(e) => e.target.style.color = '#ffffff'}
                  onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
                >
                  Clipes Virais
                </button>
                <ChevronRight size={12} color="var(--text-dim)" />
                <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>Estúdio de Edição</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Right Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Lowkey Status Indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          background: 'rgba(255, 255, 255, 0.03)',
          padding: '5px 11px',
          borderRadius: 'var(--radius-full)',
          border: '1px solid var(--border-subtle)',
          fontSize: '0.74rem',
          color: 'var(--text-muted)'
        }}>
          <span
            className="pulse-dot"
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: status?.isStaticDemo ? '#f59e0b' : '#10b981',
              boxShadow: status?.isStaticDemo ? '0 0 6px rgba(245, 158, 11, 0.6)' : '0 0 6px rgba(16, 185, 129, 0.6)',
              display: 'inline-block'
            }}
          />
          <span style={{ fontWeight: 500, color: status?.isStaticDemo ? '#fcd34d' : 'var(--text-secondary)' }}>
            {status?.isStaticDemo ? 'Demonstração Web' : (status?.ffmpegReady ? 'Motor Local Ativo' : 'Servidor Conectado')}
          </span>
        </div>

        {/* Quick New Video Button */}
        {view !== 'ingestion' && onNewVideo && (
          <button
            onClick={onNewVideo}
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.78rem', gap: '5px' }}
            title="Importar um novo vídeo"
          >
            <Plus size={13} />
            <span>Novo Vídeo</span>
          </button>
        )}

        {/* AI Settings Trigger */}
        <button
          onClick={onOpenSettings}
          className="btn-secondary"
          style={{ padding: '6px 12px', fontSize: '0.78rem', gap: '5px' }}
          title="Configurar chaves de API e preferências"
        >
          <Sliders size={13} />
          <span>Configurações</span>
        </button>
      </div>
    </header>
  );
}
