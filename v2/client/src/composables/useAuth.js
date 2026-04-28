import { ref, computed } from 'vue'

const TOKEN_KEY = 'cf_token'
const USER_KEY = 'cf_user'

const token = ref(localStorage.getItem(TOKEN_KEY) || '')
const user = ref(JSON.parse(localStorage.getItem(USER_KEY) || 'null'))

export function useAuth() {
  const isAuthenticated = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const isStaff = computed(() => user.value?.role === 'staff')
  const isTreasurer = computed(() => user.value?.role === 'treasurer')
  const isPresident = computed(() => user.value?.role === 'president')
  const canEditFinance = computed(() => ['admin', 'staff', 'treasurer'].includes(user.value?.role))

  async function login(username, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || '登入失敗')
    }
    const data = await res.json()
    token.value = data.token
    user.value = {
      username,
      displayName: data.displayName,
      role: data.role,
      memberId: data.memberId,
    }
    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(USER_KEY, JSON.stringify(user.value))
  }

  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  function getToken() {
    return token.value
  }

  return {
    isAuthenticated, isAdmin, isStaff, isTreasurer, isPresident, canEditFinance,
    user, token, login, logout, getToken,
  }
}
