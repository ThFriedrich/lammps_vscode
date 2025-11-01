import { workspace, ShellExecution, Task, TaskDefinition, window, WorkspaceFolder } from 'vscode'

// LAMMPS Task Definition Interface
// Users can configure custom tasks in tasks.json with these properties
interface lmp_task extends TaskDefinition {
    type: 'lmps';
    binary?: string;        // Path to LAMMPS executable
    mpiexec_path?: string;  // Path to MPI launcher (mpiexec, mpirun, srun)
    mpi_tasks?: number;     // Number of MPI processes
    gpu_nodes?: number;     // Number of GPU nodes
    omp_threads?: number;   // Number of OpenMP threads
    args?: string;          // Additional command line arguments
}

export function get_tasks(): Task[] {
    const result: Task[] = [];
    
    // Get workspace folders
    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return result;
    }

    // Create tasks for each workspace folder
    for (const workspaceFolder of workspaceFolders) {
        const lmp_tsk = workspace.getConfiguration('lammps.tasks', workspaceFolder.uri);
        
        const binary = lmp_tsk.get('binary') || 'lmp';
        const mpiexec_path = lmp_tsk.get('mpiexec_path') || 'mpiexec';
        const mpi_tasks = lmp_tsk.get('mpi_tasks') || 4;
        const gpu_nodes = lmp_tsk.get('gpu_nodes') || 1;
        
        const file = window.activeTextEditor?.document.fileName || '${file}';
        
        const execution_cpu = new ShellExecution(`${binary} -in ${file}`);
        const execution_mpi = new ShellExecution(`${mpiexec_path} -np ${mpi_tasks} ${binary} -in ${file}`);
        const execution_gpu = new ShellExecution(`${binary} -sf gpu -pk gpu ${gpu_nodes} -in ${file}`);
        const execution_mpi_gpu = new ShellExecution(`${mpiexec_path} -np ${mpi_tasks} ${binary} -sf gpu -pk gpu ${gpu_nodes} -in ${file}`);
        const execution_skip = new ShellExecution(`${binary} -in ${file} -skiprun`);

        result.push(
            new Task({ type: "lmps" }, workspaceFolder, "Run Single-Task", "lmps", execution_cpu, []),
            new Task({ type: "lmps" }, workspaceFolder, "Run Multi-Task", "lmps", execution_mpi, []),
            new Task({ type: "lmps" }, workspaceFolder, "Run Single-Task GPU", "lmps", execution_gpu, []),
            new Task({ type: "lmps" }, workspaceFolder, "Run Multi-Task GPU", "lmps", execution_mpi_gpu, []),
            new Task({ type: "lmps" }, workspaceFolder, "Run Single-Task (Dry-run)", "lmps", execution_skip, [])
        );
    }
    
    return result;
}

export function resolve_task(tsk: Task): Task | undefined {
    const file = window.activeTextEditor?.document.fileName || '${file}';
    
    // Get the workspace folder from the task scope
    const scope = tsk.scope;
    if (!scope || typeof scope === 'number') {
        return undefined;
    }
    
    const workspaceFolder = scope as WorkspaceFolder;
    const config = workspace.getConfiguration('lammps.tasks', workspaceFolder.uri);
    const tdf = tsk.definition as lmp_task;

    // Validate task type
    if (tdf.type !== 'lmps') {
        return undefined;
    }

    // Get configuration values with fallbacks
    const binary_path = tdf.binary ?? config.get<string>('binary') ?? 'lmp';
    const mpiexec_path = tdf.mpiexec_path ?? config.get<string>('mpiexec_path') ?? 'mpiexec';
    const mpi_tasks = tdf.mpi_tasks ?? config.get<number>('mpi_tasks') ?? 0;
    const gpu_nodes = tdf.gpu_nodes ?? config.get<number>('gpu_nodes') ?? 0;
    const omp_threads = tdf.omp_threads ?? config.get<number>('omp_threads') ?? 0;
    const add_args = tdf.args ?? '';

    // Determine execution mode
    const b_mpi = mpi_tasks > 0;
    const b_gpu = gpu_nodes > 0;
    const b_omp = omp_threads > 0;

    // Build command line based on configuration
    let commandLine = '';

    if (b_mpi && b_gpu) {
        // MPI + GPU
        commandLine = `${mpiexec_path} -np ${mpi_tasks} ${binary_path} -sf gpu -pk gpu ${gpu_nodes}`;
    } else if (b_mpi) {
        // MPI only
        commandLine = `${mpiexec_path} -np ${mpi_tasks} ${binary_path}`;
    } else if (b_gpu) {
        // GPU only
        commandLine = `${binary_path} -sf gpu -pk gpu ${gpu_nodes}`;
    } else {
        // Serial execution
        commandLine = `${binary_path}`;
    }

    // Add OpenMP configuration if specified
    if (b_omp) {
        commandLine += ` -pk omp ${omp_threads}`;
    }

    // Add input file and additional arguments
    commandLine += ` -in ${file}`;
    if (add_args) {
        commandLine += ` ${add_args}`;
    }

    const execution = new ShellExecution(commandLine);
    
    // Create task with a descriptive name based on configuration
    let taskName = 'Run LAMMPS';
    if (b_mpi && b_gpu) {
        taskName += ` (MPI: ${mpi_tasks}, GPU: ${gpu_nodes})`;
    } else if (b_mpi) {
        taskName += ` (MPI: ${mpi_tasks})`;
    } else if (b_gpu) {
        taskName += ` (GPU: ${gpu_nodes})`;
    }
    if (b_omp) {
        taskName += ` (OMP: ${omp_threads})`;
    }

    return new Task(tdf, workspaceFolder, taskName, 'lmps', execution);
}
