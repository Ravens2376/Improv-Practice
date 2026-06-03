import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Drill from './pages/Drill';
import ObjectWork from './pages/ObjectWork';
import FirstLast from './pages/FirstLast';
import Progress from './pages/Progress';
import Favorites from './pages/Favorites';
import Nav from './components/Nav';
import './index.css';

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', position: 'relative', paddingBottom: 80 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/drill/:type" element={<Drill />} />
          <Route path="/object-work" element={<ObjectWork />} />
          <Route path="/first-last" element={<FirstLast />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/favorites" element={<Favorites />} />
        </Routes>
        <Nav />
      </div>
    </BrowserRouter>
  );
}
