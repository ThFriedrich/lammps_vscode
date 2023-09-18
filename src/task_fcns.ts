import { workspace, ShellExecution, Task, TaskScope, TaskDefinition, window, WorkspaceFolder } from 'vscode'

const type = "lmps";

interface lmp_task extends TaskDefinition {
    binary: string;
    mpi_tasks?: Number;
    gpu_nodes?: Number;
    args?: string
}

export function get_tasks(): Task[] {
    const lmp_tsk = workspace.getConfiguration('lammps.tasks')
    const file = window.activeTextEditor?.document.fileName
    const execution_cpu = new ShellExecution(`${lmp_tsk.binary} -in ${file}`);
    const execution_mpi = new ShellExecution(`mpirun -np ${lmp_tsk.mpi_tasks.toString()} ${lmp_tsk.binary} -in ${file}`);
    const execution_gpu = new ShellExecution(`${lmp_tsk.binary} -sf gpu -pk gpu ${lmp_tsk.gpu_nodes.toString()} -in ${file}`);
    const execution_mpi_gpu = new ShellExecution(`mpirun -np ${lmp_tsk.mpi_tasks.toString()} ${lmp_tsk.binary} -sf gpu -pk gpu ${lmp_tsk.gpu_nodes.toString()} -in ${file}`);
    const execution_skip = new ShellExecution(`${lmp_tsk.binary} -in ${file} -skiprun`);
    return [
        new Task({ type: type }, TaskScope.Workspace,
            "Run Single-Task", "lmps", execution_cpu, []),
        new Task({ type: type }, TaskScope.Workspace,
            "Run Multi-Task", "lmps", execution_mpi, []),
        new Task({ type: type }, TaskScope.Workspace,
            "Run Single-Task GPU", "lmps", execution_gpu, []),
        new Task({ type: type }, TaskScope.Workspace,
            "Run Multi-Task GPU", "lmps", execution_mpi_gpu, []),
        new Task({ type: type }, TaskScope.Workspace,
            "Run Single-Task (Dry-run)", "lmps", execution_skip, []),
    ];
}

export function resolve_task(tsk: Task): Task | undefined {
    const file = window.activeTextEditor?.document.fileName
    const tdf: lmp_task = <any>tsk.definition;
    const execution = new ShellExecution('')
    if (tdf.mpi_tasks && tdf.gpu_nodes) { // Multi-Task GPU
        execution.commandLine = `mpirun -np ${tdf.mpi_tasks.toString()} ${tdf.binary} -sf gpu -pk gpu ${tdf.gpu_nodes.toString()} -in ${file} ${tdf.args}`;
    }
    else if (!tdf.mpi_tasks && tdf.gpu_nodes) { // Single-Task GPU
        execution.commandLine = `${tdf.binary} -sf gpu -pk gpu ${tdf.gpu_nodes.toString()} -in ${file} ${tdf.args}`;
    }
    else if (tdf.mpi_tasks && !tdf.gpu_nodes) { // Multi-Task CPU
        execution.commandLine = `mpirun -np ${tdf.mpi_tasks.toString()} ${tdf.binary} -in ${file} ${tdf.args}`;
    }
    else { // Single-Task CPU
        execution.commandLine = `${tdf.binary} -in ${file} ${tdf.args}`;
    }
    return new Task(
        tdf,
        TaskScope.Workspace,
        "Run",
        "lmps",
        execution);
}
