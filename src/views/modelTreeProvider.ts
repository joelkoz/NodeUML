import * as vscode from 'vscode';
import * as meta from '../metaModel';
import { MessageClient } from '../messageBus';
import { openProjects } from '../projectDocument';
import * as utils from "../utils";

class TouchedNodes extends Set<meta.MetaElementNode> {
    addIfMeta(node: any) {
      if (node instanceof meta.MetaElementNode) {
        this.add(node);
      }
    }
}

export class ModelTreeProvider implements vscode.TreeDataProvider<meta.AbstractNode>, vscode.TreeDragAndDropController<meta.AbstractNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<meta.AbstractNode | undefined | void> = new vscode.EventEmitter<meta.AbstractNode | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<meta.AbstractNode | undefined | void> = this._onDidChangeTreeData.event;
    dragMimeTypes = ['application/vnd.code.tree.meta.MetaElementNode']; // MIME type specific to meta.MetaElementNode
    dropMimeTypes = ['application/vnd.code.tree.meta.MetaElementNode'];
    
    selectedNode: meta.AbstractNode | null = null;
    private msgClient: MessageClient;

    constructor() {
        this.msgClient = new MessageClient();
    }
    
    private get project(): meta.ProjectNode | null {
        return openProjects.currentProject || null;
    }

    getTreeItem(element: meta.AbstractNode): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(element.name);
        treeItem.id = element._id;
        treeItem.contextValue = element._type;
        if (element instanceof meta.ProjectNode) {
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        }
        else if (!element.canHaveChildren()) {
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
        }
        else {
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        }
        return treeItem;
    }

    getParent(element: meta.AbstractNode): meta.AbstractNode | null {
        if (element._parent instanceof meta.AbstractNode) {
            return element._parent;
        }
        else {
            return null;
        }
    }


    async getChildren(element?: meta.AbstractNode): Promise<meta.AbstractNode[]> {
        if (!element) {
            // The root node of the tree is the project node
            return this.project ? [this.project] : [];
        } 
        else {
            return element.getChildren();
        }            
        
    }

    updateProperty(field: string, value: any) {
        if (this.selectedNode) {
            utils.assignProperty(this.selectedNode, field, value);
            this.refresh(this.selectedNode);
            if (this.selectedNode instanceof meta.MetaElementNode) {
                this.msgClient.publish('updateMetaProp', { projectId: this.project!._id, element: this.selectedNode, propName: field, value });
            }
        }
    }

    handleDrag(sourceNodes: meta.AbstractNode[], dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): void {
        const metaElementNodes = sourceNodes.filter(node => node instanceof meta.MetaElementNode);
        if (metaElementNodes.length > 0) {
            // Only add to data transfer if all dragged items are meta.MetaElementNodes
            dataTransfer.set('application/vnd.code.tree.meta.MetaElementNode', new vscode.DataTransferItem(metaElementNodes.map(node => node._id)));
        }
    }

    // Drop logic
    async handleDrop(target: meta.AbstractNode | undefined, dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
        if (!target) {
            return;
        }
    
        // Retrieve source nodes to drop
        const sourceIds: string[] | undefined = dataTransfer.get('application/vnd.code.tree.meta.MetaElementNode')?.value;
        if (!sourceIds) {
            return;
        }
        const sourceNodes = sourceIds
            .map((id: string) => openProjects.findNodeById(id) as meta.AbstractNode | null)
            .filter((node): node is meta.MetaElementNode => node instanceof meta.MetaElementNode);
    
        // Get the kind of nodes the target node can accept
        const allowableChildren = target.allowableChildren();

        // If the target can't accept, maybe the parent can
        const targetParent = target._parent instanceof meta.AbstractNode ? target._parent : undefined;
        const parentAllowableChildren = targetParent?.allowableChildren();

        const touchedNodes = new TouchedNodes();

        for (const node of sourceNodes) {
            if (node && node._parent instanceof meta.AbstractNode) {

                // Check if the target node allows this type of node as a child
                const isAllowed = allowableChildren.some((allowedClass) => node instanceof allowedClass);
                if (isAllowed) {
                    const oldParent = node._parent;
                    oldParent.removeChild(node);
                    target.insertFirst(node);
                    touchedNodes.addIfMeta(node);
                    touchedNodes.addIfMeta(oldParent);
                    touchedNodes.addIfMeta(target);
                }
                else if (targetParent) {
                    // As a catch all, maybe the parent node of the target accepts this node as a child
                    const isAllowedOnAlternate = parentAllowableChildren!.some((allowedClass) => node instanceof allowedClass);
                    if (isAllowedOnAlternate) {
                        const oldParent = node._parent;
                        oldParent.removeChild(node);
                        targetParent.insertBefore(node, target);
                        touchedNodes.addIfMeta(node);
                        touchedNodes.addIfMeta(oldParent);
                        touchedNodes.addIfMeta(targetParent);
                    }
                }
            }
        }
    
       this.refresh();

       // Now - tell the system of the nodes who have changed...
       for (const touchedNode of touchedNodes) {
            this.msgClient.publish('updateMeta', { projectId: this.project!._id, element: touchedNode, opts: {} });
       }
    }

    refresh(element?: meta.AbstractNode): void {
        console.log('ModelTreeProvider: attempting to refresh tree with node: ' + element?.name || 'undefined');
        this._onDidChangeTreeData.fire(element);
    }

    dispose() {
        this.msgClient.dispose();
    }
}
