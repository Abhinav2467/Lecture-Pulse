import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
// Self-hosted fonts: no runtime request to Google Fonts.
import '@fontsource-variable/inter';
import '@fontsource/instrument-serif/400-italic.css';
import './styles/theme.css';
import './styles/base.css';
import './styles/motion.css';
import './styles/ui.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
