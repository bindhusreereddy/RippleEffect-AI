import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('CRITICAL REACT CRASH CAUGHT BY ERROR BOUNDARY:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '30px',
          margin: '20px',
          background: '#1e1014',
          border: '2px solid #ef4444',
          borderRadius: '16px',
          color: '#fee2e2',
          fontFamily: 'monospace',
          maxWidth: '900px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
        }}>
          <h2 style={{ color: '#f87171', margin: '0 0 10px 0', fontSize: '20px' }}>
            🚨 React Runtime Error Detected
          </h2>
          <p style={{ margin: '0 0 15px 0', color: '#fca5a5', fontSize: '14px' }}>
            {this.state.error && this.state.error.toString()}
          </p>
          <pre style={{
            background: '#0a0305',
            padding: '15px',
            borderRadius: '8px',
            overflowX: 'auto',
            fontSize: '12px',
            color: '#f87171'
          }}>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '15px',
              padding: '10px 20px',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Reload Simulator
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
