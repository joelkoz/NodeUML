import * as vscode from 'vscode';
import { ProjectNode, AbstractNode } from './metaModel';
import { MessageClient } from './messageBus';

class OpenProjects {

    private readonly _projects: Map<string, ProjectDocument> = new Map();
    private messageClient: MessageClient = new MessageClient();

    /**
     * Retuns the ProjectNode of whichever project is associated with the active edtior. If
     * a UML Diagram editor is not open or is not the active editing tab, this will
     * return null
     */
    get currentProject(): ProjectNode | null {
        return this.currentProjectDoc?.project || null;
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


    async load(uri: vscode.Uri): Promise<ProjectDocument> {
        let doc = await ProjectDocument.loadFile(uri);
        this._projects.set(uri.path, doc);
        return doc;
    }


    async remove(doc: ProjectDocument | null) {
        if (doc) {
            this._projects.delete(doc.uri.path);
        }    
    }
}

export const openProjects = new OpenProjects();


export class ProjectDocument implements vscode.CustomDocument {
    private _uri: vscode.Uri;
    private _projectNode: ProjectNode | null;

    private readonly _onDidChangeDocument = new vscode.EventEmitter<void>();
    public readonly onDidChange = this._onDidChangeDocument.event;

    private constructor(uri: vscode.Uri) {
        this._uri = uri;
        this._projectNode = null;
    }

    get uri(): vscode.Uri {
        return this._uri;
    }

    get project(): ProjectNode {
        return this._projectNode!;
    }

    // Load data from disk into ProjectNode (called initially or in revert)
    private async loadFromDisk(): Promise<void> {
        const documentData = await vscode.workspace.fs.readFile(this._uri);
        const jsonData = JSON.parse(documentData.toString());
        this._projectNode = ProjectNode.fromJSON(jsonData);
        this._projectNode.documentUri = this._uri;        
        this._projectNode.isDirty = false;
    }

    public static async loadFile(uri: vscode.Uri): Promise<ProjectDocument> {
        const document = new ProjectDocument(uri);
        await document.loadFromDisk(); // Ensure loaded before returning
        return document;
    }

    // Save current ProjectNode data to disk
    public async save(cancellation?: vscode.CancellationToken): Promise<void> {
        console.log(`ProjectDocument: Saving project ${this._uri.path}`);
        const jsonContent = JSON.stringify(this._projectNode!.toJSON(), null, 2);
        await vscode.workspace.fs.writeFile(this._uri, Buffer.from(jsonContent, 'utf8'));
        this._projectNode!.isDirty = false;
        this._onDidChangeDocument.fire();      
    }


    public async saveAs(targetResource: vscode.Uri, cancellation?: vscode.CancellationToken): Promise<void> {
        console.log(`ProjectDocument: Saving project as ${targetResource.path}`);
        const jsonContent = JSON.stringify(this._projectNode!.toJSON(), null, 2);
        await vscode.workspace.fs.writeFile(targetResource, Buffer.from(jsonContent, 'utf8'));
        this._uri = targetResource;
        this._projectNode!.documentUri = targetResource;
        this._projectNode!.isDirty = false;

        // Notify VS Code that the document's URI has changed
        this._onDidChangeDocument.fire();
    }    

    public async revert(): Promise<void> {
        await this.loadFromDisk();
    }

    public markDirty(): void {
        this._projectNode!.isDirty = true;
        console.log(`ProjectDocument: Project ${this._uri.path} is now dirty`);
        this._onDidChangeDocument.fire();
    }

    public dispose(): void {
        this._onDidChangeDocument.dispose();
    }
}