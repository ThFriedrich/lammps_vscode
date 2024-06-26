//@ts-check

'use strict';

const path = require('path');
const CopyPlugin = require("copy-webpack-plugin");

/**@type {import('webpack').Configuration}*/
const config = {
    target: 'node', // vscode extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/

    entry: './src/extension.ts', // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
    output: {
        // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
        path: path.resolve(__dirname, 'dist'),
        filename: 'extension.js',
        libraryTarget: 'commonjs2',
        devtoolModuleFilenameTemplate: '../[resource-path]'
    },
    devtool: 'source-map',
    externals: {
        'vscode': 'commonjs2 vscode', // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
        'mathjax-node': 'commonjs2 mathjax-node',
        'markdown-it': 'commonjs2 markdown-it',
        'node-nvidia-smi': 'commonjs2 node-nvidia-smi',
        'node-os-utils': 'commonjs2 node-os-utils',
        'plist': 'commonjs2 plist',
        'cpu-stats': 'commonjs2 cpu-stats',
        'request': 'commonjs2 request',
        'vscode-oniguruma': 'commonjs2 vscode-oniguruma',
        'vscode-textmate': 'commonjs2 vscode-textmate',
        'plotly.js-dist-min': 'commonjs2 plotly.js-dist-min'
    },
    resolve: {
        // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
        extensions: ['.ts', '.js']
    },
    module: {
        rules: [{
            test: /\.ts$/,
            use: [{
                loader: 'ts-loader'
            }],
        }]
    },
    plugins: [
        new CopyPlugin({
            patterns: [{
                from: path.resolve(__dirname, "src", "dashboard.js"),
            }, ],
        }),
    ],
};
module.exports = config;