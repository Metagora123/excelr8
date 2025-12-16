import React, { useState, useCallback, useRef } from 'react';
import { Upload, FileText, CheckCircle, XCircle, Loader2, Send } from 'lucide-react';

export default function FileIngestion() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingFileName, setUploadingFileName] = useState('');
  const [status, setStatus] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [endpoint, setEndpoint] = useState('webhook-test');
  const fileInputRef = useRef(null);

  const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;
  const testEndpoint = import.meta.env.VITE_N8N_TEST_ENDPOINT;
  const prodEndpoint = import.meta.env.VITE_N8N_PROD_ENDPOINT;

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
    if (!file) return;

    setUploading(true);
    setUploadingFileName(file.name);
    setStatus(null);

    const formData = new FormData();
    formData.append('data', file);

    const selectedEndpoint = endpoint === 'webhook-test' ? testEndpoint : prodEndpoint;
    const url = `${webhookUrl}/${selectedEndpoint}/clay`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setStatus({ type: 'success', message: 'File uploaded successfully!' });
        setTimeout(() => {
          setFile(null);
          setUploadingFileName('');
          setStatus(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }, 3000);
      } else {
        setStatus({ type: 'error', message: `Upload failed: ${response.statusText}` });
      }
    } catch (error) {
      setStatus({ type: 'error', message: `Upload failed: ${error.message}` });
    } finally {
      setUploading(false);
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
        <h1 className="text-4xl font-bold text-gradient mb-2">
          CSV File Ingestion
        </h1>
        <p className="text-gray-300 text-lg">Upload your CSV files to Clay seamlessly</p>
      </div>

      <div className="card animate-slideInUp">
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

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-3 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
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
                <div className="w-16 h-16 bg-gradient-to-br from-cyan-600 to-teal-600 rounded-full flex items-center justify-center mb-4 transform hover:scale-110 transition-transform duration-300 shadow-lg shadow-cyan-500/50">
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
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-600 to-teal-600 rounded-lg flex items-center justify-center">
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

        {status && (
          <div
            className={`mt-6 p-4 rounded-xl flex items-center space-x-3 animate-slideInUp ${
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

        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className={`w-full mt-6 py-4 rounded-xl font-semibold text-white text-lg transition-all duration-300 flex items-center justify-center space-x-2 ${
            !file || uploading
              ? 'bg-gray-700 cursor-not-allowed'
              : 'bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 shadow-lg hover:shadow-xl transform hover:scale-105'
          }`}
        >
          {uploading ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Uploading {uploadingFileName}...</span>
            </>
          ) : (
            <>
              <Send className="w-6 h-6" />
              <span>Upload to {endpoint === 'webhook-test' ? 'Test' : 'Production'}</span>
            </>
          )}
        </button>

        <div className="mt-6 text-center text-sm text-gray-400">
          <p>Endpoint: {webhookUrl}/{endpoint === 'webhook-test' ? testEndpoint : prodEndpoint}/clay</p>
        </div>
      </div>
    </div>
  );
}