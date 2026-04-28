<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5 font-weight-bold">認捐單</h1>
      <v-chip v-if="termId" size="small" color="primary" variant="flat" class="ms-2">第 {{ termId }} 屆</v-chip>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">新認捐單</v-btn>
    </div>

    <v-card>
      <v-data-table
        :headers="headers"
        :items="drives"
        :loading="loading"
        density="comfortable"
        :items-per-page="50"
      >
        <template #item.type="{ item }">
          <v-chip size="x-small" :color="typeColor(item.type)" variant="flat">{{ typeLabel(item.type) }}</v-chip>
        </template>
        <template #item.total_pledged="{ item }">
          <span class="text-mono">{{ Number(item.total_pledged).toLocaleString() }}</span>
        </template>
        <template #item.status="{ item }">
          <v-chip size="x-small" :color="item.status === 'open' ? 'warning' : 'success'" variant="flat">
            {{ item.status === 'open' ? '收集中' : '已結單' }}
          </v-chip>
        </template>
        <template #item.actions="{ item }">
          <v-btn icon="mdi-pencil" size="small" variant="text" @click="openEdit(item)" />
        </template>
      </v-data-table>
    </v-card>

    <v-dialog v-model="dialog" max-width="900" scrollable>
      <v-card>
        <v-card-title class="d-flex align-center">
          {{ editing ? `編輯認捐單 — ${editing.title}` : '新認捐單' }}
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" @click="dialog = false" />
        </v-card-title>
        <v-card-text style="max-height: 75vh;">
          <v-row>
            <v-col cols="12" sm="3">
              <v-select
                v-model="form.type"
                :items="typeOpts"
                label="類型 *"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="form.title" label="標題 *" variant="outlined" density="comfortable" />
            </v-col>
            <v-col cols="12" sm="3">
              <v-text-field v-model="form.initiated_date" label="發起日期" variant="outlined" density="comfortable" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="form.occasion" label="緣由 / 對象" variant="outlined" density="comfortable" />
            </v-col>
            <v-col cols="12" sm="3">
              <v-autocomplete
                v-model="form.beneficiary_member_id"
                :items="memberOpts"
                label="受益社友（如紅白包）"
                variant="outlined"
                density="comfortable"
                clearable
              />
            </v-col>
            <v-col cols="12" sm="3">
              <v-text-field v-model="form.due_date" label="截止日" variant="outlined" density="comfortable" />
            </v-col>
          </v-row>
          <v-textarea v-model="form.remark" label="備註" rows="2" variant="outlined" density="comfortable" />

          <v-divider class="my-3" />
          <div class="d-flex align-center mb-2">
            <span class="text-subtitle-2">認捐金額（每位社友一格，可空白表示未認捐）</span>
            <v-spacer />
            <v-chip size="small" color="primary" variant="flat">
              合計 ${{ totalPledged.toLocaleString() }}
            </v-chip>
          </div>
          <v-table density="compact">
            <thead>
              <tr>
                <th>社友</th>
                <th class="text-end" style="width: 160px;">金額</th>
                <th>備註</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in membersApi.members.value" :key="m.id">
                <td>
                  <span class="font-weight-medium">{{ m.name_zh }}</span>
                  <span v-if="m.name_en" class="text-primary text-caption ms-1">{{ m.name_en }}</span>
                </td>
                <td>
                  <v-text-field
                    v-model.number="pledgeMap[m.id]"
                    type="number"
                    density="compact"
                    variant="plain"
                    hide-details
                    class="text-end"
                  />
                </td>
                <td>
                  <v-text-field
                    v-model="pledgeRemarks[m.id]"
                    density="compact"
                    variant="plain"
                    hide-details
                  />
                </td>
              </tr>
            </tbody>
          </v-table>

          <v-divider class="my-3" />
          <v-alert v-if="editing" type="info" variant="tonal" density="compact" class="mb-2">
            結單時請選擇對應收入科目（一般是 4240 歡喜紅箱、4250 其他紅箱、或代收款相關科目）
          </v-alert>
          <v-row v-if="editing">
            <v-col cols="6">
              <v-autocomplete
                v-model="closeAccountId"
                :items="incomeOpts"
                label="結單時的收入科目"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
            <v-col cols="6" class="d-flex align-center">
              <v-btn
                color="warning"
                variant="elevated"
                :disabled="!closeAccountId || editing.status === 'closed'"
                @click="doClose"
              >結單並轉為應收</v-btn>
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">取消</v-btn>
          <v-btn color="primary" :loading="saving" @click="save">儲存</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed, inject, onMounted, watch } from 'vue'
import Swal from 'sweetalert2'

const contributionsApi = inject('contributions')
const accountsApi = inject('accounts')
const membersApi = inject('members')
const termsApi = inject('terms')

const termId = computed(() => termsApi.currentTermId.value)
const { drives, loading, fetchDrives, fetchDrive, createDrive, updatePledges, closeDrive } = contributionsApi

const dialog = ref(false)
const saving = ref(false)
const editing = ref(null)
const closeAccountId = ref(null)
const form = ref({})
const pledgeMap = ref({})
const pledgeRemarks = ref({})

const typeOpts = [
  { value: 'red_envelope', title: '紅包（喜事）' },
  { value: 'white_envelope', title: '白包（喪事）' },
  { value: 'donation', title: '公益捐贈' },
  { value: 'trip_fee', title: '旅遊房費' },
  { value: 'external', title: '其他代收' },
]

const headers = [
  { title: '日期', key: 'initiated_date', value: (it) => (it.initiated_date || '').slice(0, 10), width: 110 },
  { title: '類型', key: 'type', width: 100 },
  { title: '標題', key: 'title' },
  { title: '緣由 / 對象', key: 'occasion' },
  { title: '認捐合計', key: 'total_pledged', align: 'end' },
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
  accountsApi.accounts.value
    .filter((a) => a.is_leaf && (a.type === 'income' || a.code === '2150'))
    .map((a) => ({ value: a.id, title: `${a.code} ${a.name}` }))
)

const totalPledged = computed(() =>
  Object.values(pledgeMap.value).reduce((s, v) => s + Number(v || 0), 0)
)

function typeLabel(t) {
  return Object.fromEntries(typeOpts.map((o) => [o.value, o.title]))[t] || t
}
function typeColor(t) {
  return { red_envelope: 'red', white_envelope: 'grey', donation: 'green', trip_fee: 'blue', external: 'orange' }[t] || ''
}

function openCreate() {
  editing.value = null
  form.value = {
    type: 'donation',
    title: '',
    occasion: '',
    initiated_date: new Date().toISOString().slice(0, 10),
    due_date: '',
    beneficiary_member_id: null,
    remark: '',
  }
  pledgeMap.value = {}
  pledgeRemarks.value = {}
  closeAccountId.value = null
  dialog.value = true
}

async function openEdit(item) {
  const detail = await fetchDrive(item.id)
  editing.value = detail
  form.value = {
    type: detail.type,
    title: detail.title,
    occasion: detail.occasion,
    initiated_date: (detail.initiated_date || '').slice(0, 10),
    due_date: (detail.due_date || '').slice(0, 10),
    beneficiary_member_id: detail.beneficiary_member_id,
    remark: detail.remark,
  }
  pledgeMap.value = Object.fromEntries(detail.pledges.map((p) => [p.member_id, p.amount]))
  pledgeRemarks.value = Object.fromEntries(detail.pledges.map((p) => [p.member_id, p.remark || '']))
  closeAccountId.value = null
  dialog.value = true
}

async function save() {
  if (!form.value.type || !form.value.title || !form.value.initiated_date) {
    Swal.fire('請填寫類型 / 標題 / 日期', '', 'warning'); return
  }
  saving.value = true
  try {
    let driveId = editing.value?.id
    if (!driveId) {
      const r = await createDrive({ ...form.value, term_id: termId.value })
      driveId = r.id
    }
    const pledges = Object.entries(pledgeMap.value)
      .filter(([, amt]) => amt && Number(amt) > 0)
      .map(([memberId, amt]) => ({
        member_id: parseInt(memberId),
        amount: Number(amt),
        remark: pledgeRemarks.value[memberId] || null,
      }))
    if (pledges.length) {
      await updatePledges(driveId, pledges)
    }
    dialog.value = false
    await fetchDrives({ term_id: termId.value })
    Swal.fire('已儲存', '', 'success')
  } catch (e) {
    Swal.fire('儲存失敗', e.message, 'error')
  } finally {
    saving.value = false
  }
}

async function doClose() {
  if (!closeAccountId.value) return
  const c = await Swal.fire({
    title: '確定結單？',
    text: '所有認捐金額會轉為對應社友的應收項目',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#ef6c00',
    confirmButtonText: '結單',
    cancelButtonText: '取消',
  })
  if (!c.isConfirmed) return
  try {
    await closeDrive(editing.value.id, closeAccountId.value)
    dialog.value = false
    await fetchDrives({ term_id: termId.value })
    Swal.fire('已結單', '應收項目已產生於各社友帳上', 'success')
  } catch (e) {
    Swal.fire('結單失敗', e.message, 'error')
  }
}

watch(termId, (id) => {
  if (id) fetchDrives({ term_id: id })
}, { immediate: true })

onMounted(() => {
  if (termId.value) fetchDrives({ term_id: termId.value })
})
</script>
