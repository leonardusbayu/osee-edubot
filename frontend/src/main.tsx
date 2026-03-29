import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// Log errors but suppress Telegram WebApp SDK error popups
window.onerror = (msg, src, line) => { console.error('Error:', msg, src, line); return true; };
window.onunhandledrejection = (e) => { console.error('Unhandled:', e.reason); e.preventDefault(); return true; };

// Wrap fetch to never throw — Telegram SDK intercepts fetch errors and shows popups
const originalFetch = window.fetch.bind(window);
window.fetch = async (...args) => {
  try {
    return await originalFetch(...args);
  } catch (e) {
    // Network error — return a fake failed response instead of throwing
    return new Response(JSON.stringify({ error: 'network' }), {
      status: 0,
      statusText: 'Network Error',
    });
  }
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
