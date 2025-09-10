<template>
  <div class="side-panel">
    <button v-if="!isOpen" @click="isOpen = true" class="open-button">
      Open Panel
    </button>
    
    <div v-else class="panel-content">
      <button @click="isOpen = false" class="close-button">Close Panel</button>
      
      <h2>Settings</h2>
      
      <div class="section">
        <h3>Search:</h3>
        <input 
          v-model="searchTerm" 
          type="text" 
          placeholder="Search..." 
          @input="handleSearchChange"
        />
      </div>
      
      <div class="section">
        <h3>Color by:</h3>
        <select v-model="selectedField" @change="handleFieldChange">
          <option value="">None</option>
          <option v-for="field in metadataFields" :key="field" :value="field">
            {{ field }}
          </option>
        </select>
      </div>
      
      <Legend v-if="Object.keys(colorMap).length > 0" :color-map="colorMap" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import Legend from './Legend.vue'

// Props
interface Props {
  metadata: Record<string, string>[]
  colorMap: Record<string, string>
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  'update:color-map': [map: Record<string, string>]
  'update:selected-field': [field: string | null]
  'update:search-term': [term: string]
}>()

// Reactive state
const isOpen = ref(true)
const selectedField = ref<string | null>(null)
const searchTerm = ref('')

// Computed properties
const metadataFields = computed(() => {
  return props.metadata.length > 0 ? Object.keys(props.metadata[0]) : []
})

// Helper functions
const generateColor = (str: string): string => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const color = `hsl(${hash % 360}, 100%, 75%)`
  return color
}

// Event handlers
const handleFieldChange = () => {
  emit('update:selected-field', selectedField.value)

  if (selectedField.value) {
    const newColorMap: Record<string, string> = {}
    props.metadata.forEach(item => {
      const value = item[selectedField.value!]
      if (value && !newColorMap[value]) {
        newColorMap[value] = generateColor(value)
      }
    })
    emit('update:color-map', newColorMap)
  } else {
    emit('update:color-map', {})
  }
}

const handleSearchChange = () => {
  emit('update:search-term', searchTerm.value)
}

// Watcher to reset field selection when metadata changes
watch(() => props.metadata, () => {
  if (selectedField.value && !metadataFields.value.includes(selectedField.value)) {
    selectedField.value = null
    handleFieldChange()
  }
})
</script>

<style scoped>
.side-panel {
  background: #f8f9fa;
  border-radius: 4px;
  padding: 10px;
}

.open-button {
  padding: 10px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.close-button {
  padding: 5px 10px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 10px;
}

.panel-content h2 {
  margin: 0 0 15px 0;
  color: #333;
}

.section {
  margin-bottom: 15px;
}

.section h3 {
  margin: 0 0 5px 0;
  font-size: 14px;
  color: #555;
}

input[type="text"] {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-sizing: border-box;
}

select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-sizing: border-box;
}

button:hover {
  opacity: 0.8;
}
</style>
