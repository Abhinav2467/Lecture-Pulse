import { Suspense, lazy } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Header from './components/Header.jsx';
import StateScreen from './components/StateScreen.jsx';
import Grain from './components/ui/Grain.jsx';

// Every page is its own chunk. In particular the student route (/join) never
// downloads the chart, QR, particle canvas or replay code.
const Home = lazy(() => import('./pages/Home.jsx'));
const About = lazy(() => import('./pages/About.jsx'));
const Join = lazy(() => import('./pages/Join.jsx'));
const Host = lazy(() => import('./pages/Host.jsx'));
const Summary = lazy(() => import('./pages/Summary.jsx'));
const History = lazy(() => import('./pages/History.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));

const MINIMAL_HEADER = /^\/(join|host)\//;

export default function App() {
  const { pathname } = useLocation();

  return (
    <>
      <Grain />
      <div className="page">
        <Header minimal={MINIMAL_HEADER.test(pathname)} />
        <Suspense fallback={<main className="main"><StateScreen loading /></main>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/join/:code" element={<Join />} />
            <Route path="/host/:code" element={<Host />} />
            <Route path="/summary/:code" element={<Summary />} />
            <Route path="/history" element={<History />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </div>
    </>
  );
}
