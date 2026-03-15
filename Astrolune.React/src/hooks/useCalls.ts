import { useApi } from './useApi';
import { useCallback } from 'react';

interface Profile {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  status?: string;
}

interface Call {
  id: string;
  room_name: string;
  room_sid?: string;
  type: 'direct' | 'group';
  creator_id: string;
  status: 'active' | 'ended' | 'missed';
  started_at: string;
  ended_at?: string;
  duration?: number;
  metadata?: unknown;
  created_at: string;
  updated_at: string;
}

interface CallParticipant {
  id: string;
  call_id: string;
  user_id: string;
  role: 'creator' | 'caller' | 'participant';
  joined_at: string;
  left_at?: string;
  duration?: number;
  status: 'calling' | 'joined' | 'declined' | 'missed' | 'left';
  created_at: string;
  profile?: Profile;
}

interface CallWithParticipants extends Call {
  participants: CallParticipant[];
  creator?: Profile;
}

interface CallResponse {
  call: Call;
  room: {
    name: string;
    sid: string;
    max_participants?: number;
    num_participants?: number;
    created_at?: number;
    recipient_id?: string;
  };
  token: string;
}

export function useCalls() {
  const createGroupCallApi = useApi<CallResponse>();
  const initiateDirectCallApi = useApi<CallResponse>();
  const joinCallApi = useApi<CallResponse>();
  const declineCallApi = useApi();
  const leaveCallApi = useApi();
  const getCallInfoApi = useApi<CallWithParticipants>();
  const getCallHistoryApi = useApi<CallWithParticipants[]>();
  const getActiveCallsApi = useApi<CallWithParticipants[]>();
  const getMissedCallsApi = useApi<CallWithParticipants[]>();
  const endCallApi = useApi();

  const createGroupCall = useCallback(
    (participant_ids?: string[], max_participants?: number, metadata?: unknown) =>
      createGroupCallApi.request('/calls/group', 'POST', {
        participant_ids,
        max_participants,
        metadata,
      }),
    [createGroupCallApi]
  );

  const initiateDirectCall = useCallback(
    (recipient_id: string) =>
      initiateDirectCallApi.request('/calls/direct', 'POST', { recipient_id }),
    [initiateDirectCallApi]
  );

  const joinCall = useCallback(
    (room_name: string) => joinCallApi.request('/calls/join', 'POST', { room_name }),
    [joinCallApi]
  );

  const declineCall = useCallback(
    (call_id: string) => declineCallApi.request('/calls/decline', 'POST', { call_id }),
    [declineCallApi]
  );

  const leaveCall = useCallback(
    (call_id: string) => leaveCallApi.request('/calls/leave', 'POST', { call_id }),
    [leaveCallApi]
  );

  const getCallInfo = useCallback(
    (call_id: string) => getCallInfoApi.request(`/calls/${call_id}`),
    [getCallInfoApi]
  );

  const getCallHistory = useCallback(
    (page?: number, limit?: number) => {
      const params = new URLSearchParams();
      if (page) params.append('page', page.toString());
      if (limit) params.append('limit', limit.toString());
      const queryString = params.toString();
      return getCallHistoryApi.request(`/calls/history${queryString ? `?${queryString}` : ''}`);
    },
    [getCallHistoryApi]
  );

  const getActiveCalls = useCallback(
    () => getActiveCallsApi.request('/calls/active'),
    [getActiveCallsApi]
  );

  const getMissedCalls = useCallback(
    () => getMissedCallsApi.request('/calls/missed'),
    [getMissedCallsApi]
  );

  const endCall = useCallback(
    (call_id: string) => endCallApi.request(`/calls/${call_id}`, 'DELETE'),
    [endCallApi]
  );

  return {
    createGroupCall,
    initiateDirectCall,
    joinCall,
    declineCall,
    leaveCall,
    getCallInfo,
    getCallHistory,
    getActiveCalls,
    getMissedCalls,
    endCall,
    callResponse: initiateDirectCallApi.data || createGroupCallApi.data || joinCallApi.data,
    callInfo: getCallInfoApi.data,
    callHistory: getCallHistoryApi.data,
    activeCalls: getActiveCallsApi.data,
    missedCalls: getMissedCallsApi.data,
    loading:
      createGroupCallApi.loading ||
      initiateDirectCallApi.loading ||
      joinCallApi.loading ||
      declineCallApi.loading ||
      leaveCallApi.loading ||
      getCallInfoApi.loading ||
      getCallHistoryApi.loading ||
      getActiveCallsApi.loading ||
      getMissedCallsApi.loading ||
      endCallApi.loading,
    error:
      createGroupCallApi.error ||
      initiateDirectCallApi.error ||
      joinCallApi.error ||
      declineCallApi.error ||
      leaveCallApi.error ||
      getCallInfoApi.error ||
      getCallHistoryApi.error ||
      getActiveCallsApi.error ||
      getMissedCallsApi.error ||
      endCallApi.error,
  };
}
