// Cloudflare R2 utility functions
// Using backend API to avoid CORS issues

// Get API base URL - use environment variable in production, or relative path in dev
const getApiBaseUrl = () => {
  // In production, use VITE_R2_API_URL if set, otherwise use relative path
  // This allows the frontend to point to a separate server if needed
  const baseUrl = import.meta.env.VITE_R2_API_URL || '';
  
  // Production-friendly logging
  if (import.meta.env.PROD) {
    console.log('[R2 API] Base URL:', baseUrl || '(using relative path)');
  }
  
  return baseUrl;
};

// Get all date folders from R2 bucket via backend API
export const getDateFolders = async () => {
  const apiBaseUrl = getApiBaseUrl();
  const url = `${apiBaseUrl}/api/r2/date-folders`;
  
  // Production-friendly logging
  console.log('[R2 API] Fetching date folders from:', url);
  console.log('[R2 API] Environment:', {
    mode: import.meta.env.MODE,
    prod: import.meta.env.PROD,
    dev: import.meta.env.DEV,
    apiUrl: import.meta.env.VITE_R2_API_URL || 'not set (using relative)',
  });
  
  try {
    // Call backend API endpoint (proxy in vite.config.js or production server)
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('[R2 API] Response status:', response.status, response.statusText);
    console.log('[R2 API] Response URL:', response.url);

    if (!response.ok) {
      const errorText = await response.text();
      const errorDetails = {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        errorText: errorText,
        message: `Failed to fetch date folders: ${response.status} ${response.statusText} - ${errorText}`,
      };
      
      console.error('[R2 API] Error details:', errorDetails);
      
      // More helpful error message
      if (response.status === 404) {
        throw new Error(
          `R2 API endpoint not found (404). ` +
          `The server at ${url} is not responding. ` +
          `Make sure the production server is running and accessible. ` +
          `If using separate servers, set VITE_R2_API_URL environment variable.`
        );
      }
      
      throw new Error(errorDetails.message);
    }

    const data = await response.json();
    console.log('[R2 API] Successfully fetched date folders:', data.dateFolders?.length || 0, 'folders');
    return data.dateFolders || [];
  } catch (error) {
    // Enhanced error logging for production
    const errorInfo = {
      message: error.message,
      url: url,
      apiBaseUrl: apiBaseUrl,
      isNetworkError: error.name === 'TypeError' && error.message.includes('fetch'),
    };
    
    console.error('[R2 API] Error fetching date folders:', errorInfo);
    console.error('[R2 API] Full error:', error);
    
    // Re-throw with more context
    if (errorInfo.isNetworkError) {
      throw new Error(
        `Network error: Cannot reach R2 API server at ${url}. ` +
        `This usually means the server is not running or not accessible. ` +
        `Check that the production server is running and VITE_R2_API_URL is set correctly.`
      );
    }
    
    throw error;
  }
};

// Get files in a specific date folder via backend API
export const getFilesInDateFolder = async (dateFolder) => {
  const apiBaseUrl = getApiBaseUrl();
  const url = `${apiBaseUrl}/api/r2/files?folder=${encodeURIComponent(dateFolder)}`;
  
  console.log('[R2 API] Fetching files from folder:', dateFolder, 'URL:', url);
  
  try {
    // Call backend API endpoint (proxy in vite.config.js or production server)
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('[R2 API] Files response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[R2 API] Files error:', {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText,
      });
      throw new Error(`Failed to fetch files: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[R2 API] Successfully fetched files:', data.files?.length || 0, 'files');
    return data.files || [];
  } catch (error) {
    console.error('[R2 API] Error fetching files from R2:', {
      folder: dateFolder,
      url: url,
      error: error.message,
    });
    throw error;
  }
};

// Get file content from R2 bucket via backend API
export const getFileContent = async (fileKey) => {
  const apiBaseUrl = getApiBaseUrl();
  const url = `${apiBaseUrl}/api/r2/file-content?key=${encodeURIComponent(fileKey)}`;
  
  console.log('[R2 API] Fetching file content:', fileKey, 'URL:', url);
  
  try {
    // Call backend API endpoint (proxy in vite.config.js or production server)
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('[R2 API] File content response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[R2 API] File content error:', {
        fileKey: fileKey,
        status: response.status,
        statusText: response.statusText,
        errorText: errorText,
      });
      throw new Error(`Failed to fetch file content: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const content = await response.text();
    console.log('[R2 API] Successfully fetched file content, length:', content.length);
    return content;
  } catch (error) {
    console.error('[R2 API] Error fetching file content from R2:', {
      fileKey: fileKey,
      url: url,
      error: error.message,
    });
    throw error;
  }
};

