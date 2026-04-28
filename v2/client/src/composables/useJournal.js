import { ref } from 'vue'
import { apiJson, apiFetch } from './apiFetch.js'

const entries = ref([])
const loading = ref(false)

export function useJournal() {
  async function fetchEntries(params = {}) {
    loading.value = true
    try {
      const qs = new URLSearchParams(params).toString()
      entries.value = await apiJson(`/api/journal${qs ? '?' + qs : ''}`)
    } finally {
      loading.value = false
    }
  }

  async function fetchEntry(id) {
    return await apiJson(`/api/journal/${id}`)
  }

  async function createEntry(data) {
    const res = await apiFetch('/api/journal', { method: 'POST', body: JSON.stringify(data) })
    return res.json()
  }

  async function reverseEntry(id) {
    const res = await apiFetch(`/api/journal/${id}/reverse`, { method: 'POST' })
    return res.json()
  }

  return { entries, loading, fetchEntries, fetchEntry, createEntry, reverseEntry }
}
