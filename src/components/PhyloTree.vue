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
import { preloader } from '../services/preloader'

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

// Helper function to strip SampleID from FASTA headers
const stripFastaHeaders = (fastaContent: string): string => {
  const lines = fastaContent.split('\n')
  const strippedLines = lines.map(line => {
    if (line.startsWith('>')) {
      // Extract only the accessionVersion (before the first |)
      const parts = line.substring(1).split('|')
      return `>${parts[0]}`
    }
    return line
  })
  return strippedLines.join('\n')
}

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
    
    // Strip SampleID and other fields from headers before tree calculation
    const strippedFasta = stripFastaHeaders(props.fastaContent)
    console.log('Stripped FASTA headers to accessionVersion only')
    
    // Get preloaded Biowasm instance
    console.log('Getting preloaded Biowasm instance...')
    const biowasm = await preloader.getBiowasmInstance()
    console.log('Biowasm instance retrieved')

    const file = new File([strippedFasta], 'input.fasta')
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
    const errorMsg = (err as Error).message
    
    // Provide user-friendly error messages
    if (errorMsg.includes('FastTree')) {
      error.value = 'Unable to initialize tree calculation tool. Please check your internet connection and try again.'
    } else if (errorMsg.includes('Network') || errorMsg.includes('network')) {
      error.value = 'Network error. Please check your internet connection and try again.'
    } else {
      error.value = `Failed to calculate tree: ${errorMsg}`
    }
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
