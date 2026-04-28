<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5 font-weight-bold">會計科目</h1>
      <v-spacer />
      <v-btn variant="outlined" prepend-icon="mdi-refresh" @click="reload">重新整理</v-btn>
    </div>

    <v-card>
      <v-tabs v-model="tab" bg-color="primary" density="compact">
        <v-tab value="all">全部</v-tab>
        <v-tab value="asset">資產</v-tab>
        <v-tab value="liability">負債</v-tab>
        <v-tab value="equity">權益</v-tab>
        <v-tab value="income">收入</v-tab>
        <v-tab value="expense">支出</v-tab>
      </v-tabs>
      <v-divider />
      <v-data-table
        :headers="headers"
        :items="filteredAccounts"
        :loading="loading"
        density="comfortable"
        :items-per-page="100"
      >
        <template #item.code="{ item }">
          <span class="text-mono">{{ item.code }}</span>
        </template>
        <template #item.name="{ item }">
          <span :style="{ paddingLeft: depth(item.code) * 12 + 'px' }">
            <v-icon v-if="!item.is_leaf" icon="mdi-folder-outline" size="x-small" class="me-1" />
            {{ item.name }}
          </span>
        </template>
        <template #item.type="{ item }">
          <v-chip size="x-small" :color="typeColor(item.type)" variant="flat">{{ typeLabel(item.type) }}</v-chip>
        </template>
        <template #item.is_leaf="{ item }">
          <v-icon v-if="item.is_leaf" icon="mdi-check" color="success" size="small" />
          <span v-else class="text-caption text-grey">分類</span>
        </template>
      </v-data-table>
    </v-card>
  </div>
</template>

<script setup>
import { ref, computed, inject, onMounted } from 'vue'

const accountsApi = inject('accounts')
const { accounts, loading, fetchAccounts } = accountsApi

const tab = ref('all')

const headers = [
  { title: '代碼', key: 'code', width: 100 },
  { title: '名稱', key: 'name' },
  { title: '類別', key: 'type' },
  { title: '分類', key: 'category' },
  { title: '記帳', key: 'is_leaf', width: 80 },
]

const filteredAccounts = computed(() =>
  tab.value === 'all' ? accounts.value : accounts.value.filter((a) => a.type === tab.value)
)

function depth(code) {
  // 一個粗略的縮排：依代碼長度 / 末端 0 數推階層
  if (code.length <= 4) {
    if (code.endsWith('000')) return 0
    if (code.endsWith('00')) return 1
    if (code.endsWith('0')) return 2
    return 3
  }
  return 4
}

function typeLabel(t) {
  return { asset: '資產', liability: '負債', equity: '權益', income: '收入', expense: '支出' }[t] || t
}

function typeColor(t) {
  return { asset: 'green', liability: 'red', equity: 'purple', income: 'success', expense: 'error' }[t] || 'grey'
}

function reload() { fetchAccounts() }

onMounted(() => {
  if (!accounts.value.length) fetchAccounts()
})
</script>
