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

// Global phylocanvas flag
let phylocanvasLoaded = false

// Helper functions
const extractAccessionVersion = (nodeName: string): string => {
  // Split the node name by '|' and return the first part
  return nodeName.split('|')[0];
};

const isNodeMatched = (nodeName: string): boolean => {
  const accessionVersion = extractAccessionVersion(nodeName);
  if (!props.searchTerm || !props.metadata.length) {
    return false;
  }

  const metadataItem = props.metadata.find(item => item.accessionVersion === accessionVersion);
  if (metadataItem) {
    return Object.values(metadataItem).some(val =>
      val.toLowerCase().includes(props.searchTerm.toLowerCase())
    );
  }
  return false;
};

const getNodeColor = (nodeName: string): string | null => {
  const accessionVersion = extractAccessionVersion(nodeName);
  if (!props.selectedField || !Object.keys(props.colorMap).length || !props.metadata.length) {
    return null;
  }

  const metadataItem = props.metadata.find(item => item.accessionVersion === accessionVersion);
  if (metadataItem && metadataItem[props.selectedField] && props.colorMap[metadataItem[props.selectedField]]) {
    return props.colorMap[metadataItem[props.selectedField]];
  }
  return null;
}

const generateStyles = (leaves: any[]) => {
  if (!leaves || leaves.length === 0) {
    return {};
  }

  const styles = {};

  for (const leaf of leaves) {
    if (leaf.id) {
      const style = {};
      // Search highlighting takes precedence
      if (props.searchTerm && isNodeMatched(leaf.id)) {
        style.fillColour = '#ff0000';
        style.strokeColour = '#cc0000';
        style.strokeWidth = 2;
      } else {
        // Then apply color mapping
        const color = getNodeColor(leaf.id);
        if (color) {
          style.fillColour = color;
        }
      }

      if (Object.keys(style).length > 0) {
        styles[leaf.id] = style;
      }
    }
  }
  return styles;
}

// Function to load PhylocanvasGL globally like in the CodePen
const loadPhylocanvasGL = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if ((window as any).phylocanvas && (window as any).phylocanvas.PhylocanvasGL) {
      phylocanvasLoaded = true
      resolve()
      return
    }
    
    // Check if script is already being loaded
    if (document.querySelector('script[src*="phylocanvas"]')) {
      // Script is loading, wait for it
      const checkInterval = setInterval(() => {
        if ((window as any).phylocanvas && (window as any).phylocanvas.PhylocanvasGL) {
          phylocanvasLoaded = true
          clearInterval(checkInterval)
          resolve()
        }
      }, 100)
      
      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval)
        reject(new Error('PhylocanvasGL loading timeout'))
      }, 10000)
      return
    }
    
    console.log('Loading PhylocanvasGL from CDN...')
    
    // Load the script globally like in CodePen
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/@phylocanvas/phylocanvas.gl@latest/dist/bundle.min.js'
    script.onload = () => {
      // Wait a bit for the global to be available
      setTimeout(() => {
        if ((window as any).phylocanvas && (window as any).phylocanvas.PhylocanvasGL) {
          console.log('PhylocanvasGL loaded successfully')
          phylocanvasLoaded = true
          resolve()
        } else {
          console.error('PhylocanvasGL not available after load. Available globals:', Object.keys(window))
          reject(new Error('PhylocanvasGL not available after load'))
        }
      }, 500)
    }
    script.onerror = () => reject(new Error('Failed to load PhylocanvasGL script'))
    document.head.appendChild(script)
  })
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

    console.log('Ensuring PhylocanvasGL is loaded...')
    
    // Ensure PhylocanvasGL is loaded
    if (!phylocanvasLoaded) {
      await loadPhylocanvasGL()
    }
    
    // Access PhylocanvasGL like in the CodePen example
    const PhylocanvasGL = (window as any).phylocanvas.PhylocanvasGL
    
    if (!PhylocanvasGL) {
      throw new Error('PhylocanvasGL constructor not found in global phylocanvas object')
    }

    console.log('Creating PhylocanvasGL instance...')
    
    // Get container dimensions
    const containerRect = treeCanvas.value.getBoundingClientRect()
    const width = containerRect.width || 800
    const height = containerRect.height || 600
    
    // Create tree props exactly like in the CodePen example
    const treeProps = {
      source: props.newick,
      size: { width, height },
      showLabels: true,
      showLeafLabels: true,
      interactive: true
    }
    
    console.log('Tree props:', treeProps)
    console.log('Container element:', treeCanvas.value)
    
    // Create new PhylocanvasGL instance exactly like in CodePen
    treeInstance = new PhylocanvasGL(treeCanvas.value, treeProps)

    console.log('PhylocanvasGL instance created successfully:', treeInstance)

    // Apply styling after tree is rendered
    await nextTick()
    applyNodeStyling()

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

const applyNodeStyling = () => {
  if (!treeInstance) return

  try {
    console.log('Applying node styling...')
    const graph = treeInstance.getGraphAfterLayout();
    const leaves = graph.leaves;
    const newStyles = generateStyles(leaves);
    
    if (typeof treeInstance.setProps === 'function') {
      treeInstance.setProps({ styles: newStyles })
      console.log('Applied styling props using setProps:', newStyles)
    }
    
    // Set up event handlers
    if (typeof treeInstance.on === 'function') {
      console.log('Setting up event handlers')
      
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
  if (treeInstance && typeof treeInstance.setProps === 'function') {
    applyNodeStyling();
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
