import React, { useState, useEffect } from 'react';
import { Mail, Calendar, Loader2, CheckCircle, XCircle, Sparkles, FileText, RefreshCw, Copy, Check, Eye } from 'lucide-react';
import { getDateFolders, getFilesInDateFolder, getFileContent } from '../lib/r2';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Newsletter() {
  const [loading, setLoading] = useState(true);
  const [dateFolders, setDateFolders] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [files, setFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState(null);
  const [generatedHtml, setGeneratedHtml] = useState(null);
  const [copied, setCopied] = useState(false);
  const [rawResponse, setRawResponse] = useState(null);
  const [existingNewsletterHtml, setExistingNewsletterHtml] = useState(null);
  const [loadingExistingNewsletter, setLoadingExistingNewsletter] = useState(false);
  const [tone, setTone] = useState('');
  const [customToneText, setCustomToneText] = useState('');

  // Get newsletter webhook endpoints from env
  const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;
  const testEndpoint = import.meta.env.VITE_N8N_NEWSLETTER_TEST_ENDPOINT;
  const prodEndpoint = import.meta.env.VITE_N8N_NEWSLETTER_PROD_ENDPOINT;
  const [endpoint, setEndpoint] = useState('webhook-test');

  useEffect(() => {
    fetchDateFolders();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      fetchFilesInFolder(selectedDate);
      checkForExistingNewsletter(selectedDate);
    } else {
      setFiles([]);
      setExistingNewsletterHtml(null);
    }
  }, [selectedDate]);

  const fetchDateFolders = async () => {
    try {
      setLoading(true);
      console.log('[Newsletter] Fetching date folders...');
      const dates = await getDateFolders();
      console.log('[Newsletter] Successfully loaded', dates.length, 'date folders');
      setDateFolders(dates);
      setStatus(null); // Clear any previous errors
    } catch (error) {
      console.error('[Newsletter] Error fetching date folders:', error);
      console.error('[Newsletter] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      
      // More helpful error message for users
      let errorMessage = 'Failed to load date folders. ';
      if (error.message.includes('404') || error.message.includes('not found')) {
        errorMessage += 'The R2 API server is not accessible. Make sure the production server is running.';
      } else if (error.message.includes('Network error') || error.message.includes('fetch')) {
        errorMessage += 'Cannot connect to the R2 API server. Check your network connection and server status.';
      } else {
        errorMessage += error.message || 'Please check your R2 configuration.';
      }
      
      setStatus({
        type: 'error',
        message: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchFilesInFolder = async (dateFolder) => {
    try {
      setLoadingFiles(true);
      const folderFiles = await getFilesInDateFolder(dateFolder);
      setFiles(folderFiles);
    } catch (error) {
      console.error('Error fetching files:', error);
      setStatus({
        type: 'error',
        message: `Failed to load files from ${dateFolder}: ${error.message}`,
      });
      setFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  };

  const checkForExistingNewsletter = async (dateFolder) => {
    try {
      setLoadingExistingNewsletter(true);
      setExistingNewsletterHtml(null);
      
      console.log('🔍 Checking for newsletter file at root level for date:', dateFolder);
      
      // Newsletter files are at the root level of the bucket, not inside date folders
      // Try direct fetch with expected paths
      const possibleKeys = [
        `Newsletter: ${dateFolder}`,
        `Newsletter: ${dateFolder}.html`,
        `newsletter/Newsletter: ${dateFolder}`,
        `newsletter/Newsletter: ${dateFolder}.html`,
      ];
      
      for (const key of possibleKeys) {
        try {
          console.log('🔍 Trying to fetch:', key);
          const htmlContent = await getFileContent(key);
          console.log('✅ Successfully fetched newsletter from:', key);
          setExistingNewsletterHtml(htmlContent);
          return; // Exit if successful
        } catch (fetchError) {
          // File doesn't exist at this path, try next one
          console.log('❌ Not found at:', key);
          continue;
        }
      }
      
      console.log('❌ No existing newsletter found for', dateFolder);
      setExistingNewsletterHtml(null);
    } catch (error) {
      console.error('❌ Error checking for existing newsletter:', error);
      // Don't show error to user, just log it - this is a background check
      setExistingNewsletterHtml(null);
    } finally {
      setLoadingExistingNewsletter(false);
    }
  };

  const handleGenerateNewsletter = async () => {
    if (!selectedDate) {
      setStatus({ type: 'error', message: 'Please select a date folder' });
      return;
    }

    setGenerating(true);
    setStatus(null);

    try {
      const selectedEndpointPath = endpoint === 'webhook-test' ? testEndpoint : prodEndpoint;
      const fullWebhookUrl = `${webhookUrl}/${selectedEndpointPath}`;

      console.log('📤 Sending newsletter generation request:', {
        date: selectedDate,
        tone: tone || 'not specified',
        customToneText: tone === 'CUSTOM' ? customToneText : 'not applicable',
        endpoint: fullWebhookUrl,
      });

      const response = await fetch(fullWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: selectedDate,
          dateFolder: `${selectedDate}/`,
          tone: tone || undefined,
          custom_tone_text: tone === 'CUSTOM' && customToneText ? customToneText : undefined,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Newsletter generation failed: ${response.statusText} - ${errorText}`);
      }

      // Get response as text first to check if it's HTML or JSON
      const responseText = await response.text();
      console.log('✅ Newsletter generation response (first 200 chars):', responseText.substring(0, 200));

      let htmlContent = null;
      let responseData = null;

      // Check if response is HTML (starts with <!DOCTYPE or <html)
      if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
        // Response is HTML directly
        htmlContent = responseText;
        console.log('📄 Detected HTML response');
      } else {
        // Try to parse as JSON
        try {
          responseData = JSON.parse(responseText);
          console.log('📋 Parsed JSON response:', responseData);
          console.log('📋 Full response structure:', JSON.stringify(responseData, null, 2));

          // Extract HTML from JSON response - check multiple possible formats
          // Format 1: Array with html field [{ html: "..." }]
          if (Array.isArray(responseData) && responseData.length > 0) {
            htmlContent = responseData[0]?.html || responseData[0]?.html_content || null;
          } 
          // Format 2: Direct html field { html: "..." }
          else if (responseData.html) {
            htmlContent = responseData.html;
          }
          // Format 3: Nested in data field { data: { html: "..." } }
          else if (responseData.data?.html) {
            htmlContent = responseData.data.html;
          }
          // Format 4: Nested in result field { result: { html: "..." } }
          else if (responseData.result?.html) {
            htmlContent = responseData.result.html;
          }
          // Format 5: Nested in newsletter field { newsletter: { html: "..." } }
          else if (responseData.newsletter?.html) {
            htmlContent = responseData.newsletter.html;
          }
          // Format 6: Check if HTML is in any nested array
          else if (Array.isArray(responseData)) {
            for (const item of responseData) {
              if (item.html || item.html_content) {
                htmlContent = item.html || item.html_content;
                break;
              }
            }
          }
        } catch (jsonError) {
          console.error('❌ Failed to parse as JSON:', jsonError);
          // If it's not valid JSON and not HTML, show error
          setRawResponse({ error: 'Response is neither valid JSON nor HTML', raw: responseText.substring(0, 500) });
          setStatus({
            type: 'error',
            message: 'Response format not recognized. Expected HTML or JSON.',
          });
          return;
        }
      }

      if (htmlContent) {
        setGeneratedHtml(htmlContent);
        setRawResponse(null); // Clear raw response on success
        setStatus({
          type: 'success',
          message: `Newsletter generated successfully for ${selectedDate}!`,
        });
      } else if (responseData) {
        // Try to generate HTML from the newsletter data
        const generatedHtml = generateHtmlFromData(responseData);
        if (generatedHtml) {
          setGeneratedHtml(generatedHtml);
          setRawResponse(null);
          setStatus({
            type: 'success',
            message: `Newsletter HTML generated from data for ${selectedDate}!`,
          });
        } else {
          // Show the response structure in error for debugging
          console.error('❌ HTML not found. Response keys:', Array.isArray(responseData) && responseData.length > 0 ? Object.keys(responseData[0]) : Object.keys(responseData));
          setRawResponse(responseData); // Store for debugging view
          setStatus({
            type: 'warning',
            message: `Newsletter data received but couldn't generate HTML. Check debug view below.`,
          });
        }
      } else {
        setStatus({
          type: 'error',
          message: 'Could not extract HTML from response.',
        });
      }
    } catch (error) {
      console.error('Error generating newsletter:', error);
      setStatus({
        type: 'error',
        message: `Failed to generate newsletter: ${error.message}`,
      });
    } finally {
      setGenerating(false);
    }
  };

  // Generate HTML from newsletter data
  const generateHtmlFromData = (newsletterData) => {
    if (!newsletterData || !Array.isArray(newsletterData) || newsletterData.length === 0) {
      return null;
    }

    const data = newsletterData[0];
    const { newsletter_headline, subject_line, pre_header_text, top_stories } = data;
    
    // Get current date for newsletter
    const currentDate = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Generate stories HTML
    const storiesHtml = top_stories?.map((story, index) => {
      const imageUrl = files[index]?.url || `https://vkagouznbhlmetgcgmnr.supabase.co/storage/v1/object/public/newsletter-images/${selectedDate}T00:00:00.000+01:00.png`;
      const firstLink = story.external_source_links?.[0] || '#';
      
      // Convert markdown to HTML
      let segmentHtml = story.segment_markdown || '';
      
      // Process line by line to handle different markdown elements
      const lines = segmentHtml.split('\n');
      const processedLines = [];
      
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;
        
        // Handle headers (# Title)
        if (line.startsWith('# ')) {
          processedLines.push(`<h2 style="font-size:26px; line-height:32px; font-weight:bold; color:#4F46E5; margin:0 0 15px; font-family: Arial, Helvetica, sans-serif;">${line.substring(2)}</h2>`);
        }
        // Handle list items (- item)
        else if (line.startsWith('- ')) {
          let itemText = line.substring(2);
          itemText = itemText.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
          itemText = itemText.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" style="color:#4F46E5; font-weight:bold;">$1</a>');
          processedLines.push(`- ${itemText}<br />`);
        }
        // Handle regular paragraphs
        else {
          let paraText = line;
          paraText = paraText.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
          paraText = paraText.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" style="color:#4F46E5; font-weight:bold;">$1</a>');
          processedLines.push(`<p style="font-size:18px; line-height:28px; margin:0 0 15px; font-family: Arial, Helvetica, sans-serif;">${paraText}</p>`);
        }
      }
      
      segmentHtml = processedLines.join('\n');

      return `
        ${index > 0 ? `
        <!-- DIVIDER -->
        <tr>
          <td style="padding:0 30px;">
            <hr style="border:none; border-top:1px solid #e0e0e0; margin:0;" />
          </td>
        </tr>
        ` : ''}
        <!-- STORY ${index + 1} -->
        <tr>
          <td style="padding:${index === 0 ? '0' : '40px'} 30px 40px;">
            ${segmentHtml}
            <img src="${imageUrl}" alt="${story.title}" style="max-width:100%; height:auto; border-radius:6px; box-shadow: 0 3px 8px rgba(0,0,0,0.1); margin:20px 0; display:block;" />
            <a href="${firstLink}" target="_blank" role="button" style="background-color:#4F46E5; color:#ffffff; text-decoration:none; padding:14px 30px; border-radius:6px; font-weight:bold; display:inline-block; font-size:16px; font-family: Arial, Helvetica, sans-serif; box-shadow: 0 4px 8px rgba(79,70,229,0.4); transition: background-color 0.3s ease;">
              Read More
            </a>
          </td>
        </tr>
      `;
    }).join('') || '';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>The Recap - ${subject_line || newsletter_headline}</title>
<style type="text/css">
  /* Reset and base styles for clients that support embedded */
  body, table, td, a { 
    -webkit-text-size-adjust:100%; 
    -ms-text-size-adjust:100%; 
  }
  table, td { 
    mso-table-lspace:0pt; 
    mso-table-rspace:0pt; 
  }
  img { 
    -ms-interpolation-mode:bicubic; 
    border:0; 
    outline:none; 
    text-decoration:none; 
    display:block; 
    max-width:100%; 
    height:auto;
  }
  a { 
    color:#4F46E5; 
    text-decoration:none; 
  }
  a:hover, a:focus { 
    text-decoration:underline; 
  }
  @media only screen and (max-width:620px) {
    .wrapper { width:100% !important; padding: 15px !important; }
    .hero-image { height:auto !important; max-width:100% !important; }
    .stack-column, .stack-column-center {
      display:block !important;
      width:100% !important;
      max-width:100% !important;
      direction:ltr !important;
    }
    .stack-column-center {
      text-align:center !important;
    }
    .button {
      width:100% !important;
      padding-left:0 !important;
      padding-right:0 !important;
    }
    h1 { font-size:28px !important; line-height:32px !important; }
    h2 { font-size:22px !important; line-height:26px !important; }
    p, li, a { font-size:18px !important; line-height:28px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f4; font-family: Arial, Helvetica, sans-serif; color:#333333;">

<!-- PREHEADER TEXT : hidden in email body but visible in preview -->
<div style="display:none; max-height:0px; overflow:hidden; font-size:1px; line-height:1px; color:#f4f4f4; opacity:0; visibility:hidden; mso-hide:all;">
${pre_header_text || 'The latest AI news and insights'}
</div>

<!-- HEADER SECTION -->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#ffffff;">
<tr>
  <td align="center" style="padding:20px 0;">
    <h1 style="margin:0; font-weight:bold; font-size:32px; color:#4F46E5; font-family: Arial, Helvetica, sans-serif;">The Recap</h1>
    <p style="margin:5px 0 0; font-size:14px; color:#777777; font-family: Arial, Helvetica, sans-serif;">
      ${currentDate}
    </p>
  </td>
</tr>
</table>

<!-- MAIN CONTENT CONTAINER -->
<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="600" class="wrapper" style="max-width:600px; margin:0 auto; background-color:#ffffff; border-collapse:collapse;">

  <!-- HEADER IMAGE HERO -->
  <tr>
    <td style="padding:40px 30px 30px; text-align:center;">
      ${files[0]?.url ? `<img src="${files[0].url}" alt="${newsletter_headline}" width="540" style="border-radius:6px; box-shadow:0 3px 8px rgba(0,0,0,0.12); max-width:100%; height:auto; display:block; margin: 0 auto;" />` : ''}
    </td>
  </tr>

  <!-- SUBJECT / HERO HEADLINE -->
  <tr>
    <td style="padding:0 30px 30px;">
      <h1 style="font-size:32px; line-height:38px; font-weight:bold; color:#4F46E5; margin:0 0 15px; font-family: Arial, Helvetica, sans-serif;">
        ${newsletter_headline || subject_line}
      </h1>
      ${top_stories?.[0]?.summary ? `<p style="font-size:18px; line-height:28px; margin:0 0 30px; color:#333333; font-family: Arial, Helvetica, sans-serif;">
        ${top_stories[0].summary}
      </p>` : ''}
    </td>
  </tr>

  ${storiesHtml}

</table>

<!-- FOOTER SECTION -->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#333333" style="margin-top:40px;">
<tr>
  <td align="center" style="padding:30px 20px; color:#ffffff; font-family: Arial, Helvetica, sans-serif; font-size:14px; line-height:20px;">
    <p style="margin:0 0 15px;">
      <a href="https://www.facebook.com/" target="_blank" style="color:#ffffff; text-decoration:none; margin:0 10px; font-weight:bold;">Facebook</a> |
      <a href="https://twitter.com/" target="_blank" style="color:#ffffff; text-decoration:none; margin:0 10px; font-weight:bold;">Twitter</a> |
      <a href="https://www.linkedin.com/" target="_blank" style="color:#ffffff; text-decoration:none; margin:0 10px; font-weight:bold;">LinkedIn</a>
    </p>
    <p style="margin:0 0 15px; font-size:12px; color:#bbbbbb;">
      The Recap &bull; 123 AI Way, Innovation City, CA 90000
    </p>
    <p style="margin:0 0 15px; font-size:12px; color:#bbbbbb;">
      You are receiving this email because you subscribed to The Recap newsletter.
    </p>
    <p style="margin:0;">
      <a href="[UNSUBSCRIBE_LINK]" target="_blank" style="color:#10B981; text-decoration:none; font-weight:bold;">Unsubscribe</a> | 
      <a href="[PREFERENCE_CENTER_LINK]" target="_blank" style="color:#10B981; text-decoration:none; font-weight:bold;">Manage Preferences</a>
    </p>
    <p style="margin-top:20px; font-size:12px; color:#777777;">
      &copy; 2025 The Recap. All rights reserved.
    </p>
  </td>
</tr>
</table>

</body>
</html>`;

    return html;
  };

  const handleCopyToClipboard = async () => {
    if (!generatedHtml) return;

    try {
      await navigator.clipboard.writeText(generatedHtml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = generatedHtml;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Fallback copy failed:', err);
      }
      document.body.removeChild(textArea);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading date folders from R2..." />;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8 animate-slideInLeft">
        <h1 className="text-4xl font-bold text-gradient mb-2 flex items-center space-x-3">
          <Mail className="w-10 h-10 text-cyan-400" />
          <span>Newsletter Generator</span>
        </h1>
        <p className="text-gray-300 text-lg">Select a date folder and generate newsletter</p>
      </div>

      <div className="card animate-slideInUp">
        {/* Endpoint Selection */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-300 mb-3">
            Select Endpoint
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setEndpoint('webhook-test')}
              className={`px-4 py-3 rounded-xl font-medium transition-all duration-300 ${
                endpoint === 'webhook-test'
                  ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-lg scale-105'
                  : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
              }`}
            >
              Test Webhook
            </button>
            <button
              onClick={() => setEndpoint('webhook')}
              className={`px-4 py-3 rounded-xl font-medium transition-all duration-300 ${
                endpoint === 'webhook'
                  ? 'bg-gradient-to-r from-green-600 to-emerald-500 text-white shadow-lg scale-105'
                  : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
              }`}
            >
              Production
            </button>
          </div>
        </div>

        {/* Date Folder Dropdown */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-300 mb-2">
            Select Date Folder <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="input-field w-full pl-12 pr-4 py-3"
            >
              <option value="">Select a date folder</option>
              {dateFolders.map((date) => (
                <option key={date} value={date}>
                  {date}
                </option>
              ))}
            </select>
          </div>
          {dateFolders.length === 0 && (
            <p className="text-sm text-gray-400 mt-2">
              No date folders found in R2 bucket
            </p>
          )}
        </div>

        {/* Tone Selection */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-300 mb-2">
            Select Tone
          </label>
          <div className="relative">
            <select
              value={tone}
              onChange={(e) => {
                setTone(e.target.value);
                // Clear custom tone text when switching away from custom tone
                if (e.target.value !== 'CUSTOM') {
                  setCustomToneText('');
                }
              }}
              className="input-field w-full pl-4 pr-4 py-3"
            >
              <option value="">Select a tone (optional)</option>
              <option value="Professional/No-Nonsense">Professional/No-Nonsense</option>
              <option value="Playful/Lighthearted">Playful/Lighthearted</option>
              <option value="Sarcastic/Edgy">Sarcastic/Edgy</option>
              <option value="Warm/Community-Focused">Warm/Community-Focused</option>
              <option value="Bold/Energetic/Hype">Bold/Energetic/Hype</option>
              <option value="Minimalist/Zen">Minimalist/Zen</option>
              <option value="Futuristic/Cutting-Edge">Futuristic/Cutting-Edge</option>
              <option value="CUSTOM">CUSTOM</option>
            </select>
          </div>
          {tone === 'CUSTOM' && (
            <div className="mt-3">
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Custom Tone Description
              </label>
              <textarea
                value={customToneText}
                onChange={(e) => setCustomToneText(e.target.value)}
                placeholder="Describe the tone you want for the newsletter..."
                className="input-field w-full pl-4 pr-4 py-3 min-h-[100px] resize-y"
                rows={4}
              />
            </div>
          )}
        </div>

        {/* Files List */}
        {selectedDate && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-semibold text-gray-300">
                Files in {selectedDate}
              </label>
              <button
                onClick={() => fetchFilesInFolder(selectedDate)}
                disabled={loadingFiles}
                className="flex items-center space-x-2 px-3 py-1.5 text-sm text-gray-400 hover:text-gray-300 transition-colors"
                title="Refresh files list"
              >
                <RefreshCw className={`w-4 h-4 ${loadingFiles ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {loadingFiles ? (
              <div className="bg-gray-800/50 rounded-xl p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Loading files...</p>
              </div>
            ) : files.length > 0 ? (
              <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50 max-h-64 overflow-y-auto">
                <div className="space-y-2">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-sm text-gray-300 truncate" title={file.name}>
                          {file.name}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-gray-400 flex-shrink-0 ml-4">
                        {file.size && (
                          <span>{(file.size / 1024).toFixed(1)} KB</span>
                        )}
                        {file.lastModified && (
                          <span>
                            {new Date(file.lastModified).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-gray-800/30 rounded-xl p-6 text-center border border-gray-700/50">
                <FileText className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No files found in this folder</p>
              </div>
            )}
          </div>
        )}

        {/* Status Message */}
        {status && (
          <div
            className={`mb-6 p-4 rounded-xl flex items-center space-x-3 animate-slideInUp ${
              status.type === 'success'
                ? 'bg-green-900/30 text-green-200 border border-green-500/50'
                : 'bg-red-900/30 text-red-200 border border-red-500/50'
            }`}
          >
            {status.type === 'success' ? (
              <CheckCircle className="w-6 h-6 text-green-600" />
            ) : (
              <XCircle className="w-6 h-6 text-red-600" />
            )}
            <p className="font-medium">{status.message}</p>
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={handleGenerateNewsletter}
          disabled={!selectedDate || generating}
          className={`w-full py-4 rounded-xl font-semibold text-white text-lg transition-all duration-300 flex items-center justify-center space-x-2 ${
            !selectedDate || generating
              ? 'bg-gray-700 cursor-not-allowed'
              : 'bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 shadow-lg hover:shadow-xl transform hover:scale-105'
          }`}
        >
          {generating ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Generating Newsletter...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-6 h-6" />
              <span>Generate Newsletter</span>
            </>
          )}
        </button>

        {/* Endpoint Info */}
        <div className="mt-6 text-center text-sm text-gray-400">
          <p>
            Endpoint:{' '}
            {webhookUrl}/{endpoint === 'webhook-test' ? testEndpoint : prodEndpoint}
          </p>
        </div>
      </div>

      {/* Existing Newsletter Display */}
      {loadingExistingNewsletter && (
        <div className="card animate-slideInUp mt-6">
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-400 mr-3" />
            <p className="text-gray-300">Checking for existing newsletter...</p>
          </div>
        </div>
      )}

      {existingNewsletterHtml && !generatedHtml && (
        <div className="card animate-slideInUp mt-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
              <Mail className="w-6 h-6 text-green-400" />
              <span>Existing Newsletter: {selectedDate}</span>
            </h2>
            <div className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-green-600/20 text-green-400 border border-green-500/50">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Found</span>
            </div>
          </div>

          {/* HTML Preview */}
          <div className="bg-white rounded-xl overflow-hidden border-2 border-gray-700/50 shadow-2xl">
            <iframe
              srcDoc={existingNewsletterHtml}
              title={`Newsletter ${selectedDate}`}
              className="w-full"
              style={{
                minHeight: '600px',
                border: 'none',
                display: 'block',
              }}
              sandbox="allow-same-origin"
            />
          </div>

          {/* HTML Code Preview (Collapsible) */}
          <details className="mt-4">
            <summary className="cursor-pointer text-cyan-300 hover:text-cyan-200 font-medium mb-2 select-none">
              View HTML Source
            </summary>
            <div className="mt-3 bg-gray-900 rounded-xl p-4 border border-gray-700/50 max-h-96 overflow-auto">
              <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono">
                {existingNewsletterHtml}
              </pre>
            </div>
          </details>
        </div>
      )}

      {/* Generated Newsletter Preview */}
      {generatedHtml && (
        <div className="card animate-slideInUp mt-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
              <Eye className="w-6 h-6 text-cyan-400" />
              <span>Newsletter Preview</span>
            </h2>
            <button
              onClick={handleCopyToClipboard}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition-all duration-300 ${
                copied
                  ? 'bg-green-600/20 text-green-400 border border-green-500/50'
                  : 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/50 hover:bg-cyan-600/30 hover:border-cyan-400/70'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  <span>Copy HTML</span>
                </>
              )}
            </button>
          </div>

          {/* HTML Preview */}
          <div className="bg-white rounded-xl overflow-hidden border-2 border-gray-700/50 shadow-2xl">
            <iframe
              srcDoc={generatedHtml}
              title="Newsletter Preview"
              className="w-full"
              style={{
                minHeight: '600px',
                border: 'none',
                display: 'block',
              }}
              sandbox="allow-same-origin"
            />
          </div>

          {/* HTML Code Preview (Collapsible) */}
          <details className="mt-4">
            <summary className="cursor-pointer text-cyan-300 hover:text-cyan-200 font-medium mb-2 select-none">
              View HTML Source
            </summary>
            <div className="mt-3 bg-gray-900 rounded-xl p-4 border border-gray-700/50 max-h-96 overflow-auto">
              <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono">
                {generatedHtml}
              </pre>
            </div>
          </details>
        </div>
      )}

      {/* Debug View - Show raw response when HTML not found */}
      {rawResponse && !generatedHtml && (
        <div className="card animate-slideInUp mt-6 border-yellow-500/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-yellow-400 flex items-center space-x-2">
              <XCircle className="w-5 h-5" />
              <span>Debug: Raw Response</span>
            </h2>
          </div>
          <p className="text-sm text-gray-300 mb-4">
            HTML field not found in response. Showing raw response structure:
          </p>
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-700/50 max-h-96 overflow-auto">
            <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono">
              {JSON.stringify(rawResponse, null, 2)}
            </pre>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            💡 Tip: Check if the HTML is nested in a different field (e.g., <code className="text-cyan-300">data.html</code>, <code className="text-cyan-300">result.html</code>, etc.)
          </p>
        </div>
      )}
    </div>
  );
}

