import * as vscode from 'vscode';
import { ModelTreeProvider } from './views/modelTreeProvider';
import { createUMLModelCommand } from './commands/createUMLModel';
import  * as meta from './metaModel';
import { camelCase } from './utils';
import { PropertiesProvider } from './views/propertiesProvider';
import { DiagramEditor } from './views/diagramEditor';
import { MessageClient, PLCreateNewMeta, PLUpdateMetaProperties } from './messageBus';
import { openProjects } from './projectDocument';
import * as utils from "./utils";

// General events of note:
//
// Called whenever the active editor changes:
// vscode.window.onDidChangeActiveTextEditor((editor) => {
//     const newActiveUri = editor?.document.uri;
// });
//
//
// Called whenever the list visible editors change:
// vscode.window.onDidChangeVisibleTextEditors((editors) => {
//     const visibleCustomEditors = editors.filter(
//         editor => editor.document.uri.fsPath.endsWith('.numl')
//     );
// });


export function activate(context: vscode.ExtensionContext) {

    if (context.extensionMode === vscode.ExtensionMode.Development) {
        vscode.commands.executeCommand('workbench.action.toggleDevTools');
    }

    const modelTreeProvider = new ModelTreeProvider();


    const diagramEditor = new DiagramEditor(context);
    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            'nodeuml.umlDiagramEditor',
            diagramEditor,
            {
                webviewOptions: { retainContextWhenHidden: true },
                supportsMultipleEditorsPerDocument: false
            }
        )
    );

    const msgClient = new MessageClient();

    const treeView = vscode.window.createTreeView('modelExplorer', {
        treeDataProvider: modelTreeProvider,
        dragAndDropController: modelTreeProvider,
    });
    context.subscriptions.push(treeView, modelTreeProvider);

    
    context.subscriptions.push(
       vscode.commands.registerCommand('nodeuml.refreshModel', () => modelTreeProvider.refresh())
    );

    context.subscriptions.push(
       vscode.commands.registerCommand('nodeuml.createUMLModel', createUMLModelCommand)
    );

    const nameCounter: Record<string, number> = {};
    function getUniqueName(element: meta.MetaElementNode) {
        let nodeType = element._type;
        let name = camelCase(nodeType.slice(3));
        let count = nameCounter[name] || 1;
        nameCounter[name] = count + 1;
        return name + count;
    }

    function addElement(parent: meta.AbstractNode, element: meta.MetaElementNode, opts: any): meta.MetaElementNode {
        if (parent instanceof meta.MetaElementNode) {
            parent.addChild(element);
            if (!element.name) {
               element.name = getUniqueName(element);
            }
        }
        else if (parent instanceof meta.ProfileRootNode) {
            parent.addProfile(element);
        }
        element._parent = parent;
        openProjects.currentProject!.metaNodeAdded(element);
        openProjects.currentProjectDoc!.markDirty();
        modelTreeProvider.refresh(parent);
        treeView.reveal(element, { expand: true });
        msgClient.publish('createMeta', { projectId: openProjects.currentProject!._id, element, opts });        
        return element;
    }

    context.subscriptions.push(
        vscode.commands.registerCommand('nodeuml.updateProperty', (field, value) => {
            if (typeof value === 'object' && value.$ref) {
                // Value is an object reference - look up the actual node:
                const node = openProjects.findNodeById(value.$ref);   
                modelTreeProvider.updateProperty(field, node);
            }
            else if (Array.isArray(value)) {
                const values = value.map((item, index) => {
                    if (typeof item === 'object' && item.$ref) {
                        // Value is an object reference - look up the actual node:
                        const node = openProjects.findNodeById(item.$ref);   
                        return node;
                    }
                    else if (item instanceof meta.MetaElementNode) {
                        return item;
                    }
                    else if (typeof item === 'object' && typeof item._type === 'string' ) {
                        // Value is a json of a meta object. Construct a new meta object
                        return openProjects.currentProject!.metaFactory(item);
                    }
                    else {
                        return item;
                    }
                });
                modelTreeProvider.updateProperty(field, values);
            }
            else {
                modelTreeProvider.updateProperty(field, value);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('nodeuml.removeNode', (node) => {
            if (node._parent instanceof meta.AbstractNode) {
                const parent = node._parent;
                parent.removeChild(node);
                modelTreeProvider.refresh(parent);
                if (node instanceof meta.MetaElementNode) {
                    msgClient.publish('removeMeta', { projectId: openProjects.currentProject!._id, element: node, opts: {} });
                }
            }
        })
    );


    context.subscriptions.push(
        vscode.commands.registerCommand('nodeuml.removeById', (metaId) => {
            let removeNode = openProjects.findNodeById(metaId);
            if (removeNode) {
                vscode.commands.executeCommand('nodeuml.removeNode', removeNode);
            }
            else {
                console.log(`Could not remove node with id ${metaId}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('nodeuml.createNewMeta', (payload: PLCreateNewMeta) => {
            if (openProjects.currentProject) {
                let parentNode: meta.AbstractNode | undefined | null;
                if (payload.jsonMeta._parent) {
                    if (payload.jsonMeta._parent._id) {
                        parentNode = openProjects.findNodeById(payload.jsonMeta._parent._id);
                    }
                    else {
                        parentNode = openProjects.findNodeById(payload.jsonMeta._parent.$ref);
                    }
                }
                else if (payload.opts.parentMetaId) {
                    parentNode = openProjects.findNodeById(payload.opts.parentMetaId);
                }
                else {
                    parentNode = modelTreeProvider.selectedNode;
                }

                if (!parentNode) {
                    parentNode = openProjects.currentProject.model;
                }

                let newNode = openProjects.currentProject.metaFactory(payload.jsonMeta);
                if (newNode) {
                    // Check to see if the parent node we are targeting will allow the new
                    // node as a child
                    let isAllowed = parentNode.canBeChild(newNode);
                    while (!isAllowed && parentNode._parent instanceof meta.AbstractNode) {
                        // The selected node is not allowed to have the new node as a child. Maybe they
                        // can share an ancestor
                        parentNode = parentNode._parent;
                        isAllowed = parentNode.canBeChild(newNode);
                    }
                    if (isAllowed) {
                        addElement(parentNode, newNode, payload.opts);
                    }
                    else {
                        console.error(`Can not find a suitable parent for ${newNode._type} ${newNode.name}. Not adding to model.`);
                    }
                }
            }
        })
    );


    function updateMetaProperty(node: meta.MetaElementNode, field: string, value: any) {
        let actualValue;
        if (typeof value === 'object' && value.$ref) {
            // Value is an object reference - look up the actual node:
            actualValue = openProjects.findNodeById(value.$ref);   
        }
        else if (Array.isArray(value)) {
            actualValue = value.map((item, index) => {
                if (typeof item === 'object' && item.$ref) {
                    // Value is an object reference - look up the actual node:
                    const node = openProjects.findNodeById(item.$ref);   
                    return node;
                }
                else if (typeof item === 'object' && typeof item._type === 'string' ) {
                    // Value is a json of a meta object. Construct a new meta object
                    return openProjects.currentProject!.metaFactory(item);
                }
                else {
                    return item;
                }
            });
        }
        else {
            actualValue = value;
        }
        utils.assignProperty(node, field, actualValue);
    };



    context.subscriptions.push(
        vscode.commands.registerCommand('nodeuml.updateMetaProperties', (payload: PLUpdateMetaProperties) => {
            if (openProjects.currentProject) {
                const node = openProjects.findNodeById(payload.metaId);
                if (node instanceof meta.MetaElementNode) {
                    payload.updates.forEach((update) => {
                        updateMetaProperty(node, update.propName, update.value);
                    });
                    modelTreeProvider.refresh(node);
                    treeView.reveal(node, { expand: true, focus: true });
                    msgClient.publish('updateMeta', { projectId: openProjects.currentProject!._id, element: node, opts: { updates: payload.updates } });
                }
            }
        })
    );


    context.subscriptions.push(
        vscode.commands.registerCommand('nodeuml.addPackage', (node, opts = {}) => {
            addElement(node, new meta.PackageNode(''), opts);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('nodeuml.addClass', (node, opts = {}) => {
            addElement(node, new meta.ClassNode(''), opts) as meta.ClassNode;
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('nodeuml.addAttribute', (node, opts = {}) => {
            addElement(node, new meta.AttributeNode(''), opts);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('nodeuml.addOperation', (node, opts = {}) => {
            addElement(node, new meta.OperationNode(''), opts);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('nodeuml.addParameter', (node, opts = {}) => {
            addElement(node, new meta.ParameterNode(''), opts);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('nodeuml.addProfile', (node, opts = {}) => {
            addElement(node, new meta.ProfileNode('New Profile'), opts);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('nodeuml.addDataType', (node, opts = {}) => {
            addElement(node, new meta.DataTypeNode(''), opts);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('nodeuml.addTagDef', (node, opts = {}) => {
            addElement(node, new meta.TagNode(''), opts);
        })
    );


    context.subscriptions.push(
        vscode.commands.registerCommand('nodeuml.addStereotype', (node, opts = {}) => {
            addElement(node, new meta.StereotypeNode(''), opts);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('nodeuml.addActor', (node, opts = {}) => {
            addElement(node, new meta.ActorNode(''), opts);
        })
    );


    const propertiesProvider = new PropertiesProvider(context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('propertiesView', propertiesProvider)
    );
    
    // Synchronize the properties editor with the model tree view
    treeView.onDidChangeSelection((event) => {
console.log('nodeuml.activate: ModelTreeProvider selection changed');        
        const selectedNode = event.selection[0] as meta.AbstractNode | undefined;
        if (selectedNode && selectedNode instanceof meta.MetaElementNode) {
            propertiesProvider.setSelectedNode(selectedNode);
            modelTreeProvider.selectedNode = selectedNode;
        }
        else {
            propertiesProvider.setSelectedNode(null);
            modelTreeProvider.selectedNode = null;
        }
    });
    

    vscode.window.onDidChangeActiveTextEditor((editor) => {
        // The active editor has changed - sync the tree view with the active editor
        console.log('nodeuml.activate: Active editor changed - refreshing model tree');
        if (openProjects.currentProjectDoc) {
            modelTreeProvider.refresh(openProjects.currentProjectDoc.project);
        }
        else {
            console.log('nodeuml.activate: There is no current project!');
            modelTreeProvider.refresh();
        }
    });

    vscode.window.onDidChangeActiveTextEditor((editor) => {
        console.log('nodeuml.activate: Active editor changed - refreshing model tree');
        modelTreeProvider.refresh();
    });

}
