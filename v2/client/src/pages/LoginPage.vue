<template>
  <v-app>
    <v-main class="d-flex align-center justify-center" style="min-height: 100vh; background: linear-gradient(135deg, #0d47a1 0%, #1976d2 100%);">
      <v-card width="380" class="pa-4 elevation-8">
        <div class="text-center mb-4">
          <v-icon icon="mdi-finance" size="48" color="primary" />
          <div class="text-h5 font-weight-bold mt-2">中區扶輪社財務管理</div>
          <div class="text-caption text-grey">Club Finance v2</div>
        </div>
        <v-card-text>
          <v-form @submit.prevent="handleLogin">
            <v-text-field
              v-model="username"
              label="帳號"
              prepend-inner-icon="mdi-account"
              variant="outlined"
              density="comfortable"
              autofocus
              class="mb-3"
            />
            <v-text-field
              v-model="password"
              label="密碼"
              type="password"
              prepend-inner-icon="mdi-lock"
              variant="outlined"
              density="comfortable"
              class="mb-3"
            />
            <v-alert v-if="errorMsg" type="error" density="compact" class="mb-3">{{ errorMsg }}</v-alert>
            <v-btn type="submit" block color="primary" :loading="logging" size="large">登入</v-btn>
          </v-form>
        </v-card-text>
      </v-card>
    </v-main>
  </v-app>
</template>

<script setup>
import { ref } from 'vue'
import { useAuth } from '../composables/useAuth.js'

const { login } = useAuth()
const username = ref('')
const password = ref('')
const logging = ref(false)
const errorMsg = ref('')

async function handleLogin() {
  logging.value = true
  errorMsg.value = ''
  try {
    await login(username.value, password.value)
  } catch (e) {
    errorMsg.value = e.message
  } finally {
    logging.value = false
  }
}
</script>
