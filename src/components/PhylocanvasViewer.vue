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
      <label class="control-item">
        <input 
          type="checkbox" 
          v-model="showPieCharts"
          @change="updatePieChartsDisplay"
        />
        Show Pie Charts on Internal Nodes
      </label>
      <div v-if="showPieCharts" class="pie-chart-help">
        <small>💡 Click internal nodes to collapse/expand them. Collapsed nodes show pie charts automatically.</small>
      </div>
      <div class="debug-info">
        <small>🐛 Check browser console for click event logs</small>
      </div>
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
  
  <!-- Node Action Tooltip - Outside container so it can overflow freely -->
  <Teleport to="body" v-if="nodeTooltip.visible">
    <div 
      class="node-tooltip"
      :class="{ 'dragging': nodeTooltip.isDragging }"
      :style="nodeTooltipGlobalStyle"
    >
      <div 
        class="tooltip-header draggable-header"
        @mousedown="startDrag"
      >
        <strong>{{ nodeTooltip.nodeType }}</strong>
        <div class="header-controls">
          <span class="drag-hint">📋 Drag me</span>
          <button class="tooltip-close" @click="hideNodeTooltip">×</button>
        </div>
      </div>
      <div class="tooltip-content">
        <div v-if="nodeTooltip.isInternal" class="tooltip-actions">
          <button 
            class="tooltip-btn collapse-btn"
            @click="toggleNodeCollapse"
          >
            {{ nodeTooltip.isCollapsed ? 'Expand Node' : 'Collapse Node' }}
          </button>
          <div v-if="showPieCharts && nodeTooltip.pieChartData" class="pie-info">
            <small>{{ nodeTooltip.descendantCount }} descendants with {{ nodeTooltip.pieChartData.length }} different {{ props.selectedField }} values</small>
          </div>
        </div>
        <div v-else class="leaf-info">
          <div v-if="nodeTooltip.metadata">
            <div v-for="(value, key) in nodeTooltip.metadata" :key="key" class="metadata-item">
              <strong>{{ key }}:</strong> {{ value }}
            </div>
          </div>
          <div v-else>
            <small>No metadata available</small>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
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
  labelFields?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  metadata: () => [],
  colorMap: () => ({}),
  selectedField: null,
  searchTerm: '',
  labelFields: () => ['SampleID']
})

// Reactive state
const treeCanvas = ref<HTMLElement | null>(null)
const error = ref<string | null>(null)
const showBranchLengths = ref(true)
const showLeafLabels = ref(true)
const showScaleBar = ref(true)
const showPieCharts = ref(false)
const scaleBarLength = ref(100)
const scaleBarValue = ref(0.1)
const treeInstance = ref<any>(null)

// Node tooltip state
const nodeTooltip = ref({
  visible: false,
  x: 0,
  y: 0,
  node: null as any,
  nodeType: '',
  isInternal: false,
  isCollapsed: false,
  metadata: null as any,
  pieChartData: null as any,
  descendantCount: 0,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,
  dragOffsetX: 0,
  dragOffsetY: 0
})

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

// Computed property for tooltip positioning (global/fixed to body)
const nodeTooltipGlobalStyle = computed(() => {
  let x = nodeTooltip.value.x + nodeTooltip.value.dragOffsetX
  let y = nodeTooltip.value.y + nodeTooltip.value.dragOffsetY
  
  if (!nodeTooltip.value.isDragging) {
    const tooltipWidth = 300
    const tooltipHeight = 200
    
    if (x + tooltipWidth > window.innerWidth) {
      x = window.innerWidth - tooltipWidth - 10
    }
    
    if (y + tooltipHeight > window.innerHeight) {
      y = window.innerHeight - tooltipHeight - 10
    }
    
    x = Math.max(10, x)
    y = Math.max(10, y)
  }
  
  return {
    position: 'fixed' as const,
    left: `${x}px`,
    top: `${y}px`,
    zIndex: 2000,
    cursor: nodeTooltip.value.isDragging ? 'grabbing' : 'default'
  }
})

// Helper functions

/**
 * Extracts the accessionVersion from a node name.
 * Since we strip FASTA headers before tree calculation, node names should already be just accessionVersions.
 * However, we handle the legacy format (accessionVersion|SampleID) just in case.
 */
const extractAccessionVersion = (nodeName: string): string => {
  // Node names are already just accessionVersions since we stripped headers before tree calculation
  // But handle legacy format just in case
  return nodeName.split('|')[0];
};

/**
 * Builds a display label for a tree node based on selected metadata fields.
 * The label always starts with accessionVersion, followed by any selected metadata fields.
 * Fields are joined with the '|' separator.
 * 
 * @param nodeName - The node ID from the tree (should be just the accessionVersion)
 * @returns A formatted label string like "accessionVersion|SampleID|Country"
 */
const buildNodeLabel = (nodeName: string): string => {
  // nodeName is already just the accessionVersion from the tree
  const accessionVersion = extractAccessionVersion(nodeName);
  
  if (!props.metadata.length) {
    // If no metadata, just show the accessionVersion
    return accessionVersion;
  }
  
  const metadataItem = props.metadata.find(item => item.accessionVersion === accessionVersion);
  if (!metadataItem) {
    // If no matching metadata, just show the accessionVersion
    return accessionVersion;
  }
  
  // Start with accessionVersion (always displayed)
  const labelParts = [accessionVersion];
  
  // Add selected label fields in the order they appear in the array
  if (props.labelFields && props.labelFields.length > 0) {
    for (const field of props.labelFields) {
      // Only add non-empty values
      if (metadataItem[field] !== undefined && metadataItem[field] !== null && metadataItem[field] !== '') {
        labelParts.push(metadataItem[field]);
      }
    }
  }
  
  const finalLabel = labelParts.join('|');
  
  // Log only for the first node to avoid console spam
  if (accessionVersion === props.metadata[0]?.accessionVersion) {
    console.log('Building label for first node:', accessionVersion)
    console.log('  Available labelFields:', props.labelFields)
    console.log('  Metadata item:', metadataItem)
    console.log('  Label parts:', labelParts)
    console.log('  Final label:', finalLabel)
  }
  
  return finalLabel;
};

/**
 * Checks if a node matches the current search term.
 * Searches across all metadata fields for the given node.
 */
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

/**
 * Gets the color for a node based on the selected metadata field and color mapping.
 * Returns null if no color mapping is available.
 */
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

/**
 * Generates style objects for all leaf nodes in the tree.
 * Applies custom labels, search highlighting, and color mapping.
 * 
 * @param leaves - Array of leaf nodes from the tree graph
 * @returns Object mapping node IDs to style properties
 */
const generateStyles = (leaves: any[]) => {
  if (!leaves || leaves.length === 0) {
    return {};
  }

  const styles: Record<string, any> = {};

  for (const leaf of leaves) {
    if (leaf.id) {
      const style: Record<string, any> = {};
      
      // Update the label with custom formatting based on selected fields
      style.label = buildNodeLabel(leaf.id);
      
      // Search highlighting takes precedence over color mapping
      if (props.searchTerm && isNodeMatched(leaf.id)) {
        style.fillColour = '#ff0000';
        style.strokeColour = '#cc0000';
        style.strokeWidth = 2;
      } else {
        // Apply color mapping based on metadata field
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

/**
 * Creates metadata object for pie chart visualization.
 * Maps accessionVersions to their metadata values for the selected field.
 * 
 * @returns Object mapping accessionVersion to metadata field values
 */
const createMetadataForPieCharts = () => {
  if (!props.metadata || !props.selectedField) {
    return {};
  }

  const pieMetadata: Record<string, any> = {};
  
  props.metadata.forEach(item => {
    if (item.accessionVersion && props.selectedField && item[props.selectedField]) {
      pieMetadata[item.accessionVersion] = {
        [props.selectedField as string]: item[props.selectedField]
      };
    }
  });

  return pieMetadata;
}

// Tooltip functions

/**
 * Shows the node tooltip at the specified canvas coordinates.
 * Displays different information for leaf vs internal nodes.
 * 
 * @param node - The tree node that was clicked
 * @param canvasX - X coordinate relative to the tree canvas
 * @param canvasY - Y coordinate relative to the tree canvas
 */
const showNodeTooltip = (node: any, canvasX: number, canvasY: number) => {
  console.log('Showing tooltip for node:', node)
  
  const rect = treeCanvas.value?.getBoundingClientRect()
  if (!rect) return
  
  // Convert canvas coordinates to global/fixed coordinates
  const globalX = rect.left + canvasX + 10
  const globalY = rect.top + canvasY - 10
  
  nodeTooltip.value.visible = true
  nodeTooltip.value.x = globalX
  nodeTooltip.value.y = globalY
  nodeTooltip.value.node = node
  nodeTooltip.value.isInternal = !node.isLeaf
  
  console.log('Tooltip positioned at global coords:', globalX, globalY)
  
  if (node.isLeaf) {
    // Leaf node: show metadata
    nodeTooltip.value.nodeType = 'Leaf Node'
    nodeTooltip.value.isCollapsed = false
    
    const accessionVersion = extractAccessionVersion(node.id || node.label || '')
    const metadataItem = props.metadata.find(item => item.accessionVersion === accessionVersion)
    nodeTooltip.value.metadata = metadataItem || null
    nodeTooltip.value.pieChartData = null
    nodeTooltip.value.descendantCount = 0
  } else {
    // Internal node: show collapse option and pie chart data
    nodeTooltip.value.nodeType = 'Internal Node'
    nodeTooltip.value.isCollapsed = node.collapsed || false
    nodeTooltip.value.metadata = null
    
    const descendants = getDescendantLeaves(node)
    nodeTooltip.value.descendantCount = descendants.length
    const pieData = calculatePieChartData(descendants)
    nodeTooltip.value.pieChartData = pieData.length > 0 ? pieData : null
  }
}

/**
 * Hides the node tooltip and resets drag state.
 */
const hideNodeTooltip = () => {
  nodeTooltip.value.visible = false
  nodeTooltip.value.node = null
  nodeTooltip.value.isDragging = false
  nodeTooltip.value.dragOffsetX = 0
  nodeTooltip.value.dragOffsetY = 0
}

/**
 * Initiates tooltip drag operation.
 */
const startDrag = (event: MouseEvent) => {
  event.preventDefault()
  nodeTooltip.value.isDragging = true
  nodeTooltip.value.dragStartX = event.clientX
  nodeTooltip.value.dragStartY = event.clientY
  
  console.log('Started dragging tooltip at:', event.clientX, event.clientY)
  
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

/**
 * Handles tooltip drag movement.
 */
const onDrag = (event: MouseEvent) => {
  if (!nodeTooltip.value.isDragging) return
  
  const deltaX = event.clientX - nodeTooltip.value.dragStartX
  const deltaY = event.clientY - nodeTooltip.value.dragStartY
  
  nodeTooltip.value.dragOffsetX = deltaX
  nodeTooltip.value.dragOffsetY = deltaY
}

/**
 * Ends tooltip drag operation and finalizes position.
 */
const stopDrag = () => {
  if (!nodeTooltip.value.isDragging) return
  
  console.log('Stopped dragging tooltip')
  
  // Apply the offset to the base position
  nodeTooltip.value.x += nodeTooltip.value.dragOffsetX
  nodeTooltip.value.y += nodeTooltip.value.dragOffsetY
  
  // Reset drag state
  nodeTooltip.value.isDragging = false
  nodeTooltip.value.dragOffsetX = 0
  nodeTooltip.value.dragOffsetY = 0
  
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

/**
 * Toggles the collapse/expand state of an internal node.
 */
const toggleNodeCollapse = () => {
  if (!nodeTooltip.value.node || nodeTooltip.value.node.isLeaf) return
  
  if (treeInstance.value && typeof treeInstance.value.collapseNode === 'function') {
    treeInstance.value.collapseNode(nodeTooltip.value.node.id)
    console.log('Toggled collapse for node:', nodeTooltip.value.node.id)
    
    nodeTooltip.value.isCollapsed = !nodeTooltip.value.isCollapsed
    
    // Hide tooltip after a short delay
    setTimeout(() => {
      hideNodeTooltip()
    }, 200)
  }
}

/**
 * Loads the PhylocanvasGL library from CDN.
 * Uses a global phylocanvasLoaded flag to prevent duplicate loading.
 * 
 * @returns Promise that resolves when PhylocanvasGL is available
 */
const loadPhylocanvasGL = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if ((window as any).phylocanvas && (window as any).phylocanvas.PhylocanvasGL) {
      phylocanvasLoaded = true
      resolve()
      return
    }
    
    // Check if script tag already exists
    if (document.querySelector('script[src*="phylocanvas"]')) {
      const checkInterval = setInterval(() => {
        if ((window as any).phylocanvas && (window as any).phylocanvas.PhylocanvasGL) {
          phylocanvasLoaded = true
          clearInterval(checkInterval)
          resolve()
        }
      }, 100)
      
      setTimeout(() => {
        clearInterval(checkInterval)
        reject(new Error('PhylocanvasGL loading timeout'))
      }, 10000)
      return
    }
    
    console.log('Loading PhylocanvasGL from CDN...')
    
    // Create and load script tag
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/@phylocanvas/phylocanvas.gl@1.59.0/dist/bundle.min.js'
    script.onload = () => {
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

/**
 * Main function to render the phylogenetic tree.
 * Loads PhylocanvasGL, creates the tree instance, and sets up event handlers.
 */
const renderTree = async () => {
  if (!treeCanvas.value || !props.newick) {
    return
  }

  try {
    error.value = null
    
    // Clean up previous instance
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

    treeCanvas.value.innerHTML = ''

    console.log('Ensuring PhylocanvasGL is loaded...')
    
    if (!phylocanvasLoaded) {
      await loadPhylocanvasGL()
    }
    
    const PhylocanvasGL = (window as any).phylocanvas.PhylocanvasGL
    
    if (!PhylocanvasGL) {
      throw new Error('PhylocanvasGL constructor not found in global phylocanvas object')
    }

    console.log('Creating PhylocanvasGL instance...')
    
    const containerRect = treeCanvas.value.getBoundingClientRect()
    const width = containerRect.width || 800
    const height = containerRect.height || 600
    
    console.log('Container dimensions:', { width, height })
    
    const treeProps = {
      source: props.newick,
      size: { width, height },
      showLabels: true,
      showLeafLabels: showLeafLabels.value,
      showBranchLengths: showBranchLengths.value,
      showPiecharts: showPieCharts.value,
      showInternalLabels: false,
      metadata: createMetadataForPieCharts(),
      interactive: true,
      padding: 40
    }
    
    console.log('Tree props:', treeProps)
    console.log('Container element:', treeCanvas.value)
    
    treeInstance.value = new PhylocanvasGL(treeCanvas.value, treeProps)
    
    // Override selectNode to show our custom tooltip
    const originalSelectNode = treeInstance.value.selectNode
    treeInstance.value.selectNode = function(node: any) {
      console.log('selectNode called with:', node)
      
      if (node) {
        console.log('Node clicked via selectNode:', node.label || 'internal node', node)
        
        const x = (node.x || 200)
        const y = (node.y || 200)
        
        console.log('Showing tooltip at canvas coords:', node.x, node.y)
        showNodeTooltip(node, x, y)
      } else {
        console.log('Canvas clicked (no node)')
        hideNodeTooltip()
      }
      
      if (originalSelectNode) {
        originalSelectNode.call(this, node)
      }
    }

    console.log('PhylocanvasGL instance created successfully:', treeInstance.value)

    await nextTick()
    applyNodeStyling()
    addPieChartLayer()
    calculateScaleBar()

  } catch (err) {
    console.error('Error rendering tree with PhylocanvasGL:', err)
    error.value = `Failed to render tree: ${(err as Error).message}`
    
    // Show fallback error UI with tree data
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

/**
 * Applies custom styling to all nodes in the tree.
 * Updates labels, colors, and sets up zoom/pan event handlers.
 */
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
    
    // Set up zoom/pan event handlers for scale bar updates
    if (typeof treeInstance.value.on === 'function') {
      console.log('Setting up zoom/pan event handlers')
      
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

/**
 * Configures pie chart visualization on internal nodes.
 * Pie charts show the distribution of metadata values among descendant leaves.
 */
const addPieChartLayer = () => {
  if (!treeInstance.value) return

  try {
    // Remove existing pie chart layer if present
    if (typeof treeInstance.value.removeLayer === 'function') {
      try {
        treeInstance.value.removeLayer('pie-charts')
      } catch (e) {
        // Layer might not exist, that's fine
      }
    }

    if (!showPieCharts.value || !props.selectedField || !props.metadata.length) {
      // Disable pie charts
      if (treeInstance.value) {
        treeInstance.value.setProps({
          showPieCharts: false,
          alignLabels: false,
          showLabels: true
        })
      }
      return
    }

    console.log('Enabling pie charts with metadata field:', props.selectedField)

    treeInstance.value.setProps({
      showPieCharts: true,
      alignLabels: false,
      showLabels: true
    })

    console.log('Pie charts enabled successfully')

  } catch (err) {
    console.error('Error configuring pie charts:', err)
  }
}

/**
 * Recursively collects all leaf nodes that are descendants of a given node.
 * 
 * @param node - The parent node to search from
 * @returns Array of all descendant leaf nodes
 */
const getDescendantLeaves = (node: any): any[] => {
  if (node.isLeaf) return [node]
  
  const leaves: any[] = []
  if (node.children) {
    for (const child of node.children) {
      leaves.push(...getDescendantLeaves(child))
    }
  }
  return leaves
}

/**
 * Calculates pie chart data for an internal node based on its descendant leaves.
 * Groups descendants by the selected metadata field value.
 * 
 * @param descendants - Array of descendant leaf nodes
 * @returns Array of pie chart segments with angles, colors, and values
 */
const calculatePieChartData = (descendants: any[]) => {
  if (!props.selectedField || !props.metadata.length) {
    console.log('No selected field or metadata for pie chart')
    return []
  }

  console.log('Calculating pie chart data for', descendants.length, 'descendants')

  const counts: Record<string, number> = {}
  let total = 0

  descendants.forEach(leaf => {
    const accessionVersion = extractAccessionVersion(leaf.id || leaf.label || '')
    const metadataItem = props.metadata.find(item => item.accessionVersion === accessionVersion)
    
    console.log('Processing leaf:', accessionVersion, 'metadata found:', !!metadataItem)
    
    if (metadataItem && props.selectedField && metadataItem[props.selectedField]) {
      const value = metadataItem[props.selectedField]
      counts[value] = (counts[value] || 0) + 1
      total++
      console.log('Added count for:', value, 'total now:', counts[value])
    }
  })

  console.log('Final counts:', counts, 'total:', total)

  if (total === 0) {
    console.log('No valid metadata found for pie chart')
    return []
  }

  const segments = []
  let currentAngle = 0

  for (const [value, count] of Object.entries(counts)) {
    const proportion = count / total
    const angle = proportion * 2 * Math.PI
    const color = props.colorMap[value] || '#cccccc'
    
    console.log('Creating segment for:', value, 'count:', count, 'proportion:', proportion, 'color:', color)
    
    segments.push({
      startAngle: currentAngle,
      endAngle: currentAngle + angle,
      color,
      value,
      count,
      proportion
    })
    
    currentAngle += angle
  }

  console.log('Created', segments.length, 'pie segments')
  return segments
}

/**
 * Calculates and updates the scale bar dimensions based on current tree zoom and branch scale.
 * The scale bar displays a "nice" round number that represents evolutionary distance.
 */
const calculateScaleBar = () => {
  if (!treeInstance.value) return

  try {
    const branchScale = treeInstance.value.getBranchScale ? treeInstance.value.getBranchScale() : 1
    const zoom = treeInstance.value.getZoom ? treeInstance.value.getZoom() : 0
    const currentScale = branchScale * Math.pow(2, zoom)
    
    const targetPixelLength = 100
    const actualDistance = targetPixelLength / currentScale
    
    // Round to a "nice" number (1, 2, 5, or 10 * power of 10)
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
    scaleBarValue.value = 0.1
    scaleBarLength.value = 100
  }
}

/**
 * Updates the tree display to show/hide branch lengths.
 */
const updateBranchLengthsDisplay = () => {
  if (treeInstance.value && typeof treeInstance.value.setProps === 'function') {
    treeInstance.value.setProps({ showBranchLengths: showBranchLengths.value })
    console.log('Updated showBranchLengths to:', showBranchLengths.value)
  }
}

/**
 * Updates the tree display to show/hide leaf labels.
 */
const updateLeafLabelsDisplay = () => {
  if (treeInstance.value && typeof treeInstance.value.setProps === 'function') {
    treeInstance.value.setProps({ showLeafLabels: showLeafLabels.value })
    console.log('Updated showLeafLabels to:', showLeafLabels.value)
  }
}

/**
 * Updates the tree display to show/hide pie charts on internal nodes.
 */
const updatePieChartsDisplay = () => {
  if (treeInstance.value && typeof treeInstance.value.setProps === 'function') {
    treeInstance.value.setProps({ 
      showPiecharts: showPieCharts.value,
      metadata: createMetadataForPieCharts() 
    })
    console.log('Updated showPiecharts to:', showPieCharts.value)
    
    addPieChartLayer()
  }
}

// Lifecycle hooks
onMounted(() => {
  renderTree()
})

onUnmounted(() => {
  // Clean up tree instance
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
  
  // Clean up drag event listeners
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
})

// Watchers
watch(() => props.newick, () => {
  renderTree()
})

// Watch for changes to visualization properties
// Deep watch on labelFields ensures array changes are detected
watch([() => props.colorMap, () => props.selectedField, () => props.searchTerm, () => [...props.labelFields]], () => {
  console.log('Props changed - labelFields:', props.labelFields)
  if (treeInstance.value && typeof treeInstance.value.setProps === 'function') {
    applyNodeStyling();
    if (showPieCharts.value) {
      updatePieChartsDisplay();
    }
  }
}, { deep: true })
</script>

<style scoped>
.phylocanvas-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden; /* Prevent content from extending outside container */
  border: 1px solid #ddd; /* Optional: add border to visualize container bounds */
  border-radius: 4px;
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

.pie-chart-help {
  grid-column: 1 / -1;
  background: rgba(0, 123, 255, 0.1);
  border: 1px solid rgba(0, 123, 255, 0.3);
  border-radius: 4px;
  padding: 5px 8px;
  margin-top: 5px;
}

.pie-chart-help small {
  color: #0056b3;
  font-style: italic;
}

.debug-info {
  grid-column: 1 / -1;
  background: rgba(255, 193, 7, 0.1);
  border: 1px solid rgba(255, 193, 7, 0.3);
  border-radius: 4px;
  padding: 5px 8px;
  margin-top: 5px;
}

.debug-info small {
  color: #856404;
  font-style: italic;
}

.tree-canvas {
  width: 100%;
  height: 100%;
  min-height: 600px;
  overflow: hidden; /* Ensure tree content stays within bounds */
  box-sizing: border-box; /* Include padding/border in width/height calculations */
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

.node-tooltip {
  background: white;
  border: 2px solid #333;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  min-width: 200px;
  max-width: 300px;
  font-size: 13px;
  pointer-events: auto;
}

.tooltip-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8f9fa;
  padding: 8px 12px;
  border-bottom: 1px solid #ddd;
  border-radius: 6px 6px 0 0;
}

.draggable-header {
  cursor: grab;
  user-select: none;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
}

.draggable-header:hover {
  background: linear-gradient(135deg, #e9ecef 0%, #dee2e6 100%);
}

.draggable-header:active {
  cursor: grabbing;
}

.node-tooltip.dragging {
  transition: none; /* Disable transitions while dragging */
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.drag-hint {
  font-size: 11px;
  color: #6c757d;
  font-style: italic;
}

.tooltip-close {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tooltip-close:hover {
  color: #333;
  background: rgba(0,0,0,0.1);
  border-radius: 3px;
}

.tooltip-content {
  padding: 12px;
}

.tooltip-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tooltip-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.tooltip-btn:hover {
  background: #0056b3;
}

.collapse-btn {
  background: #28a745;
}

.collapse-btn:hover {
  background: #1e7e34;
}

.pie-info {
  background: rgba(0, 123, 255, 0.1);
  border: 1px solid rgba(0, 123, 255, 0.3);
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 11px;
  color: #0056b3;
}

.leaf-info .metadata-item {
  margin: 4px 0;
  padding: 2px 0;
  border-bottom: 1px solid #eee;
}

.leaf-info .metadata-item:last-child {
  border-bottom: none;
}

.leaf-info strong {
  color: #555;
  margin-right: 8px;
}
</style>
