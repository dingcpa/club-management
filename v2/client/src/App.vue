<template>
  <LoginPage v-if="!isAuthenticated" />

  <v-app v-else>
    <!-- Mobile app bar -->
    <v-app-bar v-if="mobile" color="primary" elevation="2">
      <v-app-bar-nav-icon @click="drawer = !drawer" />
      <v-app-bar-title class="text-body-1">{{ activeNavTitle }}</v-app-bar-title>
      <v-spacer />
      <v-btn icon="mdi-logout" @click="handleLogout" />
    </v-app-bar>

    <!-- Sidebar -->
    <v-navigation-drawer
      v-model="drawer"
      :rail="!mobile && rail"
      :temporary="mobile"
      color="white"
      elevation="2"
      width="240"
    >
      <v-list-item
        v-if="!mobile"
        prepend-icon="mdi-finance"
        :title="rail ? '' : '中區社財務'"
        :subtitle="rail ? '' : (activeTerm ? `第 ${activeTerm.id} 屆` : '')"
        nav
      >
        <template #append>
          <v-btn
            :icon="rail ? 'mdi-chevron-right' : 'mdi-chevron-left'"
            variant="text"
            size="small"
            @click="rail = !rail"
          />
        </template>
      </v-list-item>
      <v-divider />

      <!-- 屆別切換 -->
      <div v-if="!rail" class="pa-3 pb-1">
        <v-select
          v-model="currentTermId"
          :items="termOptions"
          label="檢視屆別"
          density="compact"
          variant="outlined"
          hide-details
        />
      </div>

      <v-list density="compact" nav>
        <v-list-item
          v-for="item in visibleNavItems"
          :key="item.tab"
          :prepend-icon="item.icon"
          :title="item.title"
          :active="activeTab === item.tab"
          active-color="primary"
          @click="navigate(item.tab)"
        />
        <v-list-item
          v-if="isAdmin"
          prepend-icon="mdi-account-key"
          title="帳號管理"
          :active="activeTab === 'users'"
          active-color="primary"
          @click="navigate('users')"
        />
      </v-list>

      <template v-if="!mobile" #append>
        <v-divider />
        <v-list density="compact" nav>
          <v-list-item
            v-if="user"
            prepend-icon="mdi-account-circle"
            :title="rail ? '' : user.displayName"
            :subtitle="rail ? '' : roleLabel"
          />
          <v-list-item
            prepend-icon="mdi-logout"
            :title="rail ? '' : '登出'"
            @click="handleLogout"
          />
        </v-list>
      </template>
    </v-navigation-drawer>

    <v-main>
      <v-container fluid class="pa-3 pa-sm-4">
        <component :is="currentPage" />
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup>
import { ref, computed, provide, onMounted, watch } from 'vue'
import { useDisplay } from 'vuetify'
import Swal from 'sweetalert2'

import { useAuth } from './composables/useAuth.js'
import { useTerms } from './composables/useTerms.js'
import { useMembers } from './composables/useMembers.js'
import { useAccounts } from './composables/useAccounts.js'
import { useJournal } from './composables/useJournal.js'
import { useBilling } from './composables/useBilling.js'
import { useAdvances } from './composables/useAdvances.js'
import { useContributions } from './composables/useContributions.js'
import { useReports } from './composables/useReports.js'

import LoginPage from './pages/LoginPage.vue'
import DashboardPage from './pages/DashboardPage.vue'
import TermsPage from './pages/TermsPage.vue'
import MembersPage from './pages/MembersPage.vue'
import AccountsPage from './pages/AccountsPage.vue'
import JournalPage from './pages/JournalPage.vue'
import BillingPage from './pages/BillingPage.vue'
import AdvancesPage from './pages/AdvancesPage.vue'
import ContributionsPage from './pages/ContributionsPage.vue'
import ReportsPage from './pages/ReportsPage.vue'
import UserManagementPage from './pages/UserManagementPage.vue'

const { isAuthenticated, isAdmin, user, logout } = useAuth()
const { smAndDown } = useDisplay()
const mobile = smAndDown
const drawer = ref(true)
const rail = ref(false)
const activeTab = ref('dashboard')

const termsApi = useTerms()
const membersApi = useMembers()
const accountsApi = useAccounts()
const journalApi = useJournal()
const billingApi = useBilling()
const advancesApi = useAdvances()
const contributionsApi = useContributions()
const reportsApi = useReports()

const { terms, activeTerm, currentTermId } = termsApi

const termOptions = computed(() =>
  terms.value.map((t) => ({
    value: t.id,
    title: `第 ${t.id} 屆 (${(t.start_date || '').slice(0, 10)} ~ ${(t.end_date || '').slice(0, 10)})`,
  }))
)

const navItems = [
  { tab: 'dashboard', icon: 'mdi-view-dashboard', title: '儀表板' },
  { tab: 'journal', icon: 'mdi-book-open-variant', title: '傳票' },
  { tab: 'billing', icon: 'mdi-receipt-text', title: '應收 / 請款' },
  { tab: 'advances', icon: 'mdi-cash-multiple', title: '代墊款' },
  { tab: 'contributions', icon: 'mdi-hand-heart', title: '認捐單' },
  { tab: 'reports', icon: 'mdi-chart-box', title: '報表' },
  { tab: 'members', icon: 'mdi-account-group', title: '社員 / 職務' },
  { tab: 'terms', icon: 'mdi-calendar-multiple', title: '屆別管理' },
  { tab: 'accounts', icon: 'mdi-format-list-bulleted-type', title: '會計科目' },
]

const visibleNavItems = computed(() => navItems)

const activeNavTitle = computed(() =>
  navItems.find((n) => n.tab === activeTab.value)?.title || '儀表板'
)

const roleLabel = computed(() => {
  const r = user.value?.role
  return { admin: '管理員', staff: '幹事', treasurer: '司庫', president: '社長', secretary: '祕書' }[r] || r
})

const pageMap = {
  dashboard: DashboardPage,
  journal: JournalPage,
  billing: BillingPage,
  advances: AdvancesPage,
  contributions: ContributionsPage,
  reports: ReportsPage,
  members: MembersPage,
  terms: TermsPage,
  accounts: AccountsPage,
  users: UserManagementPage,
}
const currentPage = computed(() => pageMap[activeTab.value] || DashboardPage)

function navigate(tab) {
  if (tab === 'users' && !isAdmin.value) return
  activeTab.value = tab
  if (mobile.value) drawer.value = false
}

async function handleLogout() {
  const r = await Swal.fire({
    title: '確定要登出？',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#0d47a1',
    cancelButtonColor: '#6b7280',
    confirmButtonText: '登出',
    cancelButtonText: '取消',
  })
  if (!r.isConfirmed) return
  logout()
}

// Provide everything
provide('terms', termsApi)
provide('members', membersApi)
provide('accounts', accountsApi)
provide('journal', journalApi)
provide('billing', billingApi)
provide('advances', advancesApi)
provide('contributions', contributionsApi)
provide('reports', reportsApi)
provide('navigate', navigate)

onMounted(async () => {
  if (isAuthenticated.value) {
    await Promise.all([
      termsApi.fetchTerms(),
      membersApi.fetchMembers(),
      accountsApi.fetchAccounts(),
    ])
  }
})

// 切換屆別後重新拉社員資料（職務會跟屆別走）
watch(currentTermId, async (id) => {
  if (id) await membersApi.fetchMembers(id)
})
</script>

<style>
html, body {
  margin: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Microsoft JhengHei', sans-serif;
}
.text-mono {
  font-family: 'SF Mono', Consolas, monospace;
}
.member-tag {
  font-weight: 500;
}
.member-tag .en {
  color: #1976d2;
  margin-left: 4px;
  font-size: 0.9em;
}
</style>
