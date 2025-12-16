import React, { useState, useEffect } from 'react';
import { FileText, Download, ExternalLink, Search, Filter, User, Building, Mail, Phone, MapPin, Star, Calendar, RefreshCw } from 'lucide-react';
import { leadQueries } from '../lib/supabase';
import { format } from 'date-fns';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Dossiers() {
  const [loading, setLoading] = useState(true);
  const [dossiers, setDossiers] = useState([]);
  const [filteredDossiers, setFilteredDossiers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTier, setFilterTier] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedDossier, setSelectedDossier] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDossiers = async () => {
    try {
      setRefreshing(true);
      const data = await leadQueries.getWithDossiers();
      setDossiers(data);
      setFilteredDossiers(data);
    } catch (error) {
      console.error('Error fetching dossiers:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDossiers();
  }, []);

  useEffect(() => {
    let filtered = dossiers;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(d =>
        d.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Tier filter
    if (filterTier !== 'all') {
      filtered = filtered.filter(d => d.tier === filterTier);
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(d => d.status === filterStatus);
    }

    setFilteredDossiers(filtered);
  }, [searchTerm, filterTier, filterStatus, dossiers]);

  if (loading) {
    return <LoadingSpinner text="Loading dossiers..." />;
  }

  const DossierCard = ({ dossier }) => (
    <div
      className="card card-hover cursor-pointer"
      onClick={() => setSelectedDossier(dossier)}
    >
      <div className="flex items-start space-x-4">
        {/* Profile Picture */}
        <div className="flex-shrink-0">
          {dossier.profile_picture_url ? (
            <img
              src={dossier.profile_picture_url}
              alt={dossier.full_name}
              className="w-16 h-16 rounded-full object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-600 to-teal-600 flex items-center justify-center text-white text-2xl font-bold">
              {dossier.full_name?.charAt(0) || '?'}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">{dossier.full_name}</h3>
              <p className="text-sm text-gray-300">{dossier.title || 'No title'}</p>
            </div>
            {dossier.score && (
              <div className="flex items-center space-x-1 bg-yellow-50 px-3 py-1 rounded-full">
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                <span className="text-sm font-semibold text-yellow-700">{dossier.score}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
            {dossier.company_name && (
              <div className="flex items-center space-x-2 text-sm text-gray-300">
                <Building className="w-4 h-4" />
                <span>{dossier.company_name}</span>
              </div>
            )}
            {dossier.location && (
              <div className="flex items-center space-x-2 text-sm text-gray-300">
                <MapPin className="w-4 h-4" />
                <span>{dossier.location}</span>
              </div>
            )}
            {dossier.email && (
              <div className="flex items-center space-x-2 text-sm text-gray-300">
                <Mail className="w-4 h-4" />
                <span className="truncate">{dossier.email}</span>
              </div>
            )}
            {dossier.phone && (
              <div className="flex items-center space-x-2 text-sm text-gray-300">
                <Phone className="w-4 h-4" />
                <span>{dossier.phone}</span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2 mb-3">
            {dossier.tier && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-700/50 text-gray-200 border border-gray-600">
                {dossier.tier}
              </span>
            )}
            {dossier.status && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-cyan-600/30 text-cyan-200 border border-cyan-500/60">
                {dossier.status}
              </span>
            )}
            {dossier.created_at && (
              <span className="text-xs text-gray-500 flex items-center space-x-1">
                <Calendar className="w-3 h-3" />
                <span>{format(new Date(dossier.created_at), 'MMM dd, yyyy')}</span>
              </span>
            )}
          </div>

          {dossier.about_summary && (
            <p className="text-sm text-gray-300 line-clamp-2 mb-3">{dossier.about_summary}</p>
          )}

          {/* Dossier Actions */}
          <div className="flex items-center space-x-2">
            {dossier.dossier_url && (
              <>
                <a
                  href={dossier.dossier_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-600 text-white rounded-lg hover:from-cyan-500 hover:to-teal-500 transition-all duration-200 text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </a>
                <a
                  href={dossier.dossier_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-800/50 text-gray-300 rounded-lg hover:bg-gray-700/50 transition-all duration-200 text-sm font-medium"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>View</span>
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const DossierModal = ({ dossier, onClose }) => {
    if (!dossier) return null;

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-start">
            <div className="flex items-center space-x-4">
              {dossier.profile_picture_url ? (
                <img
                  src={dossier.profile_picture_url}
                  alt={dossier.full_name}
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-600 to-teal-600 flex items-center justify-center text-white text-3xl font-bold">
                  {dossier.full_name?.charAt(0) || '?'}
                </div>
              )}
              <div>
                <h2 className="text-3xl font-bold text-gray-900">{dossier.full_name}</h2>
                <p className="text-gray-600">{dossier.title}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dossier.company_name && (
                <div className="flex items-center space-x-3">
                  <Building className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Company</p>
                    <p className="text-sm font-medium text-gray-900">{dossier.company_name}</p>
                  </div>
                </div>
              )}
              {dossier.location && (
                <div className="flex items-center space-x-3">
                  <MapPin className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Location</p>
                    <p className="text-sm font-medium text-gray-900">{dossier.location}</p>
                  </div>
                </div>
              )}
              {dossier.email && (
                <div className="flex items-center space-x-3">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-sm font-medium text-gray-900">{dossier.email}</p>
                  </div>
                </div>
              )}
              {dossier.phone && (
                <div className="flex items-center space-x-3">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Phone</p>
                    <p className="text-sm font-medium text-gray-900">{dossier.phone}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Status and Tier */}
            <div className="flex items-center space-x-2">
              {dossier.tier && (
                <span className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-700/50 text-gray-200 border border-gray-600">
                  Tier: {dossier.tier}
                </span>
              )}
              {dossier.status && (
                <span className="px-4 py-2 rounded-lg text-sm font-semibold bg-green-600/30 text-green-200 border border-green-500/60">
                  Status: {dossier.status}
                </span>
              )}
              {dossier.score && (
                <span className="px-4 py-2 rounded-lg text-sm font-semibold bg-yellow-100 text-yellow-700 flex items-center space-x-1">
                  <Star className="w-4 h-4 fill-yellow-500" />
                  <span>Score: {dossier.score}</span>
                </span>
              )}
            </div>

            {/* About Summary */}
            {dossier.about_summary && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">About</h3>
                <p className="text-gray-700 leading-relaxed">{dossier.about_summary}</p>
              </div>
            )}

            {/* Personality */}
            {dossier.personality && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Personality</h3>
                <p className="text-gray-700 leading-relaxed">{dossier.personality}</p>
              </div>
            )}

            {/* Expertise */}
            {dossier.expertise && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Expertise</h3>
                <p className="text-gray-700 leading-relaxed">{dossier.expertise}</p>
              </div>
            )}

            {/* Tech Stack */}
            {dossier.tech_stack_tags && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Tech Stack</h3>
                <div className="flex flex-wrap gap-2">
                  {dossier.tech_stack_tags.split(',').map((tag, index) => (
                    <span key={index} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                      {tag.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Company Description */}
            {dossier.company_description && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Company Overview</h3>
                <p className="text-gray-700 leading-relaxed">{dossier.company_description}</p>
              </div>
            )}

            {/* Social Stats */}
            {(dossier.followers_count || dossier.connections_count) && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Social Reach</h3>
                <div className="flex space-x-6">
                  {dossier.followers_count && (
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{dossier.followers_count.toLocaleString()}</p>
                      <p className="text-sm text-gray-600">Followers</p>
                    </div>
                  )}
                  {dossier.connections_count && (
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{dossier.connections_count.toLocaleString()}</p>
                      <p className="text-sm text-gray-600">Connections</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Dossier Link */}
            {dossier.dossier_url && (
              <div className="flex space-x-2">
                <a
                  href={dossier.dossier_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 font-medium"
                >
                  <Download className="w-5 h-5" />
                  <span>Download Dossier</span>
                </a>
                {dossier.profile_url && (
                  <a
                    href={dossier.profile_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-200 font-medium"
                  >
                    <User className="w-5 h-5" />
                    <span>View Profile</span>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center animate-slideInLeft">
        <div>
          <h1 className="text-4xl font-bold text-gradient mb-2">
            Dossiers
          </h1>
          <p className="text-gray-300 text-lg">View and manage lead dossiers ({filteredDossiers.length} total)</p>
        </div>
        <button
          onClick={fetchDossiers}
          disabled={refreshing}
          className="btn-primary flex items-center space-x-2"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters */}
      <div className="card animate-slideInUp">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, company, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field w-full pl-10 pr-4 py-3"
            />
          </div>

          {/* Tier Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={filterTier}
              onChange={(e) => setFilterTier(e.target.value)}
              className="input-field w-full pl-10 pr-4 py-3"
            >
              <option value="all">All Tiers</option>
              <option value="Gold">Gold</option>
              <option value="Silver">Silver</option>
              <option value="Bronze">Bronze</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input-field w-full pl-10 pr-4 py-3"
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="converted">Converted</option>
            </select>
          </div>
        </div>
      </div>

      {/* Dossiers Grid */}
      {filteredDossiers.length === 0 ? (
        <div className="card text-center py-12 animate-slideInUp">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No dossiers found</h3>
          <p className="text-gray-400">Try adjusting your filters or search term</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredDossiers.map((dossier, index) => (
            <div key={dossier.id} className="animate-slideInUp" style={{ animationDelay: `${index * 0.1}s` }}>
              <DossierCard dossier={dossier} />
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {selectedDossier && (
        <DossierModal dossier={selectedDossier} onClose={() => setSelectedDossier(null)} />
      )}
    </div>
  );
}
