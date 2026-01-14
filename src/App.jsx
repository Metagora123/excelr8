import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import FileIngestion from './pages/FileIngestion';
import Dossiers from './pages/Dossiers';
import PostRadar from './pages/PostRadar';
import CampaignManager from './pages/CampaignManager';
import Newsletter from './pages/Newsletter';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          {/* Public route - Login page */}
          <Route path="/login" element={<Login />} />
          
          {/* Protected routes - require authentication */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/ingestion" element={<FileIngestion />} />
                    <Route path="/dossiers" element={<Dossiers />} />
                    <Route path="/radar" element={<PostRadar />} />
                    <Route path="/campaign-manager" element={<CampaignManager />} />
                    <Route path="/newsletter" element={<Newsletter />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;