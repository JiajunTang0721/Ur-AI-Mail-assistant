import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'

const normalizeGoogleClientId = (value?: string) => {
  if (!value) {
    return 'REPLACE_WITH_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com'
  }

  return value
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/(\.apps\.googleusercontent\.com)+$/i, '.apps.googleusercontent.com')
}

const normalizeExtensionPublicKey = (value?: string) => {
  if (!value) {
    return undefined
  }

  return value
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\s+/g, '')
}

const buildManifest = (mode: string) => {
  const env = loadEnv(mode, __dirname, '')
  const googleClientId = normalizeGoogleClientId(env.VITE_GOOGLE_OAUTH_CLIENT_ID)
  const backendBaseUrl = env.VITE_LMA_API_BASE_URL ?? 'http://127.0.0.1:8010'
  const extensionPublicKey = normalizeExtensionPublicKey(
    env.CHROME_EXTENSION_PUBLIC_KEY ?? env.VITE_CHROME_EXTENSION_PUBLIC_KEY,
  )

  const manifest = {
    manifest_version: 3,
    name: 'Mail assistant',
    description: 'A Chrome Extension MV3 assistant for Gmail prioritization and AI summaries.',
    version: '0.1.0',
    key: extensionPublicKey,
    permissions: ['storage', 'tabs', 'scripting', 'identity'],
    host_permissions: ['https://mail.google.com/*', 'https://gmail.googleapis.com/*', `${backendBaseUrl}/*`],
    oauth2: {
      client_id: googleClientId,
      scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    },
    background: {
      service_worker: 'background.js',
      type: 'module',
    },
    action: {
      default_title: '閭欢閲嶇偣鍔╂墜',
    },
    content_scripts: [
      {
        matches: ['https://mail.google.com/*'],
        js: ['content.js'],
        css: ['content.css'],
        run_at: 'document_idle',
      },
    ],
  }

  return JSON.stringify(manifest, null, 2)
}

export default defineConfig(({ mode }) => ({
  base: './',
  root: path.resolve(__dirname, 'extension'),
  envDir: __dirname,
  publicDir: path.resolve(__dirname, 'extension/public'),
  plugins: [
    {
      name: 'lma-extension-manifest',
      writeBundle() {
        const outDir = path.resolve(__dirname, 'dist-extension')
        fs.mkdirSync(outDir, { recursive: true })
        fs.writeFileSync(path.join(outDir, 'manifest.json'), buildManifest(mode), 'utf8')
      },
    },
  ],
  build: {
    outDir: path.resolve(__dirname, 'dist-extension'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, 'extension/popup.html'),
        background: path.resolve(__dirname, 'extension/background.ts'),
        content: path.resolve(__dirname, 'extension/content.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        assetFileNames: '[name][extname]',
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
  },
}))

