import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { isSessionValid } from '../lib/auth';
import LoadingSpinner from './LoadingSpinner';

export default function ProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check authentication status
    const checkAuth = () => {
      const valid = isSessionValid();
      setIsAuthenticated(valid);
      setLoading(false);
    };

    checkAuth();
  }, []);

  // Show loading spinner while checking auth
  if (loading) {
    return <LoadingSpinner text="Checking authentication..." />;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Render protected content
  return children;
}

