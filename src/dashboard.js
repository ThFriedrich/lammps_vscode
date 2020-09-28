window.onload = function() {
    var vscode = acquireVsCodeApi();
    var button1 = document.getElementById('button1')
    var button2 = document.getElementById('button2')

    button1.addEventListener('click', () => {
        vscode.postMessage({
            command: 'load_log'
        });
    })

    button1.addEventListener('click', () => {
        vscode.postMessage({
            command: 'load_dump'
        });
    })

    window.addEventListener('message', event => {
        plot_log("plot_div", event.data.data, event.data.layout)
    });;
}

function plot_log(plot_div, data, grid_layout) {

    var fg = getComputedStyle(document.documentElement)
        .getPropertyValue('--vscode-editor-foreground');
    var bg = getComputedStyle(document.documentElement)
        .getPropertyValue('--vscode-editor-background');
    var fg2 = getComputedStyle(document.documentElement)
        .getPropertyValue('--vscode-textBlockQuote-foreground');

    var axis_layout = {
        showgrid: true,
        showline: true,
        zeroline: false,
        mirror: 'ticks',
        gridcolor: fg2,
        linecolor: fg,
        gridwidth: 1,
        linewidth: 2,
        tickcolor: fg,
        tickangle: 'auto',
        tickfont: {
            size: 14,
            color: fg
        }
    };

    var layout = {
        width: window.innerWidth,
        height: window.innerHeight,
        paper_bgcolor: "rgba(255,255,255,0)",
        plot_bgcolor: "rgba(255,255,255,0)",
    };

    Object.keys(grid_layout).forEach((ax) => {
        Object.assign(grid_layout[ax], axis_layout)
    });

    Plotly.newPlot(document.getElementById(plot_div), data, {...layout, ...grid_layout }, { scrollZoom: true });

    window.onresize = function() {
        var update = {
            width: window.innerWidth,
            height: window.innerHeight
        };
        Plotly.relayout(document.getElementById(plot_div), update);
    }
}