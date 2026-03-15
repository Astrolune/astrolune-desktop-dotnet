"use client"

import { useState, useCallback } from "react"
import { fetchWithOptionalAuth } from "../lib/auth/session"

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1"

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

interface UseApiOptions<T> {
  onSuccess?: (data: T) => void
  onError?: (error: string) => void
}

interface UseApiReturn<T> {
  data: T | null
  loading: boolean
  error: string | null
  request: (
    endpoint: string,
    method?: string,
    body?: unknown,
    headers?: Record<string, string>,
  ) => Promise<T>
  reset: () => void
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

const toErrorMessage = (payload: unknown, fallback: string) => {
  if (!isRecord(payload)) {
    return fallback
  }

  const directError = payload.error
  if (typeof directError === "string" && directError.trim()) {
    return directError
  }

  const message = payload.message
  if (typeof message === "string" && message.trim()) {
    return message
  }

  const detail = payload.detail
  if (typeof detail === "string" && detail.trim()) {
    return detail
  }

  return fallback
}

const resolvePayloadData = <T>(payload: unknown): T => {
  if (!isRecord(payload)) {
    return payload as T
  }

  const hasSuccessFlag = Object.prototype.hasOwnProperty.call(payload, "success")
  const hasOkFlag = Object.prototype.hasOwnProperty.call(payload, "ok")

  if ((hasSuccessFlag || hasOkFlag) && Object.prototype.hasOwnProperty.call(payload, "data")) {
    return payload.data as T
  }

  return payload as T
}

export function useApi<T = unknown>(options?: UseApiOptions<T>): UseApiReturn<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const request = useCallback(
    async (endpoint: string, method = "GET", body?: unknown, headers?: Record<string, string>): Promise<T> => {
      setLoading(true)
      setError(null)

      try {
        const isAbsoluteEndpoint = /^https?:\/\//i.test(endpoint)
        const requestUrl = isAbsoluteEndpoint ? endpoint : `${API_BASE_URL}${endpoint}`
        const config: RequestInit = {
          method,
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          credentials: "include",
        }

        if (body && method !== "GET") {
          config.body = JSON.stringify(body)
        }

        const response = await fetchWithOptionalAuth(requestUrl, config)

        if (response.status === 429) {
          throw new Error("Too many requests. Try again later.")
        }

        if (response.status === 401) {
          throw new Error("Authentication required. Please sign in again.")
        }

        const isJson = (response.headers.get("content-type") ?? "").includes("application/json")
        const result: unknown = isJson ? await response.json() : null

        if (!response.ok) {
          throw new Error(toErrorMessage(result, `Request failed (${response.status})`))
        }

        if (isRecord(result) && result.success === false) {
          throw new Error(toErrorMessage(result, "Request failed"))
        }

        const resolvedData = resolvePayloadData<T>(result)

        setData(resolvedData)
        options?.onSuccess?.(resolvedData)
        return resolvedData
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "An error occurred"
        setError(errorMessage)
        options?.onError?.(errorMessage)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [options],
  )

  const reset = useCallback(() => {
    setData(null)
    setError(null)
    setLoading(false)
  }, [])

  return { data, loading, error, request, reset }
}
