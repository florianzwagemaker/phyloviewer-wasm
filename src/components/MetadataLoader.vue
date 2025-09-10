<template>
  <div class="metadata-loader">
    <div>
      <label for="metadata-url">Metadata URL (TSV):</label>
      <input
        id="metadata-url"
        v-model="url"
        type="text"
        placeholder="Enter TSV metadata file URL"
        style="width: 400px; margin: 0 10px;"
      />
      <button @click="handleLoadClick">Load Metadata</button>
    </div>
    <div v-if="error" style="color: red; margin-top: 10px;">
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { parseTsv } from '../services/tsvParser'

// Emits
const emit = defineEmits<{
  'update:metadata': [data: Record<string, string>[]]
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
    return
  }

  error.value = null
  emit('update:metadata', [])

  try {
    const response = await fetch(url.value)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.text()
    const parsedData = parseTsv(data)
    emit('update:metadata', parsedData)
  } catch (e: any) {
    error.value = `Failed to load metadata file: ${e.message}`
  }
}

// Lifecycle hooks
onMounted(() => {
  const metadataUrl = getUrlParam('input-metadata')
  if (metadataUrl) {
    url.value = metadataUrl
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
.metadata-loader {
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
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background: #1e7e34;
}
</style>
