/**
 * Handles communication between the VS Code extension and the webview.
 */

import { graph } from './diagramEditor.js';

export class VSCMessageClient {
    constructor(vscode) {
        this.vscode = vscode; // Save vscode reference
        this.listeners = [];
    }

    /**
     * Subscribe to a message with a specific name.
     * Sets up a listener for this message and adds it to the listeners array for cleanup.
     * @param {string} messageName - The name of the message to listen for.
     * @param {Function} callback - The callback function to execute when the message is received.
     */
    subscribe(messageName, callback) {
        const listener = (event) => {
            const message = event.data;
            // Filter messages by name to call the correct callback
            if (message && message.name === messageName) {          
                callback(message.payload);
            }
        };

        // Add to the listeners array for later disposal
        this.listeners.push(listener);

        // Register the listener for "message" events from the VSCode extension
        window.addEventListener("message", listener);
    }

    /**
     * Publish a message to the extension.
     * @param {string} messageName - The name of the message.
     * @param {any} payload - The data payload to send.
     */
    publish(messageName, payload) {
        this.vscode.postMessage({ name: messageName, payload });
    }

    /**
     * Dispose of all registered listeners.
     * This removes each listener from the window and clears the listeners array.
     */
    dispose() {
        this.listeners.forEach((listener) => {
            window.removeEventListener("message", listener);
        });
        this.listeners = []; // Clear all references
    }
}

// Usage example:
// const client = new VSCMessageClient(vscode);
// client.subscribe("myMessage", (data) => console.log("Received:", data));
// client.publish("myMessage", { foo: "bar" });


/**
 * A class for handling RPC calls from the extension code into this webview
 * This hosts the implementations of the RPC.
 */
export class RPCServer {
    constructor(vscode) {
        this.vscMessageClient = new VSCMessageClient(vscode);

        this.vscMessageClient.subscribe('rpcCall', (payload) => this.onRpcCall(payload));
    }

    onRpcCall(payload) {
        const { fnName, params, rpcNonce } = payload;
        this.executeFunction(fnName, params).then((result) => {
            this.vscMessageClient.publish('rpcResult', { rpcNonce, result });
        });
    }


    async executeFunction(fnName, params) {
        const method = this[fnName];
        if (typeof method === 'function') {
            return await method.call(this, params);
        }
        throw new Error(`Function ${fnName} not implemented.`);
    }

    dispose() {
        this.vscMessageClient.dispose();
    }
}


/**
 * A class for handling RPC calls from this webview into the extension code
 */
export class RPCClient {
    constructor(vscode) {
        this.rpcCallbacks = new Map();
        this.vscMessageClient = new VSCMessageClient(vscode);

        this.vscMessageClient.subscribe('rpcResult', (payload) => this.onRpcResult(payload));
    }

    
    onRpcResult(payload) {
        const { rpcNonce, result } = payload;
        const callback = this.rpcCallbacks.get(rpcNonce);
        if (callback) {
            callback(result);
            this.rpcCallbacks.delete(rpcNonce);
        }
    }

    async call(fnName, params = {}) {
        const rpcNonce = Math.random().toString(36).substring(7);
        this.vscMessageClient.publish('rpcCall', { fnName, params, rpcNonce });
        return new Promise((resolve) => {
            this.rpcCallbacks.set(rpcNonce, resolve);
        });
    }

    dispose() {
        this.vscMessageClient.dispose();
    }
}


export const vscode = acquireVsCodeApi();
export const msgClient = new VSCMessageClient(vscode);
export const rpcClient = new RPCClient(vscode);

export class RPCServerDiagramPanel extends RPCServer {
    constructor(vscode) {
       super(vscode);
    }
 
    getDiagramJson() {
        return graph.toJSON();
    }
 }
 export const rpcServer = new RPCServerDiagramPanel(vscode);
 