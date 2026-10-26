import type { TranslationKey } from '../i18n'
import { formatDuration } from '@engine/utils/time'

type Translate = (key: TranslationKey, ...args: unknown[]) => string

/** Durée d'une partie contre-la-montre, dite une seule fois. Avant : « 5 min · ⏱ 5:00 », la durée choisie puis le temps
 * écoulé, identiques quand la partie est allée jusqu'au bout.
 * - jusqu'au bout : « ⏱ 5:00 » ;
 * - arrêtée avant la fin : « ⏱ 3:12 sur 5 min » ;
 * - sans limite (entraînement) : « ⏱ 3:12 · sans limite ». */
export function timedDurationLabel(elapsedSeconds: number, durationSeconds: number, t: Translate): string {
  const elapsed = formatDuration(elapsedSeconds)
  if (durationSeconds === 0) return t('timedDuration.unlimited', elapsed)
  if (elapsedSeconds >= durationSeconds) return t('common.durationIcon', elapsed)
  return t('timedDuration.early', elapsed, t('common.minutesShort', Math.round(durationSeconds / 60)))
}
