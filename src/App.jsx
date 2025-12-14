import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import FileIngestion from './pages/FileIngestion';
import Dossiers from './pages/Dossiers';
import PostRadar from './pages/PostRadar';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/ingestion" element={<FileIngestion />} />
          <Route path="/dossiers" element={<Dossiers />} />
          <Route path="/radar" element={<PostRadar />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;