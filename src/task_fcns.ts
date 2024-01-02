import { workspace, ShellExecution, Task, TaskScope, TaskDefinition, window } from 'vscode'

// Lammps Task Definition
interface lmp_task extends TaskDefinition {
    binary?: string;
    mpiexec_path?: string;
    mpi_tasks?: number;
    gpu_nodes?: number;
    omp_threads?: number;
    args?: string
}

export function get_tasks(): Task[] {
    //Define default task executions
    const lmp_tsk = workspace.getConfiguration('lammps.tasks')
    const file = window.activeTextEditor?.document.fileName
    const execution_cpu = new ShellExecution(`${lmp_tsk.binary} -in ${file}`);
    const execution_mpi = new ShellExecution(`${lmp_tsk.mpiexec_path} -np ${lmp_tsk.mpi_tasks.toString()} ${lmp_tsk.binary} -in ${file}`);
    const execution_gpu = new ShellExecution(`${lmp_tsk.binary} -sf gpu -pk gpu ${lmp_tsk.gpu_nodes.toString()} -in ${file}`);
    const execution_mpi_gpu = new ShellExecution(`${lmp_tsk.mpiexec_path} -np ${lmp_tsk.mpi_tasks.toString()} ${lmp_tsk.binary} -sf gpu -pk gpu ${lmp_tsk.gpu_nodes.toString()} -in ${file}`);
    const execution_skip = new ShellExecution(`${lmp_tsk.binary} -in ${file} -skiprun`);

    // Create tasks
    return [
        new Task({ type: "lmps" }, TaskScope.Workspace,
            "Run Single-Task", "lmps", execution_cpu, []),
        new Task({ type: "lmps" }, TaskScope.Workspace,
            "Run Multi-Task", "lmps", execution_mpi, []),
        new Task({ type: "lmps" }, TaskScope.Workspace,
            "Run Single-Task GPU", "lmps", execution_gpu, []),
        new Task({ type: "lmps" }, TaskScope.Workspace,
            "Run Multi-Task GPU", "lmps", execution_mpi_gpu, []),
        new Task({ type: "lmps" }, TaskScope.Workspace,
            "Run Single-Task (Dry-run)", "lmps", execution_skip, [])
    ];
}

export function resolve_task(tsk: Task): Task | undefined {
    const file = window.activeTextEditor?.document.fileName
    let config = workspace.getConfiguration('lammps.tasks');
    const tdf: lmp_task = <any>tsk.definition;

    // Set binary and mpiexec path from config or task definition
    let binary_path: string
    let mpiexec_path: string
    if (!tdf['mpiexec_path']) 
        { mpiexec_path = config.get('mpiexec_path')! }
    else 
        {mpiexec_path = tdf.mpiexec_path}
    if (!tdf['binary']) 
        { binary_path = config.get('binary')! }
    else 
        { binary_path = tdf.binary! }

    // Determine if task is MPI, GPU or OMP
    const b_mpi:boolean = !!tdf.mpi_tasks && tdf.mpi_tasks > 0
    const b_gpu:boolean = !!tdf.gpu_nodes && tdf.gpu_nodes > 0
    const b_omp:boolean = !!tdf.omp_threads && tdf.omp_threads > 0

    // Create execution string
    const execution = new ShellExecution('')
    let add_args: String = ''
    if (tdf.args) { add_args = tdf.args }

    if (b_mpi && b_gpu) { // Multi-Task GPU
        execution.commandLine = `${mpiexec_path} -np ${tdf.mpi_tasks!.toString()} ${binary_path} -sf gpu -pk gpu ${tdf.gpu_nodes!.toString()}`;
    }
    else if (!b_mpi && b_gpu) { // Single-Task GPU
        execution.commandLine = `${binary_path} -sf gpu -pk gpu ${tdf.gpu_nodes!.toString()}`;
    }
    else if (b_mpi && !b_gpu) { // Multi-Task CPU
        execution.commandLine = `${mpiexec_path} -np ${tdf.mpi_tasks!.toString()} ${binary_path}`;
    }
    else { // Single-Task CPU
        execution.commandLine = `${binary_path} -in ${file} ${add_args}`;
    }

    if (b_omp) { // Add OMP-Threads
        execution.commandLine = `${execution.commandLine} -pk omp ${tdf.omp_threads!.toString()}`
    }

    // Add input file and additional arguments
    execution.commandLine = `${execution.commandLine}  -in ${file} ${add_args}`

    // Create Task
    return new Task(
        tdf,
        TaskScope.Workspace,
        "Run Custom",
        "lmps",
        execution);
}
