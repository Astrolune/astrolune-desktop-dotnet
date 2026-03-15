import { useState, useCallback } from 'react';
import type { ChatMessage } from '../types';

interface UseChatProps {
  onSendMessage?: (message: string) => Promise<void>;
  onFileUpload?: (file: File) => Promise<void>;
  onPollCreate?: (question: string, options: string[]) => Promise<void>;
  onReactionAdd?: (messageId: string, emoji: string) => Promise<void>;
  onMessageAction?: (messageId: string, action: string) => Promise<void>;
}

export const useChat = ({
  onSendMessage,
  onFileUpload,
  onPollCreate,
  onReactionAdd,
  onMessageAction
}: UseChatProps = {}) => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const sendMessage = useCallback(async () => {
    if (!message.trim() || isSending) return;

    setIsSending(true);
    try {
      await onSendMessage?.(message.trim());
      setMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  }, [message, isSending, onSendMessage]);

  const uploadFile = useCallback(async (file: File) => {
    try {
      await onFileUpload?.(file);
    } catch (error) {
      console.error('Failed to upload file:', error);
    }
  }, [onFileUpload]);

  const createPoll = useCallback(async (question: string, options: string[]) => {
    try {
      await onPollCreate?.(question, options);
    } catch (error) {
      console.error('Failed to create poll:', error);
    }
  }, [onPollCreate]);

  const addReaction = useCallback(async (messageId: string, emoji: string) => {
    try {
      await onReactionAdd?.(messageId, emoji);
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
  }, [onReactionAdd]);

  const handleMessageAction = useCallback(async (messageId: string, action: string) => {
    try {
      await onMessageAction?.(messageId, action);
    } catch (error) {
      console.error('Failed to handle message action:', error);
    }
  }, [onMessageAction]);

  return {
    message,
    setMessage,
    isSending,
    messages,
    setMessages,
    sendMessage,
    uploadFile,
    createPoll,
    addReaction,
    handleMessageAction
  };
};