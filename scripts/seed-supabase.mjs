/**
 * seed-supabase.mjs
 *
 * Seed the Supabase `users` table with existing whitelisted emails from `allowed-emails.json`.
 *
 * Usage:
 *   node scripts/seed-supabase.mjs
 *
 * Requirements:
 *   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set in .env
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')

dotenv.config({ path: resolve(rootDir, '.env') })

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  console.error('Please configure your Supabase credentials before running this seed script.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
})

async function seed() {
  const filePath = resolve(rootDir, 'allowed-emails.json')
  if (!existsSync(filePath)) {
    console.error('❌ allowed-emails.json not found at:', filePath)
    process.exit(1)
  }

  const rawData = JSON.parse(readFileSync(filePath, 'utf8'))
  const emails = Array.isArray(rawData) ? rawData : []

  console.log(`📋 Found ${emails.length} email(s) in allowed-emails.json:`)
  emails.forEach(e => console.log(`   • ${e}`))

  if (emails.length === 0) {
    console.log('⚠️ No emails found to seed.')
    process.exit(0)
  }

  // The first email or designated admin email gets 'admin' role, others get 'student'
  const records = emails.map((email, idx) => ({
    email: email.trim().toLowerCase(),
    role: idx === 0 ? 'admin' : 'student'
  }))

  console.log('\n🔄 Seeding into Supabase `users` table...')

  for (const record of records) {
    const { data, error } = await supabase
      .from('users')
      .upsert(
        { email: record.email, role: record.role, updated_at: new Date().toISOString() },
        { onConflict: 'email', ignoreDuplicates: false }
      )
      .select()

    if (error) {
      console.error(`❌ Failed to upsert ${record.email}:`, error.message)
    } else {
      console.log(`✅ Upserted ${record.email} (Role: ${record.role})`)
    }
  }

  console.log('\n🎉 Seed process completed successfully!')
  process.exit(0)
}

seed().catch(err => {
  console.error('❌ Unexpected seed failure:', err.message || err)
  process.exit(1)
})
