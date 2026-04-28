<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5 font-weight-bold">帳號管理</h1>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-account-plus" @click="openCreate">新增帳號</v-btn>
    </div>

    <v-card>
      <v-data-table :headers="headers" :items="users" :loading="loading" density="comfortable">
        <template #item.role="{ item }">
          <v-chip :color="roleColor(item.role)" size="small" variant="flat">{{ roleLabel(item.role) }}</v-chip>
        </template>
        <template #item.actions="{ item }">
          <v-btn icon="mdi-pencil" size="small" variant="text" @click="openEdit(item)" />
          <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="del(item)" />
        </template>
      </v-data-table>
    </v-card>

    <v-dialog v-model="dialog" max-width="500">
      <v-card>
        <v-card-title>{{ editing ? '編輯帳號' : '新增帳號' }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="form.username"
            label="帳號"
            :disabled="!!editing"
            variant="outlined"
            density="comfortable"
          />
          <v-text-field
            v-model="form.display_name"
            label="顯示名稱"
            variant="outlined"
            density="comfortable"
          />
          <v-text-field
            v-model="form.password"
            label="密碼"
            type="password"
            :placeholder="editing ? '留空表示不變更' : ''"
            variant="outlined"
            density="comfortable"
          />
          <v-select
            v-model="form.role"
            :items="roleOpts"
            label="角色"
            variant="outlined"
            density="comfortable"
          />
          <v-autocomplete
            v-model="form.member_id"
            :items="memberOpts"
            label="對應社員（幹事可空）"
            variant="outlined"
            density="comfortable"
            clearable
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">取消</v-btn>
          <v-btn color="primary" @click="save">儲存</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed, inject, onMounted } from 'vue'
import Swal from 'sweetalert2'
import { apiJson, apiFetch } from '../composables/apiFetch.js'

const membersApi = inject('members')

const users = ref([])
const loading = ref(false)
const dialog = ref(false)
const editing = ref(null)
const form = ref({})

const headers = [
  { title: '帳號', key: 'username' },
  { title: '顯示名稱', key: 'display_name' },
  { title: '角色', key: 'role' },
  { title: '對應社員', key: 'member_id', value: (it) => memberName(it.member_id) },
  { title: '操作', key: 'actions', sortable: false, align: 'end' },
]

const roleOpts = [
  { value: 'admin', title: 'admin（管理員）' },
  { value: 'staff', title: 'staff（幹事）' },
  { value: 'treasurer', title: 'treasurer（司庫）' },
  { value: 'president', title: 'president（社長）' },
  { value: 'secretary', title: 'secretary（祕書）' },
]

const memberOpts = computed(() =>
  membersApi.members.value.map((m) => ({
    value: m.id,
    title: m.name_en ? `${m.name_zh} ${m.name_en}` : m.name_zh,
  }))
)

function memberName(id) {
  const m = membersApi.members.value.find((x) => x.id === id)
  return m ? (m.name_en ? `${m.name_zh} ${m.name_en}` : m.name_zh) : ''
}

function roleLabel(r) {
  return Object.fromEntries(roleOpts.map((o) => [o.value, o.title.split('（')[1]?.replace('）', '') || o.title]))[r] || r
}

function roleColor(r) {
  return { admin: 'red', president: 'orange', treasurer: 'blue', staff: 'green', secretary: 'purple' }[r] || 'grey'
}

async function fetch() {
  loading.value = true
  try {
    users.value = await apiJson('/api/users')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  form.value = { role: 'staff' }
  dialog.value = true
}

function openEdit(item) {
  editing.value = item
  form.value = { ...item, password: '' }
  dialog.value = true
}

async function save() {
  try {
    if (editing.value) {
      const data = { ...form.value }
      if (!data.password) delete data.password
      await apiFetch(`/api/users/${editing.value.id}`, { method: 'PUT', body: JSON.stringify(data) })
    } else {
      await apiFetch('/api/users', { method: 'POST', body: JSON.stringify(form.value) })
    }
    dialog.value = false
    await fetch()
  } catch (e) {
    Swal.fire('儲存失敗', e.message, 'error')
  }
}

async function del(item) {
  const r = await Swal.fire({
    title: `刪除帳號 ${item.username}？`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#c62828',
    confirmButtonText: '刪除',
    cancelButtonText: '取消',
  })
  if (!r.isConfirmed) return
  await apiFetch(`/api/users/${item.id}`, { method: 'DELETE' })
  await fetch()
}

onMounted(fetch)
</script>
