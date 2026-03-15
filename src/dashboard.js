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
    document.getElementById("chat_tab").addEventListener('click', function (event) { openTab(event, 'chat'); setTimeout(resize_plots_sub, 50); })
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
        // Resize chat messages container to fill available height
        var chat_messages = document.getElementById("chat_messages");
        if (chat_messages && chat_messages.offsetParent !== null) {
            var chat_rect = chat_messages.getBoundingClientRect();
            // Calculate available height: window height - top position - space for input area (~100px) - padding
            var available_height = document.documentElement.clientHeight - chat_rect.top - 100;
            chat_messages.style.height = Math.max(200, available_height) + 'px';
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

        switch (ev_type) {
            case 'plot_log':
                if (ev_data) {
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
                }
                break;
            case 'update_log':
                if (ev_data) {
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
                }
                break;
            case 'plot_dump':
                if (ev_data && ev_meta) {
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
                }
                break;
            case 'update_dump':
                if (b_dump_plotted && ev_data && ev_data.length > 0) {
                    update_dump("dump_div", ev_data);
                }
                break;
            case 'cpu_stat':
                if (ev_data) {
                    document.getElementById('cpu_mem').value = ev_data['memory'];
                    for (let x = 0; x < ev_data['cpu'].length; x++) {
                        document.getElementById("cpu_util" + x).value = ev_data['cpu'][x]['cpu']
                    }
                }
                break;
            case 'gpu_stat':
                if (ev_data) {
                    for (let n = 0; n < ev_data['gpu_util'].length; n++) {
                        document.getElementById('gpu_mem' + n).value = ev_data['gpu_mem'][n];
                        document.getElementById('gpu_util' + n).value = ev_data['gpu_util'][n];
                    }
                }
                break;
            case 'gpu_info':
                if (ev_data) {
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
                }
                break;
            case 'cpu_info':
                if (ev_data) {
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
                }
                break;
            case 'active_file':
                if (ev_data) {
                    // Set the script file input to the active file
                    var scriptInput = document.getElementById('task_script');
                    if (scriptInput) {
                        scriptInput.value = ev_data;
                    }
                }
                break;
            case 'task_result':
                if (ev_data) {
                    // Display task execution result
                    var output = document.getElementById('task_output');
                    if (output) {
                        output.textContent = 'Task executed successfully!\n\nCommand: ' + ev_data.command + '\n\n' + ev_data.message;
                        output.style.borderColor = 'green';
                    }
                }
                break;
            case 'task_error':
                if (ev_data) {
                    // Display task execution error
                    var output = document.getElementById('task_output');
                    if (output) {
                        output.textContent = 'Error: ' + ev_data;
                        output.style.borderColor = 'red';
                    }
                }
                break;
            case 'task_saved':
                if (ev_data) {
                    // Display save confirmation
                    var output = document.getElementById('task_output');
                    if (output) {
                        output.textContent = ev_data;
                        output.style.borderColor = 'green';
                    }
                }
                break;
            case 'active_file_content':
                if (ev_data) {
                    // Update context info
                    updateContextInfo(ev_data);
                }
                break;
            case 'context_file_selected':
                if (ev_data) {
                    // Update context info with selected file
                    updateContextInfo(ev_data);
                }
                break;
            case 'rag_thinking':
                // Only show processing indicator if NOT in streaming mode (old behavior)
                // In streaming mode, we'll get thinking output separately
                addChatMessage('thinking', '');
                break;
            case 'rag_thinking_output':
                // Remove any old thinking indicator
                var oldThinking = document.getElementById('thinking_indicator');
                if (oldThinking) oldThinking.remove();
                // Show thinking step in collapsible section
                if (ev_data && ev_data.thinking) {
                    // Insert BEFORE streaming message if it exists, to maintain correct order
                    var streamingMsg = document.getElementById('streaming_message');
                    addChatMessage('thinking_content', ev_data.thinking, streamingMsg);
                }
                break;
            case 'rag_thinking_done':
                // Auto-collapse the thinking section after 2 seconds
                setTimeout(function() {
                    var thinkingDetails = document.getElementById('thinking_details');
                    if (thinkingDetails) {
                        thinkingDetails.open = false;
                    }
                }, 2000);
                break;
            case 'rag_stream_start':
                // Remove any thinking indicator when streaming starts
                var thinkingIndicator = document.getElementById('thinking_indicator');
                if (thinkingIndicator) thinkingIndicator.remove();
                // Start streaming: create assistant message container with spinner
                addChatMessage('streaming', '');
                break;
            case 'rag_stream_chunk':
                // Append chunk to streaming message
                if (ev_data && ev_data.chunk) {
                    var streamingMsg = document.getElementById('streaming_message');
                    if (streamingMsg) {
                        var contentSpan = streamingMsg.querySelector('.streaming-content');
                        if (contentSpan) {
                            contentSpan.textContent += ev_data.chunk;
                            // Auto-scroll
                            var chat_messages = document.getElementById('chat_messages');
                            chat_messages.scrollTop = chat_messages.scrollHeight;
                        }
                    }
                }
                break;
            case 'rag_stream_end':
                // Replace streaming message with final rendered response
                var streamingMsg = document.getElementById('streaming_message');
                if (streamingMsg) {
                    streamingMsg.remove();
                }
                // Remove any thinking indicators
                while (true) {
                    var thinking = document.getElementById('thinking_indicator');
                    if (!thinking) break;
                    thinking.remove();
                }
                // Add final assistant response
                if (ev_data && ev_data.response) {
                    addChatMessage('assistant', ev_data.response);
                }
                // Reset button to send mode
                setButtonToSend();
                break;
            case 'rag_response':
                // Remove all thinking indicators
                while (true) {
                    var thinking = document.getElementById('thinking_indicator');
                    if (!thinking) break;
                    thinking.remove();
                }
                // Add assistant response
                if (ev_data && ev_data.response) {
                    addChatMessage('assistant', ev_data.response);
                }
                // Reset button to send mode
                setButtonToSend();
                break;
            case 'rag_error':
                // Remove streaming message if present
                var streamingMsg = document.getElementById('streaming_message');
                if (streamingMsg) {
                    streamingMsg.remove();
                }
                // Remove all thinking indicators
                while (true) {
                    var thinking = document.getElementById('thinking_indicator');
                    if (!thinking) break;
                    thinking.remove();
                }
                // Show error
                addChatMessage('error', ev_data || 'Unknown error');
                // Reset button to send mode
                setButtonToSend();
                break;
            
            // Line-by-line check handlers
            case 'rag_offer_line_check':
                // Show offer to run line-by-line check
                if (ev_data && ev_data.message) {
                    addChatMessage('line_check_offer', ev_data.message, null, ev_data.scriptContext);
                }
                break;
            case 'rag_line_check_start':
                // Show progress indicator for line check
                addChatMessage('line_check_progress', ev_data?.message || 'Starting line-by-line check...');
                break;
            case 'rag_line_check_progress':
                // Update progress bar
                if (ev_data) {
                    updateLineCheckProgress(ev_data.current, ev_data.total);
                }
                break;
            case 'rag_line_check_result':
                // Append individual line result
                if (ev_data) {
                    appendLineCheckResult(ev_data);
                }
                break;
            case 'rag_line_check_complete':
                // Show completion summary
                if (ev_data && ev_data.summary) {
                    completeLineCheck(ev_data.summary);
                }
                break;
            case 'rag_line_check_error':
                // Show error
                addChatMessage('error', ev_data || 'Line check failed');
                setButtonToSend();
                break;
            case 'rag_line_check_summary_start':
                // Start streaming the LLM summary
                startLineCheckSummary(ev_data?.message || 'Generating summary...');
                break;
            case 'rag_line_check_summary_chunk':
                // Append chunk to summary
                if (ev_data && ev_data.chunk) {
                    appendLineCheckSummaryChunk(ev_data.chunk);
                }
                break;
            case 'rag_line_check_summary_end':
                // Finalize the summary with rendered HTML
                if (ev_data && ev_data.summary) {
                    finalizeLineCheckSummary(ev_data.summary);
                }
                setButtonToSend();
                break;
            
            case 'ollama_models':
                if (model_selector && ev_data) {
                    model_selector.innerHTML = '';
                    if (ev_data.models && ev_data.models.length > 0) {
                        ev_data.models.forEach(function(model) {
                            var option = document.createElement('option');
                            option.value = model;
                            option.textContent = model;
                            if (model === ev_data.currentModel) {
                                option.selected = true;
                            }
                            model_selector.appendChild(option);
                        });
                    } else {
                        var option = document.createElement('option');
                        option.value = '';
                        option.textContent = 'No models available';
                        model_selector.appendChild(option);
                    }
                }
                break;
            case 'ollama_models_error':
                if (model_selector) {
                    model_selector.innerHTML = '';
                    var option = document.createElement('option');
                    option.value = '';
                    option.textContent = 'Error loading models';
                    model_selector.appendChild(option);
                }
                break;
            case 'model_updated':
                // Model successfully updated - could show a brief notification
                console.log('Model updated to:', ev_data);
                break;
            case 'model_update_error':
                // Show error message
                addChatMessage('error', 'Failed to update model: ' + ev_data);
                break;
            case 'chat_history_cleared':
                // Clear chat messages from UI (keep welcome message)
                var chat_messages = document.getElementById('chat_messages');
                chat_messages.innerHTML = '<div style="padding: 10px; margin: 5px 0; background-color: rgba(13, 171, 161, 0.1); border-left: 3px solid #0daba1;"><strong>Assistant:</strong> Hi! I\'m your LAMMPS documentation assistant. Ask me anything about LAMMPS commands, syntax, or examples.</div>';
                break;
            default:
                break;
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

    // RAG Chat functionality
    var send_chat_btn = document.getElementById('send_chat_btn');
    var chat_input = document.getElementById('chat_input');
    var model_selector = document.getElementById('model_selector');
    var select_context_file_btn = document.getElementById('select_context_file_btn');
    var context_file_info = document.getElementById('context_file_info');
    var active_file_content = null;
    var active_file_name = null;
    var isProcessing = false;  // Track if LLM is working

    // Request available models when chat tab is opened
    document.getElementById("chat_tab").addEventListener('click', function() {
        vscode.postMessage({
            command: 'get_ollama_models'
        });
    });

    // Handle context file selection button
    if (select_context_file_btn) {
        select_context_file_btn.addEventListener('click', function() {
            vscode.postMessage({ command: 'select_context_file' });
        });
    }

    // Handle model selection change
    if (model_selector) {
        model_selector.addEventListener('change', function() {
            var selectedModel = model_selector.value;
            if (selectedModel) {
                vscode.postMessage({
                    command: 'set_chat_model',
                    model: selectedModel
                });
            }
        });
    }

    // Handle clear history button
    var clear_history_btn = document.getElementById('clear_history_btn');
    if (clear_history_btn) {
        clear_history_btn.addEventListener('click', function() {
            vscode.postMessage({ command: 'clear_chat_history' });
            // Clear context file as well
            active_file_content = null;
            active_file_name = null;
            updateContextInfo(null);
        });
    }

    function updateContextInfo(data) {
        var info_div = document.getElementById('context_file_info');
        if (data && data.content) {
            active_file_content = data.content;
            active_file_name = data.fileName || 'context file';
            var fileName = active_file_name.split('/').pop().split('\\').pop();
            var lineCount = data.content.split('\n').length;
            info_div.textContent = '✓ ' + fileName + ' (' + lineCount + ' lines)';
            info_div.style.color = '#0daba1';
        } else {
            active_file_content = null;
            active_file_name = null;
            info_div.textContent = '';
        }
    }

    // Button state management for send/cancel
    function setButtonToCancel() {
        isProcessing = true;
        send_chat_btn.textContent = '⬛ Cancel';
        send_chat_btn.style.backgroundColor = '#d62728';
        send_chat_btn.title = 'Cancel request';
        // Disable input while processing
        chat_input.disabled = true;
        chat_input.style.opacity = '0.6';
    }

    function setButtonToSend() {
        isProcessing = false;
        send_chat_btn.textContent = 'Send';
        send_chat_btn.style.backgroundColor = '';
        send_chat_btn.title = 'Send message';
        // Re-enable input
        chat_input.disabled = false;
        chat_input.style.opacity = '1';
        chat_input.focus();
    }

    function cancelRequest() {
        // Send cancel message to backend (this will abort fetch AND stop Ollama)
        vscode.postMessage({ command: 'rag_cancel' });
        
        // Remove streaming message if present
        var streamingMsg = document.getElementById('streaming_message');
        if (streamingMsg) {
            streamingMsg.remove();
        }
        
        // Remove thinking indicators
        var thinkingIndicator = document.getElementById('thinking_indicator');
        if (thinkingIndicator) thinkingIndicator.remove();
        var thinkingDetails = document.getElementById('thinking_details_wrapper');
        if (thinkingDetails) thinkingDetails.remove();
        
        // Add cancelled message
        addChatMessage('error', 'Request cancelled by user');
        
        // Reset button
        setButtonToSend();
    }

    function sendChatMessage() {
        // If already processing, don't send another message
        if (isProcessing) return;
        
        var query = chat_input.value.trim();
        if (!query) return;

        // Set button to cancel mode
        setButtonToCancel();

        // Add user message to chat
        addChatMessage('user', query);

        // Remove any existing thinking indicator before adding a new one
        var thinking = document.getElementById('thinking_indicator');
        if (thinking) thinking.remove();
        // Show thinking indicator immediately
        addChatMessage('thinking', '');

        // Clear input
        chat_input.value = '';

        // Determine context to send
        var context = active_file_content || null;

        // Send to backend
        vscode.postMessage({
            command: 'rag_chat',
            query: query,
            context: context
        });
    }

    // Handle send/cancel button click
    send_chat_btn.addEventListener('click', function() {
        if (isProcessing) {
            cancelRequest();
        } else {
            sendChatMessage();
        }
    });

    chat_input.addEventListener('keypress', (e) => {
        // Send on Enter, but allow Shift+Enter for new lines (only if not processing)
        if (e.key === 'Enter' && !e.shiftKey && !isProcessing) {
            e.preventDefault();
            sendChatMessage();
        }
    });

    function addChatMessage(role, content, insertBeforeElement, extraData) {
        var chat_messages = document.getElementById('chat_messages');
        var message_div = document.createElement('div');
        message_div.style.padding = '10px';
        message_div.style.margin = '5px 0';
        
        if (role === 'user') {
            message_div.style.backgroundColor = 'rgba(31, 119, 180, 0.1)';
            message_div.style.borderLeft = '3px solid #1f77b4';
            message_div.innerHTML = '<strong>You:</strong> ' + escapeHtml(content);
        } else if (role === 'assistant') {
            message_div.style.backgroundColor = 'rgba(13, 171, 161, 0.1)';
            message_div.style.borderLeft = '3px solid #0daba1';
            // Content is already rendered HTML from backend
            message_div.innerHTML = '<strong>Assistant:</strong> ' + content;
        } else if (role === 'streaming') {
            // Streaming response - show spinner and content area
            message_div.id = 'streaming_message';
            message_div.style.backgroundColor = 'rgba(13, 171, 161, 0.1)';
            message_div.style.borderLeft = '3px solid #0daba1';
            message_div.innerHTML = '<strong>Assistant:</strong> <div style="display: flex; align-items: flex-start; gap: 10px; margin-top: 5px;"><div class="spinner"></div><pre class="streaming-content" style="margin: 0; white-space: pre-wrap; word-wrap: break-word; font-family: inherit; flex: 1;"></pre></div>';
        } else if (role === 'thinking') {
            // Remove any existing thinking indicator before adding a new one
            var oldThinking = document.getElementById('thinking_indicator');
            if (oldThinking) oldThinking.remove();
            message_div.id = 'thinking_indicator';
            message_div.style.backgroundColor = 'rgba(128, 128, 128, 0.1)';
            message_div.style.borderLeft = '3px solid #808080';
            message_div.style.fontStyle = 'italic';
            message_div.innerHTML = '<div style="display: flex; align-items: center; gap: 10px;"><div class="spinner"></div><span>Processing your question...</span></div>';
        } else if (role === 'thinking_content') {
            // Collapsible thinking section - remove any old one first
            var oldThinkingDetails = document.getElementById('thinking_details');
            if (oldThinkingDetails) oldThinkingDetails.remove();
            message_div.id = 'thinking_details_wrapper';
            message_div.style.backgroundColor = 'rgba(128, 128, 128, 0.05)';
            message_div.style.borderLeft = '3px solid #666666';
            var details = document.createElement('details');
            details.id = 'thinking_details';
            details.open = true;  // Start expanded
            var summary = document.createElement('summary');
            summary.style.cursor = 'pointer';
            summary.style.fontWeight = 'bold';
            summary.style.color = '#808080';
            summary.innerHTML = '🤔 Thinking...';
            var thinkingPre = document.createElement('pre');
            thinkingPre.style.margin = '10px 0 0 0';
            thinkingPre.style.whiteSpace = 'pre-wrap';
            thinkingPre.style.wordWrap = 'break-word';
            thinkingPre.style.fontFamily = 'inherit';
            thinkingPre.style.fontSize = '0.9em';
            thinkingPre.style.color = '#888888';
            thinkingPre.textContent = content;
            details.appendChild(summary);
            details.appendChild(thinkingPre);
            message_div.appendChild(details);
        } else if (role === 'error') {
            message_div.style.backgroundColor = 'rgba(214, 39, 40, 0.1)';
            message_div.style.borderLeft = '3px solid #d62728';
            message_div.innerHTML = '<strong>Error:</strong> ' + escapeHtml(content);
        } else if (role === 'line_check_offer') {
            // Offer to run line-by-line check with confirm button
            message_div.id = 'line_check_offer';
            message_div.style.backgroundColor = 'rgba(255, 193, 7, 0.1)';
            message_div.style.borderLeft = '3px solid #ffc107';
            message_div.innerHTML = '<strong>🔍 Suggestion:</strong> ' + escapeHtml(content) + 
                '<br><button id="confirm_line_check_btn" style="margin-top: 8px; padding: 6px 16px; border-radius: 4px; cursor: pointer; background-color: #0daba1; color: white; border: none;">✓ Yes, check each line</button>' +
                '<button id="skip_line_check_btn" style="margin-top: 8px; margin-left: 8px; padding: 6px 16px; border-radius: 4px; cursor: pointer; background-color: #666; color: white; border: none;">✗ No, skip</button>';
            // Store script context for later use
            message_div.dataset.scriptContext = extraData || '';
        } else if (role === 'line_check_progress') {
            // Progress indicator for line-by-line check
            var oldProgress = document.getElementById('line_check_progress');
            if (oldProgress) oldProgress.remove();
            message_div.id = 'line_check_progress';
            message_div.style.backgroundColor = 'rgba(13, 171, 161, 0.1)';
            message_div.style.borderLeft = '3px solid #0daba1';
            message_div.innerHTML = '<strong>🔄 Line-by-Line Check:</strong> ' + escapeHtml(content) +
                '<div style="margin-top: 8px;"><progress id="line_check_bar" value="0" max="100" style="width: 100%; height: 20px;"></progress>' +
                '<span id="line_check_status" style="margin-left: 10px; font-size: 12px;">0/0</span></div>' +
                '<div id="line_check_results" style="margin-top: 10px; font-family: monospace; font-size: 12px; max-height: 300px; overflow-y: auto;"></div>';
        }
        
        // Insert before specified element, or append to end
        if (insertBeforeElement && insertBeforeElement.parentNode === chat_messages) {
            chat_messages.insertBefore(message_div, insertBeforeElement);
        } else {
            chat_messages.appendChild(message_div);
        }
        chat_messages.scrollTop = chat_messages.scrollHeight;
        
        // Attach event listeners for line check offer buttons
        if (role === 'line_check_offer') {
            var confirmBtn = document.getElementById('confirm_line_check_btn');
            var skipBtn = document.getElementById('skip_line_check_btn');
            if (confirmBtn) {
                confirmBtn.addEventListener('click', function() {
                    var offerDiv = document.getElementById('line_check_offer');
                    var scriptContext = offerDiv ? offerDiv.dataset.scriptContext : '';
                    if (scriptContext) {
                        // Remove the offer
                        if (offerDiv) offerDiv.remove();
                        // Send confirmation
                        vscode.postMessage({
                            command: 'rag_line_check_confirm',
                            scriptContext: scriptContext
                        });
                    }
                });
            }
            if (skipBtn) {
                skipBtn.addEventListener('click', function() {
                    var offerDiv = document.getElementById('line_check_offer');
                    if (offerDiv) offerDiv.remove();
                    // Send decline message to continue with normal LLM response
                    vscode.postMessage({
                        command: 'rag_line_check_decline'
                    });
                });
            }
        }
    }

    function escapeHtml(text) {
        var map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
    }

    // Helper functions for line-by-line check
    function updateLineCheckProgress(current, total) {
        var bar = document.getElementById('line_check_bar');
        var status = document.getElementById('line_check_status');
        if (bar && total > 0) {
            bar.value = (current / total) * 100;
        }
        if (status) {
            status.textContent = current + '/' + total;
        }
    }

    function appendLineCheckResult(result) {
        var container = document.getElementById('line_check_results');
        if (!container) return;
        
        var resultDiv = document.createElement('div');
        resultDiv.style.padding = '4px 8px';
        resultDiv.style.marginBottom = '2px';
        resultDiv.style.borderRadius = '3px';
        
        var icon = '❓';
        var bgColor = 'rgba(128, 128, 128, 0.1)';
        if (result.status === 'ok') {
            icon = '✓';
            bgColor = 'rgba(40, 167, 69, 0.1)';
        } else if (result.status === 'warning') {
            icon = '⚠';
            bgColor = 'rgba(255, 193, 7, 0.2)';
        } else if (result.status === 'error') {
            icon = '✗';
            bgColor = 'rgba(220, 53, 69, 0.2)';
        }
        
        resultDiv.style.backgroundColor = bgColor;
        resultDiv.innerHTML = '<span style="font-weight: bold;">' + icon + ' Line ' + result.lineNum + '</span> <code>' + escapeHtml(result.command) + '</code>: ' + escapeHtml(result.message);
        
        container.appendChild(resultDiv);
        container.scrollTop = container.scrollHeight;
    }

    function completeLineCheck(summary) {
        var progressDiv = document.getElementById('line_check_progress');
        if (progressDiv) {
            // Update header to show complete
            var header = progressDiv.querySelector('strong');
            if (header) {
                header.textContent = '✅ Line-by-Line Check Complete:';
            }
            // Add summary statistics
            var summaryDiv = document.createElement('div');
            summaryDiv.id = 'line_check_stats';
            summaryDiv.style.marginTop = '10px';
            summaryDiv.style.padding = '8px';
            summaryDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
            summaryDiv.style.borderRadius = '4px';
            summaryDiv.innerHTML = '<strong>Statistics:</strong> ' + 
                '<span style="color: #28a745;">✓ ' + summary.ok + ' OK</span> | ' +
                '<span style="color: #ffc107;">⚠ ' + summary.warning + ' Warnings</span> | ' +
                '<span style="color: #dc3545;">✗ ' + summary.error + ' Errors</span> | ' +
                '<span style="color: #6c757d;">❓ ' + summary.unknown + ' Unknown</span>';
            
            // Insert summary after progress bar
            var resultsDiv = document.getElementById('line_check_results');
            if (resultsDiv) {
                progressDiv.insertBefore(summaryDiv, resultsDiv);
            } else {
                progressDiv.appendChild(summaryDiv);
            }
        }
        // Don't reset button here - wait for summary to complete
    }

    function startLineCheckSummary(message) {
        var chat_messages = document.getElementById('chat_messages');
        var summaryDiv = document.createElement('div');
        summaryDiv.id = 'line_check_summary';
        summaryDiv.style.padding = '10px';
        summaryDiv.style.margin = '5px 0';
        summaryDiv.style.backgroundColor = 'rgba(13, 171, 161, 0.1)';
        summaryDiv.style.borderLeft = '3px solid #0daba1';
        summaryDiv.innerHTML = '<strong>📋 Analysis Summary:</strong>' +
            '<div style="display: flex; align-items: flex-start; gap: 10px; margin-top: 5px;">' +
            '<div class="spinner"></div>' +
            '<pre id="line_check_summary_content" style="margin: 0; white-space: pre-wrap; word-wrap: break-word; font-family: inherit; flex: 1;"></pre>' +
            '</div>';
        chat_messages.appendChild(summaryDiv);
        chat_messages.scrollTop = chat_messages.scrollHeight;
    }

    function appendLineCheckSummaryChunk(chunk) {
        var contentPre = document.getElementById('line_check_summary_content');
        if (contentPre) {
            contentPre.textContent += chunk;
            var chat_messages = document.getElementById('chat_messages');
            chat_messages.scrollTop = chat_messages.scrollHeight;
        }
    }

    function finalizeLineCheckSummary(renderedHtml) {
        var summaryDiv = document.getElementById('line_check_summary');
        if (summaryDiv) {
            // Replace with rendered HTML
            summaryDiv.innerHTML = '<strong>📋 Analysis Summary:</strong><div style="margin-top: 10px;">' + renderedHtml + '</div>';
        }
        var chat_messages = document.getElementById('chat_messages');
        chat_messages.scrollTop = chat_messages.scrollHeight;
    }

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
