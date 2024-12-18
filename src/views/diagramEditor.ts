import * as vscode from 'vscode';
import { MessageClient, WVPMessageClient, PLUpdateMetaProperties, PLWVDiagramDirty, PLMetaModelChange, PLCreateNewMeta, PLWVUndoRedo } from '../messageBus';
import * as meta from '../metaModel';
import { ProjectDocument } from '../projectDocument';
import { RPCServer, RPCClient } from './rpc';
import { getNonce } from '../utils';
import * as cmd from '../commands/commands';

class RPCServerDiagram extends RPCServer {
    private diagramEditor: DiagramEditor;
    constructor(diagramEditor: DiagramEditor) {
        super(diagramEditor.panel!);
        this.diagramEditor = diagramEditor;
    }

    findMetaNode(id: string) {
        return this.diagramEditor.project?.findById(id) || null;
    }

    gatherAll(nodeType: string) {
        return this.diagramEditor.project?.gatherAll(nodeType) || [];
    }
}


export class DiagramEditor {
    public panel: vscode.WebviewPanel;
    private context: vscode.ExtensionContext;
    private msgClient: MessageClient | null;
    private rpcServer: RPCServerDiagram | null;
    private rpcClient: RPCClient | null;
    private wvpMsgClient: WVPMessageClient | null;
    private _projectDocument: ProjectDocument;

    constructor(
        context: vscode.ExtensionContext,
        panel: vscode.WebviewPanel,
        document: ProjectDocument
    ) {
        this.context = context;
        this.panel = panel;
        this._projectDocument = document;

        this.panel.webview.options = { enableScripts: true };
        this.msgClient = new MessageClient();
        this.wvpMsgClient = new WVPMessageClient(this.panel);
        this.rpcClient = new RPCClient(this.panel);
        this.rpcServer = new RPCServerDiagram(this);

        this.panel.webview.html = this.getEditorHtml();

        this.setupEventSubscriptions();

        this.panel.onDidDispose(() => {
            this.dispose();
        });
    }

    get project(): meta.ProjectNode | null {
        return this._projectDocument.project || null;
    }

    get currentDiagram(): meta.ClassDiagramNode | undefined {
        return this.project?.model.diagram;
    }

    private setupEventSubscriptions(): void {
        // Similar subscriptions as before...
        this.wvpMsgClient!.subscribe('onDiagramEditorReady', (payload) => {
            console.log('DiagramEditor: panel sent onDiagramEditorReady - restoring diagram graph...');
            const shapeData = this.project?.model.diagram?.graph || { cells: [] };
            this.wvpMsgClient!.publish('cmdRestoreDiagram', shapeData);
            vscode.commands.executeCommand('nodeuml.refreshModel');    
        });

        this.panel!.onDidDispose(() => {
            console.log('DiagramEditor: Disposing editor for project ' + this._projectDocument?.uri.path);
        });

        const blacklistTypes = [ 'UMLModel', 'UMLPackage', 'UMLStereotype', 'UMLDataType' ];
        this.msgClient!.subscribe('onCreateMeta', (payload: PLMetaModelChange) => {
            if (payload.projectId === this.project?._id && !blacklistTypes.includes(payload.element._type)) {
                const dereference = ['UMLClass', 'UMLAttribute', 'UMLOperation'].includes(payload.element._type);
                this.wvpMsgClient?.publish('onCreateMeta', { jsonMeta: payload.element.toJSON(dereference), opts: payload.opts });
            }
        }); 

        this.msgClient!.subscribe('onUpdateMeta', (payload: PLMetaModelChange) => {
            if (payload.projectId === this.project?._id && !blacklistTypes.includes(payload.element._type)) {
                const dereference = ['UMLClass', 'UMLAttribute', 'UMLOperation'].includes(payload.element._type);
                this.wvpMsgClient?.publish('onUpdateMeta', { jsonMeta: payload.element.toJSON(dereference), opts: payload.opts });
            }
        }); 

        this.msgClient!.subscribe('onRemoveMeta', (payload: PLMetaModelChange) => {
            if (payload.projectId === this.project?._id && !blacklistTypes.includes(payload.element._type)) {
                if (payload.element?._parent instanceof meta.MetaElementNode && payload.element?._parent?._type === 'UMLClass') {
                    this.wvpMsgClient?.publish('onUpdateMeta', { jsonMeta: payload.element.toJSON(false), opts: payload.opts });
                }
                else {
                    this.wvpMsgClient?.publish('onRemoveMeta', payload.element._id);
                }
            }
        }); 

        this.wvpMsgClient!.subscribe('cmdCreateNewMeta', (payload: PLCreateNewMeta) => {
            vscode.commands.executeCommand('nodeuml.createNewMeta', payload);
        });

        this.wvpMsgClient!.subscribe('cmdUpdateMetaProperties', (payload: PLUpdateMetaProperties) => {
            vscode.commands.executeCommand('nodeuml.updateMetaProperties', payload);
        });

        this.wvpMsgClient!.subscribe('cmdRemoveMeta', (metaId: string) => {
            vscode.commands.executeCommand('nodeuml.removeById', metaId);
        });

        this.wvpMsgClient!.subscribe('onDiagramDirty', (payload: PLWVDiagramDirty) => {
            console.log('DiagramEditor: panel sent onDiagramDirty - updating diagram graph...');
            this.updateDiagramNode().then(() => {
            });
        });

        this.wvpMsgClient!.subscribe('cmdAddUndoRedo', (payload: PLWVUndoRedo) => {
            console.log('DiagramEditor: panel sent cmdAddUndoRedo');
            this._projectDocument.exec(new cmd.DiagramUndoRedo(this, payload));
        });
    }

    public diagramUndo(payload: PLWVUndoRedo): void {
        this.wvpMsgClient?.publish('onUndo', payload);
    }

    public diagramRedo(payload: PLWVUndoRedo): void {
        this.wvpMsgClient?.publish('onRedo', payload);
    }


    public async updateDiagramNode() {
        console.log('DiagramEditor: updateDiagramNode()...');
        if (this.currentDiagram) {
            console.log('DiagramEditor: Updating diagram.graph with JointJS json...');
            const json = await this.rpcClient!.call('getDiagramJson');
            this.currentDiagram.graph = json;
        }
    }

    public close() {
        if (this.panel) {
            this.rpcClient?.dispose();
            this.rpcServer?.dispose();
            this.msgClient?.dispose();
            this.wvpMsgClient?.dispose();
        }
        this.rpcClient = null;
        this.rpcServer = null;
        this.msgClient = null;
        this.wvpMsgClient = null;
    }

    public dispose() {
        this.close();
        if (this.panel) {
            this.panel.dispose();
        }
    }

    private getEditorHtml(): string {
        const nonce = getNonce();
        const webview = this.panel!.webview;

        const mediaUri = vscode.Uri.joinPath(this.context.extensionUri, 'media');
        const jointUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, 'joint.min.js'));
        const swalUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, 'sweetalert2.all.min.js'));
        const awesompleteUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, 'awesomplete.min.js'));

        const umlUri = vscode.Uri.joinPath(this.context.extensionUri, 'src/views/uml');
        const diagramEditorUri = webview.asWebviewUri(vscode.Uri.joinPath(umlUri, 'diagramEditor.js'));
        const cssCommandPaletteUri = webview.asWebviewUri(vscode.Uri.joinPath(umlUri, 'commandPalette.css'));
        const cssSwalUri = webview.asWebviewUri(vscode.Uri.joinPath(umlUri, 'sweet.css'));
        const cssAttributeEditorUri = webview.asWebviewUri(vscode.Uri.joinPath(umlUri, 'attributeEditor.css'));

        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta
                http-equiv="Content-Security-Policy"
                content="default-src 'none'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource} data:; script-src 'nonce-${nonce}' ${webview.cspSource}; style-src 'self' ${webview.cspSource} 'unsafe-inline';">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>UML Diagram Editor</title>
            <style>
                html, body {
                    width: 100%;
                    height: 100%;
                    margin: 0;
                    padding: 0;
                    overflow: hidden;
                }
                #scroll-container {
                    width: 100%;
                    height: 100%;
                    overflow: auto;
                    position: relative;
                }
                #paper {
                    width: 3000px;
                    height: 3000px;
                    position: relative;
                    margin: 0;
                    padding: 0;
                }
            </style>
            <link rel="stylesheet" href="${cssSwalUri}">
            <script src="${swalUri}" nonce="${nonce}"></script>
            <link rel="stylesheet" type="text/css" href="${cssCommandPaletteUri}">
            <link rel="stylesheet" type="text/css" href="${cssAttributeEditorUri}">
        </head>
        <body>
            <div id="uml-toolbox"></div>         
            <div id="scroll-container">
                <div id="paper"></div>
            </div>
    
            <script src="${jointUri}" nonce="${nonce}"></script>
            <script nonce="${nonce}">
                if (typeof joint === 'undefined' || typeof joint.dia === 'undefined') {
                    console.error("JointJS library failed to load!");
                } else {
                    console.log("JointJS library loaded successfully.");
                }
            </script>
            <script src="${awesompleteUri}" nonce="${nonce}"></script>
            <script type="module" nonce="${nonce}">
                import '${diagramEditorUri}';
            </script>
        </body>
        </html>
        `;
    }
}
