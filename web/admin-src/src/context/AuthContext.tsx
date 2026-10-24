import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { get, post, setCSRFToken, setUnauthorizedHandler } from '../api/client'
import type { LoginResult, MeResult } from '../api/types'

interface AuthContextValue {
  admin: { id: number; username: string } | null
  ready: boolean
  login: (
    username: string,
    password: string,
    captchaId: string,
    captchaCode: string,
    remember: boolean,
  ) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  admin: null,
  ready: false,
  login: async () => {},
  logout: async () => {},
  refresh: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [admin, setAdmin] = useState<{ id: number; username: string } | null>(null)
  const [ready, setReady] = useState(false)

  const clear = useCallback((): void => {
    setAdmin(null)
    setCSRFToken('')
  }, [])

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const { data } = await get<MeResult>('/admin/me')
      setAdmin(data.admin)
      setCSRFToken(data.csrf_token)
    } catch {
      clear()
    } finally {
      setReady(true)
    }
  }, [clear])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    setUnauthorizedHandler(() => clear())
  }, [clear])

  const login = useCallback(
    async (
      username: string,
      password: string,
      captchaId: string,
      captchaCode: string,
      remember: boolean,
    ): Promise<void> => {
      const { data } = await post<LoginResult>('/admin/login', {
        username,
        password,
        captcha_id: captchaId,
        captcha_code: captchaCode,
        remember,
      })
      setAdmin(data.admin)
      setCSRFToken(data.csrf_token)
    },
    [],
  )

  const logout = useCallback(async (): Promise<void> => {
    try {
      await post('/admin/logout')
    } catch {
      // 忽略登出错误
    }
    clear()
  }, [clear])

  return <AuthContext.Provider value={{ admin, ready, login, logout, refresh }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}
