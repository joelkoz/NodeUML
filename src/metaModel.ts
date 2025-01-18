import { v4 as uuidv4 } from 'uuid';
import * as vscode from 'vscode';

// Class Factory map for meta model
const classFactory: { [key: string]: typeof AbstractNode } = {
};

/**
 * A cache of object Id to AbstractNode descendants that can be used
 * to resolve ReferenceNodes.
 */
export class ReferenceCache {
    cache: Map<string, AbstractNode> = new Map();
    getReference(id: string): AbstractNode | undefined {
        return this.cache.get(id);
    }

    save(node: AbstractNode) {
        this.cache.set(node._id, node);
    }
}

/**
 * A temporary node that represents a reference to another node by saving
 * its object Id. It is used primarily in persistence to prevent circular
 * references and to keep the object graph small when serializing.
 */
export class ReferenceNode {
    $ref: string;
    constructor(id: string) {
        this.$ref = id;
    }

    ref(refCache: ReferenceCache) : AbstractNode | undefined {
        if (this.$ref) {
            return refCache.getReference(this.$ref);
        }
    }

    static toJSON(obj: any, useClassRef: boolean = false): any {
        if (obj && obj._id) {
            if (obj instanceof ClassNode && useClassRef) {
                return { $ref: obj._id, className: obj.name };
            }
            else {
                return { $ref: obj._id };
            }
        }
    }

    static fromJSON(json: any, refCache: ReferenceCache, useClassRef: boolean = false): ReferenceNode | AbstractNode |undefined {
        if (json?.$ref) {
           const node = refCache.getReference(json.$ref);
           if (node) {
               return node;
           }
           else {
              if (json.className && useClassRef) {
                  return new ClassReferenceNode(json.$ref, json.className);
              }
              else {
                  return new ReferenceNode(json.$ref);
              }
           }
        }
    }
}


export class ClassReferenceNode extends ReferenceNode {
    public className: string;
    constructor(id: string, className: string) {
        super(id);
        this.className = className;
    }
}


/**
 * A base class for all items that appear in the meta model. There are a few types of
 * nodes that are NOT UML meta elements (in particular, ProjectNode and ProfileRootNode),
 * but most inherit from MetaElementNode.
 * @see MetaElementNode
 */
export class AbstractNode {
    _id: string;
    name: string;
    _type: string;
    _parent: AbstractNode | ReferenceNode | undefined;
    __myProject: ProjectNode | null;

    constructor(name: string, nodeType: string) {
        this.name = name;
        this._type = nodeType;
        this._id = uuidv4();
        this.__myProject = null;
    }

    get project(): ProjectNode | null {

        if (!this.__myProject) {
            // Project node has already been resolved - return it
            this.__myProject = this._parent as ProjectNode;
        }

        let p: AbstractNode = this;
        while (p) {
            if (p instanceof ProjectNode) {
                this.__myProject = p;
                return p;
            }
            else if (p._parent instanceof AbstractNode) {
                p = p._parent;
            }
            else {
                break;
            }
        }
        return null;
    }


    remove() {
        if (this._parent instanceof AbstractNode) {
            this._parent.removeChild(this);
        }
    }

    canHaveChildren(): boolean {
        return this.allowableChildren().length > 0;
    }


    // Method that specifies the allowable children classes
    allowableChildren(): Array<new (...args: any[]) => AbstractNode> {
        return []; // Default to no children allowed
    }

    // Returns TRUE if the prospect node can be a child of this node
    canBeParent(prospectChild: AbstractNode): boolean {
        return this.allowableChildren().some((allowedChildClass) => prospectChild instanceof allowedChildClass);
    }

    // Returns TRUE if the type name string specified in childTypeName matches
    // the _type field of any of the allowableChildren of this node
    canBeParentOfType(childTypeName: string): boolean {
        return this.allowableChildren().some((allowedChildClass) => { 
            const childInstance = new allowedChildClass('example');
            return (childTypeName === childInstance._type); 
        });
    }


    getChildren(): AbstractNode[] {
        return [];
    }

    addChild(element: AbstractNode): AbstractNode {
        throw new Error('Not implemented');
    }

    insertFirst(element: AbstractNode) : AbstractNode {
        throw new Error('Not implemented');
    }

    insertBefore(element: AbstractNode, existingElement: AbstractNode): AbstractNode {
        throw new Error('Not implemented');
    }

    removeChild(child: AbstractNode) {
        throw new Error('Not implemented');
    }

    toJSON(dereference: boolean | undefined = undefined): any {
        return {
            _id: this._id,
            name: this.name,
            _type: this._type,
            ownedElements: this.getChildren().map(child => child.toJSON(dereference)),
            _parent: ReferenceNode.toJSON(this._parent)
        };
    }

    static fromJSON = function (json: any, refCache: ReferenceCache): AbstractNode | undefined {
        const nodeClass = classFactory[json._type];
        if (!nodeClass || !nodeClass.fromJSON) {
            console.error('Unknown nodeType: ' + json._type);
            return;
        }
        return nodeClass.fromJSON(json, refCache);
    };

    fixReferences(refCache: ReferenceCache) {
       this.fixReference('_parent', refCache);
       this.getChildren().forEach(child => child.fixReferences(refCache));
    }


    fixReference(propName: string, refCache: ReferenceCache) {
        const node = this[propName as keyof this] as any;
        if (node && node instanceof ReferenceNode) {
            const deref = refCache.getReference(node.$ref);
            if (deref) {
                (this as any)[propName] = deref;
            }
            else {
                console.error(`Could not resolve reference: ${node.$ref} for object id ${this._id}`);
            }
        }
    }


    gatherAll(umlNodeType: string): { packageName: string | null; node: AbstractNode }[] {
        const result: { packageName: string | null; node: AbstractNode }[] = [];

        for (const child of this.getChildren()) {
                const matchingNodes = AbstractNode.findAllNodesOfType(child, umlNodeType);

                for (const node of matchingNodes) {
                    const packageName = this.findPackageName(node);
                    result.push({ packageName, node });
                }
        }

        // Sort the result by packageName, grouping entries with the same packageName together
        result.sort((a, b) => {
            const nameA = a.packageName || '';
            const nameB = b.packageName || '';
            return nameA.localeCompare(nameB);
        });

        return result;
    }


    findPackageName(node: AbstractNode): string | null {
        let currentNode: AbstractNode | undefined = node._parent as AbstractNode | undefined;

        while (currentNode) {
            if (currentNode instanceof PackageNode) {
                return currentNode.name;
            }
            currentNode = currentNode._parent as AbstractNode | undefined;
        }

        return null;
    } 

    static findAllNodesOfType(node: AbstractNode, nodeType: string): AbstractNode[] {
        return AbstractNode.findAllMatchingNodes(node, (child) => child._type === nodeType);
    }

    static findAllMatchingNodes(node: AbstractNode, matchFunction: (node: AbstractNode) => boolean): AbstractNode[] {
        let result: AbstractNode[] = [];

        if (matchFunction(node)) {
            result.push(node);
        }

        for (const child of node.getChildren()) {
            result = result.concat(AbstractNode.findAllMatchingNodes(child, matchFunction));
        }

        return result;
    }
}


export class ProjectNode extends AbstractNode {
    model: ModelNode;
    profiles: ProfileRootNode;
    refCache: ReferenceCache;
    documentUri: vscode.Uri | null;
    
    constructor(name: string) {
        super(name, 'Project');
        this.model = new ModelNode('Model');
        this.model._parent = this;
        this.profiles = new ProfileRootNode('Profiles');
        this.profiles._parent = this;
        this.refCache = new ReferenceCache();
        this.documentUri = null;
    }

    metaNodeAdded(element: MetaElementNode) {
        this.refCache.save(element);
    }

    findById(id: string): AbstractNode | undefined {
        const node = this.refCache.getReference(id);
        return node;
    }

    allowableChildren(): Array<new (...args: any[]) => AbstractNode> {
        return [ModelNode, ProfileRootNode]; 
    }

    getChildren(): AbstractNode[] {
        return [this.model, this.profiles];
    }

    toJSON(dereference: boolean | undefined = undefined): any {
        const ownedElements: AbstractNode[] = [this.model];
        ownedElements.push(...this.profiles.profiles);
        return {
            _id: this._id,
            name: this.name,
            _type: this._type,
            ownedElements: ownedElements.map(child => child.toJSON(dereference)),
        };
    }

    /**
     * Creates a new meta node out of the data stored in the JSON
     * @param json The JSON that corresponds to a single new MetaElementNode
     */
    metaFactory(json: any) : MetaElementNode | null {
        let node = AbstractNode.fromJSON(json, this.refCache);
        if (node instanceof MetaElementNode) {
            return node;
        }
        return null;
    }


    static fromJSON(json: any): ProjectNode {
        const project = new ProjectNode(json.name);
        project._id = json._id;
        project.refCache.save(project);

        if (json.ownedElements) {
            json.ownedElements.forEach((childJson: any) => {
                const child = AbstractNode.fromJSON(childJson, project.refCache);
                if (child instanceof ModelNode) {
                    project.model = child;
                } else if (child instanceof ProfileNode) {
                    project.profiles.addProfile(child);
                }
            });
        }

        project.model.fixReferences(project.refCache);
        project.profiles.fixReferences(project.refCache);
        
        return project;
    }

    static getBlankProject(name: string = 'untitled'): ProjectNode {
        const project = new ProjectNode(name);
        const diagram = new ClassDiagramNode('Class Diagram');
        project.model.addChild(diagram);

        const profDataTypes = project.profiles.addProfile(new ProfileNode('Data Types'));
            const pkgPrimatives = profDataTypes.addChild(new PackageNode('Primatives'));
                pkgPrimatives.addChild(new DataTypeNode('void'));
                const dtString = new DataTypeNode('String');
                pkgPrimatives.addChild(dtString);
                const number = pkgPrimatives.addChild(new DataTypeNode('Number'));
                    number.addTagValue('minVal', '-999999999.9999');
                    number.addTagValue('maxVal', '999999999.9999');
                pkgPrimatives.addChild(new DataTypeNode('Boolean'));
                pkgPrimatives.addChild(new DataTypeNode('Text'));

            const pkgDateTime = profDataTypes.addChild(new PackageNode('Date and time'));
                pkgDateTime.addChild(new DataTypeNode('DateTime'));
                pkgDateTime.addChild(new DataTypeNode('Date'));
                pkgDateTime.addChild(new DataTypeNode('Time'));

            const pkgNumeric = profDataTypes.addChild(new PackageNode('Precision numbers'));
                const integer = pkgNumeric.addChild(new DataTypeNode('Integer'));
                    integer.addTagValue('minVal', '-999999999');
                    integer.addTagValue('maxVal', '999999999');
                const decimal = pkgNumeric.addChild(new DataTypeNode('Decimal'));
                    decimal.addTagValue('minVal', '-999999999.9999');
                    decimal.addTagValue('maxVal', '999999999.9999');
                const currency = pkgNumeric.addChild(new DataTypeNode('Currency'));
                    currency.addTagValue('minVal', '-999999999.99');
                    currency.addTagValue('maxVal', '999999999.99');

            const pkgTech = profDataTypes.addChild(new PackageNode('Technology'));
                const dtPassword = new DataTypeNode('Password');
                pkgTech.addChild(dtPassword);
                pkgTech.addChild(new DataTypeNode('Email'));
                pkgTech.addChild(new DataTypeNode('Url'));


        const profKoaReact = project.profiles.addProfile(new ProfileNode('NodeMDA'));
            const pkgStereo = profKoaReact.addChild(new PackageNode('Stereotypes'));
                const stEntity = new StereotypeNode('Entity');
                pkgStereo.addChild(stEntity);
                pkgStereo.addChild(new StereotypeNode('Enumeration'));
                pkgStereo.addChild(new StereotypeNode('POJO'));
                pkgStereo.addChild(new StereotypeNode('Service'));

            const pkgActors = profKoaReact.addChild(new PackageNode('Security'));
                pkgActors.addChild(new ActorNode('User'));
                pkgActors.addChild(new ActorNode('Admin'));
                pkgActors.addChild(new ActorNode('Guest'));
                const dtSystemRole = new DataTypeNode('SystemRole');
                pkgActors.addChild(dtSystemRole);

            const pkgTags = profKoaReact.addChild(new PackageNode('Special tags'));        
                const pkgTagEntity = pkgTags.addChild(new PackageNode('For Entities'));
                    pkgTagEntity.addChild(new TagNode('noUI', 'true'));
                    pkgTagEntity.addChild(new TagNode('noREST', 'true'));
                const pkgTagAttributes = pkgTags.addChild(new PackageNode('For attributes'));
                    pkgTagAttributes.addChild(new TagNode('uiTableColumn', 'true'));
                    pkgTagAttributes.addChild(new TagNode('unique', 'true'));
                    pkgTagAttributes.addChild(new TagNode('dbIndex', 'true'));
                const pkgTagDep = pkgTags.addChild(new PackageNode('For Dependencies'));
                    pkgTagDep.addChild(new TagNode('permissions', 'own,read,write,del'));

        const userClass = new ClassNode('User');
        userClass.stereotypes.push(stEntity);

        const attrUserName = new AttributeNode('username');
        attrUserName.type = dtString;
        attrUserName.multiplicity = "1";
        userClass.addChild(attrUserName);

        const attrPassword = new AttributeNode('password');
        attrPassword.type = dtPassword;
        attrPassword.multiplicity = "1";
        userClass.addChild(attrPassword);

        const attrSystemRole = new AttributeNode('roles');
        attrSystemRole.type = dtSystemRole;
        attrSystemRole.multiplicity = "0..*";
        userClass.addChild(attrSystemRole);

        project.model.addChild(userClass);

        diagram.graph = {
            "cells": [
              {
                "type": "custom.UMLClass",
                "metaId": userClass._id,
                "name": "User",
                "packageName": "(root)",
                "stereotypes": [
                  "<<Entity>>"
                ],
                "attributes": [
                  "+username: String [1]",
                  "+password: Password [1]",
                  "+roles: SecurityRole [0..*]"
                ],
                "methods": [
                  ""
                ],
                "position": {
                  "x": 30,
                  "y": 30
                },
                "size": {
                  "width": 234.5,
                  "height": 140.14
                },
                "angle": 0,
                "id": "61b10d2c-d952-4540-8975-7ba86d8d9c75",
                "z": 1,
                "attrs": {
                  "umlClassNameRect": {
                    "height": 63.14
                  },
                  "umlClassAttrsRect": {
                    "height": 54,
                    "transform": "translate(0,63.14)"
                  },
                  "umlClassMethodsRect": {
                    "height": 23,
                    "transform": "translate(0,117.14)"
                  },
                  "umlClassStereoText": {
                    "text": "<<Entity>>"
                  },
                  "umlClassPackageText": {
                    "ref-y": 19.44,
                    "text": "(root)"
                  },
                  "umlClassNameText": {
                    "ref-y": 37.44,
                    "text": "User"
                  },
                  "umlClassAttrsText": {
                    "text": "+username: String [1]\n+password: Password [1]\n+roles: SecurityRole [0..*]"
                  },
                  "umlClassMethodsText": {
                    "text": ""
                  }
                }
              }
            ]
          };

        return project;        
    }

}
classFactory.Project = ProjectNode;


export class ProfileRootNode extends AbstractNode {
    profiles: ProfileNode[];
    
    constructor(name: string) {
        super(name, 'Profiles');
        this.profiles = [];
    }

    addProfile(profile: ProfileNode): ProfileNode {
        this.profiles.push(profile);
        return profile;
    }

    allowableChildren(): Array<new (...args: any[]) => AbstractNode> {
        return [ProfileNode]; 
    }

    getChildren(): ProfileNode[] {
        return this.profiles;
    }

    removeChild(element: AbstractNode) {
        if (element instanceof ProfileNode) {
            const index = this.profiles.indexOf(element);
            if (index > -1) {
                this.profiles.splice(index, 1);
            }
        }
        else {
            console.error(`ProfileRootNode.removeChild: element ${element._id} is not my child`);
        }
    }


}

export enum UMLVisibility {
    PUBLIC = 'public',
    PROTECTED = 'protected',
    PRIVATE = 'private'
}


/**
 * All nodes that are actual UML elements inherit from this MetaElementNode
 */
export class MetaElementNode extends AbstractNode {
    protected ownedElements: MetaElementNode[];
    stereotypes: StereotypeNode[];
    tags: TagNode[];
    comment: string;
    visibility: UMLVisibility;


    constructor(
        name: string, 
        nodeType: string, 
    ) {
        super(name, nodeType);
        this.ownedElements = [];
        this.stereotypes = [];
        this.tags = [];
        this.comment = '';
        this.visibility = UMLVisibility.PUBLIC;
    }

    addTag(tag: TagNode): TagNode {
        this.tags.push(tag);
        tag._parent = this;
        return tag;
    }

    addTagValue(tagName: string, value: string): TagNode {
        return this.addTag(new TagNode(tagName, value));
    }

    addChild(element: MetaElementNode): MetaElementNode {
        this.ownedElements.push(element);
        element._parent = this;
        this.sortChildren();
        return element;
    }

    insertFirst(element: MetaElementNode) : MetaElementNode {
        this.ownedElements.unshift(element);
        element._parent = this;
        this.sortChildren();
        return element;
    }

    insertBefore(element: MetaElementNode, existingElement: MetaElementNode): MetaElementNode {
        const index = this.ownedElements.indexOf(existingElement);
        if (index > -1) {
            this.ownedElements.splice(index, 0, element);
            element._parent = this;
        }
        else {
            this.addChild(element);
        }
        this.sortChildren();
        return element;
    }


    protected sortChildren() {
    }

    removeChild(element: MetaElementNode) {
        this.ownedElements = this.ownedElements.filter(child => child !== element);
    }

    getChildren(): MetaElementNode[] {
        return this.ownedElements;
    }


    toJSON(dereference: boolean | undefined = undefined): any {
        return {
            ...super.toJSON(dereference),
            stereotypes: dereference ? this.stereotypes : this.stereotypes.map((stereotype) => ReferenceNode.toJSON(stereotype) ),
            tags: dereference ? this.tags : this.tags.map((tag) => tag.toJSON(dereference) ),
            comment: this.comment,
            visibility: this.visibility
        };
    }

    static fromJSON(json: any, refCache: ReferenceCache): MetaElementNode {
        const node = new MetaElementNode(json.name, json._type);
        if (json._id) {
            node._id = json._id;
        }
        node.comment = json.comment || '';
        node.visibility = json.visibility || UMLVisibility.PUBLIC;
        if (json._parent) {
            node._parent = ReferenceNode.fromJSON(json._parent, refCache);
        }

        // Save node for future use...
        refCache.save(node);

        // Deserialize ownedElements
        node.ownedElements = (json.ownedElements || []).map((childJson: any) => {
            const child = AbstractNode.fromJSON(childJson, refCache) as MetaElementNode;
            child._parent = new ReferenceNode(node._id);
            return child;
        });

        node.stereotypes = (json.stereotypes || []).map((jsStereotype: any) => {
             const child = ReferenceNode.fromJSON(jsStereotype, refCache);
             return child;
        });

        // Deserialize tags
        node.tags = (json.tags || []).map((tagJson: any) => {
            const child = TagNode.fromJSON(tagJson, refCache);
            child._parent = new ReferenceNode(node._id);
            return child;
        });
        return node;
    }

    fixReferences(refCache: ReferenceCache) {
        super.fixReferences(refCache);
        this.stereotypes = this.stereotypes.map((stereotype) => {
            if (stereotype instanceof ReferenceNode) {
                const deref = refCache.getReference(stereotype.$ref);
                if (deref) {
                    return deref;
                }
            }
            return stereotype;
        }) as StereotypeNode[];

        this.tags.forEach((tag) => {
            if (tag._parent instanceof ReferenceNode) {
                const deref = refCache.getReference(tag._parent.$ref);
                if (deref) {
                    tag._parent = deref;
                }
            }
        });
     }
}


export class StereotypeNode extends MetaElementNode {
    constructor(name: string) {
        super(name, 'UMLStereotype');
    }


    static fromJSON(json: any, refCache: ReferenceCache): StereotypeNode {
        const node = new StereotypeNode(json.name);
        const superNode = MetaElementNode.fromJSON(json, refCache);
        Object.assign(node, superNode);
        refCache.save(node);
        return node;
    }      
}
classFactory.UMLStereotype = StereotypeNode;


export class TagNode extends MetaElementNode {
    value: string;
    constructor(name: string, value: string = '') {
        super(name, 'UMLTag');
        this.value = value;
    }


    toJSON(dereference: boolean | undefined = undefined): any {
        return {
            ...super.toJSON(dereference),
            value: this.value
        };
    }

    static fromJSON(json: any, refCache: ReferenceCache): TagNode {
        const node = new TagNode(json.name);
        node.value = json.value || '';
        const superNode = MetaElementNode.fromJSON(json, refCache);
        Object.assign(node, superNode);
        refCache.save(node);        
        return node;
    }       
}
classFactory.UMLTag = TagNode;


export class ModelNode extends MetaElementNode {
    private __classDiagram: ClassDiagramNode | undefined;

    constructor(name: string) {
        super(name, 'UMLModel');
    }

    allowableChildren(): Array<new (...args: any[]) => AbstractNode> {
        return [ClassNode, PackageNode, ClassDiagramNode, ActorNode, StereotypeNode, DataTypeNode, TagNode, LinkNode]; 
    }


    get diagram(): ClassDiagramNode | undefined {
        if (this.__classDiagram) {
            return this.__classDiagram;
        }

        // See if we can find the diagram among the children
        for (const child of this.ownedElements) {
            if (child instanceof ClassDiagramNode) {
                this.__classDiagram = child;
                return this.__classDiagram;
            }
        }
        return undefined;
    }

    static fromJSON(json: any, refCache: ReferenceCache): ModelNode {
        const node = new ModelNode(json.name);
        const superNode = MetaElementNode.fromJSON(json, refCache);
        Object.assign(node, superNode);
        refCache.save(node);
        return node;
    }      
}
classFactory.UMLModel = ModelNode;


export class ProfileNode extends MetaElementNode {
    constructor(name: string) {
        super(name, 'UMLProfile');
    }

    allowableChildren(): Array<new (...args: any[]) => AbstractNode> {
        return [PackageNode, DataTypeNode, ActorNode, StereotypeNode, TagNode]; 
    }

    static fromJSON(json: any, refCache: ReferenceCache): ProfileNode {
        const node = new ProfileNode(json.name);
        const superNode = MetaElementNode.fromJSON(json, refCache);
        Object.assign(node, superNode);
        refCache.save(node);
        return node;
    }         
}
classFactory.UMLProfile = ProfileNode;


export class PackageNode extends MetaElementNode {
    constructor(name: string) {
        super(name, 'UMLPackage');
    }

    allowableChildren(): Array<new (...args: any[]) => AbstractNode> {
        return [ClassNode, PackageNode, ClassDiagramNode, ActorNode, StereotypeNode, DataTypeNode, TagNode, LinkNode]; 
    }

    static fromJSON(json: any, refCache: ReferenceCache): PackageNode {
        const node = new PackageNode(json.name);
        const superNode = MetaElementNode.fromJSON(json, refCache);
        Object.assign(node, superNode);
        refCache.save(node);
        return node;
    }         

}
classFactory.UMLPackage = PackageNode;


export class ActorNode extends MetaElementNode {
    constructor(name: string) {
        super(name, 'UMLActor');
    }


    toJSON(dereference: boolean | undefined = undefined): any {
        return super.toJSON(dereference);
    }

    static fromJSON(json: any, refCache: ReferenceCache): ActorNode {
        const node = new ActorNode(json.name);
        const superNode = MetaElementNode.fromJSON(json, refCache);
        Object.assign(node, superNode);
        refCache.save(node);
        return node;
    }         

}
classFactory.UMLActor = ActorNode;


export class ClassNode extends MetaElementNode {

    constructor(name: string) {
        super(name, 'UMLClass');
    }

    allowableChildren(): Array<new (...args: any[]) => AbstractNode> {
        return [AttributeNode, OperationNode]; 
    }

    get packageName(): string {
        const packageNames: string[] = [];
        let parent = this._parent;
        while (parent instanceof PackageNode) {
            packageNames.unshift(parent.name);
            parent = parent._parent;    
        }
        return packageNames.join(':');
    }


    protected sortChildren() {
        const attribs = this.ownedElements.filter(e => e instanceof AttributeNode) as MetaElementNode[];
        const ops = this.ownedElements.filter(e => e instanceof OperationNode) as MetaElementNode[];
        this.ownedElements = attribs.concat(ops);
    }

    toJSON(dereference: boolean | undefined = undefined): any {
        const json = super.toJSON(dereference);
        json.packageName = this.packageName;
        return json;
    }

    static fromJSON(json: any, refCache: ReferenceCache): ClassNode {
        const node = new ClassNode(json.name);
        const superNode = MetaElementNode.fromJSON(json, refCache);
        Object.assign(node, superNode);
        refCache.save(node);
        return node;
    }         
}
classFactory.UMLClass = ClassNode;


export class DataTypeNode extends MetaElementNode {
    constructor(name: string) {
        super(name, 'UMLDataType');
    }

    canHaveChildren(): boolean {
        return false;
    }    

    static fromJSON(json: any, refCache: ReferenceCache): DataTypeNode {
        const node = new DataTypeNode(json.name);
        const superNode = MetaElementNode.fromJSON(json, refCache);
        Object.assign(node, superNode);
        refCache.save(node);
        return node;
    }      
}
classFactory.UMLDataType = DataTypeNode;

export class AbstractVariable extends MetaElementNode {
    type: DataTypeNode | ClassNode | ReferenceNode | undefined;
    isReadOnly: boolean;
    multiplicity: string;
    isUnique: boolean;
    defaultValue: string;

    constructor(name: string, nodeType: string) {
        super(name, nodeType);
        this.isReadOnly = false;
        this.isUnique = false;
        this.multiplicity = '0..1';
        this.defaultValue = '';
    }

 
    get isArray() {
        return this.multiplicity.slice(-1) === "*";
    }
    
    get isObject() {
        return (this.type instanceof ClassNode || this.type instanceof ClassReferenceNode);
    }

    toJSON(dereference: boolean | undefined = undefined): any {
        let typeNode;
        if (dereference && this?.type instanceof DataTypeNode) {
            typeNode = this.type;
        }
        else {
            typeNode = ReferenceNode.toJSON(this.type, true);
        }
        return {
            ...super.toJSON(dereference),
            "type": typeNode,
            isReadOnly: this.isReadOnly,
            isUnique: this.isUnique,
            multiplicity: this.multiplicity,
            defaultValue: this.defaultValue
        };
    }

    static fromJSON(json: any, refCache: ReferenceCache): AbstractVariable {
        const node = new AbstractVariable(json.name, json._type);
        node.type = ReferenceNode.fromJSON(json.type, refCache, true) as DataTypeNode | ClassNode | ReferenceNode;
        node.isReadOnly = json.isReadOnly || false;
        node.isUnique = json.isUnique || false;
        node.multiplicity = json.multiplicity || '0..1';
        node.defaultValue = json.defaultValue || '';
        const superNode = MetaElementNode.fromJSON(json, refCache);
        Object.assign(node, superNode);
        return node;
    }

    fixReferences(refCache: ReferenceCache) {
        super.fixReferences(refCache);
        this.fixReference('type', refCache);
    }
}

export class AttributeNode extends AbstractVariable {
    isStatic: boolean;
    constructor(name: string) {
        super(name, 'UMLAttribute');
        this.isStatic = false;
    }

    toJSON(dereference: boolean | undefined = undefined): any {
        return {
            ...super.toJSON(dereference),
            isStatic: this.isStatic
        };
    }

    static fromJSON(json: any, refCache: ReferenceCache): AttributeNode {
        const node = new AttributeNode(json.name);
        node.isStatic = json.isStatic || false;
        const superNode = AbstractVariable.fromJSON(json, refCache);
        Object.assign(node, superNode);
        refCache.save(node);        
        return node;
    }       

}
classFactory.UMLAttribute = AttributeNode;

export enum ParameterDirection {
    IN,
    OUT,
    INOUT,
    RETURN
};

export class ParameterNode extends AbstractVariable {
    direction: ParameterDirection;
    constructor(name: string) {
        super(name, 'UMLParameter');
        this.direction = ParameterDirection.IN;
    }

    toJSON(dereference: boolean | undefined = undefined): any {
        return {
            ...super.toJSON(dereference),
            direction: this.direction
        };
    }

    static fromJSON(json: any, refCache: ReferenceCache): ParameterNode {
        const node = new ParameterNode(json.name);
        node.direction = json.direction || ParameterDirection.IN;
        const superNode = AbstractVariable.fromJSON(json, refCache);
        Object.assign(node, superNode);
        refCache.save(node);        
        return node;
    }       
}
classFactory.UMLParameter = ParameterNode;


export class OperationNode extends MetaElementNode {
    returnType: DataTypeNode | ReferenceNode | undefined;

    constructor(name: string) {
        super(name, 'UMLOperation');
    }

    allowableChildren(): Array<new (...args: any[]) => AbstractNode> {
        return [ParameterNode]; 
    }

    addParameter(param: ParameterNode) {
        this.addChild(param);
    }

    toJSON(dereference: boolean | undefined = undefined): any {
        return {
            ...super.toJSON(dereference),
            returnType: dereference ? this.returnType : ReferenceNode.toJSON(this.returnType)
        };
    }

    static fromJSON(json: any, refCache: ReferenceCache): OperationNode {
        const node = new OperationNode(json.name);
        node.returnType = ReferenceNode.fromJSON(json.returnType, refCache) as DataTypeNode | ReferenceNode;
        const superNode = MetaElementNode.fromJSON(json, refCache);
        Object.assign(node, superNode);
        refCache.save(node);        
        return node;
    }
    
    fixReferences(refCache: ReferenceCache) {
        super.fixReferences(refCache);
        this.fixReference('returnType', refCache);
    }    
}
classFactory.UMLOperation = OperationNode;

export class LinkEndNode extends MetaElementNode {
    node: ClassNode | ActorNode | ReferenceNode | undefined;
    multiplicity: string | undefined;
    navigable: boolean | undefined;

    constructor(name: string) {
        super(name, 'UMLinkEnd');
    }

    toJSON(dereference: boolean | undefined = undefined): any {
        return {
            ...super.toJSON(dereference),
            "node": dereference ? this.node : ReferenceNode.toJSON(this.node),
            multiplicity: this.multiplicity,
            navigable: this.navigable
        };
    }

    static fromJSON(json: any, refCache: ReferenceCache): LinkEndNode {
        const node = new LinkEndNode(json.name);
        node.multiplicity = json.multiplicity;
        node.navigable = json.navigable;
        node.node = ReferenceNode.fromJSON(json.node, refCache) as ClassNode | ActorNode | ReferenceNode;
        const superNode = MetaElementNode.fromJSON(json, refCache);
        Object.assign(node, superNode);
        refCache.save(node);
        return node;
    }

    fixReferences(refCache: ReferenceCache) {
        super.fixReferences(refCache);
        this.fixReference('node', refCache);
    }
}
classFactory.UMLinkEnd = LinkEndNode;


export class LinkNode extends MetaElementNode {
    end1: LinkEndNode;
    end2: LinkEndNode;
    constructor(name: string, nodeType: string) {
        super(name, nodeType);
        this.end1 = new LinkEndNode('end1');
        this.end2 = new LinkEndNode('end2');
    }

    canHaveChildren(): boolean {
        return false;
    }
    
    toJSON(dereference: boolean | undefined = undefined): any {
        return {
            ...super.toJSON(dereference),
            end1: this.end1.toJSON(dereference),
            end2: this.end2.toJSON(dereference)
        };
    }

    static fromJSON(json: any, refCache: ReferenceCache): LinkNode {
        const node = new LinkNode(json.name, json._type);
        node.end1 = LinkEndNode.fromJSON(json.end1, refCache);
        node.end2 = LinkEndNode.fromJSON(json.end2, refCache);
        const superNode = MetaElementNode.fromJSON(json, refCache);
        Object.assign(node, superNode);
        return node;
    }
    
    fixReferences(refCache: ReferenceCache) {
        super.fixReferences(refCache);
        this.fixReference('end1', refCache);
        this.fixReference('end2', refCache);
    }
}

export class AssociationNode extends LinkNode {
    constructor(name: string) {
        super(name, 'UMLAssociation');
    }

    static fromJSON(json: any, refCache: ReferenceCache): AssociationNode {
        const node = new AssociationNode(json.name);
        const superNode = LinkNode.fromJSON(json, refCache);
        Object.assign(node, superNode);
        refCache.save(node);        
        return node;
    }      
}
classFactory.UMLAssociation = AssociationNode;


export class DependencyNode extends LinkNode {
    constructor(name: string) {
        super(name, 'UMLDependency');

    }

    static fromJSON(json: any, refCache: ReferenceCache): DependencyNode {
        const node = new DependencyNode(json.name);
        const superNode = LinkNode.fromJSON(json, refCache);
        Object.assign(node, superNode);
        refCache.save(node);        
        return node;
    }      

}
classFactory.UMLDependency = DependencyNode;


export class GeneralizationNode extends LinkNode {
    constructor(name: string) {
        super(name, 'UMLGeneralization');
        this.end1.navigable = false;
        this.end2.navigable = true;
    }

    static fromJSON(json: any, refCache: ReferenceCache): GeneralizationNode {
        const node = new GeneralizationNode(json.name);
        const superNode = LinkNode.fromJSON(json, refCache);
        Object.assign(node, superNode);
        refCache.save(node);        
        return node;
    }         
}
classFactory.UMLGeneralization = GeneralizationNode;


export class ClassDiagramNode extends MetaElementNode {
    public graph: any = { cells: [] };

    constructor(name: string) {
        super(name, 'UMLClassDiagram');
    }
    canHaveChildren(): boolean {
        return false;
    }    

    toJSON(dereference: boolean | undefined = undefined): any {
        return {
            ...super.toJSON(dereference),
            graph: this.graph
        };
    }

    static fromJSON(json: any, refCache: ReferenceCache): ClassDiagramNode {
        const node = new ClassDiagramNode(json.name);
        node.graph = json.graph;
        const superNode = MetaElementNode.fromJSON(json, refCache);
        Object.assign(node, superNode);
        return node;
    }

}
classFactory.UMLClassDiagram = ClassDiagramNode;
