"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const utils_1 = require("./utils");
const tm = require("./telemetry/Telemetry");
const gilt_view_provider_1 = require("./gilt-view-provider");
const disposables = []; // Keep track of disposables
// This method is called when the extension is activated
async function activate(context) {
    const giltViewProvider = new gilt_view_provider_1.default(context);
    const statusBarItem = (0, utils_1.buildStatusBarItem)();
    statusBarItem.show();
    const modalMesesageOptions = {
        "modal": true,
        "detail": "- GPT-3"
    };
    tm.init(context);
    for (const cmd of Object.values({ ...tm.commands })) {
        const reg = vscode.commands.registerCommand(cmd.name, cmd.fn);
        context.subscriptions.push(reg);
        disposables.push(reg);
    }
    // Create explanation for highlighted code considering the API
    let createExplanation = vscode.commands.registerCommand('GILT.createExp', async () => {
        console.log('Running createExp');
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        const selectedText = editor.document.getText(editor.selection);
        if (!selectedText) {
            vscode.window.showWarningMessage('No selected text');
            return;
        }
        statusBarItem.hide();
        const statusMessage = vscode.window.setStatusBarMessage('$(hubot) Generating your explanation! $(book)');
        await giltViewProvider.sendRequest({ code: selectedText, type: "askGptOverview", filename: editor.document.fileName });
        statusMessage.dispose();
        statusBarItem.show();
    });
    // Update OpenAI API Key
    let updateAPIKey = vscode.commands.registerCommand('GPT.updateAPIKey', async () => {
        console.log('Running updateAPIKey');
        statusBarItem.hide();
        const statusMessage = vscode.window.setStatusBarMessage('$(hubot) Securely storing your API Key $(pencil)');
        await (0, utils_1.setNewAPIKey)(context);
        statusMessage.dispose();
        statusBarItem.show();
    });
    // Remove OpenAI API Key
    let removeAPIKey = vscode.commands.registerCommand('GPT.removeAPIKey', async () => {
        console.log('Running removeAPIKey');
        statusBarItem.hide();
        const statusMessage = vscode.window.setStatusBarMessage('$(hubot) Securely REMOVING your API Key $(error)');
        await context.secrets.delete(utils_1.OPENAI_API_KEY);
        statusMessage.dispose();
        statusBarItem.show();
    });
    context.subscriptions.push(createExplanation, updateAPIKey, removeAPIKey, vscode.window.registerWebviewViewProvider("gilt-vscode-plugin.view", giltViewProvider, {
        webviewOptions: { retainContextWhenHidden: true }
    }));
    tm.listeners.forEach((listener) => {
        context.subscriptions.push(listener.event(listener.fn));
    });
}
exports.activate = activate;
;
// This method is called when your extension is deactivated
function deactivate() {
    disposables.forEach((e) => e.dispose());
    tm.deinit();
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map