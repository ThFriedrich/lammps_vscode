const vscode = acquireVsCodeApi();

window.onload = function () {

    var load_log_btn = document.getElementById('load_log_btn')
    var load_dump_btn = document.getElementById('load_dump_btn')
    var live_update_toggle = document.getElementById('live_update_toggle')
    var live_update_toggle_logs = document.getElementById('live_update_toggle_logs')
    var run_task_btn = document.getElementById('run_task_btn')
    var save_task_btn = document.getElementById('save_task_btn')
    var b_logs_plotted = false
    var b_dump_plotted = false
    var n_plots = 0
    var resizeTimeout = null;
    var firstDone = false;


    document.getElementById("sys_tab").addEventListener('click', function (event) { openTab(event, 'sys') })
    document.getElementById("run_tab").addEventListener('click', function (event) { openTab(event, 'run') })
    document.getElementById("dump_tab").addEventListener('click', function (event) { openTab(event, 'dump') })
    document.getElementById("logs_tab").addEventListener('click', function (event) { openTab(event, 'logs') })
    document.getElementById("sys_tab").click();

    function resize_plots_sub() {
        if (b_logs_plotted) {
            Array.from(document.getElementsByClassName('panel')).forEach(plot_div => {
                if (plot_div.offsetHeight > 0) {
                    var div_sz = plot_div.getBoundingClientRect()
                    var update = {
                        width: div_sz.width,
                        height: div_sz.height
                    };
                    Plotly.relayout(plot_div, update);
                }
            });
        }
        if (b_dump_plotted) {
            var dump_div = document.getElementById("dump_div");
            if (dump_div.offsetHeight > 0) {
                var div_sz = dump_div.getBoundingClientRect()
                var update = {
                    width: div_sz.width,
                    height: document.documentElement.clientHeight - div_sz.top - 25
                };
                Plotly.relayout(dump_div, update);
            }
        }
        if (!firstDone) {
            window.addEventListener("resize", resize_plots_throttled)
            firstDone = true;
        }
    }

    function resize_plots_throttled() {
        if (resizeTimeout) {
            clearTimeout(resizeTimeout);
        }
        resizeTimeout = setTimeout(resize_plots_sub, 100);
    }

    function resize_plots(e) {
        var fired = 0;
        var lastResize = Date.now();
        window.addEventListener('mousemove', mousemove);
        window.addEventListener('mouseup', mouseup);

        function mousemove(e) {
            fired++;
            var now = Date.now();
            // Throttle to max once per 50ms
            if (now - lastResize > 50) {
                resize_plots_sub();
                lastResize = now;
            }
        }

        function mouseup() {
            window.removeEventListener('mousemove', mousemove);
            window.removeEventListener('mouseup', mouseup);
            resize_plots_sub()
        }
    }

    function redraw_log_panel(ev_data, ev_meta, ev_performance) {
        var plot_div = document.getElementById('plot_div')
        while (plot_div.firstChild) {
            plot_div.removeChild(plot_div.firstChild);
        }
        n_plots = ev_data.length
        n_meta = Object.keys(ev_meta).length
        var table = document.createElement('table');
        table.setAttribute('style', 'margin:5px; width:100%; table-layout:fixed;');
        var thead = document.createElement('thead');
        var tbody = document.createElement('tbody');
        var row1 = document.createElement('tr');
        var row2 = document.createElement('tr');

        table.appendChild(thead);
        table.appendChild(tbody);
        plot_div.appendChild(table);

        for (let i = 0; i < n_meta; i++) {

            var th = document.createElement('th');
            var td = document.createElement('td');
            td.setAttribute('style', 'padding: 2px; overflow: auto;');
            th.innerHTML = Object.keys(ev_meta)[i];
            td.innerHTML = Object.values(ev_meta)[i];
            row1.appendChild(th);
            row2.appendChild(td);
        }
        thead.appendChild(row1);
        thead.appendChild(row2);

        // Section 1: Timeseries Plots
        if (n_plots > 0) {
            var section1_header = document.createElement('h3');
            section1_header.textContent = 'Timeseries Data';
            section1_header.style.marginTop = '15px';
            section1_header.style.marginBottom = '5px';
            section1_header.style.paddingLeft = '5px';
            section1_header.style.borderBottom = '2px solid ' + hl_col;
            plot_div.appendChild(section1_header);
        }

        for (i = 0; i < n_plots; i++) {
            var plot_div_button = document.createElement('button');
            plot_div_button.textContent = "Plot " + (1 + i).toString() + '  ( ' + ev_data[i][0].plot_type + ' )'
            plot_div_button.className = "accordion"
            plot_div_button.addEventListener("click", function () {
                /* Toggle between adding and removing the "active" class,
                to highlight the button that controls the panel */
                this.classList.toggle("active");

                /* Toggle between hiding and showing the active panel */
                var panel = this.nextElementSibling;
                if (panel.style.display === "block") {
                    panel.style.display = "none";
                } else {
                    panel.style.display = "block";
                    resize_plots()
                }
            });
            plot_div.appendChild(plot_div_button);

            var plot_div_child = document.createElement('div');
            plot_div_child.className = "panel"
            plot_div_child.style.resize = "vertical"
            plot_div_child.id = "plot_div_" + i.toString()
            plot_div_child.style.display = "none"
            // Attach resize handler only once per plot
            if (!plot_div.dataset.resizeAttached) {
                plot_div.addEventListener("mousedown", resize_plots);
                plot_div.dataset.resizeAttached = 'true';
            }
            plot_div.appendChild(plot_div_child);
            plot_log(plot_div_child.id, ev_data[i])
        }

        // Section 2: Performance Breakdowns (if available)
        if (ev_performance && ev_performance.length > 0) {
            var section2_header = document.createElement('h3');
            section2_header.id = 'perf_section_header';
            section2_header.textContent = 'Performance Breakdowns';
            section2_header.style.marginTop = '20px';
            section2_header.style.marginBottom = '5px';
            section2_header.style.paddingLeft = '5px';
            section2_header.style.borderBottom = '2px solid ' + hl_col;
            plot_div.appendChild(section2_header);

            for (let i = 0; i < ev_performance.length; i++) {
                if (ev_performance[i] && ev_performance[i].labels && ev_performance[i].values) {
                    var perf_div_button = document.createElement('button');
                    perf_div_button.textContent = "Performance Breakdown " + (1 + i).toString()
                    if (ev_data[i] && ev_data[i][0]) {
                        perf_div_button.textContent += '  ( ' + ev_data[i][0].plot_type + ' )'
                    }
                    perf_div_button.className = "accordion"
                    perf_div_button.addEventListener("click", function () {
                        this.classList.toggle("active");
                        var panel = this.nextElementSibling;
                        if (panel.style.display === "block") {
                            panel.style.display = "none";
                        } else {
                            panel.style.display = "block";
                            resize_plots()
                        }
                    });
                    plot_div.appendChild(perf_div_button);

                    var perf_div_child = document.createElement('div');
                    perf_div_child.className = "panel"
                    perf_div_child.id = "perf_panel_" + i.toString()
                    perf_div_child.style.display = "none"
                    
                    // Create chart container inside panel
                    var chart_container = document.createElement('div');
                    chart_container.id = "perf_pie_chart_" + i.toString()
                    chart_container.style.height = "400px"
                    perf_div_child.appendChild(chart_container);
                    
                    plot_div.appendChild(perf_div_child);
                    plot_performance_pie(chart_container.id, ev_performance[i], perf_div_child.id)
                }
            }
        }
        
        b_logs_plotted = true
    }

    var interval_set_log = false
    var interval_set_dump = false
    var log_interval = 1000
    var sys_interval = 250

    window.addEventListener('message', event => {
        var ev_data = event.data.data
        var ev_meta = event.data.meta
        var ev_performance = event.data.performance
        var ev_type = event.data.type

        if (ev_data) {
            switch (ev_type) {
                case 'plot_log':
                    redraw_log_panel(ev_data, ev_meta, ev_performance)
                    if (!interval_set_log) {
                        setInterval(() => {
                            if (live_update_toggle_logs.checked) {
                                vscode.postMessage({
                                    command: 'update_log'
                                });
                            }
                        }, log_interval);
                        interval_set_log = true
                    }
                    break;
                case 'update_log':
                    var n_plots_update = ev_data?.length
                    if (n_plots_update && n_plots_update > n_plots) {
                        // New plots appeared — rebuild full panel
                        redraw_log_panel(ev_data, ev_meta, ev_performance)
                    } else {
                        // Update existing timeseries plots
                        for (i = 0; i < n_plots; i++) {
                            var div_id = "plot_div_" + i.toString()
                            update_log(div_id, ev_data[i])
                        }

                        // Ensure performance section exists and update/create per-step charts
                        if (ev_performance && ev_performance.length > 0) {
                            const plotDiv = document.getElementById('plot_div');

                            // Create section header if missing
                            if (!document.getElementById('perf_section_header')) {
                                var section2_header = document.createElement('h3');
                                section2_header.id = 'perf_section_header';
                                section2_header.textContent = 'Performance Breakdowns';
                                section2_header.style.marginTop = '20px';
                                section2_header.style.marginBottom = '5px';
                                section2_header.style.paddingLeft = '5px';
                                section2_header.style.borderBottom = '2px solid ' + hl_col;
                                plotDiv.appendChild(section2_header);
                            }

                            for (let i = 0; i < ev_performance.length; i++) {
                                if (ev_performance[i] && ev_performance[i].labels && ev_performance[i].values) {
                                    const panelId = 'perf_panel_' + i.toString();
                                    const chartId = 'perf_pie_chart_' + i.toString();
                                    // If the perf container doesn't exist yet, create the accordion and panel
                                    if (!document.getElementById(panelId)) {
                                        var perf_div_button = document.createElement('button');
                                        perf_div_button.id = 'perf_button_' + i.toString();
                                        perf_div_button.textContent = "Performance Breakdown " + (1 + i).toString();
                                        if (ev_data[i] && ev_data[i][0]) {
                                            perf_div_button.textContent += '  ( ' + ev_data[i][0].plot_type + ' )'
                                        }
                                        perf_div_button.className = "accordion"
                                        perf_div_button.addEventListener("click", function () {
                                            this.classList.toggle("active");
                                            var panel = this.nextElementSibling;
                                            if (panel.style.display === "block") {
                                                panel.style.display = "none";
                                            } else {
                                                panel.style.display = "block";
                                                resize_plots()
                                            }
                                        });
                                        plotDiv.appendChild(perf_div_button);

                                        var perf_div_child = document.createElement('div');
                                        perf_div_child.className = "panel"
                                        perf_div_child.id = panelId
                                        perf_div_child.style.display = "none"
                                        perf_div_child.style.height = "400px"
                                        
                                        var chart_container = document.createElement('div');
                                        chart_container.id = chartId
                                        perf_div_child.appendChild(chart_container);
                                        
                                        plotDiv.appendChild(perf_div_child);
                                    }

                                    // Render/refresh the pie chart
                                    plot_performance_pie(chartId, ev_performance[i], panelId)
                                }
                            }
                        }
                    }

                    break;
                case 'plot_dump':
                    dump_path_div.textContent = ev_meta.path;
                    plot_dump("dump_div", ev_data)
                    b_dump_plotted = true
                    if (!interval_set_dump) {
                        setInterval(() => {
                            if (live_update_toggle.checked) {
                                vscode.postMessage({
                                    command: 'update_dump'
                                });
                            }
                        }, log_interval);
                        interval_set_dump = true
                    }
                    break;
                case 'update_dump':
                    // Append new frames to existing dump plot
                    if (b_dump_plotted && ev_data && ev_data.length > 0) {
                        update_dump("dump_div", ev_data);
                    }
                    break;
                case 'cpu_stat':
                    document.getElementById('cpu_mem').value = ev_data['memory'];
                    for (let x = 0; x < ev_data['cpu'].length; x++) {
                        document.getElementById("cpu_util" + x).value = ev_data['cpu'][x]['cpu']
                    }
                    break;
                case 'gpu_stat':
                    for (let n = 0; n < ev_data['gpu_util'].length; n++) {
                        document.getElementById('gpu_mem' + n).value = ev_data['gpu_mem'][n];
                        document.getElementById('gpu_util' + n).value = ev_data['gpu_util'][n];
                    }

                    break;
                case 'gpu_info':
                    var sys_bars = document.getElementById('sys_bars');

                    for (let n = 0; n < ev_data['gpu'].length; n++) {
                        var header = document.createElement('h4')
                        header.appendChild(document.createTextNode(ev_data['gpu'][n]))
                        header.style.marginBottom = '6px';
                        sys_bars.appendChild(header)

                        var cuda_etc = document.createElement('p')
                        cuda_etc.appendChild(document.createTextNode(
                            'Driver: ' + ev_data['driver'] + Array(6).fill('\xa0').join('') + 'CUDA: ' + ev_data['cuda']))
                        cuda_etc.style.marginTop = 0;
                        sys_bars.appendChild(cuda_etc)

                        var tbl = document.createElement("table");
                        var tblBody = document.createElement("tbody");

                        var util_row = gen_info_row("gpu_util" + n, "GPU load:")
                        tblBody.appendChild(util_row)
                        var mem_row = gen_info_row("gpu_mem" + n, "Memory usage:")
                        tblBody.appendChild(mem_row)

                        tbl.appendChild(tblBody);
                        sys_bars.appendChild(tbl)

                    }
                    setInterval(() => {
                        vscode.postMessage({
                            command: 'get_gpu_stat'
                        });
                    }, sys_interval);

                    break;
                case 'cpu_info':
                    var sys_bars = document.getElementById('sys_bars');
                    var header = document.createElement('h4')
                    header.appendChild(document.createTextNode(ev_data['mod_cpu']))
                    sys_bars.appendChild(header)
                    var tbl = document.createElement("table");
                    var tblBody = document.createElement("tbody");

                    for (let x = 0; x < ev_data['n_cpu']; x++) {
                        var util_row = gen_info_row("cpu_util" + x, "CPU" + x + " load:")
                        tblBody.appendChild(util_row)
                    }

                    tbl.appendChild(tblBody)
                    sys_bars.appendChild(tbl)

                    var headerM = document.createElement('h4')
                    headerM.appendChild(document.createTextNode('Memory ' + ev_data['tot_mem'].toFixed(2) + 'GB'))
                    sys_bars.appendChild(headerM)

                    var tblM = document.createElement("table");
                    var tblBodyM = document.createElement("tbody");

                    var mem_row = gen_info_row("cpu_mem", "Memory usage:")
                    tblBodyM.appendChild(mem_row)
                    tblM.appendChild(tblBodyM);

                    sys_bars.appendChild(tblM)


                    setInterval(() => {
                        vscode.postMessage({
                            command: 'get_cpu_stat'
                        });
                    }, sys_interval);

                    break;
                case 'active_file':
                    // Set the script file input to the active file
                    var scriptInput = document.getElementById('task_script');
                    if (scriptInput && ev_data) {
                        scriptInput.value = ev_data;
                    }
                    break;
                case 'task_result':
                    // Display task execution result
                    var output = document.getElementById('task_output');
                    if (output) {
                        output.textContent = 'Task executed successfully!\n\nCommand: ' + ev_data.command + '\n\n' + ev_data.message;
                        output.style.borderColor = 'green';
                    }
                    break;
                case 'task_error':
                    // Display task execution error
                    var output = document.getElementById('task_output');
                    if (output) {
                        output.textContent = 'Error: ' + ev_data;
                        output.style.borderColor = 'red';
                    }
                    break;
                case 'task_saved':
                    // Display save confirmation
                    var output = document.getElementById('task_output');
                    if (output) {
                        output.textContent = ev_data;
                        output.style.borderColor = 'green';
                    }
                    break;
                default:
                    break;
            }
        }
    });

    vscode.postMessage({
        command: 'get_cpu_info'
    });
    vscode.postMessage({
        command: 'get_gpu_info'
    });

    load_log_btn.addEventListener('click', () => {
        vscode.postMessage({
            command: 'load_log'
        });
    })

    load_dump_btn.addEventListener('click', () => {
        vscode.postMessage({
            command: 'load_dump'
        });
    })

    run_task_btn.addEventListener('click', () => {
        var config = {
            label: document.getElementById('task_label').value,
            script: document.getElementById('task_script').value,
            binary: document.getElementById('task_binary').value,
            mpiexec_path: document.getElementById('task_mpiexec').value,
            mpi_tasks: document.getElementById('task_mpi_tasks').value,
            gpu_nodes: document.getElementById('task_gpu_nodes').value,
            omp_threads: document.getElementById('task_omp_threads').value,
            args: document.getElementById('task_args').value,
            group: document.getElementById('task_group').value,
            isDefault: document.getElementById('task_default').checked
        };
        
        vscode.postMessage({
            command: 'run_task',
            config: config
        });
    })

    save_task_btn.addEventListener('click', () => {
        var config = {
            label: document.getElementById('task_label').value,
            script: document.getElementById('task_script').value,
            binary: document.getElementById('task_binary').value,
            mpiexec_path: document.getElementById('task_mpiexec').value,
            mpi_tasks: document.getElementById('task_mpi_tasks').value,
            gpu_nodes: document.getElementById('task_gpu_nodes').value,
            omp_threads: document.getElementById('task_omp_threads').value,
            args: document.getElementById('task_args').value,
            group: document.getElementById('task_group').value,
            isDefault: document.getElementById('task_default').checked
        };
        
        vscode.postMessage({
            command: 'save_task_config',
            config: config
        });
    })

    // Request active file when run tab is opened (only if not already set)
    document.getElementById("run_tab").addEventListener('click', function() {
        var scriptInput = document.getElementById('task_script');
        if (scriptInput && !scriptInput.value) {
            vscode.postMessage({
                command: 'get_active_file'
            });
        }
    })
    
    var modbar_config = {
        displayModeBar: true,
        responsive: true,
        displaylogo: false,
        modeBarButtonsToRemove: ["toImage", "lasso2d", "select2d", "toggleHover", "toggleSpikelines", "togglehover"],
        modeBarButtonsToAdd: ["hoverclosest", "hovercompare",
            {
                name: 'download',
                attr: 'download',
                title: 'Save as Image (png)',
                icon: Plotly.Icons.camera,
                click: function (gd) {
                    Plotly.Snapshot.toImage(gd, {format: 'png'}).once('success', function(url) {
                        vscode.postMessage('<img src="' + url + '"/>')
                      });
                }
            }
        ],
        scrollZoom: true,
    }

    var fg = getComputedStyle(document.documentElement)
        .getPropertyValue('--vscode-editor-foreground');

    var bg = getComputedStyle(document.documentElement)
        .getPropertyValue('--vscode-editor-background');

    var fg2 = getComputedStyle(document.documentElement)
        .getPropertyValue('--vscode-textBlockQuote-foreground');

    var hl_col = getComputedStyle(document.documentElement)
        .getPropertyValue('--vscode-editor-lineHighlightBackground');

    function gen_info_row(bar_id, label_str) {
        var util_row = document.createElement("tr");
        var util_label_cell = document.createElement("td");
        util_label_cell.appendChild(document.createTextNode(label_str))
        util_label_cell.style.width = '1%'
        var util_bar_cell = document.createElement("td");
        var util_bar = document.createElement("progress")
        util_bar.id = bar_id
        util_bar.value = "0"
        util_bar.min = "0"
        util_bar.max = "100"
        util_bar.style = "width:100%; padding: 2px 4px;"
        util_bar_cell.appendChild(util_bar)
        util_row.appendChild(util_label_cell)
        util_row.appendChild(util_bar_cell)
        return util_row
    }

    function get_layout() {

        var layout = {
            width: document.getElementById('logs').clientWidth - 10,
            height: window.innerHeight - 40,
            paper_bgcolor: "rgba(255,255,255,0)",
            plot_bgcolor: "rgba(255,255,255,0)",
            legend: {
                x: 0,
                xanchor: 'left',
                y: 80,
                orientation: 'h'
            },
            margin: {
                l: 60,
                r: 50,
                b: 35,
                t: 15
            },
            font: {
                size: 14,
                color: fg
            },
            scene: {
                camera: {
                    projection: {
                        type: "orthographic"
                    }
                }
            },
            modebar: {
                orientation: 'v',
                bgcolor: "rgba(255,255,255,0)",
                color: fg,
                activecolor: fg2
            }
        }
        return layout
    }

    function plot_performance_pie(plot_div, perf_data, panel_id) {
        // Build custom hover text with avg time
        var hovertext = [];
        for (let i = 0; i < perf_data.labels.length; i++) {
            hovertext.push(
                perf_data.labels[i] + '<br>' +
                'Avg Time: ' + perf_data.avg_times[i].toFixed(4) + ' s<br>' +
                'Percent: ' + perf_data.values[i].toFixed(2) + '%'
            );
        }
        
        var data = [{
            values: perf_data.values,
            labels: perf_data.labels,
            type: 'pie',
            textinfo: 'label+percent',
            textposition: 'auto',
            marker: {
                colors: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f'],
                line: {
                    color: bg,
                    width: 2
                }
            },
            hovertext: hovertext,
            hoverinfo: 'text',
            hole: 0.3
        }];

        var layout = {
            title: {
                text: 'MPI Task Timing Breakdown',
                font: {
                    color: fg
                }
            },
            showlegend: true,
            legend: {
                font: {
                    color: fg
                }
            },
            paper_bgcolor: bg,
            plot_bgcolor: bg,
            font: {
                color: fg
            },
            height: 400,
            margin: {
                l: 20,
                r: 20,
                t: 40,
                b: 20
            }
        };

        var plotElement = document.getElementById(plot_div);
        Plotly.newPlot(plotElement, data, layout, modbar_config);
        
        // Add total wall time inside the panel if available
        if (perf_data.total_time !== undefined && panel_id) {
            var panelElement = document.getElementById(panel_id);
            if (panelElement) {
                // Remove existing time display if present
                var existingTimeDiv = document.getElementById(plot_div + '_time');
                if (existingTimeDiv) {
                    existingTimeDiv.remove();
                }
                
                var timeDiv = document.createElement('div');
                timeDiv.id = plot_div + '_time';
                timeDiv.style.textAlign = 'center';
                timeDiv.style.marginTop = '10px';
                timeDiv.style.fontWeight = 'bold';
                timeDiv.style.color = fg;
                timeDiv.textContent = 'Total Wall Time: ' + perf_data.total_time.toFixed(4) + ' seconds';
                panelElement.appendChild(timeDiv);
            }
        }
    }

    function plot_log(plot_div, data) {
        var layout = get_layout()
        layout.height = 300;
        Plotly.newPlot(document.getElementById(plot_div), data, layout, modbar_config);

        // Overriding plotly modebar style to fix inactive button shifting
        var modebar_groups = document.getElementsByClassName("modebar-group");
        for (let i = 0; i < modebar_groups.length; i++) {
            modebar_groups[i].style.display = "grid";
        }
    }

    function update_log(plot_div, data) {
        var plotly_div = document.getElementById(plot_div)
        for (let d = 0; d < data.length; d++) {
            data[d].visible = plotly_div.data[d].visible;
        }
        Plotly.react(plotly_div, data, plotly_div.layout);
    }

    function plot_dump(plot_div, data) {

        var layout = get_layout()

        var sliderSteps = [];
        var bools = []
        for (let i = 0; i < data.length; i++) {
            for (let ix = 0; ix < data.length; ix++) {
                if (ix == i) {
                    bools[ix] = true
                } else { bools[ix] = false }
            }

            sliderSteps.push({
                label: String(i),
                method: 'update',
                args: [{
                    'x': [data[i].x],
                    'y': [data[i].y],
                    'z': [data[i].z],
                    'marker': [data[i].marker]
                }]
            })
        }

        layout['sliders'] = [{
            pad: { t: 30 },
            currentvalue: {
                xanchor: 'right',
                prefix: 'Timestep: ',
                font: {
                    color: fg,
                    size: 14
                }
            },
            steps: sliderSteps
        }]
        layout['scene']['aspectmode']='data'
        // Create the plot:
        Plotly.newPlot(document.getElementById(plot_div),
            [data[0]], layout, modbar_config);

        // Overriding plotly modebar style to fix inactive button shifting
        var modebar_groups = document.getElementsByClassName("modebar-group");
        for (let i = 0; i < modebar_groups.length; i++) {
            modebar_groups[i].style.display = "grid";
        }
        document.getElementById(plot_div).style.border = '1px solid'
        document.getElementById(plot_div).style.borderColor = hl_col
        resize_plots()
    }

    function update_dump(plot_div, new_data) {
        var plot_element = document.getElementById(plot_div);
        var current_layout = plot_element.layout;
        
        // Get current number of timesteps from slider
        var current_steps = current_layout.sliders[0].steps;
        var num_existing = current_steps.length;
        
        // Append new slider steps for new timesteps
        for (let i = 0; i < new_data.length; i++) {
            var timestep_index = num_existing + i;
            current_steps.push({
                label: String(timestep_index),
                method: 'update',
                args: [{
                    'x': [new_data[i].x],
                    'y': [new_data[i].y],
                    'z': [new_data[i].z],
                    'marker': [new_data[i].marker]
                }]
            });
        }
        
        // Update the layout with the extended slider
        Plotly.relayout(plot_element, {'sliders[0].steps': current_steps});
    }

    function openTab(evt, cont_type) {
        var i, tabcontent, tablinks;
        tabcontent = document.getElementsByClassName("tabcontent");
        for (i = 0; i < tabcontent.length; i++) {
            tabcontent[i].style.display = "none";
        }
        tablinks = document.getElementsByClassName("tablinks");
        for (i = 0; i < tablinks.length; i++) {
            tablinks[i].className = tablinks[i].className.replace(" active", "");
        }
        document.getElementById(cont_type).style.display = "block";
        evt.currentTarget.className += " active";
        resize_plots_sub()
    }
}
