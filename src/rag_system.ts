/**
 * TypeScript RAG implementation for LAMMPS documentation
 * Main RAG system class
 */

import * as fs from 'fs';
import { getDocumentation } from './doc_fcns';
import {
    DocumentChunk,
    SearchResult,
    OllamaEmbeddingResponse,
    OllamaChatMessage,
    OllamaChatResponse,
    ChatInput,
    RagConfig,
    RAG_DEFAULTS,
    ParsedLine,
    LineCheckResult,
    estimateTokens,
    cosineSimilarity,
    getChunkLabel,
    parseScriptLines,
    extractSyntaxFromScript,
    generateKeywordHints,
    buildContext,
    buildBudgetedContext,
    truncateToTokenBudget,
    cleanThinkTags,
    buildFindingsText,
    cleanDocString,
    checkSyntaxDeterministic
} from './rag_helpers';
import {
    RESPONSE_MODES,
    ResponseModeConfig,
    buildThinkingPrompt,
    buildSystemPrompt,
    buildUserPrompt,
    buildSummarizeHistoryPrompt,
    buildLineCheckSummaryPrompt,
    buildDeepCheckBatchPrompt
} from './rag_prompts';

// Re-export types for external consumers
export { ChatInput, RagConfig, SearchResult, DocumentChunk, LineCheckResult };

export class LammpsRagSystem {
    private chunks: DocumentChunk[] = [];
    private embeddings: Float32Array[] = [];
    private embeddingDim: number = 0;
    private readonly ollamaBase: string;
    private readonly embedModel: string;
    private chatModel: string;
    private readonly topK: number;
    private readonly contextWindow: number;
    private readonly maxHistoryTokens: number;
    private readonly minRelevanceThreshold: number;
    private currentAbortController: AbortController | null = null;
    private currentReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    private isCancelled: boolean = false;

    /** Pending response context for line-by-line check flow */
    private pendingResponseContext: {
        messages: OllamaChatMessage[];
        context: string;
        mode: string;
    } | null = null;

    constructor(
        private chunksPath: string,
        private embeddingsPath: string,
        config: RagConfig = {}
    ) {
        this.ollamaBase = config.ollamaBase ?? RAG_DEFAULTS.ollamaBase;
        this.embedModel = config.embedModel ?? RAG_DEFAULTS.embedModel;
        this.chatModel = config.chatModel ?? RAG_DEFAULTS.chatModel;
        this.topK = config.topK ?? RAG_DEFAULTS.topK;
        this.contextWindow = config.contextWindow ?? RAG_DEFAULTS.contextWindow;
        this.maxHistoryTokens = config.maxHistoryTokens ?? RAG_DEFAULTS.maxHistoryTokens;
        this.minRelevanceThreshold = config.minRelevanceThreshold ?? RAG_DEFAULTS.minRelevanceThreshold;
    }

    /**
     * Load chunks and embeddings from disk
     */
    async initialize(): Promise<void> {
        console.log('Loading LAMMPS documentation chunks...');
        const chunksData = await fs.promises.readFile(this.chunksPath, 'utf-8');
        this.chunks = JSON.parse(chunksData);

        console.log('Loading embeddings...');
        if (fs.existsSync(this.embeddingsPath)) {
            const embData = await fs.promises.readFile(this.embeddingsPath, 'utf-8');
            const embJson = JSON.parse(embData);
            this.embeddingDim = embJson.dimension;
            this.embeddings = embJson.embeddings.map((e: number[]) => new Float32Array(e));
            console.log(`Loaded ${this.embeddings.length} embeddings (${this.embeddingDim}D)`);
        } else {
            throw new Error(`Embeddings file not found: ${this.embeddingsPath}`);
        }
    }

    /**
     * Summarize chat history if it exceeds token limit
     */
    private async summarizeHistory(
        history: Array<{ role: 'user' | 'assistant', content: string }>
    ): Promise<Array<{ role: 'user' | 'assistant', content: string }>> {
        const totalTokens = history.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);

        if (totalTokens <= this.maxHistoryTokens) {
            return history;
        }

        console.log(`Chat history too long (${totalTokens} tokens), summarizing...`);

        const conversationText = history.map(msg =>
            `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
        ).join('\n\n');

        const summaryPrompt = buildSummarizeHistoryPrompt(conversationText);

        const url = `${this.ollamaBase}/api/chat`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.chatModel,
                messages: [{ role: 'user', content: summaryPrompt }],
                stream: false,
                options: { temperature: 0.3, num_ctx: this.contextWindow }
            })
        });

        if (!response.ok) {
            console.error('Failed to summarize history, using truncated history');
            return history.slice(-4);
        }

        const data = await response.json() as OllamaChatResponse;
        const summary = data.message.content;

        return [{
            role: 'assistant',
            content: `[Previous conversation summary: ${summary}]`
        }];
    }

    /**
     * Generate a thinking/planning step that selects response mode
     */
    private async generateThinkingStep(
        input: ChatInput,
        history?: Array<{ role: 'user' | 'assistant', content: string }>
    ): Promise<{ analysis: string; mode: string }> {
        const { userQuestion, scriptContext, scriptName } = input;

        const keywordHints = generateKeywordHints(userQuestion);
        const hintsSection = keywordHints.length > 0
            ? `\n\n## KEYWORD HINTS:\n${keywordHints.map(h => `- ${h}`).join('\n')}`
            : '';

        let historyContext = '';
        if (history && history.length > 0) {
            historyContext = '\n\n## CONVERSATION HISTORY:\n' + history.map(m =>
                `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
            ).join('\n\n');
        }

        const scriptIndicator = scriptContext
            ? `\n\n## SCRIPT CONTEXT:\nUser has provided a LAMMPS script${scriptName ? ` (${scriptName})` : ''} with ${scriptContext.split('\n').length} lines.`
            : '';

        const thinkingPrompt = buildThinkingPrompt(userQuestion, scriptIndicator, historyContext, hintsSection);

        const url = `${this.ollamaBase}/api/chat`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.chatModel,
                messages: [{ role: 'user', content: thinkingPrompt }],
                stream: false,
                think: false,
                options: { temperature: 0.1, top_k: 10, num_ctx: this.contextWindow, num_predict: 500 }
            })
        });

        if (!response.ok) {
            console.error('Thinking step failed, using general mode');
            return { analysis: '', mode: 'general' };
        }

        const data: any = await response.json();
        // console.log(`Thinking step full response:`, JSON.stringify(data, null, 2));
        
        let thinkingOutput = data.message?.content || '';
        
        if (!thinkingOutput && data.message?.thinking) {
            thinkingOutput = data.message.thinking;
        }
        
        thinkingOutput = cleanThinkTags(thinkingOutput);
        console.log(`Thinking step processed output: "${thinkingOutput}"`);

        if (!thinkingOutput) {
            console.warn('Thinking step returned empty response, using general mode');
            return { analysis: '', mode: 'general' };
        }

        const modeMatch = thinkingOutput.match(/MODE:\s*(\w+)/i);
        let mode = 'general';
        if (modeMatch && modeMatch[1]) {
            const parsedMode = modeMatch[1].toLowerCase();
            if (RESPONSE_MODES[parsedMode]) {
                mode = parsedMode;
            }
        }

        const focusMatch = thinkingOutput.match(/FOCUS:\s*(.+)/i);
        const analysis = focusMatch ? focusMatch[1].trim() : '';

        // console.log(`Thinking step - MODE: ${mode}, FOCUS: ${analysis}`);
        return { analysis, mode };
    }

    /**
     * Check if line-by-line checking should be offered
     */
    shouldOfferLineByLineCheck(mode: string, hasScript: boolean): boolean {
        return mode === 'script_check' && hasScript;
    }

    /**
     * Generate embedding for a query using Ollama
     */
    private async embedQuery(query: string): Promise<Float32Array> {
        const url = `${this.ollamaBase}/v1/embeddings`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.embedModel,
                input: [query]
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama embedding failed: ${response.statusText}`);
        }

        const data = await response.json() as OllamaEmbeddingResponse;
        return new Float32Array(data.data[0].embedding);
    }

    /**
     * Search for relevant documentation chunks
     */
    async search(
        query: string, 
        k: number = this.topK, 
        options: { minRelevance?: number; docTypes?: string[] } = {}
    ): Promise<SearchResult[]> {
        const queryEmbedding = await this.embedQuery(query);
        const threshold = options.minRelevance ?? this.minRelevanceThreshold;
        const typeFilter = options.docTypes;

        // Extract LAMMPS command names from the query for keyword boosting
        // Matches patterns like: dump_modify, pair_style, fix nve, etc.
        const queryLower = query.toLowerCase();
        const commandPattern = /\b([a-z]+(?:_[a-z]+)+)\b/g;  // Require at least one underscore for command matching
        const queryKeywords = new Set<string>();
        let match;
        while ((match = commandPattern.exec(queryLower)) !== null) {
            queryKeywords.add(match[1]);
            // Also add space-separated version for matching "dump modify" style commands
            queryKeywords.add(match[1].replace(/_/g, ' '));
        }
        
        if (queryKeywords.size > 0) {
            console.log(`Keyword boost candidates: ${[...queryKeywords].join(', ')}`);
        }

        const similarities = this.embeddings.map((embedding, idx) => {
            const baseSimilarity = cosineSimilarity(queryEmbedding, embedding);
            const chunk = this.chunks[idx];
            
            // Keyword boost: if chunk command name exactly matches a query keyword
            let keywordBoost = 0;
            if (chunk.command) {
                // command field is an array like ['dump_modify'] or ['dump image', 'dump movie']
                const commands = Array.isArray(chunk.command) ? chunk.command : [chunk.command];
                for (const cmd of commands) {
                    if (typeof cmd === 'string') {
                        const cmdName = cmd.toLowerCase();
                        // Check both underscore and space variants
                        if (queryKeywords.has(cmdName) || 
                            queryKeywords.has(cmdName.replace(/\s+/g, '_'))) {
                            keywordBoost = 0.15;  // Significant boost for exact command match
                            break;
                        }
                    }
                }
            }
            
            return {
                idx,
                similarity: Math.min(1, baseSimilarity + keywordBoost),  // Cap at 1.0
                baseSimilarity,
                boosted: keywordBoost > 0
            };
        });

        similarities.sort((a, b) => b.similarity - a.similarity);

        const filtered = similarities.filter(s => {
            if (s.similarity < threshold) return false;
            if (typeFilter) {
                const chunk = this.chunks[s.idx];
                return typeFilter.includes(chunk.type);
            }
            return true;
        });

        const top5 = similarities.slice(0, 5);
        console.log(`Search: ${top5.map(s => {
            const label = getChunkLabel(this.chunks[s.idx]);
            const boostMarker = s.boosted ? '⬆' : '';
            return `${label}:${s.similarity.toFixed(2)}${boostMarker}`;
        }).join(', ')}`);
        if (filtered.length < Math.min(k, similarities.length)) {
            console.log(`Filtered to ${filtered.length} results (threshold: ${threshold}${typeFilter ? `, types: ${typeFilter.join(',')}` : ''})`);
        }

        return filtered.slice(0, k).map((result, rank) => ({
            rank: rank + 1,
            distance: 1 - result.similarity,
            relevance: result.similarity,
            chunk: this.chunks[result.idx]
        }));
    }

    /**
     * Get general documentation chunks (fallback)
     */
    private getGeneralDocs(k: number = this.topK): SearchResult[] {
        const generalTypes = ['general_doc', 'syntax_reference'];
        const generalChunks = this.chunks
            .map((chunk, idx) => ({ chunk, idx }))
            .filter(({ chunk }) => generalTypes.includes(chunk.type))
            .slice(0, k);

        console.log(`Using ${generalChunks.length} general documentation chunks`);
        
        return generalChunks.map(({ chunk }, rank) => ({
            rank: rank + 1,
            distance: 0,
            relevance: 1,
            chunk
        }));
    }

    /**
     * Check a single LAMMPS command line against its documentation.
     * Uses deterministic syntax validation (no LLM calls).
     */
    async checkSingleLine(
        line: string,
        lineNum: number = 1
    ): Promise<LineCheckResult> {
        return checkSyntaxDeterministic(line, lineNum);
    }

    /**
     * Check all lines in a script one by one
     */
    async checkScriptLineByLine(
        script: string,
        onLineResult: (result: LineCheckResult) => void,
        onProgress?: (current: number, total: number) => void
    ): Promise<LineCheckResult[]> {
        const parsedLines = parseScriptLines(script);
        const results: LineCheckResult[] = [];

        if (parsedLines.length === 0) {
            return results;
        }

        console.log(`Checking ${parsedLines.length} command lines individually...`);

        for (let i = 0; i < parsedLines.length; i++) {
            if (this.isCancelled) {
                console.log('Line-by-line check cancelled');
                break;
            }

            const { lineNum, content, command } = parsedLines[i];
            
            if (onProgress) {
                onProgress(i + 1, parsedLines.length);
            }

            const checkResult = await this.checkSingleLine(content, lineNum);
            const result: LineCheckResult = {
                lineNum,
                command,
                status: checkResult.status,
                message: checkResult.message,
                syntax: checkResult.syntax
            };
            
            results.push(result);
            onLineResult(result);
        }

        return results;
    }

    /**
     * Generate an LLM summary based on line-by-line check results
     */
    async generateLineCheckSummary(
        results: LineCheckResult[],
        script: string,
        onChunk: (chunk: string) => void
    ): Promise<string> {
        const errors = results.filter(r => r.status === 'error');
        const warnings = results.filter(r => r.status === 'warning');
        const unknowns = results.filter(r => r.status === 'unknown');
        const okCount = results.filter(r => r.status === 'ok').length;

        if (errors.length === 0 && warnings.length === 0 && unknowns.length === 0) {
            const msg = `✅ **All ${okCount} commands passed syntax check.**\n\nNo syntax errors, warnings, or unknown commands were found in your script.`;
            onChunk(msg);
            return msg;
        }

        const findingsText = buildFindingsText(errors, warnings, unknowns);

        // Enforce token budget: truncate script if findings + script exceed context window
        const summarySystemPrompt = 'You are an expert LAMMPS script reviewer. Summarize the line-by-line analysis findings into a helpful, actionable report. Be concise and focus on what needs to be fixed.';
        const findingsTokens = estimateTokens(findingsText);
        const summaryFixedTokens = estimateTokens(summarySystemPrompt) + findingsTokens + 300 + 1500; // 300 for prompt template, 1500 for generation
        const scriptBudget = Math.max(0, this.contextWindow - summaryFixedTokens);
        const budgetedScript = truncateToTokenBudget(script, scriptBudget);
        if (budgetedScript.length < script.length) {
            console.log(`Line check summary: truncated script from ${estimateTokens(script)} to ${estimateTokens(budgetedScript)} tokens to fit context window`);
        }

        const prompt = buildLineCheckSummaryPrompt(okCount, warnings, errors, unknowns, findingsText, budgetedScript);

        const url = `${this.ollamaBase}/api/chat`;
        
        try {
            const response = await this.streamOllamaResponse(
                url,
                {
                    model: this.chatModel,
                    messages: [
                        {
                            role: 'system',
                            content: summarySystemPrompt
                        },
                        { role: 'user', content: prompt }
                    ],
                    stream: true,
                    think: true,
                    options: { temperature: 0.3, num_ctx: this.contextWindow }
                },
                onChunk
            );
            return response;
        } catch (e: any) {
            const errorMsg = `Failed to generate summary: ${e.message}`;
            onChunk(errorMsg);
            return errorMsg;
        }
    }

    /**
     * Quick search without LLM - just return documentation
     */
    async quickSearch(query: string, k: number = 3): Promise<SearchResult[]> {
        return this.search(query, k);
    }

    public setChatModel(model: string) {
        this.chatModel = model;
    }

    /**
     * Stream response from Ollama API
     */
    private async streamOllamaResponse(
        url: string,
        body: object,
        onChunk: (chunk: string) => void,
        signal?: AbortSignal
    ): Promise<string> {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal
        });

        if (!response.ok) {
            throw new Error(`Ollama request failed: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('No response body');
        }

        this.currentReader = reader;
        const decoder = new TextDecoder();
        let fullResponse = '';

        try {
            while (true) {
                if (this.isCancelled) break;

                const { done, value } = await reader.read();
                if (done) break;

                const lines = decoder.decode(value).split('\n').filter(line => line.trim());
                for (const line of lines) {
                    if (this.isCancelled) break;
                    try {
                        const data = JSON.parse(line) as OllamaChatResponse;
                        if (data.message?.content) {
                            fullResponse += data.message.content;
                            onChunk(data.message.content);
                        }
                    } catch {
                        // Skip invalid JSON lines
                    }
                }
            }
        } finally {
            this.currentReader = null;
        }

        return fullResponse;
    }

    /**
     * Cancel any ongoing request
     */
    public async cancelRequest(): Promise<void> {
        console.log('Cancelling request...');
        this.isCancelled = true;

        if (this.currentReader) {
            try {
                await this.currentReader.cancel('User cancelled request');
                console.log('Reader cancelled');
            } catch (e) {
                // Ignore errors when cancelling
            }
            this.currentReader = null;
        }

        if (this.currentAbortController) {
            this.currentAbortController.abort();
            this.currentAbortController = null;
            console.log('Fetch aborted');
        }

        console.log('Request cancelled by user');
    }

    /**
     * Chat with RAG using streaming
     */
    async chatStream(
        input: ChatInput,
        onChunk: (chunk: string) => void,
        history?: Array<{ role: 'user' | 'assistant', content: string }>,
        onThinking?: (thinking: string) => void,
        onOfferLineCheck?: (offer: boolean) => void
    ): Promise<string> {
        const { userQuestion, scriptContext, scriptName } = input;

        this.isCancelled = false;

        let processedHistory = history;
        if (history && history.length > 0) {
            processedHistory = await this.summarizeHistory(history);
        }

        // Thinking step - classifies query and selects response mode
        console.log('Generating planning step...');
        const thinkingResult = await this.generateThinkingStep(input, processedHistory);
        const thinkingAnalysis = thinkingResult.analysis;
        const responseMode = thinkingResult.mode;
        
        if (thinkingAnalysis) {
            console.log(`Mode: ${responseMode}, Thinking: ${thinkingAnalysis.substring(0, 100)}...`);
            if (onThinking) {
                const modeConfig = RESPONSE_MODES[responseMode] || RESPONSE_MODES['general'];
                const thinkingWithMode = `**Mode: ${modeConfig.name}**\n\n${thinkingAnalysis}`;
                onThinking(thinkingWithMode);
            }
        }

        // Build context based on mode, enforcing token budget
        const GENERATION_RESERVE = 1500; // tokens reserved for LLM output
        const modeConfig = RESPONSE_MODES[responseMode] || RESPONSE_MODES['general'];
        const systemPrompt = buildSystemPrompt(modeConfig, thinkingAnalysis, !!scriptContext);

        // Calculate token budget available for context (reference docs)
        // Budget = contextWindow - system prompt - user question - script - history - generation reserve
        const systemTokens = estimateTokens(systemPrompt);
        const questionTokens = estimateTokens(userQuestion);
        const scriptTokens = scriptContext ? estimateTokens(scriptContext) + 50 : 0; // +50 for markdown wrapper
        const historyTokens = processedHistory?.reduce((sum, m) => sum + estimateTokens(m.content), 0) || 0;
        const fixedTokens = systemTokens + questionTokens + scriptTokens + historyTokens + GENERATION_RESERVE + 100; // +100 for section headers
        const contextBudget = Math.max(0, this.contextWindow - fixedTokens);
        console.log(`Token budget: window=${this.contextWindow}, fixed=${fixedTokens} (sys=${systemTokens}, q=${questionTokens}, script=${scriptTokens}, hist=${historyTokens}, reserve=${GENERATION_RESERVE}), context budget=${contextBudget}`);

        let context = '';
        
        if (responseMode === 'script_check' && scriptContext) {
            // For script_check: use ONLY deterministic syntax extraction
            const syntaxRef = extractSyntaxFromScript(scriptContext);
            if (syntaxRef) {
                const cmdCount = syntaxRef.split('\n').filter(l => l.startsWith('•')).length;
                console.log(`Script check mode: using deterministic syntax for ${cmdCount} commands (no RAG search)`);
                context = truncateToTokenBudget(syntaxRef, contextBudget);
            } else {
                context = '# No LAMMPS commands found in script';
            }
        } else {
            // For other modes: use RAG search with mode-specific options
            console.log(`Searching documentation for: ${userQuestion}`);
            
            // Mode-specific search configuration
            let searchOptions: { minRelevance?: number; docTypes?: string[] } = {};
            
            if (responseMode === 'debug') {
                searchOptions = {
                    minRelevance: 0.7,
                    docTypes: ['command_doc', 'syntax_reference']
                };
                console.log('Debug mode: excluding examples, requiring higher relevance');
            } else if (responseMode === 'documentation') {
                searchOptions = {
                    minRelevance: 0.7,
                    docTypes: ['command_doc', 'syntax_reference', 'general_doc']
                };
            } else if (responseMode === 'science') {
                searchOptions = {
                    minRelevance: 0.7,
                    docTypes: ['syntax_reference']
                };
            }
            
            let results = await this.search(userQuestion, this.topK, searchOptions);

            if (results.length === 0) {
                console.log('No relevant results, using general documentation...');
                results = this.getGeneralDocs();
            }

            console.log(`Retrieved ${results.length} documents: [${results.map(r => 
                `${getChunkLabel(r.chunk)} (${r.chunk.type || 'unknown'})`).join('] [')}]`);

            // Build context with token budget enforcement
            let remainingBudget = contextBudget;

            if (scriptContext) {
                const syntaxRef = extractSyntaxFromScript(scriptContext);
                if (syntaxRef) {
                    const cmdCount = syntaxRef.split('\n').filter(l => l.startsWith('•')).length;
                    const syntaxTokens = estimateTokens(syntaxRef);
                    const budgetedSyntax = truncateToTokenBudget(syntaxRef, Math.min(syntaxTokens, Math.floor(remainingBudget * 0.4)));
                    console.log(`Added deterministic syntax for ${cmdCount} commands (${estimateTokens(budgetedSyntax)} tokens)`);
                    context = budgetedSyntax;
                    remainingBudget -= estimateTokens(budgetedSyntax);
                }
            }

            const { context: ragContext, chunksUsed } = buildBudgetedContext(results, remainingBudget);
            if (ragContext) {
                context = context ? context + '\n\n' + ragContext : ragContext;
            }
            console.log(`Context: ${chunksUsed}/${results.length} chunks fit in budget (${estimateTokens(context)} tokens used of ${contextBudget} budget)`);
        }

        const userPrompt = buildUserPrompt(userQuestion, scriptContext, scriptName, context);

        const messages: OllamaChatMessage[] = [
            { role: 'system', content: systemPrompt }
        ];

        if (processedHistory && processedHistory.length > 0) {
            messages.push(...processedHistory);
        }

        messages.push({ role: 'user', content: userPrompt });

        // Check if we should offer line-by-line checking
        if (onOfferLineCheck && this.shouldOfferLineByLineCheck(responseMode, !!scriptContext)) {
            this.pendingResponseContext = {
                messages,
                context,
                mode: responseMode
            };
            onOfferLineCheck(true);
            return '';
        }

        // Call Ollama chat with streaming
        const url = `${this.ollamaBase}/api/chat`;
        this.currentAbortController = new AbortController();

        const totalPromptTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
        console.log(`Final prompt: ${totalPromptTokens} tokens (window=${this.contextWindow}, available for generation=${this.contextWindow - totalPromptTokens})`);
        try {
            const fullResponse = await this.streamOllamaResponse(
                url,
                {
                    model: this.chatModel,
                    messages,
                    stream: true,
                    options: { temperature: 0.3, num_ctx: this.contextWindow }
                },
                onChunk,
                this.currentAbortController.signal
            );
            return fullResponse;
        } catch (e: any) {
            if (e.name === 'AbortError' || e.message?.includes('cancelled')) {
                console.log('Request was cancelled');
                throw new Error('Request cancelled');
            }
            throw e;
        } finally {
            this.currentAbortController = null;
        }
    }

    /**
     * Continue with normal LLM response after user declined line-by-line check
     */
    async continueWithResponse(
        onChunk: (chunk: string) => void
    ): Promise<string> {
        if (!this.pendingResponseContext) {
            throw new Error('No pending response context. Call chatStream first.');
        }

        const { messages } = this.pendingResponseContext;
        this.pendingResponseContext = null;
        this.isCancelled = false;

        const url = `${this.ollamaBase}/api/chat`;
        this.currentAbortController = new AbortController();

        const totalTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
        console.log(`Continuing with response - Total prompt tokens: ${totalTokens}`);

        try {
            const fullResponse = await this.streamOllamaResponse(
                url,
                {
                    model: this.chatModel,
                    messages,
                    stream: true,
                    think: true,
                    options: { temperature: 0.3, num_ctx: 4096 }
                },
                onChunk,
                this.currentAbortController.signal
            );
            return fullResponse;
        } catch (e: any) {
            if (e.name === 'AbortError' || e.message?.includes('cancelled')) {
                console.log('Request was cancelled');
                throw new Error('Request cancelled');
            }
            throw e;
        } finally {
            this.currentAbortController = null;
        }
    }

    /**
     * Check if there's a pending response context
     */
    hasPendingResponse(): boolean {
        return this.pendingResponseContext !== null;
    }

    /**
     * Clear pending response context
     */
    clearPendingResponse(): void {
        this.pendingResponseContext = null;
    }

    /**
     * Deep check analysis - iterative line-by-line analysis with RAG retrieval
     */
    async deepCheckAnalysis(
        script: string,
        onChunk: (chunk: string) => void,
        onProgress?: (current: number, total: number, commands: string[]) => void
    ): Promise<string> {
        const parsedLines = parseScriptLines(script);

        if (parsedLines.length === 0) {
            const msg = "No LAMMPS commands found in the script to analyze.";
            onChunk(msg);
            return msg;
        }

        const linesPerBatch = Math.max(1, Math.floor(this.topK / 2));
        const batches: Array<ParsedLine[]> = [];
        for (let i = 0; i < parsedLines.length; i += linesPerBatch) {
            batches.push(parsedLines.slice(i, i + linesPerBatch));
        }

        console.log(`Deep check: ${parsedLines.length} commands in ${batches.length} batches (${linesPerBatch} lines/batch)`);

        const header = `# Deep Script Analysis\n\nAnalyzing **${parsedLines.length} commands** in **${batches.length} batches** with dedicated documentation retrieval for each batch.\n\n---\n\n`;
        onChunk(header);

        let fullAnalysis = header;
        const allFindings: Array<{ lineNum: number; command: string; status: string; note: string }> = [];

        for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
            if (this.isCancelled) {
                console.log('Deep check cancelled at batch', batchIdx + 1);
                break;
            }

            const batch = batches[batchIdx];
            const commands = batch.map(l => l.command);
            const uniqueCommands = [...new Set(commands)];

            if (onProgress) {
                onProgress(batchIdx + 1, batches.length, uniqueCommands);
            }

            const batchHeader = `## Batch ${batchIdx + 1}/${batches.length}: Lines ${batch[0].lineNum}-${batch[batch.length - 1].lineNum}\n\n`;
            onChunk(batchHeader);
            fullAnalysis += batchHeader;

            const searchQuery = uniqueCommands.map(cmd => `LAMMPS ${cmd} command syntax`).join(' ');

            console.log(`Batch ${batchIdx + 1}: Searching for: ${uniqueCommands.join(', ')}`);
            const results = await this.search(searchQuery, this.topK);

            const linesContent = batch.map(l => `Line ${l.lineNum}: ${l.content}`).join('\n');
            // Calculate context budget for this batch
            const batchSystemPrompt = 'You are an expert LAMMPS script auditor. Verify each command\'s syntax and parameters against the provided documentation. Be precise and cite documentation when noting issues.';
            const batchFixedTokens = estimateTokens(batchSystemPrompt) + estimateTokens(linesContent) + 200 + 1500; // 200 for prompt template, 1500 for generation
            const batchContextBudget = Math.max(0, this.contextWindow - batchFixedTokens);
            const { context } = buildBudgetedContext(results, batchContextBudget);

            const batchPrompt = buildDeepCheckBatchPrompt(linesContent, context);

            const url = `${this.ollamaBase}/api/chat`;
            try {
                const batchResponse = await this.streamOllamaResponse(
                    url,
                    {
                        model: this.chatModel,
                        messages: [
                            {
                                role: 'system',
                                content: 'You are an expert LAMMPS script auditor. Verify each command\'s syntax and parameters against the provided documentation. Be precise and cite documentation when noting issues.'
                            },
                            { role: 'user', content: batchPrompt }
                        ],
                        stream: true,
                        options: { temperature: 0.2, num_ctx: this.contextWindow }
                    },
                    onChunk
                );

                fullAnalysis += batchResponse + '\n\n---\n\n';
                onChunk('\n\n---\n\n');

                for (const lineInfo of batch) {
                    const statusMatch = batchResponse.match(new RegExp(`Line ${lineInfo.lineNum}[^]*?Status:\\s*(✓|⚠|✗)[^]*?Note:\\s*([^\\n]+)`, 'i'));
                    if (statusMatch) {
                        allFindings.push({
                            lineNum: lineInfo.lineNum,
                            command: lineInfo.command,
                            status: statusMatch[1],
                            note: statusMatch[2].trim()
                        });
                    }
                }
            } catch (e: any) {
                if (e.message?.includes('cancelled')) break;
                const errorMsg = `Error analyzing batch ${batchIdx + 1}: ${e.message}\n\n`;
                onChunk(errorMsg);
                fullAnalysis += errorMsg;
            }
        }

        const errorCount = allFindings.filter(f => f.status === '✗').length;
        const warningCount = allFindings.filter(f => f.status === '⚠').length;
        const correctCount = allFindings.filter(f => f.status === '✓').length;

        const summary = `## Summary

| Status | Count |
|--------|-------|
| ✓ Correct | ${correctCount} |
| ⚠ Warnings | ${warningCount} |
| ✗ Errors | ${errorCount} |

**Total commands analyzed:** ${parsedLines.length}

${errorCount > 0 ? '### Errors Found:\n' + allFindings.filter(f => f.status === '✗').map(f => `- Line ${f.lineNum} (\`${f.command}\`): ${f.note}`).join('\n') : ''}

${warningCount > 0 ? '### Warnings:\n' + allFindings.filter(f => f.status === '⚠').map(f => `- Line ${f.lineNum} (\`${f.command}\`): ${f.note}`).join('\n') : ''}
`;

        onChunk(summary);
        fullAnalysis += summary;

        return fullAnalysis;
    }
}
