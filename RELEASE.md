# Release Notes v.1.10.0

This release brings performance improvements to documentation lookups, enhanced system monitoring in the dashboard, and improvements to the documentation build pipeline. Math rendering in hovers has been fixed, and several stale dependencies have been updated.

Please [report issues](https://github.com/ThFriedrich/lammps_vscode/issues/new/choose) if you encounter any problems so they can be fixed. Much of the content of this extension is generated in an automated fashion from the official [Lammps documentation](https://docs.lammps.org/Manual.html). It is hardly possible to check the behaviour of autocomplete and hover features and the generation and formatting of the embedded documentation pages for each individual command, what makes bug reports all the more important and valueable. Also, please share your ideas for enhancements or new features.

---

This package is [Treeware](https://treeware.earth). If you find this extension useful, then we ask that you [🌱 **buy the world a tree**](https://plant.treeware.earth/thfriedrich/lammps_vscode) to thank us for our work.

---

## This Release introduces the following new features and improvements:

 - ### Dashboard
   - **System Monitoring**: Added radio buttons for view modes and history tracking for CPU and GPU metrics

 - ### Hover
   - **Math Rendering**: Fixed rendering and handling of large equations in hover panels

 - ### Documentation Pipeline
   - **Caching**: Optimized command documentation retrieval with caching for faster lookups
   - **RST Processing**: Enhanced section parsing, improved directive handling, and added logging for command processing
   - **Testing**: Added a testing step to validate the documentation pipeline
   - **Artifact Checking**: Added regex for orphaned link definitions and substitution references

 - ### Packaging & Dependencies
   - Fixed MathJax externals configuration in webpack
   - Added DOI badge for citation visibility
   - Renamed internal package identifier to avoid dependabot issues
   - Various dependency updates

---