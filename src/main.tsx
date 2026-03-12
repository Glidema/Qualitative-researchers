import React from 'react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    // 可在此上报错误
  }

  render() {
    if (this.state.hasError) {
      return <LoadErrorPage reason="页面加载异常，请刷新后重试" />;
    }
    return (this as React.Component<{ children: React.ReactNode }, { hasError: boolean }>).props.children;
  }
}

function LoadErrorPage({ reason }: { reason?: string }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f5f5f0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#44403c',
        textAlign: 'center',
        boxSizing: 'border-box',
      }}
    >
      <p style={{ marginBottom: 12, fontSize: 16, lineHeight: 1.5 }}>
        {reason || '无法加载页面'}
      </p>
      <p style={{ marginBottom: 20, fontSize: 14, color: '#78716c', lineHeight: 1.5 }}>
        请尝试：<br />
        1. 点击下方「刷新」<br />
        2. 用手机<strong>系统自带浏览器</strong>（如 Safari、Chrome）打开此链接<br />
        3. 若在 QQ/微信内，请点右上角 … 选择「在浏览器中打开」
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          padding: '12px 24px',
          background: '#44403c',
          color: '#fff',
          border: 'none',
          borderRadius: 12,
          fontSize: 16,
          cursor: 'pointer',
        }}
      >
        刷新页面
      </button>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f5f5f0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        color: '#78716c',
        fontSize: 15,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <span>加载中…</span>
      <span
        style={{
          display: 'inline-block',
          width: 28,
          height: 28,
          marginTop: 12,
          border: '2px solid #d6d3d1',
          borderTopColor: '#57534e',
          borderRadius: '50%',
          animation: 'root-spin 0.8s linear infinite',
        }}
      />
    </div>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = createRoot(rootEl);
  root.render(
    <StrictMode>
      <LoadingScreen />
    </StrictMode>,
  );

  import('./App.tsx')
    .then(({ default: App }) => {
      root.render(
        <StrictMode>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </StrictMode>,
      );
    })
    .catch((err) => {
      console.error('App load failed:', err);
      root.render(
        <StrictMode>
          <LoadErrorPage reason="加载失败，请用系统浏览器打开或刷新" />
        </StrictMode>,
      );
    });
}
