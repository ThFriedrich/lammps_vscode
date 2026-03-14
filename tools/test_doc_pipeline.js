const path = require('path')
const { spawnSync } = require('child_process')
const Module = require('module')
const fs = require('fs')

const repoRoot = path.join(__dirname, '..')

function parseArg(name, fallback) {
    const idx = process.argv.indexOf(name)
    if (idx === -1 || idx + 1 >= process.argv.length) return fallback
    const n = Number(process.argv[idx + 1])
    return Number.isFinite(n) ? n : fallback
}

function parseOptionalArg(name) {
    const idx = process.argv.indexOf(name)
    if (idx === -1 || idx + 1 >= process.argv.length) return undefined
    return process.argv[idx + 1]
}

function hasFlag(name) {
    return process.argv.includes(name)
}

function runCmd(cmd, args) {
    const out = spawnSync(cmd, args, {
        cwd: repoRoot,
        encoding: 'utf-8',
        stdio: 'pipe'
    })
    if (out.status !== 0) {
        console.error(`\n[FAIL] ${cmd} ${args.join(' ')}`)
        if (out.stdout) console.error(out.stdout)
        if (out.stderr) console.error(out.stderr)
        process.exit(out.status || 1)
    }
    return out
}

function makeRng(seed) {
    let s = seed >>> 0
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0
        return s / 0x100000000
    }
}

function shuffleInPlace(arr, rnd) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1))
        const tmp = arr[i]
        arr[i] = arr[j]
        arr[j] = tmp
    }
}

function installVscodeMock() {
    const originalLoad = Module._load
    Module._load = function(request, parent, isMain) {
        if (request === 'vscode') {
            class DummyMarkdownString {
                constructor(value = '') { this.value = value; this.isTrusted = false }
                appendMarkdown(v) { this.value += String(v); return this }
                appendCodeblock(v, lang = '') {
                    this.value += `\n\
\
${lang}\n${String(v)}\n\
\
`
                    return this
                }
            }
            class DummySnippetString {
                constructor(value = '') { this.value = value }
                appendText(v) { this.value += String(v); return this }
                appendPlaceholder(v) { this.value += String(v); return this }
                appendChoice(arr) { this.value += String((arr || []).join('|')); return this }
            }

            const asUri = (p) => ({
                path: String(p),
                fsPath: String(p),
                toString: () => String(p)
            })

            return {
                window: { activeColorTheme: { kind: 1 } },
                workspace: {
                    getConfiguration: () => ({
                        get: (_k, fallback) => fallback
                    })
                },
                Uri: {
                    file: (p) => asUri(p),
                    parse: (p) => asUri(p)
                },
                CompletionItem: class { constructor(label) { this.label = label } },
                CompletionList: class { constructor() { this.items = [] } },
                CompletionItemKind: { Function: 0 },
                MarkdownString: DummyMarkdownString,
                SnippetString: DummySnippetString,
                commands: { executeCommand: () => Promise.resolve() }
            }
        }
        return originalLoad(request, parent, isMain)
    }
}

function collectCommands(commandDocs) {
    const all = []
    for (const d of commandDocs) {
        if (!d || !Array.isArray(d.command)) continue
        for (const c of d.command) all.push(c)
    }
    return [...new Set(all)]
}

function extractAlternativesFromMatch(matchExpr) {
    if (typeof matchExpr !== 'string') return []
    const m = matchExpr.match(/\\b\((.*)\)\(\?=/)
    if (!m || !m[1]) return []
    return m[1].split('|').map((s) => s.trim()).filter(Boolean)
}

function extractBeginCommand(beginExpr) {
    if (typeof beginExpr !== 'string') return undefined
    const m = beginExpr.match(/\\s\*([a-zA-Z_\/]+)\\s/)
    return m ? m[1] : undefined
}

function loadCommandGroupsFromSyntax() {
    const syntaxPath = path.join(repoRoot, 'syntaxes', 'lmps.tmLanguage.json')
    const syntax = JSON.parse(fs.readFileSync(syntaxPath, 'utf-8'))
    const keywordPatterns = syntax?.repository?.keywords?.patterns || []

    /** @type {Map<string, Set<string>>} */
    const groups = new Map()
    const ensure = (name) => {
        if (!groups.has(name)) groups.set(name, new Set())
        return groups.get(name)
    }

    for (const entry of keywordPatterns) {
        if (!entry || typeof entry !== 'object') continue

        if (entry.begin && Array.isArray(entry.patterns)) {
            const beginCmd = extractBeginCommand(entry.begin)
            if (!beginCmd) continue

            const set = ensure(beginCmd)
            set.add(beginCmd)

            for (const p of entry.patterns) {
                if (!p || typeof p !== 'object') continue
                if (typeof p.name !== 'string' || typeof p.match !== 'string') continue
                if (!p.name.endsWith('.lmps') || p.name.includes('.liggghts.')) continue
                for (const alt of extractAlternativesFromMatch(p.match)) {
                    set.add(alt)
                }
            }
        }

        if (entry.name === 'keyword.command.general.lmps' && typeof entry.match === 'string') {
            const set = ensure('general')
            for (const alt of extractAlternativesFromMatch(entry.match)) {
                set.add(alt)
            }
        }
    }

    if (!groups.has('general')) groups.set('general', new Set())
    return groups
}

function commandGroupFromSyntax(command, groups) {
    const cmd = String(command || '').trim()
    if (!cmd) return 'general'

    const parts = cmd.split(/\s+/)
    const head = parts[0]

    if (groups.has(head)) return head

    const general = groups.get('general')
    if (general && (general.has(cmd) || general.has(head))) return 'general'

    return 'general'
}

function pickCommands(allCommands, max, seed, groups) {
    const preferredGroups = [
        'fix',
        'compute',
        'pair_style',
        'bond_style',
        'angle_style',
        'dihedral_style',
        'improper_style',
        'dump',
        'fix_modify',
        'general'
    ]

    const priority = []
    for (const group of preferredGroups) {
        const first = allCommands.find((cmd) => commandGroupFromSyntax(cmd, groups) === group)
        if (first && !priority.includes(first)) priority.push(first)
    }

    const selected = []
    for (const p of priority) {
        if (allCommands.includes(p) && !selected.includes(p)) selected.push(p)
    }

    const pool = allCommands.filter(c => !selected.includes(c))
    const rnd = makeRng(seed)
    shuffleInPlace(pool, rnd)

    const limit = (max <= 0 || max >= allCommands.length) ? allCommands.length : max

    for (const c of pool) {
        if (selected.length >= limit) break
        selected.push(c)
    }

    return selected
}

function checkHtmlForArtifacts(html) {
    const checks = [
        { key: 'raw-rst-directive', re: /\.\.\s+[a-zA-Z0-9_\/-]+\s*::/ },
        { key: 'raw-rst-role', re: /:(doc|ref|math):`/ },
        { key: 'escaped-math-directive', re: /\\\[\s*\.\.\s*math::/ },
        { key: 'ascii-table-border', re: /\+(?:[-=]{3,}\+){2,}/ },
        { key: 'separated-link-leftover', re: /`[^`]*<[^>]*>`_/ }
    ]

    const hits = []
    for (const c of checks) {
        const m = html.match(c.re)
        if (m) hits.push({ type: c.key, sample: m[0] })
    }
    return hits
}

async function main() {
    const maxCommands = parseArg('--max', 0)
    const seed = parseArg('--seed', 1337)
    const skipBuild = hasFlag('--skip-build')
    const failOnIssue = !hasFlag('--allow-issues')
    const summaryJsonPath = parseOptionalArg('--summary-json')

    if (!skipBuild) {
        console.log('[1/3] Regenerating docs with rst2json...')
        runCmd('python3', ['./rst2json/rst2JSON.py'])

        console.log('[2/3] Compiling extension sources...')
        runCmd('npm', ['run', 'compile'])
    }

    installVscodeMock()

    const docObj = require(path.join(repoRoot, 'dist', 'doc_obj.js'))
    const panelFcns = require(path.join(repoRoot, 'dist', 'doc_panel_fcns.js'))
    const highlightFcns = require(path.join(repoRoot, 'dist', 'highlight_fcns.js'))

    const context = {
        extensionPath: repoRoot,
        subscriptions: [],
        asAbsolutePath: (p) => path.join(repoRoot, p)
    }

    const panel = {
        webview: {
            html: '',
            cspSource: 'vscode-webview://mock-csp',
            asWebviewUri: (uri) => ({
                toString: () => `file://${uri && (uri.fsPath || uri.path || String(uri))}`
            })
        }
    }

    const md = await highlightFcns.get_markdown_it(context)
    const allCommands = collectCommands(docObj.command_docs)
    const groups = loadCommandGroupsFromSyntax()
    const commands = pickCommands(allCommands, maxCommands, seed, groups)

    console.log(`Total commands available: ${allCommands.length}`)
    console.log(`[3/3] Rendering ${commands.length} documentation pages to HTML...`)

    const failures = []
    let rendered = 0

    for (const cmd of commands) {
        const mdContent = await panelFcns.create_doc_page(cmd, panel, context)
        if (!mdContent) {
            failures.push({ cmd, type: 'missing-doc', sample: 'create_doc_page returned undefined' })
            continue
        }

        panelFcns.set_doc_panel_content(panel, mdContent, context, md)
        const html = panel.webview.html || ''
        if (!html.includes('<!DOCTYPE html>')) {
            failures.push({ cmd, type: 'missing-html-head', sample: '<!DOCTYPE html> missing' })
            continue
        }

        const hits = checkHtmlForArtifacts(html)
        for (const h of hits) {
            failures.push({ cmd, type: h.type, sample: h.sample })
        }
        rendered += 1
    }

    const byType = {}
    for (const f of failures) {
        byType[f.type] = (byType[f.type] || 0) + 1
    }

    console.log(`Rendered pages: ${rendered}`)
    console.log(`Failures: ${failures.length}`)

    if (summaryJsonPath) {
        const payload = {
            totalCommands: allCommands.length,
            renderedCommands: rendered,
            checkedCommands: commands.length,
            failureCount: failures.length,
            failureByType: byType,
            failures
        }
        fs.writeFileSync(summaryJsonPath, JSON.stringify(payload, null, 2), 'utf-8')
        console.log(`Summary JSON written: ${summaryJsonPath}`)
    }

    if (failOnIssue && failures.length > 0) {
        console.log('Failure counts by type:')
        for (const [k, v] of Object.entries(byType)) {
            console.log(`  - ${k}: ${v}`)
        }

        console.log('\nFirst 20 failures:')
        for (const f of failures.slice(0, 20)) {
            console.log(`  - [${f.type}] ${f.cmd} :: ${f.sample.replace(/\s+/g, ' ').slice(0, 160)}`)
        }
        process.exit(1)
    }

    if (failures.length === 0) {
        console.log('All checks passed.')
    } else {
        console.log('Checks completed with issues (non-fatal due to --allow-issues).')
    }
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
