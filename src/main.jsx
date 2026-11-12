import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, MemoryRouter } from 'react-router-dom';
import { DataProvider } from './lib/DataContext.jsx';
import App from './App.jsx';
import './index.css';

const Router = import.meta.env.MODE === 'artifact' ? MemoryRouter : HashRouter;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Locally: HashRouter (URLs like /#/people). Published as an artifact: MemoryRouter,
        because claude.ai keeps the page's URL to itself. */}
    <Router>
      <DataProvider>
        <App />
      </DataProvider>
    </Router>
  </StrictMode>
);
