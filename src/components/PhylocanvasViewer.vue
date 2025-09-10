<template>
  <div class="phylocanvas-container">
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
    <div 
      ref="treeCanvas" 
      class="tree-canvas"
      style="width: 100%; height: 100%;"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'

// Props
interface Props {
  newick: string
  metadata?: Record<string, string>[]
  colorMap?: Record<string, string>
  selectedField?: string | null
  searchTerm?: string
}

const props = withDefaults(defineProps<Props>(), {
  metadata: () => [],
  colorMap: () => ({}),
  selectedField: null,
  searchTerm: ''
})

// Reactive state
const treeCanvas = ref<HTMLElement | null>(null)
const error = ref<string | null>(null)
let treeInstance: any = null

// Helper functions
const isNodeMatched = (nodeName: string): boolean => {
  if (!props.searchTerm || !props.metadata.length) {
    return false
  }
  
  const metadataItem = props.metadata.find(item => item.accession === nodeName)
  if (metadataItem) {
    return Object.values(metadataItem).some(val =>
      val.toLowerCase().includes(props.searchTerm.toLowerCase())
    )
  }
  return false
}

const getNodeColor = (nodeName: string): string | null => {
  if (!props.selectedField || !Object.keys(props.colorMap).length || !props.metadata.length) {
    return null
  }
  
  const metadataItem = props.metadata.find(item => item.accession === nodeName)
  if (metadataItem && metadataItem[props.selectedField] && props.colorMap[metadataItem[props.selectedField]]) {
    return props.colorMap[metadataItem[props.selectedField]]
  }
  return null
}

const renderTree = async () => {
  if (!treeCanvas.value || !props.newick) {
    return
  }

  try {
    error.value = null
    
    // Clean up existing tree
    if (treeInstance) {
      try {
        if (typeof treeInstance.destroy === 'function') {
          treeInstance.destroy()
        }
      } catch (e) {
        console.log('Error destroying previous tree instance:', e)
      }
      treeInstance = null
    }

    // Clear container
    treeCanvas.value.innerHTML = ''

    console.log('Loading PhylocanvasGL...')
    
    // Try multiple import strategies to work around the bundling issue
    let PhylocanvasGL: any = null
    
    try {
      // Strategy 1: Check if it's already available globally (from CDN)
      if ((window as any).PhylocanvasGL) {
        PhylocanvasGL = (window as any).PhylocanvasGL
        console.log('Using global PhylocanvasGL')
      } else {
        // Strategy 2: Dynamic import with error handling
        console.log('Attempting dynamic import...')
        const module = await import('@phylocanvas/phylocanvas.gl')
        
        // Try different export patterns (cast to any to satisfy TypeScript)
        const anyModule: any = module
        PhylocanvasGL = anyModule.default || anyModule.PhylocanvasGL || anyModule
        
        console.log('Available exports:', Object.keys(module))
        console.log('PhylocanvasGL constructor:', PhylocanvasGL)
        
        // If it's still not a constructor, try to find it in the module
        if (typeof PhylocanvasGL !== 'function') {
          for (const [key, value] of Object.entries(module)) {
            if (typeof value === 'function' && key.includes('Phylocanvas')) {
              PhylocanvasGL = value
              console.log(`Found PhylocanvasGL under key: ${key}`)
              break
            }
          }
        }
      }
    } catch (importError) {
      console.error('Import error details:', importError)
      
      // Strategy 3: Try to load from CDN as fallback
      if (!(window as any).PhylocanvasGL) {
        console.log('Attempting to load PhylocanvasGL from CDN...')
        try {
          await loadPhylocanvasGLFromCDN()
          PhylocanvasGL = (window as any).PhylocanvasGL
        } catch (cdnError) {
          console.error('CDN loading failed:', cdnError)
          throw new Error(`Failed to load PhylocanvasGL: ${(importError as Error).message}`)
        }
      } else {
        PhylocanvasGL = (window as any).PhylocanvasGL
      }
    }
    
    if (!PhylocanvasGL || typeof PhylocanvasGL !== 'function') {
      throw new Error('PhylocanvasGL constructor not found or not a function')
    }

    console.log('Creating PhylocanvasGL instance...')
    
    // Get container dimensions
    const containerRect = treeCanvas.value.getBoundingClientRect()
    const width = containerRect.width || 800
    const height = containerRect.height || 600
    
    // Create tree props following the exact documentation pattern
    const treeProps = {
      size: { width, height },
      source: props.newick,
      showLabels: true,
      showLeafLabels: true,
      alignLabels: true,
      interactive: true
    }
    
    console.log('Tree props:', treeProps)
    console.log('Container element:', treeCanvas.value)
    
    // Create new PhylocanvasGL instance
    treeInstance = new PhylocanvasGL(treeCanvas.value, treeProps)

    console.log('PhylocanvasGL instance created successfully:', treeInstance)

    // Apply styling after tree is rendered
    await nextTick()
    setTimeout(() => {
      applyNodeStyling()
    }, 100) // Small delay to ensure tree is fully rendered

  } catch (err) {
    console.error('Error rendering tree with PhylocanvasGL:', err)
    error.value = `Failed to render tree: ${(err as Error).message}`
    
    // Show error with tree data
    if (treeCanvas.value) {
      treeCanvas.value.innerHTML = `
        <div style="padding: 20px; text-align: center;">
          <h3>PhylocanvasGL Loading Error</h3>
          <p style="color: #d32f2f; margin-bottom: 15px;">
            <strong>Error:</strong> ${error.value}
          </p>
          <p>Tree calculation completed successfully. The issue is with the visualization library.</p>
          <details style="margin-top: 15px;">
            <summary style="cursor: pointer; font-weight: bold;">Show Newick Tree Data</summary>
            <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 10px; max-height: 200px; overflow-y: auto; text-align: left; margin-top: 10px;">${props.newick}</pre>
          </details>
          <p style="margin-top: 15px; font-size: 12px; color: #666;">
            Try refreshing the page or check the browser console for more details.
          </p>
        </div>
      `
    }
  }
}

// Function to load PhylocanvasGL from CDN as fallback
const loadPhylocanvasGLFromCDN = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if ((window as any).PhylocanvasGL) {
      resolve()
      return
    }
    
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/@phylocanvas/phylocanvas.gl@1.58.0/dist/phylocanvas.js'
    script.onload = () => {
      if ((window as any).PhylocanvasGL) {
        console.log('PhylocanvasGL loaded from CDN')
        resolve()
      } else {
        reject(new Error('PhylocanvasGL not available after CDN load'))
      }
    }
    script.onerror = () => reject(new Error('Failed to load PhylocanvasGL from CDN'))
    document.head.appendChild(script)
  })
}

const applyNodeStyling = () => {
  if (!treeInstance) return

  try {
    console.log('Applying node styling...')
    console.log('Tree instance methods:', Object.getOwnPropertyNames(treeInstance))
    console.log('Tree instance properties:', Object.keys(treeInstance))
    
    // Check what properties and methods are available
    if (treeInstance.tree) {
      console.log('Tree data available:', treeInstance.tree)
    }
    
    if (treeInstance.root) {
      console.log('Root node available:', treeInstance.root)
    }
    
    // Try to apply styling using available methods
    if (typeof treeInstance.setProps === 'function') {
      console.log('setProps method available')
      
      const styleProps: any = {}
      
      // Apply node colors based on metadata
      if (props.selectedField && Object.keys(props.colorMap).length > 0) {
        console.log('Applying color mapping for field:', props.selectedField)
        
        styleProps.nodeStyles = (node: any) => {
          if (node.isLeaf && node.label) {
            const color = getNodeColor(node.label)
            if (color) {
              return { fill: color }
            }
          }
          return {}
        }
      }
      
      // Apply search highlighting
      if (props.searchTerm) {
        console.log('Applying search highlighting for term:', props.searchTerm)
        
        styleProps.nodeStyles = (node: any) => {
          if (node.isLeaf && node.label) {
            if (isNodeMatched(node.label)) {
              return { fill: '#ff0000', stroke: '#cc0000', strokeWidth: 2 }
            }
            const color = getNodeColor(node.label)
            if (color) {
              return { fill: color }
            }
          }
          return {}
        }
      }
      
      if (Object.keys(styleProps).length > 0) {
        treeInstance.setProps(styleProps)
        console.log('Applied styling props:', styleProps)
      }
    }
    
    // Set up event handlers
    if (typeof treeInstance.on === 'function') {
      console.log('Event system available')
      
      treeInstance.on('node-click', (node: any) => {
        console.log('Node clicked:', node.label || 'internal node')
        if (node.isLeaf && node.label) {
          const metadataItem = props.metadata.find(item => item.accession === node.label)
          if (metadataItem) {
            console.log('Node metadata:', metadataItem)
          }
        }
      })
    }

  } catch (err) {
    console.error('Error applying node styling:', err)
  }
}

// Lifecycle hooks
onMounted(() => {
  renderTree()
})

onUnmounted(() => {
  if (treeInstance) {
    try {
      if (typeof treeInstance.destroy === 'function') {
        treeInstance.destroy()
      }
    } catch (e) {
      console.log('Error destroying tree instance:', e)
    }
    treeInstance = null
  }
})

// Watchers
watch(() => props.newick, () => {
  renderTree()
})

watch([() => props.colorMap, () => props.selectedField, () => props.searchTerm], () => {
  if (treeInstance) {
    applyNodeStyling()
  }
})
</script>

<style scoped>
.phylocanvas-container {
  width: 100%;
  height: 100%;
  position: relative;
}

.tree-canvas {
  width: 100%;
  height: 100%;
  min-height: 600px;
}

.error-message {
  color: red;
  padding: 10px;
  background: #fee;
  border: 1px solid #fcc;
  border-radius: 4px;
  margin: 10px;
}
</style>
