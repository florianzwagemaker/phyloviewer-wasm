# Preloading Implementation

## Overview

The application now uses a preloading strategy to eliminate loading delays when users interact with features. All external dependencies (WASM modules, libraries) are loaded during app initialization instead of on-demand.

## Architecture

### Preloader Service (`src/services/preloader.ts`)

A singleton service that manages the preloading of all external dependencies:

- **Biowasm/Aioli + FastTree**: WebAssembly-based phylogenetic tree calculator
- **PhylocanvasGL**: Tree visualization library from CDN

### Key Features

1. **Parallel Loading**: Dependencies load simultaneously using `Promise.all()`
2. **Singleton Pattern**: Single shared instance of Biowasm across all components
3. **Graceful Fallback**: If preloading fails, components can still load dependencies on-demand
4. **Loading UI**: Full-screen overlay with spinner during initialization

## How It Works

### 1. App Initialization (`App.vue`)

```vue
<script setup>
import { onMounted, ref } from 'vue'
import { preloader } from './services/preloader'

const isPreloading = ref(true)

onMounted(async () => {
  try {
    await preloader.preloadAll()
  } catch (error) {
    console.error('Preloading failed:', error)
  } finally {
    isPreloading.value = false
  }
})
</script>
```

### 2. Component Usage

#### PhyloTree Component
```typescript
import { preloader } from '../services/preloader'

const calculateTree = async () => {
  // Get preloaded instance (or initialize on-demand if preload failed)
  const biowasm = await preloader.getBiowasmInstance()
  
  // Use it immediately - no loading delay
  await biowasm.mount(file)
  const result = await biowasm.exec('fasttree', ['-nt', '-noml', 'input.fasta'])
}
```

#### PhylocanvasViewer Component
```typescript
import { preloader } from '../services/preloader'

const loadPhylocanvasGL = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if already preloaded
    if (preloader.isPhylocanvasLoaded()) {
      console.log('PhylocanvasGL already preloaded')
      phylocanvasLoaded = true
      resolve()
      return
    }
    
    // Fallback to on-demand loading if needed
    // ...
  })
}
```

## Benefits

### Before Preloading
- User loads FASTA → waits for FastTree WASM to load → tree calculates
- tree calculation is done → waits for PhylocanvasGL to load → tree renders
- Multiple loading delays throughout user journey

### After Preloading
- App starts → all dependencies load once in parallel → loading complete
- User loads FASTA → tree calculates immediately (no wait)
- User views tree → tree renders immediately (no wait)

## Trade-offs

### Advantages
- Instant response when user interacts with features
- Better perceived performance
- Single Biowasm instance (memory efficient)
- Predictable loading state (one-time upfront)

### Considerations
- Slightly longer initial page load
- Loads dependencies even if user doesn't use all features
- Network usage on startup vs. on-demand

## Technical Details

### Biowasm Initialization Sequence

1. **Create instance**: `new BiowasmService(['fasttree/2.1.11'])`
2. **Initialize Aioli**: `await biowasmInstance.init()`
   - Downloads WASM module from biowasm.com CDN
   - Initializes WebAssembly runtime
   - Sets up file system and tools
3. **Ready to use**: `await biowasm.mount()` and `await biowasm.exec()` work immediately

### PhylocanvasGL Loading

1. **Script injection**: Adds `<script>` tag to document head
2. **CDN download**: Fetches from unpkg.com
3. **Global registration**: Library becomes available at `window.phylocanvas.PhylocanvasGL`
4. **Ready to use**: Tree can be rendered immediately

### Error Handling

The preloader includes comprehensive error handling:

```typescript
async preloadAll(): Promise<void> {
  try {
    await Promise.all([
      this.preloadBiowasm(),
      this.preloadPhylocanvasGL()
    ])
    console.log('✓ All dependencies preloaded successfully')
  } catch (error) {
    console.error('❌ Preloading failed:', error)
    // Components will fall back to on-demand loading
    throw error
  }
}
```

## Console Output

When working correctly, you'll see this sequence in the browser console:

```
� Starting preload of all external dependencies...
📦 Preloading Biowasm with FastTree...
📦 Preloading PhylocanvasGL from CDN...
Creating Aioli instance with tools: ['fasttree/2.1.11']
Aioli initialized successfully
✓ Biowasm preloaded and initialized
✓ PhylocanvasGL preloaded
✅ All dependencies preloaded successfully in XXXms
```

**If component requests Biowasm while preload is in progress:**
```
Starting tree calculation...
⏳ Waiting for preload to complete...
[Preload finishes]
Biowasm instance retrieved
[Tree calculation proceeds with preloaded instance]
```

## Future Enhancements

Potential improvements to the preloading system:

1. **Progressive Loading**: Load critical dependencies first, defer others
2. **Service Worker Caching**: Cache WASM modules for offline use
3. **Load Monitoring**: Track loading times and report metrics
4. **Lazy Preloading**: Only preload when user shows intent (hover, focus)
   1. This might only be necessary once we implement various other tree calculation methods like IQ-Tree
