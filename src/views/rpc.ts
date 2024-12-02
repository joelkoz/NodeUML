import * as vscode from 'vscode';
import { WVPMessageClient, PLRPCCall, PLRPCResult } from '../messageBus';
import { getNonce } from '../utils';

/**
 * A class for handling RPC calls from the web view panel to the extension
 * code.  This hosts the implementations of the RPC.
 */
export class RPCServer {
    private wvpMessageClient: WVPMessageClient;

    constructor(panel: vscode.WebviewPanel) {
        this.wvpMessageClient = new WVPMessageClient(panel);

        this.wvpMessageClient.subscribe('rpcCall', (payload) => this.onRpcCall(payload));
    }

    private onRpcCall(payload: PLRPCCall) {
        const { fnName, params, rpcNonce } = payload;
        this.executeFunction(fnName, params).then((result) => {
            this.wvpMessageClient.publish('rpcResult', { rpcNonce, result });
        });
    }


    private async executeFunction(fnName: string, params: any): Promise<any> {
        const method = (this as any)[fnName];
        if (typeof method === 'function') {
            return await method.call(this, params);
        }
        throw new Error(`Function ${fnName} not implemented.`);
    }

    dispose() {
        this.wvpMessageClient.dispose();
    }    
}


/**
 * A class for making RPC calls into the Webview Panel and receiving responses.
 */
export class RPCClient {
    private rpcCallbacks: Map<string, (result: any) => void>;
    private wvpMessageClient: WVPMessageClient;

    constructor(panel: vscode.WebviewPanel) {
        this.rpcCallbacks = new Map<string, (result: any) => void>();
        this.wvpMessageClient = new WVPMessageClient(panel);

        this.wvpMessageClient.subscribe('rpcResult', (payload) => this.onRpcResult(payload));
    }


    private onRpcResult(payload: PLRPCResult) {
        const { rpcNonce, result } = payload;
        const callback = this.rpcCallbacks.get(rpcNonce);
        if (callback) {
            callback(result);
            this.rpcCallbacks.delete(rpcNonce);
        }
    }

    public async call(fnName: string, params: any = {}): Promise<any> {
        const rpcNonce = getNonce();
        this.wvpMessageClient.publish('rpcCall', { fnName, params, rpcNonce });        
        return new Promise((resolve) => {
            this.rpcCallbacks.set(rpcNonce, resolve);
        });
    }

    dispose() {
        this.wvpMessageClient.dispose();
    }    
}
