import { useRef, type KeyboardEvent } from 'react'
import { useTranslation } from '../i18n'
import type { GameMode } from '../types/quiz'

export const GAME_MODES: GameMode[] = ['classic', 'streak', 'timed']

/** Mode atteint par une touche du clavier dans un groupe de boutons radio : flèches (avec retour au début / à la fin),
 * Début et Fin. `null` pour toute autre touche. */
export function nextMode(current: GameMode, key: string): GameMode | null {
  const index = GAME_MODES.indexOf(current)
  if (key === 'ArrowRight' || key === 'ArrowDown') return GAME_MODES[(index + 1) % GAME_MODES.length]
  if (key === 'ArrowLeft' || key === 'ArrowUp') return GAME_MODES[(index - 1 + GAME_MODES.length) % GAME_MODES.length]
  if (key === 'Home') return GAME_MODES[0]
  if (key === 'End') return GAME_MODES[GAME_MODES.length - 1]
  return null
}

/** Sélecteur de mode de jeu : un groupe de boutons radio (un seul arrêt de tabulation, flèches pour changer) suivi
 * d'une phrase qui explique le mode choisi, avant de lancer la partie. */
export function ModePicker({ value, onChange }: { value: GameMode; onChange: (mode: GameMode) => void }) {
  const { t } = useTranslation()
  const buttons = useRef<Partial<Record<GameMode, HTMLButtonElement | null>>>({})
  const labels: Record<GameMode, string> = { classic: t('common.modeClassic'), streak: t('common.modeStreak'), timed: t('common.modeTimed') }

  const onKeyDown = (event: KeyboardEvent) => {
    const next = nextMode(value, event.key)
    if (!next) return
    event.preventDefault()
    onChange(next)
    buttons.current[next]?.focus()
  }

  return <>
    <div className="mode-picker" role="radiogroup" aria-label={t('start.modeGroupLabel')} aria-describedby="mode-description" onKeyDown={onKeyDown}>
      {GAME_MODES.map((mode) => <button
        key={mode}
        ref={(element) => { buttons.current[mode] = element }}
        type="button"
        role="radio"
        aria-checked={value === mode}
        tabIndex={value === mode ? 0 : -1}
        className={value === mode ? 'mode-option active' : 'mode-option'}
        onClick={() => onChange(mode)}
      >{labels[mode]}</button>)}
    </div>
    <p className="mode-description" id="mode-description">{t('start.modeDescription', value)}</p>
  </>
}
