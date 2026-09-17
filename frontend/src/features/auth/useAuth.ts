import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { ApiError, apiFetch } from '@/api/client'
import type { LoginRequest, User } from '@/api/types'

export function useMe() {
  return useQuery<User | null>({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await apiFetch<User>('/auth/me')
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return null
        }
        throw error
      }
    },
    retry: false,
    staleTime: 60_000,
  })
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (credentials: LoginRequest) =>
      apiFetch<User>('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    onSuccess: (user) => {
      queryClient.setQueryData(['me'], user)
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<void>('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      queryClient.setQueryData(['me'], null)
    },
  })
}
