/**
 * seed-questions.mjs
 *
 * Seeds the Supabase `questions` table with the default question bank.
 *
 * Usage:
 *   node scripts/seed-questions.mjs
 *
 * Requirements:
 *   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set in .env
 */

import { createClient } from '@supabase/supabase-js'
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

const SEED_QUESTIONS = [
  {
    title: 'Positive Number Checker',
    slug: 'check-positive-number',
    description: 'Write a Java program that takes an integer num as input and checks if it is a Positive Number using an if statement.',
    difficulty: 'easy',
    total_test_cases: 5,
    display_order: 1,
    is_active: true,
    topic: 'Decision-making statements',
    sub_topic: 'Practice Problem: Positive Number Check',
    language: 'java',
    starter_code: `import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int num = sc.nextInt();\n        \n        // Write your if condition here\n        if (num > 0) {\n            System.out.println(num + " is a positive number.");\n        }\n    }\n}`,
    test_cases: [
      { id: 1, name: 'Sample 1', input: '12', expectedOutput: '12 is a positive number.', isHidden: false },
      { id: 2, name: 'Sample 2', input: '-25', expectedOutput: '', isHidden: false },
      { id: 3, name: 'Hidden 1', input: '-5', expectedOutput: '', isHidden: true },
      { id: 4, name: 'Hidden 2', input: '0', expectedOutput: '', isHidden: true },
      { id: 5, name: 'Hidden 3', input: '100', expectedOutput: '100 is a positive number.', isHidden: true }
    ],
    task: 'Write a Java program that takes an integer <code>num</code> as input and checks if it is a <b>Positive Number</b> using an <code>if</code> statement.',
    input_format: 'A single integer <code>num</code>.',
    constraints: '-10<sup>9</sup> &le; num &le; 10<sup>9</sup>',
    output_format: 'Print <code>&lt;num&gt; is a positive number.</code> if positive, otherwise print nothing.',
    explanation: 'Since 12 is greater than 0, it is identified as a positive number.',
    contents: [
      { text: '<b>Problem:</b> Write a Java program that takes an integer <code>num</code> as input and checks if it is a <b>Positive Number</b> using an <code>if</code> statement.' },
      { text: '<b>Sample Input:</b> <code>12</code>' },
      { text: '<b>Expected Output:</b><br><code>12 is a positive number.</code>' }
    ],
    score: 10
  },
  {
    title: 'Sum of Digits',
    slug: 'sum-of-digits',
    description: 'Write a Java program that takes an integer num as input and prints the Sum of its Digits.',
    difficulty: 'easy',
    total_test_cases: 6,
    display_order: 2,
    is_active: true,
    topic: 'Decision-making statements',
    sub_topic: 'Practice Problem: Sum of Digits',
    language: 'java',
    starter_code: `import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int num = sc.nextInt();\n        int sum = 0;\n        \n        // Write your logic here to calculate sum of digits\n        int temp = Math.abs(num);\n        while (temp > 0) {\n            sum += temp % 10;\n            temp /= 10;\n        }\n        \n        System.out.println("Sum of digits = " + sum);\n    }\n}`,
    test_cases: [
      { id: 1, name: 'Sample 1', input: '123', expectedOutput: 'Sum of digits = 6', isHidden: false },
      { id: 2, name: 'Sample 2', input: '9', expectedOutput: 'Sum of digits = 9', isHidden: false },
      { id: 3, name: 'Hidden 1', input: '1000', expectedOutput: 'Sum of digits = 1', isHidden: true },
      { id: 4, name: 'Hidden 2', input: '0', expectedOutput: 'Sum of digits = 0', isHidden: true },
      { id: 5, name: 'Hidden 3', input: '987654', expectedOutput: 'Sum of digits = 39', isHidden: true },
      { id: 6, name: 'Hidden 4', input: '505', expectedOutput: 'Sum of digits = 10', isHidden: true }
    ],
    task: 'Write a Java program that takes an integer <code>num</code> as input and prints the <b>Sum of its Digits</b>.',
    input_format: 'A single integer <code>num</code>.',
    constraints: '0 &le; num &le; 10<sup>9</sup>',
    output_format: 'Print <code>Sum of digits = &lt;sum&gt;</code>.',
    explanation: '1 + 2 + 3 = 6.',
    contents: [
      { text: '<b>Problem:</b> Write a Java program that takes an integer <code>num</code> as input and prints the <b>Sum of its Digits</b>.' },
      { text: '<b>Sample Input:</b> <code>123</code>' },
      { text: '<b>Expected Output:</b><br><code>Sum of digits = 6</code>' }
    ],
    score: 10
  }
]

async function seed() {
  console.log(`📋 Seeding ${SEED_QUESTIONS.length} question(s) into Supabase 'questions' table...`)

  for (const q of SEED_QUESTIONS) {
    const { data, error } = await supabase
      .from('questions')
      .upsert(
        {
          title: q.title,
          slug: q.slug,
          description: q.description,
          difficulty: q.difficulty,
          total_test_cases: q.total_test_cases,
          display_order: q.display_order,
          is_active: q.is_active,
          topic: q.topic,
          sub_topic: q.sub_topic,
          language: q.language,
          starter_code: q.starter_code,
          test_cases: q.test_cases,
          task: q.task,
          input_format: q.input_format,
          constraints: q.constraints,
          output_format: q.output_format,
          explanation: q.explanation,
          contents: q.contents,
          score: q.score,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'slug', ignoreDuplicates: false }
      )
      .select()

    if (error) {
      console.error(`❌ Failed to upsert question '${q.title}':`, error.message)
    } else {
      console.log(`✅ Upserted question: '${q.title}' (Slug: ${q.slug}, Order: ${q.display_order})`)
    }
  }

  console.log('\n🎉 Question bank seed completed successfully!')
  process.exit(0)
}

seed().catch(err => {
  console.error('❌ Unexpected seed failure:', err.message || err)
  process.exit(1)
})
