# Release Notes v.1.6.0, v.1.7.0 and v.1.8.8

In this update some minor changes were introduced and features added and bugs fixed: [#51](https://github.com/ThFriedrich/lammps_vscode/issues/51), [#49](https://github.com/ThFriedrich/lammps_vscode/issues/49), [#39](https://github.com/ThFriedrich/lammps_vscode/issues/39). This concerns issues with resolving relative file paths in the linting functions. Issue [#52](https://github.com/ThFriedrich/lammps_vscode/issues/52), introduces symbols to create an outline of the document based on folding markers. The python scripts to generate the doc_obj.ts from the online rst-files got some updates and fixes too. Further, the task provider functinality was updated to allow a better customisation of task definitions [#41](https://github.com/ThFriedrich/lammps_vscode/issues/41). A dry-run task was also added as discussed in [#11](https://github.com/ThFriedrich/lammps_vscode/issues/51). The atomic-dump viewer in the dashboard was updated to scale the plots according to the simulation box dimensions. The auto-resize feature was improved as well.

 Please [report issues](https://github.com/ThFriedrich/lammps_vscode/issues/new/choose) if you encounter any problems so they can be fixed. Much of the content of this extension is generated in an automated fashion from the official [Lammps documentation](https://docs.lammps.org/Manual.html). It is hardly possible to check the behaviour of autocomplete and hover features and the generation and formatting of the embedded documentation pages for each individual command, what makes bug reports all the more important and valueable. Also, please share your ideas for enhancements or new features. 

---

This package is [Treeware](https://treeware.earth). If you find this extension useful, then we ask that you [🌱 **buy the world a tree**](https://plant.treeware.earth/thfriedrich/lammps_vscode) to thank us for our work.

---

## This Release introduces the following new features and improvements:

 - ### Added **Outline** as discussed in [Issue #52](https://github.com/ThFriedrich/lammps_vscode/issues/52)
   - Adds symbols at extension-specific folding start-marker '#[' and uses subsequent string as description in the Outline tab
![image](https://github.com/ThFriedrich/lammps_vscode/assets/47680554/363c192c-5fae-4367-8b8e-a3946aa1175b)

 - ### Linting
   - Previously file-path-exists type of checks related to the current working directory, which has now been fixed to use the path relative to the lammps input script location instead.

 - ### Grammar
   - Keywords updated
   - Update doc_obj generation scripts
   - Changed the way to split the rst into sections to improve stability
   - Added checks for minimal entries found (e.g. Syntax, Description, Examples)
   - Updated for new rst-directives (tabs, admonition, deprecated, only html, figure, versionadded)
   - several smaller bugfixes and formatting improvements
  
 - ### Development
   - Codebase cleanups based on new ESLint
   - Updated Task and debug definitions in .vscode

 - ### Dependencies updated
   - "@types/node": "^12.12.55" -> "^18.0.0",
   - "@typescript-eslint/eslint-plugin": "^2.18.0" -> "^6.0.0" 
   - "@typescript-eslint/parser": "^2.18.0" -> "^6.0.0"
   - vsce: "1.88.0" -> "@vscode/vsce": "^2.19.0"
   - "typescript": "^3.9.7" -> "^5.1.6"
   - "acorn": "^7.0.0" -> "^8.0.0"

 - ### Task Provider
   - Codebase cleanups
   - Add dry run task
   - Add "args" option for custom task definitions
   - Add "omp_threads" argument
  
 - ### Dashboard
   - Improve auto-rescaling behaviour of dump-div
   - Add scaling to dump plots to properly account for box size
   - Bugfixes for dump and log viewer in Windows

 - ### Packaging
   - Add Logo for Lammps-input-script files in tree view, etc. 

---