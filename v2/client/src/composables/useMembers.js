import { ref } from 'vue'
import { apiJson, apiFetch } from './apiFetch.js'

const members = ref([])
const loading = ref(false)

export function useMembers() {
  async function fetchMembers(termId = null) {
    loading.value = true
    try {
      const url = termId ? `/api/members?term_id=${termId}` : '/api/members'
      members.value = await apiJson(url)
    } finally {
      loading.value = false
    }
  }

  async function fetchMember(id) {
    return await apiJson(`/api/members/${id}`)
  }

  async function createMember(data) {
    const res = await apiFetch('/api/members', { method: 'POST', body: JSON.stringify(data) })
    const r = await res.json()
    await fetchMembers()
    return r
  }

  async function updateMember(id, data) {
    await apiFetch(`/api/members/${id}`, { method: 'PUT', body: JSON.stringify(data) })
    await fetchMembers()
  }

  async function deleteMember(id) {
    await apiFetch(`/api/members/${id}`, { method: 'DELETE' })
    await fetchMembers()
  }

  async function upsertMemberTerm(memberId, data) {
    const res = await apiFetch(`/api/members/${memberId}/terms`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return res.json()
  }

  function memberLabel(m) {
    if (!m) return ''
    return m.name_en ? `${m.name_zh} ${m.name_en}` : m.name_zh
  }

  return {
    members, loading,
    fetchMembers, fetchMember, createMember, updateMember, deleteMember,
    upsertMemberTerm, memberLabel,
  }
}
