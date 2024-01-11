import * as vscode from 'vscode';

import { Configuration, OpenAIApi } from "openai";
import {
	initAuth,
	Config,
    createChatPayload,
    validateChatPayload
} from './utils';

import * as telemetry from "./telemetry/Telemetry";

import { Marked, Renderer} from '@ts-stack/markdown';
import hljs from 'highlight.js';

class MyRenderer extends Renderer
{
    code(code: string, lang?: string, escaped?: boolean, meta?: string): string {
        const out = hljs.highlight(code, {'language': "python"}).value;
        return `\n<pre class='overflow-scroll white-space-pre' style="margin: 1em 0.5em;"><code class="language-python hljs">${out}</code></pre>\n`;
    }
    list(body: string, ordered?: boolean): string {
        const type = ordered ? 'ol' : 'ul';
        return `\n<${type} style="list-style-type: disc;">\n${body}</${type}>\n`;
    }
}

Marked.setOptions({renderer: new MyRenderer});

const initOpenAI = (credentials: Config): OpenAIApi => {
	const openaiConfig = new Configuration({
		...credentials
	});

	return new OpenAIApi(openaiConfig);
};

export default class GiltViewProvider implements vscode.WebviewViewProvider {
    private webView?: vscode.WebviewView;
    private credentials?: any;
    private openai?: any;
    private previousChat:Array<any> = [];
    private message?: any;
    private ac: AbortController = new AbortController();
    private overviewId: number = 0;

    constructor(private context: vscode.ExtensionContext) { }

    private getAssistantPrompts(queryType: string): string {
        switch (queryType) {
            case "askGptOverview":
                return `This code `;
            case "askGptQuery":
                return `In this code, `;
            case "askGptApi":
                return `- `;
            case "askGptConcept":
                return `Here are 3 domain concepts that might be useful to know.\n\n1. `;
            case "askGptUsage":
                return `Here is a code example.\n`;
            default:
                return "";
        }
    }
    
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
    ) {
        this.webView = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri]
        };

        webviewView.webview.html = this.getHtml(webviewView.webview);

        
        webviewView.webview.onDidReceiveMessage(data => {
            if (['askGPTfromTab', 'askGptApi', 'askGptConcept', 'askGptUsage'].includes(data.type) ) {
                this.ac = new AbortController();
                this.sendRequest(data, this.ac);
            }
            else if (data.type === 'clearChat') {
                this.previousChat = [];
            }
            else if (data.type === 'stopQuery') {
                this.ac.abort();
            }
            else if (data.type === 'refreshQuery') {

            }
            else if (data.type === "embedComment") {
                console.log(data);
                this.embedComment(data);
            }
            else if (data.type === "reaskGpt") {
                console.log(data);
                this.ac = new AbortController();
                this.reaskGpt(data, this.ac);
            }
        });
    }

    public async setUpConnection() {
        this.credentials = await initAuth(this.context);
        this.openai = initOpenAI(this.credentials);
        console.log("set up connection");
        vscode.commands.executeCommand(
            telemetry.commands.logTelemetry.name,
            new telemetry.LoggerEntry(
              "GPT.setupConnection",
              "GPT connection is set up",
            )
        );
    };
    private capitalizeFirstLetter(str: string) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    };

    private lowerFirstLetter(str:string) {
        return str.charAt(0).toLowerCase() + str.slice(1);
    }

    // https://www.npmjs.com/package/indent-string
    private indentString(string, count = 1, indent = ' ') {
            
        if (typeof string !== 'string') {
            throw new TypeError(
                `Expected \`input\` to be a \`string\`, got \`${typeof string}\``
            );
        }
    
        if (typeof count !== 'number') {
            throw new TypeError(
                `Expected \`count\` to be a \`number\`, got \`${typeof count}\``
            );
        }
    
        if (count < 0) {
            throw new RangeError(
                `Expected \`count\` to be at least 0, got \`${count}\``
            );
        }
    
        if (typeof indent !== 'string') {
            throw new TypeError(
                `Expected \`options.indent\` to be a \`string\`, got \`${typeof indent}\``
            );
        }
    
        if (count === 0) {
            return string;
        }
    
        const regex = /^(?!\s*$)/gm;
    
        return string.replace(regex, indent.repeat(count));
    }

    private formatComment(comment: string, n: number=79){
        let arr = comment?.split(' ');
        let result: Array<string> = [];
        let subStr = arr[0];
        console.log(arr);
        for(let i = 1; i < arr.length; i++){
            let word = arr[i];
            if(subStr.length + word.length + 1 <= n){
                subStr = subStr + ' ' + word;
            }
            else{
                result.push(subStr);
                subStr = word;
            }
        }
        if(subStr.length){
            result.push(subStr);
        }
        return result;
    }

    public async embedComment(comment: any) {
        const editor = vscode.window.activeTextEditor;

		if (!editor) {
			return;
		}

        // https://github.com/microsoft/vscode-comment/blob/master/extension.ts
        var selection = editor.selection;
        var startLine = selection.start.line - 1;
        var textToInsert = comment.value;
        
        var lastCharIndex = editor.document.lineAt(startLine).text.length;
        var pos:vscode.Position;

        if ((lastCharIndex > 0) && (startLine !== 0)) {
            pos = new vscode.Position(startLine, lastCharIndex);
            textToInsert = '\n' + textToInsert; 
        }
        else {
            pos = new vscode.Position(startLine, 0);
        }
        textToInsert = `\n"""[LLM: ${comment.commentType.split("-")[0]}]\n`;

        if (!comment.commentType.includes("usage")) {

            let responseLines = comment.value.split("\n");
            responseLines.forEach((value, index) => {
                textToInsert += this.formatComment(value).join("\n") + "\n"; 	
            });
            textToInsert += `"""\n`;
        }

        else {
            textToInsert += comment.value;
            textToInsert += `"""\n`;
        }

        var line:string = editor.document.lineAt(selection.start.line).text;
        var firstNonWhiteSpace :number = editor.document.lineAt(selection.start.line).firstNonWhitespaceCharacterIndex;

        var stringToIndent: string = '';
        for (var i = 0; i < firstNonWhiteSpace; i++) {
            if (line.charAt(i) === '\t') {
                stringToIndent = stringToIndent + '\t';
            }
            else if (line.charAt(i) === ' ') {
                stringToIndent = stringToIndent + ' ';
            }
        }					
        textToInsert = this.indentString(textToInsert, 1, stringToIndent);

        vscode.commands.executeCommand(
            telemetry.commands.logTelemetry.name,
            new telemetry.LoggerEntry(
              "GPT.embed",
              "Embedding GPT generated response: %s, %s:%s",
              [comment.value, pos.line, pos.character]
            )
        );

		editor.edit((editBuilder) => {
            editBuilder.insert(pos, textToInsert);
		});
    }


    private getPrompts(selectedText: string, queryType: string, nlPrompt?: string, queryWithCode: boolean=false) {
        let prompt = "";
        

        if (queryType === "askGptOverview") {
            prompt = `Provide a single-sentence summary of the following code:
            ${selectedText}
            `;
        }
        else if (queryType === "askGptQuery" && queryWithCode) {
            prompt = `In the context of the following code, ${nlPrompt}: 
                ${selectedText}`; 
        }
        else if (queryType === "askGptQuery" && !queryWithCode) {
            prompt = `${nlPrompt}`;   
        }
        else {
            const apisMatches = selectedText.match(/\.[\w|\.]+\(/g);
            let preApis = apisMatches?.map(s => s.slice(1,-1));
            let apis: Array<string> = [];
            if (preApis) {
                for (var api of preApis) {
                    let apiParts = api.split(".");
                    if (apiParts.length > 0) {
                        apis.push(apiParts.slice(-1)[0]);
                    }
                }

            }
            
            if (queryType === "askGptApi") {    
                prompt = `Explain the following code:
                ${selectedText}
                `;
            }
            else if (queryType === "askGptConcept") { 
                prompt = `Explain domain-specific concepts that are needed to understand the following code:
                ${selectedText}
                Please do not explain libraries or API functions but only focus on domain concepts`;
            }
            else if (queryType === "askGptUsage") {
                prompt = `Please provide a code example, mainly showing the usage of API calls in the following code:
                ${selectedText}
                `;
            }
        }
        return prompt;
    }

    public async sendRequest(data, abortController?: AbortController) {
        if (!abortController) {
            abortController = new AbortController();
        }

        if (data.type === 'askGPTfromTab') {
            await this.sendApiRequestWithCode("", "askGptQuery", abortController, "", data.queryId, data.value);
        }
        else if (data.type === 'askGptOverview') {
            await this.sendApiRequestWithCode(data.code, data.type, abortController);
        }
        else if (['askGptApi', 'askGptConcept', 'askGptUsage'].includes(data.type) ) {
            await this.sendApiRequestWithCode(data.code, data.type, abortController, data.overviewRef, data.queryId); 
            }
        
    }

    private generateChatPrompt(selectedText: string, queryType: string, fileName: string, overviewRef?: string, nlPrompt?: string, queryWithCode: boolean=false, fullFileContent?: string) : Array<any> {
        
        let prompt = "";
        let assistantPrompt = this.getAssistantPrompts(queryType);

        if (queryType === "askGptQuery" && fullFileContent) {
            prompt = this.getPrompts(fullFileContent, queryType, nlPrompt, true);
        }
        else if (queryType === "askGptQuery" && queryWithCode) {
            prompt = this.getPrompts(selectedText, queryType, nlPrompt, true);
        }
        
        else {
            prompt = this.getPrompts(selectedText, queryType, nlPrompt);
        }
        
        let chatPrompt = [
            {
                "role": "system",
                "content": `You are a helpful assitant for a developer.`
            } 

        ];
        if (["askGptApi", "askGptConcept", "askGptUsage"].includes(queryType) && overviewRef) {
            let overviewPrompt = this.getPrompts(selectedText, "askGptOverview");
            chatPrompt.push({
                "role": "user",
                "content": overviewPrompt
            });
            chatPrompt.push({
                "role": "assistant",
                "content": overviewRef
            });
        }
        else if (queryType === "askGptQuery") {
            if (this.previousChat.length >= 2 && !queryWithCode && nlPrompt) {
                chatPrompt = this.previousChat.slice(-3);
                prompt = nlPrompt;
                assistantPrompt = "";
            }
        }
        chatPrompt.push({
                "role": "user",
                "content": prompt
            });
        chatPrompt.push({
                "role": "assistant",
                "content": assistantPrompt
            });
        

        vscode.commands.executeCommand(
            telemetry.commands.logTelemetry.name,
            new telemetry.LoggerEntry(
            "GPT.promt",
            "GPT prompt generated. Code: %s, promt: %s, promptType: %s",
            [selectedText, chatPrompt.map(msg => `${msg.role}::: ${msg.content}`).join(':::::'), queryType]
            )
        );
        if (queryType === "askGptOverview") {
            this.sendMessage({ type: 'addCodeQuestion', 
                            code: selectedText, 
                            filename: fileName, 
                            codeHtml: Marked.parse("```\n"+selectedText+"\n```"),
                            overviewId: this.overviewId,
                            prompt: chatPrompt.map(msg => `${msg.role}::: ${msg.content}`).join(':::::')});
        }
        else if (queryType === "askGptQuery"){
            if (queryWithCode && !fullFileContent) {
                this.sendMessage({ type: 'addNLQuestion', 
                                value: nlPrompt, 
                                code: selectedText, 
                                addHLine: true,
                                overviewId: this.overviewId,
                                codeHtml: Marked.parse("```\n"+selectedText+"\n```"),
                                prompt: chatPrompt.map(msg => `${msg.role}::: ${msg.content}`).join(':::::')});
            }
            else if (this.previousChat.length >= 2 && !queryWithCode) {
                this.sendMessage({ type: 'addNLQuestion', 
                                value: nlPrompt,
                                addHLine: false,
                                overviewId: this.overviewId,
                                prompt: chatPrompt.map(msg => `${msg.role}::: ${msg.content}`).join(':::::')});
            }
            else {
                this.sendMessage({ type: 'addNLQuestion', 
                                value: nlPrompt,
                                addHLine: true,
                                overviewId: this.overviewId,
                                prompt: chatPrompt.map(msg => `${msg.role}::: ${msg.content}`).join(':::::')});
            }
        }
        
        return [chatPrompt, prompt, assistantPrompt];

    }
    
    public async reaskGpt(data: any, abortController: AbortController) {
        let chatPrompt = data.prompt.split(":::::").map(str => {
            let [role, content] = str.split("::: ");
            return { role, content };
        });
        console.log(chatPrompt);
        vscode.commands.executeCommand(
            telemetry.commands.logTelemetry.name,
            new telemetry.LoggerEntry(
            "GPT.reaskGpt",
            "GPT refresh. promt: %s, promptType: %s",
            [chatPrompt.map(msg => `${msg.role}::: ${msg.content}`).join(':::::'), data.queryType]
            )
        );

        let output = await this.queryGpt(chatPrompt, this.getAssistantPrompts("askGpt" + this.capitalizeFirstLetter(data.queryType)), abortController);
        this.sendMessage({ type: 'redoQuery', 
                            overviewId: data.overviewId,
                            queryId: data.refreshId,
                            queryType: data.queryType,
                            value: output, 
                            valueHtml: Marked.parse(output)});
        
    }

    public async sendApiRequestWithCode(selectedText: string, queryType: string, abortController: AbortController, overviewRef?: string, queryId?: string, nlPrompt?: string) {
        const editor = vscode.window.activeTextEditor;
        let fileName = "";
        
        if (!editor) {
			return;
		}

        let editorSelectedText = editor.document.getText(editor.selection); 
        let fullFileContent = "";
        fileName = editor.document.fileName;
        

        if (queryType === "askGptQuery") {
            if (editorSelectedText) {
                selectedText = editorSelectedText;
            }
            else {
                fullFileContent = editor.document.getText();
            }
        }

        if (!this.webView) {
            await vscode.commands.executeCommand('gilt-vscode-plugin.view.focus');
        }
        else {
            this.webView?.show?.(true);
        }
        
        let chatPrompt: any[] = [];
        let prompt: string = "";
        let assistantPrompt: string = "";
        if (queryType === "askGptOverview" || queryType === "askGptQuery") {
            this.overviewId += 1;
        }

        if (queryType === "askGptQuery" && fullFileContent.length > 0 && this.previousChat.length < 2)  {
            console.log(this.previousChat);
            [chatPrompt, prompt, assistantPrompt] =  this.generateChatPrompt(selectedText, queryType, fileName, overviewRef, nlPrompt, true, fullFileContent);
        }
        else if (queryType === "askGptQuery" && fullFileContent.length > 0 && this.previousChat.length >= 2) {

            [chatPrompt, prompt, assistantPrompt] =  this.generateChatPrompt(selectedText, queryType, fileName, overviewRef, nlPrompt, false);
        }
        else {
            [chatPrompt, prompt, assistantPrompt] =  this.generateChatPrompt(selectedText, queryType, fileName, overviewRef, nlPrompt, true);
        }
        console.log(chatPrompt);
        
        let output = await this.queryGpt(chatPrompt, assistantPrompt, abortController, queryType === "askGptQuery");
        
        if (queryType === "askGptOverview") {
            this.sendMessage({ type: 'addOverview', 
                                value: output, 
                                overviewId: this.overviewId,
                                valueHtml: Marked.parse(output)});
            this.previousChat = [
                {
                    "role": "system",
                    "content": `You are a helpful assitant for a developer.`
                },
                {
                    "role": "user",
                    "content": prompt
                },
                {
                    "role": "assistant",
                    "content": output
                }
            ];
        }
        else if (queryType === "askGptQuery") {
            let detailType = queryType.replace("askGpt", "").toLowerCase();
            this.sendMessage({ type: 'addDetail', value: output, queryId: this.overviewId, detailType: detailType, valueHtml: Marked.parse(output)});
        }
        else {
            let detailType = queryType.replace("askGpt", "").toLowerCase();
            this.sendMessage({ type: 'addDetail', value: output, queryId: queryId, detailType: detailType, valueHtml: Marked.parse(output)});
        }
        if (queryType === "askGptQuery") {
            if (editorSelectedText) {
                this.previousChat = [
                    {
                        "role": "system",
                        "content": `You are a helpful assitant for a developer.`
                    },
                ];
            }
            this.previousChat.push({
                "role": "user",
                "content": prompt
            });
            this.previousChat.push({
                "role": "assistant",
                "content": output
            });
        }
    }

    public async queryGpt(chatPrompt: Array<any>, assistantPrompt: string, abortConteroller: AbortController, isQuery: boolean=false) {
        if (!this.openai) {
            await this.setUpConnection();
        }
 
        try { 
            vscode.commands.executeCommand(
                telemetry.commands.logTelemetry.name,
                new telemetry.LoggerEntry(
                "GPT.sendQuery",
                "GPT sending query request: %s",
                [chatPrompt.map(msg => `${msg.role}::: ${msg.content}`).join(':::::')]
                )
            );
            let payload = createChatPayload('chat', chatPrompt);
            console.log(payload);
            let { isValid, reason } = validateChatPayload(payload);

			if (!isValid) {
				vscode.window.showErrorMessage(reason);
			};

			const response = await this.openai.createChatCompletion({ ...payload }, { timeout: 60000, signal: abortConteroller.signal });
            console.log(response);


            let output = "";
            if (isQuery) {
                output = response.data.choices[0].message?.content.trim();
            }
            else {
                output = assistantPrompt + this.lowerFirstLetter(response.data.choices[0].message?.content.trim());
            }

			if(response.data.usage?.total_tokens && response.data.usage?.total_tokens >= payload.max_tokens) {
				vscode.window.showErrorMessage(`The completion was ${response.data.usage?.total_tokens} tokens and exceeds your max_token value of ${payload.max_tokens}. Please increase your settings to allow for longer completions.`);
			}
    
            vscode.commands.executeCommand(
                telemetry.commands.logTelemetry.name,
                new telemetry.LoggerEntry(
                "GPT.response",
                "GPT Response: %s, number of tokens: %s",
                [output, response.data.usage?.total_tokens]
                )
            ); 
            return output; 
        } catch (error: any) {
            if (error?.message === "canceled") {
                console.log("Request aborted");
		        this.sendMessage({ type: 'stopProgress', });
                vscode.commands.executeCommand(
                    telemetry.commands.logTelemetry.name,
                    new telemetry.LoggerEntry(
                    "GPT.cancelled",
                    "Chat prompt: %s, error: %s",
                    [chatPrompt.map(msg => `${msg.role}::: ${msg.content}`).join(':::::'), error?.message]
                    )
                ); 
                await vscode.window.showErrorMessage("Request aborted");
                return "";
            }
            else if (error?.message.includes("timeout")) {
                console.log("Request Timeout");
		        this.sendMessage({ type: 'stopProgress', });
                vscode.commands.executeCommand(
                    telemetry.commands.logTelemetry.name,
                    new telemetry.LoggerEntry(
                    "GPT.timeout",
                    "Chat prompt: %s, error: %s",
                    [chatPrompt.map(msg => `${msg.role}::: ${msg.content}`).join(':::::'), error?.message]
                    )
                ); 
                await vscode.window.showErrorMessage("Request timeout. Please try out again.");
                return "";
            }
            else {
                console.log(error?.name);
		        this.sendMessage({ type: 'stopProgress', });
                vscode.commands.executeCommand(
                    telemetry.commands.logTelemetry.name,
                    new telemetry.LoggerEntry(
                    "GPT.error",
                    "Chat prompt: %s, error: %s",
                    [chatPrompt.map(msg => `${msg.role}::: ${msg.content}`).join(':::::'), error?.message]
                    )
                ); 
                await vscode.window.showErrorMessage("Error sending request to AI", error?.message);
                return "";
            }
        }
    };
    

    public sendMessage(message: any) {
        if (this.webView) {
            console.log(message);
            this.webView?.webview.postMessage(message);
        } else {
            this.message = message;
        }
    }

    private getHtml(webview: vscode.Webview) {

        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'main.js'));
        const stylesMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'main.css'));
        const stylesHighlightUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', 'highlight.js', 'styles', 'github-dark.css'));
        const mainHTML = `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${stylesHighlightUri}" rel="stylesheet">
				<link href="${stylesMainUri}" rel="stylesheet">
				<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
				<script src="https://cdn.tailwindcss.com"></script>
			</head>
			<body class="overflow-hidden">
				<div class="flex flex-col h-screen">
                    <div class="flex">
                        <button style="background: var(--vscode-button-background); margin-left: auto;" id="clear-button" class="mr-2 mt-4 mb-4 pl-1 pr-1">Clear all</button>
                        <button style="background: var(--vscode-button-background); color: var(--vscode-errorForeground); font-weight: bolder;" id="stop-button" class="mr-2 mr-4 mt-4 mb-4 pl-1 pr-1">&#9633; </button>
                    </div>
					<div class="flex-1 overflow-y-auto" id="qa-list"></div>
					<div id="in-progress" class="p-4 flex items-center hidden">
                        <div style="text-align: center;">
                            <div>Please wait while AI answers your question.</div>
                            <div class="loader"></div>
                        </div>
					</div>
                    <div class="p-4 flex items-center">
                    <div class="flex-1">
                        <textarea
                            type="text"
                            rows="2"
                            class="border p-2 w-full"
                            id="question-input"
                            placeholder="Ask a question..."
                        ></textarea>
                    </div>
                    <button style="background: var(--vscode-button-background)" id="ask-button" class="p-2 ml-5">Ask</button>
                </div>
				</div>
				<script src="${scriptUri}"></script>
			</body>
			</html>`;
        
        return mainHTML;
    }
}
