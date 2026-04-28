import { ref } from 'vue'
import { apiJson, apiFetch } from './apiFetch.js'
import { useAuth } from './useAuth.js'

export function useReports() {
  async function fetchDashboard(termId) {
    return await apiJson(`/api/reports/dashboard?term_id=${termId}`)
  }

  async function fetchMonthly(termId, year, month) {
    return await apiJson(`/api/reports/monthly?term_id=${termId}&year=${year}&month=${month}`)
  }

  async function downloadMonthlyXlsx(termId, year, month) {
    const { getToken } = useAuth()
    const url = `/api/reports/monthly.xlsx?term_id=${termId}&year=${year}&month=${month}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } })
    if (!res.ok) throw new Error('下載失敗')
    const blob = await res.blob()
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${termId}屆-${year}年${month}月份收支明細表.xlsx`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  async function fetchPendingAttachments(termId) {
    const url = termId ? `/api/reports/pending-attachments?term_id=${termId}` : '/api/reports/pending-attachments'
    return await apiJson(url)
  }

  return { fetchDashboard, fetchMonthly, downloadMonthlyXlsx, fetchPendingAttachments }
}
