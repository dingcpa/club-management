import { ref, computed } from 'vue'
import { apiJson, apiFetch } from './apiFetch.js'

const accounts = ref([])
const tree = ref([])
const loading = ref(false)

export function useAccounts() {
  const cashAccounts = computed(() =>
    accounts.value.filter((a) => ['1110', '1120'].includes(a.code))
  )

  const incomeAccounts = computed(() =>
    accounts.value.filter((a) => a.type === 'income' && a.is_leaf)
  )

  const expenseAccounts = computed(() =>
    accounts.value.filter((a) => a.type === 'expense' && a.is_leaf)
  )

  const leafAccounts = computed(() =>
    accounts.value.filter((a) => a.is_leaf)
  )

  function findByCode(code) {
    return accounts.value.find((a) => a.code === code)
  }

  function findById(id) {
    return accounts.value.find((a) => a.id === id)
  }

  async function fetchAccounts() {
    loading.value = true
    try {
      accounts.value = await apiJson('/api/accounts')
    } finally {
      loading.value = false
    }
  }

  async function fetchTree() {
    tree.value = await apiJson('/api/accounts/tree')
  }

  async function createAccount(data) {
    await apiFetch('/api/accounts', { method: 'POST', body: JSON.stringify(data) })
    await fetchAccounts()
  }

  async function updateAccount(id, data) {
    await apiFetch(`/api/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) })
    await fetchAccounts()
  }

  async function deleteAccount(id) {
    await apiFetch(`/api/accounts/${id}`, { method: 'DELETE' })
    await fetchAccounts()
  }

  return {
    accounts, tree, loading,
    cashAccounts, incomeAccounts, expenseAccounts, leafAccounts,
    findByCode, findById,
    fetchAccounts, fetchTree, createAccount, updateAccount, deleteAccount,
  }
}
