import Prism from 'prismjs'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-docker'
import 'prismjs/components/prism-java'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-sql'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-yaml'
import type { CodeQuestion as Question, UserAnswer } from '../types/quiz'
import { QCMQuestion } from './QCMQuestion'

// markup (html/xml), css, clike et javascript sont déjà inclus dans le cœur de prismjs.
const LANGUAGE_ALIASES: Record<string, string> = { html: 'markup', xml: 'markup', sh: 'bash', shell: 'bash', yml: 'yaml', dockerfile: 'docker' }

function escapeHtml(text: string): string {
  return text.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char] as string)
}

/** Coloration syntaxique légère (prismjs) plutôt qu'un éditeur complet type Monaco — la question de
 * code n'est ici qu'un extrait en lecture seule, pas un champ où l'on tape. À remplacer par Monaco
 * le jour où un type de question "écrire du code" (exécuté et corrigé) serait ajouté. */
export function CodeQuestion({ question, answer, onChange }: { question: Question; answer?: UserAnswer; onChange: (value: string[]) => void }) {
  const language = LANGUAGE_ALIASES[question.content.language] ?? question.content.language
  const grammar = Prism.languages[language]
  const html = grammar ? Prism.highlight(question.content.snippet, grammar, language) : escapeHtml(question.content.snippet)
  return <>
    <pre className={`language-${language}`}><code dangerouslySetInnerHTML={{ __html: html }} /></pre>
    <QCMQuestion question={{ ...question, type: 'qcm', content: { multiple: false, answers: question.content.answers } }} answer={answer} onChange={onChange} />
  </>
}
