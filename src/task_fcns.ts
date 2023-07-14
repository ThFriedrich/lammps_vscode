import { workspace, ShellExecution, Task, TaskScope, TaskDefinition, window, WorkspaceFolder } from 'vscode'

const type = "lmps";

interface lmp_task extends TaskDefinition {
    binary: string;
    task: string;
    mpi_tasks?: Number;
    gpu_nodes?: Number;
}

export function get_tasks(): Task[] {
    const lmp_tsk = workspace.getConfiguration('lammps.tasks')
    const file = window.activeTextEditor?.document.fileName
    const execution_cpu = new ShellExecution(`${lmp_tsk.binary} -in ${file}`);
    const execution_mpi = new ShellExecution(`mpirun -np ${lmp_tsk.mpi_tasks.toString()} ${lmp_tsk.binary} -in ${file}`);
    const execution_gpu = new ShellExecution(`${lmp_tsk.binary} -sf gpu -pk gpu ${lmp_tsk.gpu_nodes.toString()} -in ${file}`);
    const execution_mpi_gpu = new ShellExecution(`mpirun -np ${lmp_tsk.mpi_tasks.toString()} ${lmp_tsk.binary} -sf gpu -pk gpu ${lmp_tsk.gpu_nodes.toString()} -in ${file}`);
    return [
        new Task({ type: type }, TaskScope.Workspace,
            "Run Single-Task", "lmps", execution_cpu, []),
        new Task({ type: type }, TaskScope.Workspace,
            "Run Multi-Task", "lmps", execution_mpi, []),
        new Task({ type: type }, TaskScope.Workspace,
            "Run Single-Task GPU", "lmps", execution_gpu, []),
        new Task({ type: type }, TaskScope.Workspace,
            "Run Multi-Task GPU", "lmps", execution_mpi_gpu, [])
    ];
}

export function resolve_task(tsk: Task): Task | undefined {
    const file = window.activeTextEditor?.document.fileName
    const tdf: lmp_task = <any>tsk.definition;
    const execution = new ShellExecution('')
    switch (tdf.task) {
        case "Run Single-Task":
            execution.commandLine = `${tdf.binary} -in ${file}`;
            break;
        case "Run Multi-Task":
            if (tdf.mpi_tasks) {
                execution.commandLine = `mpirun -np ${tdf.mpi_tasks.toString()} ${tdf.binary} -in ${file}`;
            }
            break;
        case "Run Single-Task GPU":
            if (tdf.gpu_nodes) {
                execution.commandLine = `${tdf.binary} -sf gpu -pk gpu ${tdf.gpu_nodes.toString()} -in ${file}`;
            }
            break;
        case "Run Multi-Task GPU":
            if (tdf.mpi_tasks && tdf.gpu_nodes) {
                execution.commandLine = `mpirun -np ${tdf.mpi_tasks.toString()} ${tdf.binary} -sf gpu -pk gpu ${tdf.gpu_nodes.toString()} -in ${file}`;
            }
            break;
        default:
            return undefined
    }
    const wsf: WorkspaceFolder | undefined = workspace.getWorkspaceFolder(window.activeTextEditor!.document?.uri)
    if (wsf) {
        return new Task(
            tdf,
            wsf,
            tdf.task,
            'lmps',
            execution);
    }
}
