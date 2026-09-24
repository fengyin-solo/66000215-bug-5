import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { BRAILLE_MAP, textToBraille, brailleToText, dotsToUnicode } from '../utils/braille'
import type { LearnMode } from '../types'

export type QuizPhase = 'idle' | 'answering' | 'revealed'

export interface QuizRecord {
  id: number
  char: string
  selected: number[]
  correctDots: number[]
  correct: boolean
}

export interface QuizResult {
  correct: boolean
  char: string
  selected: number[]
  correctDots: number[]
}

export const useBrailleStore = defineStore('braille', () => {
  const inputText = ref('')
  const brailleOutput = ref<number[][]>([])
  const learnMode = ref<LearnMode>('charToBraille')
  const quizChar = ref('')
  const selectedDots = ref<number[]>([])
  const phase = ref<QuizPhase>('idle')
  const lastResult = ref<QuizResult | null>(null)
  const history = ref<QuizRecord[]>([])
  let nextRecordId = 1

  const brailleUnicode = computed(() =>
    brailleOutput.value.map(d => dotsToUnicode(d)).join('')
  )

  // 当前题目的正确圆点
  const correctDots = computed(() =>
    [...(BRAILLE_MAP[quizChar.value] || [])].sort((a, b) => a - b)
  )

  // 统计与历史列表共用同一份作答记录，保证条数永远一致
  const score = computed(() => ({
    correct: history.value.filter(h => h.correct).length,
    total: history.value.length,
  }))

  function translate() {
    brailleOutput.value = textToBraille(inputText.value)
  }

  function reverseTranslate() {
    // Simple: take selectedDots and find matching char
    return brailleToText(selectedDots.value)
  }

  function generateQuiz() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    quizChar.value = chars[Math.floor(Math.random() * chars.length)]
    selectedDots.value = []
    lastResult.value = null
    phase.value = 'answering'
  }

  function toggleDot(dot: number) {
    // 结果揭示后锁定点阵，避免改动已提交的作答
    if (phase.value !== 'answering') return
    const idx = selectedDots.value.indexOf(dot)
    if (idx >= 0) selectedDots.value.splice(idx, 1)
    else selectedDots.value.push(dot)
  }

  function submitQuizAnswer() {
    // 每题只能提交一次：揭示阶段的重复调用一律忽略，不重复计分
    if (phase.value !== 'answering' || !quizChar.value) return
    const selected = [...selectedDots.value].sort((a, b) => a - b)
    const expected = [...(BRAILLE_MAP[quizChar.value] || [])].sort((a, b) => a - b)
    const correct = JSON.stringify(selected) === JSON.stringify(expected)
    const result: QuizResult = { correct, char: quizChar.value, selected, correctDots: expected }
    lastResult.value = result
    history.value.unshift({ id: nextRecordId++, ...result })
    if (navigator.vibrate) navigator.vibrate(correct ? 100 : [100, 50, 100])
    // 停留在结果揭示阶段，由用户点击「下一题」后再换题
    phase.value = 'revealed'
  }

  function resetScore() {
    // 统计、历史、当前作答一起归零
    history.value = []
    lastResult.value = null
    quizChar.value = ''
    selectedDots.value = []
    phase.value = 'idle'
  }

  function exportPDF(): string {
    const lines = inputText.value.toUpperCase().split('')
    let out = '盲文翻译输出\n\n'
    for (const ch of lines) {
      const dots = BRAILLE_MAP[ch] || []
      out += `${ch} → [${dots.join(',')}] ${dotsToUnicode(dots)}\n`
    }
    return out
  }

  return {
    inputText, brailleOutput, learnMode, quizChar, selectedDots, phase, lastResult,
    history, correctDots, score,
    brailleUnicode, translate, reverseTranslate, generateQuiz, toggleDot,
    submitQuizAnswer, resetScore, exportPDF
  }
})
