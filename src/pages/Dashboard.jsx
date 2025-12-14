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

  // Timeline data - leads created over time
  const timelineData = leads.slice(0, 30).reverse().map((lead, index) => ({
    name: `Day ${index + 1}`,
    leads: index + 1,
    score: lead.score || 0
  }));

  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#f97316', '#84cc16', '#a855f7', '#ef4444'];

  const StatCard = ({ title, value, icon: Icon, gradient, subtitle }) => (
    <div className="card hover:shadow-xl transition-shadow duration-300">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-600 text-sm font-medium mb-1">{title}</p>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">{value}</h3>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg bg-gradient-to-br ${gradient}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
            Dashboard
          </h1>
          <p className="text-gray-600 text-lg">Overview of your AI automation analytics</p>
        </div>
        <button
          onClick={fetchData}
          disabled={refreshing}
          className="btn-primary flex items-center space-x-2"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Leads"
          value={stats?.total || 0}
          icon={Users}
          gradient="from-blue-500 to-blue-600"
          subtitle="All time"
        />
        <StatCard
          title="With Dossiers"
          value={stats?.withDossiers || 0}
          icon={FileText}
          gradient="from-purple-500 to-purple-600"
          subtitle={`${stats?.total ? Math.round((stats.withDossiers / stats.total) * 100) : 0}% of total`}
        />
        <StatCard
          title="Average Score"
          value={stats?.averageScore ? stats.averageScore.toFixed(1) : 'N/A'}
          icon={TrendingUp}
          gradient="from-pink-500 to-pink-600"
          subtitle="Lead quality score"
        />
        <StatCard
          title="Data Sources"
          value="2"
          icon={Database}
          gradient="from-indigo-500 to-indigo-600"
          subtitle="Supabase & Airtable"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="card">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Leads by Status</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={false}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [`${value} leads`, name]} />
              <Legend 
                verticalAlign="middle" 
                align="right"
                layout="vertical"
                iconType="circle"
                formatter={(value, entry) => `${value}: ${entry.payload.value} (${((entry.payload.value / stats.total) * 100).toFixed(0)}%)`}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Tier Distribution */}
        <div className="card">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Leads by Tier</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={tierData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="card">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Lead Growth Timeline</h3>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={timelineData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="leads"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: '#3b82f6', r: 4 }}
              name="Cumulative Leads"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="score"
              stroke="#ec4899"
              strokeWidth={2}
              dot={{ fill: '#ec4899', r: 4 }}
              name="Lead Score"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Leads */}
      <div className="card">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Recent Leads</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Company</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Tier</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Score</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Dossier</th>
              </tr>
            </thead>
            <tbody>
              {leads.slice(0, 10).map((lead) => (
                <tr key={lead.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-3">
                      {lead.profile_picture_url ? (
                        <img
                          src={lead.profile_picture_url}
                          alt={lead.full_name}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-sm font-semibold">
                          {lead.full_name?.charAt(0) || '?'}
                        </div>
                      )}
                      <span className="font-medium text-gray-900">{lead.full_name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-600">{lead.company_name || '-'}</td>
                  <td className="py-3 px-4">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                      {lead.status || 'New'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                      {lead.tier || 'Standard'}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-semibold text-gray-900">{lead.score || '-'}</td>
                  <td className="py-3 px-4">
                    {lead.is_dossier && lead.dossier_url ? (
                      <a
                        href={lead.dossier_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 px-3 py-1 bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors text-xs font-medium"
                        title="View Dossier"
                      >
                        <FileText className="w-3 h-3" />
                        <span>View</span>
                      </a>
                    ) : lead.is_dossier ? (
                      <span className="text-green-600 font-medium">✓</span>
                    ) : (
                      <span className="text-gray-400">-</span>
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