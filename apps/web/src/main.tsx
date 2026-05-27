import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './store';
import App from './App';
import './styles.css';

// Markdown'daki <@id> / <#id> chip'leri store'a erişebilsin
(window as any).__sidcord_store = store;

// Density + tema kullanıcı tercihini yükle
document.documentElement.dataset.density = localStorage.getItem('sidcord_density') ?? 'cozy';
document.documentElement.dataset.theme = localStorage.getItem('sidcord_theme') ?? 'dark';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>,
);
