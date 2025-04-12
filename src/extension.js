const vscode = require("vscode");

/**
 * Chevere Workflow completions provider for PHP files
 */
class ChevereWorkflowCompletionProvider {
    constructor() {
        // Function patterns from Chevere Workflow
        this.workflowFunctions = [{
                name: "workflow",
                snippet: "workflow(\n\t${1:jobName}: ${2:jobDefinition},\n\t$0\n)",
                description: "Creates a new workflow with named jobs",
            },
            {
                name: "sync",
                snippet: "sync(\n\tnew ${1:ActionClass}(),\n\t${2:paramName}: ${3:paramValue}$0\n)",
                description: "Creates a synchronous job",
            },
            {
                name: "async",
                snippet: "async(\n\tnew ${1:ActionClass}(),\n\t${2:paramName}: ${3:paramValue}$0\n)",
                description: "Creates an asynchronous job",
            },
            {
                name: "variable",
                snippet: "variable('${1:name}')",
                description: "References a workflow variable",
            },
            {
                name: "response",
                snippet: "response('${1:jobName}', '${2:responseName}')",
                description: "References a response from another job",
            },
            {
                name: "run",
                snippet: "run(\n\tworkflow: \\$${1:workflow},\n\targuments: [\n\t\t'${2:variableName}' => ${3:value},\n\t\t$0\n\t]\n)",
                description: "Runs a workflow with provided variables",
            },
        ];

        // Job modification methods
        this.jobMethods = [{
                name: "withRunIf",
                snippet: "withRunIf(\n\t${1:variable('condition')},\n\t$0\n)",
                description: "Adds conditional execution to a job",
            },
            {
                name: "withDepends",
                snippet: "withDepends('${1:jobName}'$0)",
                description: "Adds explicit dependency to a job",
            },
        ];
    }

    /**
     * Provide completions for Chevere Workflow functions
     */
    provideCompletionItems(document, position, token, context) {
        // Check if we should provide completions (PHP file and Workflow namespace imported)
        const fileText = document.getText();
        const isWorkflowFile = this.isChevereWorkflowFile(fileText);

        if (!isWorkflowFile) {
            return undefined;
        }

        // Get the current line text up to the cursor position
        const linePrefix = document
            .lineAt(position)
            .text.substring(0, position.character);
        const fullLine = document.lineAt(position).text;

        console.log(`Current line: "${fullLine.trim()}"`);

        // Separate completions based on context
        const completions = [];

        // If we're directly after a function or method call (or in a blank context)
        if (
            linePrefix.trim() === "" ||
            linePrefix.trim().endsWith("use function Chevere\\Workflow\\") ||
            linePrefix.trim().endsWith(";")
        ) {
            this.addFunctionCompletions(completions);
        }

        // If we're after a job definition and possibly wanting a method
        if (linePrefix.trim().endsWith(")")) {
            this.addMethodCompletions(completions);
        }

        // Check if we're in a context where we should suggest parameters
        // Check for empty or whitespace-only line after a class instance
        const currentLine = document.lineAt(position).text.trim();
        const isAfterClassInstance = this.isAfterNewClassInstance(document, position);
        const isInsideSyncAsync = this.isInsideSyncAsync(document, position);

        console.log(`Context checks - After class: ${isAfterClassInstance}, Inside sync/async: ${isInsideSyncAsync}, Current line: "${currentLine}"`);

        if (isAfterClassInstance && isInsideSyncAsync) {
            const className = this.extractClassName(document, position);
            console.log(`Extracted class name: ${className || "none found"}`);

            if (className) {
                // Find parameters for this class by analyzing the document
                const parameters = this.findActionParameters(document, className);

                console.log(`Found ${parameters.length} parameters for class ${className}`);

                if (parameters.length > 0) {
                    console.log(`Parameters: ${JSON.stringify(parameters)}`);
                    // Add parameter completions based on the class's main method
                    parameters.forEach(param => {
                        const item = new vscode.CompletionItem(
                            param.name,
                            vscode.CompletionItemKind.Field
                        );
                        item.documentation = new vscode.MarkdownString(
                            `Parameter: ${param.name}\nType: ${param.type}`
                        );
                        item.insertText = new vscode.SnippetString(
                            `${param.name}: \${1:value}$0`
                        );
                        item.detail = `${className} parameter`;
                        item.sortText = '0' + param.name; // Prioritize these completions
                        completions.push(item);
                    });
                }
            }
        }

        return completions;
    }

    /**
     * Check if the file is using Chevere Workflow
     */
    isChevereWorkflowFile(fileText) {
        // Check for imports or namespace usage related to Chevere Workflow
        return (
            fileText.includes("Chevere\\Workflow") ||
            fileText.includes("use function Chevere\\Workflow\\") ||
            fileText.includes("use Chevere\\Workflow\\")
        );
    }

    /**
     * Check if we're after a 'new ClassName()' instance
     */
    isAfterNewClassInstance(document, position) {
        // Check the current line to see if it's empty or contains only whitespace
        const currentLine = document.lineAt(position).text.trim();
        if (currentLine === "" || currentLine === ",") {
            // Start from current line and go backwards up to 5 lines
            const startLine = Math.max(0, position.line - 5);

            for (let i = position.line - 1; i >= startLine; i--) {
                const line = document.lineAt(i).text.trim();
                // Match any "new ClassName()" pattern, even with content inside the parentheses
                if (line.match(/new\s+[A-Za-z0-9_\\]+\s*\([^)]*\)\s*,?\s*$/)) {
                    return true;
                }

                // If we hit a line with significant content that isn't a class instance, stop looking
                if (line && !line.match(/^\s*\/\//) && !line.match(/^\s*$/) && !line.match(/^[,:]$/)) {
                    break;
                }
            }
        }

        return false;
    }

    /**
     * Check if we're inside a sync/async function call
     */
    isInsideSyncAsync(document, position) {
        // Start from current line and go backwards up to 15 lines
        const startLine = Math.max(0, position.line - 15);

        for (let i = position.line; i >= startLine; i--) {
            const line = document.lineAt(i).text.trim();

            // Direct check for sync or async on the line
            if (line.match(/\b(sync|async)\s*\(/)) {
                return true;
            }

            // Check for workflow pattern with job name followed by sync/async
            if (line.match(/\w+\s*:\s*(sync|async)\s*\(/)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Extract the class name from nearby lines
     */
    extractClassName(document, position) {
        // Start from current line and go backwards up to 5 lines
        const startLine = Math.max(0, position.line - 5);

        for (let i = position.line - 1; i >= startLine; i--) {
            const line = document.lineAt(i).text.trim();
            // Match "new ClassName()" with possible content inside parentheses
            const match = line.match(/new\s+([A-Za-z0-9_\\]+)\s*\(/);
            if (match && match[1]) {
                return match[1];
            }

            // If we hit a line with significant content that isn't a class instance, stop looking
            if (line && !line.match(/^\s*\/\//) && !line.match(/^\s*$/) && !line.match(/^[,:]$/)) {
                break;
            }
        }

        return undefined;
    }

    /**
     * Find the parameters of an action class by analyzing the document
     */
    findActionParameters(document, className) {
        const parameters = [];
        const text = document.getText();

        // Extract just the class name without namespace
        const shortClassName = className.split('\\').pop() || className;

        try {
            // Improved regex to find the complete class definition with proper nesting
            // Find the class opening
            const classOpenRegex = new RegExp(`class\\s+${shortClassName}\\b[^{]*{`, 'i');
            const classOpenMatch = text.match(classOpenRegex);

            if (classOpenMatch) {
                // Get the position where the class starts
                const classStartPos = classOpenMatch.index;
                const classStart = text.substring(classStartPos);

                // Count braces to find the proper closing brace
                let braceCount = 0;
                let classEndPos = 0;
                let insideString = false;
                let stringChar = '';

                for (let i = 0; i < classStart.length; i++) {
                    const char = classStart[i];

                    // Skip string content
                    if ((char === '"' || char === "'") && (i === 0 || classStart[i - 1] !== '\\')) {
                        if (!insideString) {
                            insideString = true;
                            stringChar = char;
                        } else if (char === stringChar) {
                            insideString = false;
                        }
                    }

                    if (!insideString) {
                        if (char === '{') {
                            braceCount++;
                        } else if (char === '}') {
                            braceCount--;
                            if (braceCount === 0) {
                                classEndPos = i + 1; // include the closing brace
                                break;
                            }
                        }
                    }
                }

                if (classEndPos > 0) {
                    const classDefinition = classStart.substring(0, classEndPos);
                    console.log(`Found class definition with length ${classDefinition.length}`);

                    // Find the main method in the class
                    const mainMethodRegex = /public\s+function\s+main\s*\(\s*([\s\S]*?)\s*\)/;
                    const mainMethodMatch = classDefinition.match(mainMethodRegex);

                    if (mainMethodMatch && mainMethodMatch[1]) {
                        console.log(`Found main method with params: ${mainMethodMatch[1]}`);
                        // Extract parameter string
                        const paramString = mainMethodMatch[1].trim();

                        // Handle empty parameter list
                        if (!paramString) {
                            return parameters;
                        }

                        // Split parameters by comma, handling possible commas in default values
                        const paramList = this.splitParameters(paramString);

                        for (const param of paramList) {
                            const trimmedParam = param.trim();
                            if (!trimmedParam) continue;

                            // Match parameter with type and name: "type $name" or "type $name = default"
                            const paramMatch = trimmedParam.match(/(?:([\w\\]+)\s+)?\$(\w+)(?:\s*=\s*.*)?/);
                            if (paramMatch) {
                                const type = paramMatch[1] || 'mixed';
                                const name = paramMatch[2];
                                parameters.push({
                                    name,
                                    type
                                });
                            }
                        }
                    } else {
                        console.log('Main method not found in class definition');
                    }
                }
            }
        } catch (error) {
            console.error('Error parsing class parameters:', error);
        }

        return parameters;
    }

    /**
     * Safely split parameter string by commas, handling nested structures
     */
    splitParameters(paramString) {
        const result = [];
        let current = '';
        let depth = 0;

        for (let i = 0; i < paramString.length; i++) {
            const char = paramString[i];

            if (char === '(' || char === '[' || char === '{') {
                depth++;
                current += char;
            } else if (char === ')' || char === ']' || char === '}') {
                depth--;
                current += char;
            } else if (char === ',' && depth === 0) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }

        if (current) {
            result.push(current);
        }

        return result;
    }

    /**
     * Add workflow function completions
     */
    addFunctionCompletions(completions) {
        for (const func of this.workflowFunctions) {
            const item = new vscode.CompletionItem(
                func.name,
                vscode.CompletionItemKind.Function
            );
            item.documentation = new vscode.MarkdownString(func.description);
            item.insertText = new vscode.SnippetString(func.snippet);
            item.detail = "Chevere Workflow";
            completions.push(item);
        }
    }

    /**
     * Add job method completions
     */
    addMethodCompletions(completions) {
        for (const method of this.jobMethods) {
            const item = new vscode.CompletionItem(
                method.name,
                vscode.CompletionItemKind.Method
            );
            item.documentation = new vscode.MarkdownString(method.description);
            item.insertText = new vscode.SnippetString(`->${method.snippet}`);
            item.detail = "Chevere Workflow Job method";
            completions.push(item);
        }
    }
}

/**
 * Activate the extension
 */
function activate(context) {
    console.log("Chevere Workflow extension is now active");

    // Register completions provider for PHP files
    const provider = new ChevereWorkflowCompletionProvider();
    const selector = {
        language: "php",
        scheme: "file"
    };

    // Register command to show help
    const showHelpCommand = vscode.commands.registerCommand(
        "chevere-workflow.showHelp",
        () => {
            const helpPanel = vscode.window.createWebviewPanel(
                "chevereWorkflowHelp",
                "Chevere Workflow Help",
                vscode.ViewColumn.One, {}
            );

            helpPanel.webview.html = getHelpContent();
        }
    );

    // Register the completion provider
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(selector, provider),
        showHelpCommand
    );
}

/**
 * Generate help content
 */
function getHelpContent() {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Chevere Workflow Help</title>
            <style>
                body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; }
                h1 { border-bottom: 1px solid #ddd; padding-bottom: 10px; }
                code { background-color: #f5f5f5; padding: 2px 5px; border-radius: 3px; }
                pre { background-color: #f5f5f5; padding: 10px; border-radius: 5px; overflow: auto; }
                .function { margin-bottom: 20px; }
                .description { margin: 10px 0; }
            </style>
        </head>
        <body>
            <h1>Chevere Workflow Helper</h1>
            <p>This extension provides autocompletion for the Chevere Workflow PHP library.</p>
            
            <h2>Functions</h2>
            
            <div class="function">
                <h3>workflow()</h3>
                <div class="description">Creates a new workflow with named jobs.</div>
                <pre><code>workflow(
    job1: sync(
        new MyAction(),
        param: 'value'
    ),
    job2: async(
        new AnotherAction(),
        param: variable('inputVar')
    )
);</code></pre>
            </div>
            
            <div class="function">
                <h3>sync()</h3>
                <div class="description">Creates a synchronous job that blocks execution until resolved.</div>
                <pre><code>sync(
    new MyAction(),
    param1: 'value',
    param2: variable('inputVar')
)</code></pre>
            </div>
            
            <div class="function">
                <h3>async()</h3>
                <div class="description">Creates an asynchronous job for parallel execution.</div>
                <pre><code>async(
    new MyAction(),
    param1: 'value',
    param2: variable('inputVar')
)</code></pre>
            </div>
            
            <div class="function">
                <h3>variable()</h3>
                <div class="description">References a workflow variable.</div>
                <pre><code>variable('inputName')</code></pre>
            </div>
            
            <div class="function">
                <h3>response()</h3>
                <div class="description">References a response from another job.</div>
                <pre><code>response('jobName', 'responseName')</code></pre>
            </div>
            
            <div class="function">
                <h3>run()</h3>
                <div class="description">Runs a workflow with provided variables.</div>
                <pre><code>run(
    workflow: $workflow,
    arguments: [
        'inputVar' => 'value',
    ]
);</code></pre>
            </div>
            
            <h2>Methods</h2>
            
            <div class="function">
                <h3>withRunIf()</h3>
                <div class="description">Adds conditional execution to a job.</div>
                <pre><code>sync(
    new MyAction(),
    param: 'value'
)->withRunIf(
    variable('condition'),
    response('job', 'shouldRun')
)</code></pre>
            </div>
            
            <div class="function">
                <h3>withDepends()</h3>
                <div class="description">Adds explicit dependency to a job.</div>
                <pre><code>sync(
    new MyAction(),
    param: 'value'
)->withDepends('otherJobName')</code></pre>
            </div>
            
            <p>For more information, visit the <a href="https://github.com/chevere/workflow">Chevere Workflow GitHub repository</a>.</p>
        </body>
        </html>
    `;
}

/**
 * Deactivate the extension
 */
function deactivate() {}

module.exports = {
    activate,
    deactivate
};