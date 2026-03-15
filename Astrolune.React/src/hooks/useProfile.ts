import { useApi } from './useApi';
import { useCallback } from 'react';

interface Profile {
  id: string;
  user_id: string;
  username: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  banner_url?: string;
  status?: 'online' | 'offline' | 'away' | 'busy';
  last_seen?: string;
  created_at: string;
  updated_at: string;
}

export function useProfile() {
  const myProfileApi = useApi<Profile>();
  const profileApi = useApi<Profile>();
  const profileByUsernameApi = useApi<Profile>();
  const searchProfilesApi = useApi<Profile[]>();
  const updateProfileApi = useApi<Profile>();
  const updateStatusApi = useApi<Profile>();

  const getMyProfile = useCallback(
    () => myProfileApi.request('/profile/me'),
    [myProfileApi]
  );

  const getProfile = useCallback(
    (userId: string) => profileApi.request(`/profile/${userId}`),
    [profileApi]
  );

  const getProfileByUsername = useCallback(
    (username: string) => profileByUsernameApi.request(`/profile/username/${username}`),
    [profileByUsernameApi]
  );

  const searchProfiles = useCallback(
    (query: string, limit?: number) => {
      const params = new URLSearchParams({ q: query });
      if (limit) params.append('limit', limit.toString());
      return searchProfilesApi.request(`/profile/search?${params.toString()}`);
    },
    [searchProfilesApi]
  );

  const updateProfile = useCallback(
    (updates: Partial<Profile>) => updateProfileApi.request('/profile/me', 'PUT', updates),
    [updateProfileApi]
  );

  const updateStatus = useCallback(
    (status: 'online' | 'offline' | 'away' | 'busy') =>
      updateStatusApi.request('/profile/status', 'PATCH', { status }),
    [updateStatusApi]
  );

  return {
    getMyProfile,
    getProfile,
    getProfileByUsername,
    searchProfiles,
    updateProfile,
    updateStatus,
    myProfile: myProfileApi.data,
    profile: profileApi.data,
    searchResults: searchProfilesApi.data,
    loading:
      myProfileApi.loading ||
      profileApi.loading ||
      profileByUsernameApi.loading ||
      searchProfilesApi.loading ||
      updateProfileApi.loading ||
      updateStatusApi.loading,
    error:
      myProfileApi.error ||
      profileApi.error ||
      profileByUsernameApi.error ||
      searchProfilesApi.error ||
      updateProfileApi.error ||
      updateStatusApi.error,
  };
}