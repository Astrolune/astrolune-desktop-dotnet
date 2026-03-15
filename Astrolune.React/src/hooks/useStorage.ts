import { useState, useCallback } from 'react';
import { getAccessToken } from '../lib/auth/session';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

interface FileUploadResult {
  url: string;
  path: string;
  size: number;
  mimeType: string;
}

export function useStorage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const uploadFile = useCallback(
    async (endpoint: string, file: File): Promise<FileUploadResult> => {
      setLoading(true);
      setError(null);
      setUploadProgress(0);

      try {
        const token = await getAccessToken();
        const formData = new FormData();
        
        const fieldName = endpoint.includes('avatar')
          ? 'avatar'
          : endpoint.includes('banner')
          ? 'banner'
          : 'file';
        
        formData.append(fieldName, file);

        const xhr = new XMLHttpRequest();

        return new Promise((resolve, reject) => {
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const progress = Math.round((e.loaded / e.total) * 100);
              setUploadProgress(progress);
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              const result = JSON.parse(xhr.responseText);
              if (result.success) {
                setLoading(false);
                resolve(result.data);
              } else {
                setLoading(false);
                setError(result.error || 'Upload failed');
                reject(new Error(result.error || 'Upload failed'));
              }
            } else {
              setLoading(false);
              setError('Upload failed');
              reject(new Error('Upload failed'));
            }
          });

          xhr.addEventListener('error', () => {
            setLoading(false);
            setError('Upload failed');
            reject(new Error('Upload failed'));
          });

          xhr.open('POST', `${API_BASE_URL}${endpoint}`);
          if (token) {
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          }
          xhr.send(formData);
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Upload failed';
        setLoading(false);
        setError(errorMessage);
        throw err;
      }
    },
    []
  );

  const deleteFile = useCallback(async (bucket: string, path: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();

      const response = await fetch(`${API_BASE_URL}/storage`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ bucket, path }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Delete failed');
      }

      setLoading(false);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Delete failed';
      setLoading(false);
      setError(errorMessage);
      throw err;
    }
  }, []);

  const uploadAvatar = useCallback(
    (file: File) => uploadFile('/storage/avatar', file),
    [uploadFile]
  );

  const uploadBanner = useCallback(
    (file: File) => uploadFile('/storage/banner', file),
    [uploadFile]
  );

  const uploadChatFile = useCallback(
    (file: File) => uploadFile('/storage/chat-file', file),
    [uploadFile]
  );

  return {
    uploadAvatar,
    uploadBanner,
    uploadChatFile,
    deleteFile,
    loading,
    error,
    uploadProgress,
  };
}
