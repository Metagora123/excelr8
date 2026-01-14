import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, LogIn, AlertCircle } from 'lucide-react';
import { login } from '../lib/auth';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      console.log('🚀 Login attempt started');
      console.log('  - Username:', username);
      console.log('  - Password provided:', password ? 'Yes' : 'No');
      
      const success = await login(username, password);
      
      console.log('  - Login result:', success ? 'SUCCESS' : 'FAILED');
      
      if (success) {
        // Redirect to dashboard after successful login
        navigate('/', { replace: true });
      } else {
        setError('Invalid username or password');
        console.log('❌ Login failed - check console for details');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error('❌ Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative">
      {/* Fixed background */}
      <div className="fixed inset-0 bg-[#0a0a0a] bg-mesh pointer-events-none" />
      
      <div className="relative z-10 w-full max-w-md px-6">
        <div className="card animate-slideInUp">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-cyan-600 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan-500/50">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gradient mb-2">Welcome Back</h1>
            <p className="text-gray-400">Please sign in to continue</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-xl flex items-center space-x-3 animate-slideInUp">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username Field */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="input-field w-full pl-12 pr-4 py-3"
                  required
                  autoFocus
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="input-field w-full pl-12 pr-4 py-3"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !username || !password}
              className={`w-full py-4 rounded-xl font-semibold text-white text-lg transition-all duration-300 flex items-center justify-center space-x-2 ${
                loading || !username || !password
                  ? 'bg-gray-700 cursor-not-allowed'
                  : 'bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 shadow-lg hover:shadow-xl transform hover:scale-105'
              }`}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* Info */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Session expires after 12 hours
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

