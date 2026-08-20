export type Difficulty = 'easy' | 'medium' | 'hard'
export type QuestionType = 'qcm' | 'text' | 'code' | 'ordering' | 'boolean' | 'cloze' | 'matching' | 'numeric'

export interface Theme {
  id: string
  label: string
}

export interface AnswerOption {
  id: string
  label: string
  isCorrect: boolean
}

export interface QCMContent {
  multiple: boolean
  answers: AnswerOption[]
}

export interface TextContent {
  expectedAnswers: string[]
  caseSensitive: boolean
}

export interface CodeContent {
  language: string
  snippet: string
  answers: AnswerOption[]
}

export interface OrderingItem {
  id: string
  label: string
}

export interface OrderingContent {
  items: OrderingItem[]
  correctOrder: string[]
}

export interface BooleanContent {
  isTrue: boolean
}

/** Le champ `question` doit contenir un marqueur de trou (`___`) que ClozeQuestion remplace par un champ de saisie. */
export type ClozeContent = TextContent

export interface MatchingItem {
  id: string
  label: string
}

export interface MatchingContent {
  left: MatchingItem[]
  right: MatchingItem[]
  correctPairs: Record<string, string>
}

export interface NumericContent {
  min: number
  max: number
  step: number
  target: number
  tolerance: number
  unit?: string
}

export interface BaseQuestion {
  id: string
  theme: string
  difficulty: Difficulty
  question: string
  tags: string[]
  explanation: string
  points: number
}

export interface QCMQuestion extends BaseQuestion {
  type: 'qcm'
  content: QCMContent
}

export interface TextQuestion extends BaseQuestion {
  type: 'text'
  content: TextContent
}

export interface CodeQuestion extends BaseQuestion {
  type: 'code'
  content: CodeContent
}

export interface OrderingQuestion extends BaseQuestion {
  type: 'ordering'
  content: OrderingContent
}

export interface BooleanQuestion extends BaseQuestion {
  type: 'boolean'
  content: BooleanContent
}

export interface ClozeQuestion extends BaseQuestion {
  type: 'cloze'
  content: ClozeContent
}

export interface MatchingQuestion extends BaseQuestion {
  type: 'matching'
  content: MatchingContent
}

export interface NumericQuestion extends BaseQuestion {
  type: 'numeric'
  content: NumericContent
}

export type Question = QCMQuestion | TextQuestion | CodeQuestion | OrderingQuestion | BooleanQuestion | ClozeQuestion | MatchingQuestion | NumericQuestion

export interface Quiz {
  version: string
  metadata: { title: string; author: string; createdAt: string }
  themes: Theme[]
  questions: Question[]
}

export type UserAnswer = string[] | string
export type AnswersByQuestion = Record<string, UserAnswer>
