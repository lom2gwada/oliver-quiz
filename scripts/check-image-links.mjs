#!/usr/bin/env node
// Vérifie que les `imageUrl` hotlinkées des questions d'un quiz répondent toujours.
// Usage : node scripts/check-image-links.mjs [chemin/vers/quiz.json]
// Sans argument, vérifie src/data/sample-quiz.json. Sort avec le code 1 si une image est cassée
// (pour faire échouer la CI), 0 sinon.

import { readFile } from 'node:fs/promises'

const CONCURRENCY = 5

async function checkImage(url) {
  try {
    let response = await fetch(url, { method: 'HEAD' })
    if (response.status === 405) response = await fetch(url, { method: 'GET' }) // certains serveurs refusent HEAD
    const contentType = response.headers.get('content-type') ?? ''
    if (!response.ok) return { ok: false, reason: `HTTP ${response.status}` }
    if (!contentType.startsWith('image/')) return { ok: false, reason: `content-type inattendu : ${contentType || 'absent'}` }
    return { ok: true }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  }
}

async function checkInBatches(items, worker, concurrency) {
  const results = []
  for (let start = 0; start < items.length; start += concurrency) {
    const batch = items.slice(start, start + concurrency)
    results.push(...await Promise.all(batch.map(worker)))
  }
  return results
}

const path = process.argv[2] ?? 'src/data/sample-quiz.json'
const quiz = JSON.parse(await readFile(path, 'utf8'))
const withImage = quiz.questions.filter((question) => question.imageUrl)

if (!withImage.length) {
  console.log(`Aucune question avec image dans ${path}.`)
  process.exit(0)
}

console.log(`Vérification de ${withImage.length} image(s) dans ${path}…`)
const results = await checkInBatches(withImage, (question) => checkImage(question.imageUrl), CONCURRENCY)

const broken = withImage.map((question, index) => ({ question, result: results[index] })).filter(({ result }) => !result.ok)

for (const { question, result } of broken) {
  console.error(`✗ [${question.id}] ${question.imageUrl}\n  ${result.reason}`)
}

if (broken.length) {
  console.error(`\n${broken.length}/${withImage.length} image(s) cassée(s).`)
  process.exit(1)
}

console.log(`Toutes les images répondent (${withImage.length}/${withImage.length}).`)
