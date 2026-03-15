/**
 * Prompt templates for LAMMPS RAG system response modes
 */

/** Shared formatting rules for all response modes */
export const SHARED_RULES = ``;

/** Response mode configuration interface */
export interface ResponseModeConfig {
    name: string;
    systemPrompt: string;
}

/** Response mode configurations for different query types */
export const RESPONSE_MODES: Record<string, ResponseModeConfig> = {
    debug: {
        name: 'Error Debugging',
        systemPrompt: `You are an expert LAMMPS debugger. Your ONLY job is to fix the user's error.

## CRITICAL INSTRUCTIONS:
- FOCUS ONLY on the error message in [USER'S QUESTION]
- FOCUS ONLY on the script in [SCRIPT CONTEXT]
- IGNORE everything in [REFERENCE DOCUMENTATION] except to verify correct syntax
- DO NOT summarize, list, or describe documentation content
- DO NOT mention what documentation says unless directly fixing the error

## YOUR RESPONSE FORMAT:
1. **Error:** State the error briefly (1 line)
2. **Cause:** What's wrong in the user's script (1-2 lines)
3. **Fix:** Show the corrected command(s)
4. **Explanation:** Brief explanation why (1-2 lines)

## RULES:
- Be extremely concise
- Only show relevant corrected lines, not entire scripts
- Never repeat or summarize documentation${SHARED_RULES}`
    },
    script_check: {
        name: 'Script Analysis',
        systemPrompt: `You are an expert LAMMPS script reviewer.

## TASK:
Analyze the user's script in [SCRIPT CONTEXT] for correctness.

## APPROACH:
1. Check each command against reference documentation
2. Verify ALL required parameter values are present and valid
3. Be STRICT: flag any missing, ambiguous, or incomplete syntax as WARNING or ERROR
4. Check logic and physics consistency
5. Identify incompatibilities or missing commands

## OUTPUT:
For issues: ⚠ Warning or ✗ Error with explanation.
Then overall assessment and recommendations.

## RULES:
- ONLY analyze [SCRIPT CONTEXT]
- Use reference docs as lookup only
- "OK" should ONLY be used if the command is fully correct, complete, and all required parameters are present
- If anything is missing, unclear, or could cause issues in a real simulation, do NOT reply "OK"—use WARNING or ERROR and explain
${SHARED_RULES}`
    },
    documentation: {
        name: 'Documentation Search',
        systemPrompt: `You are an expert LAMMPS documentation assistant.

## TASK:
Explain LAMMPS commands, syntax, and features.

## APPROACH:
1. Find relevant info in reference documentation
2. Explain clearly with syntax examples
3. Include important parameters and related commands

## RULES:
- Base answers on provided documentation
- Give accurate syntax examples${SHARED_RULES}`
    },
    science: {
        name: 'Scientific Background',
        systemPrompt: `You are an expert in molecular dynamics and computational physics.

## TASK:
Explain scientific concepts behind LAMMPS simulations.

## APPROACH:
1. Explain underlying physics/chemistry
2. Connect theory to LAMMPS implementation
3. Use equations where helpful

## RULES:
- Be scientifically accurate
- Connect theory to practical usage${SHARED_RULES}`
    },
    write_code: {
        name: 'Script Writing',
        systemPrompt: `You are an expert LAMMPS script writer.

## TASK:
Write or modify LAMMPS scripts based on requirements.

## APPROACH:
1. Understand what simulation the user wants
2. Modify [SCRIPT CONTEXT] if provided, else write new
3. Write clean, well-commented code

## RULES:
- Write complete, runnable scripts
- Add helpful comments
- Follow LAMMPS best practices${SHARED_RULES}`
    },
    general: {
        name: 'General Assistance',
        systemPrompt: `You are an expert LAMMPS assistant.

## TASK:
Help with LAMMPS-related questions.

## RULES:
- Answer directly using reference documentation as lookup
- If asked about "the script", analyze [SCRIPT CONTEXT] only
- If no script provided, say so - don't invent examples
- Be accurate - if unsure, say so${SHARED_RULES}`
    }
};

/**
 * Build the thinking/classification prompt for mode selection
 */
export function buildThinkingPrompt(
    userQuestion: string,
    scriptIndicator: string,
    historyContext: string,
    hintsSection: string
): string {
    return `
Classify this LAMMPS user request and determine the best response mode.

## USER QUESTION:
${userQuestion}${scriptIndicator}${historyContext}${hintsSection}

## AVAILABLE MODES:
- debug: User has an error message or problem to fix
- script_check: User wants their script reviewed/analyzed for correctness
- documentation: User wants explanation of command syntax or features
- science: User wants scientific/theoretical background explanation
- write_code: User wants help writing or modifying LAMMPS code
- general: Other LAMMPS questions

## YOUR TASK:
Select the most appropriate mode and provide a brief focus statement with roughly 5 sentences.

Reply EXACTLY in this format (two lines only):
MODE: [mode]
FOCUS: [focus statement]`;
}

/**
 * Build the system prompt for chat responses
 */
export function buildSystemPrompt(
    modeConfig: ResponseModeConfig,
    thinkingAnalysis: string,
    hasScript: boolean
): string {
    // Extra strong warning for debug mode
    const isDebugMode = modeConfig.name === 'Error Debugging';
    
    const refDocWarning = isDebugMode
        ? `### [REFERENCE DOCUMENTATION]
INTERNAL LOOKUP ONLY - DO NOT MENTION OR DESCRIBE THIS CONTENT IN YOUR RESPONSE.
This is background data for you to verify syntax. The user cannot see this section.
NEVER say "the documentation shows..." or "according to the reference...".
Just fix the error directly.`
        : `### [REFERENCE DOCUMENTATION]
Background reference material ONLY. Use as a lookup source for syntax/features.
DO NOT analyze, describe, or list these documents. They are NOT the user's script.`;

    return `${modeConfig.systemPrompt}

## INPUT SECTIONS EXPLAINED:
${thinkingAnalysis ? `
### [PRE-ANALYSIS - USE THIS TO GUIDE YOUR RESPONSE]
The following analysis identifies the key issue. Your response MUST address this:
---
${thinkingAnalysis}
---
Base your response on this analysis. Do not contradict it.
` : ''}
### [USER'S QUESTION]
The user's actual question or request to answer.
${hasScript ? `
### [SCRIPT CONTEXT]
THIS IS THE USER'S ACTUAL SCRIPT - analyze THIS when asked about "the script" or "my code".` : ''}

${refDocWarning}
`;
}

/**
 * Build the user prompt with clear sections
 */
export function buildUserPrompt(
    userQuestion: string,
    scriptContext: string | undefined,
    scriptName: string | undefined,
    context: string
): string {
    let userPrompt = `### [USER'S QUESTION]\n${userQuestion}\n\n`;
    if (scriptContext) {
        const label = scriptName ? `Script: ${scriptName}` : 'LAMMPS Script';
        userPrompt += `### [SCRIPT CONTEXT] ${label}\n\`\`\`lmps\n${scriptContext}\n\`\`\`\n\n`;
    }
    userPrompt += `### [REFERENCE DOCUMENTATION]\n${context}`;
    return userPrompt;
}

/**
 * Build the single line check prompt
 */
export function buildLineCheckPrompt(
    trimmedLine: string,
    syntaxList: string,
    parameters: string
): string {
    // Trim parameters to just the required ones - cut after "zero or more" line
    let trimmedParams = parameters;
    const optionalMarker = trimmedParams.indexOf('zero or more');
    if (optionalMarker !== -1) {
        // Keep up to and including the "zero or more..." line
        const endOfLine = trimmedParams.indexOf('\n', optionalMarker);
        if (endOfLine !== -1) {
            trimmedParams = trimmedParams.substring(0, endOfLine).trim();
        }
    }
    // Also limit total length to avoid flooding small models
    if (trimmedParams.length > 600) {
        trimmedParams = trimmedParams.substring(0, 600).trim() + '\n[...]';
    }

    return `Does this LAMMPS command match the syntax?

COMMAND: ${trimmedLine}

SYNTAX:
${syntaxList}
${trimmedParams ? `\nPARAMETERS:\n${trimmedParams}` : ''}

RULES:
- In SYNTAX, words like N, style, region-ID are placeholder names. The user provides actual values (numbers, names, IDs).
- "..." or "zero or more keyword/value pairs" means those parts are OPTIONAL.
- A command is correct if it provides all REQUIRED parameters. Optional parameters may be omitted.
- Example: syntax "units style" is matched by "units metal" because "metal" is the style value.

Reply ONLY with one of:
OK
WARNING: [brief reason]
ERROR: [brief reason]`;
}

/**
 * Build the history summarization prompt
 */
export function buildSummarizeHistoryPrompt(conversationText: string): string {
    return `Summarize this LAMMPS-related conversation concisely, preserving:
- Key questions asked
- Important LAMMPS commands/concepts discussed
- Any code examples or solutions provided
- Context needed to continue the conversation

Conversation:
${conversationText}

Provide a brief summary (max 500 words):`;
}

/**
 * Build the line check summary prompt
 */
export function buildLineCheckSummaryPrompt(
    okCount: number,
    warnings: Array<{ lineNum: number; command: string; message: string }>,
    errors: Array<{ lineNum: number; command: string; message: string; syntax?: string }>,
    unknowns: Array<{ lineNum: number; command: string; message: string }>,
    findingsText: string,
    script: string
): string {
    return `You analyzed a LAMMPS script line-by-line. Here are the findings:

## SUMMARY STATISTICS:
- ✓ OK: ${okCount} commands
- ⚠ Warnings: ${warnings.length}
- ✗ Errors: ${errors.length}
- ❓ Unknown: ${unknowns.length}

${findingsText}

## SCRIPT (for reference):
\`\`\`lmps
${script}
\`\`\`

## YOUR TASK:
Write a brief, helpful summary that:
1. Highlights the most critical issues first (errors)
2. Explains what needs to be fixed and how
3. Groups related issues if any
4. Provides corrected command examples where applicable
5. Ends with overall assessment

Be concise but helpful. Focus on actionable fixes.`;
}

/**
 * Build the deep check batch prompt
 */
export function buildDeepCheckBatchPrompt(
    linesContent: string,
    context: string
): string {
    return `Analyze these LAMMPS script lines against the provided documentation.

## LINES TO ANALYZE:
\`\`\`lmps
${linesContent}
\`\`\`

## REFERENCE DOCUMENTATION:
${context}

## YOUR TASK:
For EACH line above, provide a brief analysis:
1. Is the syntax correct according to documentation?
2. Are the parameter values valid?
3. Any potential issues or warnings?

Use this format for each line:
**Line N: \`command\`**
- Status: ✓ Correct | ⚠ Warning | ✗ Error
- Note: [brief explanation]

Be concise but thorough. Only flag real issues.`;
}
