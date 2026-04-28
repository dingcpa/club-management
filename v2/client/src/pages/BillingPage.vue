<template>
  <div>
    <div class="d-flex align-center mb-4 flex-wrap" style="gap: 8px;">
      <h1 class="text-h5 font-weight-bold">應收 / 請款</h1>
      <v-chip v-if="termId" size="small" color="primary" variant="flat">第 {{ termId }} 屆</v-chip>
      <v-spacer />
    </div>

    <v-tabs v-model="tab" bg-color="primary" density="compact">
      <v-tab value="items">應收項目</v-tab>
      <v-tab value="billings">請款單</v-tab>
    </v-tabs>
    <v-divider />

    <!-- 應收項目 tab -->
    <div v-if="tab === 'items'">
      <v-card class="mt-2">
        <v-card-text class="d-flex flex-wrap" style="gap: 8px;">
          <v-text-field
            v-model="period"
            label="期別 (例: 2026-07)"
            density="compact"
            variant="outlined"
            hide-details
            style="max-width: 180px;"
          />
          <v-text-field
            v-model.number="genYear"
            label="年"
            type="number"
            density="compact"
            variant="outlined"
            hide-details
            style="max-width: 100px;"
          />
          <v-text-field
            v-model.number="genMonth"
            label="月"
            type="number"
            density="compact"
            variant="outlined"
            hide-details
            style="max-width: 80px;"
          />
          <v-btn color="primary" prepend-icon="mdi-flash" @click="generateMonthly">
            批次產生月份社費
          </v-btn>
          <v-spacer />
          <v-btn variant="outlined" prepend-icon="mdi-plus" @click="openItemCreate">手動加項</v-btn>
        </v-card-text>
        <v-divider />
        <v-data-table
          :headers="itemHeaders"
          :items="items"
          :loading="loading"
          density="comfortable"
          :items-per-page="50"
        >
          <template #item.member="{ item }">
            <span class="font-weight-medium">{{ item.name_zh }}</span>
            <span v-if="item.name_en" class="text-primary text-caption ms-1">{{ item.name_en }}</span>
          </template>
          <template #item.amount="{ item }">
            <span class="text-mono">{{ item.amount.toLocaleString() }}</span>
          </template>
          <template #item.outstanding="{ item }">
            <span class="text-mono" :class="item.outstanding > 0 ? 'text-warning font-weight-bold' : ''">
              {{ item.outstanding.toLocaleString() }}
            </span>
          </template>
          <template #item.status="{ item }">
            <v-chip size="x-small" :color="statusColor(item.status)" variant="flat">
              {{ statusLabel(item.status) }}
            </v-chip>
          </template>
        </v-data-table>
      </v-card>
    </div>

    <!-- 請款單 tab -->
    <div v-else>
      <v-card class="mt-2">
        <v-card-text class="d-flex flex-wrap" style="gap: 8px;">
          <v-spacer />
          <v-btn color="primary" prepend-icon="mdi-receipt-text-plus" @click="openBillingCreate">
            開立請款單
          </v-btn>
        </v-card-text>
        <v-divider />
        <v-data-table
          :headers="billingHeaders"
          :items="billings"
          :loading="loading"
          density="comfortable"
          :items-per-page="50"
        >
          <template #item.member="{ item }">
            {{ item.name_zh }} <span v-if="item.name_en" class="text-primary text-caption">{{ item.name_en }}</span>
          </template>
          <template #item.total_amount="{ item }">
            <span class="text-mono">{{ item.total_amount.toLocaleString() }}</span>
          </template>
          <template #item.status="{ item }">
            <v-chip size="x-small" :color="billingStatusColor(item.status)" variant="flat">
              {{ billingStatusLabel(item.status) }}
            </v-chip>
          </template>
          <template #item.actions="{ item }">
            <v-btn icon="mdi-eye" size="small" variant="text" @click="openBillingView(item)" />
          </template>
        </v-data-table>
      </v-card>
    </div>

    <!-- 開立請款單 dialog -->
    <v-dialog v-model="billingDialog" max-width="800" scrollable>
      <v-card>
        <v-card-title class="d-flex align-center">
          開立請款單
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" @click="billingDialog = false" />
        </v-card-title>
        <v-card-text style="max-height: 75vh;">
          <v-row>
            <v-col cols="12" sm="6">
              <v-autocomplete
                v-model="billingForm.member_id"
                :items="memberOpts"
                label="選擇社友 *"
                variant="outlined"
                density="comfortable"
                @update:model-value="onMemberSelect"
              />
            </v-col>
            <v-col cols="12" sm="3">
              <v-text-field v-model="billingForm.issued_date" label="開立日期" variant="outlined" density="comfortable" />
            </v-col>
            <v-col cols="12" sm="3">
              <v-text-field v-model="billingForm.due_date" label="繳款期限" variant="outlined" density="comfortable" />
            </v-col>
          </v-row>

          <v-divider class="my-2" />
          <div class="text-subtitle-2 mb-2">
            選擇要請款的應收項目
            <v-chip v-if="memberOutstanding.length" size="x-small" class="ms-2" color="warning" variant="flat">
              共 {{ memberOutstanding.length }} 筆未繳，合計 ${{ totalSelected.toLocaleString() }}
            </v-chip>
          </div>
          <v-card v-if="!memberOutstanding.length" variant="tonal" color="grey-lighten-3">
            <v-card-text class="text-center text-grey">該社友目前無未繳款項。可在下方手動加項。</v-card-text>
          </v-card>
          <v-table v-else density="compact">
            <thead>
              <tr>
                <th><v-checkbox v-model="selectAll" hide-details density="compact" /></th>
                <th>期別</th>
                <th>項目</th>
                <th class="text-end">未繳金額</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="bi in memberOutstanding" :key="bi.id">
                <td>
                  <v-checkbox v-model="billingForm.billing_item_ids" :value="bi.id" hide-details density="compact" />
                </td>
                <td>{{ bi.period }}</td>
                <td>{{ bi.account_name }} <span class="text-caption text-grey">{{ bi.description }}</span></td>
                <td class="text-end text-mono">{{ bi.outstanding.toLocaleString() }}</td>
              </tr>
            </tbody>
          </v-table>

          <v-divider class="my-3" />
          <div class="d-flex align-center mb-2">
            <span class="text-subtitle-2">手動加項（後補應收）</span>
            <v-spacer />
            <v-btn variant="text" size="small" prepend-icon="mdi-plus" @click="addExtra">加一行</v-btn>
          </div>
          <v-table v-if="billingForm.extra_items.length" density="compact">
            <thead>
              <tr>
                <th style="width: 30%">科目</th>
                <th style="width: 18%">期別</th>
                <th style="width: 30%">說明</th>
                <th style="width: 16%" class="text-end">金額</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(ex, i) in billingForm.extra_items" :key="i">
                <td>
                  <v-autocomplete
                    v-model="ex.account_id"
                    :items="incomeOpts"
                    density="compact"
                    variant="plain"
                    hide-details
                  />
                </td>
                <td><v-text-field v-model="ex.period" density="compact" variant="plain" hide-details /></td>
                <td><v-text-field v-model="ex.description" density="compact" variant="plain" hide-details /></td>
                <td><v-text-field v-model.number="ex.amount" type="number" density="compact" variant="plain" hide-details class="text-end" /></td>
                <td><v-btn icon="mdi-delete" size="x-small" variant="text" color="error" @click="billingForm.extra_items.splice(i, 1)" /></td>
              </tr>
            </tbody>
          </v-table>

          <v-divider class="my-3" />
          <div class="text-h6 text-end">
            合計請款金額：<span class="text-mono">${{ totalBillingAmount.toLocaleString() }}</span>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="billingDialog = false">取消</v-btn>
          <v-btn color="primary" :loading="saving" @click="saveBilling">建立請款單</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 檢視請款單 -->
    <v-dialog v-model="viewDialog" max-width="700">
      <v-card v-if="viewing">
        <v-card-title class="d-flex align-center">
          {{ viewing.billing_no }}
          <v-chip class="ms-2" :color="billingStatusColor(viewing.status)" size="small" variant="flat">
            {{ billingStatusLabel(viewing.status) }}
          </v-chip>
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" @click="viewDialog = false" />
        </v-card-title>
        <v-card-text>
          <div class="mb-2">
            <strong>社友：</strong>{{ viewing.name_zh }} {{ viewing.name_en }}
          </div>
          <div class="mb-2">
            <strong>開立：</strong>{{ (viewing.issued_date || '').slice(0, 10) }}
            <strong class="ms-3">期限：</strong>{{ (viewing.due_date || '').slice(0, 10) }}
          </div>
          <v-table density="compact" class="mt-2">
            <thead>
              <tr><th>項目</th><th class="text-end">金額</th></tr>
            </thead>
            <tbody>
              <tr v-for="l in viewing.lines" :key="l.id">
                <td>{{ l.label }} <span class="text-caption text-grey">{{ l.item_description }}</span></td>
                <td class="text-end text-mono">{{ Number(l.amount).toLocaleString() }}</td>
              </tr>
              <tr>
                <td class="font-weight-bold text-end">合計</td>
                <td class="font-weight-bold text-mono text-end">${{ viewing.total_amount.toLocaleString() }}</td>
              </tr>
            </tbody>
          </v-table>

          <v-divider class="my-3" />
          <div class="text-subtitle-2 mb-2">發送紀錄</div>
          <div v-if="!viewing.send_logs?.length" class="text-grey text-caption">尚未發送</div>
          <v-table v-else density="compact">
            <thead><tr><th>管道</th><th>狀態</th><th>時間</th><th>備註</th></tr></thead>
            <tbody>
              <tr v-for="l in viewing.send_logs" :key="l.id">
                <td>{{ channelLabel(l.channel) }}</td>
                <td>{{ l.status }}</td>
                <td>{{ (l.sent_at || '').slice(0, 19).replace('T', ' ') }}</td>
                <td>{{ l.remark }}</td>
              </tr>
            </tbody>
          </v-table>

          <div class="mt-3">
            <v-btn-group variant="outlined" density="comfortable">
              <v-btn prepend-icon="mdi-line" @click="logSend('line')">標記 LINE 私訊已發送</v-btn>
              <v-btn prepend-icon="mdi-email" @click="logSend('email')">標記 Email 已寄</v-btn>
              <v-btn prepend-icon="mdi-printer" @click="logSend('paper')">標記紙本已交</v-btn>
            </v-btn-group>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed, inject, onMounted, watch } from 'vue'
import Swal from 'sweetalert2'
import { apiJson } from '../composables/apiFetch.js'

const billingApi = inject('billing')
const accountsApi = inject('accounts')
const membersApi = inject('members')
const termsApi = inject('terms')

const termId = computed(() => termsApi.currentTermId.value)
const tab = ref('items')
const period = ref('')
const genYear = ref(new Date().getFullYear())
const genMonth = ref(new Date().getMonth() + 1)
const billingDialog = ref(false)
const viewDialog = ref(false)
const viewing = ref(null)
const saving = ref(false)

const { items, billings, loading, fetchItems, fetchBillings, fetchBilling, generateMonthly: gen, createBilling, logSend: logSendApi } = billingApi

const billingForm = ref({
  member_id: null,
  issued_date: today(),
  due_date: '',
  billing_item_ids: [],
  extra_items: [],
})
const memberOutstanding = ref([])

function today() {
  return new Date().toISOString().slice(0, 10)
}

const itemHeaders = [
  { title: '社友', key: 'member' },
  { title: '期別', key: 'period', width: 110 },
  { title: '項目', key: 'account_name' },
  { title: '說明', key: 'description' },
  { title: '金額', key: 'amount', align: 'end', width: 100 },
  { title: '未繳', key: 'outstanding', align: 'end', width: 100 },
  { title: '狀態', key: 'status', width: 90 },
]

const billingHeaders = [
  { title: '請款單號', key: 'billing_no', width: 110 },
  { title: '社友', key: 'member' },
  { title: '開立', key: 'issued_date', value: (it) => (it.issued_date || '').slice(0, 10), width: 110 },
  { title: '期限', key: 'due_date', value: (it) => (it.due_date || '').slice(0, 10), width: 110 },
  { title: '金額', key: 'total_amount', align: 'end' },
  { title: '狀態', key: 'status', width: 90 },
  { title: '操作', key: 'actions', sortable: false, align: 'end' },
]

const memberOpts = computed(() =>
  membersApi.members.value.map((m) => ({
    value: m.id,
    title: m.name_en ? `${m.name_zh} ${m.name_en}` : m.name_zh,
  }))
)

const incomeOpts = computed(() =>
  accountsApi.incomeAccounts.value.map((a) => ({ value: a.id, title: `${a.code} ${a.name}` }))
)

const totalSelected = computed(() => {
  const ids = new Set(billingForm.value.billing_item_ids)
  return memberOutstanding.value
    .filter((bi) => ids.has(bi.id))
    .reduce((s, bi) => s + bi.outstanding, 0)
})

const totalExtra = computed(() =>
  billingForm.value.extra_items.reduce((s, e) => s + Number(e.amount || 0), 0)
)

const totalBillingAmount = computed(() => totalSelected.value + totalExtra.value)

const selectAll = computed({
  get: () => memberOutstanding.value.length > 0 && billingForm.value.billing_item_ids.length === memberOutstanding.value.length,
  set: (v) => {
    billingForm.value.billing_item_ids = v ? memberOutstanding.value.map((b) => b.id) : []
  },
})

async function generateMonthly() {
  if (!termId.value || !period.value || !genYear.value || !genMonth.value) {
    Swal.fire('請填寫期別與年月', '', 'warning'); return
  }
  try {
    const r = await gen(termId.value, period.value, genYear.value, genMonth.value)
    Swal.fire('已產生', `共產生 ${r.generated} 筆應收項目`, 'success')
    await fetchItems({ term_id: termId.value })
  } catch (e) {
    Swal.fire('產生失敗', e.message, 'error')
  }
}

function openItemCreate() {
  Swal.fire('提示', '可在「傳票」頁直接記錄收支；單筆應收手動加項建議從請款單流程進入。', 'info')
}

function openBillingCreate() {
  billingForm.value = {
    member_id: null,
    issued_date: today(),
    due_date: '',
    billing_item_ids: [],
    extra_items: [],
  }
  memberOutstanding.value = []
  billingDialog.value = true
}

async function onMemberSelect(memberId) {
  if (!memberId) return
  memberOutstanding.value = await apiJson(`/api/billing/items?member_id=${memberId}&only_open=1`)
  // 預設全選未繳
  billingForm.value.billing_item_ids = memberOutstanding.value.map((b) => b.id)
}

function addExtra() {
  billingForm.value.extra_items.push({ description: '', amount: 0, account_id: null, period: period.value })
}

async function saveBilling() {
  if (!billingForm.value.member_id || !billingForm.value.issued_date) {
    Swal.fire('請填寫社友與日期', '', 'warning'); return
  }
  saving.value = true
  try {
    const payload = {
      term_id: termId.value,
      member_id: billingForm.value.member_id,
      issued_date: billingForm.value.issued_date,
      due_date: billingForm.value.due_date || null,
      billing_item_ids: billingForm.value.billing_item_ids,
      extra_items: billingForm.value.extra_items.filter((e) => e.amount && e.account_id),
    }
    const r = await createBilling(payload)
    billingDialog.value = false
    await fetchBillings({ term_id: termId.value })
    Swal.fire('已建立', `請款單 ${r.billing_no} 金額 $${Number(r.total_amount).toLocaleString()}`, 'success')
  } catch (e) {
    Swal.fire('建立失敗', e.message, 'error')
  } finally {
    saving.value = false
  }
}

async function openBillingView(item) {
  viewing.value = await fetchBilling(item.id)
  viewDialog.value = true
}

async function logSend(channel) {
  await logSendApi(viewing.value.id, { channel, status: 'sent' })
  viewing.value = await fetchBilling(viewing.value.id)
}

function statusLabel(s) {
  return { open: '未繳', partial: '部分繳', paid: '已繳', waived: '免繳', carried: '結轉' }[s] || s
}
function statusColor(s) {
  return { open: 'warning', partial: 'orange', paid: 'success', waived: 'grey', carried: 'blue' }[s] || ''
}
function billingStatusLabel(s) {
  return { issued: '已開立', paid: '已繳清', partial: '部分繳', cancelled: '取消' }[s] || s
}
function billingStatusColor(s) {
  return { issued: 'warning', paid: 'success', partial: 'orange', cancelled: 'grey' }[s] || ''
}
function channelLabel(c) {
  return { line: 'LINE', email: 'Email', paper: '紙本', manual: '手動' }[c] || c
}

watch(termId, async (id) => {
  if (id) {
    await Promise.all([
      fetchItems({ term_id: id }),
      fetchBillings({ term_id: id }),
    ])
  }
}, { immediate: true })

onMounted(() => {
  if (termId.value) {
    fetchItems({ term_id: termId.value })
    fetchBillings({ term_id: termId.value })
  }
})
</script>
