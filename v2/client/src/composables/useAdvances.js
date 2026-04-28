import { ref } from 'vue'
import { apiJson, apiFetch } from './apiFetch.js'

const advances = ref([])
const loading = ref(false)

export function useAdvances() {
  async function fetchAdvances(params = {}) {
    loading.value = true
    try {
      const qs = new URLSearchParams(params).toString()
      advances.value = await apiJson(`/api/advances${qs ? '?' + qs : ''}`)
    } finally {
      loading.value = false
    }
  }

  async function fetchAdvance(id) {
    return await apiJson(`/api/advances/${id}`)
  }

  async function createAdvance(data) {
    const res = await apiFetch('/api/advances', { method: 'POST', body: JSON.stringify(data) })
    return res.json()
  }

  async function repay(id, data) {
    const res = await apiFetch(`/api/advances/${id}/repay`, { method: 'POST', body: JSON.stringify(data) })
    return res.json()
  }

  async function deleteAdvance(id) {
    await apiFetch(`/api/advances/${id}`, { method: 'DELETE' })
  }

  return { advances, loading, fetchAdvances, fetchAdvance, createAdvance, repay, deleteAdvance }
}
