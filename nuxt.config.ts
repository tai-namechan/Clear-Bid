// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: false,
  modules: ['@nuxtjs/tailwindcss'],
  css: ['~/assets/css/main.css'],
  alias: {
    '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
    '#server': fileURLToPath(new URL('./server', import.meta.url)),
  },
  app: {
    head: {
      title: 'Clear Bid',
      meta: [
        { name: 'description', content: '取るべき案件を、クリアに。' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      ],
      htmlAttrs: { lang: 'ja' },
    },
  },
  runtimeConfig: {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    aiProvider: process.env.AI_PROVIDER || 'auto',
    aiMonthlyBudgetUsd: Number(process.env.AI_MONTHLY_BUDGET_USD || 3),
    cfAccessTeamDomain: process.env.CF_ACCESS_TEAM_DOMAIN || '',
    cfAccessAud: process.env.CF_ACCESS_AUD || '',
    authBypass: process.env.AUTH_BYPASS === '1' || process.env.AUTH_BYPASS === 'true',
    devUserEmail: process.env.DEV_USER_EMAIL || 'dev@local.test',
    public: {
      appName: 'Clear Bid',
    },
  },
  nitro: {
    preset: 'cloudflare_module',
    experimental: {
      asyncContext: true,
    },
    cloudflare: {
      deployConfig: true,
      nodeCompat: true,
    },
  },
  typescript: {
    strict: true,
    typeCheck: false,
  },
})
