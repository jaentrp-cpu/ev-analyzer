import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from './theme.jsx';
import { VedoxProvider } from './context/VedoxContext.jsx';
import App from './App.jsx';
import './styles.css';

// GitHub Pages SPA routing fix
(function() {
  var redirect = sessionStorage.redirect;
  delete sessionStorage.redirect;
  if (redirect && redirect !== location.href) {
    history.replaceState(null, null, redirect);
  }
})();

createRoot(document.getElementById('root')).render(
  <ThemeProvider>
    <VedoxProvider>
      <App />
    </VedoxProvider>
  </ThemeProvider>
);
