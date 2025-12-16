import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Users, FileText, TrendingUp, Database, RefreshCw } from 'lucide-react';
import { leadQueries } from '../lib/supabase';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [leads, setLeads] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const [statsData, leadsData] = await Promise.all([
        leadQueries.getStats(),
        leadQueries.getAll()
      ]);
      setStats(statsData);
      setLeads(leadsData);
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

  // Timeline data
  const timelineData = leads.slice(0, 30).reverse().map((lead, index) => ({
    name: `Day ${index + 1}`,
    leads: index + 1,
    score: lead.score || 0
  }));

  const COLORS = ['#06b6d4', '#14b8a6', '#22d3ee', '#2dd4bf', '#0891b2', '#0d9488', '#5eead4', '#67e8f9', '#99f6e4', '#ccfbf1'];

  const StatCard = ({ title, value, icon: Icon, gradient, subtitle }) => (
    <div className="card card-hover animate-fadeIn">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-gray-300 text-sm font-medium mb-2 uppercase tracking-wide">{title}</p>
          <h3 className="text-4xl font-bold text-white mb-2">{value}</h3>
          {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
        </div>
        <div className={`p-4 rounded-xl bg-gradient-to-br ${gradient} shadow-lg flex-shrink-0`}>
          <Icon className="w-7 h-7 text-white" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center animate-slideInLeft">
        <div>
          <h1 className="text-5xl font-bold text-gradient mb-3">
            Dashboard
          </h1>
          <p className="text-gray-300 text-lg">Overview of your AI automation analytics</p>
        </div>
        <button
          onClick={fetchData}
          disabled={refreshing}
          className="btn-primary flex items-center space-x-2 animate-slideInRight"
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="animate-slideInUp" style={{ animationDelay: '0.1s' }}>
          <StatCard
            title="Total Leads"
            value={stats?.total || 0}
            icon={Users}
            gradient="from-cyan-600 to-teal-600"
            subtitle="All time"
          />
        </div>
        <div className="animate-slideInUp" style={{ animationDelay: '0.2s' }}>
          <StatCard
            title="With Dossiers"
            value={stats?.withDossiers || 0}
            icon={FileText}
            gradient="from-cyan-500 to-teal-500"
            subtitle={`${stats?.total ? Math.round((stats.withDossiers / stats.total) * 100) : 0}% of total`}
          />
        </div>
        <div className="animate-slideInUp" style={{ animationDelay: '0.3s' }}>
          <StatCard
            title="Average Score"
            value={stats?.averageScore ? stats.averageScore.toFixed(1) : 'N/A'}
            icon={TrendingUp}
            gradient="from-teal-600 to-cyan-600"
            subtitle="Lead quality score"
          />
        </div>
        <div className="animate-slideInUp" style={{ animationDelay: '0.4s' }}>
          <StatCard
            title="Data Sources"
            value="2"
            icon={Database}
            gradient="from-cyan-700 to-teal-700"
            subtitle="Supabase & Airtable"
          />
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="card animate-slideInLeft">
          <h3 className="text-2xl font-bold text-white mb-6">Leads by Status</h3>
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
                  backgroundColor: '#1a1a1a', 
                  border: '2px solid rgba(6, 182, 212, 0.6)',
                  borderRadius: '12px',
                  color: '#ffffff',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
                  padding: '12px'
                }}
                labelStyle={{ color: '#a5f3fc', fontWeight: '600' }}
                itemStyle={{ color: '#ffffff' }}
              />
              <Legend 
                verticalAlign="middle" 
                align="right"
                layout="vertical"
                iconType="circle"
                wrapperStyle={{ paddingLeft: '20px' }}
                formatter={(value, entry) => (
                  <span style={{ color: '#e5e7eb', fontSize: '14px' }}>
                    {value}: <strong>{entry.payload.value}</strong> ({((entry.payload.value / stats.total) * 100).toFixed(0)}%)
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Tier Distribution */}
        <div className="card animate-slideInRight">
          <h3 className="text-2xl font-bold text-white mb-6">Leads by Tier</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={tierData}>
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={1}/>
                  <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.8}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(6, 182, 212, 0.2)" />
              <XAxis 
                dataKey="name" 
                stroke="#d1d5db" 
                style={{ fontSize: '14px', fontWeight: '500' }}
              />
              <YAxis 
                stroke="#d1d5db"
                style={{ fontSize: '14px' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1a1a1a', 
                  border: '1px solid rgba(6, 182, 212, 0.5)',
                  borderRadius: '12px',
                  color: '#fff',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                }}
                cursor={{ fill: 'rgba(6, 182, 212, 0.1)' }}
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
        <h3 className="text-2xl font-bold text-white mb-6">Lead Growth Timeline</h3>
        <ResponsiveContainer width="100%" height={380}>
          <LineChart data={timelineData}>
            <defs>
              <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.3}/>
                <stop offset="100%" stopColor="#06b6d4" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(6, 182, 212, 0.2)" />
            <XAxis 
              dataKey="name" 
              stroke="#d1d5db"
              style={{ fontSize: '13px' }}
            />
            <YAxis 
              yAxisId="right" 
              orientation="right" 
              stroke="#a5f3fc"
              style={{ fontSize: '13px' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1a1a1a', 
                border: '1px solid rgba(6, 182, 212, 0.5)',
                borderRadius: '12px',
                color: '#fff',
                boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
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
              stroke="#06b6d4"
              strokeWidth={3}
              dot={{ fill: '#06b6d4', r: 6, strokeWidth: 2, stroke: '#1a1a1a' }}
              activeDot={{ r: 8, fill: '#22d3ee' }}
              name="Lead Score"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Leads */}
      <div className="card animate-slideHorizontal">
        <h3 className="text-2xl font-bold text-white mb-6">Recent Leads</h3>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th>Status</th>
                <th>Tier</th>
                <th>Score</th>
                <th>Dossier</th>
              </tr>
            </thead>
            <tbody>
              {leads.slice(0, 10).map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <div className="flex items-center space-x-3">
                      {lead.profile_picture_url ? (
                        <img
                          src={lead.profile_picture_url}
                          alt={lead.full_name}
                          className="w-10 h-10 rounded-full border-2 border-cyan-500/30"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-600 to-teal-600 flex items-center justify-center text-white text-sm font-semibold shadow-lg">
                          {lead.full_name?.charAt(0) || '?'}
                        </div>
                      )}
                      <span className="font-semibold text-white">{lead.full_name}</span>
                    </div>
                  </td>
                  <td className="text-gray-300">{lead.company_name || '-'}</td>
                  <td>
                    <span className="badge badge-blue">
                      {lead.status || 'New'}
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-cyan">
                      {lead.tier || 'Standard'}
                    </span>
                  </td>
                  <td>
                    <span className="font-bold text-white text-lg">{lead.score || '-'}</span>
                  </td>
                  <td>
                    {lead.is_dossier && lead.dossier_url ? (
                      <a
                        href={lead.dossier_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 px-3 py-1 bg-green-500/30 text-green-200 rounded-lg hover:bg-green-500/40 transition-colors text-xs font-semibold border border-green-400/60"
                        title="View Dossier"
                      >
                        <FileText className="w-3 h-3" />
                        <span>View</span>
                      </a>
                    ) : lead.is_dossier ? (
                      <span className="text-green-400 font-medium">✓</span>
                    ) : (
                      <span className="text-gray-600">-</span>
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