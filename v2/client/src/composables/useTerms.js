import { ref } from 'vue'
import { apiJson, apiFetch } from './apiFetch.js'

const terms = ref([])
const activeTerm = ref(null)
const currentTermId = ref(null)
const loading = ref(false)

export function useTerms() {
  async function fetchTerms() {
    loading.value = true
    try {
      terms.value = await apiJson('/api/terms')
      const active = await apiJson('/api/terms/active')
      activeTerm.value = active
      if (!currentTermId.value && active) currentTermId.value = active.id
    } finally {
      loading.value = false
    }
  }

  async function createTerm(data) {
    const res = await apiFetch('/api/terms', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    await fetchTerms()
    return res.json()
  }

  async function updateTerm(id, data) {
    await apiFetch(`/api/terms/${id}`, { method: 'PUT', body: JSON.stringify(data) })
    await fetchTerms()
  }

  async function deleteTerm(id) {
    await apiFetch(`/api/terms/${id}`, { method: 'DELETE' })
    await fetchTerms()
  }

  function setCurrentTerm(id) {
    currentTermId.value = id
  }

  return { terms, activeTerm, currentTermId, loading, fetchTerms, createTerm, updateTerm, deleteTerm, setCurrentTerm }
}
