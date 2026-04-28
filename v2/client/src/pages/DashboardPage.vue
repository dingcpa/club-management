<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5 font-weight-bold">儀表板</h1>
      <v-spacer />
      <v-btn variant="outlined" size="small" prepend-icon="mdi-refresh" @click="refresh">重新整理</v-btn>
    </div>

    <v-alert v-if="!termId" type="info" class="mb-4">請先在側邊欄選擇屆別</v-alert>

    <div v-else>
      <!-- 一頁式儀表板（給理監事看） -->
      <v-row class="mb-2">
        <v-col cols="12" sm="6" md="3">
          <v-card>
            <v-card-text>
              <div class="text-caption text-grey">當前現金 + 銀行</div>
              <div class="text-h5 font-weight-bold">{{ fmt(dashboard?.cash_balance) }}</div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6" md="3">
          <v-card>
            <v-card-text>
              <div class="text-caption text-grey">本期累計收入</div>
              <div class="text-h5 font-weight-bold text-success">{{ fmt(dashboard?.total_income) }}</div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6" md="3">
          <v-card>
            <v-card-text>
              <div class="text-caption text-grey">本期累計支出</div>
              <div class="text-h5 font-weight-bold text-error">{{ fmt(dashboard?.total_expense) }}</div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6" md="3">
          <v-card>
            <v-card-text>
              <div class="text-caption text-grey">本期餘絀</div>
              <div :class="['text-h5 font-weight-bold', surplusColor]">{{ fmt(dashboard?.surplus) }}</div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-row>
        <!-- 應收 -->
        <v-col cols="12" md="6">
          <v-card>
            <v-card-title class="d-flex align-center">
              應收明細
              <v-spacer />
              <v-chip color="success" size="small" variant="flat">合計 {{ fmt(dashboard?.receivables.total) }}</v-chip>
            </v-card-title>
            <v-divider />
            <v-card-text class="pa-0">
              <v-table density="compact" hover>
                <thead>
                  <tr>
                    <th>社友</th>
                    <th class="text-right">未收款</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!dashboard?.receivables.by_member?.length">
                    <td colspan="2" class="text-center pa-4 text-grey">無未收款</td>
                  </tr>
                  <tr v-for="r in dashboard?.receivables.by_member" :key="r.member_id">
                    <td>{{ memberLabel(r) }}</td>
                    <td class="text-right text-mono">{{ fmt(r.outstanding) }}</td>
                  </tr>
                </tbody>
              </v-table>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- 應付 -->
        <v-col cols="12" md="6">
          <v-card>
            <v-card-title class="d-flex align-center">
              應付代墊款
              <v-spacer />
              <v-chip color="error" size="small" variant="flat">合計 {{ fmt(dashboard?.payables.total) }}</v-chip>
            </v-card-title>
            <v-divider />
            <v-card-text class="pa-0">
              <v-table density="compact" hover>
                <thead>
                  <tr>
                    <th>類別</th>
                    <th>對象</th>
                    <th class="text-right">未還</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!dashboard?.payables.by_person?.length">
                    <td colspan="3" class="text-center pa-4 text-grey">無未還代墊款</td>
                  </tr>
                  <tr v-for="(p, i) in dashboard?.payables.by_person" :key="i">
                    <td>{{ payerTypeLabel(p.payer_type) }}</td>
                    <td>{{ p.name_zh ? memberLabel(p) : (p.payer_name || '-') }}</td>
                    <td class="text-right text-mono">{{ fmt(p.outstanding) }}</td>
                  </tr>
                </tbody>
              </v-table>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-row class="mt-1">
        <v-col cols="12">
          <v-card color="grey-lighten-5" variant="flat">
            <v-card-text>
              <div class="text-caption text-grey">預期實質結餘 = 現金 + 應收 − 應付</div>
              <div class="text-h6 font-weight-bold">{{ fmt(dashboard?.expected_balance) }}</div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- 待補單據提醒 -->
      <v-card v-if="pendingAttachments.length" class="mt-4" color="warning" variant="tonal">
        <v-card-title class="d-flex align-center">
          <v-icon icon="mdi-alert" class="me-2" />
          待補單據（{{ pendingAttachments.length }}）
          <v-spacer />
          <v-btn variant="text" size="small" @click="navigate('journal')">前往傳票</v-btn>
        </v-card-title>
        <v-card-text>
          <v-table density="compact">
            <thead>
              <tr>
                <th>傳票號</th>
                <th>日期</th>
                <th>類型</th>
                <th>摘要</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="e in pendingAttachments.slice(0, 8)" :key="e.id">
                <td class="text-mono">{{ e.entry_no }}</td>
                <td>{{ (e.entry_date || '').slice(0, 10) }}</td>
                <td>{{ entryTypeLabel(e.entry_type) }}</td>
                <td>{{ e.summary }}</td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
      </v-card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject, onMounted, watch } from 'vue'

const termsApi = inject('terms')
const reportsApi = inject('reports')
const navigate = inject('navigate')

const termId = computed(() => termsApi.currentTermId.value)
const dashboard = ref(null)
const pendingAttachments = ref([])

async function refresh() {
  if (!termId.value) return
  dashboard.value = await reportsApi.fetchDashboard(termId.value)
  pendingAttachments.value = await reportsApi.fetchPendingAttachments(termId.value)
}

watch(termId, refresh)
onMounted(refresh)

function fmt(n) {
  if (n === undefined || n === null) return '$0'
  return '$' + Number(n).toLocaleString()
}

function memberLabel(m) {
  return m.name_en ? `${m.name_zh} ${m.name_en}` : m.name_zh
}

function payerTypeLabel(t) {
  return { staff: '幹事', president: '社長', member: '社友', external: '其他' }[t] || t
}

function entryTypeLabel(t) {
  return { receipt: '收', payment: '付', advance: '代墊', transfer: '轉帳' }[t] || t
}

const surplusColor = computed(() => {
  const s = dashboard.value?.surplus || 0
  return s > 0 ? 'text-success' : s < 0 ? 'text-error' : ''
})
</script>
