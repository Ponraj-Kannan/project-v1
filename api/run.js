// Vercel Serverless Function & Vite dev API handler
// Proxies code execution to OneCompiler API (Developer API with 100 free credits, RapidAPI, or Direct)
import dotenv from 'dotenv'
import path from 'node:path'

// Ensure env vars are loaded even if invoked directly
dotenv.config()
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const LANG_CONFIG = {
  java: { name: 'Java', filename: 'Main.java' },
  python: { name: 'Python', filename: 'main.py' },
  python3: { name: 'Python', filename: 'main.py' },
  c: { name: 'C', filename: 'main.c' },
  cpp: { name: 'Cpp', filename: 'main.cpp' },
  'c++': { name: 'Cpp', filename: 'main.cpp' },
  javascript: { name: 'Javascript', filename: 'index.js' },
  js: { name: 'Javascript', filename: 'index.js' }
}

let isDevApiDisabled = false

export default async function handler(req, res) {
  // Handle CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, access-token, x-api-key')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { code, input = '', language = 'java' } = req.body || {}

  if (!code || typeof code !== 'string' || !code.trim()) {
    return res.status(400).json({ success: false, error: 'Code is required' })
  }

  const normalizedLang = (language || 'java').toLowerCase()
  const langKey = normalizedLang === 'python3' ? 'python' : (normalizedLang === 'c++' ? 'cpp' : normalizedLang)
  const langMeta = LANG_CONFIG[normalizedLang] || { name: normalizedLang, filename: `main.${normalizedLang}` }

  const apiKey = (process.env.ONECOMPILER_API_KEY || process.env.RAPIDAPI_KEY || '').trim()
  const customApiUrl = process.env.VITE_EXECUTION_API_URL
  const customApiKey = process.env.VITE_EXECUTION_API_KEY

  try {
    // 1. OneCompiler Official Developer API (Key starts with oc_ or is standard access token)
    if (!isDevApiDisabled && apiKey && (apiKey.startsWith('oc_') || apiKey.length > 30)) {
      try {
        const ocUrl = `https://onecompiler.com/api/v1/run?access_token=${encodeURIComponent(apiKey)}`
        const response = await fetch(ocUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(5000),
          body: JSON.stringify({
            language: langKey,
            stdin: input || '',
            files: [
              {
                name: langMeta.filename,
                content: code
              }
            ]
          })
        })

        const data = await response.json()
        if (data.status === 'success' || data.stdout !== undefined) {
          return res.status(200).json({
            success: true,
            stdout: data.stdout || '',
            stderr: data.stderr || '',
            exception: data.exception || null,
            executionTime: data.executionTime || 0,
            compilationTime: data.compilationTime || 0,
            creditsRemaining: data.creditsRemaining,
            provider: 'onecompiler-dev-api'
          })
        }
        isDevApiDisabled = true
      } catch (err) {
        isDevApiDisabled = true
      }
    }

    // 2. RapidAPI Marketplace OneCompiler Key (only for RapidAPI format keys)
    if (apiKey && !apiKey.startsWith('oc_')) {
      try {
        const response = await fetch('https://onecompiler-apis.p.rapidapi.com/api/v1/run', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': 'onecompiler-apis.p.rapidapi.com'
          },
          body: JSON.stringify({
            language: langKey,
            stdin: input || '',
            files: [
              {
                name: langMeta.filename,
                content: code
              }
            ]
          })
        })

        if (response.ok) {
          const data = await response.json()
          if (data.stdout !== undefined || data.status === 'success') {
            return res.status(200).json({
              success: true,
              stdout: data.stdout || '',
              stderr: data.stderr || '',
              exception: data.exception || null,
              executionTime: data.executionTime || 0,
              compilationTime: data.compilationTime || 0,
              provider: 'rapidapi'
            })
          }
        }
      } catch (e) {}
    }

    // 3. Custom VM execution endpoint
    if (customApiUrl && customApiKey) {
      const response = await fetch(customApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': customApiKey
        },
        body: JSON.stringify({ code, input: input || '', language: langKey })
      })

      const data = await response.json()
      return res.status(200).json({
        success: true,
        stdout: data.stdout || data.output || '',
        stderr: data.stderr || '',
        exception: data.exception || data.error || null,
        executionTime: data.executionTime || 0,
        provider: 'custom-vm'
      })
    }

    // 4. Default to OneCompiler Direct Execution API
    const response = await fetch('https://onecompiler.com/api/code/exec', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: langMeta.name,
        title: langMeta.name,
        version: 'latest',
        mode: langKey,
        properties: {
          language: langKey,
          files: [
            {
              name: langMeta.filename,
              content: code
            }
          ],
          stdin: input || ''
        }
      })
    })

    const data = await response.json()
    return res.status(200).json({
      success: true,
      stdout: data.stdout || '',
      stderr: data.stderr || '',
      exception: data.exception || null,
      executionTime: data.executionTime || 0,
      compilationTime: data.compilationTime || 0,
      provider: 'onecompiler-direct'
    })
  } catch (error) {
    console.error('Execution API error:', error)
    return res.status(500).json({
      success: false,
      error: error.message || 'Execution error'
    })
  }
}
