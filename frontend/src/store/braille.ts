import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { BRAILLE_MAP, textToBraille, brailleToText, dotsToUnicode } from '../utils/braille'
import type { LearnMode } from '../types'

export interface QuizRecord {
  id: number
  char: string
  selected: number[]
  correctDots: number[]
  correct: boolean
  time: number
}

const STORAGE_KEY = 'braille-quiz-records'
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function loadRecords(): QuizRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const useBrailleStore = defineStore('braille', () => {
  const inputText = ref('')
  const brailleOutput = ref<number[][]>([])
  const learnMode = ref<LearnMode>('charToBraille')
  const quizChar = ref('')
  const selectedDots = ref<number[]>([])
  // idle: 未开始; answering: 作答中; result: 已提交、展示结果中
  const phase = ref<'idle' | 'answering' | 'result'>('idle')
  const lastResult = ref<QuizRecord | null>(null)
  // 唯一的作答记录数据源：统计数字与历史列表都从这里汇总
  const records = ref<QuizRecord[]>(loadRecords())
  let nextId = records.value.reduce((max, r) => Math.max(max, r.id), 0) + 1

  const score = computed(() => {
    const total = records.value.length
    const correct = records.value.filter(r => r.correct).length
    return { correct, total }
  })

  const brailleUnicode = computed(() =>
    brailleOutput.value.map(d => dotsToUnicode(d)).join('')
  )

  function translate() {
    brailleOutput.value = textToBraille(inputText.value)
  }

  function reverseTranslate() {
    // Simple: take selectedDots and find matching char
    return brailleToText(selectedDots.value)
  }

  function generateQuiz() {
    let next = quizChar.value
    while (next === quizChar.value) {
      next = CHARS[Math.floor(Math.random() * CHARS.length)]
    }
    quizChar.value = next
    selectedDots.value = []
    lastResult.value = null
    phase.value = 'answering'
  }

  function toggleDot(dot: number) {
    // 结果展示阶段锁定点阵，防止改动已提交的答案
    if (phase.value !== 'answering') return
    const idx = selectedDots.value.indexOf(dot)
    if (idx >= 0) selectedDots.value.splice(idx, 1)
    else selectedDots.value.push(dot)
  }

  function checkQuizAnswer() {
    // 每题只能提交一次：结果阶段（含重复点击）不再计分
    if (phase.value !== 'answering' || !quizChar.value) return
    const correctDots = [...(BRAILLE_MAP[quizChar.value] || [])].sort((a, b) => a - b)
    const selected = [...selectedDots.value].sort((a, b) => a - b)
    const correct = JSON.stringify(selected) === JSON.stringify(correctDots)
    const record: QuizRecord = {
      id: nextId++,
      char: quizChar.value,
      selected,
      correctDots,
      correct,
      time: Date.now(),
    }
    records.value.unshift(record)
    lastResult.value = record
    phase.value = 'result'
    if (navigator.vibrate) navigator.vibrate(correct ? 100 : [100, 50, 100])
  }

  function resetScore() {
    // 统计与列表来自同一份记录，重置时一起归零，并退出当前答题
    records.value = []
    quizChar.value = ''
    selectedDots.value = []
    lastResult.value = null
    phase.value = 'idle'
  }

  watch(records, (val) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
    } catch {
      // 存储不可用时忽略，内存中的记录仍可用于本次会话
    }
  }, { deep: true })

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
    records, score,
    brailleUnicode, translate, reverseTranslate, generateQuiz, toggleDot,
    checkQuizAnswer, resetScore, exportPDF
  }
})
