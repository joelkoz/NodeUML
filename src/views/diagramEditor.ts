import * as vscode from 'vscode';
import { MessageClient, WVPMessageClient, PLUpdateMetaProperty,PLUpdateMetaProperties, PLWVDiagramDirty, PLMetaModelChange, PLCreateNewMeta } from '../messageBus';
import * as meta from '../metaModel';
import { ProjectDocument, openProjects } from '../projectDocument';
import { RPCServer, RPCClient } from './rpc';
import { getNonce } from '../utils';
import { open } from 'fs';

class RPCServerDiagram extends RPCServer {
    private diagramEditor: DiagramEditor;
    constructor(diagramEditor: DiagramEditor) {
        super(diagramEditor.panel!);
        this.diagramEditor = diagramEditor;
    }

    findMetaNode(id: string) {
        if (this.diagramEditor.project) {
            const node = this.diagramEditor.project.findById(id);
            return node;
        }

        return null;
    }

    gatherAll(nodeType: string) {
        if (this.diagramEditor.project) {
            const result = this.diagramEditor.project.gatherAll(nodeType);
            return result;
        }
        return [];
    }
}


export class DiagramEditor implements vscode.CustomEditorProvider<ProjectDocument> {
    public panel: vscode.WebviewPanel | null = null;
    private context: vscode.ExtensionContext;
    private msgClient: MessageClient | null;
    private rpcServer: RPCServerDiagram | null;
    private rpcClient: RPCClient | null;
    private wvpMsgClient: WVPMessageClient | null;
    private _projectDocument: ProjectDocument | null = null;

    private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentContentChangeEvent<ProjectDocument>>();
    public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.wvpMsgClient = null;
        this.rpcServer = null;
        this.rpcClient = null;
        this.msgClient = null;
    }

    get project(): meta.ProjectNode | null {
        return this.projectDocument?.project || null;
    }

    get projectDocument(): ProjectDocument | null {
        if (this._projectDocument) {
            return this._projectDocument;
        }
        return null;
    }

    get currentDiagram(): meta.ClassDiagramNode | undefined {
        return this.project?.model.diagram;
    }

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new DiagramEditor(context);
        return vscode.window.registerCustomEditorProvider(
            'nodeuml.umlDiagramEditor',  // Custom editor ID, update if needed
            provider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true
                },
                supportsMultipleEditorsPerDocument: false
            }
        );
    }

    public async openCustomDocument(
        uri: vscode.Uri,
        openContext: vscode.CustomDocumentOpenContext,
        token: vscode.CancellationToken
    ): Promise<ProjectDocument> {
        const document = await openProjects.load(uri);
        return document;
    }

    public async resolveCustomEditor(
        document: ProjectDocument,
        webviewPanel: vscode.WebviewPanel,
        token: vscode.CancellationToken
    ): Promise<void> {
        this.panel = webviewPanel;
        this.panel.webview.options = { enableScripts: true };
        this._projectDocument = document;
    
        if (!token.isCancellationRequested) {
            this.panel.webview.html = this.getEditorHtml();
            // Initialize your messaging clients and RPC servers
            this.msgClient = new MessageClient();
            this.wvpMsgClient = new WVPMessageClient(this.panel);
            this.rpcClient = new RPCClient(this.panel);
            this.rpcServer = new RPCServerDiagram(this);
    
            this.setupEventSubscriptions();
            this.trackDocumentChanges();

            // Listen for when the panel is disposed
            this.panel.onDidDispose(() => {
                this.dispose();
            });            
        }
    }


    private setupEventSubscriptions(): void {
        // Restore the diagram data whenever the editor Javascript is reloaded 
        // (i.e. the initial load, and after change in view state)
        this.wvpMsgClient!.subscribe('diagramEditorReady', (payload) => {
            console.log('DiagramEditor: panel sent diagramEditorReady - restoring diagram graph...');
            const shapeData = this.project?.model.diagram?.graph || { cells: [] };
            this.wvpMsgClient!.publish('restoreDiagram', shapeData);
            vscode.commands.executeCommand('nodeuml.refreshModel');    
        });

        // Dispose listener to clean up when the editor is closed
        this.panel!.onDidDispose(() => {
            console.log('DiagramEditor: Disposing editor for project ' + this._projectDocument?.uri.path);
            openProjects.remove(this._projectDocument);
        });

        // Blacklist the node types that should not be sent to the diagram whenever they
        // are added to the model via the Model Tree Viewer
        const blacklistTypes = [ 'UMLModel', 'UMLPackage', 'UMLStereotype', 'UMLDataType' ];

        this.msgClient!.subscribe('createMeta', (payload: PLMetaModelChange) => {
            // Forward new classes made to our project to the diagram editor. Use the meta model's
            // toJSON() to replace circular references with $ref nodes.
            if (payload.projectId === this.project?._id && !blacklistTypes.includes(payload.element._type)) {
                const dereference = ['UMLClass', 'UMLAttribute', 'UMLOperation'].includes(payload.element._type);
                this.wvpMsgClient?.publish('createMeta', { jsonMeta: payload.element.toJSON(dereference), opts: payload.opts });
            }
        }); 

        this.msgClient!.subscribe('updateMeta', (payload: PLMetaModelChange) => {
            // Forward updated classes 
            if (payload.projectId === this.project?._id && !blacklistTypes.includes(payload.element._type)) {
                const dereference = ['UMLClass', 'UMLAttribute', 'UMLOperation'].includes(payload.element._type);
                this.wvpMsgClient?.publish('updateMeta', { jsonMeta: payload.element.toJSON(dereference), opts: payload.opts });
            }
        }); 

        this.msgClient!.subscribe('removeMeta', (payload: PLMetaModelChange) => {
            if (payload.projectId === this.project?._id && !blacklistTypes.includes(payload.element._type)) {
                if (payload.element?._parent instanceof meta.MetaElementNode && payload.element?._parent?._type === 'UMLClass') {
                    // A class' child was removed - just update the class (if necessary)
                    this.wvpMsgClient?.publish('updateMeta', { jsonMeta: payload.element.toJSON(false), opts: payload.opts });
                    this.projectDocument!.markDirty();
                }
                else {
                    this.wvpMsgClient?.publish('removeMeta', payload.element._id);
                }
            }
        }); 

        this.msgClient!.subscribe('updateMetaProp', (payload: PLUpdateMetaProperty) => {
            if (payload.projectId === this.project?._id && !blacklistTypes.includes(payload.element._type)) {
                const dereference = ['UMLClass', 'UMLAttribute', 'UMLOperation'].includes(payload.element._type);
                this.wvpMsgClient?.publish('updateMeta', { jsonMeta: payload.element.toJSON(dereference), opts: {} });
                this.projectDocument!.markDirty();  
            }
        }); 


        // Messages from the diagram editor webview
        this.wvpMsgClient!.subscribe('createNewMeta', (payload: PLCreateNewMeta) => {
            console.log(`DiagramEditor: Create new meta element: ${payload.jsonMeta._type}`);
            vscode.commands.executeCommand('nodeuml.createNewMeta', payload);
        });

        this.wvpMsgClient!.subscribe('updateMetaProperties', (payload: PLUpdateMetaProperties) => {
            console.log(`DiagramEditor: Update meta properties on meta Id : ${payload.metaId}`);
            vscode.commands.executeCommand('nodeuml.updateMetaProperties', payload);
        });

        this.wvpMsgClient!.subscribe('removeRequest', (metaId: string) => {
            console.log(`DiagramEditor wants to remove meta id ${metaId}`);
            vscode.commands.executeCommand('nodeuml.removeById', metaId);
        });


        this.wvpMsgClient!.subscribe('diagramDirty', (payload: PLWVDiagramDirty) => {
            console.log('DiagramEditor: panel sent diagramDirty - updating diagram graph...');
            this.updateDiagramNode().then(() => {
               this.projectDocument!.markDirty(); 
            });
        });

        // Listen to changes in the ProjectDocument
        this._projectDocument!.onDidChange(() => {
            console.log("DiagramEditor: Detected ProjectDocument change for dirty state");
            this._onDidChangeCustomDocument.fire({
                document: this._projectDocument!
            });
        });   
    }


    private trackDocumentChanges(): void {
        
        vscode.workspace.onDidSaveTextDocument(savedDoc => {
            if (savedDoc.uri.toString() === this.projectDocument!.uri.toString()) {
                this.projectDocument!.project.isDirty = false;
            }
        });  
    }


    public async saveCustomDocument(
        document: vscode.CustomDocument,
        cancellation: vscode.CancellationToken
    ): Promise<void> {
        await this.projectDocument!.save(cancellation);
    }

    public async saveCustomDocumentAs(
        document: ProjectDocument,
        targetResource: vscode.Uri,
        cancellation: vscode.CancellationToken
    ): Promise<void> {
        await document.saveAs(targetResource, cancellation);
    }

    public async revertCustomDocument(
        document: vscode.CustomDocument,
        cancellation: vscode.CancellationToken
    ): Promise<void> {
        await this.projectDocument!.revert();
        this.wvpMsgClient?.publish('restoreDiagram', this.currentDiagram?.graph || { cells: [] });
    }    


    public async backupCustomDocument(
        document: ProjectDocument,
        context: vscode.CustomDocumentBackupContext,
        cancellation: vscode.CancellationToken
    ): Promise<vscode.CustomDocumentBackup> {
        const jsonContent = JSON.stringify(document.project.toJSON(), null, 2);
        const fileData = Buffer.from(jsonContent, 'utf8');
        await vscode.workspace.fs.writeFile(context.destination, fileData);
        return {
            id: context.destination.toString(),
            delete: () => vscode.workspace.fs.delete(context.destination),
        };
    }

    /**
     * Makes sure that the current diagram has the latest graph JSON from the editor
     */
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
        this.panel = null;
    }


    private getEditorHtml(): string {
        const nonce = getNonce();

        const webview = this.panel!.webview;

        const mediaUri = vscode.Uri.joinPath(this.context.extensionUri, 'media');
        const jointUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, 'joint.js'));
        const swalUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, 'sweetalert2.all.min.js'));
        const awesompleteUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, 'awesomplete.min.js'));

        const umlUri = vscode.Uri.joinPath(this.context.extensionUri, 'src/views/uml');
        const messageBusUri = webview.asWebviewUri(vscode.Uri.joinPath(umlUri, 'messageBus.js'));
        const diagramShapesUri = webview.asWebviewUri(vscode.Uri.joinPath(umlUri, 'diagramShapes.js'));
        const diagramToolsUri = webview.asWebviewUri(vscode.Uri.joinPath(umlUri, 'diagramTools.js'));
        const diagramEditorUri = webview.asWebviewUri(vscode.Uri.joinPath(umlUri, 'diagramEditor.js'));
        const jsCommandPaletteUri = webview.asWebviewUri(vscode.Uri.joinPath(umlUri, 'commandPalette.js'));
        const cssCommandPaletteUri = webview.asWebviewUri(vscode.Uri.joinPath(umlUri, 'commandPalette.css'));
        const cssSwalUri = webview.asWebviewUri(vscode.Uri.joinPath(umlUri, 'sweet.css'));

        const jsAttributeEditorUri = webview.asWebviewUri(vscode.Uri.joinPath(umlUri, 'attributeEditor.js'));
        const cssAttributeEditorUri = webview.asWebviewUri(vscode.Uri.joinPath(umlUri, 'attributeEditor.css'));
        const jsOperationEditorUri = webview.asWebviewUri(vscode.Uri.joinPath(umlUri, 'operationEditor.js'));
        const jsPusherToolsUri = webview.asWebviewUri(vscode.Uri.joinPath(umlUri, 'pusherTools.js'));

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
                    overflow: hidden; /* Prevent scrolling the entire page */
                }

                #scroll-container {
                    width: 100%;
                    height: 100%; /* Full viewport size */
                    overflow: auto; /* Enable scrolling */
                    position: relative; /* Ensure scroll-container positions properly */
                }

                #paper {
                    width: 3000px; /* Fixed size for your paper */
                    height: 3000px;
                    position: relative; /* Required for JointJS positioning */
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
            <script src="${jsCommandPaletteUri}" nonce="${nonce}"></script>
            <script src="${jsAttributeEditorUri}" nonce="${nonce}"></script>           
            <script src="${jsOperationEditorUri}" nonce="${nonce}"></script>           
            <script src="${jsPusherToolsUri}" nonce="${nonce}"></script>           
            <script src="${diagramShapesUri}" nonce="${nonce}"></script>        
            <script src="${diagramToolsUri}" nonce="${nonce}"></script>        
            <script src="${messageBusUri}" nonce="${nonce}"></script>   
            <script src="${diagramEditorUri}" nonce="${nonce}"></script>        
        </body>
        </html>
        `;
    }
}
