This document outlines the basic minimum viable product (MVP) requirements for the PhyloViewer project. The goal of the MVP is to provide a functional and user-friendly web application for visualizing phylogenetic trees. The following sections detail the key features and functionalities that must be included in the MVP.

This product should leverage existing (pre-compiled) WebAssembly modules where possible.

## Minimum viable product details

### File Handling:

* Load and parse multiple sequences in the FASTA format through a URL, this URL can both be provided through a textbox input field or through a URL parameter called 'input-fasta'.
* The input FASTA must be pre-aligned. It is NOT in-scope right now to perform sequence alignment in the browser.
* Load and parse a metadata file provided in TSV format which gets fetched through a URL parameter.

### Visualization:

* Upon parsing the input FASTA and metadata files, the application must calculate a phylogenetic tree using a suitable algorithm (e.g., Neighbor-Joining, UPGMA) and visualize it using a tree visualization library (e.g., D3.js, PhyloCanvas).
* The calculation must be performed using the fasttree biowasm webassembly module if possible, or through a rust webassembly backend if this easier for current integration.
* The visualization must be interactive, allowing users to explore the phylogenetic tree by zooming, panning, and clicking on nodes to reveal more information.
* A user must have the ability to color-code nodes in the tree based on metadata fields. This should be configurable through a collapsible side-panel.
* The application must provide a legend or key to explain the color-coding scheme used in the tree visualization.
* The side-panel must also allow users to search for specific nodes or metadata attributes in the tree.
* The visualization pane must include a ruler that scales to the distances and information in the tree.
* The frontend should be written in TypeScript and utilize a relatively modern framework such as React, Vue or Svelte.
* The entire application should be hostable without a dedicated backend server, everything must happen client-side.


### Additional features
* A user should be able to navigate back to the source-information panel from the visualization pane, this should be done through a tooltip that contains a "Back to Source" link. The standardized link should be provided as a URL parameter called 'source-link'. The metadata will contain an accession, and this accession should be the identifier used in the "Back to Source" link. This final URL for linkbacks should look like: 'https://source-link.com/seq/{accession}'

* a user should be able to see pie-charts on internal nodes showing the distribution of metadata values for all descendant leaf nodes. For example, if a metadata field is "Country" and an internal node has 10 descendant leaves, 5 from USA, 3 from Canada and 2 from Mexico, the pie chart on that internal node should show 50% USA, 30% Canada and 20% Mexico.

* The user should be able to change (up to a certain point) the labels of the leaf-nodes in the tree. The input fasta will always follow the format `accessionVersion|SampleID`. The accessionVersion should always be present as this is the matching key between metadata and the tree. However the user should be able to choose any additional metadata fields to append to the label, the should be optional but enabled by default. The user should be able to choose these additional fields through a multi-select dropdown in the side-panel.