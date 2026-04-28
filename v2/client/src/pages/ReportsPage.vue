<template>
  <div>
    <div class="d-flex align-center mb-4 flex-wrap" style="gap: 8px;">
      <h1 class="text-h5 font-weight-bold">月份收支明細表</h1>
      <v-chip v-if="termId" size="small" color="primary" variant="flat">第 {{ termId }} 屆</v-chip>
      <v-spacer />
      <v-text-field
        v-model.number="year"
        label="年"
        type="number"
        density="compact"
        variant="outlined"
        hide-details
        style="max-width: 100px;"
      />
      <v-text-field
        v-model.number="month"
        label="月"
        type="number"
        density="compact"
        variant="outlined"
        hide-details
        style="max-width: 80px;"
      />
      <v-btn variant="outlined" prepend-icon="mdi-eye" @click="loadReport">產生報表</v-btn>
      <v-btn color="success" prepend-icon="mdi-microsoft-excel" :disabled="!report" @click="downloadXlsx">匯出 Excel</v-btn>
    </div>

    <v-card v-if="!report" variant="tonal" color="grey-lighten-3">
      <v-card-text class="text-center pa-8 text-grey">
        選擇年月後按「產生報表」
      </v-card-text>
    </v-card>

    <div v-else>
      <!-- 一頁式儀表板 -->
      <v-card>
        <v-card-title class="text-center">
          嘉義中區扶輪社 第 {{ termId }} 屆 {{ year }}年{{ month }}月份收支明細表
        </v-card-title>
        <v-card-subtitle class="text-center">
          {{ report.period.from }} ~ {{ report.period.to }}
        </v-card-subtitle>
        <v-divider />

        <v-row class="ma-2">
          <v-col cols="12" sm="6" md="3">
            <v-card variant="tonal">
              <v-card-text>
                <div class="text-caption">期初現金/銀行</div>
                <div class="text-h6 font-weight-bold">${{ report.opening_cash.toLocaleString() }}</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-card variant="tonal" color="success">
              <v-card-text>
                <div class="text-caption">本月實收</div>
                <div class="text-h6 font-weight-bold">${{ report.total_income.toLocaleString() }}</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-card variant="tonal" color="error">
              <v-card-text>
                <div class="text-caption">本月實付</div>
                <div class="text-h6 font-weight-bold">${{ report.total_expense.toLocaleString() }}</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-card variant="tonal">
              <v-card-text>
                <div class="text-caption">期末現金/銀行</div>
                <div class="text-h6 font-weight-bold">${{ report.closing_cash.toLocaleString() }}</div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <v-row class="ma-2">
          <v-col cols="12" sm="6">
            <v-card variant="outlined">
              <v-card-text>
                <div class="text-caption text-grey">應收社費</div>
                <div class="text-h6 font-weight-bold text-warning">${{ report.receivables.total.toLocaleString() }}</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" sm="6">
            <v-card variant="outlined">
              <v-card-text>
                <div class="text-caption text-grey">應付代墊款</div>
                <div class="text-h6 font-weight-bold text-error">${{ report.payables.total.toLocaleString() }}</div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <v-divider />
        <!-- 收入支出兩欄 -->
        <v-row class="ma-2">
          <v-col cols="12" md="6">
            <h3 class="text-subtitle-1 font-weight-bold mb-2">收入</h3>
            <v-table density="compact">
              <thead>
                <tr><th>科目</th><th class="text-end">金額</th></tr>
              </thead>
              <tbody>
                <tr v-for="r in report.income_by_account" :key="r.id">
                  <td><span class="text-mono">{{ r.code }}</span> {{ r.name }}</td>
                  <td class="text-end text-mono">{{ r.amount.toLocaleString() }}</td>
                </tr>
                <tr>
                  <td class="font-weight-bold text-end">收入合計</td>
                  <td class="font-weight-bold text-mono text-end text-success">${{ report.total_income.toLocaleString() }}</td>
                </tr>
              </tbody>
            </v-table>
          </v-col>
          <v-col cols="12" md="6">
            <h3 class="text-subtitle-1 font-weight-bold mb-2">支出</h3>
            <div v-for="(items, cat) in report.expense_by_category" :key="cat" class="mb-2">
              <div class="text-caption font-weight-bold text-grey-darken-1 mb-1">【{{ cat }}委員會】</div>
              <v-table density="compact">
                <tbody>
                  <tr v-for="r in items" :key="r.id">
                    <td><span class="text-mono">{{ r.code }}</span> {{ r.name }}</td>
                    <td class="text-end text-mono">{{ r.amount.toLocaleString() }}</td>
                  </tr>
                </tbody>
              </v-table>
            </div>
            <v-divider />
            <div class="text-end pa-2 font-weight-bold text-error">
              支出合計：${{ report.total_expense.toLocaleString() }}
            </div>
          </v-col>
        </v-row>

        <v-divider />
        <div class="text-center pa-4">
          <span class="text-h5 font-weight-bold" :class="report.surplus >= 0 ? 'text-success' : 'text-error'">
            本月餘絀 ${{ report.surplus.toLocaleString() }}
          </span>
        </div>
      </v-card>

      <!-- 應收應付明細 -->
      <v-row class="mt-3">
        <v-col cols="12" md="6">
          <v-card>
            <v-card-title>應收明細（截至 {{ report.period.to }}）</v-card-title>
            <v-divider />
            <v-table density="compact">
              <thead><tr><th>社友</th><th class="text-end">未繳</th></tr></thead>
              <tbody>
                <tr v-for="r in report.receivables.by_member" :key="r.member_id">
                  <td>{{ r.name_zh }} <span class="text-primary text-caption">{{ r.name_en }}</span></td>
                  <td class="text-end text-mono">{{ r.outstanding.toLocaleString() }}</td>
                </tr>
              </tbody>
            </v-table>
          </v-card>
        </v-col>
        <v-col cols="12" md="6">
          <v-card>
            <v-card-title>應付代墊款明細</v-card-title>
            <v-divider />
            <v-table density="compact">
              <thead><tr><th>類別</th><th>對象</th><th class="text-end">未還</th></tr></thead>
              <tbody>
                <tr v-for="(p, i) in report.payables.by_person" :key="i">
                  <td>{{ payerLabel(p.payer_type) }}</td>
                  <td>{{ p.name_zh || p.payer_name || '-' }} <span class="text-primary text-caption">{{ p.name_en }}</span></td>
                  <td class="text-end text-mono">{{ p.outstanding.toLocaleString() }}</td>
                </tr>
              </tbody>
            </v-table>
          </v-card>
        </v-col>
      </v-row>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import Swal from 'sweetalert2'

const reportsApi = inject('reports')
const termsApi = inject('terms')

const termId = computed(() => termsApi.currentTermId.value)
const year = ref(new Date().getFullYear())
const month = ref(new Date().getMonth() + 1)
const report = ref(null)

async function loadReport() {
  if (!termId.value) {
    Swal.fire('請先選擇屆別', '', 'warning'); return
  }
  try {
    report.value = await reportsApi.fetchMonthly(termId.value, year.value, month.value)
  } catch (e) {
    Swal.fire('載入失敗', e.message, 'error')
  }
}

async function downloadXlsx() {
  try {
    await reportsApi.downloadMonthlyXlsx(termId.value, year.value, month.value)
  } catch (e) {
    Swal.fire('匯出失敗', e.message, 'error')
  }
}

function payerLabel(t) {
  return { staff: '幹事代墊', president: '社長代墊', member: '社友代墊', external: '其他代墊' }[t] || t
}
</script>
