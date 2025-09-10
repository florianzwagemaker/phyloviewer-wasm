<template>
  <div class="fasta-loader">
    <div>
      <label for="fasta-url">FASTA URL:</label>
      <input
        id="fasta-url"
        v-model="url"
        type="text"
        placeholder="Enter FASTA file URL"
        style="width: 400px; margin: 0 10px;"
      />
      <button @click="handleLoadClick">Load FASTA</button>
    </div>
    <div v-if="error" style="color: red; margin-top: 10px;">
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

// Emits
const emit = defineEmits<{
  'update:fasta-content': [content: string]
}>()

// Reactive state
const url = ref('')
const error = ref<string | null>(null)

// Helper function to get URL query parameters
const getUrlParam = (param: string): string | null => {
  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.get(param)
}

// Event handlers
const handleLoadClick = async () => {
  if (!url.value) {
    error.value = 'Please enter a URL.'
    return
  }

  error.value = null
  emit('update:fasta-content', '')

  try {
    const response = await fetch(url.value)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.text()
    emit('update:fasta-content', data)
  } catch (e: any) {
    error.value = `Failed to load FASTA file: ${e.message}`
  }
}

// Lifecycle hooks
onMounted(() => {
  const fastaUrl = getUrlParam('input-fasta')
  if (fastaUrl) {
    url.value = fastaUrl
  }
})

// Watchers
watch(url, (newUrl) => {
  if (newUrl) {
    handleLoadClick()
  }
})
</script>

<style scoped>
.fasta-loader {
  margin-bottom: 10px;
}

label {
  font-weight: bold;
  margin-right: 10px;
}

input[type="text"] {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

button {
  padding: 8px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background: #0056b3;
}
</style>
