import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted Tamil fonts — works offline with font-display swap
import '@fontsource/noto-serif-tamil/400.css'
import '@fontsource/noto-serif-tamil/700.css'
import '@fontsource/noto-serif-tamil/800.css'
import '@fontsource/mukta-malar/400.css'
import '@fontsource/mukta-malar/500.css'
import '@fontsource/mukta-malar/600.css'
import '@fontsource/mukta-malar/700.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
