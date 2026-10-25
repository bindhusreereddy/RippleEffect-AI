import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'leaflet/dist/leaflet.css'
import './studio.css'
import './dark.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// Global error handlers to capture any uncaught promise rejections
window.addEventListener('error', (event) => {
  console.error('GLOBAL WINDOW ERROR:', event.error || event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  console.error('GLOBAL UNHANDLED REJECTION:', event.reason);
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
