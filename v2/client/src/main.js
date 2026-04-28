import { createApp } from 'vue'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'

import App from './App.vue'

const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          primary: '#0d47a1',     // 扶輪藍
          secondary: '#f9a825',   // 扶輪金
          accent: '#1976d2',
          success: '#2e7d32',
          error: '#c62828',
          warning: '#ef6c00',
        },
      },
    },
  },
})

createApp(App).use(vuetify).mount('#app')
