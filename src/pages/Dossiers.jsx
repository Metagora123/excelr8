import React, { useState, useEffect } from 'react';
import { FileText, Download, ExternalLink, Search, Filter, User, Building, Mail, Phone, MapPin, Star, Calendar, RefreshCw, Tag } from 'lucide-react';
import { leadQueries } from '../lib/supabase';
import { format } from 'date-fns';
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

// DossierCard component - must be outside to use hooks
const DossierCard = ({ dossier, onSelect }) => {
  const { currentTheme } = useTheme();
  const [imageError, setImageError] = useState(false);
  const isLightTheme = currentTheme === 'excelr82' || currentTheme === 'upwork';
  
  return (
    <div
      className="card card-hover cursor-pointer"
      onClick={() => onSelect(dossier)}
    >
      <div className="flex items-start space-x-4">
        {/* Profile Picture */}
        <div className="flex-shrink-0">
          {dossier.profile_picture_url && !imageError ? (
            <img
              src={dossier.profile_picture_url}
              alt={dossier.full_name}
              className="w-16 h-16 rounded-full object-cover border-2 border-cyan-500/30"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-600 to-teal-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
              {getInitials(dossier.full_name)}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="text-xl font-bold mb-1" style={{ color: isLightTheme ? '#000000' : '#FFFFFF' }}>{dossier.full_name}</h3>
              <p className="text-sm" style={{ color: isLightTheme ? '#4A4A4A' : '#D1D5DB' }}>{dossier.title || 'No title'}</p>
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
              <div className="flex items-center space-x-2 text-sm" style={{ color: isLightTheme ? '#000000' : '#D1D5DB' }}>
                <Building className="w-4 h-4" />
                <span>{dossier.company_name}</span>
              </div>
            )}
            {dossier.location && (
              <div className="flex items-center space-x-2 text-sm" style={{ color: isLightTheme ? '#000000' : '#D1D5DB' }}>
                <MapPin className="w-4 h-4" />
                <span>{dossier.location}</span>
              </div>
            )}
            {dossier.email && (
              <div className="flex items-center space-x-2 text-sm" style={{ color: isLightTheme ? '#000000' : '#D1D5DB' }}>
                <Mail className="w-4 h-4" />
                <span className="truncate">{dossier.email}</span>
              </div>
            )}
            {dossier.phone && (
              <div className="flex items-center space-x-2 text-sm" style={{ color: isLightTheme ? '#000000' : '#D1D5DB' }}>
                <Phone className="w-4 h-4" />
                <span>{dossier.phone}</span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2 mb-3 flex-wrap">
            {dossier.tier && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold border" style={{ 
                backgroundColor: isLightTheme ? 'rgba(0, 0, 0, 0.05)' : 'rgba(55, 65, 81, 0.5)',
                color: isLightTheme ? '#000000' : '#E5E7EB',
                borderColor: isLightTheme ? 'rgba(0, 0, 0, 0.2)' : 'rgba(75, 85, 99, 0.6)'
              }}>
                {dossier.tier}
              </span>
            )}
            {dossier.status && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold border" style={{ 
                backgroundColor: isLightTheme ? 'rgba(115, 187, 68, 0.1)' : 'rgba(6, 182, 212, 0.3)',
                color: isLightTheme ? '#000000' : '#A5F3FC',
                borderColor: isLightTheme ? 'rgba(115, 187, 68, 0.3)' : 'rgba(6, 182, 212, 0.6)'
              }}>
                {dossier.status}
              </span>
            )}
            {(dossier.keywords || dossier.tech_stack_tags) && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold border flex items-center space-x-1" style={{ 
                backgroundColor: isLightTheme ? 'rgba(115, 187, 68, 0.1)' : 'rgba(6, 182, 212, 0.3)',
                color: isLightTheme ? '#000000' : '#A5F3FC',
                borderColor: isLightTheme ? 'rgba(115, 187, 68, 0.3)' : 'rgba(6, 182, 212, 0.6)'
              }}>
                <Tag className="w-3 h-3" />
                <span>{dossier.keywords || dossier.tech_stack_tags?.split(',')[0]?.trim() || 'Keywords'}</span>
              </span>
            )}
            {dossier.created_at && (
              <span className="text-xs flex items-center space-x-1" style={{ color: isLightTheme ? '#6B6B6B' : '#6B7280' }}>
                <Calendar className="w-3 h-3" />
                <span>{format(new Date(dossier.created_at), 'MMM dd, yyyy')}</span>
              </span>
            )}
          </div>

          {dossier.about_summary && (
            <p className="text-sm line-clamp-2 mb-3" style={{ color: isLightTheme ? '#000000' : '#D1D5DB' }}>{dossier.about_summary}</p>
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
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-500 text-white rounded-lg hover:from-cyan-500 hover:to-teal-400 transition-all duration-200 text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </a>
                <a
                  href={dossier.dossier_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium"
                  style={{
                    backgroundColor: isLightTheme ? 'rgba(0, 0, 0, 0.05)' : 'rgba(31, 41, 55, 0.5)',
                    color: isLightTheme ? '#000000' : '#D1D5DB'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(55, 65, 81, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isLightTheme ? 'rgba(0, 0, 0, 0.05)' : 'rgba(31, 41, 55, 0.5)';
                  }}
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
};

// DossierModal component - must be outside to use hooks
  const DossierModal = ({ dossier, onClose }) => {
  const [imageError, setImageError] = useState(false);
  
    if (!dossier) return null;

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 px-8 py-6 flex justify-between items-start z-10">
          <div className="flex items-center space-x-5">
            {dossier.profile_picture_url && !imageError ? (
                <img
                  src={dossier.profile_picture_url}
                  alt={dossier.full_name}
                className="w-24 h-24 rounded-full object-cover border-4 border-cyan-500/30 shadow-lg"
                onError={() => setImageError(true)}
                />
              ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-600 to-teal-500 flex items-center justify-center text-white text-4xl font-bold shadow-lg">
                {getInitials(dossier.full_name)}
                </div>
              )}
              <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-1">{dossier.full_name}</h2>
              {dossier.title && (
                <p className="text-lg text-gray-600 font-medium">{dossier.title}</p>
              )}
              </div>
            </div>
            <button
              onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-3xl font-light w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close"
            >
              ×
            </button>
          </div>

        <div className="px-8 py-8">
          {/* Contact Information */}
          <div className="bg-gray-50 rounded-xl p-6 mb-8">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dossier.company_name && (
                <div className="flex items-start space-x-3">
                  <Building className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Company</p>
                    <p className="text-base font-medium text-gray-900">{dossier.company_name}</p>
                  </div>
                </div>
              )}
              {dossier.location && (
                <div className="flex items-start space-x-3">
                  <MapPin className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Location</p>
                    <p className="text-base font-medium text-gray-900">{dossier.location}</p>
                  </div>
                </div>
              )}
              {dossier.email && (
                <div className="flex items-start space-x-3">
                  <Mail className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Email</p>
                    <p className="text-base font-medium text-gray-900 break-all">{dossier.email}</p>
                  </div>
                </div>
              )}
              {dossier.phone && (
                <div className="flex items-start space-x-3">
                  <Phone className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Phone</p>
                    <p className="text-base font-medium text-gray-900">{dossier.phone}</p>
                  </div>
                </div>
              )}
            </div>
            </div>

          {/* Status Badges */}
          <div className="flex items-center flex-wrap gap-3 mb-8">
              {dossier.tier && (
              <span className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700 border border-gray-300">
                  Tier: {dossier.tier}
                </span>
              )}
              {dossier.status && (
              <span className="px-4 py-2 rounded-lg text-sm font-semibold bg-green-50 text-green-700 border border-green-200">
                  Status: {dossier.status}
                </span>
              )}
              {dossier.score && (
              <span className="px-4 py-2 rounded-lg text-sm font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200 flex items-center space-x-2">
                  <Star className="w-4 h-4 fill-yellow-500" />
                  <span>Score: {dossier.score}</span>
                </span>
              )}
            </div>

            {/* About Summary */}
            {dossier.about_summary && (
            <div className="mb-8">
              <h3 className="text-xl font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">About</h3>
              <p className="text-base text-gray-700 leading-relaxed">{dossier.about_summary}</p>
              </div>
            )}

            {/* Personality */}
            {dossier.personality && (
            <div className="mb-8">
              <h3 className="text-xl font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">Personality</h3>
              <p className="text-base text-gray-700 leading-relaxed">{dossier.personality}</p>
              </div>
            )}

            {/* Expertise */}
            {dossier.expertise && (
            <div className="mb-8">
              <h3 className="text-xl font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">Expertise</h3>
              <p className="text-base text-gray-700 leading-relaxed">{dossier.expertise}</p>
              </div>
            )}

            {/* Tech Stack */}
            {dossier.tech_stack_tags && (
            <div className="mb-8">
              <h3 className="text-xl font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">Tech Stack</h3>
                <div className="flex flex-wrap gap-2">
                  {dossier.tech_stack_tags.split(',').map((tag, index) => (
                  <span key={index} className="px-4 py-2 bg-cyan-50 text-cyan-700 rounded-lg text-sm font-medium border border-cyan-200">
                      {tag.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Company Description */}
            {dossier.company_description && (
            <div className="mb-8">
              <h3 className="text-xl font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">Company Overview</h3>
              <p className="text-base text-gray-700 leading-relaxed">{dossier.company_description}</p>
              </div>
            )}

            {/* Social Stats */}
            {(dossier.followers_count || dossier.connections_count) && (
            <div className="mb-8 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Social Reach</h3>
              <div className="flex space-x-8">
                  {dossier.followers_count && (
                    <div>
                    <p className="text-3xl font-bold text-gray-900 mb-1">{dossier.followers_count.toLocaleString()}</p>
                    <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Followers</p>
                    </div>
                  )}
                  {dossier.connections_count && (
                    <div>
                    <p className="text-3xl font-bold text-gray-900 mb-1">{dossier.connections_count.toLocaleString()}</p>
                    <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Connections</p>
                    </div>
                  )}
                </div>
              </div>
            )}

          {/* Action Buttons */}
            {dossier.dossier_url && (
            <div className="flex gap-3 pt-4 border-t border-gray-200">
                <a
                  href={dossier.dossier_url}
                  target="_blank"
                  rel="noopener noreferrer"
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-teal-600 text-white rounded-lg hover:from-cyan-700 hover:to-teal-700 transition-all duration-200 font-semibold shadow-md hover:shadow-lg"
                >
                  <Download className="w-5 h-5" />
                  <span>Download Dossier</span>
                </a>
                {dossier.profile_url && (
                  <a
                    href={dossier.profile_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  className="flex items-center space-x-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-200 font-semibold border border-gray-300"
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

export default function Dossiers() {
  const { currentTheme } = useTheme();
  const isLightTheme = currentTheme === 'excelr82' || currentTheme === 'upwork';
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center animate-slideInLeft">
        <div>
          <h1 className="text-4xl font-bold text-gradient mb-2">
            Dossiers
          </h1>
          <p className="text-lg" style={{ color: isLightTheme ? '#4A4A4A' : '#D1D5DB' }}>View and manage lead dossiers ({filteredDossiers.length} total)</p>
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
          <h3 className="text-xl font-semibold mb-2" style={{ color: isLightTheme ? '#000000' : '#FFFFFF' }}>No dossiers found</h3>
          <p style={{ color: isLightTheme ? '#6B6B6B' : '#9CA3AF' }}>Try adjusting your filters or search term</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredDossiers.map((dossier, index) => (
            <div key={dossier.id} className="animate-slideInUp" style={{ animationDelay: `${index * 0.1}s` }}>
              <DossierCard dossier={dossier} onSelect={setSelectedDossier} />
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
