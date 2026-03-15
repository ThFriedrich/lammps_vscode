/**
 * Helper functions for LAMMPS RAG system
 */

import { getDocumentation, doc_entry } from './doc_fcns';

/** Document chunk structure from the JSON database */
export interface DocumentChunk {
    id: string;
    type: string;
    text: string;
    command?: string;
    category?: string;
    name?: string;
    title?: string;
    filename?: string;
    chunk_number?: number;
}

/** Search result with relevance scoring */
export interface SearchResult {
    rank: number;
    distance: number;
    relevance: number;
    chunk: DocumentChunk;
}

/** Ollama embedding API response */
export interface OllamaEmbeddingResponse {
    data: Array<{ embedding: number[] }>;
}

/** Ollama chat message structure */
export interface OllamaChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

/** Ollama chat API response */
export interface OllamaChatResponse {
    message: {
        content: string;
    };
    done: boolean;
}

/**
 * Input structure for chat requests
 */
export interface ChatInput {
    /** The user's question or request */
    userQuestion: string;
    /** Optional LAMMPS script content for context */
    scriptContext?: string;
    /** Optional name/path of the script file */
    scriptName?: string;
}

/** Configuration options for LammpsRagSystem */
export interface RagConfig {
    ollamaBase?: string;
    embedModel?: string;
    chatModel?: string;
    topK?: number;
    contextWindow?: number;
    maxHistoryTokens?: number;
    minRelevanceThreshold?: number;
}

/** Default configuration values */
export const RAG_DEFAULTS = {
    ollamaBase: 'http://127.0.0.1:11434',
    embedModel: 'nomic-embed-text',
    chatModel: 'qwen3:4b',
    topK: 5,
    contextWindow: 8192,
    maxHistoryTokens: 2000,
    minRelevanceThreshold: 0.5
};

/** Parsed script line information */
export interface ParsedLine {
    lineNum: number;
    content: string;
    command: string;
}

/** Line check result */
export interface LineCheckResult {
    lineNum: number;
    command: string;
    status: 'ok' | 'warning' | 'error' | 'unknown';
    message: string;
    syntax?: string;
}

/**
 * Rough token count estimation (approx 4 chars per token)
 */
export function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Get a display label for a chunk (command name, title, category, or fallback)
 */
export function getChunkLabel(chunk: DocumentChunk): string {
    if (chunk.command) {
        return Array.isArray(chunk.command) ? chunk.command[0] : chunk.command;
    }
    return chunk.title || chunk.name || chunk.category || chunk.id || 'unknown';
}

/**
 * Parse LAMMPS script into meaningful lines (commands, not comments or blanks).
 * Joins lines connected by the '&' continuation character before parsing.
 */
export function parseScriptLines(script: string): ParsedLine[] {
    const rawLines = script.split('\n');
    const parsedLines: ParsedLine[] = [];

    // First pass: join continuation lines (trailing '&')
    const joinedLines: Array<{ text: string; startLine: number }> = [];
    let accumulator = '';
    let startLine = 0;

    for (let i = 0; i < rawLines.length; i++) {
        const stripped = rawLines[i].trimEnd();
        if (accumulator === '') {
            startLine = i;
        }
        if (stripped.endsWith('&')) {
            // Remove the '&' and append, preserving a space
            accumulator += (accumulator ? ' ' : '') + stripped.slice(0, -1).trim();
        } else {
            accumulator += (accumulator ? ' ' : '') + stripped.trim();
            joinedLines.push({ text: accumulator, startLine });
            accumulator = '';
        }
    }
    // Flush any trailing accumulator (file ending with '&')
    if (accumulator) {
        joinedLines.push({ text: accumulator, startLine });
    }

    // Second pass: parse joined lines
    for (const { text, startLine: lineIdx } of joinedLines) {
        const line = text.trim();

        // Skip empty lines and pure comment lines
        if (!line || line.startsWith('#')) {
            continue;
        }

        // Remove inline comments for command extraction
        const withoutComment = line.split('#')[0].trim();
        if (!withoutComment) continue;

        // Extract command (first word)
        const command = withoutComment.split(/\s+/)[0];

        parsedLines.push({
            lineNum: lineIdx + 1,
            content: line,
            command: command
        });
    }

    return parsedLines;
}

/**
 * Clean HTML entities and formatting from documentation strings
 * Converts HTML entities to plain text while preserving structure
 */
export function cleanDocString(text: string): string {
    return text
        // Non-breaking spaces
        .replace(/&#160;/g, ' ')
        .replace(/&nbsp;/g, ' ')
        // Common HTML entities
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        // Numeric entities (decimal)
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
        // Numeric entities (hex)
        .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
        // Collapse multiple spaces
        .replace(/  +/g, ' ')
        .trim();
}

/**
 * Tokenize a LAMMPS command line, respecting quoted strings.
 * Strips inline comments (everything after unquoted #).
 */
function tokenizeLine(line: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuote) {
            current += ch;
            if (ch === quoteChar) {
                inQuote = false;
            }
        } else if (ch === '#') {
            break;
        } else if (ch === '"' || ch === "'") {
            inQuote = true;
            quoteChar = ch;
            current += ch;
        } else if (/\s/.test(ch)) {
            if (current) {
                tokens.push(current);
                current = '';
            }
        } else {
            current += ch;
        }
    }
    if (current) tokens.push(current);
    return tokens;
}

/**
 * Determine minimum required token count from a syntax template string.
 * Accounts for ellipsis (...) indicating optional/repeating sections
 * and generic template words (keyword, value, args, etc.).
 */
function getMinRequiredTokens(syntaxStr: string): { min: number; hasEllipsis: boolean } {
    const tokens = syntaxStr.split(/\s+/);
    const hasEllipsis = tokens.includes('...');

    if (!hasEllipsis) {
        let min = tokens.length;
        // Skip trailing "keyword value" pattern (optional even without ...)
        if (min >= 3) {
            const sl = tokens[min - 2].toLowerCase();
            const l = tokens[min - 1].toLowerCase();
            if (['keyword', 'keywords'].includes(sl) && ['value', 'values'].includes(l)) {
                min -= 2;
            }
        }
        // Skip trailing "args" or "arg" placeholder
        if (min > 1 && ['args', 'arg'].includes(tokens[min - 1].toLowerCase())) {
            min -= 1;
        }
        return { min, hasEllipsis: false };
    }

    const firstEllipsis = tokens.indexOf('...');
    let end = firstEllipsis;

    // Skip "keyword value/values/arg/args" pair before ...
    if (end >= 2) {
        const sl = tokens[end - 2].toLowerCase();
        const l = tokens[end - 1].toLowerCase();
        if (['keyword', 'keywords'].includes(sl) && ['value', 'values', 'arg', 'args'].includes(l)) {
            end -= 2;
        }
    }

    // Skip standalone "args" or "arg" before ... (also after keyword pair was skipped)
    if (end > 1 && ['args', 'arg'].includes(tokens[end - 1].toLowerCase())) {
        end -= 1;
    }

    // Skip numbered template items (t1, t2, f1, f2, e1, e2)
    while (end > 0 && /^[a-z]\d+$/i.test(tokens[end - 1])) {
        end--;
    }

    // Skip "attributeN" patterns
    while (end > 0 && /^attribute\d+$/i.test(tokens[end - 1])) {
        end--;
    }

    return { min: end, hasEllipsis: true };
}

/**
 * Deterministic syntax check for a single LAMMPS command line.
 * Validates against documentation: command recognition, argument count,
 * and known style/keyword choices.
 * Returns LineCheckResult without requiring any LLM calls.
 */
export function checkSyntaxDeterministic(line: string, lineNum: number = 1): LineCheckResult {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
        return { lineNum, command: '', status: 'ok', message: 'Comment or empty line' };
    }

    const tokens = tokenizeLine(trimmed);
    if (tokens.length === 0) {
        return { lineNum, command: '', status: 'ok', message: 'Empty line' };
    }

    const commandWord = tokens[0];
    const lineForLookup = tokens.join(' ');
    const doc = getDocumentation(lineForLookup);

    if (!doc) {
        return {
            lineNum,
            command: commandWord,
            status: 'unknown',
            message: `Unknown command: ${commandWord}`
        };
    }

    const syntaxList = doc.syntax.map(s => cleanDocString(s)).join('\n');

    if (!doc.args || doc.args.length === 0) {
        return { lineNum, command: commandWord, status: 'ok', message: 'Known command', syntax: syntaxList };
    }

    // Try each syntax variant
    const errors: string[] = [];

    for (let si = 0; si < doc.args.length; si++) {
        const argsDef = doc.args[si];
        const syntaxStr = doc.syntax[si] || '';
        const { min: minTokens, hasEllipsis } = getMinRequiredTokens(syntaxStr);

        // Check minimum arg count
        if (tokens.length < minTokens) {
            errors.push(
                `Too few arguments: expected at least ${minTokens - 1} after '${commandWord}', got ${tokens.length - 1}. Syntax: ${cleanDocString(syntaxStr)}`
            );
            continue;
        }

        // Validate type 1 (command literal) tokens at their positions
        let commandMatch = true;
        for (let i = 0; i < Math.min(argsDef.length, tokens.length); i++) {
            if (argsDef[i].type === 1 && tokens[i] !== argsDef[i].arg) {
                commandMatch = false;
                break;
            }
        }
        if (!commandMatch) {
            continue;
        }

        // Validate type 3 (choice) args in the required section
        let choiceWarning = '';
        const choiceCheckLimit = hasEllipsis ? minTokens : argsDef.length;
        for (let i = 0; i < Math.min(choiceCheckLimit, tokens.length); i++) {
            if (i >= argsDef.length) break;
            if (argsDef[i].type === 3 && argsDef[i].choices.length > 0) {
                const userVal = tokens[i];
                if (!argsDef[i].choices.includes(userVal)) {
                    const preview = argsDef[i].choices.slice(0, 10).join(', ');
                    const suffix = argsDef[i].choices.length > 10 ? ', ...' : '';
                    choiceWarning = `Unexpected value '${userVal}'. Expected one of: ${preview}${suffix}`;
                    break;
                }
            }
        }

        if (choiceWarning) {
            return { lineNum, command: commandWord, status: 'warning', message: choiceWarning, syntax: syntaxList };
        }

        // This variant matches
        return { lineNum, command: commandWord, status: 'ok', message: 'Syntax correct', syntax: syntaxList };
    }

    // No variant matched
    if (errors.length > 0) {
        return { lineNum, command: commandWord, status: 'error', message: errors[0], syntax: syntaxList };
    }

    return { lineNum, command: commandWord, status: 'ok', message: 'Known command', syntax: syntaxList };
}

/**
 * Extract syntax references for all commands found in a script
 * Uses getDocumentation from doc_fcns.ts for deterministic lookup
 */
export function extractSyntaxFromScript(script: string): string {
    const lines = script.split('\n');
    const seenCommands = new Set<string>();
    const syntaxEntries: string[] = [];

    for (const line of lines) {
        const trimmed = line.trim();
        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('#')) continue;

        // Use the imported getDocumentation function from doc_fcns.ts
        const doc = getDocumentation(trimmed);
        if (doc) {
            // Use the first command variant as the key
            const cmdKey = doc.command[0];
            if (!seenCommands.has(cmdKey)) {
                seenCommands.add(cmdKey);
                // Format: command name -> syntax(es) + parameters
                // Clean HTML entities from syntax and parameters
                const cleanedSyntax = doc.syntax.map(s => cleanDocString(s));
                const syntaxList = cleanedSyntax.join(' | ');
                let entry = `• ${cmdKey}: ${syntaxList}`;
                if (doc.parameters?.trim()) {
                    const cleanedParams = cleanDocString(doc.parameters.trim());
                    entry += `\n  Parameters: ${cleanedParams}`;
                }
                syntaxEntries.push(entry);
            }
        }
    }

    if (syntaxEntries.length === 0) {
        return '';
    }

    return `### COMMAND SYNTAX REFERENCE (from documentation):\n${syntaxEntries.join('\n')}`;
}

/**
 * Generate keyword-based hints to assist LLM mode classification
 */
export function generateKeywordHints(message: string): string[] {
    const lower = message.toLowerCase();
    const hints: string[] = [];

    // Debug hints - error/problem keywords
    if (/\b(error|problem|issue|bug|wrong|fail|crash|broken|not work|doesn't work|doesn't run)\b/i.test(lower)) {
        hints.push('Error/problem keywords detected - likely a debugging request');
    }
    if (/\bline\s+\d+\b/i.test(lower)) {
        hints.push('Specific line number mentioned - user may be asking about a particular line');
    }

    // Script analysis hints
    if (/\b(review|check|verify|validate|analyze|audit)\b/i.test(lower) &&
        /\b(script|code|input|file)\b/i.test(lower)) {
        hints.push('Script review/check keywords detected - likely wants script analysis');
    }
    if (/\b(deep|thorough|detailed|line[- ]?by[- ]?line|every line|each line)\b/i.test(lower)) {
        hints.push('Thorough/detailed analysis requested');
    }

    // Write code hints
    if (/\b(write|create|generate|make|build|help me write)\b/i.test(lower) &&
        /\b(script|code|input|simulation|example)\b/i.test(lower)) {
        hints.push('Code creation keywords detected - user may want help writing code');
    }

    // Documentation hints
    if (/\b(what is|what does|how does|how to use|syntax|usage|explain|documentation|meaning of)\b/i.test(lower)) {
        hints.push('Explanation/documentation keywords detected - user may want command explanation');
    }

    // Science hints
    if (/\b(why|physics|theory|concept|principle|equation|meaning|physical|mathemat)\b/i.test(lower) &&
        /\b(potential|force|energy|temperature|pressure|ensemble|atom|molecule|simulation)\b/i.test(lower)) {
        hints.push('Scientific/theoretical keywords detected - user may want physics explanation');
    }

    return hints;
}

/**
 * Build context string from search results
 */
export function buildContext(results: SearchResult[]): string {
    if (results.length === 0) {
        return '# No Relevant Documentation Found\n\nNo documentation matched the query with sufficient relevance.';
    }

    const sections = results.map(r => {
        const header = `## ${getChunkLabel(r.chunk)}`;
        const category = r.chunk.category ? `Category: ${r.chunk.category}\n` : '';
        return `${header}\n${category}${r.chunk.text}`;
    });

    return '# LAMMPS Reference Information\n\n' + sections.join('\n\n' + '-'.repeat(80) + '\n\n');
}

/**
 * Build context from search results while respecting a token budget.
 * Adds chunks in relevance order until the budget would be exceeded.
 * Returns the context string and the number of chunks included.
 */
export function buildBudgetedContext(results: SearchResult[], tokenBudget: number): { context: string; chunksUsed: number } {
    if (results.length === 0 || tokenBudget <= 0) {
        return { context: '', chunksUsed: 0 };
    }

    const header = '# LAMMPS Reference Information\n\n';
    const separator = '\n\n' + '-'.repeat(80) + '\n\n';
    let usedTokens = estimateTokens(header);
    const includedSections: string[] = [];

    for (const r of results) {
        const chunkHeader = `## ${getChunkLabel(r.chunk)}`;
        const category = r.chunk.category ? `Category: ${r.chunk.category}\n` : '';
        const section = `${chunkHeader}\n${category}${r.chunk.text}`;
        const sectionTokens = estimateTokens(section) + (includedSections.length > 0 ? estimateTokens(separator) : 0);

        if (usedTokens + sectionTokens > tokenBudget) {
            console.log(`Token budget: stopping after ${includedSections.length} chunks (${usedTokens} tokens used, next chunk would add ${sectionTokens})`);
            break;
        }

        includedSections.push(section);
        usedTokens += sectionTokens;
    }

    if (includedSections.length === 0) {
        return { context: '', chunksUsed: 0 };
    }

    return {
        context: header + includedSections.join(separator),
        chunksUsed: includedSections.length
    };
}

/**
 * Truncate text to fit within a token budget.
 * Cuts at line boundaries when possible.
 */
export function truncateToTokenBudget(text: string, tokenBudget: number): string {
    if (tokenBudget <= 0) return '';
    if (estimateTokens(text) <= tokenBudget) return text;

    const lines = text.split('\n');
    let result = '';
    for (const line of lines) {
        const candidate = result ? result + '\n' + line : line;
        if (estimateTokens(candidate) > tokenBudget) break;
        result = candidate;
    }

    // If even the first line is too long, do a character-level cut
    if (!result && lines.length > 0) {
        const approxChars = tokenBudget * 4;
        result = text.substring(0, approxChars) + '\n[... truncated to fit context window]';
    }

    return result;
}

/**
 * Clean LLM response by removing think tags
 * Handles various think tag formats from different models
 */
export function cleanThinkTags(response: string): string {
    let result = response;
    
    // First, try to remove complete <think>...</think> blocks
    result = result.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    
    // If there's still a </think> tag, take content after it
    if (result.includes('</think>')) {
        result = result.split('</think>').pop()?.trim() || result;
    }
    
    // If there's an unclosed <think> tag, remove it and everything after
    if (result.includes('<think>')) {
        result = result.split('<think>')[0].trim();
    }
    
    // Also handle other common thinking markers
    // Some models use different formats like [thinking] or **Thinking:**
    result = result.replace(/\[thinking\][\s\S]*?\[\/thinking\]/gi, '').trim();
    
    return result;
}

/**
 * Parse line check LLM response to extract status
 */
export function parseLineCheckResponse(
    response: string,
    syntaxList: string
): { status: 'ok' | 'warning' | 'error' | 'unknown'; message: string; syntax?: string } {
    const cleaned = cleanThinkTags(response);
    
    // Handle empty response
    if (!cleaned || cleaned.length < 2) {
        return { status: 'unknown', message: 'Empty LLM response', syntax: syntaxList };
    }
    
    const firstLine = cleaned.split('\n')[0].trim();
    const upper = firstLine.toUpperCase();

    if (upper.startsWith('OK') || upper === 'OK.') {
        return { status: 'ok', message: 'Syntax correct', syntax: syntaxList };
    } else if (upper.startsWith('WARNING')) {
        const reason = firstLine.replace(/^WARNING:?\s*/i, '').trim();
        return { status: 'warning', message: reason || 'Minor issue', syntax: syntaxList };
    } else if (upper.startsWith('ERROR')) {
        const reason = firstLine.replace(/^ERROR:?\s*/i, '').trim();
        return { status: 'error', message: reason || 'Syntax error', syntax: syntaxList };
    } else {
        // Try to interpret free-form response
        const lower = firstLine.toLowerCase();
        if (lower.includes('correct') || lower.includes('valid') || lower.includes('matches') || lower.includes('ok')) {
            return { status: 'ok', message: 'Syntax correct', syntax: syntaxList };
        } else if (lower.includes('error') || lower.includes('invalid') || lower.includes('wrong')) {
            return { status: 'error', message: firstLine, syntax: syntaxList };
        } else if (lower.includes('warning') || lower.includes('issue') || lower.includes('minor')) {
            return { status: 'warning', message: firstLine, syntax: syntaxList };
        }
        // Default to OK if we can't parse
        return { status: 'ok', message: 'Syntax appears correct', syntax: syntaxList };
    }
}

/**
 * Build findings text for line check summary
 */
export function buildFindingsText(
    errors: LineCheckResult[],
    warnings: LineCheckResult[],
    unknowns: LineCheckResult[]
): string {
    let findingsText = '';
    
    if (errors.length > 0) {
        findingsText += '## ERRORS:\n';
        errors.forEach(e => {
            findingsText += `- Line ${e.lineNum} (${e.command}): ${e.message}\n`;
            if (e.syntax) findingsText += `  Syntax: ${e.syntax}\n`;
        });
        findingsText += '\n';
    }
    
    if (warnings.length > 0) {
        findingsText += '## WARNINGS:\n';
        warnings.forEach(w => {
            findingsText += `- Line ${w.lineNum} (${w.command}): ${w.message}\n`;
        });
        findingsText += '\n';
    }
    
    if (unknowns.length > 0) {
        findingsText += '## UNKNOWN COMMANDS:\n';
        unknowns.forEach(u => {
            findingsText += `- Line ${u.lineNum}: ${u.command} - ${u.message}\n`;
        });
        findingsText += '\n';
    }

    return findingsText;
}
