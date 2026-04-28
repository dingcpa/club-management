<template>
  <div>
    <div class="d-flex align-center mb-4 flex-wrap" style="gap: 8px;">
      <h1 class="text-h5 font-weight-bold">社員 / 職務</h1>
      <v-chip v-if="termId" size="small" color="primary" variant="flat">第 {{ termId }} 屆</v-chip>
      <v-spacer />
      <v-text-field
        v-model="search"
        placeholder="搜尋..."
        density="compact"
        variant="outlined"
        prepend-inner-icon="mdi-magnify"
        hide-details
        style="max-width: 200px;"
      />
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">新增社員</v-btn>
    </div>

    <v-card>
      <v-data-table
        :headers="headers"
        :items="filteredMembers"
        :loading="loading"
        :search="search"
        density="comfortable"
        :items-per-page="50"
      >
        <template #item.name="{ item }">
          <span class="font-weight-medium">{{ item.name_zh }}</span>
          <span v-if="item.name_en" class="text-primary text-caption ms-1">{{ item.name_en }}</span>
        </template>
        <template #item.term_role="{ item }">
          <v-chip v-if="item.term_role" size="x-small" :color="roleColor(item.term_role)" variant="flat">
            {{ item.term_role }}
          </v-chip>
        </template>
        <template #item.status="{ item }">
          <v-chip size="x-small" :color="item.status === 'active' ? 'success' : 'grey'" variant="flat">
            {{ statusLabel(item.status) }}
          </v-chip>
        </template>
        <template #item.actions="{ item }">
          <v-btn icon="mdi-pencil" size="small" variant="text" @click="openEdit(item)" />
          <v-btn icon="mdi-account-tie" size="small" variant="text" @click="openTermEdit(item)" />
        </template>
      </v-data-table>
    </v-card>

    <!-- 社員主檔 dialog -->
    <v-dialog v-model="memberDialog" max-width="640">
      <v-card>
        <v-card-title>{{ editing ? '編輯社員' : '新增社員' }}</v-card-title>
        <v-card-text>
          <v-row>
            <v-col cols="12" sm="6">
              <v-text-field v-model="form.name_zh" label="中文名 *" variant="outlined" density="comfortable" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="form.name_en" label="英文社名" placeholder="例: Tax / Attorney / Chef" variant="outlined" density="comfortable" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="form.classification" label="職業分類" variant="outlined" density="comfortable" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="form.occupation" label="詳細職業" variant="outlined" density="comfortable" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="form.phone" label="電話" variant="outlined" density="comfortable" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="form.email" label="Email" variant="outlined" density="comfortable" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="form.line_user_id" label="LINE userId" variant="outlined" density="comfortable" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-select
                v-model="form.preferred_channel"
                :items="[{ value: 'line', title: 'LINE 私訊' }, { value: 'email', title: 'Email' }, { value: 'paper', title: '紙本' }]"
                label="偏好聯絡管道"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="form.joined_date" label="入社日期 (YYYY-MM-DD)" variant="outlined" density="comfortable" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-select
                v-model="form.status"
                :items="[{ value: 'active', title: '在籍' }, { value: 'leave', title: '請假' }, { value: 'resigned', title: '退社' }]"
                label="狀態"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
          </v-row>
          <v-textarea v-model="form.remark" label="備註" rows="2" variant="outlined" density="comfortable" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="memberDialog = false">取消</v-btn>
          <v-btn color="primary" @click="save">儲存</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 職務 dialog -->
    <v-dialog v-model="termDialog" max-width="640">
      <v-card>
        <v-card-title>
          {{ editing?.name_zh }} — 第 {{ termId }} 屆職務
        </v-card-title>
        <v-card-text>
          <v-row>
            <v-col cols="12" sm="6">
              <v-select
                v-model="termForm.role"
                :items="roleOptions"
                label="角色"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="termForm.committee" label="委員會 (主委才填)" variant="outlined" density="comfortable" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="termForm.ratbed_group" label="爐邊組" variant="outlined" density="comfortable" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="termForm.neilun_group" label="內輪組" variant="outlined" density="comfortable" />
            </v-col>
            <v-col cols="6" sm="3">
              <v-text-field v-model.number="termForm.monthly_dues" label="會費" type="number" variant="outlined" density="comfortable" />
            </v-col>
            <v-col cols="6" sm="3">
              <v-text-field v-model.number="termForm.service_fund" label="服務基金" type="number" variant="outlined" density="comfortable" />
            </v-col>
            <v-col cols="6" sm="3">
              <v-text-field v-model.number="termForm.meal_fee" label="餐費" type="number" variant="outlined" density="comfortable" />
            </v-col>
            <v-col cols="6" sm="3">
              <v-text-field v-model.number="termForm.fixed_red_box" label="固定紅箱" type="number" variant="outlined" density="comfortable" />
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="termDialog = false">取消</v-btn>
          <v-btn color="primary" @click="saveTerm">儲存職務</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed, inject, onMounted } from 'vue'
import Swal from 'sweetalert2'

const membersApi = inject('members')
const termsApi = inject('terms')

const termId = computed(() => termsApi.currentTermId.value)
const { members, loading, fetchMembers, createMember, updateMember, upsertMemberTerm } = membersApi

const search = ref('')
const memberDialog = ref(false)
const termDialog = ref(false)
const editing = ref(null)
const form = ref({})
const termForm = ref({})

const headers = [
  { title: '姓名', key: 'name', value: 'name_zh' },
  { title: '職業', key: 'classification' },
  { title: '本屆職務', key: 'term_role' },
  { title: '狀態', key: 'status' },
  { title: '電話', key: 'phone' },
  { title: 'LINE', key: 'line_user_id', value: (it) => it.line_user_id ? '✓' : '' },
  { title: '操作', key: 'actions', sortable: false, align: 'end' },
]

const roleOptions = [
  { value: 'P', title: 'P 社長' },
  { value: 'PE', title: 'PE 社長當選人' },
  { value: 'VP', title: 'VP 副社長' },
  { value: 'Sec', title: 'Sec 祕書' },
  { value: 'Treasurer', title: '司庫' },
  { value: 'Director', title: '理事' },
  { value: 'Supervisor', title: '監事' },
  { value: 'Chair', title: '主委' },
  { value: 'PP', title: 'PP 前社長' },
  { value: 'Member', title: '社友' },
]

const filteredMembers = computed(() => members.value)

function statusLabel(s) {
  return { active: '在籍', leave: '請假', resigned: '退社' }[s] || s
}

function roleColor(role) {
  if (role === 'P') return 'red'
  if (['PE', 'VP', 'Sec', 'Treasurer'].includes(role)) return 'orange'
  if (['Director', 'Supervisor', 'Chair'].includes(role)) return 'blue'
  if (role === 'PP') return 'purple'
  return 'grey'
}

function openCreate() {
  editing.value = null
  form.value = { status: 'active', preferred_channel: 'line' }
  memberDialog.value = true
}

function openEdit(item) {
  editing.value = item
  form.value = { ...item, joined_date: (item.joined_date || '').slice(0, 10) }
  memberDialog.value = true
}

function openTermEdit(item) {
  editing.value = item
  termForm.value = {
    term_id: termId.value,
    role: item.term_role || 'Member',
    committee: item.committee,
    ratbed_group: item.ratbed_group,
    neilun_group: item.neilun_group,
    monthly_dues: item.monthly_dues ?? 1400,
    service_fund: item.service_fund ?? 800,
    meal_fee: item.meal_fee ?? 2000,
    fixed_red_box: item.fixed_red_box ?? 1300,
  }
  termDialog.value = true
}

async function save() {
  try {
    if (!form.value.name_zh) {
      Swal.fire('請輸入中文名', '', 'warning'); return
    }
    if (editing.value) {
      await updateMember(editing.value.id, form.value)
    } else {
      await createMember(form.value)
    }
    memberDialog.value = false
  } catch (e) {
    Swal.fire('儲存失敗', e.message, 'error')
  }
}

async function saveTerm() {
  try {
    await upsertMemberTerm(editing.value.id, termForm.value)
    await fetchMembers(termId.value)
    termDialog.value = false
  } catch (e) {
    Swal.fire('儲存失敗', e.message, 'error')
  }
}

onMounted(() => {
  if (!members.value.length) fetchMembers(termId.value)
})
</script>
