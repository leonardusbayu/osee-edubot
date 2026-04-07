import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// Suppress browser error dialogs but log everything for debugging
window.onerror = (msg, src, line, col, error) => {
  console.error('JS Error:', msg, src, line, col, error?.stack);
  return true;
};
window.onunhandledrejection = (e) => {
  console.error('Unhandled Promise Rejection:', e.reason);
  e.preventDefault();
  return true;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
