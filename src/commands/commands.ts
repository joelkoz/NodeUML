import { ICommand } from "./commandManager";
import * as meta from '../metaModel';
import { ProjectDocument } from '../projectDocument';
import { MessageClient, PLWVUndoRedo } from "../messageBus";
import * as utils from "../utils";
import { DiagramEditor } from "../views/diagramEditor";

const msgClient = new MessageClient();


function getUniqueName(parent: meta.MetaElementNode, element: meta.MetaElementNode) {
    const nodeType = element._type;
    const name = utils.camelCase(nodeType.slice(3));

    let count = 1;
    let newName = name + count;
    while (parent.getChildren().some(child => child.name === newName)) {
        count++;
        newName = name + count;
    }

    return newName;
}


function addNewElement(doc: ProjectDocument, parent: meta.AbstractNode, element: meta.MetaElementNode, opts: any) {
    if (parent instanceof meta.MetaElementNode) {
        if (!element.name) {
           element.name = getUniqueName(parent, element);
        }
        parent.addChild(element);
    }
    else if (parent instanceof meta.ProfileRootNode) {
        parent.addProfile(element);
    }
    element._parent = parent;
    doc.project!.metaNodeAdded(element);
    msgClient.publish('onCreateMeta', { projectId: doc.project!._id, element, opts });        
}



function removeElement(doc: ProjectDocument, node: meta.AbstractNode) {
    if (node._parent instanceof meta.AbstractNode) {
        const parent = node._parent;
        parent.removeChild(node);
        if (node instanceof meta.MetaElementNode) {
            msgClient.publish('onRemoveMeta', { projectId: doc.project!._id, element: node, opts: {} });
        }
    }
}



function updateMetaProperty(doc: ProjectDocument, node: meta.MetaElementNode, propName: string, value: any) {
    let actualValue;
    if (typeof value === 'object' && value.$ref) {
        // Value is an object reference - look up the actual node:
        actualValue = doc.project.findById(value.$ref);   
    }
    else if (Array.isArray(value)) {
        actualValue = value.map((item, index) => {
            if (typeof item === 'object' && item.$ref) {
                // Value is an object reference - look up the actual node:
                const node = doc.project.findById(item.$ref);   
                return node;
            }
            else if (typeof item === 'object' && typeof item._type === 'string' ) {
                // Value is a json of a meta object. Construct a new meta object
                return doc.project!.metaFactory(item);
            }
            else {
                return item;
            }
        });
    }
    else {
        actualValue = value;
    }
    utils.assignProperty(node, propName, actualValue);
};



function updateMetaProperties(doc: ProjectDocument, metaId: string, updates: { propName: string; value: any; }[]) {
    const node = doc.project.findById(metaId);
    if (node instanceof meta.MetaElementNode) {
        updates.forEach((update) => {
            updateMetaProperty(doc, node, update.propName, update.value);
        });

        msgClient.publish('onUpdateMeta', { projectId: doc.project!._id, element: node, opts: { updates } });
    }
}


export class BatchCommand implements ICommand {
    private commands: ICommand[] = [];
    public label: string;

    constructor(label: string) {
        this.label = label;
    }

    add(command: ICommand): void {
        this.commands.push(command);
    }

    execute(doc: ProjectDocument): void {
        this.commands.forEach(cmd => cmd.execute(doc));
    }

    undo(doc: ProjectDocument): void {
        this.commands.slice().reverse().forEach(cmd => cmd.undo(doc));
    }
}

type JsonMetaElement = {
  name: string;
  _type: string;
  _id?: string;
  _parent?: { $ref: string };
  ownedElements?: JsonMetaElement[];
  stereotypes?: { $ref: string }[];
  tags?: { name: string; value: string }[];
};

export class AddElement implements ICommand {

    private parentId: string;
    private jsonElement: JsonMetaElement;
    private opts: object;

    constructor(parent: meta.AbstractNode, element: meta.MetaElementNode, opts: object) {
        if (parent instanceof meta.MetaElementNode) {
            if (!element.name) {
               element.name = getUniqueName(parent, element);
            }
        }    
        this.parentId = parent._id;
        this.jsonElement = element.toJSON(false);
        this.opts = opts;
    }

    get label(): string {
        return `Add ${this.jsonElement.name}`;
    }

    execute(doc: ProjectDocument): void {
        const parent = doc.project.findById(this.parentId)!;
        const element = doc.project!.metaFactory(this.jsonElement)!;
        addNewElement(doc, parent, element, this.opts);
    }

    undo(doc: ProjectDocument): void {
        const element = doc.project.findById(this.jsonElement._id!);
        if (element) {
            removeElement(doc, element);
        }
        else {
            console.error(`Add Undo failed: could not find element ${this.jsonElement._id} to remove`);
        }
    }
}


export class RemoveElement implements ICommand {

    private jsonElement: JsonMetaElement;
    private opts: object;

    constructor(element: meta.MetaElementNode, opts: object) {
        this.jsonElement = element.toJSON(false);
        this.opts = opts;
    }

    get label(): string {
        return `Remove ${this.jsonElement.name}`;
    }


    execute(doc: ProjectDocument): void {
        const element = doc.project.findById(this.jsonElement._id!);
        if (element) {
            removeElement(doc, element);
        }
    }

    undo(doc: ProjectDocument): void {
        const parent = doc.project.findById(this.jsonElement._parent!.$ref);
        if (parent) {
            const element = doc.project!.metaFactory(this.jsonElement)!;
            addNewElement(doc, parent, element, this.opts);
        }
        else {
            console.error(`Remove Undo failed: could not find parent element ${this.jsonElement._parent?.$ref} to restore`);
        }
    }
}


export class UpdateProperties implements ICommand {

    private metaId: string;
    private updates: { propName: string; value: any; }[];
    private oldValues: { propName: string; value: any; }[];

    constructor(metaId: string, updates: { propName: string; value: any; }[]) {
        this.metaId = metaId;
        this.updates = updates;
        this.oldValues = [];
    }

    get label(): string {
        return `Change property`;
    }


    execute(doc: ProjectDocument): void {
        const element = doc.project.findById(this.metaId);
        this.oldValues = this.updates.map(u => ({ propName: u.propName, value: utils.getPropertyValue(element, u.propName, null) }));
        updateMetaProperties(doc, this.metaId, this.updates);
    }

    undo(doc: ProjectDocument): void {
        updateMetaProperties(doc, this.metaId, this.oldValues);
    }
}



export class ChangeParent implements ICommand {

    private metaId: string;
    private oldParentId: string;
    private newParentId: string;
    private insertBeforeId: string | null;

    constructor(metaId: string, oldParentId: string, newParentId: string, insertBeforeId: string | null = null) {
        this.metaId = metaId;
        this.oldParentId = oldParentId;
        this.newParentId = newParentId;
        this.insertBeforeId = insertBeforeId;
    }

    get label(): string {
        return `Change parent`;
    }


    execute(doc: ProjectDocument): void {
        const node = doc.project.findById(this.metaId);
        const oldParent = doc.project.findById(this.oldParentId);
        const newParent = doc.project.findById(this.newParentId);
        if (this.insertBeforeId) {
            const beforeNode = doc.project.findById(this.insertBeforeId);
            if (node && oldParent && newParent && beforeNode) {
               oldParent.removeChild(node);
               newParent.insertBefore(node, beforeNode);
            }
        }
        else {
            if (node && oldParent && newParent) {
                oldParent.removeChild(node);
                newParent.insertFirst(node);
             }
         }

        this.notifyUpdateIfMeta(doc, node);
        this.notifyUpdateIfMeta(doc, oldParent);
        this.notifyUpdateIfMeta(doc, newParent);
    }


    undo(doc: ProjectDocument): void {
        throw new Error("Method not implemented.");
    }


    notifyUpdateIfMeta(doc: ProjectDocument, node: meta.AbstractNode | undefined) {
        if (node instanceof meta.MetaElementNode) {
            msgClient.publish('onUpdateMeta', { projectId: doc.project!._id, element: node, opts: {} });
        }
    }
    
};

/**
 * A proxy command for the diagram editor that allows its own undo/redo commands
 * to be added to the VSCode undo/redo stack. The assumption is that by time
 * this command is first executed, the diagram has already executed the main
 * "execute" code once.  For that reason, it is skipped upon the first call.
 * Subsequent calls to "execute()" are made by the "redo" feature, so they
 * will in fact be executed.
 */
export class DiagramUndoRedo implements ICommand {

   private undoRedo: PLWVUndoRedo;
   private editor: DiagramEditor;
   private skipInitialExec: boolean;

   constructor(editor: DiagramEditor, undoRedo: PLWVUndoRedo) {
      this.editor = editor;
      this.undoRedo = undoRedo;
      this.skipInitialExec = true;
   }

   get label(): string {
       return this.undoRedo.label;
   }


    execute(doc: ProjectDocument): void {
        if (!this.skipInitialExec) {
            this.editor.diagramRedo(this.undoRedo);
        }
        else {
            this.skipInitialExec = false;
        }
    }

    undo(doc: ProjectDocument): void {
        this.editor.diagramUndo(this.undoRedo);
    }
}
