// @ts-nocheck

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
    const vscode = acquireVsCodeApi();
    const list = document.getElementById("qa-list");
    let collapseId = 0;
    let curQueryList = document.getElementById("qa-list");
    let detailId = 0;

    // Handle messages sent from the extension to the webview

    let detailButtonHandler = function (e, buttonType) {
        e.preventDefault();
        e.stopPropagation();
        console.log(e.target.id);
        let overviewId = e.target.id.split("-").slice(-1)[0];
        console.log(`button-overviewId: ${overviewId}`);
        let inputApi = document.getElementById(`code-input-${overviewId}`);
        let fileName = document.getElementById(`filename-${overviewId}`);
        let overviewRef = document.getElementById(`overview-${overviewId}`);
        console.log(overviewRef);
        console.log(`[Usage button]: ${inputApi.value}`);
        document.getElementById("in-progress")?.classList?.remove("hidden");
        if (inputApi.value?.length > 0) {
            vscode.postMessage({
                type: buttonType,
                code: inputApi.value,
                filename: fileName.value,
                queryId: overviewId,
                overviewRef: overviewRef.value
            });
        }
    };

    let commentHandler = function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log(e.target.id);
        let commentId = e.target.id.replace("-comment", "");
        console.log(commentId);
        let commentToEmbed = document.getElementById(commentId);
        console.log(`[Embed comments]: ${commentToEmbed.value}`);
        if (commentToEmbed.value?.length > 0) {
            vscode.postMessage({
                type: "embedComment",
                value: commentToEmbed.value,
                commentType: commentId
            });
        }
    };

    
    let refreshHandler = function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log(e.target.id);
        let promptId = e.target.id.replace("refresh", "prompt");
        let overviewId = promptId.split("-").slice(-1)[0];
        let prompt = document.getElementById(promptId);
        let queryType = (e.target.id.split("-")[0]);
        let refreshId = "";

        if (queryType === "overview") {
            refreshId = `collapse-overview-${overviewId}`;
        }
        else if (queryType === "query") {
            refreshId = `collapse-${overviewId}`;
        }
        console.log(promptId);
        console.log(refreshId);
        console.log(`[refresh]: ${prompt.value}`);
        document.getElementById("in-progress")?.classList?.remove("hidden");
        if (prompt.value?.length > 0) {
            vscode.postMessage({
                type: "reaskGpt",
                queryType: queryType,
                overviewId: overviewId,
                refreshId: refreshId,
                prompt: prompt.value,
                commentType: e.target.id.replace("-refresh", "")
            });
        }
    };

    let collapseHandler = function(e) {
        e.preventDefault();
        e.stopPropagation();
        let curCollapseId = e.target.id.split("-").slice(-1)[0];
        console.log(`collapse-${curCollapseId}`);
        let itemToCollapse = document.getElementById(`collapse-${curCollapseId}`);
        let collapseButton = document.getElementById(`collapse-button-${curCollapseId}`);
        if (itemToCollapse.classList.contains("hidden")) {
            console.log("show");
            itemToCollapse.classList.remove("hidden");
            collapseButton.innerHTML = "&and;";
        }
        else {
            console.log("hide");
            itemToCollapse.classList.add("hidden");
            collapseButton.innerHTML = "&or;";
        }
    };

    let collapseOverviewHandler = function(e) {
        e.preventDefault();
        e.stopPropagation();
 
        let curCollapseId = e.target.id.split("-").slice(-1)[0];
        console.log(`collapse-overview-${curCollapseId}`);
        let itemToCollapse = document.getElementById(`collapse-overview-${curCollapseId}`);
        let collapseButton = document.getElementById(`collapse-overview-button-${curCollapseId}`);
        
        if (itemToCollapse.classList.contains("hidden")) {
            console.log("show");
            itemToCollapse.classList.remove("hidden");
            collapseButton.innerHTML = "&and;";
        }
        else {
            console.log("hide");
            itemToCollapse.classList.add("hidden");
            collapseButton.innerHTML = "&or;";
        }
    };

    window.addEventListener("message", (event) => {
        const message = event.data;
        console.log(message);
        switch (message.type) {
            case "stopProgress":
                console.log("stopProgress");
                document.getElementById("in-progress")?.classList?.add("hidden");
                break;
            case "addNLQuestion":
                console.log("addNLQuestion");
                
                let nlcodeHtml = "";
                if (message.code) {
                    nlcodeHtml = message.codeHtml;
                }
                
                let nlHtml = message.value;
                let processedPrompt = message.prompt.replace(/"/g, '&quot;');
                let hline = message.addHLine ? "<hr/>" : "";
                list.insertAdjacentHTML( 'beforeend', 
                    `<br/><div class="p-1 self-end">
                        ${hline}<br/>
                        <div class="font-bold mb-2 flex">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-2"><path stroke-linecap="round" stroke-linejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            You: Query
                            <button style="background: var(--vscode-button-background);" id="query-refresh-${message.overviewId}" class="ml-2 pl-1 pr-1">&#8635;</button>
                        </div>
                        <div>${nlHtml}</div>
                        ${nlcodeHtml}
                        <input type="hidden" id="query-prompt-${message.overviewId}" value="${processedPrompt}" />
                        <div id="query-div-${message.overviewId}"></div>
                    </div>`);
                document.getElementById("in-progress")?.classList?.remove("hidden");
                list.scrollTo(0, list.scrollHeight);
                document.getElementById(`query-refresh-${message.overviewId}`)?.addEventListener("click", function(e){refreshHandler(e, `query-prompt-${message.overviewId}`);});
                break;
            case "addCodeQuestion":
                console.log("addCodeQuestion");
                const codeHtml = message.codeHtml;
                let processedCode = message.code.replace(/"/g, '&quot;');
                let processedCodePrompt = message.prompt.replace(/"/g, '&quot;');
                list.insertAdjacentHTML( 'beforeend', 
                    `<br/><div class="p-1 self-end">
                        <hr><br/>
                        <div class="font-bold mb-2 flex">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-2"><path stroke-linecap="round" stroke-linejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            You
                            <button style="background: var(--vscode-button-background);" id="overview-refresh-${message.overviewId}" class="ml-2 pl-1 pr-1">&#8635;</button>
                        </div>
                        <div>${codeHtml}</div>
                        <input type="hidden" id="code-input-${message.overviewId}" value="${processedCode}" />
                        <input type="hidden" id="filename-${message.overviewId}" value="${message.filename}" />
                        <input type="hidden" id="overview-prompt-${message.overviewId}" value="${processedCodePrompt}" />
                        <div id="code-div-${message.overviewId}"></div>
                    </div>
                    `);
                document.getElementById("in-progress")?.classList?.remove("hidden");
                list.scrollTo(0, list.scrollHeight);
                document.getElementById(`overview-refresh-${message.overviewId}`)?.addEventListener("click", function(e){refreshHandler(e, `overview-prompt-${message.overviewId}`);});
                break; 
            
            case "addOverview":
                document.getElementById("in-progress")?.classList?.add("hidden");
                curQueryList = document.getElementById(`code-div-${message.overviewId}`);
                curQueryList.insertAdjacentHTML( 'beforeend', 
                       `<div class="p-1 self-end">
                        <div class="font-bold mb-2 mt-4 flex">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-2"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" /></svg>
                            <span>AI: Overview</span>
                            <span id="overview-comment-${message.overviewId}" class="w-18 h-5 mr-2 pl-1 pr-1" style="margin-left: auto; background-color: var(--vscode-button-background);">Embed</span>
                            <span id="collapse-overview-button-${message.overviewId}" class="w-4 h-5" >&and;</span>
                        </div>
                        <div id="collapse-overview-${message.overviewId}" class="ml-2 mr-4">
                            <div class="p-2 m-1" style="background: var(--vscode-editor-selectionBackground);">${message.valueHtml}</div>
                            <input type="hidden" id="overview-${message.overviewId}" value="${message.value.replace(/"/g, '&quot;')}" />
                            <div class="font-bold flex p-2 m-1" style="justify-content: flex-end; border: 1px solid grey; border-radius: 8px;">
                                <span style="margin-right: auto;">Explain more about</span>
                                <button style="background: var(--vscode-button-background)" id="api-button-${message.overviewId}" class="pl-1 pr-1 mr-3">API</button>
                                <button style="background: var(--vscode-button-background)" id="concept-button-${message.overviewId}" class="pl-1 pr-1 mr-3">Concept</button>
                                <button style="background: var(--vscode-button-background)" id="usage-button-${message.overviewId}" class="pl-1 pr-1">Usage</button>
                            </div>   
                        </div>
                    </div>    
                    `);
                list.scrollTo(0, list.scrollHeight);
                console.log(`overview-${message.overviewId}`);
                document.getElementById(`collapse-overview-button-${message.overviewId}`)?.addEventListener("click", (e) => {collapseOverviewHandler(e); }, false);
                document.getElementById(`overview-comment-${message.overviewId}`)?.addEventListener("click", function(e){commentHandler(e, `overview-${message.overviewId}`);});
                document.getElementById(`api-button-${message.overviewId}`).addEventListener("click", function(e){detailButtonHandler(e, "askGptApi"); console.log(`askApi: ${message.overviewId}`);}); 
                document.getElementById(`usage-button-${message.overviewId}`).addEventListener("click", function(e){detailButtonHandler(e, "askGptUsage"); console.log(`askApi: ${message.overviewId}`);}); 
                document.getElementById(`concept-button-${message.overviewId}`).addEventListener("click", function(e){detailButtonHandler(e, "askGptConcept"); console.log(`askApi: ${message.overviewId}`);});
                break;
            case "addDetail":
                document.getElementById("in-progress")?.classList?.add("hidden");
                
                if (message.detailType === "query") {
                    curQueryList = document.getElementById(`query-div-${message.queryId}`);
                    curQueryList.insertAdjacentHTML( 'beforeend', 
                        `<div class="p-1 self-end ml-2" style="background: var()">
                            <div class="font-bold mb-1 flex">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke-width="1.5" stroke="currentColor" viewBox="0 0 24 24" class="w-5 h-5 mr-1"><path stroke-linecap="round" stroke-linejoin="round" d="m12.707 7.293-1.414 1.414L15.586 13H7V4H5v11h10.586l-4.293 4.293 1.414 1.414L19.414 14l-6.707-6.707z"></path></svg>
                                <span>${message.detailType}</span>
                                <span id="${message.detailType}-comment-${message.queryId}" class="w-18 h-5 mr-2 pl-1 pr-1" style="margin-left: auto; background-color: var(--vscode-button-background);">Embed</span>
                                <span id="collapse-overview-button-${message.queryId}" class="w-4 h-5">&and;</span>
                            </div>
                            <div id="collapse-overview-${message.queryId}">
                            <div class="mr-2">${message.valueHtml}</div>
                            <input type="hidden" id="${message.detailType}-${message.queryId}" value="${message.value.replace(/"/g, '&quot;')}" />
                            </div>
                        </div>
                        `);
                    document.getElementById(`collapse-overview-button-${message.queryId}`)?.addEventListener("click", (e) => {collapseHandler(e); }, false);
                    document.getElementById(`${message.detailType}-comment-${message.queryId}`)?.addEventListener("click", (e) => { commentHandler(e); }, false);
                }
                else {
                    curQueryList = document.getElementById(`collapse-overview-${message.queryId}`);
                    curQueryList.insertAdjacentHTML( 'beforeend', 
                        `<div class="p-1 self-end ml-2" style="background: var()">
                            <div class="font-bold mb-1 flex">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke-width="1.5" stroke="currentColor" viewBox="0 0 24 24" class="w-5 h-5 mr-1"><path stroke-linecap="round" stroke-linejoin="round" d="m12.707 7.293-1.414 1.414L15.586 13H7V4H5v11h10.586l-4.293 4.293 1.414 1.414L19.414 14l-6.707-6.707z"></path></svg>
                                <span>${message.detailType}</span>
                                <span id="${message.detailType}-comment-${detailId}" class="w-18 h-5 mr-2 pl-1 pr-1" style="margin-left: auto; background-color: var(--vscode-button-background);">Embed</span>
                                <span id="collapse-button-${collapseId}" class="w-4 h-5">&and;</span>
                            </div>
                            <div id="collapse-${collapseId}">
                            <div class="mr-2">${message.valueHtml}</div>
                            <input type="hidden" id="${message.detailType}-${detailId}" value="${message.value.replace(/"/g, '&quot;')}" />
                            </div>
                        </div>
                        `);
                    document.getElementById(`collapse-button-${collapseId}`)?.addEventListener("click", (e) => {collapseHandler(e); }, false);
                    document.getElementById(`${message.detailType}-comment-${detailId}`)?.addEventListener("click", (e) => { commentHandler(e); }, false);
                    detailId += 1;
                    collapseId += 1;
                }
                

                
                list.scrollTo(0, list.scrollHeight);

                break;
            case "redoQuery":
                document.getElementById("in-progress")?.classList?.add("hidden");
                let divToReplace =  document.getElementById(`collapse-overview-${message.overviewId}`);
                console.log(divToReplace);
                let replaceOverviewId = message.queryId.split("-").slice(-1)[0];
                if (message.queryType === "overview") {
                    divToReplace.innerHTML = `<div class="p-2 m-1" style="background: var(--vscode-editor-selectionBackground);">${message.valueHtml}</div>
                            <input type="hidden" id="overview-${replaceOverviewId}" value="${message.value.replace(/"/g, '&quot;')}" />
                            <div class="font-bold flex p-2 m-1" style="justify-content: flex-end; border: 1px solid grey; border-radius: 8px;">
                                <span style="margin-right: auto;">Explain more about</span>
                                <button style="background: var(--vscode-button-background)" id="api-button-${replaceOverviewId}" class="pl-1 pr-1 mr-3">API</button>
                                <button style="background: var(--vscode-button-background)" id="concept-button-${replaceOverviewId}" class="pl-1 pr-1 mr-3">Concept</button>
                                <button style="background: var(--vscode-button-background)" id="usage-button-${replaceOverviewId}" class="pl-1 pr-1">Usage</button>
                            </div>`;
                    document.getElementById(`overview-comment-${replaceOverviewId}`)?.addEventListener("click", function(e){commentHandler(e, `overview-${replaceOverviewId}`);});
                    document.getElementById(`api-button-${replaceOverviewId}`).addEventListener("click", function(e){detailButtonHandler(e, "askGptApi"); console.log(`askApi: ${replaceOverviewId}`);}); 
                    document.getElementById(`usage-button-${replaceOverviewId}`).addEventListener("click", function(e){detailButtonHandler(e, "askGptUsage"); console.log(`askApi: ${replaceOverviewId}`);}); 
                    document.getElementById(`concept-button-${replaceOverviewId}`).addEventListener("click", function(e){detailButtonHandler(e, "askGptConcept"); console.log(`askApi: ${replaceOverviewId}`);});
                }
                else if (message.queryType === "query") {
                    if (divToReplace) {
                        divToReplace.innerHTML = `<div class="mr-2">${message.valueHtml}</div>
                            <input type="hidden" id="${message.queryType}-${replaceOverviewId}" value="${message.value.replace(/"/g, '&quot;')}" />`;
                    } 
                    else {
                        curQueryList = document.getElementById(`query-div-${replaceOverviewId}`);
                        curQueryList.insertAdjacentHTML( 'beforeend', 
                            `<div class="p-1 self-end ml-2" style="background: var()">
                                <div class="font-bold mb-1 flex">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke-width="1.5" stroke="currentColor" viewBox="0 0 24 24" class="w-5 h-5 mr-1"><path stroke-linecap="round" stroke-linejoin="round" d="m12.707 7.293-1.414 1.414L15.586 13H7V4H5v11h10.586l-4.293 4.293 1.414 1.414L19.414 14l-6.707-6.707z"></path></svg>
                                    <span>${message.queryType}</span>
                                    <span id="${message.queryType}-comment-${replaceOverviewId}" class="w-18 h-5 mr-2 pl-1 pr-1" style="margin-left: auto; background-color: var(--vscode-button-background);">Embed</span>
                                    <span id="collapse-overview-button-${replaceOverviewId}" class="w-4 h-5">&and;</span>
                                </div>
                                <div id="collapse-overview-${replaceOverviewId}">
                                <div class="mr-2">${message.valueHtml}</div>
                                <input type="hidden" id="${message.queryType}-${replaceOverviewId}" value="${message.value.replace(/"/g, '&quot;')}" />
                                </div>
                            </div>
                            `);
                        document.getElementById(`collapse-overview-button-${replaceOverviewId}`)?.addEventListener("click", (e) => {collapseHandler(e); }, false);
                        document.getElementById(`${message.detailType}-comment-${replaceOverviewId}`)?.addEventListener("click", (e) => { commentHandler(e); }, false);
                    }
                }

            
            default:
                break;
        }
    });
    // Only ran once in the beginning
    let submitHandler = function (e) {
        e.preventDefault();
        e.stopPropagation();
        const input = document.getElementById("question-input");
        console.log(input);
        if (input.value?.length > 0) {
            vscode.postMessage({
                type: "askGPTfromTab",
                value: input.value
            });

            input.value = "";
        }
    };
    document.getElementById("clear-button")?.addEventListener("click", () => {
        list.innerHTML = "";
        vscode.postMessage({ type: "clearChat", });
    });
    
    document.getElementById("stop-button")?.addEventListener("click", () => {
        vscode.postMessage({ type: "stopQuery", });
    });
    document.getElementById("ask-button")?.addEventListener("click", submitHandler);
    document.getElementById("question-input")?.addEventListener("keydown", function (e) {
        console.log(e.key);
        if (e.key === "Enter" && !e.shiftKey) {
            submitHandler(e);
        }
    });

    

})();
