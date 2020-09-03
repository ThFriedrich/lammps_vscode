# Release Notes v.1.4.0

In this update some minor changes were introduced and features added. Please [report issues](https://github.com/ThFriedrich/lammps_vscode/issues/new/choose) if you encounter any problems so they can be fixed. Much of the content of this extension is generated in an automated fashion from the official [Lammps documentation](https://lammps.sandia.gov/doc/Manual.html). It is hardly possible to check the behaviour of autocomplete and hover features for each individual command, what makes bug reports all the more important and valueable. Also, please share your ideas for enhancements or new features. 

---

This package is [Treeware](https://treeware.earth). If you find this extension useful, then we ask that you [🌱 **buy the world a tree**](https://plant.treeware.earth/thfriedrich/lammps_vscode) to thank us for our work.

---

## This Release introduces the following new features and improvements:


 - ### Synchronisation of lammps_vscode with Lammps documentation
 - ### Task Provider 
   - Lammps can now be run as a task from within vscode
   - Settings added for: 
      - __binary__: path to the Lammps executable
      - __mpi_tasks__: # of MPI tasks to run for parallel execution
      - __gpu_nodes__: # of GPU Nodes to use with the *gpu* package
   - Task type *"lmps"* provided to set up tasks manually in a *tasks.json*-file 
 - ### Hover Feature
   - Documentation links in hover boxes now open the embedded documentation pages inside vscode instead of pointing to the weblink
 - ### Auto Completion
   - Documentation links in autocomplete-info boxes now open the embedded documentation pages inside vscode instead of pointing to the weblink
   - Autocomplete suggestions are now only triggered at the beginning of lines
 - ### Grammar
   - Keywords updated 
   - Updates to Grammar rules to avoid some false positive matches
 - ### Offline embedded documentation
   - Improved layout of "Note" and "Warning" sections
   - fix missing rst-file includes 
   - fixed several formatting issues
   - added Syntax highlighting support through vscode-textmate and markdown-it.
   - added standard light/dark css-files to control syntax highlighting in the webview. (because Token-Colors are not exposed through vscode API yet)
---

If you have to or want to revert to a previous release, please download the corresponding vsix-package from [GitHub](https://github.com/ThFriedrich/lammps_vscode/releases) and [install it](https://code.visualstudio.com/docs/editor/extension-gallery#_install-from-a-vsix) from the command line with the following command:
```bash
code --install-extension lammps-1.2.4.vsix 
```
---

