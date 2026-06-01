import React, { Component, ErrorInfo, ReactNode } from 'react';

/**
 * Global error handling and boundary for Castle Ravenloft 3D.
 * Ensures the 3D scene crashes gracefully if a shader or model fails.
 */

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Castle Ravenloft Engine Error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback gothic-panel">
          <h1>The Mists Consume You</h1>
          <p>The game engine encountered an unrecoverable error.</p>
          <pre>{this.state.error?.message}</pre>
          <button onClick={() => window.location.reload()}>Re-enter the Castle</button>
        </div>
      );
    }

    return this.props.children;
  }
}

export const logGameError = (module: string, message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${module}] ${message} ${data ? JSON.stringify(data) : ''}`;
  
  // In production, this would send to Sentry or a backend log endpoint
  console.error(logEntry);
  
  // Simple local persistence for dev debugging
  const logs = JSON.parse(localStorage.getItem('game_logs') || '[]');
  logs.push(logEntry);
  localStorage.setItem('game_logs', JSON.stringify(logs.slice(-50)));
};
