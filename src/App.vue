<template>
  <div class="app-container">
    <h1>PhyloVuewer</h1>
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
        />
        
        <!-- Debug information -->
        <div v-if="debugInfo" class="debug-info">
          <h4>Debug Info:</h4>
          <pre>{{ debugInfo }}</pre>
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
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import FastaLoader from './components/FastaLoader.vue'
import MetadataLoader from './components/MetadataLoader.vue'
import PhyloTree from './components/PhyloTree.vue'
import PhylocanvasViewer from './components/PhylocanvasViewer.vue'
import SidePanel from './components/SidePanel.vue'
import './App.css'

// Reactive state
const fastaContent = ref('')
const metadata = ref<Record<string, string>[]>([])
const newickTree = ref('')
const colorMap = ref<Record<string, string>>({})
const selectedField = ref<string | null>(null)
const searchTerm = ref('')
const debugInfo = ref('')

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

// Watch for important state changes
watch(newickTree, (newTree) => {
  if (newTree) {
    debugInfo.value += `\nTree ready for visualization`
  }
})
</script>

<style scoped>
.app-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
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
