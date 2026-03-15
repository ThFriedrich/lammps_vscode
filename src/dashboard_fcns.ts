import { WebviewPanel, ExtensionContext, Uri, window, OpenDialogOptions, workspace, SaveDialogOptions, tasks, Task, ShellExecution, TaskScope } from 'vscode';
import { join } from 'path'
import { readFileSync, statSync, writeFileSync, promises as fsPromises } from 'fs';
import { get_cpu_info, get_cpu_stat, get_gpu_info, get_gpu_stat } from './os_util_fcns'
import { getMathMarkdown } from './render_fcns'
import { getColor } from './doc_fcns'

export interface PlotPanel extends WebviewPanel {
    log?: string
    last_read?: number
    log_file_size?: number
    dump?: string
    dump_last_read?: number
    dump_file_size?: number
    script_file?: string
    md?: { render: (arg0: string) => any; }
    chatHistory?: Array<{ role: 'user' | 'assistant', content: string }>
    pendingChatInfo?: {
        query: string;
        historyUserMessage: string;
        scriptContext?: string;
    }
}

interface plot_data {
    plot_type?: string,
    x: number[] | string[],
    y: number[] | string[],
    mode?: string,
    visible?: boolean | string,
    name?: string,
    xaxis?: string,
    yaxis?: string,
    line?: {
        color?: string,
        shape?: string,
        width?: number,
        dash?: string
    }
}

interface dump_data {
    x: number[] | string[],
    y: number[] | string[],
    z: number[] | string[],
    mode: string,
    visible: boolean | string,
    name?: string,
    marker: {
        color?: any
        size?: number,
        line?: {
            color?: any,
            width?: number
        },
        opacity?: number
    },
    type: string
}

interface Meta {
    [key: string]: string
}

interface plot_data_ds {
    meta: Meta,
    data: plot_data[][],
    performance?: {
        labels: string[],
        values: number[],
        avg_times: number[],
        total_time?: number
    }[]
}

interface dump_data_ds {
    meta: Meta,
    data: dump_data[]

}

const colors =
    ['#0daba1',  // teal
        '#ff7f0e',  // safety orange
        '#1f77b4',  // muted blue
        '#d62728',  // brick red
        '#9467bd',  // muted purple
        '#8c564b',  // chestnut brown
        '#e377c2',  // raspberry yogurt pink
        '#7f7f7f',  // middle gray
        '#bcbd22',  // curry yellow-green
        '#2ca02c',  // cooked asparagus green
        '#17becf']  // blue-teal


enum file_type {
    log,
    dump,
}

//Regular Expression to find tabulated blocks of numerical data for log data and atomic dump files
const re_log_data: RegExp = RegExp('^\\s*((-?[0-9]*(\\.[0-9]*)?([eE][-]?)?[0-9]+)\\s+)+(-?[0-9]*(\\.[0-9]*)?([eE][-]?)?[0-9]+)?', 'gm')
const re_dump_data: RegExp = RegExp('ITEM: ATOMS[\\s\\S\\n]*?(?=ITEM:|$)', 'g')
const re_dump_bounds: RegExp = RegExp('ITEM: BOX BOUNDS[\\s\\S\\n]*?(?=ITEM:|$)', 'g')
const re_comments: RegExp = RegExp('^\\s*#.*$\\n?', 'gm')

const patterns_config = [
    {
        "name": "lmp_version",
        "value": null,
        "regex": RegExp("^\\s*LAMMPS[\\s]+\\((.+)\\)")
    },
    {
        "name": "dimension",
        "value": null,
        "regex": RegExp("^\\s*dimension[\\s]+(\\d+)")
    },
    {
        "name": "boundaries",
        "value": null,
        "regex": RegExp("^\\s*boundary[\\s]+(.+)")
    },
    {
        "name": "pair_style",
        "value": null,
        "regex": RegExp("^\\s*pair_style[\\s]+(.+)")
    },
    {
        "name": "omp_per_mpi",
        "value": null,
        "regex": RegExp("using (\\d)+ OpenMP thread\\(s\\) per MPI task")
    },
    {
        "name": "min_style",
        "value": null,
        "regex": RegExp("min_style[\\s\\t]+([\\w\\d]+)")
    }
]

export async function manage_plot_panel(context: ExtensionContext, panel: PlotPanel | undefined, actCol: number, md: { render: (arg0: string) => any; }): Promise<PlotPanel | undefined> {

    const img_path_light = Uri.file(join(context.extensionPath, 'imgs', 'logo_sq_l.gif'))
    const img_path_dark = Uri.file(join(context.extensionPath, 'imgs', 'logo_sq_d.gif'))

    // Capture the active file when opening the dashboard
    const activeFile = window.activeTextEditor?.document.fileName;

    if (panel) {
        // If we already have a panel, show it in the target column
        panel.reveal(actCol);
        // Update the script file and md renderer if there's a new active file
        panel.md = md;
        if (activeFile) {
            panel.script_file = activeFile;
            // Send the updated file to the webview
            panel.webview.postMessage({ type: 'active_file', data: activeFile });
        }
    } else {
        // Otherwise, create a new panel
        panel = window.createWebviewPanel(
            'lmpsPlot',
            'Lammps Dashboard', actCol, { retainContextWhenHidden: true, enableScripts: true, localResourceRoots: [Uri.file(context.extensionPath)] }
        );
        panel.iconPath = { light: img_path_light, dark: img_path_dark }
        // Store the script file and md renderer in the panel
        panel.md = md;
        panel.chatHistory = [];
        if (activeFile) {
            panel.script_file = activeFile;
        }
        panel.onDidChangeViewState(
            e => {
                actCol = e.webviewPanel.viewColumn!
            },
            null,
            context.subscriptions
        );
        panel.webview.onDidReceiveMessage(
            (message: any) => {
                if (panel) {
                    switch (message.command) {
                        case 'get_workspace_documents': {
                            // List files currently open in the editor
                            console.log('[Dashboard] Getting workspace documents...');
                            console.log('[Dashboard] Visible editors:', window.visibleTextEditors.length);
                            const openFiles: string[] = window.visibleTextEditors
                                .filter(editor => {
                                    const fileName = editor.document.fileName;
                                    const languageId = editor.document.languageId;

                                    // Skip non-file editors (like output panels)
                                    if (!fileName || fileName.startsWith('extension-output-') || fileName === 'exthost') {
                                        console.log('[Dashboard] Skipping non-file editor:', fileName);
                                        return false;
                                    }

                                    // Include LAMMPS files or allow user to manually select other files
                                    const isLammps = languageId === 'lmps';
                                    console.log('[Dashboard] File:', fileName, 'Language:', languageId, 'Is LAMMPS:', isLammps);
                                    return isLammps;
                                })
                                .map(editor => editor.document.fileName);

                            console.log('[Dashboard] Sending', openFiles.length, 'files to webview');
                            panel.webview.postMessage({
                                type: 'workspace_documents',
                                data: openFiles,
                                currentFile: panel.script_file
                            });
                            break;
                        }
                        // ...existing code for other cases...
                        case 'load_log':
                            panel.log = undefined;
                            set_plot_panel_content(panel, context, file_type.log)
                            break;
                        case 'update_log':
                            get_update(panel, 'log');
                            break;
                        case 'load_dump':
                            panel.dump = undefined;
                            set_plot_panel_content(panel, context, file_type.dump)
                            break;
                        case 'update_dump':
                            get_update(panel, 'dump');
                            break;
                        case 'get_gpu_info':
                            get_gpu_info().then((s: any) => {
                                panel?.webview.postMessage({ type: 'gpu_info', data: s })
                            });
                            break;
                        case 'get_cpu_info':
                            get_cpu_info().then((s: any) => {
                                panel?.webview.postMessage({ type: 'cpu_info', data: s })
                            });
                            break;
                        case 'get_gpu_stat':
                            get_gpu_stat().then((s: any) => {
                                panel?.webview.postMessage({ type: 'gpu_stat', data: s })
                            });
                            break;
                        case 'get_cpu_stat':
                            get_cpu_stat().then((s: any) => {
                                panel?.webview.postMessage({ type: 'cpu_stat', data: s })
                            });
                            break;
                        case 'get_active_file':
                            // Return the stored script file or fallback to current active editor
                            const activeFile = panel.script_file || window.activeTextEditor?.document.fileName || '';
                            panel?.webview.postMessage({ type: 'active_file', data: activeFile });
                            break;
                        case 'get_active_file_content': {
                            // Use filePath from message if provided, otherwise use panel.script_file
                            let fileName = message.filePath || panel?.script_file || '';
                            let content: string | null = null;
                            if (fileName) {
                                // Try to find an open editor for this file
                                const editor = window.visibleTextEditors.find(e => e.document.fileName === fileName);
                                if (editor) {
                                    content = editor.document.getText();
                                } else {
                                    // If not open, try to read from disk
                                    try {
                                        content = readFileSync(fileName, 'utf8');
                                    } catch (e) {
                                        content = null;
                                    }
                                }
                            }
                            if (content !== null && fileName) {
                                panel?.webview.postMessage({
                                    type: 'active_file_content',
                                    data: { content, fileName }
                                });
                            } else {
                                panel?.webview.postMessage({
                                    type: 'active_file_content',
                                    data: null
                                });
                            }
                            break;
                        }
                        case 'run_task':
                            run_lammps_task(message.config).then((result: any) => {
                                panel?.webview.postMessage({ type: 'task_result', data: result });
                            }).catch((error: any) => {
                                panel?.webview.postMessage({ type: 'task_error', data: error.message });
                            });
                            break;
                        case 'save_task_config':
                            save_task_config(message.config).then(() => {
                                panel?.webview.postMessage({ type: 'task_saved', data: 'Task configuration saved successfully' });
                            }).catch((error: any) => {
                                panel?.webview.postMessage({ type: 'task_error', data: error.message });
                            });
                            break;
                        case 'rag_chat':
                            rag_chat(panel, message.query, message.context, panel.md);
                            break;
                        case 'rag_cancel':
                            // Cancel ongoing RAG request
                            import('./extension').then(({ ragProvider }) => {
                                if (ragProvider) {
                                    ragProvider.cancelRequest();
                                }
                            });
                            break;
                        case 'rag_line_check_confirm':
                            // User confirmed line-by-line check
                            rag_line_by_line_check(panel, message.scriptContext, panel.md);
                            break;
                        case 'rag_line_check_decline':
                            // User declined line-by-line check, continue with normal response
                            rag_continue_response(panel, panel.md);
                            break;
                        case 'select_context_file':
                            // Open file dialog for context file selection
                            window.showOpenDialog({
                                canSelectFiles: true,
                                canSelectFolders: false,
                                canSelectMany: false,
                                filters: { 'LAMMPS Files': ['lmp', 'lmps', 'in', 'input', 'data', 'txt'] },
                                title: 'Select Context File'
                            }).then((fileUri: Uri[] | undefined) => {
                                if (fileUri && fileUri[0]) {
                                    const filePath = fileUri[0].fsPath;
                                    workspace.fs.readFile(fileUri[0]).then((content: Uint8Array) => {
                                        const textContent = new TextDecoder().decode(content);
                                        panel?.webview.postMessage({
                                            type: 'context_file_selected',
                                            data: {
                                                fileName: filePath,
                                                content: textContent
                                            }
                                        });
                                    });
                                }
                            });
                            break;
                        case 'get_ollama_models':
                            get_ollama_models(panel);
                            break;
                        case 'set_chat_model':
                            set_chat_model(panel, message.model);
                            break;
                        case 'clear_chat_history':
                            if (panel.chatHistory) {
                                panel.chatHistory = [];
                                panel.webview.postMessage({ type: 'chat_history_cleared' });
                            }
                            break;
                        default:
                            // Handle image save requests (message is a string in this case)
                            if (typeof message === 'string' && message.startsWith('<img src=')) {
                                const img_data = message.match(RegExp('<img src="data:image\\/(\\w+);base64,(.*)"'));
                                if (img_data) {
                                    const buf = Buffer.from(img_data[2], 'base64');
                                    get_save_img_path('Save Image as...').then((img_path: string | undefined) => {
                                        if (img_path) {
                                            if (!img_path.endsWith('.png')) {
                                                img_path += '.png'
                                            }
                                            writeFileSync(img_path, buf);
                                        }
                                    });
                                }
                            }
                            break;
                    }

                }
                return;
            },
            null,
            context.subscriptions
        );
        context.subscriptions.push(panel)
    }
    draw_panel(panel, context)
    return panel
}

function get_update(panel: PlotPanel | undefined, updateType?: 'log' | 'dump') {
    // Use Promise.all to check both files in parallel
    const promises: Promise<void>[] = [];

    if (panel?.log && (!updateType || updateType === 'log')) {
        const logPromise = fsPromises.stat(panel.log).then(stats => {
            const last_write = stats.mtime.getTime();
            const current_size = stats.size;

            // Check if file has shrunk (overwritten/restarted)
            if (panel.log_file_size && current_size < panel.log_file_size) {
                // File was overwritten - reload everything from scratch
                const log_data: plot_data_ds | undefined = get_log_data(panel.log!)
                if (log_data) {
                    panel.webview.postMessage({ type: 'plot_log', data: log_data.data, meta: log_data.meta, performance: log_data.performance });
                    panel.last_read = Date.now();
                    panel.log_file_size = current_size;
                }
            }
            // Check if file has been modified
            else if (!panel.last_read || last_write > panel.last_read) {
                const log_data: plot_data_ds | undefined = get_log_data(panel.log!)
                if (log_data) {
                    panel.webview.postMessage({ type: 'update_log', data: log_data.data, meta: log_data.meta, performance: log_data.performance });
                    panel.last_read = Date.now();
                    panel.log_file_size = current_size;
                }
            }
        }).catch(err => {
            console.error('[LAMMPS Dashboard] Error reading log file:', err);
        });
        promises.push(logPromise);
    }

    if (panel?.dump && (!updateType || updateType === 'dump')) {
        const dumpPromise = fsPromises.stat(panel.dump).then(stats => {
            const last_write = stats.mtime.getTime();
            const current_size = stats.size;

            // Check if file has shrunk (overwritten/restarted)
            if (panel.dump_file_size && current_size < panel.dump_file_size) {
                // File was overwritten - reload everything from scratch
                const dump_data: dump_data_ds | undefined = get_dump_data(panel.dump!, 0)
                if (dump_data) {
                    panel.webview.postMessage({ type: 'plot_dump', data: dump_data.data, meta: dump_data.meta });
                    panel.dump_last_read = Date.now();
                    panel.dump_file_size = current_size;
                }
            }
            // Check if file has been modified and grown (new data appended)
            else if (!panel.dump_last_read || last_write > panel.dump_last_read) {
                const is_initial_load = !panel.dump_file_size;
                const dump_data: dump_data_ds | undefined = get_dump_data(panel.dump!, panel.dump_file_size || 0)

                if (dump_data) {
                    // Send with appropriate message type based on whether this is initial load or update
                    const messageType = is_initial_load ? 'plot_dump' : 'update_dump';
                    panel.webview.postMessage({ type: messageType, data: dump_data.data, meta: dump_data.meta });
                    panel.dump_last_read = Date.now();
                    panel.dump_file_size = current_size;
                }
            }
        }).catch(err => {
            console.error('[LAMMPS Dashboard] Error reading dump file:', err);
        });
        promises.push(dumpPromise);
    }

    return Promise.all(promises);
}
export function draw_panel(panel: PlotPanel, context: ExtensionContext) {
    const node_lib_path: Uri = panel.webview.asWebviewUri(Uri.file(join(context.extensionPath, 'node_modules')))
    const script_lib: Uri = panel.webview.asWebviewUri(Uri.file(join(context.extensionPath, 'node_modules', 'plotly.js-dist-min', 'plotly.min.js')))
    const script: Uri = panel.webview.asWebviewUri(Uri.file(join(context.extensionPath, 'dist', 'dashboard.js')))
    panel.webview.html = build_plot_html(panel, node_lib_path, script_lib, script)

    // Send the initial script file and its content to the webview for RAG context
    if (panel.script_file) {
        panel.webview.postMessage({ type: 'active_file', data: panel.script_file });
        // Also send the file content as default RAG context
        try {
            const content = readFileSync(panel.script_file, 'utf-8');
            panel.webview.postMessage({
                type: 'active_file_content',
                data: { content: content, fileName: panel.script_file }
            });
        } catch (e) {
            // File might not exist or be readable, ignore
        }
    }

    if (panel.log) {
        set_plot_panel_content(panel, context, file_type.log)
    }
    if (panel.dump) {
        set_plot_panel_content(panel, context, file_type.dump)
    }
}

function get_log_data(path: string): plot_data_ds | undefined {
    const log = read_log(path)
    if (log) {
        const plot_ser: plot_data[][] = []
        for (let iy = 0; iy < log.data.length; iy++) {
            const ser: plot_data[] = []
            for (let ix = 1; ix < log.data[iy].data[0].length; ix++) {
                ser.push({
                    plot_type: log.data[iy].type,
                    visible: true,
                    x: log.data[iy].data.map(data => data[0]),
                    y: log.data[iy].data.map(data => data[ix]),
                    name: log.data[iy].header[ix],
                    mode: 'line',
                    line: {
                        width: 2,
                    }
                })
            }
            plot_ser.push(ser)
        }
        return { 'data': plot_ser, 'meta': log.meta, 'performance': log.performance }
    }
}

interface log_block {
    index: number,
    match: string
}

function locate_blocks(log: string) {
    const work_kw = [
        RegExp("\\brun\\b[\\s\\S]*?(\\bDangerous\\sbuilds\\b|$)", 'g'),
        RegExp("\\bminimize\\b[\\s\\S]*?(\\bDangerous\\sbuilds\\b|$)", 'g'),
        RegExp("\\bneb\\b[\\s\\S]*?(\\bDangerous\\sbuilds\\b|$)", 'g')]
    const blocks: log_block[] = []

    work_kw.forEach(kw => {
        let match
        while ((match = kw.exec(log)) != null) {
            blocks.push({ 'index': match.index, 'match': match[0] })
        }
    });
    return blocks
}

function locate_meta(log: string, log_path: string) {
    const meta: Meta = {}
    const log_lines = log.split('\n')
    for (let p = 0; p < patterns_config.length; p++) {
        for (let i = 0; i < log_lines.length; i++) {
            const match = patterns_config[p].regex.exec(log_lines[i])
            if (match) {
                meta[patterns_config[p].name] = match[1]
                break
            }
        }
    }
    meta['path'] = log_path
    return meta
}

function extract_performance(log: string): { labels: string[], values: number[], avg_times: number[], total_time?: number } | undefined {
    // Match both standard and accelerated package performance breakdowns
    const perf_section_regex = RegExp('(MPI task timing breakdown:|Section \\|.*%total)[\\s\\S]*?(?=\\n\\n|Loop time|$)', 'g');
    const perf_match = perf_section_regex.exec(log);

    if (!perf_match) {
        return undefined;
    }

    const perf_text = perf_match[0];
    const lines = perf_text.split('\n');

    const labels: string[] = [];
    const values: number[] = [];
    const avg_times: number[] = [];
    let total_time: number | undefined = undefined;

    // Try to extract Loop time (total wall time)
    const loop_time_match = log.match(/Loop time of ([\d.]+) on/);
    if (loop_time_match) {
        total_time = parseFloat(loop_time_match[1]);
    }

    // Parse each line for section name, avg time, and %total
    for (const line of lines) {
        // Skip header lines and separators
        if (line.includes('Section |') || line.includes('---') || line.includes('timing breakdown')) {
            continue;
        }

        // Match lines with timing data: "Section | min | avg | max | varavg | percentage"
        // Format: Section | min time | avg time | max time | %varavg | %total
        const timing_match = line.match(/^([A-Za-z]+)\s*\|\s*[\d.]+\s*\|\s*([\d.]+)\s*\|.*\|\s*([\d.]+)\s*$/);
        if (timing_match) {
            const section = timing_match[1].trim();
            const avg_time = parseFloat(timing_match[2]);
            const percentage = parseFloat(timing_match[3]);

            if (section && !isNaN(avg_time) && !isNaN(percentage) && percentage > 0) {
                labels.push(section);
                avg_times.push(avg_time);
                values.push(percentage);
            }
        }
    }

    if (labels.length > 0 && values.length > 0) {
        return { labels, values, avg_times, total_time };
    }

    return undefined;
}


function read_log(log_path: string) {
    if (log_path) {
        const log_file = readFileSync(log_path).toString().replace(re_comments, '').replace(/\r\n/g, '\n');  // Read entire Log_file
        const meta = locate_meta(log_file, log_path)
        const blocks = locate_blocks(log_file)
        const log_ds: {
            type: string,                                                              // Initialize Array of Datablocks
            header: string[],
            data: string[][]
        }[] = []
        const performance_data: { labels: string[], values: number[], avg_times: number[], total_time?: number }[] = []

        if (blocks) {
            blocks.sort((a, b) => a.index - b.index)
            blocks.forEach(block => {
                let data_block                                                              // Find Data Blocks
                while ((data_block = re_log_data.exec(block.match)) != null) {
                    const header = data_block.input.slice(data_block.input.slice(0, data_block.index - 1).lastIndexOf('\n'), data_block.index).trim().split(RegExp('\\s+', 'g'))
                    const dat_l = data_block.toString().split(RegExp("\\n+", "g"))
                    const dat_n: string[][] = dat_l.map((value) => value.trim().split(RegExp('\\s+')))
                    if (header.length == dat_n[0].length) {
                        const dl = []
                        for (let nd = 0; nd < dat_n.length; nd++) {
                            if (header.length == dat_n[nd].length) {
                                dl.push(dat_n[nd])
                            }
                        }
                        log_ds.push({ type: block.match.split("\n")[0], header: header, data: dl })
                    }
                }
                // Extract performance data for this block
                const block_performance = extract_performance(block.match)
                if (block_performance) {
                    performance_data.push(block_performance)
                }
            });
        }
        return { 'data': log_ds, 'meta': meta, 'performance': performance_data.length > 0 ? performance_data : undefined }
    }
}

function get_dump_data(path: string, start_byte: number = 0): dump_data_ds | undefined {
    const dmp_ds: dump_data_ds = { 'data': [], 'meta': { 'path': path } }
    const dmp = read_dump(path, start_byte)
    if (dmp) {
        for (let iy = 0; iy < dmp.length; iy++) {
            // Find column indices from header labels
            const idx_type = dmp[iy].header.indexOf('type');

            // Try to find x, y, z coordinates (prefer scaled coordinates if available)
            let idx_x = dmp[iy].header.indexOf('xs');
            let idx_y = dmp[iy].header.indexOf('ys');
            let idx_z = dmp[iy].header.indexOf('zs');
            let is_scaled = (idx_x !== -1 && idx_y !== -1 && idx_z !== -1);

            // Fall back to unwrapped coordinates if scaled not found
            if (idx_x === -1) idx_x = dmp[iy].header.indexOf('x');
            if (idx_y === -1) idx_y = dmp[iy].header.indexOf('y');
            if (idx_z === -1) idx_z = dmp[iy].header.indexOf('z');

            // Try wrapped coordinates as last resort
            if (idx_x === -1) idx_x = dmp[iy].header.indexOf('xu');
            if (idx_y === -1) idx_y = dmp[iy].header.indexOf('yu');
            if (idx_z === -1) idx_z = dmp[iy].header.indexOf('zu');

            // Validate that required columns exist
            if (idx_type === -1 || idx_x === -1 || idx_y === -1 || idx_z === -1) {
                console.error(`Missing required columns in dump file. Header: ${dmp[iy].header.join(', ')}`);
                continue;
            }

            const ty: number[] = dmp[iy].data.map(data => data[idx_type])
            const col: string[] = ty.map(c => colors[c])

            // Only apply box scaling if coordinates are scaled (xs, ys, zs)
            // For unwrapped/wrapped coordinates (x, y, z or xu, yu, zu), don't scale
            const scale_x = is_scaled ? dmp[iy].scale_xyz[0] : 1.0;
            const scale_y = is_scaled ? dmp[iy].scale_xyz[1] : 1.0;
            const scale_z = is_scaled ? dmp[iy].scale_xyz[2] : 1.0;

            dmp_ds.data.push({
                x: dmp[iy].data.map(data => data[idx_x] * scale_x),
                y: dmp[iy].data.map(data => data[idx_y] * scale_y),
                z: dmp[iy].data.map(data => data[idx_z] * scale_z),
                mode: 'markers',
                visible: true,
                marker: {
                    color: col,
                    size: 10,
                    line: {
                        color: 'black',
                        width: 0.25
                    },
                    opacity: 0.8
                },
                type: 'scatter3d'
            })
        }
        return dmp_ds
    }
}

function read_dump(dump_path: string, start_byte: number = 0) {
    if (dump_path) {
        const full_file = readFileSync(dump_path).toString();

        let dump_file: string;
        if (start_byte > 0) {
            // Find the next "ITEM: TIMESTEP" after start_byte to ensure we start at a complete frame
            const file_from_start = full_file.slice(start_byte);
            const timestep_match = file_from_start.match(/ITEM: TIMESTEP/);
            if (timestep_match && timestep_match.index !== undefined) {
                // Start from the beginning of this timestep
                dump_file = file_from_start.slice(timestep_match.index).replace(re_comments, '').replace(/\r\n/g, '\n');
            } else {
                // No new timesteps found
                return [];
            }
        } else {
            // Read from beginning
            dump_file = full_file.replace(re_comments, '').replace(/\r\n/g, '\n');
        }

        let data_block
        let bounds
        const dump_ds: {
            header: string[],
            data: number[][],
            scale_xyz: number[]
        }[] = []
        let scale_xyz
        let idx

        while ((bounds = re_dump_bounds.exec(dump_file)) != null) {
            idx = 0
            scale_xyz = [1.0, 1.0, 1.0]
            for (const line of bounds[0].trim().split(RegExp('\\n+'))) {
                const vals = line.split(RegExp('\\s+'))
                if (vals.length == 2) {
                    scale_xyz[idx] = parseFloat(vals[1]) - parseFloat(vals[0])
                    idx++
                }
            }

            if ((data_block = re_dump_data.exec(dump_file)) != null) {
                const idx_head = data_block[0].indexOf('\n')
                let header = data_block[0].slice(0, idx_head).trim().split(RegExp('\\s+'))
                header = header.filter(e => e !== 'ITEM:' && e !== 'ATOMS')
                const dat_l = data_block[0].slice(idx_head + 1).toString().trim().split(RegExp("\\n+", "g"))
                const dat_n: number[][] = dat_l.map((value) =>
                    value.trim().split(/\s+/).map((substring) => parseFloat(substring))
                );
                if (header.length == dat_n[0].length) {
                    dump_ds.push({ header: header, data: dat_n, scale_xyz: scale_xyz })
                }
            }
        }
        return dump_ds
    }
}

export async function set_plot_panel_content(panel: PlotPanel | undefined, context: ExtensionContext, f_type: file_type) {
    if (panel) {
        switch (f_type) {
            case file_type.log:
                if (panel.log == undefined) {
                    panel.log = await get_log_path('Open Lammps Log File') // Let user select a log file
                }
                if (panel.log) {
                    const log_data: plot_data_ds | undefined = get_log_data(panel.log)
                    if (log_data) {
                        panel.webview.postMessage({ type: 'plot_log', data: log_data.data, meta: log_data.meta, performance: log_data.performance })
                        panel.last_read = Date.now()
                        // Initialize file size tracking
                        const stats = await fsPromises.stat(panel.log);
                        panel.log_file_size = stats.size;
                    }
                }
                break;
            case file_type.dump:
                if (panel.dump == undefined) {
                    panel.dump = await get_log_path('Open Lammps Dump File') // Let user select a dump file
                }
                if (panel.dump) {
                    const dump_data: dump_data_ds | undefined = get_dump_data(panel.dump)
                    if (dump_data) {
                        panel.webview.postMessage({ type: 'plot_dump', data: dump_data.data, meta: dump_data.meta });
                        panel.dump_last_read = Date.now()
                        // Initialize file size tracking
                        const stats = await fsPromises.stat(panel.dump);
                        panel.dump_file_size = stats.size;
                    }
                }
                break;
            default:
                break;
        }
    }
}


async function get_log_path(title: string): Promise<string | undefined> {
    const cwd = workspace.workspaceFolders
    const options: OpenDialogOptions = {
        canSelectMany: false,
        title: title,
        canSelectFolders: false,
        canSelectFiles: true,
        defaultUri: cwd ? cwd[0].uri : undefined,
    };
    let log_path: string | undefined = undefined
    const fileUri = await window.showOpenDialog(options)
    if (fileUri && fileUri[0]) {
        log_path = fileUri[0].fsPath
    }
    return log_path
}

async function get_save_img_path(title: string): Promise<string | undefined> {
    const cwd = workspace.workspaceFolders
    const options: SaveDialogOptions = {
        title: title,
        filters: { 'Images (.png)': ['png'] },
        defaultUri: cwd ? cwd[0].uri : undefined
    };

    let img_path: string | undefined = undefined
    const fileUri = await window.showSaveDialog(options)
    if (fileUri) {
        img_path = fileUri.fsPath
    }
    return img_path
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 64; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

function build_plot_html(panel: PlotPanel, node_lib_path: Uri, plotly_lib: Uri, script: Uri) {
    // Use a nonce to only allow specific scripts to be run
    const nonce = getNonce();

    // Get CSS for current theme
    const css_lmps: Uri[] = [
        Uri.file(join(__dirname, '..', 'css', 'lmps_light.css')),
        Uri.file(join(__dirname, '..', 'css', 'lmps_dark.css')),
        Uri.file(join(__dirname, '..', 'css', 'lmps_dark.css'))
    ];
    const style: Uri = css_lmps[window.activeColorTheme.kind - 1];
    const css = panel.webview.asWebviewUri(style);

    // Get editor font settings
    const config = workspace.getConfiguration('editor');
    const fontSize = config.get<number>('fontSize', 14);
    const fontFamily = config.get<string>('fontFamily', 'Consolas, "Courier New", monospace');

    const html: string =
        `<!DOCTYPE html>
    <html lang="en">

    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">

        <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
        img-src ${panel.webview.cspSource} data: blob:;
        script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval';
        style-src ${panel.webview.cspSource} 'strict-dynamic' 'unsafe-inline';
        "/>

        <link rel="stylesheet" type="text/css" href="${css}">
        <style nonce="${nonce}">
            .spinner {
                border: 3px solid rgba(128, 128, 128, 0.3);
                border-top: 3px solid #0daba1;
                border-radius: 50%;
                width: 20px;
                height: 20px;
                animation: spin 1s linear infinite;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .lammps-code-block {
                background-color: rgba(128,128,128,0.15);
                padding: 10px;
                margin: 8px 0;
                border-radius: 4px;
                border-left: 3px solid #0daba1;
                overflow-x: auto;
                display: inline-block;
                min-width: 100%;
                box-sizing: border-box;
            }
            
            .lammps-code-block pre {
                margin: 0;
                font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                line-height: 1.4;
                white-space: pre;
            }
            
            #chat_messages > div {
                overflow-x: auto;
            }
            
            body {
                font-size: ${fontSize}px;
            }
            code, pre {
                font-family: ${fontFamily};
                font-size: ${fontSize}px;
            }
        </style>

        <script nonce="${nonce}" src="${script}"></script>
        <script nonce="${nonce}" src="${plotly_lib}"></script>   
    </head>

    <body>

        <!-- Tab links -->
        <div class="tab">
          <button class="tablinks" id="sys_tab">System Information</button>
          <button class="tablinks" id="run_tab">Run Task</button>
          <button class="tablinks" id="chat_tab">RAG Chat</button>
          <button class="tablinks" id="dump_tab">Dumps</button>
          <button class="tablinks" id="logs_tab">Logs</button>
        </div>
        
        <!-- Tab content -->
        <div id="sys" class="tabcontent">
          <div id="sys_bars">
          </div>
        </div>

        <div id="chat" class="tabcontent">
          <div id="rag_chat">
            <h2>LAMMPS Documentation Assistant</h2>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding: 8px; background-color: rgba(128,128,128,0.1); border-radius: 4px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <button type="button" id="select_context_file_btn" style="padding: 4px 12px; border-radius: 3px; font-size: 12px; cursor: pointer;" title="Select a LAMMPS file to use as context">📄 Add Context File</button>
                <div id="context_file_info" style="font-size: 12px; opacity: 0.7;"></div>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <button type="button" id="clear_history_btn" style="padding: 4px 12px; border-radius: 3px; font-size: 12px; cursor: pointer;" title="Clear conversation history">🗑️ Clear</button>
                <label style="font-size: 12px; opacity: 0.8;">Model:</label>
                <select id="model_selector" style="padding: 4px 8px; border-radius: 3px; font-size: 12px;">
                  <option value="">Loading...</option>
                </select>
              </div>
            </div>
            <div id="chat_messages" style="overflow-y: auto; border: 1px solid; padding: 10px; margin-bottom: 10px; font-family: monospace;">
              <div style="padding: 10px; margin: 5px 0; background-color: rgba(13, 171, 161, 0.1); border-left: 3px solid #0daba1;">
                <strong>Assistant:</strong> Hi! I'm your LAMMPS documentation assistant. Ask me anything about LAMMPS commands, syntax, or examples.
              </div>
            </div>
            <div style="display: flex; gap: 10px;">
              <input type="text" id="chat_input" placeholder="Ask about LAMMPS commands, syntax, or examples..." style="flex: 1; padding: 10px, 10px, 10px, 10px; font-size: 14px;" />
              <button type="button" id="send_chat_btn" style="padding: 10px 20px; font-size: 14px;">Send</button>
            </div>
            <div style="margin-top: 10px; font-size: 12px; opacity: 0.7;">
              Examples: "How do I use pair_style lj/cut?", "Show me examples of fix nve", "What is the syntax for compute temp?"
            </div>
          </div>
        </div>

        <div id="run" class="tabcontent">
          <div id="run_task">
            <h2>LAMMPS Task Configuration</h2>
            <form id="task_form">
              <table style="width: 100%; max-width: 800px;">
                <tr>
                  <td><label for="task_label" title="Display name for the task in VS Code's task list">Task Label:</label></td>
                  <td><input type="text" id="task_label" value="LAMMPS Run" style="width: 100%;" title="Display name for the task in VS Code's task list"></td>
                </tr>
                <tr>
                  <td><label for="task_script" title="Path to the LAMMPS input script to execute. Defaults to the active editor file.">Script File:</label></td>
                  <td>
                    <input type="text" id="task_script" placeholder="Active editor or specify path" style="width: 100%;" title="Path to the LAMMPS input script to execute. Defaults to the active editor file.">
                  </td>
                </tr>
                <tr>
                  <td><label for="task_binary" title="Path to the LAMMPS executable (e.g., lmp, lmp_mpi, lmp_intel_cpu_intelmpi, /usr/local/bin/lmp)">Binary:</label></td>
                  <td><input type="text" id="task_binary" value="lmp" style="width: 100%;" title="Path to the LAMMPS executable (e.g., lmp, lmp_mpi, lmp_intel_cpu_intelmpi, /usr/local/bin/lmp)"></td>
                </tr>
                <tr>
                  <td><label for="task_mpiexec" title="Path to the MPI launcher executable (e.g., mpiexec, mpirun, srun). Used when MPI Tasks > 0.">MPI Exec Path:</label></td>
                  <td><input type="text" id="task_mpiexec" value="mpiexec" style="width: 100%;" title="Path to the MPI launcher executable (e.g., mpiexec, mpirun, srun). Used when MPI Tasks > 0."></td>
                </tr>
                <tr>
                  <td><label for="task_mpi_tasks" title="Number of MPI processes to use for parallel execution. Set to 0 for single-task (serial) execution.">MPI Tasks:</label></td>
                  <td><input type="number" id="task_mpi_tasks" value="4" min="0" max="9999" style="width: 100px;" title="Number of MPI processes to use for parallel execution. Set to 0 for single-task (serial) execution."></td>
                </tr>
                <tr>
                  <td><label for="task_gpu_nodes" title="Number of GPU nodes to use with -sf gpu -pk gpu flags. Set to 0 to disable GPU acceleration.">GPU Nodes:</label></td>
                  <td><input type="number" id="task_gpu_nodes" value="0" min="0" max="99" style="width: 100px;" title="Number of GPU nodes to use with -sf gpu -pk gpu flags. Set to 0 to disable GPU acceleration."></td>
                </tr>
                <tr>
                  <td><label for="task_omp_threads" title="Number of OpenMP threads per MPI task. Set to 0 to use system default. Sets OMP_NUM_THREADS environment variable.">OMP Threads:</label></td>
                  <td><input type="number" id="task_omp_threads" value="0" min="0" max="999" style="width: 100px;" title="Number of OpenMP threads per MPI task. Set to 0 to use system default. Sets OMP_NUM_THREADS environment variable."></td>
                </tr>
                <tr>
                  <td><label for="task_args" title="Additional command-line arguments to pass to LAMMPS (e.g., -log none, -screen none, -var temp 300, -skiprun)">Additional Args:</label></td>
                  <td><input type="text" id="task_args" placeholder="-log none" style="width: 100%;" title="Additional command-line arguments to pass to LAMMPS (e.g., -log none, -screen none, -var temp 300, -skiprun)"></td>
                </tr>
                <tr>
                  <td><label for="task_group" title="Task group classification in VS Code. Build tasks can be run with Ctrl+Shift+B.">Task Group:</label></td>
                  <td>
                    <select id="task_group" style="width: 150px;" title="Task group classification in VS Code. Build tasks can be run with Ctrl+Shift+B.">
                      <option value="build" selected>Build</option>
                      <option value="test">Test</option>
                      <option value="none">None</option>
                    </select>
                  </td>
                </tr>
                <tr>
                  <td><label for="task_default" title="Mark this as the default task for its group. Default tasks can be executed with keyboard shortcuts (e.g., Ctrl+Shift+B for build group).">Default Task:</label></td>
                  <td><input type="checkbox" id="task_default" checked title="Mark this as the default task for its group. Default tasks can be executed with keyboard shortcuts (e.g., Ctrl+Shift+B for build group)."></td>
                </tr>
              </table>
              <br>
              <button type="button" id="run_task_btn" style="padding: 10px 20px; font-size: 16px;" title="Execute the LAMMPS task immediately with the current configuration">▶ Run Task</button>
              <button type="button" id="save_task_btn" style="padding: 10px 20px; font-size: 16px; margin-left: 10px;" title="Save this configuration to .vscode/tasks.json for reuse">💾 Save Task Config</button>
            </form>
            <div id="task_output" style="margin-top: 20px; padding: 10px; border: 1px solid; max-height: 300px; overflow-y: auto; font-family: monospace; white-space: pre-wrap;"></div>
          </div>
        </div>
        
        <div id="dump" class="tabcontent">
          <div>
            <button type="button" id="load_dump_btn">📂 Open Lammps Dump File</button>
            <label style="margin-left: 20px;">
              <input type="checkbox" id="live_update_toggle" checked>
              Live Updates
            </label>
            <div id="dump_path_div"></div><br>
            <div id="dump_div" class="dump_div" align="center">
            <!-- Plotly chart will be drawn inside this DIV -->
            </div>
          </div>
        </div>
        
        <div id="logs" class="tabcontent">
            <button type="button" id="load_log_btn">📂 Open Lammps Log File</button>
            <label style="margin-left: 20px;">
              <input type="checkbox" id="live_update_toggle_logs" checked>
              Live Updates
            </label>
            <div id="plot_div" class="log_div">
            <!-- Plotly chart will be drawn inside this DIV -->
            </div>
        </div>
    </body>   
    </html>`;
    return html
}

async function run_lammps_task(config: any): Promise<any> {
    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No workspace folder open');
    }

    const workspaceFolder = workspaceFolders[0];

    // Build the command based on the configuration
    let command = '';
    const binary = config.binary || 'lmp';
    const script = config.script || window.activeTextEditor?.document.fileName || '';

    if (!script) {
        throw new Error('No script file specified and no active editor');
    }

    // Build command based on MPI and GPU settings
    const mpi_tasks = parseInt(config.mpi_tasks) || 0;
    const gpu_nodes = parseInt(config.gpu_nodes) || 0;
    const omp_threads = parseInt(config.omp_threads) || 0;
    const args = config.args || '';

    if (mpi_tasks > 0) {
        const mpiexec = config.mpiexec_path || 'mpiexec';
        command = `${mpiexec} -np ${mpi_tasks}`;
        if (omp_threads > 0) {
            command += ` -x OMP_NUM_THREADS=${omp_threads}`;
        }
        command += ` ${binary}`;
    } else {
        if (omp_threads > 0) {
            command = `OMP_NUM_THREADS=${omp_threads} ${binary}`;
        } else {
            command = binary;
        }
    }

    if (gpu_nodes > 0) {
        command += ` -sf gpu -pk gpu ${gpu_nodes}`;
    }

    command += ` -in ${script}`;

    if (args) {
        command += ` ${args}`;
    }

    // Create and execute the task
    const taskDefinition = {
        type: 'lmps',
        label: config.label || 'LAMMPS Run',
    };

    const execution = new ShellExecution(command);
    const task = new Task(
        taskDefinition,
        workspaceFolder,
        config.label || 'LAMMPS Run',
        'lmps',
        execution,
        []
    );

    // Execute the task
    await tasks.executeTask(task);

    return {
        success: true,
        command: command,
        message: 'Task started successfully'
    };
}

async function save_task_config(config: any): Promise<void> {
    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No workspace folder open');
    }

    const workspaceFolder = workspaceFolders[0];
    const tasksJsonPath = join(workspaceFolder.uri.fsPath, '.vscode', 'tasks.json');

    // Build the task configuration object
    const taskConfig = {
        type: 'lmps',
        label: config.label || 'LAMMPS Custom Task',
        binary: config.binary || 'lmp',
        mpiexec_path: config.mpiexec_path || 'mpiexec',
        mpi_tasks: parseInt(config.mpi_tasks) || 0,
        gpu_nodes: parseInt(config.gpu_nodes) || 0,
        omp_threads: parseInt(config.omp_threads) || 0,
        args: config.args || '',
        problemMatcher: [],
        group: {
            kind: config.group || 'build',
            isDefault: config.isDefault !== false
        }
    };

    // Read existing tasks.json or create new structure
    let tasksJson: any;
    try {
        const tasksContent = readFileSync(tasksJsonPath, 'utf8');
        tasksJson = JSON.parse(tasksContent);
    } catch (e) {
        // File doesn't exist or is invalid, create new structure
        tasksJson = {
            version: '2.0.0',
            tasks: []
        };
    }

    // Add or update the task
    if (!tasksJson.tasks) {
        tasksJson.tasks = [];
    }

    // Check if task with same label exists
    const existingTaskIndex = tasksJson.tasks.findIndex((t: any) => t.label === taskConfig.label);
    if (existingTaskIndex >= 0) {
        tasksJson.tasks[existingTaskIndex] = taskConfig;
    } else {
        tasksJson.tasks.push(taskConfig);
    }

    // Ensure .vscode directory exists
    const vscodePath = join(workspaceFolder.uri.fsPath, '.vscode');
    try {
        await fsPromises.mkdir(vscodePath, { recursive: true });
    } catch (e) {
        // Directory already exists
    }

    // Write the file
    writeFileSync(tasksJsonPath, JSON.stringify(tasksJson, null, 2));
}

async function rag_chat(panel: PlotPanel, query: string, context?: string, md?: { render: (arg0: string) => any; }): Promise<void> {
    try {
        // Import ragProvider from extension
        const { ragProvider } = await import('./extension');
        
        // Initialize RAG if not already done
        await ragProvider.initialize();
        
        // Build ChatInput with separate question and context
        const chatInput = {
            userQuestion: query,
            scriptContext: context?.trim() || undefined,
            scriptName: panel.script_file || undefined
        };
        
        // Initialize chat history if not exists
        if (!panel.chatHistory) {
            panel.chatHistory = [];
        }
        
        // Store info for potential history update and line check
        const scriptContextForLineCheck = context?.trim() || undefined;
        const historyUserMessage = context?.trim() 
            ? `[Script: ${panel.script_file || 'active'}] ${query}`
            : query;
        
        // Store pending chat info on panel for later use
        panel.pendingChatInfo = {
            query,
            historyUserMessage,
            scriptContext: scriptContextForLineCheck
        };
        
        // Stream response from RAG
        let rawResponse = '';
        let lineCheckOffered = false;
        let streamStarted = false;
        
        const finalResponse = await ragProvider.chatStream(
            chatInput,
            (chunk: string) => {
                // Send stream start on first chunk (only if we're actually streaming)
                if (!streamStarted) {
                    streamStarted = true;
                    panel.webview.postMessage({ type: 'rag_stream_start' });
                }
                rawResponse += chunk;
                // Send raw chunk to webview for immediate display
                panel.webview.postMessage({
                    type: 'rag_stream_chunk',
                    data: { chunk: chunk }
                });
            },
            panel.chatHistory,
            // Thinking callback - send thinking output to webview
            (thinking: string) => {
                panel.webview.postMessage({
                    type: 'rag_thinking_output',
                    data: { thinking: thinking }
                });
                // Send thinking done message to trigger auto-collapse timer
                panel.webview.postMessage({
                    type: 'rag_thinking_done'
                });
            },
            // Line-by-line check offer callback
            (offer: boolean) => {
                if (offer && scriptContextForLineCheck) {
                    lineCheckOffered = true;
                    panel.webview.postMessage({
                        type: 'rag_offer_line_check',
                        data: { 
                            message: 'Would you like me to check each command line individually against its syntax definition?',
                            scriptContext: scriptContextForLineCheck
                        }
                    });
                }
            }
        );
        
        // If line check was offered, chatStream returned early - don't finalize response
        // User will either confirm (rag_line_check_confirm) or decline (rag_line_check_decline)
        if (lineCheckOffered) {
            // Response generation is paused - waiting for user decision
            console.log('Line-by-line check offered, waiting for user decision...');
            return;
        }
        
        // Normal flow - update history and finalize response
        panel.chatHistory.push(
            { role: 'user', content: historyUserMessage },
            { role: 'assistant', content: finalResponse }
        );
        
        // Render final markdown to HTML
        let renderedResponse = finalResponse;
        if (md) {
            // Code block sanitization is already done in rag_system.ts
            const color: string = getColor();
            renderedResponse = await getMathMarkdown(renderedResponse, color, false);
            renderedResponse = md.render(renderedResponse);
        }
        
        // Send final rendered response to replace streaming content
        panel.webview.postMessage({
            type: 'rag_stream_end',
            data: {
                query: query,
                response: renderedResponse
            }
        });
        
        // Clear pending info
        panel.pendingChatInfo = undefined;
    } catch (error: any) {
        panel.webview.postMessage({
            type: 'rag_error',
            data: error.message || 'Failed to get response from RAG system'
        });
    }
}

/**
 * Continue with normal LLM response when user declines line-by-line check
 */
async function rag_continue_response(panel: PlotPanel, md?: { render: (arg0: string) => any; }): Promise<void> {
    try {
        const { ragProvider } = await import('./extension');
        
        if (!ragProvider.hasPendingResponse()) {
            console.warn('No pending response to continue');
            return;
        }
        
        const pendingInfo = panel.pendingChatInfo;
        if (!pendingInfo) {
            console.warn('No pending chat info');
            ragProvider.clearPendingResponse();
            return;
        }
        
        // Stream the continued response
        let rawResponse = '';
        let streamStarted = false;
        const finalResponse = await ragProvider.continueWithResponse(
            (chunk: string) => {
                // Send stream start on first chunk
                if (!streamStarted) {
                    streamStarted = true;
                    panel.webview.postMessage({ type: 'rag_stream_start' });
                }
                rawResponse += chunk;
                panel.webview.postMessage({
                    type: 'rag_stream_chunk',
                    data: { chunk: chunk }
                });
            }
        );
        
        // Update chat history
        if (!panel.chatHistory) {
            panel.chatHistory = [];
        }
        panel.chatHistory.push(
            { role: 'user', content: pendingInfo.historyUserMessage },
            { role: 'assistant', content: finalResponse }
        );
        
        // Render final markdown to HTML
        let renderedResponse = finalResponse;
        if (md) {
            const color: string = getColor();
            renderedResponse = await getMathMarkdown(renderedResponse, color, false);
            renderedResponse = md.render(renderedResponse);
        }
        
        // Send final rendered response
        panel.webview.postMessage({
            type: 'rag_stream_end',
            data: {
                query: pendingInfo.query,
                response: renderedResponse
            }
        });
        
        // Clear pending info
        panel.pendingChatInfo = undefined;
    } catch (error: any) {
        panel.webview.postMessage({
            type: 'rag_error',
            data: error.message || 'Failed to continue response'
        });
    }
}

/**
 * Run line-by-line syntax check on a LAMMPS script
 * Sends progress and results to webview incrementally
 */
async function rag_line_by_line_check(panel: PlotPanel, scriptContext: string, md?: { render: (arg0: string) => any; }): Promise<void> {
    try {
        const { ragProvider } = await import('./extension');
        await ragProvider.initialize();

        // Clear any pending response context since user chose line-by-line check
        ragProvider.clearPendingResponse();

        // Send start message
        panel.webview.postMessage({
            type: 'rag_line_check_start',
            data: { message: 'Starting line-by-line syntax check...' }
        });

        const results = await ragProvider.checkScriptLineByLine(
            scriptContext,
            // onLineResult - send each result as it completes
            (result) => {
                panel.webview.postMessage({
                    type: 'rag_line_check_result',
                    data: result
                });
            },
            // onProgress - send progress updates
            (current, total) => {
                panel.webview.postMessage({
                    type: 'rag_line_check_progress',
                    data: { current, total }
                });
            }
        );

        // Send completion with summary statistics
        const summaryStats = {
            total: results.length,
            ok: results.filter(r => r.status === 'ok').length,
            warning: results.filter(r => r.status === 'warning').length,
            error: results.filter(r => r.status === 'error').length,
            unknown: results.filter(r => r.status === 'unknown').length
        };

        panel.webview.postMessage({
            type: 'rag_line_check_complete',
            data: { summary: summaryStats, results }
        });

        // Now generate LLM summary that ties everything together
        panel.webview.postMessage({
            type: 'rag_line_check_summary_start',
            data: { message: 'Generating analysis summary...' }
        });

        let rawSummary = '';
        const finalSummary = await ragProvider.generateLineCheckSummary(
            results,
            scriptContext,
            (chunk: string) => {
                rawSummary += chunk;
                panel.webview.postMessage({
                    type: 'rag_line_check_summary_chunk',
                    data: { chunk }
                });
            }
        );

        // Render final markdown summary
        let renderedSummary = finalSummary;
        if (md) {
            const color: string = getColor();
            renderedSummary = await getMathMarkdown(renderedSummary, color, false);
            renderedSummary = md.render(renderedSummary);
        }

        panel.webview.postMessage({
            type: 'rag_line_check_summary_end',
            data: { summary: renderedSummary }
        });

        // Update chat history with the line check results
        const pendingInfo = panel.pendingChatInfo;
        if (pendingInfo) {
            if (!panel.chatHistory) {
                panel.chatHistory = [];
            }
            panel.chatHistory.push(
                { role: 'user', content: pendingInfo.historyUserMessage },
                { role: 'assistant', content: finalSummary }
            );
            panel.pendingChatInfo = undefined;
        }

    } catch (error: any) {
        panel.webview.postMessage({
            type: 'rag_line_check_error',
            data: error.message || 'Line-by-line check failed'
        });
    }
}

async function get_ollama_models(panel: PlotPanel): Promise<void> {
    try {
        const config = workspace.getConfiguration('lammps-vscode.rag');
        const ollamaBase = config.get<string>('ollamaBase', 'http://127.0.0.1:11434');
        const currentModel = config.get<string>('chatModel', 'mistral:7b');

        const response = await fetch(`${ollamaBase}/api/tags`);
        if (!response.ok) {
            throw new Error(`Failed to fetch models: ${response.statusText}`);
        }

        const data: any = await response.json();
        const models = data.models?.map((m: any) => m.name) || [];

        panel.webview.postMessage({
            type: 'ollama_models',
            data: {
                models: models,
                currentModel: currentModel
            }
        });
    } catch (error: any) {
        panel.webview.postMessage({
            type: 'ollama_models_error',
            data: error.message || 'Failed to fetch Ollama models'
        });
    }
}

async function set_chat_model(panel: PlotPanel, model: string): Promise<void> {
    try {
        const config = workspace.getConfiguration('lammps-vscode.rag');
        await config.update('chatModel', model, true);
        // Update the backend model immediately
        const { ragProvider } = await import('./extension');
        ragProvider.updateChatModel(model);
        panel.webview.postMessage({
            type: 'model_updated',
            data: model
        });
    } catch (error: any) {
        panel.webview.postMessage({
            type: 'model_update_error',
            data: error.message || 'Failed to update model'
        });
    }
}