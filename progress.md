# Project Progress

This document tracks the progress of the PhyloViewer project.

## To-Do List

### Project Setup
- [x] Initialize Vue + TypeScript project with Vite.
- [x] Install npm dependencies.
- [x] Set up project structure (components, services, etc.).

### File Handling
- [x] Implement FASTA file loading from a URL (textbox).
- [x] Implement FASTA file loading from `input-fasta` URL parameter.
- [x] Implement TSV metadata loading from a URL parameter.

### Backend (WebAssembly)
- [x] Integrate `fasttree` biowasm module for phylogenetic tree calculation.
- [x] Create a wrapper service for the wasm module.

### Visualization
- [x] Choose and integrate a tree visualization library (PhylocanvasGL via CDN).
- [x] Implement the main visualization component.
- [x] Fix PhylocanvasGL loading issues by using CDN URL: https://unpkg.com/@phylocanvas/phylocanvas.gl@latest/dist/bundle.min.js
- [x] Implement interactive features (zoom, pan) - provided by PhylocanvasGL.
- [x] Implement node clicking to show information.
- [x] Implement collapsible side-panel.
  - There technically is a side panel but i'd like to change it to a proper side-panel on the right side of the screen that you can hide.
- [x] Implement tooltip for node information.
- [x] Implement metadata-based color-coding.
- [x] Implement legend for color-coding.
- [x] Implement search functionality in the side-panel.
- [x] Implement a ruler for the tree.
- [x] Implement pie charts on internal nodes showing metadata distribution of descendants.

### Additional Features
- [ ] Implement "Back to Source" link in a tooltip on nodes.
- [ ] Implement URL construction for the "Back to Source" link.
- [x] Implement customizable leaf-node labels with multi-select dropdown.
  - FASTA headers are stripped to accessionVersion before tree calculation
  - SampleID is selected by default but can be toggled
  - Users can select multiple metadata fields to append to labels
  - Labels update dynamically when selections change

### Deployment
- [ ] Configure the project for static hosting.
- [ ] Create a deployment script.

## Technical Notes

### PhylocanvasGL Integration
- **Issue**: The npm package `@phylocanvas/phylocanvas.gl` was causing "setting getter-only property" errors due to bundling incompatibilities.
- **Solution**: Load PhylocanvasGL from CDN using the URL `https://unpkg.com/@phylocanvas/phylocanvas.gl@latest/dist/bundle.min.js` which provides a global `PhylocanvasGL` constructor.
- **Implementation**: The Vue component now successfully loads and renders phylogenetic trees with full interactivity.

### Current Architecture
- **Frontend**: Vue 3 + TypeScript + Vite
- **Tree Calculation**: FastTree via @biowasm/aioli WebAssembly
- **Visualization**: PhylocanvasGL loaded from CDN
- **File Handling**: Browser-based URL fetching for FASTA and TSV files

### Label Field Implementation
- **FASTA Header Processing**: Input FASTA headers in format `accessionVersion|SampleID` are stripped to just `accessionVersion` before tree calculation
- **Tree Node IDs**: All tree leaf nodes use only `accessionVersion` as their identifier
- **Label Construction**: Labels are dynamically built by:
  1. Starting with `accessionVersion` (always visible)
  2. Appending selected metadata fields from the multi-select dropdown
  3. Joining with `|` separator (e.g., `accessionVersion|SampleID|Country`)
- **Default Behavior**: `SampleID` is selected by default when metadata loads
- **Dynamic Updates**: Labels update in real-time when users change field selections
- **Metadata Matching**: The `accessionVersion` serves as the key to match tree nodes with metadata records
