# Release Notes v.1.9.0

This major update introduces significant improvements to the dashboard functionality, enhanced linting capabilities, and important dependency updates to address security vulnerabilities. The dump file viewer now supports flexible column ordering and properly handles different coordinate types (scaled, wrapped, unwrapped). Performance visualization has been expanded with detailed timing breakdowns, and the documentation panel now respects your editor font settings.

Please [report issues](https://github.com/ThFriedrich/lammps_vscode/issues/new/choose) if you encounter any problems so they can be fixed. Much of the content of this extension is generated in an automated fashion from the official [Lammps documentation](https://docs.lammps.org/Manual.html). It is hardly possible to check the behaviour of autocomplete and hover features and the generation and formatting of the embedded documentation pages for each individual command, what makes bug reports all the more important and valueable. Also, please share your ideas for enhancements or new features.

---

This package is [Treeware](https://treeware.earth). If you find this extension useful, then we ask that you [🌱 **buy the world a tree**](https://plant.treeware.earth/thfriedrich/lammps_vscode) to thank us for our work.

---

## This Release introduces the following new features and improvements:

 - ### Dashboard Enhancements
   - **Flexible Dump File Support**: Dump viewer now dynamically detects column order from headers instead of using hardcoded indices. Fixes [#63](https://github.com/ThFriedrich/lammps_vscode/issues/63) and [#62](https://github.com/ThFriedrich/lammps_vscode/issues/62)
     - Supports scaled coordinates (`xs`, `ys`, `zs`), unwrapped (`x`, `y`, `z`), and wrapped (`xu`, `yu`, `zu`)
     - Automatically applies correct scaling based on coordinate type
     - Works with any column ordering in dump files
   - **Live Update Controls**: Independent toggle switches for log and dump file monitoring
   - **Performance Visualization**: 
     - Per-step performance breakdowns showing MPI task timing for each run/minimize/neb step
     - Pie charts with detailed hover information including average times and percentages
     - Total wall time display for each simulation step
     - Foldable sections for better organization
   - **Improved Update Handling**: 
     - File size tracking to detect overwrites and restart simulations
     - Incremental reading of large files for better performance
     - Dynamic frame appending for dump plots
     - Throttled window resize events to reduce CPU usage
   - **Better Error Handling**: Validates required columns exist in dump files with clear error messages

 - ### Linting Improvements
   - **Variable Resolution**: Implements variable unpacking to avoid false positives. Fixes [#58](https://github.com/ThFriedrich/lammps_vscode/issues/58) and [#68](https://github.com/ThFriedrich/lammps_vscode/issues/68)
     - Resolves LAMMPS variables (`${VAR}` and `$VAR` syntax) before checking file paths
     - Supports string variables for dynamic file names
   - **Path Validation**: File paths now checked relative to workspace directory instead of script location

 - ### Documentation Panel
   - **Font Settings Integration**: Documentation panel now uses your editor's font size and family settings
     - Automatically syncs with `editor.fontSize` and `editor.fontFamily`
     - Consistent typography between editor and documentation views

 - ### Task Provider
   - **API Compatibility**: Updated implementation to support recent VSCode Task API changes
   - Maintains backward compatibility with existing task definitions

 - ### Packaging & Dependencies
   - **Security Updates**: All npm audit vulnerabilities resolved (0 vulnerabilities)
   - **MathJax Upgrade**: Switched from MathJax-Node to MathJax-Full
     - Better equation rendering in hover and documentation panels
     - Improved compatibility with modern Node.js
   - **NVIDIA SMI Package**: Replaced `node-nvidia-smi` with `@quik-fe/node-nvidia-smi`
     - Fixes Dependabot security warnings for xml2js vulnerability
     - Better support for Node.js 22+
   - **Dependency Cleanup**: Removed deprecated "request" package
   - **Node 22 Migration**: All dependencies updated for Node.js 22 compatibility

 - ### Development Improvements
   - GitHub Actions workflow stability enhanced with retry logic for apt package installation
   - Python environment handling updated for Ubuntu 24.04+ (PEP 668 compliance)
   - Improved CI/CD reliability with better error handling

---