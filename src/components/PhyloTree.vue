<template>
  <div class="phylo-tree">
    <div v-if="isLoading" class="loading">
      Calculating phylogenetic tree...
    </div>
    <div v-if="error" class="error">
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { BiowasmService } from '../services/biowasm'

// Props
interface Props {
  fastaContent: string
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  'tree-calculated': [tree: string]
}>()

// Reactive state
const error = ref<string | null>(null)
const isLoading = ref(false)

// Tree calculation function
const calculateTree = async () => {
  if (!props.fastaContent) {
    return
  }

  isLoading.value = true
  error.value = null

  try {
    console.log('Starting tree calculation...')
    console.log('FASTA content length:', props.fastaContent.length)
    
    const biowasm = new BiowasmService(['fasttree/2.1.11'])
    console.log('BiowasmService created')
    
    await biowasm.init()
    console.log('Biowasm initialized')

    const file = new File([props.fastaContent], 'input.fasta')
    await biowasm.mount(file)
    console.log('File mounted')

    // Use the file name directly since Aioli mounts it in the working directory
    const result = await biowasm.exec('fasttree', ['-nt', '-noml', 'input.fasta'])
    console.log('Tree calculation result:', result)
    
    // Extract the Newick tree from the FastTree output
    // The tree starts with '(' and ends with ');'
    const lines = result.split('\n')
    let newickTree = ''
    
    // Find lines that contain the tree (start with '(' and contain tree structure)
    for (const line of lines) {
      if (line.trim().startsWith('(') && line.includes(');')) {
        newickTree = line.trim()
        break
      }
    }
    
    if (!newickTree) {
      // Fallback: look for any line that looks like a tree
      for (const line of lines) {
        if (line.includes('(') && line.includes(')') && line.includes(':')) {
          newickTree = line.trim()
          break
        }
      }
    }
    
    if (newickTree) {
      console.log('Newick tree extracted:', newickTree.substring(0, 100) + '...')
      emit('tree-calculated', newickTree)
    } else {
      throw new Error('No valid Newick tree found in FastTree output')
    }
    
  } catch (err) {
    console.error('Error calculating tree:', err)
    error.value = `Failed to calculate tree: ${(err as Error).message}`
  } finally {
    isLoading.value = false
  }
}

// Watcher
watch(() => props.fastaContent, (newContent) => {
  if (newContent) {
    calculateTree()
  }
}, { immediate: true })
</script>

<style scoped>
.phylo-tree {
  padding: 10px;
}

.loading {
  color: #007bff;
  font-weight: bold;
}

.error {
  color: red;
  padding: 10px;
  background: #fee;
  border: 1px solid #fcc;
  border-radius: 4px;
}
</style>
