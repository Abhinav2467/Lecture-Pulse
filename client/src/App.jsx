import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import Header from './components/Header.jsx';
import StateScreen from './components/StateScreen.jsx';
import History from './pages/History.jsx';
import Home from './pages/Home.jsx';
import Join from './pages/Join.jsx';
import NotFound from './pages/NotFound.jsx';

// Host-only pages pull in the chart and QR libraries; students never download them.
const Host = lazy(() => import('./pages/Host.jsx'));
const Summary = lazy(() => import('./pages/Summary.jsx'));

export default function App() {
  return (
    <div className="app">
      <Header />
      <main className="main">
        <Suspense fallback={<StateScreen loading title="Loading…" />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/join/:code" element={<Join />} />
            <Route path="/host/:code" element={<Host />} />
            <Route path="/summary/:code" element={<Summary />} />
            <Route path="/history" element={<History />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}
