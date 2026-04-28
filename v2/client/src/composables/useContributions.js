import { ref } from 'vue'
import { apiJson, apiFetch } from './apiFetch.js'

const drives = ref([])
const loading = ref(false)

export function useContributions() {
  async function fetchDrives(params = {}) {
    loading.value = true
    try {
      const qs = new URLSearchParams(params).toString()
      drives.value = await apiJson(`/api/contributions${qs ? '?' + qs : ''}`)
    } finally {
      loading.value = false
    }
  }

  async function fetchDrive(id) {
    return await apiJson(`/api/contributions/${id}`)
  }

  async function createDrive(data) {
    const res = await apiFetch('/api/contributions', { method: 'POST', body: JSON.stringify(data) })
    return res.json()
  }

  async function updatePledges(driveId, pledges) {
    await apiFetch(`/api/contributions/${driveId}/pledges`, {
      method: 'PUT',
      body: JSON.stringify({ pledges }),
    })
  }

  async function closeDrive(driveId, accountId) {
    const res = await apiFetch(`/api/contributions/${driveId}/close`, {
      method: 'POST',
      body: JSON.stringify({ account_id: accountId }),
    })
    return res.json()
  }

  return { drives, loading, fetchDrives, fetchDrive, createDrive, updatePledges, closeDrive }
}
