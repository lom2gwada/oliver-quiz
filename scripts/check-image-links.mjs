#!/usr/bin/env node
// Vérifie que les images hotlinkées répondent toujours : les `imageUrl` des questions d'un quiz et les couvertures
// (`metadata.image`) des quiz hébergés décrites dans src/data/quiz-metadata.json ; vérifie aussi les liens « Pour aller
// plus loin » de ce fichier (simple avertissement : beaucoup de sites refusent les robots).
// Usage : node scripts/check-image-links.mjs [chemin/vers/quiz.json]
// Sans argument : src/data/sample-quiz.json puis src/data/quiz-metadata.json. Sort avec le code 1 si une image est
// cassée (pour faire échouer la CI), 0 sinon.

import { readFile } from 'node:fs/promises'

const CONCURRENCY = 5
const USER_AGENT = 'Mozilla/5.0 (compatible; oliver-quiz-link-check)'

async function request(url, method) {
  return fetch(url, { method, redirect: 'follow', headers: { 'user-agent': USER_AGENT } })
}

async function checkImage(url) {
  try {
    let response = await request(url, 'HEAD')
    if (response.status === 405 || response.status === 403) response = await request(url, 'GET') // certains serveurs refusent HEAD
    const contentType = response.headers.get('content-type') ?? ''
    if (!response.ok) return { ok: false, reason: `HTTP ${response.status}` }
    if (!contentType.startsWith('image/')) return { ok: false, reason: `content-type inattendu : ${contentType || 'absent'}` }
    return { ok: true }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  }
}

async function checkLink(url) {
  try {
    let response = await request(url, 'HEAD')
    if (!response.ok) response = await request(url, 'GET')
    return response.ok ? { ok: true } : { ok: false, reason: `HTTP ${response.status}` }
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

/** Vérifie une liste d'`{ label, url }` ; renvoie celles qui ne répondent pas. */
async function run(title, entries, check) {
  if (!entries.length) return []
  console.log(`${title} : ${entries.length} adresse(s)…`)
  const results = await checkInBatches(entries, (entry) => check(entry.url), CONCURRENCY)
  return entries.map((entry, index) => ({ entry, result: results[index] })).filter(({ result }) => !result.ok)
}

const explicit = process.argv[2]
const quizPath = explicit ?? 'src/data/sample-quiz.json'
const quiz = JSON.parse(await readFile(quizPath, 'utf8'))
const questionImages = quiz.questions.filter((question) => question.imageUrl).map((question) => ({ label: `${quizPath} [${question.id}]`, url: question.imageUrl }))

let covers = []
let links = []
if (!explicit) {
  const metadata = JSON.parse(await readFile('src/data/quiz-metadata.json', 'utf8'))
  covers = metadata.filter((entry) => entry.image).map((entry) => ({ label: `couverture de « ${entry.title} »`, url: entry.image.url }))
  links = metadata.flatMap((entry) => (entry.links ?? []).map((link) => ({ label: `lien « ${link.label} » (${entry.title})`, url: link.url })))
}

const brokenImages = [...await run('Images des questions', questionImages, checkImage), ...await run('Couvertures des quiz', covers, checkImage)]
const brokenLinks = await run('Liens « Pour aller plus loin »', links, checkLink)

for (const { entry, result } of brokenLinks) console.warn(`⚠ ${entry.label}\n  ${entry.url}\n  ${result.reason} (avertissement : certains sites refusent les robots)`)
for (const { entry, result } of brokenImages) console.error(`✗ ${entry.label}\n  ${entry.url}\n  ${result.reason}`)

const total = questionImages.length + covers.length
if (brokenImages.length) {
  console.error(`\n${brokenImages.length}/${total} image(s) cassée(s).`)
  process.exit(1)
}
console.log(total ? `Toutes les images répondent (${total}/${total}).` : 'Aucune image à vérifier.')
