import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            maxWidth: '480px',
            margin: '60px auto',
            padding: '32px 24px',
            borderRadius: '24px',
            background: 'var(--bg-surface)',
            border: '2px solid var(--danger)',
            boxShadow: '0 8px 30px rgba(239, 68, 68, 0.15)',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.12)',
              color: 'var(--danger)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
              fontSize: '1.8rem'
            }}
          >
            ⚠️
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 900, marginBottom: '8px' }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.5 }}>
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="btn btn-primary btn-block"
            style={{ borderRadius: '16px', fontWeight: 800 }}
          >
            Reload Scanner
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
