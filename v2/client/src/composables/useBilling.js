import { ref } from 'vue'
import { apiJson, apiFetch } from './apiFetch.js'

const items = ref([])
const billings = ref([])
const loading = ref(false)

export function useBilling() {
  async function fetchItems(params = {}) {
    loading.value = true
    try {
      const qs = new URLSearchParams(params).toString()
      items.value = await apiJson(`/api/billing/items${qs ? '?' + qs : ''}`)
    } finally {
      loading.value = false
    }
  }

  async function fetchBillings(params = {}) {
    const qs = new URLSearchParams(params).toString()
    billings.value = await apiJson(`/api/billing${qs ? '?' + qs : ''}`)
  }

  async function fetchBilling(id) {
    return await apiJson(`/api/billing/${id}`)
  }

  async function generateMonthly(termId, period, year, month) {
    const res = await apiFetch('/api/billing/items/generate-monthly', {
      method: 'POST',
      body: JSON.stringify({ term_id: termId, period, year, month }),
    })
    return res.json()
  }

  async function createItem(data) {
    const res = await apiFetch('/api/billing/items', { method: 'POST', body: JSON.stringify(data) })
    return res.json()
  }

  async function updateItem(id, data) {
    await apiFetch(`/api/billing/items/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  }

  async function deleteItem(id) {
    await apiFetch(`/api/billing/items/${id}`, { method: 'DELETE' })
  }

  async function createBilling(data) {
    const res = await apiFetch('/api/billing', { method: 'POST', body: JSON.stringify(data) })
    return res.json()
  }

  async function logSend(billingId, data) {
    const res = await apiFetch(`/api/billing/${billingId}/send-log`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return res.json()
  }

  async function downloadPdf(billingId, filename) {
    const { useAuth } = await import('./useAuth.js')
    const { getToken } = useAuth()
    const res = await fetch(`/api/billing/${billingId}/pdf`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    if (!res.ok) throw new Error('PDF 下載失敗')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename || `billing-${billingId}.pdf`
    link.click()
    URL.revokeObjectURL(url)
  }

  function openPdfInNewTab(billingId) {
    // 用 token 走 fetch+blob 比直接開連結穩（連結沒辦法帶 Authorization）
    const { useAuth } = require('./useAuth.js')
    return downloadPdf(billingId)
  }

  return {
    items, billings, loading,
    fetchItems, fetchBillings, fetchBilling,
    generateMonthly, createItem, updateItem, deleteItem,
    createBilling, logSend, downloadPdf,
  }
}
