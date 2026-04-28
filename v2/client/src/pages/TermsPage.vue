<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5 font-weight-bold">屆別管理</h1>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">新增屆別</v-btn>
    </div>

    <v-card>
      <v-data-table
        :headers="headers"
        :items="terms"
        :loading="loading"
        density="comfortable"
        :items-per-page="50"
      >
        <template #item.id="{ item }">
          <span class="font-weight-bold">第 {{ item.id }} 屆</span>
        </template>
        <template #item.status="{ item }">
          <v-chip :color="item.status === 'active' ? 'success' : 'grey'" size="small" variant="flat">
            {{ item.status === 'active' ? '進行中' : '已結束' }}
          </v-chip>
        </template>
        <template #item.actions="{ item }">
          <v-btn icon="mdi-pencil" size="small" variant="text" @click="openEdit(item)" />
        </template>
      </v-data-table>
    </v-card>

    <v-dialog v-model="dialog" max-width="540">
      <v-card>
        <v-card-title>{{ editing?.id ? `編輯第 ${editing.id} 屆` : '新增屆別' }}</v-card-title>
        <v-card-text>
          <v-form ref="form">
            <v-row>
              <v-col cols="12" sm="4">
                <v-text-field
                  v-model.number="formData.id"
                  label="屆別號"
                  type="number"
                  :disabled="!!editing?.id"
                  variant="outlined"
                  density="comfortable"
                />
              </v-col>
              <v-col cols="12" sm="4">
                <v-text-field
                  v-model="formData.start_date"
                  label="起日 (YYYY-MM-DD)"
                  variant="outlined"
                  density="comfortable"
                  placeholder="2026-07-01"
                />
              </v-col>
              <v-col cols="12" sm="4">
                <v-text-field
                  v-model="formData.end_date"
                  label="迄日"
                  variant="outlined"
                  density="comfortable"
                  placeholder="2027-06-30"
                />
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12" sm="4">
                <v-autocomplete
                  v-model="formData.president_member_id"
                  :items="memberOpts"
                  label="社長"
                  density="comfortable"
                  variant="outlined"
                  clearable
                />
              </v-col>
              <v-col cols="12" sm="4">
                <v-autocomplete
                  v-model="formData.secretary_member_id"
                  :items="memberOpts"
                  label="祕書"
                  density="comfortable"
                  variant="outlined"
                  clearable
                />
              </v-col>
              <v-col cols="12" sm="4">
                <v-autocomplete
                  v-model="formData.treasurer_member_id"
                  :items="memberOpts"
                  label="司庫"
                  density="comfortable"
                  variant="outlined"
                  clearable
                />
              </v-col>
            </v-row>
            <v-textarea v-model="formData.remark" label="備註" rows="2" variant="outlined" density="comfortable" />
          </v-form>
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

const termsApi = inject('terms')
const membersApi = inject('members')

const { terms, loading, fetchTerms, createTerm, updateTerm } = termsApi
const dialog = ref(false)
const editing = ref(null)
const formData = ref({})

const memberOpts = computed(() =>
  membersApi.members.value.map((m) => ({
    value: m.id,
    title: m.name_en ? `${m.name_zh} ${m.name_en}` : m.name_zh,
  }))
)

const headers = [
  { title: '屆別', key: 'id' },
  { title: '起迄', key: 'start_date', value: (it) => `${(it.start_date || '').slice(0, 10)} ~ ${(it.end_date || '').slice(0, 10)}` },
  { title: '狀態', key: 'status' },
  { title: '備註', key: 'remark' },
  { title: '操作', key: 'actions', sortable: false, align: 'end' },
]

function openCreate() {
  const last = terms.value[0]
  editing.value = null
  formData.value = {
    id: last ? last.id + 1 : 33,
    start_date: '',
    end_date: '',
  }
  dialog.value = true
}

function openEdit(item) {
  editing.value = item
  formData.value = {
    id: item.id,
    start_date: (item.start_date || '').slice(0, 10),
    end_date: (item.end_date || '').slice(0, 10),
    president_member_id: item.president_member_id,
    secretary_member_id: item.secretary_member_id,
    treasurer_member_id: item.treasurer_member_id,
    remark: item.remark,
  }
  dialog.value = true
}

async function save() {
  try {
    if (editing.value?.id) {
      await updateTerm(editing.value.id, formData.value)
    } else {
      await createTerm(formData.value)
    }
    dialog.value = false
  } catch (e) {
    Swal.fire('儲存失敗', e.message, 'error')
  }
}

onMounted(() => {
  if (!terms.value.length) fetchTerms()
})
</script>
