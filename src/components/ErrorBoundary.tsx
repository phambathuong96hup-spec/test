import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '50vh',
            padding: '40px 24px',
            textAlign: 'center',
            fontFamily: 'var(--font-family, Inter, sans-serif)',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'var(--danger-light, #fee2e2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
              fontSize: '28px',
            }}
          >
            ⚠️
          </div>
          <h2
            style={{
              fontSize: '1.3rem',
              fontWeight: 700,
              color: 'var(--text-primary, #0f172a)',
              marginBottom: '8px',
            }}
          >
            Đã xảy ra lỗi
          </h2>
          <p
            style={{
              fontSize: '0.9rem',
              color: 'var(--text-secondary, #475569)',
              marginBottom: '20px',
              maxWidth: '400px',
            }}
          >
            Trang gặp sự cố không mong muốn. Vui lòng thử tải lại hoặc liên hệ quản trị viên.
          </p>
          {this.state.error && (
            <pre
              style={{
                fontSize: '0.75rem',
                color: 'var(--danger, #ef4444)',
                background: 'var(--danger-light, #fee2e2)',
                padding: '12px 16px',
                borderRadius: '8px',
                maxWidth: '500px',
                overflow: 'auto',
                marginBottom: '20px',
                textAlign: 'left',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: '10px 24px',
                borderRadius: '8px',
                border: '1.5px solid var(--border, #e2e8f0)',
                background: 'white',
                color: 'var(--text-primary, #0f172a)',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              Thử lại
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 24px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--primary, #0d9488)',
                color: 'white',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
