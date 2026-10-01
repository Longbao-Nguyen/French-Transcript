import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import LegacyApp from './legacy/LegacyApp.tsx';
import './index.css';

const RootApp = new URLSearchParams(window.location.search).get('legacy') === '1'
  ? LegacyApp
  : App;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootApp />
  </StrictMode>,
);
