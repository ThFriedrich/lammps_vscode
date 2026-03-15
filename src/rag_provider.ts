/**
 * VS Code integration for LAMMPS RAG system (TypeScript implementation)
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { LammpsRagSystem, ChatInput, LineCheckResult } from './rag_system';

export interface SearchResult {
    rank: number;
    distance: number;
    relevance: number;
    chunk: {
        id: string;
        type: string;
        text: string;
        command?: string;
        category?: string;
        name?: string;
    };
}

export class LammpsRagProvider {
    private ragSystem: LammpsRagSystem | null = null;
    private initialized = false;
    private outputChannel: vscode.OutputChannel;

    constructor(private context: vscode.ExtensionContext) {
        this.outputChannel = vscode.window.createOutputChannel('LAMMPS RAG');
    }

    /**
     * Initialize the RAG system
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        try {
            const chunksPath = path.join(this.context.extensionPath, 'train_agent', 'lammps_docs_chunks.json');
            const embeddingsPath = path.join(this.context.extensionPath, 'train_agent', 'embeddings.json');

            const config = vscode.workspace.getConfiguration('lammps-vscode.rag');
            
            this.ragSystem = new LammpsRagSystem(chunksPath, embeddingsPath, {
                ollamaBase: config.get('ollamaBase', 'http://127.0.0.1:11434'),
                embedModel: config.get('embedModel', 'nomic-embed-text'),
                chatModel: config.get('chatModel', 'mistral:7b'),
                topK: config.get('topK', 5),
                contextWindow: config.get('contextWindow', 8192)
            });

            await this.ragSystem.initialize();
            this.initialized = true;
            this.outputChannel.appendLine('LAMMPS RAG system initialized successfully');
        } catch (error) {
            this.outputChannel.appendLine(`Failed to initialize RAG: ${error}`);
            vscode.window.showWarningMessage(
                'LAMMPS RAG features unavailable. Make sure embeddings.json exists and Ollama is running.'
            );
        }
    }

    /**
     * Search documentation
     */
    async searchDocumentation(query: string, k?: number): Promise<SearchResult[]> {
        if (!this.ragSystem) {
            throw new Error('RAG system not initialized');
        }
        return this.ragSystem.search(query, k);
    }

    /**
     * Chat with RAG using streaming - sends chunks via callback
     * @param input - ChatInput with userQuestion and optional scriptContext
     * @param onChunk - Callback for streaming response chunks
     * @param history - Optional chat history
     * @param onThinking - Optional callback for thinking step output
     * @param onOfferLineCheck - Optional callback when line-by-line check is suggested
     */
    async chatStream(
        input: ChatInput,
        onChunk: (chunk: string) => void,
        history?: Array<{ role: 'user' | 'assistant', content: string }>,
        onThinking?: (thinking: string) => void,
        onOfferLineCheck?: (offer: boolean) => void
    ): Promise<string> {
        if (!this.ragSystem) {
            throw new Error('RAG system not initialized');
        }
        return this.ragSystem.chatStream(input, onChunk, history, onThinking, onOfferLineCheck);
    }

    /**
     * Quick search (documentation only, no LLM)
     */
    async quickSearch(query: string): Promise<SearchResult[]> {
        if (!this.ragSystem) {
            throw new Error('RAG system not initialized');
        }
        return this.ragSystem.quickSearch(query);
    }

    /**
     * Update the chat model used by RAG
     */
    updateChatModel(model: string) {
        if (this.ragSystem) {
            this.ragSystem.setChatModel(model);
        }
    }

    /**
     * Cancel any ongoing request
     */
    async cancelRequest() {
        if (this.ragSystem) {
            await this.ragSystem.cancelRequest();
        }
    }

    /**
     * Check a single LAMMPS command line against its syntax definition
     * @param line - The command line to check
     * @param lineNum - Optional line number for reference
     * @returns Validation result with status and message
     */
    async checkSingleLine(
        line: string,
        lineNum: number = 1
    ): Promise<{ status: 'ok' | 'warning' | 'error' | 'unknown'; message: string; syntax?: string }> {
        if (!this.ragSystem) {
            throw new Error('RAG system not initialized');
        }
        return this.ragSystem.checkSingleLine(line, lineNum);
    }

    /**
     * Check all command lines in a LAMMPS script
     * @param script - Full script content
     * @param onLineResult - Callback for each line result (for streaming updates)
     * @param onProgress - Optional callback for progress updates
     * @returns Array of line check results
     */
    async checkScriptLineByLine(
        script: string,
        onLineResult: (result: LineCheckResult) => void,
        onProgress?: (current: number, total: number) => void
    ): Promise<LineCheckResult[]> {
        if (!this.ragSystem) {
            throw new Error('RAG system not initialized');
        }
        return this.ragSystem.checkScriptLineByLine(script, onLineResult, onProgress);
    }

    /**
     * Generate an LLM summary based on line-by-line check results
     * @param results - Array of line check results
     * @param script - Original script for context
     * @param onChunk - Callback for streaming output
     */
    async generateLineCheckSummary(
        results: LineCheckResult[],
        script: string,
        onChunk: (chunk: string) => void
    ): Promise<string> {
        if (!this.ragSystem) {
            throw new Error('RAG system not initialized');
        }
        return this.ragSystem.generateLineCheckSummary(results, script, onChunk);
    }

    /**
     * Continue with normal LLM response after user declined line-by-line check
     * @param onChunk - Callback for streaming output chunks
     */
    async continueWithResponse(
        onChunk: (chunk: string) => void
    ): Promise<string> {
        if (!this.ragSystem) {
            throw new Error('RAG system not initialized');
        }
        return this.ragSystem.continueWithResponse(onChunk);
    }

    /**
     * Check if there's a pending response context (user was offered line check)
     */
    hasPendingResponse(): boolean {
        if (!this.ragSystem) {
            return false;
        }
        return this.ragSystem.hasPendingResponse();
    }

    /**
     * Clear pending response context without generating response
     */
    clearPendingResponse(): void {
        if (this.ragSystem) {
            this.ragSystem.clearPendingResponse();
        }
    }
}

/**
 * Register RAG commands
 */
export function registerRagCommands(
    context: vscode.ExtensionContext,
    ragProvider: LammpsRagProvider
): void {
    // Command: Initialize RAG system
    context.subscriptions.push(
        vscode.commands.registerCommand('lammps.initializeRag', async () => {
            try {
                await ragProvider.initialize();
                vscode.window.showInformationMessage('LAMMPS RAG system initialized');
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to initialize RAG: ${error}`);
            }
        })
    );

    // Command: Search documentation
    context.subscriptions.push(
        vscode.commands.registerCommand('lammps.searchDocs', async () => {
            const query = await vscode.window.showInputBox({
                prompt: 'Search LAMMPS documentation',
                placeHolder: 'Enter search query (e.g., "pair_style lj/cut")'
            });

            if (!query) {
                return;
            }

            try {
                await ragProvider.initialize();
                const results = await ragProvider.searchDocumentation(query);

                const doc = await vscode.workspace.openTextDocument({
                    content: formatSearchResults(query, results),
                    language: 'markdown'
                });

                await vscode.window.showTextDocument(doc);
            } catch (error) {
                vscode.window.showErrorMessage(`Search failed: ${error}`);
            }
        })
    );

    // Command: Ask RAG
    context.subscriptions.push(
        vscode.commands.registerCommand('lammps.askRag', async () => {
            const question = await vscode.window.showInputBox({
                prompt: 'Ask LAMMPS RAG',
                placeHolder: 'Enter your question (e.g., "How do I use pair_style lj/cut?")'
            });

            if (!question) {
                return;
            }

            try {
                await ragProvider.initialize();
                
                // Show progress
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'LAMMPS RAG',
                    cancellable: false
                }, async (progress) => {
                    progress.report({ message: 'Searching documentation...' });
                    const answer = await ragProvider.chatStream(
                        { userQuestion: question },
                        () => {} // No streaming callback needed for this use case
                    );

                    const doc = await vscode.workspace.openTextDocument({
                        content: `# Question\n\n${question}\n\n# Answer\n\n${answer}`,
                        language: 'markdown'
                    });

                    await vscode.window.showTextDocument(doc);
                });
            } catch (error) {
                vscode.window.showErrorMessage(`RAG query failed: ${error}`);
            }
        })
    );

    // Command: Get help for word under cursor
    context.subscriptions.push(
        vscode.commands.registerCommand('lammps.getHelp', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }

            const selection = editor.selection;
            const word = editor.document.getText(
                editor.document.getWordRangeAtPosition(selection.active)
            );

            if (!word) {
                vscode.window.showInformationMessage('No word selected');
                return;
            }

            try {
                await ragProvider.initialize();
                
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Getting help for: ${word}`,
                    cancellable: false
                }, async (progress) => {
                    progress.report({ message: 'Searching...' });
                    const answer = await ragProvider.chatStream(
                        { userQuestion: `Explain the LAMMPS command: ${word}` },
                        () => {} // No streaming callback needed for this use case
                    );

                    const doc = await vscode.workspace.openTextDocument({
                        content: `# ${word}\n\n${answer}`,
                        language: 'markdown'
                    });

                    await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside });
                });
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to get help: ${error}`);
            }
        })
    );
}

/**
 * Format search results for display
 */
function formatSearchResults(query: string, results: SearchResult[]): string {
    let output = `# Search Results for: ${query}\n\n`;
    output += `Found ${results.length} results\n\n`;
    output += '---\n\n';

    for (const result of results) {
        output += `## Result ${result.rank} (${(result.relevance * 100).toFixed(0)}% relevant)\n\n`;
        
        if (result.chunk.type) {
            output += `**Type:** ${result.chunk.type}\n\n`;
        }
        if (result.chunk.command) {
            output += `**Command:** \`${result.chunk.command}\`\n\n`;
        }
        if (result.chunk.category) {
            output += `**Category:** ${result.chunk.category}\n\n`;
        }
        if (result.chunk.name) {
            output += `**Name:** ${result.chunk.name}\n\n`;
        }

        output += result.chunk.text + '\n\n';
        output += '---\n\n';
    }

    return output;
}
