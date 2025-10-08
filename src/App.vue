<template>
  <div class="app-container">
    <!-- Preloading indicator -->
    <div v-if="isPreloading" class="preload-overlay">
      <div class="preload-content">
        <div class="spinner"></div>
        <h2>Initializing PhyloViewer...</h2>
        <p>Loading dependencies (FastTree, PhylocanvasGL)</p>
      </div>
    </div>
    
    <h1>PhyloViewer</h1>
    <p>WASM-based phylogenetic tree calculation with fasttree and rendering with Vue + PhylocanvasGL</p>
    <div class="controls-section">
      <FastaLoader @update:fasta-content="handleFastaContent" />
      <MetadataLoader @update:metadata="handleMetadata" />
    </div>
    
    <div class="main-content">
      <div class="side-panel">
        <SidePanel 
          :metadata="metadata" 
          :color-map="colorMap" 
          @update:color-map="handleColorMap" 
          @update:selected-field="handleSelectedField" 
          @update:search-term="handleSearchTerm"
          @update:label-fields="handleLabelFields"
        />
        
        <!-- Debug information -->
        <div v-if="debugInfo" class="debug-info">
          <h4>Debug Info:</h4>
          <pre>{{ debugInfo }}</pre>
          <h4>Current Label Fields:</h4>
          <pre>{{ labelFields }}</pre>
        </div>
      </div>
      
      <div class="tree-container">
        <PhyloTree 
          v-if="fastaContent"
          :fasta-content="fastaContent" 
          @tree-calculated="handleTreeCalculated"
        />
        
        <PhylocanvasViewer 
          v-if="newickTree"
          :newick="newickTree"
          :metadata="metadata"
          :color-map="colorMap"
          :selected-field="selectedField"
          :search-term="searchTerm"
          :label-fields="labelFields"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import FastaLoader from './components/FastaLoader.vue'
import MetadataLoader from './components/MetadataLoader.vue'
import PhyloTree from './components/PhyloTree.vue'
import PhylocanvasViewer from './components/PhylocanvasViewer.vue'
import SidePanel from './components/SidePanel.vue'
import { preloader } from './services/preloader'
import './App.css'

// Reactive state
const fastaContent = ref('')
const metadata = ref<Record<string, string>[]>([])
const newickTree = ref('')
const colorMap = ref<Record<string, string>>({})
const selectedField = ref<string | null>(null)
const searchTerm = ref('')
const labelFields = ref<string[]>(['SampleID'])
const debugInfo = ref('')
const isPreloading = ref(true)

// Preload all dependencies on app mount
onMounted(async () => {
  try {
    debugInfo.value = 'Preloading dependencies...'
    await preloader.preloadAll()
    
    // Check what actually loaded
    const status = preloader.getLoadingStatus()
    if (status.all) {
      debugInfo.value = 'All dependencies preloaded successfully!'
    } else if (status.biowasm || status.phylocanvas) {
      debugInfo.value = 'Some dependencies preloaded (others will load on-demand)'
    } else {
      debugInfo.value = 'Using on-demand loading (preload failed)'
    }
    
    isPreloading.value = false
  } catch (error) {
    console.error('Error preloading dependencies:', error)
    debugInfo.value = `Preload incomplete - using on-demand loading`
    isPreloading.value = false
  }
})

// Event handlers
const handleFastaContent = (content: string) => {
  fastaContent.value = content
}

const handleMetadata = (data: Record<string, string>[]) => {
  metadata.value = data
  debugInfo.value += `\nMetadata loaded: ${data.length} records`
}

const handleTreeCalculated = (newick: string) => {
  newickTree.value = newick
  debugInfo.value += `\nNewick tree generated, ${newick.length} characters`
}

const handleColorMap = (map: Record<string, string>) => {
  colorMap.value = map
}

const handleSelectedField = (field: string | null) => {
  selectedField.value = field
}

const handleSearchTerm = (term: string) => {
  searchTerm.value = term
}

const handleLabelFields = (fields: string[]) => {
  console.log('App.vue received labelFields update:', fields)
  labelFields.value = [...fields]  // Create a new array to ensure reactivity
  debugInfo.value += `\nLabel fields updated: ${fields.join(', ')}`
}

// Watch for important state changes
watch(newickTree, (newTree) => {
  if (newTree) {
    debugInfo.value += `\nTree ready for visualization`
  }
})

watch(labelFields, (newFields) => {
  console.log('Label fields changed to:', newFields)
})
</script>

<style scoped>
.app-container {
  /* padding: 20px; */
  max-width: 1200px;
  margin: 0 auto;
  position: relative;
}

.preload-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.preload-content {
  text-align: center;
  padding: 40px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.preload-content h2 {
  margin: 20px 0 10px 0;
  color: #333;
  font-size: 24px;
}

.preload-content p {
  margin: 0;
  color: #666;
  font-size: 14px;
}

.spinner {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #007bff;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.controls-section {
  margin-bottom: 20px;
  display: flex;
  gap: 20px;
}

.main-content {
  display: flex;
  gap: 20px;
  height: calc(100vh - 200px);
}

.side-panel {
  width: 20%;
  min-width: 250px;
}

.tree-container {
  flex: 1;
  min-height: 600px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.debug-info {
  margin-top: 20px;
  padding: 10px;
  background: #f5f5f5;
  border-radius: 4px;
  font-size: 12px;
}

.debug-info pre {
  margin: 0;
  white-space: pre-wrap;
}
</style>
