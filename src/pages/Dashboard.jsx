import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Users, FileText, TrendingUp, Database, RefreshCw, Palette } from 'lucide-react';
import { leadQueries } from '../lib/supabase';
import LoadingSpinner from '../components/LoadingSpinner';
import { useTheme } from '../contexts/ThemeContext';

// Helper function to get initials from full name
const getInitials = (fullName) => {
  if (!fullName || typeof fullName !== 'string') return '?';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  // Get first letter of first name and first letter of last name
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

export default function Dashboard() {
  const { currentTheme, setTheme, theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [leads, setLeads] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // Helper function to filter out invalid leads
  const isValidLead = (lead) => {
    const name = lead.full_name;
    
    // Check if name exists and is a string
    if (!name) return false;
    if (typeof name !== 'string') return false;
    
    // Remove emojis and special characters, then normalize
    // This regex removes emojis and other unicode symbols
    const withoutEmojis = name.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2190}-\u{21FF}]|[\u{2300}-\u{23FF}]|[\u{2B50}-\u{2B55}]|[\u{3030}-\u{303F}]|[\u{FE00}-\u{FE0F}]|[\u{1F018}-\u{1F270}]|[\u{24C2}-\u{1F251}]/gu, '').trim();
    
    // Normalize the name: trim, remove extra spaces, convert to lowercase
    const normalizedName = withoutEmojis.replace(/\s+/g, ' ').toLowerCase();
    
    // Check for empty string
    if (normalizedName === '') return false;
    
    // Check for invalid name patterns (case-insensitive, handles variations)
    const invalidPatterns = [
      'no profile found',
      'noprofilefound',
      'no-profile-found',
      'no_profile_found',
      'nan',
      'none',
      'null',
      'undefined',
      'n/a',
      'na',
      'tbd',
      'to be determined'
    ];
    
    // Check if the normalized name matches any invalid pattern
    if (invalidPatterns.includes(normalizedName)) return false;
    
    // Also check if the name contains "no profile found" anywhere (even with emojis)
    if (normalizedName.includes('no profile found') || normalizedName.includes('noprofilefound')) {
      return false;
    }
    
    // Check if name contains only invalid characters or is too short
    if (normalizedName.length < 2) return false;
    
    return true;
  };

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const leadsData = await leadQueries.getAll();
      
      // Filter out invalid leads
      const validLeads = leadsData.filter(isValidLead);
      
      // Debug: log filtered counts
      const filteredCount = leadsData.length - validLeads.length;
      if (filteredCount > 0) {
        console.log(`Filtered out ${filteredCount} invalid leads`);
      }
      
      // Recalculate stats from valid leads only
      const recalculatedStats = {
        total: validLeads.length,
        withDossiers: validLeads.filter(l => l.is_dossier).length,
        byStatus: validLeads.reduce((acc, lead) => {
          const status = lead.status || 'new';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {}),
        byTier: validLeads.reduce((acc, lead) => {
          if (lead.tier) {
            acc[lead.tier] = (acc[lead.tier] || 0) + 1;
          }
          return acc;
        }, {}),
        averageScore: (() => {
          const leadsWithScores = validLeads.filter(l => l.score != null && !isNaN(l.score));
          if (leadsWithScores.length === 0) return 0;
          return leadsWithScores.reduce((sum, lead) => sum + lead.score, 0) / leadsWithScores.length;
        })()
      };
      
      setStats(recalculatedStats);
      setLeads(validLeads);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return <LoadingSpinner text="Loading dashboard data..." />;
  }

  // Prepare chart data
  const statusData = stats?.byStatus ? Object.entries(stats.byStatus).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value
  })) : [];

  const tierData = stats?.byTier ? Object.entries(stats.byTier).map(([name, value]) => ({
    name: name.toUpperCase(),
    value
  })) : [];

  // Timeline data - show cumulative average score over time
  // Sort leads by creation date (oldest first)
  const sortedLeads = [...leads]
    .filter(lead => lead.created_at)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  
  // Calculate cumulative average score over time
  let cumulativeScores = [];
  let cumulativeTotal = 0;
  let cumulativeCount = 0;
  
  sortedLeads.forEach((lead) => {
    if (lead.score != null && !isNaN(lead.score) && lead.score > 0) {
      cumulativeTotal += lead.score;
      cumulativeCount += 1;
    }
    const avgScore = cumulativeCount > 0 ? cumulativeTotal / cumulativeCount : 0;
    cumulativeScores.push({
      date: new Date(lead.created_at),
      score: avgScore,
      count: cumulativeCount
    });
  });
  
  // Group by day and take the last entry for each day (to show end-of-day average)
  const leadsByDay = cumulativeScores.reduce((acc, entry) => {
    const dayKey = entry.date.toISOString().split('T')[0];
    acc[dayKey] = entry; // Keep the last entry for each day
    return acc;
  }, {});
  
  // Convert to array, sort by date, and take last 30 days
  const timelineData = Object.values(leadsByDay)
    .sort((a, b) => a.date - b.date)
    .slice(-30)
    .map((entry, index) => ({
      name: `Day ${index + 1}`,
      date: entry.date.toISOString().split('T')[0],
      leads: entry.count,
      score: Number(entry.score.toFixed(2))
    }));

  // If no timeline data, create placeholder
  if (timelineData.length === 0) {
    for (let i = 0; i < 30; i++) {
      timelineData.push({
        name: `Day ${i + 1}`,
        leads: 0,
        score: 0
      });
    }
  }

  // Dynamic color palette based on current theme
  const getChartColors = () => {
    if (currentTheme === 'excelr8') {
      return [
        '#6366F1', // Indigo-500 (Deep Purple/Indigo - primary)
        '#06B6D4', // Cyan-500 (Electric Blue/Cyan - secondary)
        '#818CF8', // Indigo-400 (Lighter Purple)
        '#22D3EE', // Cyan-400 (Lighter Blue)
        '#4F46E5', // Indigo-600 (Darker Purple)
        '#0891B2', // Cyan-600 (Darker Blue)
        '#A5B4FC', // Indigo-300
        '#67E8F9', // Cyan-300
        '#3B82F6', // Blue-500
        '#14B8A6', // Teal-500
        '#8B5CF6', // Purple-500
        '#6366F1'  // Indigo-500 (fallback)
      ];
    } else if (currentTheme === 'excelr82') {
      return [
        '#CCFF00', // Electric Green - Bright vibrant lime (punchy)
        '#00FF88', // Bright cyan-green (punchy)
        '#FF6B35', // Vibrant orange-red (punchy)
        '#FFD700', // Bright gold/yellow (punchy)
        '#00D4FF', // Bright cyan (punchy)
        '#FF00CC', // Bright magenta/pink (punchy)
        '#7ED321', // Vibrant green (punchy)
        '#FF1744', // Bright red (punchy)
        '#9C27B0', // Bright purple (punchy)
        '#00E676', // Bright green (punchy)
        '#FFC107', // Bright amber (punchy)
        '#CCFF00'  // Electric Green (fallback)
      ];
    } else if (currentTheme === 'upwork') {
      return [
        '#FF6B35', // Vibrant orange-red (punchy)
        '#00D4FF', // Bright cyan (punchy)
        '#FFD700', // Bright gold/yellow (punchy)
        '#FF00CC', // Bright magenta/pink (punchy)
        '#73BB44', // Upwork Primary Green
        '#00FF88', // Bright cyan-green (punchy)
        '#9C27B0', // Bright purple (punchy)
        '#FF1744', // Bright red (punchy)
        '#00E676', // Bright green (punchy)
        '#FFC107', // Bright amber (punchy)
        '#4FAB4A', // Secondary Green
        '#73BB44'  // Primary Green (fallback)
      ];
    } else if (currentTheme === 'testTheme1') {
      return [
        '#8b5cf6', // Purple-500
        '#a855f7', // Purple-400
        '#ec4899', // Pink-500
        '#f472b6', // Pink-400
        '#6366f1', // Indigo-500
        '#818cf8', // Indigo-400
        '#c084fc', // Purple-300
        '#d946ef', // Fuchsia-500
        '#f59e0b', // Amber (accent)
        '#10b981', // Emerald (accent)
        '#3b82f6', // Blue (accent)
        '#8b5cf6'  // Purple (fallback)
      ];
    } else {
      // Default theme
      return [
        '#06b6d4', // Cyan-500
        '#0891b2', // Cyan-600
        '#14b8a6', // Teal-500
        '#0d9488', // Teal-600
        '#22d3ee', // Cyan-400
        '#2dd4bf', // Teal-400
        '#67e8f9', // Cyan-300
        '#5eead4', // Teal-300
        '#8b5cf6', // Purple (accent)
        '#10b981', // Emerald (accent)
        '#3b82f6', // Blue (accent)
        '#06b6d4'  // Cyan (fallback)
      ];
    }
  };

  const COLORS = getChartColors();

  const StatCard = ({ title, value, icon: Icon, gradient, subtitle }) => {
    const { theme } = useTheme();
    // Use theme colors for gradient if not provided
    const gradientStyle = gradient 
      ? {} 
      : {
          background: `linear-gradient(to bottom right, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`,
          boxShadow: `0 10px 15px -3px ${theme.colors.shadow}`
        };
    
    // For Excelr8 2.0 and Upwork, use black text on white background
    const isExcelr82 = currentTheme === 'excelr82';
    const isUpwork = currentTheme === 'upwork';
    const isLightTheme = isExcelr82 || isUpwork;
    const textColor = theme.colors.textPrimary; // Black for Excelr8 2.0 and Upwork
    const numberColor = isLightTheme ? '#000000' : '#FFFFFF'; // Black numbers on white background for light themes
    const subtitleColor = theme.colors.textTertiary;
    const iconColor = isLightTheme ? '#000000' : '#FFFFFF'; // Black icons on white background for light themes
    
    return (
      <div className="card card-hover animate-fadeIn">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium mb-2 uppercase tracking-wide" style={{ color: subtitleColor }}>{title}</p>
            <h3 className="text-4xl font-bold mb-2" style={{ color: numberColor }}>{value}</h3>
            {subtitle && <p className="text-sm" style={{ color: subtitleColor }}>{subtitle}</p>}
          </div>
          <div 
            className={`p-4 rounded-xl shadow-lg flex-shrink-0 ${gradient ? `bg-gradient-to-br ${gradient}` : ''}`}
            style={gradientStyle}
          >
            <Icon className="w-7 h-7" style={{ color: isLightTheme ? '#000000' : iconColor }} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center animate-slideInLeft">
        <div>
          <h1 className="text-5xl font-bold text-gradient mb-3">
            Dashboard
          </h1>
          <p className="text-lg" style={{ color: currentTheme === 'excelr82' ? '#4A4A4A' : '#D1D5DB' }}>Overview of your AI automation analytics</p>
        </div>
        <div className="flex items-center space-x-3 animate-slideInRight">
          {/* Theme Buttons */}
          <div className="flex items-center space-x-2 bg-[#1a1a1a]/80 backdrop-blur-xl rounded-xl p-2 border border-gray-700/50">
            <Palette className="w-4 h-4 text-gray-400" />
            <button
              onClick={() => setTheme('excelr8')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 ${
                currentTheme === 'excelr8'
                  ? 'bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-lg shadow-indigo-500/50'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
              title="Excelr8 Theme - Deep Purple/Indigo with Electric Blue/Cyan"
              style={
                currentTheme === 'excelr8'
                  ? {
                      background: 'linear-gradient(to right, #6366F1, #06B6D4)',
                      boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.5)'
                    }
                  : {}
              }
            >
              EXCELR8 Theme
            </button>
            <button
              onClick={() => setTheme('excelr82')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 ${
                currentTheme === 'excelr82'
                  ? 'shadow-lg font-bold'
                  : 'text-gray-400'
              }`}
              title="Excelr8 2.0 Theme - White background, black text, electric green accents"
              style={
                currentTheme === 'excelr82'
                  ? {
                      background: '#CCFF00', // Electric Green for buttons
                      boxShadow: '0 10px 15px -3px rgba(204, 255, 0, 0.5)',
                      color: '#000000' // Black text on electric green
                    }
                  : {
                      border: '1px solid rgba(204, 255, 0, 0.2)', // Electric green border
                      color: '#9CA3AF'
                    }
              }
              onMouseEnter={(e) => {
                if (currentTheme !== 'excelr82') {
                  e.currentTarget.style.background = '#CCFF00'; // Electric green on hover
                  e.currentTarget.style.color = '#000000';
                  e.currentTarget.style.borderColor = 'rgba(204, 255, 0, 0.5)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(204, 255, 0, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                if (currentTheme !== 'excelr82') {
                  e.currentTarget.style.background = '';
                  e.currentTarget.style.color = '#9CA3AF';
                  e.currentTarget.style.borderColor = 'rgba(204, 255, 0, 0.2)';
                  e.currentTarget.style.boxShadow = '';
                }
              }}
            >
              EXCELR8 2.0 Theme
            </button>
            <button
              onClick={() => setTheme('testTheme1')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 ${
                currentTheme === 'testTheme1'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
              title="Test Theme 1 - Purple/Pink Modern AI Theme"
            >
              Test Theme1
            </button>
            <button
              onClick={() => setTheme('upwork')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 ${
                currentTheme === 'upwork'
                  ? 'shadow-lg font-bold'
                  : 'text-gray-400'
              }`}
              title="Upwork Theme - Professional Green Palette"
              style={
                currentTheme === 'upwork'
                  ? {
                      background: '#73BB44', // Upwork Primary Green
                      boxShadow: '0 10px 15px -3px rgba(115, 187, 68, 0.5)',
                      color: '#FFFFFF' // White text on green
                    }
                  : {
                      border: '1px solid rgba(115, 187, 68, 0.2)', // Upwork green border
                      color: '#9CA3AF'
                    }
              }
              onMouseEnter={(e) => {
                if (currentTheme !== 'upwork') {
                  e.currentTarget.style.background = '#73BB44'; // Upwork green on hover
                  e.currentTarget.style.color = '#FFFFFF';
                  e.currentTarget.style.borderColor = 'rgba(115, 187, 68, 0.5)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(115, 187, 68, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                if (currentTheme !== 'upwork') {
                  e.currentTarget.style.background = '';
                  e.currentTarget.style.color = '#9CA3AF';
                  e.currentTarget.style.borderColor = 'rgba(115, 187, 68, 0.2)';
                  e.currentTarget.style.boxShadow = '';
                }
              }}
            >
              Upwork
            </button>
            <button
              onClick={() => setTheme('default')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 ${
                currentTheme === 'default'
                  ? 'bg-gradient-to-r from-cyan-600 to-teal-500 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
              title="Default Theme - Cyan/Teal"
            >
              Default
            </button>
          </div>
          <button
            onClick={fetchData}
            disabled={refreshing}
            className="btn-primary flex items-center space-x-2"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="animate-slideInUp" style={{ animationDelay: '0.1s' }}>
          <StatCard
            title="Total Leads"
            value={stats?.total || 0}
            icon={Users}
            subtitle="All time"
          />
        </div>
        <div className="animate-slideInUp" style={{ animationDelay: '0.2s' }}>
          <StatCard
            title="With Dossiers"
            value={stats?.withDossiers || 0}
            icon={FileText}
            subtitle={`${stats?.total ? Math.round((stats.withDossiers / stats.total) * 100) : 0}% of total`}
          />
        </div>
        <div className="animate-slideInUp" style={{ animationDelay: '0.3s' }}>
          <StatCard
            title="Average Score"
            value={stats?.averageScore ? stats.averageScore.toFixed(1) : 'N/A'}
            icon={TrendingUp}
            subtitle="Lead quality score"
          />
        </div>
        <div className="animate-slideInUp" style={{ animationDelay: '0.4s' }}>
          <StatCard
            title="Data Source"
            value="Supabase"
            icon={Database}
            subtitle="PostgreSQL Database"
          />
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="card animate-slideInLeft">
          <h3 className="text-2xl font-bold mb-6" style={{ color: (currentTheme === 'excelr82' || currentTheme === 'upwork') ? '#000000' : '#FFFFFF' }}>Leads by Status</h3>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={false}
                outerRadius={110}
                fill="#8884d8"
                dataKey="value"
                strokeWidth={2}
                stroke="#1a1a1a"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value, name) => [`${value} leads`, name]}
                contentStyle={{ 
                  backgroundColor: theme.colors.bgAccent, 
                  border: `2px solid ${theme.colors.borderHover}`,
                  borderRadius: '12px',
                  color: (currentTheme === 'excelr82' || currentTheme === 'upwork') ? '#000000' : theme.colors.textPrimary,
                  boxShadow: `0 10px 40px ${theme.colors.shadow}`,
                  padding: '12px'
                }}
                labelStyle={{ color: (currentTheme === 'excelr82' || currentTheme === 'upwork') ? '#000000' : theme.colors.primaryLight, fontWeight: '600' }}
                itemStyle={{ color: (currentTheme === 'excelr82' || currentTheme === 'upwork') ? '#000000' : theme.colors.textPrimary }}
              />
              <Legend 
                verticalAlign="middle" 
                align="right"
                layout="vertical"
                iconType="circle"
                wrapperStyle={{ paddingLeft: '20px' }}
                formatter={(value, entry) => {
                  const percentage = (entry.payload.value / stats.total) * 100;
                  const displayPercentage = percentage < 1 
                    ? '<1%' 
                    : percentage < 10 
                    ? percentage.toFixed(1) + '%'
                    : percentage.toFixed(0) + '%';
                  return (
                    <span style={{ color: (currentTheme === 'excelr82' || currentTheme === 'upwork') ? '#000000' : '#e5e7eb', fontSize: '14px' }}>
                      {value}: <strong>{entry.payload.value}</strong> ({displayPercentage})
                    </span>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Tier Distribution */}
        <div className="card animate-slideInRight">
          <h3 className="text-2xl font-bold mb-6" style={{ color: (currentTheme === 'excelr82' || currentTheme === 'upwork') ? '#000000' : '#FFFFFF' }}>Leads by Tier</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={tierData}>
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={theme.colors.gradientFrom} stopOpacity={1}/>
                  <stop offset="100%" stopColor={theme.colors.gradientTo} stopOpacity={0.8}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.borderLight} />
              <XAxis 
                dataKey="name" 
                stroke={(currentTheme === 'excelr82' || currentTheme === 'upwork') ? '#000000' : theme.colors.textSecondary} 
                tick={{ 
                  fill: (currentTheme === 'excelr82' || currentTheme === 'upwork') ? '#000000' : theme.colors.textSecondary,
                  style: { 
                    fontSize: '14px', 
                    fontWeight: '500',
                    fill: (currentTheme === 'excelr82' || currentTheme === 'upwork') ? '#000000' : theme.colors.textSecondary
                  }
                }}
              />
              <YAxis 
                stroke={(currentTheme === 'excelr82' || currentTheme === 'upwork') ? '#000000' : theme.colors.textSecondary}
                tick={{ 
                  fill: (currentTheme === 'excelr82' || currentTheme === 'upwork') ? '#000000' : theme.colors.textSecondary,
                  style: { 
                    fontSize: '14px',
                    fill: (currentTheme === 'excelr82' || currentTheme === 'upwork') ? '#000000' : theme.colors.textSecondary
                  }
                }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: theme.colors.bgAccent, 
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '12px',
                  color: (currentTheme === 'excelr82' || currentTheme === 'upwork') ? '#000000' : theme.colors.textPrimary,
                  boxShadow: `0 10px 40px ${theme.colors.shadow}`
                }}
                cursor={{ fill: theme.colors.borderLight }}
              />
              <Bar 
                dataKey="value" 
                fill="url(#barGradient)" 
                radius={[12, 12, 0, 0]}
                maxBarSize={80}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="card animate-slideInFromBottom">
        <h3 className="text-2xl font-bold mb-6" style={{ color: (currentTheme === 'excelr82' || currentTheme === 'upwork') ? '#000000' : '#FFFFFF' }}>Lead Growth Timeline</h3>
        <ResponsiveContainer width="100%" height={380}>
          <LineChart data={timelineData}>
            <defs>
              <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={theme.colors.primary} stopOpacity={0.3}/>
                <stop offset="100%" stopColor={theme.colors.primary} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.borderLight} />
            <XAxis 
              dataKey="name" 
              stroke={(currentTheme === 'excelr82' || currentTheme === 'upwork') ? '#000000' : theme.colors.textSecondary}
              tick={{ 
                fill: (currentTheme === 'excelr82' || currentTheme === 'upwork') ? '#000000' : theme.colors.textSecondary,
                style: { 
                  fontSize: '13px',
                  fill: (currentTheme === 'excelr82' || currentTheme === 'upwork') ? '#000000' : theme.colors.textSecondary
                }
              }}
            />
            <YAxis 
              yAxisId="right" 
              orientation="right" 
              stroke={(currentTheme === 'excelr82' || currentTheme === 'upwork') ? '#000000' : theme.colors.primaryLight}
              tick={{ 
                fill: (currentTheme === 'excelr82' || currentTheme === 'upwork') ? '#000000' : theme.colors.primaryLight,
                style: { 
                  fontSize: '13px',
                  fill: (currentTheme === 'excelr82' || currentTheme === 'upwork') ? '#000000' : theme.colors.primaryLight
                }
              }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: theme.colors.bgAccent, 
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '12px',
                color: currentTheme === 'excelr82' ? '#000000' : theme.colors.textPrimary,
                boxShadow: `0 10px 40px ${theme.colors.shadow}`
              }}
            />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="line"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="score"
              stroke={theme.colors.primary}
              strokeWidth={3}
              dot={{ fill: theme.colors.primary, r: 6, strokeWidth: 2, stroke: theme.colors.bgAccent }}
              activeDot={{ r: 8, fill: theme.colors.primaryLight }}
              name="Lead Score"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Leads */}
      <div className="card animate-slideHorizontal">
        <h3 className="text-2xl font-bold mb-6" style={{ color: (currentTheme === 'excelr82' || currentTheme === 'upwork') ? '#000000' : '#FFFFFF' }}>Recent Leads</h3>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th style={{ color: (currentTheme === 'excelr82' || currentTheme === 'upwork') ? '#000000' : undefined }}>Name</th>
                <th style={{ color: (currentTheme === 'excelr82' || currentTheme === 'upwork') ? '#000000' : undefined }}>Company</th>
                <th style={{ color: (currentTheme === 'excelr82' || currentTheme === 'upwork') ? '#000000' : undefined }}>Status</th>
                <th style={{ color: (currentTheme === 'excelr82' || currentTheme === 'upwork') ? '#000000' : undefined }}>Tier</th>
                <th style={{ color: (currentTheme === 'excelr82' || currentTheme === 'upwork') ? '#000000' : undefined }}>Score</th>
                <th style={{ color: (currentTheme === 'excelr82' || currentTheme === 'upwork') ? '#000000' : undefined }}>Dossier</th>
              </tr>
            </thead>
            <tbody>
              {leads.filter(isValidLead).slice(0, 10).map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <div className="flex items-center space-x-3">
                      {lead.profile_picture_url ? (
                        <img
                          src={lead.profile_picture_url}
                          alt={lead.full_name}
                          className="w-10 h-10 rounded-full border-2 object-cover"
                          style={{ borderColor: theme.colors.border }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            const fallback = e.target.nextSibling;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shadow-lg ${lead.profile_picture_url ? 'hidden' : ''}`}
                        style={{
                          background: `linear-gradient(to bottom right, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`,
                          boxShadow: `0 10px 15px -3px ${theme.colors.shadow}`,
                          color: (currentTheme === 'excelr82' || currentTheme === 'upwork') ? '#000000' : '#FFFFFF'
                        }}
                      >
                        {getInitials(lead.full_name)}
                      </div>
                      <span className="font-semibold" style={{ color: (currentTheme === 'excelr82' || currentTheme === 'upwork') ? '#000000' : '#FFFFFF' }}>{lead.full_name}</span>
                    </div>
                  </td>
                  <td style={{ color: (currentTheme === 'excelr82' || currentTheme === 'upwork') ? '#000000' : '#D1D5DB' }}>{lead.company_name || '-'}</td>
                  <td>
                    <span className="badge badge-blue" style={{ color: (currentTheme === 'excelr82' || currentTheme === 'upwork') ? '#000000' : undefined }}>
                      {lead.status || 'New'}
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-cyan" style={{ color: (currentTheme === 'excelr82' || currentTheme === 'upwork') ? '#000000' : undefined }}>
                      {lead.tier || 'Standard'}
                    </span>
                  </td>
                  <td>
                    <span className="font-bold text-lg" style={{ color: (currentTheme === 'excelr82' || currentTheme === 'upwork') ? '#000000' : '#FFFFFF' }}>{lead.score || '-'}</span>
                  </td>
                  <td>
                    {lead.is_dossier && lead.dossier_url ? (
                      <a
                        href={lead.dossier_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 px-3 py-1 bg-green-500/30 rounded-lg hover:bg-green-500/40 transition-colors text-xs font-semibold border border-green-400/60"
                        style={{ color: (currentTheme === 'excelr82' || currentTheme === 'upwork') ? '#000000' : '#86EFAC' }}
                        title="View Dossier"
                      >
                        <FileText className="w-3 h-3" />
                        <span>View</span>
                      </a>
                    ) : lead.is_dossier ? (
                      <span className="font-medium" style={{ color: (currentTheme === 'excelr82' || currentTheme === 'upwork') ? '#000000' : '#4ADE80' }}>✓</span>
                    ) : (
                      <span style={{ color: (currentTheme === 'excelr82' || currentTheme === 'upwork') ? '#000000' : '#6B7280' }}>-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}