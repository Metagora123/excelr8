// Cloudflare R2 utility functions
// Using backend API to avoid CORS issues

// Get all date folders from R2 bucket via backend API
export const getDateFolders = async () => {
  try {
    // Call backend API endpoint (proxy in vite.config.js)
    const response = await fetch('/api/r2/date-folders', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch date folders: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data.dateFolders || [];
  } catch (error) {
    console.error('Error fetching date folders from R2:', error);
    throw error;
  }
};

// Get files in a specific date folder via backend API
export const getFilesInDateFolder = async (dateFolder) => {
  try {
    // Call backend API endpoint (proxy in vite.config.js)
    const response = await fetch(`/api/r2/files?folder=${encodeURIComponent(dateFolder)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch files: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data.files || [];
  } catch (error) {
    console.error('Error fetching files from R2:', error);
    throw error;
  }
};

// Get file content from R2 bucket via backend API
export const getFileContent = async (fileKey) => {
  try {
    // Call backend API endpoint (proxy in vite.config.js)
    const response = await fetch(`/api/r2/file-content?key=${encodeURIComponent(fileKey)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch file content: ${response.statusText} - ${errorText}`);
    }

    const content = await response.text();
    return content;
  } catch (error) {
    console.error('Error fetching file content from R2:', error);
    throw error;
  }
};

