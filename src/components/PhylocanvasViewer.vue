<template>
  <div class="phylocanvas-container">
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
    <div class="tree-controls" v-if="treeInstance">
      <label class="control-item">
        <input 
          type="checkbox" 
          v-model="showBranchLengths" 
          @change="updateBranchLengthsDisplay"
        />
        Show Branch Lengths
      </label>
      <label class="control-item">
        <input 
          type="checkbox" 
          v-model="showLeafLabels" 
          @change="updateLeafLabelsDisplay"
        />
        Show Leaf Labels
      </label>
      <label class="control-item">
        <input 
          type="checkbox" 
          v-model="showScaleBar"
        />
        Show Scale Bar
      </label>
    </div>
    <div 
      ref="treeCanvas" 
      class="tree-canvas"
      style="width: 100%; height: 100%;"
    ></div>
    <!-- Custom Scale Bar -->
    <div 
      v-if="treeInstance && showScaleBar" 
      class="scale-bar-container"
      :style="scaleBarStyle"
    >
      <div class="scale-bar">
        <div class="scale-bar-line"></div>
        <div class="scale-bar-label">{{ scaleBarLabel }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'

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
const showBranchLengths = ref(true) // Show scale by default
const showLeafLabels = ref(true) // Show leaf labels by default
const showScaleBar = ref(true) // Show custom scale bar by default
const scaleBarLength = ref(100) // Length in pixels
const scaleBarValue = ref(0.1) // Actual distance value
const treeInstance = ref<any>(null) // Make reactive so v-if works

// Global phylocanvas flag
let phylocanvasLoaded = false

// Computed properties for scale bar
const scaleBarStyle = computed(() => ({
  bottom: '20px',
  left: '20px',
  width: `${scaleBarLength.value}px`
}))

const scaleBarLabel = computed(() => {
  if (scaleBarValue.value < 0.001) {
    return `${(scaleBarValue.value * 1000000).toFixed(1)} µ`
  } else if (scaleBarValue.value < 1) {
    return `${(scaleBarValue.value * 1000).toFixed(1)} m`
  } else {
    return `${scaleBarValue.value.toFixed(3)}`
  }
})

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

  const styles: Record<string, any> = {};

  for (const leaf of leaves) {
    if (leaf.id) {
      const style: Record<string, any> = {};
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
    if (treeInstance.value) {
      try {
        if (typeof treeInstance.value.destroy === 'function') {
          treeInstance.value.destroy()
        }
      } catch (e) {
        console.log('Error destroying previous tree instance:', e)
      }
      treeInstance.value = null
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
    
    // Create tree props with scale bar enabled
    const treeProps = {
      source: props.newick,
      size: { width, height },
      showLabels: true,
      showLeafLabels: showLeafLabels.value,
      showBranchLengths: showBranchLengths.value, // This shows the scale/branch lengths
      interactive: true,
      padding: 20 // Add some padding to ensure scale is visible
    }
    
    console.log('Tree props:', treeProps)
    console.log('Container element:', treeCanvas.value)
    
    // Create new PhylocanvasGL instance exactly like in CodePen
    treeInstance.value = new PhylocanvasGL(treeCanvas.value, treeProps)

    console.log('PhylocanvasGL instance created successfully:', treeInstance.value)

    // Apply styling after tree is rendered
    await nextTick()
    applyNodeStyling()
    calculateScaleBar()

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
  if (!treeInstance.value) return

  try {
    console.log('Applying node styling...')
    const graph = treeInstance.value.getGraphAfterLayout();
    const leaves = graph.leaves;
    const newStyles = generateStyles(leaves);
    
    if (typeof treeInstance.value.setProps === 'function') {
      treeInstance.value.setProps({ styles: newStyles })
      console.log('Applied styling props using setProps:', newStyles)
    }
    
    // Set up event handlers
    if (typeof treeInstance.value.on === 'function') {
      console.log('Setting up event handlers')
      
      treeInstance.value.on('node-click', (node: any) => {
        console.log('Node clicked:', node.label || 'internal node')
        if (node.isLeaf && node.label) {
          const metadataItem = props.metadata.find(item => item.accession === node.label)
          if (metadataItem) {
            console.log('Node metadata:', metadataItem)
          }
        }
      })

      // Add event listeners for zoom/pan to update scale bar
      treeInstance.value.on('zoom', () => {
        calculateScaleBar()
      })
      
      treeInstance.value.on('pan', () => {
        calculateScaleBar()
      })
    }

  } catch (err) {
    console.error('Error applying node styling:', err)
  }
}

// Function to calculate appropriate scale bar
const calculateScaleBar = () => {
  if (!treeInstance.value) return

  try {
    // Get the current scale from PhylocanvasGL
    const branchScale = treeInstance.value.getBranchScale ? treeInstance.value.getBranchScale() : 1
    const zoom = treeInstance.value.getZoom ? treeInstance.value.getZoom() : 0
    const currentScale = branchScale * Math.pow(2, zoom)
    
    // Calculate a nice round number for the scale bar
    // We want the scale bar to be around 100 pixels long
    const targetPixelLength = 100
    const actualDistance = targetPixelLength / currentScale
    
    // Round to a nice number (1, 2, 5, 10, 20, 50, 100, etc.)
    const magnitude = Math.pow(10, Math.floor(Math.log10(actualDistance)))
    const normalized = actualDistance / magnitude
    
    let niceDistance
    if (normalized <= 1) {
      niceDistance = magnitude
    } else if (normalized <= 2) {
      niceDistance = 2 * magnitude
    } else if (normalized <= 5) {
      niceDistance = 5 * magnitude
    } else {
      niceDistance = 10 * magnitude
    }
    
    // Update scale bar values
    scaleBarValue.value = niceDistance
    scaleBarLength.value = niceDistance * currentScale
    
    console.log('Scale bar calculated:', {
      branchScale,
      zoom,
      currentScale,
      actualDistance,
      niceDistance,
      pixelLength: scaleBarLength.value
    })
    
    console.log('Scale bar should be visible:', {
      showScaleBar: showScaleBar.value,
      hasTreeInstance: !!treeInstance.value,
      scaleBarValue: scaleBarValue.value,
      scaleBarLength: scaleBarLength.value
    })
    
  } catch (err) {
    console.warn('Could not calculate scale bar:', err)
    // Fallback values
    scaleBarValue.value = 0.1
    scaleBarLength.value = 100
  }
}

// Control update functions
const updateBranchLengthsDisplay = () => {
  if (treeInstance.value && typeof treeInstance.value.setProps === 'function') {
    treeInstance.value.setProps({ showBranchLengths: showBranchLengths.value })
    console.log('Updated showBranchLengths to:', showBranchLengths.value)
  }
}

const updateLeafLabelsDisplay = () => {
  if (treeInstance.value && typeof treeInstance.value.setProps === 'function') {
    treeInstance.value.setProps({ showLeafLabels: showLeafLabels.value })
    console.log('Updated showLeafLabels to:', showLeafLabels.value)
  }
}

// Lifecycle hooks
onMounted(() => {
  renderTree()
})

onUnmounted(() => {
  if (treeInstance.value) {
    try {
      if (typeof treeInstance.value.destroy === 'function') {
        treeInstance.value.destroy()
      }
    } catch (e) {
      console.log('Error destroying tree instance:', e)
    }
    treeInstance.value = null
  }
})

// Watchers
watch(() => props.newick, () => {
  renderTree()
})

watch([() => props.colorMap, () => props.selectedField, () => props.searchTerm], () => {
  if (treeInstance.value && typeof treeInstance.value.setProps === 'function') {
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

.tree-controls {
  display: flex;
  gap: 15px;
  padding: 10px;
  background: #f8f9fa;
  border-bottom: 1px solid #ddd;
  border-radius: 4px 4px 0 0;
}

.control-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 14px;
  cursor: pointer;
}

.control-item input[type="checkbox"] {
  margin: 0;
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

.scale-bar-container {
  position: absolute;
  z-index: 1000;
  pointer-events: none;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}

.scale-bar {
  font-size: 12px;
  font-family: monospace;
  color: #333;
}

.scale-bar-line {
  height: 2px;
  background: #333;
  border-left: 2px solid #333;
  border-right: 2px solid #333;
  margin-bottom: 4px;
  width: 100%;
}

.scale-bar-label {
  text-align: center;
  color: #333;
  font-weight: bold;
  font-size: 11px;
}
</style>
