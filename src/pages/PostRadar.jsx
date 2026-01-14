import React, { useState, useEffect } from 'react';
import { Search, Loader2, ExternalLink, MessageCircle, ThumbsUp, Users, Building2, Tag, AlertCircle, Download, Filter, Settings, X, CheckCircle, Sparkles, BarChart3 } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Default ICP configuration
const defaultICP = {
  companySize: [],
  industries: [],
  jobTitles: [],
  locations: [],
  revenueRange: [],
  techStack: [],
  additionalCriteria: ''
};

export default function PostRadar() {
  const [postUrl, setPostUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [postData, setPostData] = useState(null);
  const [source, setSource] = useState(null); // 'supabase' or 'unipile'
  const [error, setError] = useState(null);
  
  // ICP Filtering State
  const [icpConfig, setIcpConfig] = useState(defaultICP);
  const [showIcpModal, setShowIcpModal] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [matchResults, setMatchResults] = useState({}); // { profileUrl: { matchScore, reasoning, matchedCriteria } }
  const [isFilterActive, setIsFilterActive] = useState(false);
  const [filteredCommentators, setFilteredCommentators] = useState(null);
  const [filteredReactioners, setFilteredReactioners] = useState(null);
  const [batchSize, setBatchSize] = useState('all'); // '10', '20', '50', 'all'
  const [filterProgress, setFilterProgress] = useState({ current: 0, total: 0 });
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [matchThreshold, setMatchThreshold] = useState(50);

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
    // Reset filter when loading new post
    resetFilter();

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

  // Load ICP config from localStorage on mount
  useEffect(() => {
    const savedIcp = localStorage.getItem('icpConfig');
    if (savedIcp) {
      try {
        setIcpConfig(JSON.parse(savedIcp));
      } catch (err) {
        console.error('Error loading ICP config:', err);
      }
    }
  }, []);

  // Save ICP config to localStorage
  const saveIcpConfig = (config) => {
    localStorage.setItem('icpConfig', JSON.stringify(config));
    setIcpConfig(config);
  };

  // Check if ICP is configured
  const isIcpConfigured = () => {
    return (
      icpConfig.companySize.length > 0 ||
      icpConfig.industries.length > 0 ||
      icpConfig.jobTitles.length > 0 ||
      icpConfig.locations.length > 0 ||
      icpConfig.revenueRange.length > 0 ||
      icpConfig.techStack.length > 0 ||
      icpConfig.additionalCriteria.trim() !== ''
    );
  };

  // Process a single batch of people
  const processBatch = async (peopleBatch, batchIndex, totalBatches, apiKey, icpCriteria, allPeople) => {
    // Prepare people data for GPT
    const peopleData = peopleBatch.map((person, idx) => ({
      index: person.originalIndex,
      name: person.name || 'Unknown',
      headline: person.headline || '',
      profile_url: person.profile_url || '',
      text: person.text || person.reaction_type || '',
      type: person.type
    }));

    // Create prompt for GPT-4o
    const prompt = `You are an ICP (Ideal Customer Profile) matching expert. Evaluate each person below against the ICP criteria and provide a match score.

${icpCriteria}

People to evaluate:
${JSON.stringify(peopleData, null, 2)}

For each person, evaluate:
1. How well they match the ICP criteria based on their headline, name, and any available context
2. Provide a match score from 0-100 (0 = no match, 100 = perfect match)
3. Brief reasoning for the score
4. Which specific criteria they matched (if any)

Respond with a JSON object with a "results" array where each object has:
{
  "results": [
    {
      "index": number,
      "matchScore": number (0-100),
      "reasoning": "brief explanation",
      "matchedCriteria": ["criteria1", "criteria2"]
    }
  ]
}

Return ONLY valid JSON object, no markdown, no code blocks.`;

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at matching LinkedIn profiles to ICP criteria. Always respond with valid JSON object containing a "results" array.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse JSON response
    let results;
    try {
      const parsed = JSON.parse(content);
      if (parsed.results && Array.isArray(parsed.results)) {
        results = parsed.results;
      } else if (Array.isArray(parsed)) {
        results = parsed;
      } else {
        results = [parsed];
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Content:', content);
      const jsonMatch = content.match(/```(?:json)?\s*(\[.*?\]|\{.*?\})\s*```/s);
      if (jsonMatch) {
        try {
          const extracted = JSON.parse(jsonMatch[1]);
          results = Array.isArray(extracted) ? extracted : (extracted.results || [extracted]);
        } catch (e) {
          throw new Error('Failed to parse OpenAI response as JSON');
        }
      } else {
        throw new Error('Failed to parse OpenAI response as JSON');
      }
    }

    // Build match results for this batch
    const batchResults = {};
    console.log(`Processing batch ${batchIndex + 1}/${totalBatches}, ${peopleBatch.length} people`);
    console.log('Batch people sample:', peopleBatch.slice(0, 2).map(p => ({ name: p.name, profile_url: p.profile_url, originalIndex: p.originalIndex })));
    console.log('GPT results:', results.length, 'results received');
    
    results.forEach((result, resultIdx) => {
      // Find the person in the batch by matching the index from the result
      // First try to find by originalIndex, fallback to resultIdx if index doesn't match
      let personInBatch = peopleBatch.find(p => p.originalIndex === result.index);
      if (!personInBatch && resultIdx < peopleBatch.length) {
        // Fallback to position-based matching if index doesn't match
        personInBatch = peopleBatch[resultIdx];
        console.warn(`Index mismatch for result ${resultIdx}, using position-based matching. Expected index: ${result.index}, got: ${personInBatch?.originalIndex}`);
      }
      
      if (personInBatch) {
        if (!personInBatch.profile_url) {
          console.warn(`Person ${personInBatch.name} has no profile_url, skipping`);
          return;
        }
        batchResults[personInBatch.profile_url] = {
          matchScore: Math.min(100, Math.max(0, result.matchScore || 0)),
          reasoning: result.reasoning || 'No reasoning provided',
          matchedCriteria: result.matchedCriteria || []
        };
        console.log(`Matched ${personInBatch.name} (${personInBatch.profile_url}) with score ${batchResults[personInBatch.profile_url].matchScore}`);
      } else {
        console.error(`Could not find person for result index ${result.index} in batch`);
      }
    });

    console.log(`Batch ${batchIndex + 1} complete: ${Object.keys(batchResults).length} matches found`);
    return batchResults;
  };

  // OpenAI batch filtering function
  const filterByICP = async () => {
    if (!isIcpConfigured()) {
      alert('Please configure your ICP criteria first');
      setShowIcpModal(true);
      return;
    }

    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      setError('OpenAI API key not configured. Please add VITE_OPENAI_API_KEY to your .env file');
      return;
    }

    setIsFiltering(true);
    setError(null);

    try {
      // Combine all people (commentators + reactioners) with proper indexing
      const commentators = (postData.commentators || []).map((p, idx) => ({ ...p, type: 'commentator', originalIndex: idx }));
      const reactioners = (postData.reactioners || []).map((p, idx) => ({ ...p, type: 'reactioner', originalIndex: commentators.length + idx }));
      const allPeople = [...commentators, ...reactioners];

      if (allPeople.length === 0) {
        setError('No people to filter');
        setIsFiltering(false);
        return;
      }

      // Build ICP criteria string
      const icpCriteria = `
ICP Criteria:
${icpConfig.companySize.length > 0 ? `- Company Size: ${icpConfig.companySize.join(', ')}\n` : ''}
${icpConfig.industries.length > 0 ? `- Industries: ${icpConfig.industries.join(', ')}\n` : ''}
${icpConfig.jobTitles.length > 0 ? `- Job Titles: ${icpConfig.jobTitles.join(', ')}\n` : ''}
${icpConfig.locations.length > 0 ? `- Locations: ${icpConfig.locations.join(', ')}\n` : ''}
${icpConfig.revenueRange.length > 0 ? `- Revenue Range: ${icpConfig.revenueRange.join(', ')}\n` : ''}
${icpConfig.techStack.length > 0 ? `- Technology Stack: ${icpConfig.techStack.join(', ')}\n` : ''}
${icpConfig.additionalCriteria ? `- Additional Criteria: ${icpConfig.additionalCriteria}\n` : ''}
`.trim();

      // Determine batch size
      const batchSizeNum = batchSize === 'all' ? allPeople.length : parseInt(batchSize);
      
      // Split into batches
      const batches = [];
      for (let i = 0; i < allPeople.length; i += batchSizeNum) {
        batches.push(allPeople.slice(i, i + batchSizeNum));
      }

      setFilterProgress({ current: 0, total: batches.length });

      // Process batches sequentially
      const allMatchResults = {};
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        setFilterProgress({ current: i + 1, total: batches.length });
        
        const batchResults = await processBatch(batch, i, batches.length, apiKey, icpCriteria, allPeople);
        Object.assign(allMatchResults, batchResults);
        
        // Update match results progressively
        setMatchResults({ ...allMatchResults });
      }

      setMatchResults(allMatchResults);
      setIsFilterActive(true);

      // Debug logging
      console.log('Total match results:', Object.keys(allMatchResults).length);
      console.log('Sample match results:', Object.entries(allMatchResults).slice(0, 3));
      console.log('Commentators count:', postData.commentators?.length || 0);
      console.log('Reactioners count:', postData.reactioners?.length || 0);

      // Apply filtering - check for profile_url matches
      const filteredComm = (postData.commentators || []).filter(person => {
        if (!person.profile_url) {
          console.warn('Commentator missing profile_url:', person.name);
          return false;
        }
        const match = allMatchResults[person.profile_url];
        if (match) {
          console.log(`Commentator ${person.name}: score=${match.matchScore}`);
        }
        return match && match.matchScore >= matchThreshold;
      });

      const filteredReact = (postData.reactioners || []).filter(person => {
        if (!person.profile_url) {
          console.warn('Reactioner missing profile_url:', person.name);
          return false;
        }
        const match = allMatchResults[person.profile_url];
        if (match) {
          console.log(`Reactioner ${person.name}: score=${match.matchScore}`);
        }
        return match && match.matchScore >= matchThreshold;
      });

      console.log('Filtered commentators:', filteredComm.length);
      console.log('Filtered reactioners:', filteredReact.length);
      console.log('All match scores:', Object.values(allMatchResults).map(m => m.matchScore));

      setFilteredCommentators(filteredComm);
      setFilteredReactioners(filteredReact);
      setFilterProgress({ current: 0, total: 0 });

    } catch (err) {
      console.error('Error filtering by ICP:', err);
      setError(err.message || 'Failed to filter by ICP. Please check your OpenAI API key and try again.');
      setFilterProgress({ current: 0, total: 0 });
    } finally {
      setIsFiltering(false);
    }
  };

  // Reset filter
  const resetFilter = () => {
    setIsFilterActive(false);
    setFilteredCommentators(null);
    setFilteredReactioners(null);
    setMatchResults({});
  };

  // Calculate stats from match results
  const calculateStats = () => {
    const scores = Object.values(matchResults).map(m => m.matchScore);
    if (scores.length === 0) return null;

    const sortedScores = [...scores].sort((a, b) => b - a);
    const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const median = sortedScores[Math.floor(sortedScores.length / 2)];

    // Score distribution
    const distribution = {
      '0-20': scores.filter(s => s >= 0 && s <= 20).length,
      '21-40': scores.filter(s => s >= 21 && s <= 40).length,
      '41-60': scores.filter(s => s >= 41 && s <= 60).length,
      '61-80': scores.filter(s => s >= 61 && s <= 80).length,
      '81-100': scores.filter(s => s >= 81 && s <= 100).length,
    };

    // Get all people with their scores
    const allPeopleWithScores = [
      ...(postData.commentators || []).map(p => ({
        ...p,
        type: 'commentator',
        match: matchResults[p.profile_url]
      })),
      ...(postData.reactioners || []).map(p => ({
        ...p,
        type: 'reactioner',
        match: matchResults[p.profile_url]
      }))
    ].filter(p => p.match).sort((a, b) => (b.match?.matchScore || 0) - (a.match?.matchScore || 0));

    return {
      total: scores.length,
      avg: Math.round(avg),
      min,
      max,
      median,
      distribution,
      peopleWithScores: allPeopleWithScores,
      aboveThreshold: scores.filter(s => s >= matchThreshold).length
    };
  };

  // Apply new threshold
  const applyThreshold = () => {
    const allPeople = [
      ...(postData.commentators || []),
      ...(postData.reactioners || [])
    ];

    const filteredComm = (postData.commentators || []).filter(person => {
      const match = matchResults[person.profile_url];
      return match && match.matchScore >= matchThreshold;
    });

    const filteredReact = (postData.reactioners || []).filter(person => {
      const match = matchResults[person.profile_url];
      return match && match.matchScore >= matchThreshold;
    });

    setFilteredCommentators(filteredComm);
    setFilteredReactioners(filteredReact);
  };

  // Get match score for a person
  const getMatchScore = (profileUrl) => {
    return matchResults[profileUrl]?.matchScore || null;
  };

  // Get match badge color
  const getMatchBadgeColor = (score) => {
    if (score >= 80) return 'bg-green-500 text-white';
    if (score >= 60) return 'bg-yellow-500 text-white';
    if (score >= 50) return 'bg-orange-500 text-white';
    return 'bg-gray-400 text-white';
  };

  // CSV export helper function
  const escapeCSV = (value) => {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    // If value contains comma, quote, or newline, wrap in quotes and escape quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const downloadCSV = (data, filename) => {
    if (!data || data.length === 0) {
      alert('No data to download');
      return;
    }

    // Get all unique keys from all objects
    const allKeys = new Set();
    data.forEach(item => {
      Object.keys(item).forEach(key => allKeys.add(key));
    });
    const headers = Array.from(allKeys);

    // Create CSV content
    const csvRows = [];
    
    // Add header row
    csvRows.push(headers.map(escapeCSV).join(','));

    // Add data rows
    data.forEach(item => {
      const row = headers.map(header => {
        const value = item[header];
        // Handle dates
        if (value && (header === 'date' || header === 'createdAt')) {
          return escapeCSV(new Date(value).toISOString());
        }
        return escapeCSV(value);
      });
      csvRows.push(row.join(','));
    });

    // Create blob and download
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadCommentators = () => {
    if (!postData?.commentators || postData.commentators.length === 0) {
      alert('No commentators data available');
      return;
    }
    
    const filename = `commentators_${postData.linkedinPostId || 'post'}_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(postData.commentators, filename);
  };

  const handleDownloadReactioners = () => {
    if (!postData?.reactioners || postData.reactioners.length === 0) {
      alert('No reactioners data available');
      return;
    }
    
    const filename = `reactioners_${postData.linkedinPostId || 'post'}_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(postData.reactioners, filename);
  };

  // Options for ICP form
  const companySizeOptions = ['Startup (1-10)', 'SMB (11-50)', 'Mid-market (51-200)', 'Enterprise (201+)'];
  const industryOptions = ['Technology', 'Finance', 'Healthcare', 'Manufacturing', 'Retail', 'Education', 'Real Estate', 'Consulting', 'Marketing', 'Other'];
  const jobTitleOptions = ['CEO', 'CTO', 'VP Engineering', 'VP Sales', 'Director', 'Manager', 'Senior', 'Lead', 'Head of', 'Founder'];
  const locationOptions = ['North America', 'Europe', 'Asia', 'South America', 'Africa', 'Oceania'];
  const revenueOptions = ['<$1M', '$1M-$10M', '$10M-$50M', '$50M-$100M', '$100M+'];
  const techStackOptions = ['React', 'Python', 'AWS', 'Azure', 'GCP', 'Node.js', 'Java', '.NET', 'Docker', 'Kubernetes'];

  const toggleArrayItem = (array, item) => {
    if (array.includes(item)) {
      return array.filter(i => i !== item);
    }
    return [...array, item];
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 relative">
      {/* ICP Settings Floating Button */}
      <button
        onClick={() => setShowIcpModal(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center space-x-2 px-4 py-3 bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-700 hover:to-teal-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 animate-bounce-subtle"
        title="Configure ICP Filter"
      >
        <Sparkles className="w-5 h-5" />
        <span className="font-semibold">ICP Settings</span>
        {isIcpConfigured() && (
          <CheckCircle className="w-4 h-4 text-green-200" />
        )}
      </button>

      {/* ICP Configuration Modal */}
      {showIcpModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
            <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
                  <Filter className="w-6 h-6 text-cyan-400" />
                  <span>ICP Configuration</span>
                </h2>
                <p className="text-gray-400 text-sm mt-1">Define your Ideal Customer Profile criteria</p>
              </div>
              <button
                onClick={() => setShowIcpModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Company Size */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Company Size</label>
                <div className="flex flex-wrap gap-2">
                  {companySizeOptions.map(option => (
                    <button
                      key={option}
                      onClick={() => setIcpConfig({ ...icpConfig, companySize: toggleArrayItem(icpConfig.companySize, option) })}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        icpConfig.companySize.includes(option)
                          ? 'bg-cyan-600 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              {/* Industries */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Industries</label>
                <div className="flex flex-wrap gap-2">
                  {industryOptions.map(option => (
                    <button
                      key={option}
                      onClick={() => setIcpConfig({ ...icpConfig, industries: toggleArrayItem(icpConfig.industries, option) })}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        icpConfig.industries.includes(option)
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              {/* Job Titles */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Job Titles</label>
                <div className="flex flex-wrap gap-2">
                  {jobTitleOptions.map(option => (
                    <button
                      key={option}
                      onClick={() => setIcpConfig({ ...icpConfig, jobTitles: toggleArrayItem(icpConfig.jobTitles, option) })}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        icpConfig.jobTitles.includes(option)
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              {/* Locations */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Locations</label>
                <div className="flex flex-wrap gap-2">
                  {locationOptions.map(option => (
                    <button
                      key={option}
                      onClick={() => setIcpConfig({ ...icpConfig, locations: toggleArrayItem(icpConfig.locations, option) })}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        icpConfig.locations.includes(option)
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              {/* Revenue Range */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Revenue Range (Optional)</label>
                <div className="flex flex-wrap gap-2">
                  {revenueOptions.map(option => (
                    <button
                      key={option}
                      onClick={() => setIcpConfig({ ...icpConfig, revenueRange: toggleArrayItem(icpConfig.revenueRange, option) })}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        icpConfig.revenueRange.includes(option)
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tech Stack */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Technology Stack (Optional)</label>
                <div className="flex flex-wrap gap-2">
                  {techStackOptions.map(option => (
                    <button
                      key={option}
                      onClick={() => setIcpConfig({ ...icpConfig, techStack: toggleArrayItem(icpConfig.techStack, option) })}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        icpConfig.techStack.includes(option)
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              {/* Additional Criteria */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Additional Criteria (Optional)</label>
                <textarea
                  value={icpConfig.additionalCriteria}
                  onChange={(e) => setIcpConfig({ ...icpConfig, additionalCriteria: e.target.value })}
                  placeholder="Any other specific criteria or requirements..."
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={3}
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-900 border-t border-gray-700 p-6 flex items-center justify-between">
              <button
                onClick={() => {
                  setIcpConfig(defaultICP);
                  saveIcpConfig(defaultICP);
                }}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Reset
              </button>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowIcpModal(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    saveIcpConfig(icpConfig);
                    setShowIcpModal(false);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-700 hover:to-teal-600 text-white rounded-lg transition-colors font-semibold"
                >
                  Save ICP
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Modal */}
      {showStatsModal && (() => {
        const stats = calculateStats();
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
              <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
                    <BarChart3 className="w-6 h-6 text-cyan-400" />
                    <span>ICP Match Statistics</span>
                  </h2>
                  <p className="text-gray-400 text-sm mt-1">Detailed breakdown of match scores</p>
                </div>
                <button
                  onClick={() => setShowStatsModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {stats ? (
                  <>
                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                        <p className="text-xs text-gray-400 mb-1">Total Scored</p>
                        <p className="text-2xl font-bold text-white">{stats.total}</p>
                      </div>
                      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                        <p className="text-xs text-gray-400 mb-1">Average Score</p>
                        <p className="text-2xl font-bold text-cyan-400">{stats.avg}%</p>
                      </div>
                      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                        <p className="text-xs text-gray-400 mb-1">Highest Score</p>
                        <p className="text-2xl font-bold text-green-400">{stats.max}%</p>
                      </div>
                      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                        <p className="text-xs text-gray-400 mb-1">Lowest Score</p>
                        <p className="text-2xl font-bold text-red-400">{stats.min}%</p>
                      </div>
                    </div>

                    {/* Score Distribution */}
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">Score Distribution</h3>
                      <div className="space-y-2">
                        {Object.entries(stats.distribution).map(([range, count]) => {
                          const percentage = (count / stats.total) * 100;
                          const [min, max] = range.split('-').map(Number);
                          const colorClass = 
                            max <= 20 ? 'bg-red-500' :
                            max <= 40 ? 'bg-orange-500' :
                            max <= 60 ? 'bg-yellow-500' :
                            max <= 80 ? 'bg-green-500' : 'bg-emerald-500';
                          
                          return (
                            <div key={range} className="flex items-center space-x-3">
                              <div className="w-20 text-sm text-gray-300 font-medium">{range}%</div>
                              <div className="flex-1 bg-gray-800 rounded-full h-6 overflow-hidden">
                                <div 
                                  className={`h-full ${colorClass} transition-all duration-300 flex items-center justify-end pr-2`}
                                  style={{ width: `${percentage}%` }}
                                >
                                  {count > 0 && (
                                    <span className="text-xs text-white font-semibold">{count}</span>
                                  )}
                                </div>
                              </div>
                              <div className="w-12 text-sm text-gray-400 text-right">{count}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Threshold Adjustment */}
                    <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-white mb-3">Adjust Match Threshold</h3>
                      <div className="flex items-center space-x-4">
                        <div className="flex-1">
                          <label className="block text-sm text-gray-300 mb-2">
                            Minimum Score: {matchThreshold}%
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={matchThreshold}
                            onChange={(e) => setMatchThreshold(parseInt(e.target.value))}
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-gray-400 mt-1">
                            <span>0%</span>
                            <span>50%</span>
                            <span>100%</span>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            applyThreshold();
                            setShowStatsModal(false);
                          }}
                          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold transition-colors"
                        >
                          Apply
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        Currently showing {stats.aboveThreshold} people with {matchThreshold}%+ score
                      </p>
                    </div>

                    {/* All People with Scores */}
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">
                        All People ({stats.peopleWithScores.length})
                      </h3>
                      <div className="max-h-96 overflow-y-auto space-y-2">
                        {stats.peopleWithScores.map((person, idx) => {
                          const score = person.match?.matchScore || 0;
                          const scoreColor = 
                            score >= 80 ? 'text-green-400' :
                            score >= 60 ? 'text-yellow-400' :
                            score >= 40 ? 'text-orange-400' : 'text-red-400';
                          
                          return (
                            <div key={idx} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2">
                                    <span className="font-semibold text-white">{person.name || 'Unknown'}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                      person.type === 'commentator' 
                                        ? 'bg-blue-900/50 text-blue-300' 
                                        : 'bg-pink-900/50 text-pink-300'
                                    }`}>
                                      {person.type}
                                    </span>
                                  </div>
                                  {person.headline && (
                                    <p className="text-sm text-gray-400 mt-1">{person.headline}</p>
                                  )}
                                </div>
                                <div className="text-right">
                                  <div className={`text-2xl font-bold ${scoreColor}`}>
                                    {score}%
                                  </div>
                                  {person.match?.matchedCriteria && person.match.matchedCriteria.length > 0 && (
                                    <p className="text-xs text-gray-400 mt-1">
                                      Matched: {person.match.matchedCriteria.slice(0, 2).join(', ')}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-400">No statistics available. Run the ICP filter first.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

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

          {/* ICP Filter Section */}
          {(postData.commentators || postData.reactioners) && (
            <div className="card bg-gradient-to-r from-cyan-900/30 to-teal-900/30 border border-cyan-500/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Sparkles className="w-6 h-6 text-cyan-400" />
                  <div>
                    <h3 className="text-lg font-semibold text-white">ICP Filter</h3>
                    <p className="text-sm text-gray-300">
                      {isIcpConfigured() 
                        ? 'Filter reactioners and commentators by your ICP criteria'
                        : 'Configure your ICP criteria to filter results'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  {isFilterActive && (
                    <button
                      onClick={resetFilter}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Reset Filter
                    </button>
                  )}
                  <button
                    onClick={filterByICP}
                    disabled={isFiltering || !isIcpConfigured()}
                    className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-700 hover:to-teal-600 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors"
                  >
                    {isFiltering ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>
                          {filterProgress.total > 0 
                            ? `Filtering... (${filterProgress.current}/${filterProgress.total})`
                            : 'Filtering...'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Filter className="w-4 h-4" />
                        <span>Apply ICP Filter</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              {/* Batch Size Selector */}
              <div className="mt-4 pt-4 border-t border-cyan-500/30">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Batch Size
                    </label>
                    <p className="text-xs text-gray-400">
                      Process people in batches to control API costs
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {['10', '20', '50', 'all'].map((size) => (
                      <button
                        key={size}
                        onClick={() => setBatchSize(size)}
                        disabled={isFiltering}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          batchSize === size
                            ? 'bg-cyan-600 text-white'
                            : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {size === 'all' ? 'All' : size}
                      </button>
                    ))}
                  </div>
                </div>
                {isFiltering && filterProgress.total > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                      <span>Processing batches...</span>
                      <span>{filterProgress.current} / {filterProgress.total}</span>
                    </div>
                    <div className="w-full bg-gray-700/50 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-cyan-600 to-teal-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(filterProgress.current / filterProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {isFilterActive && !isFiltering && (
                <div className="mt-3 pt-3 border-t border-cyan-500/30">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm text-cyan-200">
                        Showing {((filteredCommentators?.length || 0) + (filteredReactioners?.length || 0))} of {((postData.commentators?.length || 0) + (postData.reactioners?.length || 0))} matches ({matchThreshold}%+ score)
                      </p>
                      {Object.keys(matchResults).length > 0 && (
                        <div className="text-xs text-gray-400 mt-1">
                          Total scored: {Object.keys(matchResults).length} | 
                          Avg score: {Math.round(Object.values(matchResults).reduce((sum, m) => sum + m.matchScore, 0) / Object.keys(matchResults).length)}%
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setShowStatsModal(true)}
                      className="flex items-center space-x-2 px-3 py-1.5 bg-cyan-600/50 hover:bg-cyan-600 text-white rounded-lg text-sm font-medium transition-colors border border-cyan-500/50"
                    >
                      <BarChart3 className="w-4 h-4" />
                      <span>View Stats</span>
                    </button>
                  </div>
                  {((filteredCommentators?.length || 0) + (filteredReactioners?.length || 0)) === 0 && Object.keys(matchResults).length > 0 && (
                    <p className="text-xs text-yellow-300">
                      ⚠️ All match scores are below {matchThreshold}%. Click "View Stats" to see score distribution.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Commentators & Reactioners */}
          {(postData.commentators || postData.reactioners) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {postData.commentators && postData.commentators.length > 0 && (
                <div className="card">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                      <MessageCircle className="w-5 h-5 text-blue-400" />
                      <span>
                        Commentators ({isFilterActive ? filteredCommentators?.length || 0 : postData.commentators.length})
                      </span>
                    </h3>
                    <button
                      onClick={handleDownloadCommentators}
                      className="flex items-center space-x-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                      title="Download commentators as CSV"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download CSV</span>
                    </button>
                  </div>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {(isFilterActive ? filteredCommentators || [] : postData.commentators || []).map((person, idx) => {
                      const matchScore = getMatchScore(person.profile_url);
                      return (
                        <div key={idx} className={`p-4 rounded-lg transition-colors ${
                          isFilterActive && matchScore !== null
                            ? matchScore >= 80 ? 'bg-green-900/40 border-2 border-green-400' 
                              : matchScore >= 60 ? 'bg-yellow-900/40 border-2 border-yellow-400'
                              : 'bg-orange-900/40 border-2 border-orange-400'
                            : 'bg-gray-800/60 hover:bg-gray-700/60 border border-gray-700'
                        }`}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1 flex-wrap">
                                {person.profile_url ? (
                                  <a
                                    href={person.profile_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-semibold text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"
                                  >
                                    <span>{person.name || 'Unknown'}</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                ) : (
                                  <p className="font-semibold text-white">{person.name || 'Unknown'}</p>
                                )}
                                {matchScore !== null && (
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getMatchBadgeColor(matchScore)}`}>
                                    {matchScore}% Match
                                  </span>
                                )}
                              </div>
                              {person.headline && (
                                <p className="text-sm text-gray-300 mb-2">{person.headline}</p>
                              )}
                              {person.profile_url && (
                                <p className="text-xs text-gray-400 mb-2 font-mono break-all">
                                  {person.profile_url}
                                </p>
                              )}
                              {person.text && (
                                <p className="text-sm text-gray-200 italic bg-gray-900/50 p-2 rounded border-l-2 border-cyan-400">
                                  "{person.text}"
                                </p>
                              )}
                              {person.date && (
                                <p className="text-xs text-gray-400 mt-2">
                                  {new Date(person.date).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {postData.reactioners && postData.reactioners.length > 0 && (
                <div className="card">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                      <ThumbsUp className="w-5 h-5 text-pink-400" />
                      <span>
                        Reactioners ({isFilterActive ? filteredReactioners?.length || 0 : postData.reactioners.length})
                      </span>
                    </h3>
                    <button
                      onClick={handleDownloadReactioners}
                      className="flex items-center space-x-2 px-3 py-1.5 bg-pink-600 hover:bg-pink-700 text-white rounded-lg text-sm font-medium transition-colors"
                      title="Download reactioners as CSV"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download CSV</span>
                    </button>
                  </div>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {(isFilterActive ? filteredReactioners || [] : postData.reactioners || []).map((person, idx) => {
                      const matchScore = getMatchScore(person.profile_url);
                      return (
                        <div key={idx} className={`p-4 rounded-lg transition-colors ${
                          isFilterActive && matchScore !== null
                            ? matchScore >= 80 ? 'bg-green-900/40 border-2 border-green-400' 
                              : matchScore >= 60 ? 'bg-yellow-900/40 border-2 border-yellow-400'
                              : 'bg-orange-900/40 border-2 border-orange-400'
                            : 'bg-gray-800/60 hover:bg-gray-700/60 border border-gray-700'
                        }`}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1 flex-wrap">
                                {person.profile_url ? (
                                  <a
                                    href={person.profile_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-semibold text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"
                                  >
                                    <span>{person.name || 'Unknown'}</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                ) : (
                                  <p className="font-semibold text-white">{person.name || 'Unknown'}</p>
                                )}
                                {person.reaction_type && (
                                  <span className="px-2 py-1 text-xs rounded-full bg-pink-900/60 text-pink-200 font-medium border border-pink-700">
                                    {person.reaction_type.toLowerCase()}
                                  </span>
                                )}
                                {matchScore !== null && (
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getMatchBadgeColor(matchScore)}`}>
                                    {matchScore}% Match
                                  </span>
                                )}
                              </div>
                              {person.headline && (
                                <p className="text-sm text-gray-300 mb-2">{person.headline}</p>
                              )}
                              {person.profile_url && (
                                <p className="text-xs text-gray-400 font-mono break-all">
                                  {person.profile_url}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
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