// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const req = require("axios");
const path = require("path");
const Parser = require("web-tree-sitter");
require('dotenv').config({ path: path.join(__dirname, '/.env')});
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */

async function getParser(context) {
    await Parser.init();
    const languages  = ['go', 'java', 'javascript', 'python', 'php', 'ruby'];
    let parsers = {};
    for (let language of languages) {
        const parserPath = path.join(context.extensionPath, 'parsers', `tree-sitter-${language}` + '.wasm');
        const parser = new Parser;
        const lang = await Parser.Language.load(parserPath);
        parser.setLanguage(lang);
        parsers[language] = parser;
    }
    return parsers;
}

function genMethodCommentJava(comment, parameterNames, isVoid, alignmentChars) {
    let methodComment = `/** ${comment}\n${alignmentChars} *\n`;
    for (let i = 0; i < parameterNames.length; i++) {
        methodComment += `${alignmentChars} * @param ${parameterNames[i]}\n`;
    }
    if (!isVoid) {
        methodComment += `${alignmentChars} * @return STUB PLEASE FILL IN\n`;
    }
    methodComment += `${alignmentChars} */\n`;
    return methodComment;
}

function genMethodCommentPy(comment, parameterNames, isVoid, alignmentChars) {
    let methodComment = `""" \n${alignmentChars}${comment}\n${alignmentChars} \n`;
    for (let i = 0; i < parameterNames.length; i++) {
        if (parameterNames[i] == "self") {
            continue;
        }
        methodComment += `${alignmentChars}    @param ${parameterNames[i]}\n`;
    }
    if (!isVoid) {
        methodComment += `${alignmentChars}    @return STUB PLEASE FILL IN\n`;
    }
    methodComment += `${alignmentChars}"""`;
    return methodComment;
}

function genMethodCommentRuby(comment, parameterNames, isVoid, alignmentChars) {
    let methodComment = `##\n${alignmentChars}# ${comment}\n${alignmentChars}# \n`;
    for (let i = 0; i < parameterNames.length; i++) {
        methodComment += `${alignmentChars}# @param ${parameterNames[i]}\n`;
    }
    if (!isVoid) {
        methodComment += `${alignmentChars}# @return STUB PLEASE FILL IN\n`;
    }
    // methodComment += `${alignmentChars}"""`;
    return methodComment;
}


function genMethodComment(comment, parameterNames, isVoid, alignmentChars, language) {
    switch (language) {
        case "python":
            comment = genMethodCommentPy(comment, parameterNames, isVoid, alignmentChars);
            break;
        case "ruby":
            comment = genMethodCommentRuby(comment, parameterNames, isVoid, alignmentChars);
            break;
        default:
            comment = genMethodCommentJava(comment, parameterNames, isVoid, alignmentChars);
    }
    return comment;
}

async function getComments(text, tree, language, lang, tabSize) {
    let query_str = {
        "java": '((method_declaration name: (identifier) @func.name  body: (block . (_) @func.body) ) @func.text)(method_declaration parameters: (formal_parameters (formal_parameter name: (identifier) @func.params)))',
        "javascript": '((function_declaration name: (identifier) @func.name  body: (statement_block . (_) @func.body) ) @func.text)(function_declaration parameters: (formal_parameters  (identifier) @func.params))',
        "python": "((function_definition name: (identifier) @func.name  body: (block) @func.body ) @func.text) (function_definition parameters: (parameters(_) @func.params))",
        "php": '((function_definition name: (name) @func.name  body: ( compound_statement . (_) @func.body) ) @func.text)(function_definition parameters: (formal_parameters  (_) @func.params))',
        "go": '(( function_declaration name: (identifier) @func.name  body: ( block . (_) @func.body) ) @func.text)(function_declaration parameters: (parameter_list (parameter_declaration name: (identifier) @func.params)))',
        "ruby": '(( method name: (identifier) @func.name  )@func.text)(method  parameters: (method_parameters  (identifier) @func.params))'
    };
    const query = language.query(query_str[lang]);
    const matches = query.matches(tree.rootNode);
    const port = process.env.PORT;
    const host = process.env.HOST;
    const endpoint = process.env.ENDPOINT;
    let functions = new Array();
    const headers = {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        'Content-Type': 'application/json'
    };
    let i = matches.length - 1;
    var url = `http://${host}:${port}/${endpoint}`;
    console.log(url);
    let comments = {};
    if (lang == "ruby") {
        while (i >= 0) {
            let params = new Array();
            while (i >= 0) {
                if (matches[i].pattern == 1) {
                    params.push(matches[i].captures[0].node.text);
                }
                else {
                    break;
                }
                i--;
            }
            if (matches[i].pattern == 0) {
                let start = {
                    row: 0,
                    column: 0
                };
                start = matches[i].captures[0].node.startPosition;
                start.row++;
                if (typeof tabSize === "number") {
                    start.column += tabSize;
                }
                let alignChars = ' '.repeat(start['column']);
                let fun = matches[i].captures[0].node.text;
                let fun_name = matches[i].captures[1].node.text;
                functions.push(fun_name);
                params.reverse();
                const response = await req.default.post(String(url), { data: fun, language: lang }, { headers: headers });
                let cmt = response.data.data;
                cmt = genMethodComment(cmt, params, true, alignChars, lang);
                cmt = cmt + "\n";
                let pos = new vscode.Position(start.row, start.column);
                comments[fun_name] = {
                    comment: cmt,
                    start: pos
                };
            }
            i--;
        }
        return { functions, comments };
    }
    while (i >= 0) {
        if (matches[i].pattern == 0) {
            let start = {
                row: 0,
                column: 0
            };
            start = matches[i].captures[2].node.startPosition;
            let alignChars = ' '.repeat(start['column']);
            let fun = matches[i].captures[0].node.text;
            let fun_name = matches[i].captures[1].node.text;
            functions.push(fun_name);
            let params = new Array();
            while (i >= 0) {
                i--;
                if (i < 0)
                    break;
                if (matches[i].pattern == 1) {
                    params.push(matches[i].captures[0].node.text);
                }
                else {
                    break;
                }
            }
            params.reverse();
            const response = await req.default.post(String(url), { code: fun, lang: lang }, { headers: headers });
            let cmt = response.data.comment;
            cmt = genMethodComment(cmt, params, true, alignChars, lang);
            cmt = cmt + "\n";
            let pos = new vscode.Position(start.row, start.column);
            comments[fun_name] = {
                comment: cmt,
                start: pos
            };
        }
    }
    return { functions, comments };
    // return;
}


async function activate(context) {

    const parser = await getParser(context);
	let disposable = vscode.commands.registerCommand('extension.generate', async () => {
		// The code you place here will be executed every time your command is executed
		
		const editor = vscode.window.activeTextEditor
		if (!editor) {
			return; // No open text editor
		}

		const document = editor.document;
		const selection = editor.selection;

		let lang = editor.document.languageId;
		let language = parser[lang].getLanguage();
		let text =  editor.document.getText();
		let tree2 = parser[lang].parse(text);


		let {functions, comments} = await getComments(text,tree2,language,lang, editor.options.tabSize);
		editor.edit(editBuilder => {
			for (let func of functions){
				let {comment,start} = comments[func];
				editBuilder.insert(start, comment + ' '.repeat(start.character));
			}
		});
	});
	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
