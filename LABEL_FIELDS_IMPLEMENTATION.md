# Label Fields Implementation

## Overview
This document describes the implementation of customizable leaf-node labels in the PhyloViewer application.

## Problem Statement
The input FASTA files contain headers in the format `accessionVersion|SampleID`. We need to:
1. Use only `accessionVersion` as the tree node identifier (for metadata matching)
2. Allow users to optionally display additional metadata fields alongside the accessionVersion
3. Have `SampleID` displayed by default but allow users to toggle it on/off
4. Support multiple metadata fields in the label

## Solution Architecture

### 1. FASTA Header Stripping (PhyloTree.vue)
**Location**: `src/components/PhyloTree.vue`

Before calculating the phylogenetic tree, we strip all FASTA headers to contain only the `accessionVersion`:

```typescript
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
```

This ensures that:
- Tree node IDs are consistent (always `accessionVersion`)
- Metadata matching is straightforward
- Labels can be customized independently from tree structure

### 2. Label Field Selection (SidePanel.vue)
**Location**: `src/components/SidePanel.vue`

The side panel provides a multi-select checkbox interface for choosing label fields:

**Features**:
- Displays all available metadata fields (except `accessionVersion`)
- `SampleID` is selected by default when metadata loads
- Checkboxes update immediately as metadata changes
- Emits `update:label-fields` event when selections change

**Key Implementation Details**:
```typescript
const selectedLabelFields = ref<string[]>(['SampleID'])

// When metadata loads, ensure SampleID is selected if available
watch(() => props.metadata, () => {
  if (props.metadata.length > 0) {
    const hasSampleID = availableLabelFields.value.includes('SampleID')
    if (hasSampleID && !selectedLabelFields.value.includes('SampleID')) {
      selectedLabelFields.value = ['SampleID']
    }
    emit('update:label-fields', selectedLabelFields.value)
  }
})
```

### 3. Label Construction (PhylocanvasViewer.vue)
**Location**: `src/components/PhylocanvasViewer.vue`

Labels are dynamically constructed based on user selections:

```typescript
const buildNodeLabel = (nodeName: string): string => {
  const accessionVersion = extractAccessionVersion(nodeName);
  
  if (!props.metadata.length) {
    return accessionVersion;
  }
  
  const metadataItem = props.metadata.find(
    item => item.accessionVersion === accessionVersion
  );
  
  if (!metadataItem) {
    return accessionVersion;
  }
  
  const labelParts = [accessionVersion];
  
  if (props.labelFields && props.labelFields.length > 0) {
    for (const field of props.labelFields) {
      if (metadataItem[field]) {
        labelParts.push(metadataItem[field]);
      }
    }
  }
  
  return labelParts.join('|');
}
```

### 4. Dynamic Label Updates
**Location**: `src/components/PhylocanvasViewer.vue`

Labels are updated dynamically when field selections change:

```typescript
watch([() => props.colorMap, () => props.selectedField, 
       () => props.searchTerm, () => props.labelFields], () => {
  if (treeInstance.value && typeof treeInstance.value.setProps === 'function') {
    applyNodeStyling();
    if (showPieCharts.value) {
      updatePieChartsDisplay();
    }
  }
})
```

The `applyNodeStyling()` function calls `generateStyles()`, which rebuilds labels for all leaf nodes.

## Data Flow

1. **FASTA Input** → Headers in format `accessionVersion|SampleID`
2. **Tree Calculation** → Headers stripped to `accessionVersion` only
3. **Metadata Loading** → `SampleID` automatically selected in side panel
4. **Initial Rendering** → Labels show `accessionVersion|SampleID`
5. **User Changes Selection** → Watcher triggers label rebuild
6. **Label Update** → Tree re-renders with new labels

## Example Usage

### Input FASTA Header
```
>NC_045512.2|Sample123
```

### After Stripping (Tree Calculation)
```
>NC_045512.2
```

### Metadata Record
```json
{
  "accessionVersion": "NC_045512.2",
  "SampleID": "Sample123",
  "Country": "USA",
  "CollectionDate": "2023-01-15"
}
```

### Possible Labels
- **No fields selected**: `NC_045512.2`
- **SampleID only** (default): `NC_045512.2|Sample123`
- **SampleID + Country**: `NC_045512.2|Sample123|USA`
- **All fields**: `NC_045512.2|Sample123|USA|2023-01-15`

## Benefits

1. **Consistent Node IDs**: Tree always uses `accessionVersion` for node identification
2. **Flexible Display**: Users control what information is shown in labels
3. **Metadata Matching**: Simple key-based lookup using `accessionVersion`
4. **Real-time Updates**: Labels change immediately when selections change
5. **No Tree Recalculation**: Changing labels doesn't require recalculating the tree

## Testing Checklist

- [ ] FASTA headers are correctly stripped before tree calculation
- [ ] Tree node IDs are just accessionVersions
- [ ] SampleID checkbox is checked by default when metadata loads
- [ ] Unchecking SampleID shows only accessionVersion
- [ ] Selecting additional fields appends them to labels
- [ ] Labels update immediately when selections change
- [ ] Metadata matching works correctly with accessionVersion
- [ ] No tree recalculation occurs when labels change
