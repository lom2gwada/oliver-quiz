import { useTranslation } from '../i18n'
import { summarizeOutcomes, type ReviewOutcome } from '../utils/leitner'

/** Bilan d'une révision sur l'écran de résultat : combien de questions sont montées de boîte, retombées en boîte 1 ou
 * restées où elles étaient, et le détail question par question. */
export function ReviewSummary({ outcomes }: { outcomes: ReviewOutcome[] }) {
  const { t } = useTranslation()
  if (!outcomes.length) return null
  const { up, down, same } = summarizeOutcomes(outcomes)
  return <section className="review-summary" aria-labelledby="review-summary-title">
    <h3 className="stats-group-title" id="review-summary-title">{t('review.summaryTitle')}</h3>
    <p>{t('review.summaryCounts', up, down, same)}</p>
    <details>
      <summary>{t('review.detailToggle')}</summary>
      <ul className="review-summary-list">
        {outcomes.map(({ question, from, to }) => <li key={question.id}>
          <span aria-hidden="true">{to > from ? '↑' : to < from ? '↓' : '='}</span>
          <span>{question.question}</span>
          <span className="review-summary-move">{to === from ? t('review.stay', from) : t('review.move', from, to)}</span>
        </li>)}
      </ul>
    </details>
  </section>
}
