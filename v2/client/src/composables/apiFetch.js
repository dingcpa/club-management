import { useAuth } from './useAuth.js'

export async function apiFetch(url, options = {}) {
  const { getToken, logout } = useAuth()
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  }
  const res = await fetch(url, { ...options, headers })
  if (res.status === 401) {
    logout()
    location.reload()
    return
  }
  if (!res.ok) {
    let err = {}
    try { err = await res.json() } catch {}
    throw new Error(err.error || `Request failed: ${res.status}`)
  }
  return res
}

export async function apiJson(url, options = {}) {
  const res = await apiFetch(url, options)
  return res.json()
}
