import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Upload, FileText, Radar, LogOut, User, Mail, Target } from 'lucide-react';
import { logout, getSession } from '../lib/auth';
import { useTheme } from '../contexts/ThemeContext';
import Excelr8Logo from './Excelr8Logo';

export default function Layout({ children }) {
  const { theme, currentTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const session = getSession();
  
  // For Excelr8 2.0, icons should be black on white background
  const isExcelr82 = currentTheme === 'excelr82';
  const iconColorOnGradient = '#000000'; // Black icons for Excelr8 2.0 (white background)
  
  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/ingestion', label: 'File Ingestion', icon: Upload },
    { path: '/dossiers', label: 'Dossiers', icon: FileText },
    { path: '/radar', label: 'Post Radar', icon: Radar },
    { path: '/campaign-manager', label: 'Campaign Manager', icon: Target },
    { path: '/newsletter', label: 'Newsletter', icon: Mail },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen">
      {/* Fixed background */}
      <div className="fixed inset-0 bg-[#0a0a0a] bg-mesh pointer-events-none" />
      
      {/* Navigation */}
      <nav 
        className="relative border-b bg-[#1a1a1a]/80 backdrop-blur-xl animate-slideInFromTop"
        style={{ borderColor: theme.colors.border }}
      >
        <div className="max-w-[95%] xl:max-w-[98%] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-3 group animate-slideInLeft">
              <div className="group-hover:scale-110 transition-transform duration-300">
                <Excelr8Logo size={40} showText={false} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gradient">EXCELR8</h1>
                <p className="text-xs text-gray-400">AI Automation Services</p>
              </div>
            </Link>

            {/* Nav Links */}
            <div className="flex items-center space-x-2 animate-slideInRight flex-1 min-w-0 overflow-x-auto">
              {navItems.map((item, index) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl font-medium transition-all duration-300 ${
                      isActive
                        ? 'shadow-lg'
                        : 'text-gray-400 hover:bg-gray-800/50'
                    }`}
                    style={{
                      animationDelay: `${index * 0.1}s`,
                      ...(isActive ? {
                        background: `linear-gradient(to right, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`,
                        boxShadow: `0 10px 15px -3px ${theme.colors.shadow}`,
                        color: iconColorOnGradient
                      } : {
                        '--hover-color': theme.colors.primaryLight
                      })
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.color = theme.colors.primaryLight;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.color = '';
                      }
                    }}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" style={isActive ? { color: iconColorOnGradient } : {}} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              
              {/* User Info & Logout */}
              <div className="flex items-center space-x-3 ml-4 pl-4 border-l border-gray-700 flex-shrink-0">
                <div className="flex items-center space-x-2 text-gray-300">
                  <User className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm font-medium whitespace-nowrap">{session?.username || 'Admin'}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl font-medium text-gray-300 hover:text-white hover:bg-red-600/20 transition-all duration-300 border border-transparent hover:border-red-500/50"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5 flex-shrink-0" />
                  <span className="hidden md:inline">Logout</span>
                </button>
              </div>
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