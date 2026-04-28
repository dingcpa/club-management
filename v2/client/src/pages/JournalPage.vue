<template>
  <div>
    <div class="d-flex align-center mb-4 flex-wrap" style="gap: 8px;">
      <h1 class="text-h5 font-weight-bold">傳票</h1>
      <v-chip v-if="termId" size="small" color="primary" variant="flat">第 {{ termId }} 屆</v-chip>
      <v-spacer />
      <v-btn-toggle v-model="filterType" multiple density="comfortable" variant="outlined">
        <v-btn value="receipt" size="small" color="success">收</v-btn>
        <v-btn value="payment" size="small" color="error">付</v-btn>
        <v-btn value="advance" size="small" color="warning">代墊</v-btn>
        <v-btn value="transfer" size="small">轉帳</v-btn>
      </v-btn-toggle>
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">新傳票</v-btn>
    </div>

    <v-card>
      <v-data-table
        :headers="headers"
        :items="filteredEntries"
        :loading="loading"
        density="comfortable"
        :items-per-page="50"
      >
        <template #item.entry_no="{ item }">
          <span class="text-mono">{{ item.entry_no }}</span>
        </template>
        <template #item.entry_type="{ item }">
          <v-chip :color="typeColor(item.entry_type)" size="x-small" variant="flat">
            {{ typeLabel(item.entry_type) }}
          </v-chip>
        </template>
        <template #item.attachment_status="{ item }">
          <v-icon
            :icon="attachIcon(item.attachment_status)"
            :color="attachColor(item.attachment_status)"
            size="small"
          />
        </template>
        <template #item.entry_date="{ item }">{{ (item.entry_date || '').slice(0, 10) }}</template>
        <template #item.actions="{ item }">
          <v-btn icon="mdi-eye" size="small" variant="text" @click="openView(item)" />
        </template>
      </v-data-table>
    </v-card>

    <!-- 新增傳票 dialog -->
    <v-dialog v-model="dialog" max-width="900" scrollable>
      <v-card>
        <v-card-title class="d-flex align-center">
          新傳票
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" @click="dialog = false" />
        </v-card-title>
        <v-tabs v-model="entryType" align-tabs="center">
          <v-tab value="receipt" color="success">收（收到錢）</v-tab>
          <v-tab value="payment" color="error">付（付出錢）</v-tab>
          <v-tab value="advance" color="warning">代墊（社長/幹事先墊）</v-tab>
          <v-tab value="transfer">轉帳（內部轉移）</v-tab>
        </v-tabs>
        <v-divider />
        <v-card-text style="max-height: 75vh;">
          <v-row>
            <v-col cols="12" sm="6" md="3">
              <v-text-field
                v-model="form.entry_date"
                label="日期 *"
                placeholder="2026-04-29"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
            <v-col cols="12" sm="6" md="3" v-if="entryType !== 'advance'">
              <v-select
                v-model="form.cash_account_id"
                :items="cashOptions"
                :label="entryType === 'transfer' ? '從哪個帳戶 *' : '收/付帳戶 *'"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
            <v-col cols="12" sm="6" md="3" v-if="entryType === 'transfer'">
              <v-select
                v-model="form.dest_account_id"
                :items="cashOptions"
                label="轉到哪個帳戶 *"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
            <v-col cols="12" sm="6" md="3" v-if="entryType === 'advance'">
              <v-select
                v-model="form.payer_type"
                :items="payerTypeOpts"
                label="代墊人類型 *"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
            <v-col cols="12" sm="6" md="3" v-if="entryType === 'advance' && form.payer_type === 'member'">
              <v-autocomplete
                v-model="form.payer_member_id"
                :items="memberOpts"
                label="哪位社友 *"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
            <v-col cols="12" sm="6" md="3" v-if="entryType === 'advance' && form.payer_type !== 'member'">
              <v-text-field
                v-model="form.payer_name"
                label="代墊人名稱"
                placeholder="例: 陳幹事"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
            <v-col cols="12">
              <v-text-field
                v-model="form.summary"
                label="摘要"
                placeholder="例: 4 月份王子飯店例會餐費"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
          </v-row>

          <!-- 轉帳：只需金額 -->
          <div v-if="entryType === 'transfer'">
            <v-text-field
              v-model.number="transferAmount"
              label="轉帳金額"
              type="number"
              variant="outlined"
              density="comfortable"
            />
          </div>

          <!-- 其他類型：明細列表 -->
          <div v-else>
            <div class="d-flex align-center mb-2">
              <span class="text-subtitle-2">{{ linesLabel }}</span>
              <v-spacer />
              <v-btn variant="text" size="small" prepend-icon="mdi-plus" @click="addLine">加一行</v-btn>
            </div>
            <v-table density="compact">
              <thead>
                <tr>
                  <th style="width: 38%">科目 *</th>
                  <th style="width: 16%">金額 *</th>
                  <th v-if="entryType === 'receipt'" style="width: 22%">沖銷應收</th>
                  <th v-if="entryType !== 'transfer'" style="width: 18%">關聯社友</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(line, i) in form.lines" :key="i">
                  <td>
                    <v-autocomplete
                      v-model="line.account_id"
                      :items="lineAccountOpts"
                      density="compact"
                      variant="plain"
                      hide-details
                    />
                  </td>
                  <td>
                    <v-text-field
                      v-model.number="line.amount"
                      type="number"
                      density="compact"
                      variant="plain"
                      hide-details
                    />
                  </td>
                  <td v-if="entryType === 'receipt'">
                    <v-autocomplete
                      v-model="line.billing_item_id"
                      :items="billingItemOpts(line.member_id)"
                      placeholder="選擇沖銷項目"
                      density="compact"
                      variant="plain"
                      hide-details
                      clearable
                    />
                  </td>
                  <td v-if="entryType !== 'transfer'">
                    <v-autocomplete
                      v-model="line.member_id"
                      :items="memberOpts"
                      placeholder="選擇社友"
                      density="compact"
                      variant="plain"
                      hide-details
                      clearable
                    />
                  </td>
                  <td>
                    <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" @click="removeLine(i)" />
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td class="text-end font-weight-bold">合計</td>
                  <td class="font-weight-bold text-mono">{{ totalAmount.toLocaleString() }}</td>
                  <td colspan="3"></td>
                </tr>
              </tfoot>
            </v-table>
          </div>

          <v-divider class="my-3" />

          <v-row>
            <v-col cols="12" sm="4">
              <v-select
                v-model="form.attachment_status"
                :items="[
                  { value: 'pending', title: '⚠ 待補單據' },
                  { value: 'received', title: '✓ 已取得單據' },
                  { value: 'na', title: '不需單據' },
                ]"
                label="單據狀態"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
            <v-col cols="12" sm="8">
              <v-text-field v-model="form.remark" label="備註" variant="outlined" density="comfortable" />
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">取消</v-btn>
          <v-btn color="primary" :loading="saving" @click="save">儲存傳票</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 檢視傳票 dialog -->
    <v-dialog v-model="viewDialog" max-width="800">
      <v-card v-if="viewing">
        <v-card-title class="d-flex align-center">
          {{ viewing.entry_no }}
          <v-chip class="ms-2" :color="typeColor(viewing.entry_type)" size="small" variant="flat">
            {{ typeLabel(viewing.entry_type) }}
          </v-chip>
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" @click="viewDialog = false" />
        </v-card-title>
        <v-card-text>
          <div class="text-subtitle-2 mb-2">{{ viewing.summary }}</div>
          <div class="text-caption text-grey mb-3">
            {{ (viewing.entry_date || '').slice(0, 10) }}
            · {{ attachLabel(viewing.attachment_status) }}
            · 狀態: {{ viewing.status === 'reversed' ? '已沖銷' : '已過帳' }}
          </div>
          <v-table density="compact" class="mt-2">
            <thead>
              <tr>
                <th>科目</th>
                <th class="text-end">借</th>
                <th class="text-end">貸</th>
                <th>備註</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="l in viewing.lines" :key="l.id">
                <td><span class="text-mono">{{ l.account_code }}</span> {{ l.account_name }}</td>
                <td class="text-end text-mono">{{ l.debit ? l.debit.toLocaleString() : '' }}</td>
                <td class="text-end text-mono">{{ l.credit ? l.credit.toLocaleString() : '' }}</td>
                <td>{{ l.description }}</td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed, inject, onMounted, watch } from 'vue'
import Swal from 'sweetalert2'
import { apiJson } from '../composables/apiFetch.js'

const journalApi = inject('journal')
const billingApi = inject('billing')
const accountsApi = inject('accounts')
const membersApi = inject('members')
const termsApi = inject('terms')

const termId = computed(() => termsApi.currentTermId.value)
const { entries, loading, fetchEntries, createEntry, fetchEntry } = journalApi

const filterType = ref([])
const dialog = ref(false)
const viewDialog = ref(false)
const entryType = ref('receipt')
const saving = ref(false)
const viewing = ref(null)

const form = ref(makeBlankForm())
const transferAmount = ref(0)

function makeBlankForm() {
  return {
    entry_date: today(),
    summary: '',
    cash_account_id: null,
    dest_account_id: null,
    payer_type: 'staff',
    payer_member_id: null,
    payer_name: '',
    lines: [{ account_id: null, amount: 0 }],
    attachment_status: 'pending',
    remark: '',
  }
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

const headers = [
  { title: '傳票號', key: 'entry_no', width: 110 },
  { title: '日期', key: 'entry_date', width: 110 },
  { title: '類型', key: 'entry_type', width: 80 },
  { title: '單據', key: 'attachment_status', width: 60, align: 'center' },
  { title: '摘要', key: 'summary' },
  { title: '操作', key: 'actions', sortable: false, align: 'end' },
]

const filteredEntries = computed(() => {
  if (!filterType.value.length) return entries.value
  return entries.value.filter((e) => filterType.value.includes(e.entry_type))
})

const cashOptions = computed(() =>
  accountsApi.cashAccounts.value.map((a) => ({ value: a.id, title: `${a.code} ${a.name}` }))
)

const memberOpts = computed(() =>
  membersApi.members.value.map((m) => ({
    value: m.id,
    title: m.name_en ? `${m.name_zh} ${m.name_en}` : m.name_zh,
  }))
)

const payerTypeOpts = [
  { value: 'staff', title: '幹事 (受聘職員)' },
  { value: 'president', title: '社長' },
  { value: 'member', title: '社友' },
  { value: 'external', title: '其他' },
]

// 各 tab 對應的科目選擇範圍
const lineAccountOpts = computed(() => {
  if (entryType.value === 'receipt') {
    // 收：收入科目 + 應收沖銷（資產）
    return accountsApi.accounts.value
      .filter((a) => a.is_leaf && (a.type === 'income' || ['1130', '1140', '2160'].includes(a.code)))
      .map((a) => ({ value: a.id, title: `${a.code} ${a.name}` }))
  } else if (entryType.value === 'payment' || entryType.value === 'advance') {
    // 付/代墊：支出科目
    return accountsApi.expenseAccounts.value.map((a) => ({ value: a.id, title: `${a.code} ${a.name}` }))
  }
  return []
})

const linesLabel = computed(() => {
  if (entryType.value === 'receipt') return '收入明細（誰繳了什麼）'
  if (entryType.value === 'payment') return '支出明細（付了什麼）'
  if (entryType.value === 'advance') return '代墊支出明細'
  return ''
})

const totalAmount = computed(() =>
  form.value.lines.reduce((s, l) => s + Number(l.amount || 0), 0)
)

// 動態抓某社友的可沖銷應收項目
const billingItemsCache = ref({})
async function ensureBillingItems(memberId) {
  if (!memberId || billingItemsCache.value[memberId]) return
  const list = await apiJson(`/api/billing/items?member_id=${memberId}&only_open=1`)
  billingItemsCache.value[memberId] = list
}
function billingItemOpts(memberId) {
  if (!memberId) return []
  ensureBillingItems(memberId)
  return (billingItemsCache.value[memberId] || []).map((bi) => ({
    value: bi.id,
    title: `${bi.period || ''} ${bi.account_name} - $${bi.outstanding}`,
  }))
}

function addLine() {
  form.value.lines.push({ account_id: null, amount: 0 })
}
function removeLine(i) {
  form.value.lines.splice(i, 1)
  if (!form.value.lines.length) addLine()
}

function openCreate() {
  form.value = makeBlankForm()
  transferAmount.value = 0
  dialog.value = true
}

async function openView(item) {
  viewing.value = await fetchEntry(item.id)
  viewDialog.value = true
}

async function save() {
  if (!termId.value) {
    Swal.fire('請先選擇屆別', '', 'warning'); return
  }
  saving.value = true
  try {
    const payload = {
      term_id: termId.value,
      entry_date: form.value.entry_date,
      entry_type: entryType.value,
      summary: form.value.summary,
      attachment_status: form.value.attachment_status,
      remark: form.value.remark,
    }
    if (entryType.value === 'transfer') {
      payload.cash_account_id = form.value.cash_account_id
      payload.dest_account_id = form.value.dest_account_id
      payload.lines = [{ account_id: form.value.cash_account_id, amount: transferAmount.value }]
    } else if (entryType.value === 'advance') {
      // advance 走另一個 endpoint
      const apRes = await fetch('/api/advances', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('cf_token')}`,
        },
        body: JSON.stringify({
          payer_type: form.value.payer_type,
          payer_member_id: form.value.payer_member_id,
          payer_name: form.value.payer_name,
          term_id: termId.value,
          date: form.value.entry_date,
          summary: form.value.summary,
          attachment_status: form.value.attachment_status,
          remark: form.value.remark,
          lines: form.value.lines
            .filter((l) => l.account_id && l.amount)
            .map((l) => ({ account_id: l.account_id, amount: l.amount, description: l.description })),
        }),
      })
      if (!apRes.ok) {
        const err = await apRes.json().catch(() => ({}))
        throw new Error(err.error || '建立代墊單失敗')
      }
      saving.value = false
      dialog.value = false
      await fetchEntries({ term_id: termId.value })
      Swal.fire('已建立', '代墊單與對應傳票已產生', 'success')
      return
    } else {
      payload.cash_account_id = form.value.cash_account_id
      payload.lines = form.value.lines.filter((l) => l.account_id && l.amount)
      payload.billing_pay_items = form.value.lines
        .filter((l) => l.billing_item_id)
        .map((l) => l.billing_item_id)
    }
    await createEntry(payload)
    dialog.value = false
    await fetchEntries({ term_id: termId.value })
    Swal.fire('已過帳', '', 'success')
  } catch (e) {
    Swal.fire('儲存失敗', e.message, 'error')
  } finally {
    saving.value = false
  }
}

function typeLabel(t) {
  return { receipt: '收', payment: '付', advance: '代墊', transfer: '轉帳' }[t] || t
}
function typeColor(t) {
  return { receipt: 'success', payment: 'error', advance: 'warning', transfer: 'grey' }[t] || ''
}
function attachIcon(s) {
  return { pending: 'mdi-alert', received: 'mdi-check-circle', na: 'mdi-minus-circle-outline', none: 'mdi-help' }[s] || 'mdi-help'
}
function attachColor(s) {
  return { pending: 'warning', received: 'success', na: 'grey', none: 'grey' }[s] || 'grey'
}
function attachLabel(s) {
  return { pending: '待補單據', received: '已取得單據', na: '不需單據', none: '未設定' }[s] || s
}

watch(termId, (id) => {
  if (id) fetchEntries({ term_id: id })
})

onMounted(() => {
  if (termId.value) fetchEntries({ term_id: termId.value })
})
</script>
