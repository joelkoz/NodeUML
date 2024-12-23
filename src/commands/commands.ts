import { ICommand } from "./commandManager";
import * as meta from '../metaModel';
import { openProjects, ProjectDocument } from '../projectDocument';
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
    else if (!parent) {
       console.error('addNewElement: parent is null - ignoring command');
       return;
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
  type?: { $ref: string };
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
        this.parentId = parent?._id;
        this.jsonElement = element.toJSON(false);
        this.opts = opts;
    }

    get label(): string {
        return `Add ${this.jsonElement.name}`;
    }


    /**
     * Checks to see if any tag definitions need to be copied over
     * to the target element. A tag copy is done whenever the element being
     * updated is a ClassNode and a stereotype is added, or if the
     * element is a AttributeNode and the DataType is changed
     */
    public checkForTagCopy(doc: ProjectDocument) {
        if (this.jsonElement._type === 'UMLClass') {
            // Iterate over any stereotypes and see if we need to copy tag values
            if (this.jsonElement.stereotypes) {
                for (const stereotype of this.jsonElement.stereotypes) {
                    const sourceElement = doc.project.findById(stereotype.$ref);
                    if (sourceElement instanceof meta.MetaElementNode) {
                        this.copyTagDefinitions(sourceElement);
                    }
                }
            }
        }
        else if (this.jsonElement._type === 'UMLAttribute') {
            const sourceElement = doc.project.findById(this.jsonElement.type!.$ref);
            if (sourceElement instanceof meta.DataTypeNode) {
                this.copyTagDefinitions(sourceElement);
            }
        }
    }


    private copyTagDefinitions(sourceElement: meta.MetaElementNode) {
        if (!this.jsonElement.tags) {
            this.jsonElement.tags = [];
        }

        const newTagValues: { tagName: string, tagValue: string }[] = [];

        // Iterate over the source element's tags and add to the newTagValues if
        // it does not already exist in the targetElement's tags
        for (const sourceTag of sourceElement.tags) {
            const targetTag = this.jsonElement.tags.find(t => t.name === sourceTag.name);
            if (!targetTag) {
                newTagValues.push({ tagName: sourceTag.name, tagValue: sourceTag.value });
            }
        }

        if (newTagValues.length > 0) {
            for (const newTag of newTagValues) {
                const tagNode = new meta.TagNode(newTag.tagName, newTag.tagValue);
                const jsonTag = tagNode.toJSON(false);
                this.jsonElement.tags.push(jsonTag);
            }
        } 
    }

    
    execute(doc: ProjectDocument): void {

        let parent = doc.project.findById(this.parentId);

        if (!parent && this.jsonElement._type === 'UMLProfile') {
            // Profile nodes don't have a parent, so use our
            // project's root profile node
            parent = doc.project!.profiles;
        }

        if (parent) {
           const element = doc.project!.metaFactory(this.jsonElement)!;
           addNewElement(doc, parent, element, this.opts);
        }
        else {
            console.error(`AddElement.execute() failed: could not find parent ${this.parentId}`);
        }
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



export class AddToDiagram implements ICommand {

    private jsonMeta: JsonMetaElement;
    private shapeId: string | null;
    private opts: object;

    constructor(element: meta.MetaElementNode, opts: object) {
        this.jsonMeta = element.toJSON(true);
        this.opts = opts;
        this.shapeId = null;
    }

    get label(): string {
        return `Add ${this.jsonMeta.name} to diagram`;
    }


    async execute(doc: ProjectDocument): Promise<void> {
        const activeEditor = openProjects.getActiveEditor();
        if (activeEditor) {
            this.shapeId = await activeEditor.diagramAddShape(this.jsonMeta, this.opts);
        }
        else {
            console.error('AddToDiagram.execute() failed: no active editor');
        }
    }


    undo(doc: ProjectDocument): void {
        if (this.shapeId) {
            const activeEditor = openProjects.getActiveEditor();
            if (activeEditor) {
                activeEditor.diagramRemoveShape(this.shapeId);
                this.shapeId = null;
            }
            else {
                console.error('AddToDiagram.execute() failed: no active editor');
            }
        }
        else {
            console.error(`AddToDiagram Undo failed: shape Id is unknown`);
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

    /**
     * Checks to see if any tag definitions need to be copied over
     * to the target element. A tag copy is done whenever the element being
     * updated is a ClassNode and a stereotype is added, or if the
     * element is a AttributeNode and the DataType is changed
     */
    public checkForTagCopy(doc: ProjectDocument) {
        const targetElement = doc.project.findById(this.metaId);
        if (targetElement instanceof meta.ClassNode) {
            // Iterate over the updates to see if a 'stereotypes' property is changed
            for (const update of this.updates) {
                if (update.propName === 'stereotypes') {
                    // the update value is an array of stereotype reference nodes
                    // copy tags from each stereotype over to the class
                    for (const stereotype of update.value) {
                        const sourceElement = doc.project.findById(stereotype.$ref);
                        if (sourceElement instanceof meta.MetaElementNode) {
                            this.copyTagDefinitions(sourceElement, targetElement);
                        }
                    }
                }
            }
        }
        else if (targetElement instanceof meta.AttributeNode) {
            // Iterate over the updates to see if the 'type' property is changed
            for (const update of this.updates) {
                if (update.propName === 'type') {
                    // The update value is a datatype reference node
                    const sourceElement = doc.project.findById(update.value.$ref);
                    if (sourceElement instanceof meta.DataTypeNode) {
                        this.copyTagDefinitions(sourceElement, targetElement);
                    }
                }
            }
        }
    }


    private copyTagDefinitions(sourceElement: meta.MetaElementNode, targetElement: meta.MetaElementNode) {
        const newTagValues: { tagName: string, tagValue: string }[] = [];
        // Iterate over the source element's tags and add to the newTagValues if
        // it does not already exist in the targetElement's tags
        for (const sourceTag of sourceElement.tags) {
            const targetTag = targetElement.tags.find(t => t.name === sourceTag.name);
            if (!targetTag) {
                newTagValues.push({ tagName: sourceTag.name, tagValue: sourceTag.value });
            }
        }

        if (newTagValues.length > 0) {
            // Now, make a new array that includes all of the old tags plus the new tags...
            const newTags: meta.TagNode[] = Array.from(targetElement.tags);
            for (const newTag of newTagValues) {
                newTags.push(new meta.TagNode(newTag.tagName, newTag.tagValue));
            }

            // Finally, add an update to the target's 'tags' property...
            this.updates.push({ propName: 'tags', value: newTags });
        } 
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
