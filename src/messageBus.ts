import * as vscode from 'vscode';
import { MetaElementNode, ClassNode } from './metaModel';
import { ProjectDocument } from './projectDocument';

// Complex message payloads have "PL" prefix
export interface PLClassId {
    classId: string;
}


export interface PLRPCCall {
    fnName: string;
    params: any; // Allow any type for parameters
    rpcNonce: string;
};

export interface PLRPCResult {
    rpcNonce: string;
    result: any;
};



export interface PLMetaModelChange {
    projectId: string;
    element: MetaElementNode;
    opts: any;
}

export interface PLUndoRedo {
    doc: ProjectDocument;
    undo: boolean;
};


/**
 * A map of message names and payload types that can be sent to either
 * the extension or the diagram editor Webview Panel.
 */
interface ICommonMessages {
    "rpcCall": PLRPCCall;
    "rpcResult": PLRPCResult;
}


/**
 * A map of message names and payload types that can be sent only
 * to other extension code
 */
interface IExtensionMessages extends ICommonMessages {
    "onRemoveMeta": PLMetaModelChange;
    "onCreateMeta": PLMetaModelChange;
    "onUpdateMeta": PLMetaModelChange;
    "onUndoRedo": PLUndoRedo;
}


export interface PLWVDiagramDirty {
    cellId: any | undefined;
};


export interface PLCreateNewMeta {
    jsonMeta: {
        _type: string; // The meta nodeType (e.g. "UMLClass")
        name: string | undefined;
        [key: string]: any
    }
    opts: {
        parentMetaId: string | undefined;
        stereotypeName: string | undefined;
        pos: {
            x: number;
            y: number;
        }
    }
};


export interface PLUpdateMetaProperties {
    metaId: string;
    updates: {
        propName: string;
        value: any;
    }[]
};


export interface PLWVMetaModelChange {
    jsonMeta: any;
    opts: any;
}

export interface PLWVAddToDiagram {
    metaId: string;
    opts: any;
}


export interface PLWVUndoRedo {
    label: string;
    op: string,
    opts: any;
}


/**
 * A map of message names and payload types that can be sent only
 * to the diagram editor Webview Panel
 */
interface IWebviewMessages extends ICommonMessages {   
   "onDiagramEditorReady": Boolean; 
   "onDiagramDirty": PLWVDiagramDirty;
   "cmdRestoreDiagram": any;
   "cmdCreateNewMeta": PLCreateNewMeta;
   "cmdUpdateMetaProperties": PLUpdateMetaProperties;
   "onCreateMeta": PLWVMetaModelChange;
   "onUpdateMeta": PLWVMetaModelChange;
   "onRemoveMeta": string;
   "cmdRemoveMeta": string;
   "cmdAddUndoRedo": PLWVUndoRedo;
   "onUndo": PLWVUndoRedo;
   "onRedo": PLWVUndoRedo;
   "onRemoveShape": string;
   "cmdAddToDiagram": PLWVAddToDiagram;
}


// A "discriminated union" data type used to type check
// messages published and subscribed to on the extension
// side
type TExtensionMessage = {
    [K in keyof IExtensionMessages]: {
        name: K;
        payload: IExtensionMessages[K];
    }
}[keyof IExtensionMessages];


// A "discriminated union" data type used to type check
// messages published and subscribed to on the webview
// side
type TWebviewMessage = {
    [K in keyof IWebviewMessages]: {
        name: K;
        payload: IWebviewMessages[K];
    }
}[keyof IWebviewMessages];


// An EventEmitter used to communicate between extension code
// modules
const messageBus = new vscode.EventEmitter<TExtensionMessage>();

/**
 * A message client for intercommunication between various views in the extension.
 * It utilizes the EventEmitter messageBus from this module.
 */
export class MessageClient {
    private disposables: vscode.Disposable[] = [];        

    /**
     * Subscribe to a message with a specific name.
     * @param messageName The name of the message to listen for.
     * @param callback The callback function to call when the message is received.
     */
    subscribe<K extends keyof IExtensionMessages>(messageName: K, callback: (payload: IExtensionMessages[K]) => void) {
        const listener = messageBus.event((message) => {
            if (message.name === messageName) {
                callback(message.payload as IExtensionMessages[K]);
            }
        });
        this.disposables.push(listener);
    }

    /**
     * Publish a message to all subscribers.
     * @param messageName The name of the message.
     * @param data The data payload to send.
     */
    publish<K extends keyof IExtensionMessages>(messageName: K, payload: IExtensionMessages[K]) {
        const message =  { name: messageName, payload } as TExtensionMessage;
        messageBus.fire(message);
    }

    /**
     * Dispose all registered listeners.
     */
    dispose() {
        // Clean up all registered disposables
        this.disposables.forEach((disposable) => disposable.dispose());
        this.disposables = [];  // Prevent re-disposing
    }    
}

/**
 * A message client for intercommunication between extension components and 
 * web view panels. It communicates via the webview postMessage() and
 * onDidReceiveMessage() API methods.
 */
export class WVPMessageClient {
    private disposables: vscode.Disposable[] = [];
    private panel: vscode.WebviewPanel;

    constructor(panel: vscode.WebviewPanel) {
        this.panel = panel;
    }

    /**
     * Subscribe to a message with a specific name.
     * @param messageName The name of the message to listen for.
     * @param callback The callback function to call when the message is received.
     */
    subscribe<K extends keyof IWebviewMessages>(messageName: K, callback: (payload: IWebviewMessages[K]) => void) {
        const listener = this.panel.webview.onDidReceiveMessage((message: TWebviewMessage) => {
            if (message.name === messageName) {
                callback(message.payload as IWebviewMessages[K]);
            }
        });
        this.disposables.push(listener);
    }


    /**
     * Publish a message to the web panel
     * @param messageName The name of the message.
     * @param data The data payload to send.
     */
    publish<K extends keyof IWebviewMessages>(messageName: K, payload: IWebviewMessages[K]) {
        const message = { name: messageName, payload } as TWebviewMessage;     
        this.panel.webview.postMessage(message);
    }


    /**
     * Dispose all registered listeners.
     */
    dispose() {
        // Clean up all registered disposables
        this.disposables.forEach((disposable) => disposable.dispose());
        this.disposables = [];  // Prevent re-disposing
    }    
}