import * as vscode from 'vscode';
import { openProjects, ProjectDocument } from '../projectDocument';
import { DiagramEditor } from './diagramEditor';

export class DiagramEditorProvider implements vscode.CustomEditorProvider<ProjectDocument> {

    private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<ProjectDocument>>();
    public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

    constructor(private context: vscode.ExtensionContext) {}

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new DiagramEditorProvider(context);
        return vscode.window.registerCustomEditorProvider(
            'nodeuml.umlDiagramEditor',
            provider,
            {
                webviewOptions: { retainContextWhenHidden: true },
                supportsMultipleEditorsPerDocument: false
            }
        );
    }


    public notifyDocumentEditEvent(document: ProjectDocument) {
        this._onDidChangeCustomDocument.fire({
            document: document,
            undo: () => document.undo(),
            redo: () => document.redo(),
            label: document.lastCommandLabel()
        });
    }


    public async openCustomDocument(
        uri: vscode.Uri,
        openContext: vscode.CustomDocumentOpenContext,
        token: vscode.CancellationToken
    ): Promise<ProjectDocument> {
        const document = await openProjects.load(uri, this);
        return document;
    }


    public async resolveCustomEditor(
        document: ProjectDocument,
        webviewPanel: vscode.WebviewPanel,
        token: vscode.CancellationToken
    ): Promise<void> {
        const editor = new DiagramEditor(
            this.context,
            webviewPanel,
            document
        );

        // Keep the openProjects singleton up to date
        openProjects.addEditor(webviewPanel, editor);

        webviewPanel.onDidDispose(() => {
            openProjects.removeEditor(webviewPanel);
        });        

        // If you need to notify the provider of changes from the editor, you can pass callbacks.
        // For example, if the editor makes a change not from the document’s perspective:
        // editor.onDidChangeSomething(() => {
        //     this._onDidChangeCustomDocument.fire({...});
        // });

        // No need to do anything else here unless you need special logic per editor instance.
    }

    public async saveCustomDocument(
        document: ProjectDocument,
        cancellation: vscode.CancellationToken
    ): Promise<void> {
        await document.save(cancellation);
    }

    public async saveCustomDocumentAs(
        document: ProjectDocument,
        targetResource: vscode.Uri,
        cancellation: vscode.CancellationToken
    ): Promise<void> {
        await document.saveAs(targetResource, cancellation);
    }

    public async revertCustomDocument(
        document: ProjectDocument,
        cancellation: vscode.CancellationToken
    ): Promise<void> {
        await document.revert();
        // No direct UI manipulation here. Each open DiagramEditor should listen to doc changes.
    }

    public async backupCustomDocument(
        document: ProjectDocument,
        context: vscode.CustomDocumentBackupContext,
        cancellation: vscode.CancellationToken
    ): Promise<vscode.CustomDocumentBackup> {
        return document.backup(context, cancellation);
    }
}
