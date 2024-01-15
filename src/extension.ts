import * as vscode from 'vscode';
import {
	setNewAPIKey,
	buildStatusBarItem,
	OPENAI_API_KEY,
} from './utils';

import * as tm from "./telemetry/Telemetry";
import GiltViewProvider from './gilt-view-provider';


const disposables: vscode.Disposable[] = []; // Keep track of disposables

// This method is called when the extension is activated
export async function activate(context: vscode.ExtensionContext) {
	const giltViewProvider = new GiltViewProvider(context);
	const statusBarItem = buildStatusBarItem();

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

		await giltViewProvider.sendRequest({code: selectedText, type: "askGptOverview", filename: editor.document.fileName});

		statusMessage.dispose();
		statusBarItem.show();
	});

	// Update OpenAI API Key
	let updateAPIKey = vscode.commands.registerCommand('GILT.updateAPIKey', async () => {
		console.log('Running updateAPIKey');

		statusBarItem.hide();
		const statusMessage = vscode.window.setStatusBarMessage('$(hubot) Securely storing your API Key $(pencil)');

		await setNewAPIKey(context);

		statusMessage.dispose();
		statusBarItem.show();
	});

	// Remove OpenAI API Key
	let removeAPIKey = vscode.commands.registerCommand('GILT.removeAPIKey', async () => {
		console.log('Running removeAPIKey');

		statusBarItem.hide();
		const statusMessage = vscode.window.setStatusBarMessage('$(hubot) Securely REMOVING your API Key $(error)');

		await context.secrets.delete(OPENAI_API_KEY);

		statusMessage.dispose();
		statusBarItem.show();
	});


	context.subscriptions.push(
        createExplanation,
		updateAPIKey,
		removeAPIKey,
		vscode.window.registerWebviewViewProvider("gilt-vscode-plugin.view", giltViewProvider, {
			webviewOptions: { retainContextWhenHidden: true }
		})

	);

	tm.listeners.forEach((listener) => {
		context.subscriptions.push(listener.event(listener.fn));
	  });
};

// This method is called when your extension is deactivated
export function deactivate() { 
	disposables.forEach((e) => e.dispose());
	tm.deinit();
}