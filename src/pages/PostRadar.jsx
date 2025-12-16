import React, { useState } from 'react';
import { Search, Loader2, ExternalLink, MessageCircle, ThumbsUp, Users, Building2, Tag, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function PostRadar() {
  const [postUrl, setPostUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [postData, setPostData] = useState(null);
  const [source, setSource] = useState(null); // 'supabase' or 'unipile'
  const [error, setError] = useState(null);

  const extractPostId = (url) => {
    // Extract activity ID from various LinkedIn URL formats
    
    // Format 1: urn:li:activity:XXXXXXXXXX
    const urnActivityMatch = url.match(/urn:li:activity:(\d+)/);
    if (urnActivityMatch) return urnActivityMatch[1];
    
    // Format 2: urn:li:ugcPost:XXXXXXXXXX
    const urnUgcMatch = url.match(/urn:li:ugcPost:(\d+)/);
    if (urnUgcMatch) return urnUgcMatch[1];
    
    // Format 3: activity-XXXXXXXXXX (from feed URLs)
    const activityDashMatch = url.match(/activity-(\d+)/);
    if (activityDashMatch) return activityDashMatch[1];
    
    // Format 4: ugcPost-XXXXXXXXXX (from post URLs)
    const ugcDashMatch = url.match(/ugcPost-(\d+)/);
    if (ugcDashMatch) return ugcDashMatch[1];
    
    // Format 5: /posts/username_text-activity-XXXXXXXXXX-XXXX (new format)
    const postsActivityMatch = url.match(/\/posts\/[^\/]+-activity-(\d+)/);
    if (postsActivityMatch) return postsActivityMatch[1];
    
    // Format 6: /posts/username_text-ugcPost-XXXXXXXXXX-XXXX
    const postsUgcMatch = url.match(/\/posts\/[^\/]+-ugcPost-(\d+)/);
    if (postsUgcMatch) return postsUgcMatch[1];
    
    return null;
  };

  const searchSupabase = async (postId) => {
    // Try both URN formats
    const activityUrn = `urn:li:activity:${postId}`;
    const ugcUrn = `urn:li:ugcPost:${postId}`;

    console.log('Searching Supabase for:', { postId, activityUrn, ugcUrn });

    // Try activity URN in linkedin_post_id
    let { data, error } = await supabase
      .from('lead_posts')
      .select('*')
      .eq('linkedin_post_id', activityUrn)
      .maybeSingle();

    if (data) {
      console.log('Found with activity URN in linkedin_post_id:', data);
      return data;
    }

    // Try ugc URN in linkedin_post_id
    ({ data, error } = await supabase
      .from('lead_posts')
      .select('*')
      .eq('linkedin_post_id', ugcUrn)
      .maybeSingle());

    if (data) {
      console.log('Found with ugc URN in linkedin_post_id:', data);
      return data;
    }

    // Try searching in post_url (for reposts where URL has different ID)
    // Search for activity-XXXXXX in the URL
    ({ data, error } = await supabase
      .from('lead_posts')
      .select('*')
      .ilike('post_url', `%activity-${postId}%`)
      .maybeSingle());

    if (data) {
      console.log('Found by searching post_url with activity-:', data);
      return data;
    }

    // Search for ugcPost-XXXXXX in the URL
    ({ data, error } = await supabase
      .from('lead_posts')
      .select('*')
      .ilike('post_url', `%ugcPost-${postId}%`)
      .maybeSingle());

    if (data) {
      console.log('Found by searching post_url with ugcPost-:', data);
      return data;
    }

    console.log('Not found in Supabase');
    return null;
  };

  const fetchFromUnipile = async (postId) => {
    const apiKey = import.meta.env.VITE_UNIPILE_API_KEY;
    const accountId = import.meta.env.VITE_UNIPILE_ACCOUNT_ID;
    
    if (!apiKey || !accountId) {
      throw new Error('Unipile API credentials not configured');
    }

    const urn = `urn:li:activity:${postId}`;
    const encodedUrn = encodeURIComponent(urn);
    
    // Fetch post data
    const postResponse = await fetch(
      `https://api17.unipile.com:14713/api/v1/posts/${encodedUrn}?account_id=${accountId}`,
      {
        headers: {
          'X-API-KEY': apiKey,
          'accept': 'application/json'
        }
      }
    );

    if (!postResponse.ok) {
      throw new Error(`Unipile API error: ${postResponse.statusText}`);
    }

    const postData = await postResponse.json();

    // Fetch comments
    let comments = [];
    try {
      const commentsResponse = await fetch(
        `https://api17.unipile.com:14713/api/v1/posts/${encodedUrn}/comments?account_id=${accountId}`,
        {
          headers: {
            'X-API-KEY': apiKey,
            'accept': 'application/json'
          }
        }
      );
      if (commentsResponse.ok) {
        const commentsData = await commentsResponse.json();
        comments = commentsData.items || [];
      }
    } catch (err) {
      console.error('Error fetching comments:', err);
    }

    // Fetch reactions
    let reactions = [];
    try {
      const reactionsResponse = await fetch(
        `https://api17.unipile.com:14713/api/v1/posts/${encodedUrn}/reactions?account_id=${accountId}`,
        {
          headers: {
            'X-API-KEY': apiKey,
            'accept': 'application/json'
          }
        }
      );
      if (reactionsResponse.ok) {
        const reactionsData = await reactionsResponse.json();
        reactions = reactionsData.items || [];
      }
    } catch (err) {
      console.error('Error fetching reactions:', err);
    }

    return { postData, comments, reactions };
  };

  const normalizeSupabaseData = (data) => {
    return {
      id: data.id,
      leadName: data.lead_name,
      leadCompany: data.lead_company,
      content: data.content,
      reactions: data.reactions || 0,
      comments: data.comments || 0,
      postUrl: data.post_url,
      topic: data.topic,
      status: data.status,
      isRepost: data.is_repost,
      commentators: data.commentators,
      reactioners: data.reactioners,
      createdAt: data.created_at,
      linkedinPostId: data.linkedin_post_id
    };
  };

  const normalizeUnipileData = (data, comments = [], reactions = []) => {
    return {
      id: data.id,
      leadName: data.author?.name || 'Unknown',
      leadCompany: data.author?.headline || '-',
      content: data.text,
      reactions: data.reaction_counter || 0,
      comments: data.comment_counter || 0,
      postUrl: data.share_url,
      topic: '-',
      status: 'external',
      isRepost: data.is_repost,
      commentators: comments.map(c => ({
        name: c.author,
        headline: c.author_details?.headline,
        profile_url: c.author_details?.profile_url,
        text: c.text,
        date: c.date
      })),
      reactioners: reactions.map(r => ({
        name: r.author?.name,
        headline: r.author?.headline,
        profile_url: r.author?.profile_url,
        reaction_type: r.value
      })),
      createdAt: data.parsed_datetime || data.date,
      linkedinPostId: data.social_id,
      impressions: data.impressions_counter,
      reposts: data.repost_counter,
      authorId: data.author?.public_identifier,
      attachments: data.attachments
    };
  };

  const handleSearch = async () => {
    if (!postUrl.trim()) {
      setError('Please enter a LinkedIn post URL');
      return;
    }

    setLoading(true);
    setError(null);
    setPostData(null);
    setSource(null);

    try {
      const postId = extractPostId(postUrl);
      
      if (!postId) {
        setError('Invalid LinkedIn post URL. Please check the format.');
        setLoading(false);
        return;
      }

      // Try Supabase first
      const supabaseData = await searchSupabase(postId);
      
      if (supabaseData) {
        setPostData(normalizeSupabaseData(supabaseData));
        setSource('supabase');
      } else {
        // Fall back to Unipile
        const { postData: unipileData, comments, reactions } = await fetchFromUnipile(postId);
        setPostData(normalizeUnipileData(unipileData, comments, reactions));
        setSource('unipile');
      }
    } catch (err) {
      console.error('Error fetching post:', err);
      setError(err.message || 'Failed to fetch post data');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="animate-slideInLeft">
        <h1 className="text-4xl font-bold text-gradient mb-2">
          Post Radar
        </h1>
        <p className="text-gray-300 text-lg">Track and analyze LinkedIn posts from your leads</p>
      </div>

      {/* Search Bar */}
      <div className="card animate-slideInUp">
        <div className="space-y-4">
          <label className="block text-sm font-semibold text-gray-300">
            LinkedIn Post URL
          </label>
          <div className="flex space-x-3">
            <input
              type="text"
              value={postUrl}
              onChange={(e) => setPostUrl(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="https://www.linkedin.com/feed/update/urn:li:activity:7346827663526744065/"
              className="input-field flex-1"
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="btn-primary flex items-center space-x-2 px-6"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  <span>Search</span>
                </>
              )}
            </button>
          </div>
          <p className="text-sm text-gray-400">
            Paste a LinkedIn post URL to check if it exists in your database or fetch it from LinkedIn
          </p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="card bg-red-900/30 border border-red-500/50 animate-slideInUp">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-200">Error</h3>
              <p className="text-red-300">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Post Data Display */}
      {postData && (
        <div className="space-y-6 animate-slideHorizontal">
          {/* Source Badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                source === 'supabase' 
                  ? 'bg-cyan-600/30 text-cyan-200 border border-cyan-500/60' 
                  : 'bg-teal-600/30 text-teal-200 border border-teal-500/60'
              }`}>
                {source === 'supabase' ? '✓ Found in Database' : '↓ Fetched from LinkedIn'}
              </span>
              {postData.status && (
                <span className="px-3 py-1 rounded-full text-sm font-semibold bg-gray-700/50 text-gray-200 border border-gray-600">
                  {postData.status}
                </span>
              )}
            </div>
            <a
              href={postData.postUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 text-cyan-300 hover:text-cyan-200 font-medium"
            >
              <span>View on LinkedIn</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {/* Author Info */}
          <div className="card animate-slideInLeft">
            <div className="flex items-start justify-between">
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-600 to-teal-600 flex items-center justify-center text-white text-xl font-semibold">
                    {postData.leadName?.charAt(0) || '?'}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">{postData.leadName}</h2>
                    <p className="text-gray-300 flex items-center space-x-2">
                      <Building2 className="w-4 h-4" />
                      <span>{postData.leadCompany}</span>
                    </p>
                  </div>
                </div>
                {postData.topic && postData.topic !== '-' && (
                  <div className="flex items-center space-x-2 text-sm">
                    <Tag className="w-4 h-4 text-gray-400" />
                    <span className="px-3 py-1 rounded-full bg-gray-800/50 text-gray-200 border border-gray-700 font-medium">
                      {postData.topic}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Post Content */}
          <div className="card animate-slideInRight">
            <h3 className="text-lg font-semibold text-white mb-3">Post Content</h3>
            <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">{postData.content}</p>
            
            {postData.attachments && postData.attachments.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                {postData.attachments.map((attachment, idx) => (
                  <img
                    key={idx}
                    src={attachment.url}
                    alt="Post attachment"
                    className="rounded-lg w-full object-cover"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Engagement Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card text-center animate-slideInUp" style={{ animationDelay: '0.1s' }}>
              <div className="flex justify-center mb-2">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-600 to-teal-600 rounded-full flex items-center justify-center">
                  <ThumbsUp className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-3xl font-bold text-white">{postData.reactions}</p>
              <p className="text-sm text-gray-300">Reactions</p>
            </div>

            <div className="card text-center animate-slideInUp" style={{ animationDelay: '0.2s' }}>
              <div className="flex justify-center mb-2">
                <div className="w-12 h-12 bg-gradient-to-br from-teal-600 to-cyan-600 rounded-full flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-3xl font-bold text-white">{postData.comments}</p>
              <p className="text-sm text-gray-300">Comments</p>
            </div>

            {postData.impressions !== undefined && (
              <div className="card text-center animate-slideInUp" style={{ animationDelay: '0.3s' }}>
                <div className="flex justify-center mb-2">
                  <div className="w-12 h-12 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-white">{postData.impressions}</p>
                <p className="text-sm text-gray-300">Impressions</p>
              </div>
            )}

            {postData.reposts !== undefined && (
              <div className="card text-center animate-slideInUp" style={{ animationDelay: '0.4s' }}>
                <div className="flex justify-center mb-2">
                  <div className="w-12 h-12 bg-gradient-to-br from-cyan-600 to-teal-600 rounded-full flex items-center justify-center">
                    <ExternalLink className="w-6 h-6 text-white" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-white">{postData.reposts}</p>
                <p className="text-sm text-gray-300">Reposts</p>
              </div>
            )}
          </div>

          {/* Commentators & Reactioners */}
          {(postData.commentators || postData.reactioners) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {postData.commentators && postData.commentators.length > 0 && (
                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                    <MessageCircle className="w-5 h-5 text-blue-600" />
                    <span>Commentators ({postData.commentators.length})</span>
                  </h3>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {postData.commentators.map((person, idx) => (
                      <div key={idx} className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              {person.profile_url ? (
                                <a
                                  href={person.profile_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-semibold text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                                >
                                  <span>{person.name || 'Unknown'}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                <p className="font-semibold text-gray-900">{person.name || 'Unknown'}</p>
                              )}
                            </div>
                            {person.headline && (
                              <p className="text-sm text-gray-600 mb-2">{person.headline}</p>
                            )}
                            {person.profile_url && (
                              <p className="text-xs text-gray-500 mb-2 font-mono break-all">
                                {person.profile_url}
                              </p>
                            )}
                            {person.text && (
                              <p className="text-sm text-gray-700 italic bg-white p-2 rounded border-l-2 border-blue-300">
                                "{person.text}"
                              </p>
                            )}
                            {person.date && (
                              <p className="text-xs text-gray-500 mt-2">
                                {new Date(person.date).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {postData.reactioners && postData.reactioners.length > 0 && (
                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                    <ThumbsUp className="w-5 h-5 text-pink-600" />
                    <span>Reactioners ({postData.reactioners.length})</span>
                  </h3>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {postData.reactioners.map((person, idx) => (
                      <div key={idx} className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              {person.profile_url ? (
                                <a
                                  href={person.profile_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-semibold text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                                >
                                  <span>{person.name || 'Unknown'}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                <p className="font-semibold text-gray-900">{person.name || 'Unknown'}</p>
                              )}
                              {person.reaction_type && (
                                <span className="px-2 py-1 text-xs rounded-full bg-pink-100 text-pink-700 font-medium">
                                  {person.reaction_type.toLowerCase()}
                                </span>
                              )}
                            </div>
                            {person.headline && (
                              <p className="text-sm text-gray-600 mb-2">{person.headline}</p>
                            )}
                            {person.profile_url && (
                              <p className="text-xs text-gray-500 font-mono break-all">
                                {person.profile_url}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Metadata */}
          <div className="card bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Post Metadata</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Post ID:</span>
                <p className="font-mono text-gray-900 break-all">{postData.linkedinPostId}</p>
              </div>
              <div>
                <span className="text-gray-600">Created:</span>
                <p className="text-gray-900">
                  {postData.createdAt ? new Date(postData.createdAt).toLocaleString() : 'N/A'}
                </p>
              </div>
              {postData.isRepost !== undefined && (
                <div>
                  <span className="text-gray-600">Is Repost:</span>
                  <p className="text-gray-900">{postData.isRepost ? 'Yes' : 'No'}</p>
                </div>
              )}
              {postData.authorId && (
                <div>
                  <span className="text-gray-600">Author ID:</span>
                  <p className="font-mono text-gray-900 break-all">{postData.authorId}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}