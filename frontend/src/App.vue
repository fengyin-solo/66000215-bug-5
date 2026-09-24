<template>
  <div class="min-h-screen p-4 flex flex-col gap-4 max-w-6xl mx-auto">
    <h1 class="text-3xl font-bold text-purple-400">盲文翻译与触觉学习器</h1>

    <div class="flex gap-2">
      <button v-for="t in tabs" :key="t.id" @click="activeTab = t.id"
        class="px-4 py-2 rounded text-sm"
        :class="activeTab === t.id ? 'bg-purple-500 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'">
        {{ t.label }}
      </button>
    </div>

    <!-- Translate -->
    <div v-if="activeTab === 'translate'" class="grid grid-cols-2 gap-4">
      <div class="bg-gray-900 rounded-xl p-4">
        <h3 class="text-purple-300 font-bold mb-2">文本输入</h3>
        <textarea v-model="store.inputText" @input="store.translate()"
          class="w-full h-32 bg-gray-800 rounded p-3 text-white resize-none" placeholder="输入英文文本..." />
      </div>
      <div class="bg-gray-900 rounded-xl p-4">
        <h3 class="text-purple-300 font-bold mb-2">盲文输出</h3>
        <div class="text-4xl tracking-wider text-purple-300 h-16">{{ store.brailleUnicode }}</div>
        <div class="flex flex-wrap gap-2 mt-3">
          <BrailleCell v-for="(dots, i) in store.brailleOutput" :key="i" :dots="dots" :size="40" />
        </div>
      </div>
    </div>

    <!-- Learn -->
    <div v-if="activeTab === 'learn'" class="grid grid-cols-2 gap-4">
      <div class="bg-gray-900 rounded-xl p-4 flex flex-col items-center gap-4">
        <h3 class="text-purple-300 font-bold">猜盲文</h3>
        <div v-if="store.phase === 'idle'" class="flex flex-col items-center gap-2">
          <button @click="store.generateQuiz()" class="bg-purple-500 px-6 py-3 rounded-lg text-lg hover:bg-purple-400">
            开始训练
          </button>
        </div>
        <div v-else class="flex flex-col items-center gap-3">
          <div class="text-7xl font-bold text-purple-400">{{ store.quizChar }}</div>
          <div class="text-sm text-gray-400">
            {{ store.phase === 'answering' ? '点击下方 6 点阵选择对应盲文' : '正确盲文如下' }}
          </div>
          <div class="grid grid-cols-2 gap-2 p-4 bg-gray-800 rounded-xl">
            <button v-for="d in 6" :key="d" @click="store.toggleDot(d)" :disabled="store.phase === 'result'"
              class="w-14 h-14 rounded-full border-2 transition-all disabled:cursor-default"
              :class="dotClass(d)">
              <span class="text-xs">{{ d }}</span>
            </button>
          </div>
          <button v-if="store.phase === 'answering'" @click="store.checkQuizAnswer()"
            class="bg-purple-500 px-6 py-2 rounded hover:bg-purple-400">确认</button>
          <template v-else>
            <div class="text-lg font-bold" :class="store.lastResult?.correct ? 'text-green-400' : 'text-red-400'">
              {{ store.lastResult?.correct ? '✓ 回答正确' : '✗ 回答错误' }}
            </div>
            <div class="text-xs text-gray-400 flex items-center gap-2">
              正确圆点：
              <BrailleCell :dots="store.lastResult?.correctDots ?? []" :size="24" />
              <span>{{ (store.lastResult?.correctDots ?? []).join(', ') || '无（空方）' }}</span>
            </div>
            <button @click="store.generateQuiz()"
              class="bg-purple-500 px-6 py-2 rounded hover:bg-purple-400">下一题</button>
          </template>
        </div>
      </div>
      <div class="bg-gray-900 rounded-xl p-4">
        <div class="flex justify-between mb-2">
          <h3 class="text-purple-300 font-bold">统计</h3>
          <button @click="store.resetScore()" class="text-red-400 text-xs hover:underline">重置</button>
        </div>
        <div class="grid grid-cols-3 gap-2 text-center mb-3">
          <div class="bg-gray-800 rounded p-2">
            <div class="text-2xl font-bold text-green-400">{{ store.score.correct }}</div>
            <div class="text-xs text-gray-400">正确</div>
          </div>
          <div class="bg-gray-800 rounded p-2">
            <div class="text-2xl font-bold text-red-400">{{ store.score.total - store.score.correct }}</div>
            <div class="text-xs text-gray-400">错误</div>
          </div>
          <div class="bg-gray-800 rounded p-2">
            <div class="text-2xl font-bold text-purple-400">{{ store.score.total ? Math.round(store.score.correct / store.score.total * 100) : 0 }}%</div>
            <div class="text-xs text-gray-400">正确率</div>
          </div>
        </div>
        <div class="space-y-1 max-h-48 overflow-y-auto">
          <div v-if="store.records.length === 0" class="text-xs text-gray-500 text-center py-4">
            暂无作答记录
          </div>
          <div v-for="r in store.records" :key="r.id"
            class="flex items-center justify-between gap-2 bg-gray-800 rounded p-2 text-sm"
            :class="r.correct ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'">
            <span class="flex items-center gap-2">
              <span class="text-base font-bold text-purple-300 w-5">{{ r.char }}</span>
              <span class="text-xs text-gray-400">你选 [{{ r.selected.join(',') }}]</span>
              <span v-if="!r.correct" class="text-xs text-gray-400">正确 [{{ r.correctDots.join(',') }}]</span>
            </span>
            <span>{{ r.correct ? '✓' : '✗' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Reference -->
    <div v-if="activeTab === 'ref'" class="bg-gray-900 rounded-xl p-4">
      <h3 class="text-purple-300 font-bold mb-3">盲文速查表</h3>
      <div class="grid grid-cols-6 md:grid-cols-9 gap-3">
        <div v-for="(dots, char) in brailleMap" :key="char" class="flex flex-col items-center">
          <div class="text-xl font-bold text-purple-400">{{ char }}</div>
          <BrailleCell :dots="dots" :size="30" />
          <div class="text-xs text-gray-500">{{ dots.join(',') }}</div>
        </div>
      </div>
    </div>

    <button @click="doExport" class="bg-green-700 px-4 py-2 rounded self-start hover:bg-green-600 text-sm">
      导出翻译文本
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useBrailleStore } from './store/braille'
import { BRAILLE_MAP } from './utils/braille'
import BrailleCell from './components/BrailleCell.vue'

const store = useBrailleStore()
const brailleMap = BRAILLE_MAP
const tabs = [
  { id: 'translate', label: '翻译模式' },
  { id: 'learn', label: '训练模式' },
  { id: 'ref', label: '速查表' },
]
const activeTab = ref('translate')

function dotClass(d: number) {
  if (store.phase === 'answering') {
    return store.selectedDots.includes(d)
      ? 'bg-purple-500 border-purple-400 scale-110'
      : 'bg-gray-700 border-gray-600 hover:border-purple-400'
  }
  const result = store.lastResult
  if (result?.correctDots.includes(d)) {
    return 'bg-green-500 border-green-400 scale-110'
  }
  if (result?.selected.includes(d)) {
    return 'bg-red-500 border-red-400 scale-110'
  }
  return 'bg-gray-700 border-gray-600 opacity-60'
}

function doExport() {
  const text = store.exportPDF()
  const blob = new Blob([text], { type: 'text/plain' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'braille-output.txt'
  a.click()
}
</script>
