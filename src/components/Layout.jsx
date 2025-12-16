import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Upload, FileText, Radar, Sparkles } from 'lucide-react';

export default function Layout({ children }) {
  const location = useLocation();
  
  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/ingestion', label: 'File Ingestion', icon: Upload },
    { path: '/dossiers', label: 'Dossiers', icon: FileText },
    { path: '/radar', label: 'Post Radar', icon: Radar },
  ];

  return (
    <div className="min-h-screen">
      {/* Fixed background */}
      <div className="fixed inset-0 bg-[#0a0a0a] bg-mesh pointer-events-none" />
      
      {/* Navigation */}
      <nav className="relative border-b border-cyan-500/30 bg-[#1a1a1a]/80 backdrop-blur-xl animate-slideInFromTop">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-3 group animate-slideInLeft">
              <div className="w-12 h-12 bg-gradient-to-br from-cyan-600 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/50 group-hover:scale-110 transition-transform duration-300">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gradient">Excelr8</h1>
                <p className="text-xs text-gray-400">AI Automation Services</p>
              </div>
            </Link>

            {/* Nav Links */}
            <div className="flex items-center space-x-2 animate-slideInRight">
              {navItems.map((item, index) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl font-medium transition-all duration-300 ${
                      isActive
                        ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-lg shadow-cyan-500/40'
                        : 'text-gray-400 hover:text-cyan-300 hover:bg-gray-800/50'
                    }`}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative max-w-7xl mx-auto px-6 py-8 animate-slideInUp">
        {children}
      </main>
    </div>
  );
}