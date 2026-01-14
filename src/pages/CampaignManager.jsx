import React, { useState, useCallback, useRef } from 'react';
import { Upload, FileText, CheckCircle, XCircle, Loader2, Send, Sparkles } from 'lucide-react';
import { airtableQueries } from '../lib/airtable';

export default function CampaignManager() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingFileName, setUploadingFileName] = useState('');
  const [status, setStatus] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [endpoint, setEndpoint] = useState('webhook-test');
  const [category, setCategory] = useState('');
  const [managedBy, setManagedBy] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [customManagedBy, setCustomManagedBy] = useState('');
  const [generating, setGenerating] = useState(false);
  const fileInputRef = useRef(null);

  // Direct n8n webhook URLs (like FileIngestion - using SUPABASE variable pattern)
  const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;
  const testEndpoint = import.meta.env.VITE_N8N_CAMPAIGN_TEST_ENDPOINT;
  const prodEndpoint = import.meta.env.VITE_N8N_CAMPAIGN_PROD_ENDPOINT;

  const categories = [
    { value: 'technical', label: 'Technical' },
    { value: 'sales', label: 'Sales' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'other', label: 'Other' }
  ];

  const managers = [
    { value: 'yves', label: 'Yves (Sales, CEO, CTOs)' },
    { value: 'eva', label: 'Eva (Marketing)' },
    { value: 'shawn', label: 'Shawn (Technical)' },
    { value: 'other', label: 'Other' }
  ];

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'text/csv') {
      setFile(droppedFile);
      setStatus(null);
    } else {
      setStatus({ type: 'error', message: 'Please upload a CSV file' });
    }
  }, []);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      setStatus(null);
    } else {
      setStatus({ type: 'error', message: 'Please upload a CSV file' });
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setStatus({ type: 'error', message: 'Please select a file first' });
      return;
    }

    setUploading(true);
    setUploadingFileName(file.name);
    setStatus(null);

    const formData = new FormData();
    formData.append('data', file);
    
    // Use custom value if "other" is selected, otherwise use the selected value
    if (category) {
      const finalCategory = category === 'other' ? customCategory : category;
      if (finalCategory) formData.append('category', finalCategory);
    }
    if (managedBy) {
      const finalManagedBy = managedBy === 'other' ? customManagedBy : managedBy;
      if (finalManagedBy) formData.append('managedBy', finalManagedBy);
    }

    const selectedEndpoint = endpoint === 'webhook-test' ? testEndpoint : prodEndpoint;
    const fullWebhookUrl = `${webhookUrl}/${selectedEndpoint}`;

    try {
      const response = await fetch(fullWebhookUrl, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setStatus({ type: 'success', message: 'File uploaded successfully to webhook!' });
      } else {
        const errorText = await response.text();
        setStatus({ type: 'error', message: `Upload failed: ${response.statusText}` });
      }
    } catch (error) {
      setStatus({ type: 'error', message: `Upload failed: ${error.message}` });
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateCampaign = async () => {
    if (!file) {
      setStatus({ type: 'error', message: 'Please select a file first' });
      return;
    }

    if (!category) {
      setStatus({ type: 'error', message: 'Please select a category' });
      return;
    }

    if (category === 'other' && !customCategory.trim()) {
      setStatus({ type: 'error', message: 'Please enter a custom category' });
      return;
    }

    if (!managedBy) {
      setStatus({ type: 'error', message: 'Please select a manager' });
      return;
    }

    if (managedBy === 'other' && !customManagedBy.trim()) {
      setStatus({ type: 'error', message: 'Please enter a custom manager name' });
      return;
    }

    setGenerating(true);
    setStatus(null);

    try {
      // First upload to webhook
      const formData = new FormData();
      formData.append('data', file);
      
      // Use custom value if "other" is selected, otherwise use the selected value
      const finalCategory = category === 'other' ? customCategory : category;
      const finalManagedBy = managedBy === 'other' ? customManagedBy : managedBy;
      
      formData.append('category', finalCategory);
      formData.append('managedBy', finalManagedBy);

      const selectedEndpoint = endpoint === 'webhook-test' ? testEndpoint : prodEndpoint;
      const fullWebhookUrl = `${webhookUrl}/${selectedEndpoint}`;
      
      console.log('📤 Sending payload:', {
        file: file.name,
        category: finalCategory,
        managedBy: finalManagedBy,
        endpoint: selectedEndpoint
      });
      
      const webhookResponse = await fetch(fullWebhookUrl, {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header - let browser set it with boundary for FormData
      });

      console.log('📥 Response status:', webhookResponse.status, webhookResponse.statusText);
      
      if (!webhookResponse.ok) {
        const errorText = await webhookResponse.text();
        console.error('❌ Error response:', errorText);
        throw new Error(`Webhook upload failed: ${webhookResponse.statusText} - ${errorText}`);
      }
      
      const responseData = await webhookResponse.text();
      console.log('✅ Response data:', responseData);

      // Then create Airtable record (use finalCategory and finalManagedBy already defined above)
      const airtableFields = {
        'Campaign Name': `${finalCategory}_${file.name.replace('.csv', '')}_${new Date().toISOString().split('T')[0]}`,
        'Category': finalCategory.charAt(0).toUpperCase() + finalCategory.slice(1),
        'Managed By': finalManagedBy.charAt(0).toUpperCase() + finalManagedBy.slice(1),
        'File Name': file.name,
        'Status': 'Draft',
        'Created Date': new Date().toISOString(),
        // Dummy columns as requested
        'Column 1': 'Dummy Data 1',
        'Column 2': 'Dummy Data 2'
      };

      const airtableRecord = await airtableQueries.create(airtableFields);

      setStatus({ 
        type: 'success', 
        message: `Campaign generated successfully! Airtable record created: ${airtableRecord.id}` 
      });

      // Reset form after success
      setTimeout(() => {
        setFile(null);
        setCategory('');
        setManagedBy('');
        setCustomCategory('');
        setCustomManagedBy('');
        setStatus(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 3000);

    } catch (error) {
      console.error('Error generating campaign:', error);
      setStatus({ 
        type: 'error', 
        message: `Failed to generate campaign: ${error.message}` 
      });
    } finally {
      setGenerating(false);
    }
  };

  const removeFile = () => {
    setFile(null);
    setStatus(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8 animate-slideInLeft">
          <h1 className="text-4xl font-bold text-gradient mb-2 flex items-center space-x-3">
          <Sparkles className="w-10 h-10 text-cyan-400" />
          <span>Campaign Manager</span>
        </h1>
        <p className="text-gray-300 text-lg">Upload files and generate campaigns with Airtable integration</p>
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

        {/* Category Dropdown */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-300 mb-2">
            Category <span className="text-red-400">*</span>
          </label>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              if (e.target.value !== 'other') {
                setCustomCategory('');
              }
            }}
            className="input-field w-full"
          >
            <option value="">Select a category</option>
            {categories.map(cat => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
          {category === 'other' && (
            <input
              type="text"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              placeholder="Enter custom category"
              className="input-field w-full mt-3"
            />
          )}
        </div>

        {/* Managed By Dropdown */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-300 mb-2">
            Managed By <span className="text-red-400">*</span>
          </label>
          <select
            value={managedBy}
            onChange={(e) => {
              setManagedBy(e.target.value);
              if (e.target.value !== 'other') {
                setCustomManagedBy('');
              }
            }}
            className="input-field w-full"
          >
            <option value="">Select a manager</option>
            {managers.map(manager => (
              <option key={manager.value} value={manager.value}>
                {manager.label}
              </option>
            ))}
          </select>
          {managedBy === 'other' && (
            <input
              type="text"
              value={customManagedBy}
              onChange={(e) => setCustomManagedBy(e.target.value)}
              placeholder="Enter custom manager name"
              className="input-field w-full mt-3"
            />
          )}
        </div>

        {/* File Upload */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-3 border-dashed rounded-2xl p-12 text-center transition-all duration-300 mb-6 ${
            isDragging
              ? 'border-cyan-500 bg-cyan-900/20 scale-105'
              : 'border-gray-600 bg-gray-800/30 hover:border-cyan-400 hover:bg-cyan-900/10'
          }`}
        >
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
            ref={fileInputRef}
          />

          {!file ? (
            <label htmlFor="file-upload" className="cursor-pointer">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-gradient-to-br from-cyan-600 to-teal-500 rounded-full flex items-center justify-center mb-4 transform hover:scale-110 transition-transform duration-300 shadow-lg shadow-cyan-500/50">
                  <FileText className="w-8 h-8 text-white" />
                </div>
                <p className="text-xl font-semibold text-white mb-2">
                  Drop your CSV file here
                </p>
                <p className="text-gray-400">or click to browse</p>
              </div>
            </label>
          ) : (
            <div className="flex items-center justify-between bg-gray-800/50 rounded-xl p-4 shadow-md">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-600 to-teal-500 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-white">{file.name}</p>
                  <p className="text-sm text-gray-400">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              </div>
              <button
                onClick={removeFile}
                className="text-red-500 hover:text-red-700 transition-colors duration-200"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
          )}
        </div>

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

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className={`py-4 rounded-xl font-semibold text-white text-lg transition-all duration-300 flex items-center justify-center space-x-2 ${
              !file || uploading
                ? 'bg-gray-700 cursor-not-allowed'
                : 'bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 shadow-lg hover:shadow-xl transform hover:scale-105'
            }`}
          >
            {uploading ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="w-6 h-6" />
                <span>Upload File</span>
              </>
            )}
          </button>

          <button
            onClick={handleGenerateCampaign}
            disabled={!file || !category || !managedBy || generating}
            className={`py-4 rounded-xl font-semibold text-white text-lg transition-all duration-300 flex items-center justify-center space-x-2 ${
              !file || !category || !managedBy || generating
                ? 'bg-gray-700 cursor-not-allowed'
                : 'bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 shadow-lg hover:shadow-xl transform hover:scale-105'
            }`}
          >
            {generating ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-6 h-6" />
                <span>Generate Campaign</span>
              </>
            )}
          </button>
        </div>

        {/* Endpoint Info */}
        <div className="mt-6 text-center text-sm text-gray-400">
          <p>Endpoint: {webhookUrl}/{endpoint === 'webhook-test' ? testEndpoint : prodEndpoint}</p>
        </div>
      </div>
    </div>
  );
}

