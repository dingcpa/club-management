<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5 font-weight-bold">代墊款</h1>
      <v-spacer />
      <v-switch
        v-model="onlyOpen"
        label="只看未還清"
        density="compact"
        hide-details
        class="me-3"
      />
    </div>

    <v-card>
      <v-data-table
        :headers="headers"
        :items="advances"
        :loading="loading"
        density="comfortable"
        :items-per-page="50"
      >
        <template #item.payer="{ item }">
          <span>{{ payerLabel(item) }}</span>
        </template>
        <template #item.date="{ item }">{{ (item.date || '').slice(0, 10) }}</template>
        <template #item.total_amount="{ item }">
          <span class="text-mono">{{ item.total_amount.toLocaleString() }}</span>
        </template>
        <template #item.outstanding="{ item }">
          <span class="text-mono" :class="item.outstanding > 0 ? 'text-warning font-weight-bold' : 'text-success'">
            {{ item.outstanding.toLocaleString() }}
          </span>
        </template>
        <template #item.status="{ item }">
          <v-chip size="x-small" :color="statusColor(item.status)" variant="flat">
            {{ statusLabel(item.status) }}
          </v-chip>
        </template>
        <template #item.actions="{ item }">
          <v-btn icon="mdi-eye" size="small" variant="text" @click="openView(item)" />
          <v-btn
            v-if="item.status !== 'closed'"
            icon="mdi-cash-refund"
            size="small"
            variant="text"
            color="success"
            @click="openRepay(item)"
          />
        </template>
      </v-data-table>
    </v-card>

    <!-- 檢視 / 還款 dialog -->
    <v-dialog v-model="viewDialog" max-width="700">
      <v-card v-if="viewing">
        <v-card-title>
          代墊單 #{{ viewing.id }}
          <v-chip class="ms-2" :color="statusColor(viewing.status)" size="small" variant="flat">{{ statusLabel(viewing.status) }}</v-chip>
        </v-card-title>
        <v-card-text>
          <div class="mb-2"><strong>代墊人：</strong>{{ payerLabel(viewing) }}</div>
          <div class="mb-2"><strong>日期：</strong>{{ (viewing.date || '').slice(0, 10) }}</div>
          <div class="mb-2"><strong>摘要：</strong>{{ viewing.summary }}</div>
          <div class="mb-2">
            <strong>總額：</strong>${{ viewing.total_amount.toLocaleString() }}
            <strong class="ms-3">已還：</strong>${{ viewing.paid_amount.toLocaleString() }}
            <strong class="ms-3">未還：</strong><span class="text-warning">${{ (viewing.total_amount - viewing.paid_amount).toLocaleString() }}</span>
          </div>
          <v-divider class="my-2" />
          <div class="text-subtitle-2 mb-2">代墊明細</div>
          <v-table density="compact">
            <thead><tr><th>科目</th><th>說明</th><th class="text-end">金額</th></tr></thead>
            <tbody>
              <tr v-for="l in viewing.lines" :key="l.id">
                <td><span class="text-mono">{{ l.account_code }}</span> {{ l.account_name }}</td>
                <td>{{ l.description }}</td>
                <td class="text-end text-mono">{{ l.amount.toLocaleString() }}</td>
              </tr>
            </tbody>
          </v-table>
          <v-divider class="my-3" />
          <div class="text-subtitle-2 mb-2">還款紀錄</div>
          <div v-if="!viewing.repayments?.length" class="text-grey text-caption">尚未還款</div>
          <v-table v-else density="compact">
            <thead><tr><th>日期</th><th class="text-end">金額</th><th>備註</th></tr></thead>
            <tbody>
              <tr v-for="r in viewing.repayments" :key="r.id">
                <td>{{ (r.date || '').slice(0, 10) }}</td>
                <td class="text-end text-mono">{{ r.amount.toLocaleString() }}</td>
                <td>{{ r.remark }}</td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
      </v-card>
    </v-dialog>

    <v-dialog v-model="repayDialog" max-width="500">
      <v-card v-if="repaying">
        <v-card-title>還款 — 代墊單 #{{ repaying.id }}</v-card-title>
        <v-card-text>
          <div class="mb-3 text-grey">代墊人：{{ payerLabel(repaying) }}</div>
          <div class="mb-3 text-grey">未還餘額：<span class="text-warning text-mono">${{ (repaying.total_amount - repaying.paid_amount).toLocaleString() }}</span></div>
          <v-row>
            <v-col cols="6">
              <v-text-field v-model="repayForm.date" label="還款日期" variant="outlined" density="comfortable" />
            </v-col>
            <v-col cols="6">
              <v-text-field v-model.number="repayForm.amount" label="還款金額" type="number" variant="outlined" density="comfortable" />
            </v-col>
            <v-col cols="12">
              <v-select
                v-model="repayForm.cash_account_id"
                :items="cashOptions"
                label="從哪個帳戶還"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
            <v-col cols="12">
              <v-text-field v-model="repayForm.remark" label="備註" variant="outlined" density="comfortable" />
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="repayDialog = false">取消</v-btn>
          <v-btn color="success" :loading="saving" @click="doRepay">還款</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed, inject, onMounted, watch } from 'vue'
import Swal from 'sweetalert2'

const advancesApi = inject('advances')
const accountsApi = inject('accounts')
const termsApi = inject('terms')

const { advances, loading, fetchAdvances, fetchAdvance, repay } = advancesApi

const onlyOpen = ref(false)
const viewDialog = ref(false)
const repayDialog = ref(false)
const viewing = ref(null)
const repaying = ref(null)
const saving = ref(false)
const repayForm = ref({})

const headers = [
  { title: '日期', key: 'date', width: 110 },
  { title: '代墊人', key: 'payer' },
  { title: '摘要', key: 'summary' },
  { title: '總額', key: 'total_amount', align: 'end' },
  { title: '未還', key: 'outstanding', align: 'end' },
  { title: '狀態', key: 'status', width: 90 },
  { title: '操作', key: 'actions', sortable: false, align: 'end' },
]

const cashOptions = computed(() =>
  accountsApi.cashAccounts.value.map((a) => ({ value: a.id, title: `${a.code} ${a.name}` }))
)

function payerLabel(item) {
  if (item.payer_type === 'member' && item.payer_member_name_zh) {
    return `${item.payer_member_name_zh}${item.payer_member_name_en ? ' ' + item.payer_member_name_en : ''} (社友)`
  }
  const map = { staff: '幹事', president: '社長', external: '其他' }
  return `${map[item.payer_type] || item.payer_type}${item.payer_name ? ': ' + item.payer_name : ''}`
}

function statusLabel(s) {
  return { open: '未還', partial: '部分還', closed: '已還清' }[s] || s
}
function statusColor(s) {
  return { open: 'warning', partial: 'orange', closed: 'success' }[s] || ''
}

async function openView(item) {
  viewing.value = await fetchAdvance(item.id)
  viewDialog.value = true
}

function openRepay(item) {
  repaying.value = item
  repayForm.value = {
    date: new Date().toISOString().slice(0, 10),
    amount: item.total_amount - item.paid_amount,
    cash_account_id: cashOptions.value[1]?.value || cashOptions.value[0]?.value,
    remark: '',
  }
  repayDialog.value = true
}

async function doRepay() {
  saving.value = true
  try {
    await repay(repaying.value.id, {
      ...repayForm.value,
      term_id: termsApi.currentTermId.value,
    })
    repayDialog.value = false
    await fetchAdvances(onlyOpen.value ? { only_open: 1 } : {})
    Swal.fire('已還款', '對應傳票已產生', 'success')
  } catch (e) {
    Swal.fire('還款失敗', e.message, 'error')
  } finally {
    saving.value = false
  }
}

watch(onlyOpen, (v) => {
  fetchAdvances(v ? { only_open: 1 } : {})
})

onMounted(() => fetchAdvances())
</script>
