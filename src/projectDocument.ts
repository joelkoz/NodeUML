import * as vscode from 'vscode';
import { ProjectNode, AbstractNode } from './metaModel';
import { MessageClient } from './messageBus';
import { CommandManager, ICommand } from './commands/commandManager';
import { DiagramEditorProvider } from './views/diagramEditorProvider';
import { DiagramEditor } from './views/diagramEditor';

class OpenProjects {

    private readonly _projects: Map<string, ProjectDocument> = new Map();
    private readonly _editors: Map<vscode.WebviewPanel, DiagramEditor> = new Map();

    private messageClient: MessageClient = new MessageClient();

    /**
     * Retuns the ProjectNode of whichever project is associated with the active edtior. If
     * a UML Diagram editor is not open or is not the active editing tab, this will
     * return null
     */
    get currentProject(): ProjectNode | null {
        return this.currentProjectDoc?.project || null;
    }


    public getActiveEditor(): DiagramEditor | null {
        const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
        if (activeTab?.input instanceof vscode.TabInputCustom && activeTab.input.viewType === 'nodeuml.umlDiagramEditor') {
            for (const [panel, editor] of this._editors) {
                // There can only be one active tab at a time. If we know that the active tab is one of our
                // UML diagram editors (which is true based on above checks), then if we search thru our
                // webview panels and find the one panel that is active, then THAT is THE one and only
                // active editor instance.
                if (panel.viewColumn !== undefined && panel.active) {
                    return editor; 
                }
            }
        }
        return null;
    }

    /**
     * Retuns the ProjectDocument of whichever project is associated with the active edtior. If
     * a UML Diagram editor is not open or is not the active editing tab, this will
     * return null
     */
    get currentProjectDoc(): ProjectDocument | null {
        const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
        if (activeTab?.input instanceof vscode.TabInputCustom && activeTab.input.viewType === 'nodeuml.umlDiagramEditor') {
            const activeUri = activeTab.input.uri;
            return this._projects.get(activeUri.path) || null;
        }
        return null;
    }

    findNodeById(id: string): AbstractNode | undefined {
        return this.currentProject?.findById(id);
    }

     get(projectPath: string): ProjectDocument | undefined {
        return this._projects.get(projectPath);
    }


    async load(uri: vscode.Uri, diagramEditorProvider: DiagramEditorProvider): Promise<ProjectDocument> {
        let doc = await ProjectDocument.loadFile(uri, diagramEditorProvider);
        this._projects.set(uri.path, doc);
        return doc;
    }


    async remove(doc: ProjectDocument | null) {
        if (doc) {
            this._projects.delete(doc.uri.path);
        }    
    }

    public addEditor(panel: vscode.WebviewPanel, editor: DiagramEditor): void {
        this._editors.set(panel, editor);
    }
    
    public removeEditor(panel: vscode.WebviewPanel): void {
        this._editors.delete(panel);
    }
}

export const openProjects = new OpenProjects();


export class ProjectDocument implements vscode.CustomDocument {
    private _uri: vscode.Uri;
    private _projectNode: ProjectNode | null;
    private _diagramEditorProvider: DiagramEditorProvider;
    private commandManager: CommandManager;
    private msgClient: MessageClient;
    

    private constructor(uri: vscode.Uri, diagramEditorProvider: DiagramEditorProvider) {
        this._uri = uri;
        this._projectNode = null;
        this._diagramEditorProvider = diagramEditorProvider;
        this.commandManager = new CommandManager(this);
        this.msgClient = new MessageClient();
    }

    get uri(): vscode.Uri {
        return this._uri;
    }

    get project(): ProjectNode {
        return this._projectNode!;
    }

    get diagramEditorProvider(): DiagramEditorProvider {
        return this._diagramEditorProvider;
    }

    public lastCommandLabel(): string {
        return this.commandManager!.lastCommandLabel();
    }

    public exec(command: ICommand): void {
        this.commandManager!.executeCommand(command);
        this._diagramEditorProvider.notifyDocumentEditEvent(this);
    }

    public undo(): void {
        this.commandManager!.undo();
        this.msgClient.publish("onUndoRedo", { doc: this, undo: true });
    }


    public redo(): void {
        this.commandManager!.redo();
        this.msgClient.publish("onUndoRedo", { doc: this, undo: false });
    }


    // Load data from disk into ProjectNode (called initially or in revert)
    private async loadFromDisk(): Promise<void> {
        const documentData = await vscode.workspace.fs.readFile(this._uri);
        const jsonData = JSON.parse(documentData.toString());
        this._projectNode = ProjectNode.fromJSON(jsonData);
        this._projectNode.documentUri = this._uri;
        this.commandManager.clear();
    }

    public static async loadFile(uri: vscode.Uri, diagramEditorProvider: DiagramEditorProvider): Promise<ProjectDocument> {
        const document = new ProjectDocument(uri, diagramEditorProvider);
        await document.loadFromDisk(); // Ensure loaded before returning
        return document;
    }

    // Save current ProjectNode data to disk
    public async save(cancellation?: vscode.CancellationToken): Promise<void> {
        console.log(`ProjectDocument: Saving project ${this._uri.path}`);
        // Update diagram node before saving...
        const editor = openProjects.getActiveEditor();
        if (editor) {
            await editor.onBeforeSave();
        }
        else {
            console.error('No active UML diagram editor - cannot update diagram node!');
        }
        const jsonContent = JSON.stringify(this._projectNode!.toJSON(), null, 2);
        await vscode.workspace.fs.writeFile(this._uri, Buffer.from(jsonContent, 'utf8'));    
    }


    public async saveAs(targetResource: vscode.Uri, cancellation?: vscode.CancellationToken): Promise<void> {
        console.log(`ProjectDocument: Saving project as ${targetResource.path}`);
        const editor = openProjects.getActiveEditor();
        if (editor) {
            await editor.onBeforeSave();
        }
        else {
            console.error('No active UML diagram editor - cannot update diagram node!');
        }
        const jsonContent = JSON.stringify(this._projectNode!.toJSON(), null, 2);
        await vscode.workspace.fs.writeFile(targetResource, Buffer.from(jsonContent, 'utf8'));
        this._uri = targetResource;
        this._projectNode!.documentUri = targetResource;
    }    

    public async revert(): Promise<void> {
        await this.loadFromDisk();
    }

    public async backup(context: vscode.CustomDocumentBackupContext, cancellation: vscode.CancellationToken): Promise<vscode.CustomDocumentBackup> {
        const editor = openProjects.getActiveEditor();
        if (editor) {
            await editor.onBeforeSave();
        }
        else {
            console.error('No active UML diagram editor - cannot update diagram node!');
        }
        const jsonContent = JSON.stringify(this.project.toJSON(), null, 2);
        const fileData = Buffer.from(jsonContent, 'utf8');
        await vscode.workspace.fs.writeFile(context.destination, fileData);
        return {
            id: context.destination.toString(),
            delete: () => vscode.workspace.fs.delete(context.destination),
        };
    }

    public dispose(): void {
    }
}