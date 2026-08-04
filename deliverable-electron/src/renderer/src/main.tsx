import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'sonner';

import App from './App';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <Toaster duration={5000}
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{
        style: {
          borderRadius: '10px',
          fontFamily: 'inherit',
        },
      }}
    />
  </React.StrictMode>,
);
