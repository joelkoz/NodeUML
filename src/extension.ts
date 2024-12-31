import * as vscode from 'vscode';
import { ModelTreeProvider } from './views/modelTreeProvider';
import { createUMLModelCommand } from './commands/createUMLModel';
import  * as meta from './metaModel';
import { PropertiesProvider } from './views/propertiesProvider';
import { DiagramEditorProvider } from './views/diagramEditorProvider';
import { MessageClient, PLCreateNewMeta, PLMetaModelChange, PLUpdateMetaProperties, PLUndoRedo } from './messageBus';
import { openProjects } from './projectDocument';
import * as cmd from "./commands/commands";
import * as gen from "./codeGeneration";

export function activate(context: vscode.ExtensionContext) {

    // If in development mode, auto open the debugger window
    if (context.extensionMode === vscode.ExtensionMode.Development) {
        vscode.commands.executeCommand('workbench.action.toggleDevTools');
    }

    const modelTreeProvider = new ModelTreeProvider();


    const diagramEditorProvider = new DiagramEditorProvider(context);
    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            'nodeuml.umlDiagramEditor',
            diagramEditorProvider,
            {
                webviewOptions: { retainContextWhenHidden: true },
                supportsMultipleEditorsPerDocument: false
            }
        )
    );

    
    const treeView = vscode.window.createTreeView('modelExplorer', {
        treeDataProvider: modelTreeProvider,
        dragAndDropController: modelTreeProvider,
        canSelectMany: true
    });
    context.subscriptions.push(treeView, modelTreeProvider);

    
    context.subscriptions.push(
       vscode.commands.registerCommand('nodeuml.refreshModel', () => modelTreeProvider.refresh())
    );

    context.subscriptions.push(
       vscode.commands.registerCommand('nodeuml.createUMLModel', createUMLModelCommand)
    );


    const msgClient = new MessageClient();

    // Refresh the model tree when a meta node is created
    msgClient.subscribe('onCreateMeta', (payload: PLMetaModelChange) => {
        const { projectId, element, opts } = payload;
        const parent = element._parent as meta.AbstractNode;
        modelTreeProvider.refresh(parent);
        treeView.reveal(element, { expand: true });
        propertiesProvider.refresh(); 
    });


    msgClient.subscribe('onUpdateMeta', (payload: PLMetaModelChange) => {
        const { element } = payload;
        modelTreeProvider.refresh(element);
        treeView.reveal(element, { expand: true });
        propertiesProvider.refresh(); 
    });


    msgClient.subscribe('onRemoveMeta', (payload: PLMetaModelChange) => {
        const { element } = payload;
        if (element._parent instanceof meta.AbstractNode) {
            modelTreeProvider.refresh(element._parent);
            propertiesProvider.refresh(); 
        }
    });

    function execAddElement(parent: meta.AbstractNode, element: meta.MetaElementNode, opts: any) {
        const cmdAddElement = new cmd.AddElement(parent, element, opts);
        cmdAddElement.checkForTagCopy(openProjects.currentProjectDoc!);
        openProjects.currentProjectDoc!.exec(cmdAddElement);
    }

    context.subscriptions.push(
        vscode.commands.registerCommand('nodeuml.updateProperty', (propName, value) => {
            if (modelTreeProvider.selectedNode) {
                const cmdUpdateProperty = new cmd.UpdateProperties(modelTreeProvider.selectedNode._id, [ { propName, value }]);
                cmdUpdateProperty.checkForTagCopy(openProjects.currentProjectDoc!);
                openProjects.currentProjectDoc!.exec(cmdUpdateProperty);
            }
        })
    );


    context.subscriptions.push(
        vscode.commands.registerCommand('nodeuml.removeNode', (node) => {
            const cmdRemoveElement = new cmd.RemoveElement(node, {});
            openProjects.currentProjectDoc!.exec(cmdRemoveElement);})
    );


    context.subscriptions.push(
        vscode.commands.registerCommand('nodeuml.addToDiagram', (node, opts = {}) => {
            const cmdAddToDiagram = new cmd.AddToDiagram(node, opts);
            openProjects.currentProjectDoc!.exec(cmdAddToDiagram);})
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
                    let isAllowed = parentNode.canBeParent(newNode);
                    while (!isAllowed && parentNode._parent instanceof meta.AbstractNode) {
                        // The selected node is not allowed to have the new node as a child. Maybe they
                        // can share an ancestor
                        parentNode = parentNode._parent;
                        isAllowed = parentNode.canBeParent(newNode);
                    }
                    if (isAllowed) {
                        execAddElement(parentNode, newNode, payload.opts);
                    }
                    else {
                        console.error(`Can not find a suitable parent for ${newNode._type} ${newNode.name}. Not adding to model.`);
                    }
                }
            }
        })
    );


    context.subscriptions.push(
        vscode.commands.registerCommand('nodeuml.updateMetaProperties', (payload: PLUpdateMetaProperties) => {
            if (openProjects.currentProject) {
                const node = openProjects.findNodeById(payload.metaId);
                if (node instanceof meta.MetaElementNode) {
                    const cmdUpdateProperty = new cmd.UpdateProperties(payload.metaId, payload.updates);
                    cmdUpdateProperty.checkForTagCopy(openProjects.currentProjectDoc!);
                    openProjects.currentProjectDoc!.exec(cmdUpdateProperty);                    
                }
            }
        })
    );


    context.subscriptions.push(
        vscode.commands.registerCommand('nodeuml.addPackage', (node, opts = {}) => {
            execAddElement(node, new meta.PackageNode(''), opts);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('nodeuml.addClass', (node, opts = {}) => {
            execAddElement(node, new meta.ClassNode(''), opts);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('nodeuml.addAttribute', (node, opts = {}) => {
            execAddElement(node, new meta.AttributeNode(''), opts);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('nodeuml.addOperation', (node, opts = {}) => {
            execAddElement(node, new meta.OperationNode(''), opts);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('nodeuml.addParameter', (node, opts = {}) => {
            execAddElement(node, new meta.ParameterNode(''), opts);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('nodeuml.addProfile', (node, opts = {}) => {
            execAddElement(node, new meta.ProfileNode('New Profile'), opts);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('nodeuml.addDataType', (node, opts = {}) => {
            execAddElement(node, new meta.DataTypeNode(''), opts);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('nodeuml.addTagDef', (node, opts = {}) => {
            execAddElement(node, new meta.TagNode(''), opts);
        })
    );


    context.subscriptions.push(
        vscode.commands.registerCommand('nodeuml.addStereotype', (node, opts = {}) => {
            execAddElement(node, new meta.StereotypeNode(''), opts);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('nodeuml.addActor', (node, opts = {}) => {
            execAddElement(node, new meta.ActorNode(''), opts);
        })
    );


    const propertiesProvider = new PropertiesProvider(context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('propertiesView', propertiesProvider)
    );
    

    // Synchronize the properties editor with the model tree view
    treeView.onDidChangeSelection((event) => {
        const selectedNode = event.selection[0] as meta.AbstractNode | undefined;
        if (selectedNode && selectedNode instanceof meta.MetaElementNode) {
            propertiesProvider.setSelectedNode(selectedNode);
            modelTreeProvider.selectedNode = selectedNode;
            vscode.commands.executeCommand('setContext', 'canPasteInto', isPasteValid(selectedNode));        
        }
        else {
            propertiesProvider.setSelectedNode(null);
            modelTreeProvider.selectedNode = null;
            vscode.commands.executeCommand('setContext', 'canPasteInto', false);
        }
    });



    context.subscriptions.push(
        vscode.commands.registerCommand('nodeuml.generateCode', () => {
            gen.generateCode();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('nodeuml.generateCodeFromMenu', () => {
            gen.generateCode();
        })
    );


    context.subscriptions.push(
        vscode.commands.registerCommand('nodeuml.configure', () => {
            gen.openSettingsForConfiguration();
        })
    );


    context.subscriptions.push(
        vscode.commands.registerCommand('nodeuml.selectTargetPlatform', () => {
            gen.selectTargetPlatform();
        })
    );

    
    context.subscriptions.push(
        vscode.commands.registerCommand('nodeuml.installNodeMDA', () => {
            gen.installNodeMDAPlugin();
        })
    );    

    context.subscriptions.push(
        vscode.commands.registerCommand('nodeuml.checkNodeMDA', () => {
            gen.isNodeMDAInstalled();
        })
    );    


    context.subscriptions.push(
        vscode.commands.registerCommand('nodeuml.exportProfile', async (node: meta.ProfileNode) => {
            const saveUri = await vscode.window.showSaveDialog({
                filters: { 'UML Profile': ['numl-profile'] },
                saveLabel: 'Export'
            });
            if (!saveUri) { return; }
                const profileJson = JSON.stringify(node.toJSON(), null, 2);
                await vscode.workspace.fs.writeFile(saveUri, Buffer.from(profileJson, 'utf8'));
                vscode.window.showInformationMessage(`Exported profile "${node.name}" to ${saveUri.fsPath}`);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('nodeuml.importProfile', async (rootNode: meta.ProfileRootNode) => {
            const openUris = await vscode.window.showOpenDialog({
                filters: { 'UML Profile': ['numl-profile'] },
                canSelectMany: false,
                openLabel: 'Import'
            });
            if (!openUris || openUris.length === 0) { return; }
    
            const fileData = await vscode.workspace.fs.readFile(openUris[0]);
            const jsonObj = JSON.parse(fileData.toString());
            const importedProfile = meta.ProfileNode.fromJSON(jsonObj, openProjects.currentProject?.refCache!);
            if (importedProfile) {
                const parentNode = openProjects.currentProject!.profiles;
                const cmdImportProfile = new cmd.AddElement(parentNode, importedProfile, {});
                openProjects.currentProjectDoc!.exec(cmdImportProfile);
            }
        })
    );


    msgClient.subscribe('onUndoRedo', (payload: PLUndoRedo) => {
        propertiesProvider.refresh();
    });

    let globalClipboard: { type: string; data: any[] } | null = null;

    // Default is "no paste allowed"
    vscode.commands.executeCommand('setContext', 'canPasteInto', false);

    function isPasteValid(targetNode: meta.AbstractNode) {
        if (globalClipboard?.type === 'UMLTag') {
            return targetNode instanceof meta.MetaElementNode;
        }
        else {
            return globalClipboard?.type && targetNode.canBeParentOfType(globalClipboard.type);
        }
    }

    vscode.commands.registerCommand('nodeuml.copyNode', () => {
        const selectedNodes = treeView.selection;
        if (!selectedNodes || selectedNodes.length === 0) { return; }
    
        const nodeType = selectedNodes[0]._type;
        const validSelection = selectedNodes.every(node => node._type === nodeType);
        if (!validSelection) {
            vscode.window.showErrorMessage("Cannot copy mixed types of nodes.");
            return;
        }
    
        const preserveChildrenTypes = [ 'UMLClass', 'UMLOperation'];

        const clipboardData = selectedNodes.map(node => {
            const json = node.toJSON(false);
            delete json._id;
            delete json._parent;
            if (!preserveChildrenTypes.includes(node._type)) {
                json.ownedElements = [];
            }
            else {
                // blank out id's of owned elements
                json.ownedElements.forEach((child: any) => {
                    delete child._id;
                    delete child._parent;
                });
            }
            return json;
        });
    
        globalClipboard = { type: nodeType, data: clipboardData };
        console.log(`Copied ${clipboardData.length} ${nodeType} node(s).`);
    });
    
    
    vscode.commands.registerCommand('nodeuml.pasteNode', (rightClickNode) => {
        if (openProjects.currentProject === null) {
            return;
        }

        if (rightClickNode?._id !== modelTreeProvider.selectedNode?._id) {
            vscode.window.showErrorMessage("Make node the selected node before pasting");
            return;
        }

        const clipboard = globalClipboard;
        if (!clipboard || !clipboard.data || clipboard.data.length === 0) { return; };
    
        const targetNode = modelTreeProvider.selectedNode;
        if (!(targetNode instanceof meta.MetaElementNode)) {
            vscode.window.showErrorMessage("Select a valid target to paste into.");
            return;
        }
    
        // Special handling for tags - they are added to the tags property of
        // the target instead of as a child unless the target is one of a few
        // special types...
        const tagParentTypes = ['UMLPackage', 'UMLProfile']; // Which target nodes are actual parents for a paste.
        if (clipboard.type === 'UMLTag' && !tagParentTypes.includes(targetNode._type)) {
            // Just add the tag definitions to the target node's tags property.
            const cmdAddTags = new cmd.AddTags(targetNode._id, clipboard.data );
            openProjects.currentProjectDoc!.exec(cmdAddTags);
        }
        else {
            // Normal paste behavior
            const targetParent = !isPasteValid(targetNode) && targetNode._parent instanceof meta.AbstractNode ? targetNode._parent : targetNode;
        
            if (!targetParent || !isPasteValid(targetParent)) {
                vscode.window.showErrorMessage("Paste operation is not valid for the selected target.");
                return;
            }
        
            const batchCommand = new cmd.BatchCommand("Paste Nodes");
        
            clipboard.data.forEach(json => {
                const newNode = openProjects.currentProject!.metaFactory(json);
                if (newNode) {
                    const addCommand = new cmd.AddElement(targetParent, newNode, {});
                    batchCommand.add(addCommand);   
                }
            });
        
            openProjects.currentProjectDoc!.exec(batchCommand);
        }
        console.log(`Pasted ${clipboard.data.length} ${clipboard.type} node(s).`);
        modelTreeProvider.refresh();
    });
    
    
}
