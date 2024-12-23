import { AttributeEditor } from "./attributeEditor.js";
import { OperationEditor } from "./operationEditor.js";
import { CommandPalette, icons } from "./commandPalette.js";
import { verticalPusherTool, horizontalPusherTool, createMetaShape } from "./diagramEditor.js";
import { metaModel } from "./metaModel.js";
import { msgClient } from "./messageBus.js";

// -------------------------------------------------------------
// Tools
// -------------------------------------------------------------

joint.shapes.custom = joint.shapes.custom || {};

const COLOR_CONNECTOR = '#8ef56c';
const COLOR_CONNECTING = '#5bb53f';

export const HighlightAnchorPoints = joint.dia.HighlighterView.extend({
    tagName: 'g',
    attributes: {
        stroke: '#131e29',
        fill: COLOR_CONNECTOR,
        strokeWidth: 2,
    },

    highlight(cellView) {
        if (cellView?.model?.getLinkAnchors) {
            const anchors = cellView.model.getLinkAnchors();
            const children = anchors.map((anchor) => {
                return {
                    tagName: 'circle',
                    attributes: { cx: anchor.x, cy: anchor.y, r: 5 },
                };
            });
            this.renderChildren(children);
        }
    },
});


function confirmChoice(opts) {
    const params  = Object.assign({}, {
        input: "radio",
        showCancelButton: true,
        inputValidator: (value) => {
          if (!value) {
            return "You need to choose something!";
          }
        },
        customClass: {
            popup: 'vscode-swal-popup',
            header: 'vscode-swal-header',
            title: 'vscode-swal-title',
            content: 'vscode-swal-content',
            input: 'vscode-swal-radio-container',
            inputLabel: 'vscode-swal-radio-label',
            inputRadio: 'vscode-swal-radio',
            confirmButton: 'vscode-swal-confirm-button',
            cancelButton: 'vscode-swal-cancel-button',
        }
    }, opts);

    return Swal.fire(params);
}

export var activeClassEditor = null;

async function getDataTypeIdByName(name, dtCache) {
   const node = await metaModel.findDataType(name, dtCache);
   if (node) {
       return node._id;
   }
}

async function getOperationJson(jsonOperation, classMetaId) {
    const dtCache = await metaModel.getDataTypes();
    const params = [];
    for (const param of jsonOperation.ownedElements) {
        params.push({
            _type: 'UMLParameter',
            name: param.name,
            type: { $ref: await getDataTypeIdByName(param.type.name, dtCache) }
        });  
    }

    const jsonMeta = {
            _parent: { $ref: classMetaId }, 
            _type: 'UMLOperation',
            name: jsonOperation.name,
            visibility: jsonOperation.visibility,
            multiplicity: jsonOperation.multiplicity,
            returnType: { $ref: await getDataTypeIdByName(jsonOperation.returnType.name, dtCache) },
            ownedElements: params
    };

    return jsonMeta;
}


export class ClassToolBox {

    constructor() {
        this.boundaryTool = new joint.elementTools.Boundary({
            focusOpacity: 0.5,
            padding: 20,
            useModelGeometry: true
        });

        this.attributeEditorTool = new joint.elementTools.Button({
            x: '7%',
            y: '50%',
            magnet: 'body',
            scale: 1.5,
            action: async function(evt, classView, tool) {

                activeClassEditor = new AttributeEditor();
                const jsonClass = await metaModel.findId(classView.model.attributes.metaId);
                activeClassEditor.setModel(jsonClass);

                const editorDivWidth = 441; // Width of the DIV
                const paperWidth = classView.paper.el.clientWidth; // Get the display width of the paper's body

                // Get the bounding box of the shape
                const bbox = classView.getBBox();

                // Absolute positions of the shape
                const classTopRight = classView.paper.localToPagePoint(bbox.x + bbox.width, bbox.y);
                const classTopLeft = classView.paper.localToPagePoint(bbox.x, bbox.y);

                // Check if the DIV fits to the right
                if (classTopRight.x + editorDivWidth <= paperWidth) {
                    // Position the DIV to the right
                    activeClassEditor.setPosition(classTopRight.x+1, classTopRight.y+20);
                } else {
                    // Position the DIV to the left
                    let x = classTopLeft.x - editorDivWidth-2;
                    if (x < 0) { x = 0; }
                    activeClassEditor.setPosition(x, classTopRight.y+20);
                }

                // Handle meta modification events
                const classMetaId = jsonClass._id;
                activeClassEditor.onNewItem = async function(jsonAttribute) {
                    msgClient.publish('cmdCreateNewMeta', { 
                        jsonMeta: {
                            _parent: { $ref: classMetaId }, 
                            _type: 'UMLAttribute',
                            name: jsonAttribute.name,
                            visibility: jsonAttribute.visibility,
                            multiplicity: jsonAttribute.multiplicity,
                            type: { $ref: await getDataTypeIdByName(jsonAttribute.type.name) },
                        }, 
                        opts: {}
                    });
                };

                activeClassEditor.onUpdateItem = async function(jsonAttribute) {
                    msgClient.publish('cmdUpdateMetaProperties', { 
                        metaId: jsonAttribute._id,
                        updates: [
                            { propName: 'visibility', value: jsonAttribute.visibility },
                            { propName: 'name', value: jsonAttribute.name },
                            { propName: 'multiplicity', value: jsonAttribute.multiplicity },
                            { propName: 'type', value: { $ref: await getDataTypeIdByName(jsonAttribute.type.name) } }
                        ]
                    });
                };

                activeClassEditor.onRemoveItem = function(metaId) {
                    msgClient.publish('cmdRemoveMeta', metaId);
                };

                activeClassEditor.onEditorClose = function() {
                    activeClassEditor = null;
                };

                activeClassEditor.activate();
            },
            markup: [{
                tagName: 'circle',
                selector: 'button',
                attributes: {
                    'r': 7,
                    'fill': '#5bb53f',
                    'cursor': 'pointer'
                }
            }, {
                tagName: 'path',
                selector: 'icon',
                attributes: {
                    'd': 'M -4 0 L 4 0 M 0 -4 L 0 4',
                    'fill': 'none',
                    'stroke': '#FFFFFF',
                    'stroke-width': 2,
                    'pointer-events': 'none'
                }
            }]
        });

        this.operationEditorTool = new joint.elementTools.Button({
            x: '7%',
            y: '95%',
            magnet: 'body',
            scale: 1.5,
            action: async function(evt, classView, tool) {

                activeClassEditor = new OperationEditor();
                const jsonClass = await metaModel.findId(classView.model.attributes.metaId);
                activeClassEditor.setModel(jsonClass);

                const editorDivWidth = 441; // Width of the DIV
                const paperWidth = classView.paper.el.clientWidth; // Get the display width of the paper's body

                // Get the bounding box of the shape
                const bbox = classView.getBBox();

                // Absolute positions of the shape
                const classTopRight = classView.paper.localToPagePoint(bbox.x + bbox.width, bbox.y);
                const classTopLeft = classView.paper.localToPagePoint(bbox.x, bbox.y);

                // Check if the DIV fits to the right
                if (classTopRight.x + editorDivWidth <= paperWidth) {
                    // Position the DIV to the right
                    activeClassEditor.setPosition(classTopRight.x+1, classTopRight.y+20);
                } else {
                    // Position the DIV to the left
                    let x = classTopLeft.x - editorDivWidth-2;
                    if (x < 0) { x = 0; }
                    activeClassEditor.setPosition(x, classTopRight.y+20);
                }

                // Handle meta modification events
                const classMetaId = jsonClass._id;
                activeClassEditor.onNewItem = async function(jsonOperation) {
                    const jsonMeta = await getOperationJson(jsonOperation, classMetaId);
                    msgClient.publish('cmdCreateNewMeta', { 
                        jsonMeta, 
                        opts: {}
                    });
                };

                activeClassEditor.onUpdateItem = async function(jsonOperation) {
                    const jsonMeta = await getOperationJson(jsonOperation, classMetaId);
                    msgClient.publish('cmdUpdateMetaProperties', { 
                        metaId: jsonOperation._id,
                        updates: [
                            { propName: 'visibility', value: jsonMeta.visibility },
                            { propName: 'name', value: jsonMeta.name },
                            { propName: 'multiplicity', value: jsonMeta.multiplicity },
                            { propName: 'ownedElements', value: jsonMeta.ownedElements },
                            { propName: 'returnType', value: jsonMeta.returnType },
                        ]
                    });
                };

                activeClassEditor.onRemoveItem = function(metaId) {
                    msgClient.publish('cmdRemoveMeta', metaId);
                };

                activeClassEditor.onEditorClose = function() {
                    activeClassEditor = null;
                };

                activeClassEditor.activate();
            },
            markup: [{
                tagName: 'circle',
                selector: 'button',
                attributes: {
                    'r': 7,
                    'fill': '#5bb53f',
                    'cursor': 'pointer'
                }
            }, {
                tagName: 'path',
                selector: 'icon',
                attributes: {
                    'd': 'M -4 0 L 4 0 M 0 -4 L 0 4',
                    'fill': 'none',
                    'stroke': '#FFFFFF',
                    'stroke-width': 2,
                    'pointer-events': 'none'
                }
            }]
        });


        this.removeButton = new joint.elementTools.Remove({
            focusOpacity: 0.5,
            rotate: true,
            x: '0%',
            y: '0%',
            offset: { x: 0, y: 0 },
            action: function(evt, elementView, toolView) {

                confirmChoice({
                    title: "Remove Element",
                    inputOptions: {
                        "fromModel": "Remove from model",
                        "fromDiagram": "Remove from diagram only"
                    },
                  }).then((result) => {
                      const { value: choice } = result;
                      if (choice === "fromModel") {
                         console.log(`Request removal of meta id ${elementView.model.attributes.metaId} from model`);
                         msgClient.publish('cmdRemoveMeta', elementView.model.attributes.metaId);
                      }
                      else if (choice === "fromDiagram") {
                         console.log(`Removing shape ${elementView.model.id} from diagram`);
                         elementView.model.remove({ ui: true, tool: toolView.cid });
                      }

                  });
            },
            scale: 1.5
        });     
        
        this.toolBox = new joint.dia.ToolsView({
            tools: [
                this.boundaryTool, 
                this.attributeEditorTool,
                this.operationEditorTool,
                this.removeButton
            ]
        });        
    }

    static get defaultTools() {
        if (!ClassToolBox.defaultToolBox) {
            ClassToolBox.defaultToolBox = new ClassToolBox();
        }
        return ClassToolBox.defaultToolBox.toolBox;
    }    
}


// Inside of a linkTool anchor method:
// const linkView = this.relatedView;
// const position = linkView.sourcePoint;
// const anchor = linkView.sourceAnchor;
// const linkModel = linkView.model;
// const sourceModel = linkView.sourceView.model;
// const targetModel = linkView.targetView.model;




joint.linkTools.CustomSourceAnchor = joint.linkTools.SourceAnchor.extend({
    onPointerMove(evt) {
        joint.linkTools.SourceAnchor.prototype.onPointerMove.call(this, evt);
        this?.relatedView?.model?.refreshLabels();
    },

    onPointerDown: function(evt) {
        joint.linkTools.SourceAnchor.prototype.onPointerDown.call(this, evt);
        const source = this?.relatedView?.model?.get('source');
        this._moveUndo = new AnchorMoveUndo(this.relatedView.model.id, 'source', source);
    },

    onPointerUp: function(evt) {
        joint.linkTools.SourceAnchor.prototype.onPointerUp.call(this, evt);

        const source = this?.relatedView?.model?.get('source');

        normalizeAnchor(this?.relatedView?.model, 'source', source);
        if (this?.relatedView?.model.refreshLabels) {
            this.relatedView.model.refreshLabels();
        }

        if (this._moveUndo) {
            this._moveUndo.moveCompleted(source);
            delete this._moveUndo;
        }
    }
});


function normalizeAnchor(model, propertyName, value) {
    const desiredValues = ['0%', '100%'];
    const args = value.anchor.args;
    if (desiredValues.includes(args.dx) || desiredValues.includes(args.dy)) {
        // All is good
        return;
    }

    // The anchor is NOT locked to a side. Determine
    // the closest side. First, fill the dist array
    // in a clockwise manner starting with dy in 12p
    // position.
    const dx = parseFloat(args.dx.slice(0, -1));
    const dy = parseFloat(args.dy.slice(0, -1));
    const dist = [
        Math.abs(dy),
        Math.abs(100 - dx),
        Math.abs(100 - dy),
        Math.abs(dx)
    ];

    let smallestVal = Math.min(...dist);
    let smallestIndex = dist.indexOf(smallestVal);

    switch (smallestIndex) {
        case 0:
            args.dy = '0%';
            break;
        case 1:
            args.dx = '100%';
            break;
        case 2:
            args.dy = '100%';
            break;
        case 3:
            args.dx = '0%';
            break;
    }

    model.prop(`${propertyName}.anchor.args`, args);
}

joint.linkTools.CustomTargetAnchor = joint.linkTools.TargetAnchor.extend({

    onPointerMove(evt) {
        joint.linkTools.TargetAnchor.prototype.onPointerMove.call(this, evt);
        this?.relatedView?.model?.refreshLabels();
    },

    onPointerDown: function(evt) {
        joint.linkTools.TargetAnchor.prototype.onPointerDown.call(this, evt);
        const target = this?.relatedView?.model?.get('target');
        this._moveUndo = new AnchorMoveUndo(this.relatedView.model.id, 'target', target);
    },

    onPointerUp: function(evt) {
        joint.linkTools.TargetAnchor.prototype.onPointerUp.call(this, evt);
        const target = this?.relatedView?.model?.get('target');

        normalizeAnchor(this?.relatedView?.model, 'target', target);
        if (this?.relatedView?.model.refreshLabels) {
            this.relatedView.model.refreshLabels();
        }

        if (this._moveUndo) {
            this._moveUndo.moveCompleted(target);
            delete this._moveUndo;
        }
    }    
});



export class LinkToolBox {

    constructor() {
        // Vertices and Segments are not supported by rightAngle router
        // Only compatible with "normal" router
        // this.verticesTool = new joint.linkTools.Vertices();
        // this.segmentsTool = new joint.linkTools.Segments();
        this.sourceArrowheadTool = new joint.linkTools.SourceArrowhead();
        this.targetArrowheadTool = new joint.linkTools.TargetArrowhead();
        this.sourceAnchorTool = new joint.linkTools.CustomSourceAnchor();
        this.targetAnchorTool = new joint.linkTools.CustomTargetAnchor();
        this.boundaryTool = new joint.linkTools.Boundary();
        this.removeButton = new joint.linkTools.Remove({
            distance: '88%',
            action: function(evt, linkView, toolView) {
                confirmChoice({
                    title: "Remove Link",
                    inputOptions: {
                        "fromModel": "Remove from model",
                        "fromDiagram": "Remove from diagram only"
                    },
                  }).then((result) => {
                      const { value: choice } = result;
                      if (choice === "fromModel") {
                         console.log(`Request removal of link meta id ${linkView.model.attributes.metaId} from model`);
                         msgClient.publish('cmdRemoveMeta', linkView.model.attributes.metaId);
                      }
                      else if (choice === "fromDiagram") {
                         console.log(`Removing link shape ${linkView.model.id} from diagram`);
                         linkView.model.remove({ ui: true, tool: toolView.cid });
                      }

                  });
            },
            scale: 1.5
        });

        this.toolBox = new joint.dia.ToolsView({
            tools: [
//                this.verticesTool, this.segmentsTool,
                this.sourceAnchorTool, this.targetAnchorTool,
                this.boundaryTool, this.removeButton
            ]
        });
    }

    static get defaultTools() {
        if (!LinkToolBox.defaultToolBox) {
            LinkToolBox.defaultToolBox = new LinkToolBox();
        }
        return LinkToolBox.defaultToolBox.toolBox;
    }
}



export class ActorToolBox {

    constructor() {
        this.boundaryTool = new joint.elementTools.Boundary({
            focusOpacity: 0.5,
            padding: 20,
            useModelGeometry: true
        });


        this.removeButton = new joint.elementTools.Remove({
            focusOpacity: 0.5,
            rotate: true,
            x: '50%',
            y: '0%',
            offset: { x: 0, y: 0 },
            action: function(evt, elementView, toolView) {

                confirmChoice({
                    title: "Remove Actor",
                    inputOptions: {
                        "fromModel": "Remove from model",
                        "fromDiagram": "Remove from diagram only"
                    },
                  }).then((result) => {
                      const { value: choice } = result;
                      if (choice === "fromModel") {
                         console.log(`Request removal of meta id ${elementView.model.attributes.metaId} from model`);
                         msgClient.publish('cmdRemoveMeta', elementView.model.attributes.metaId);
                      }
                      else if (choice === "fromDiagram") {
                         console.log(`Removing shape ${elementView.model.id} from diagram`);
                         elementView.model.remove({ ui: true, tool: toolView.cid });
                      }

                  });
            },
            scale: 1.5
        });     
        
        this.toolBox = new joint.dia.ToolsView({
            tools: [
                this.boundaryTool, 
                this.removeButton
            ]
        });        
    }

    static get defaultTools() {
        if (!ActorToolBox.defaultToolBox) {
            ActorToolBox.defaultToolBox = new ActorToolBox();
        }
        return ActorToolBox.defaultToolBox.toolBox;
    }    
}




// Returns TRUE if shapeModel represents a UMLClass and if a click at 
// specified localClickPos (which is in the shape's local coords)
// is close to the left or right of the shape's border.
function canStartClassLink(shapeModel, shapeClickPos) {
    if (shapeModel?.attributes?.type === 'custom.UMLClass') {
       const bbox = shapeModel.getBBox();
       return (shapeClickPos.x <= 20 || shapeClickPos.x >= bbox.width - 20) ||
              (shapeClickPos.y <= 20 || shapeClickPos.y >= bbox.height - 20);
    }
    return false;
}


// Returns TRUE if shapeModel represents a UMLClass and if a click at 
// specified localClickPos (which is in the shape's local coords)
// is close to the top or bottom of the shape's border.
function canStartGeneralization(shapeModel, shapeClickPos) {
    if (shapeModel?.attributes?.type === 'custom.UMLClass') {
       const bbox = shapeModel.getBBox();
       return (shapeClickPos.y <= 20 || shapeClickPos.y >= bbox.height - 20);
    }
    return false;
}



// Creates an association between sourceModel and targetModel provided
// they are both UMLClass shapes. If the link is considered invalid,
// do nothing.
function createAssociation(sourceModel, sourcePos, targetModel, targetPos) {
    if (sourceModel?.attributes?.type === 'custom.UMLClass' && 
        targetModel?.attributes?.type === 'custom.UMLClass') {
            metaModel.findId(sourceModel.attributes.metaId)
            .then(sourceNode => {
                msgClient.publish('cmdCreateNewMeta', { 
                    jsonMeta: { 
                        _parent: sourceNode?._parent,
                        name: `${sourceModel.attributes.name}To${targetModel.attributes.name}`,
                        _type: 'UMLAssociation',
                        end1: {
                            navigable: false,
                            node: { $ref: sourceModel.attributes.metaId }
                        },
                        end2: {
                            navigable: true,
                            multiplicity: '0..*',
                            node: { $ref: targetModel.attributes.metaId }
                        }
                    } , 
                    opts: {
                        sourcePos,
                        targetPos,
                        sourceShapeId: sourceModel.id,
                        targetShapeId: targetModel.id
                    }});
            });
            ActiveTool.clear();
        }
}



// Creates a dependency between sourceModel and targetModel provided
// they are both UMLClass or UMLActor shapes. If the link is considered invalid,
// do nothing.
function createDependency(sourceModel, sourcePos, targetModel, targetPos) {
    const allowedTypes = ['custom.UMLClass', 'custom.UMLActor'];
    if (allowedTypes.includes(sourceModel?.attributes?.type) && 
        allowedTypes.includes(targetModel?.attributes?.type)) {
            metaModel.findId(sourceModel.attributes.metaId)
            .then(sourceNode => {
                msgClient.publish('cmdCreateNewMeta', { 
                    jsonMeta: { 
                        _parent: sourceNode?._parent,
                        name: `${sourceModel.attributes.name}To${targetModel.attributes.name}`,
                        _type: 'UMLDependency',
                        end1: {
                            navigable: false,
                            node: { $ref: sourceModel.attributes.metaId }
                        },
                        end2: {
                            navigable: true,
                            node: { $ref: targetModel.attributes.metaId }
                        }
                    } , 
                    opts: {
                        sourcePos,
                        targetPos,
                        sourceShapeId: sourceModel.id,
                        targetShapeId: targetModel.id
                    }});
            });
            ActiveTool.clear();
    }
}



// Creates a generallization between sourceModel and targetModel provided
// they are both UMLClass shapes. If the link is considered invalid,
// do nothing.
function createGeneralization(sourceModel, sourcePos, targetModel, targetPos) {
    if (sourceModel?.attributes?.type === 'custom.UMLClass' && 
        targetModel?.attributes?.type === 'custom.UMLClass') {
            metaModel.findId(sourceModel.attributes.metaId)
            .then(sourceNode => {
                msgClient.publish('cmdCreateNewMeta', { 
                    jsonMeta: { 
                        _parent: sourceNode?._parent,
                        name: `${sourceModel.attributes.name}To${targetModel.attributes.name}`,
                        _type: 'UMLGeneralization',
                        end1: {
                            navigable: false,
                            node: { $ref: sourceModel.attributes.metaId }
                        },
                        end2: {
                            navigable: true,
                            node: { $ref: targetModel.attributes.metaId }
                        }
                    } , 
                    opts: {
                        sourcePos,
                        targetPos,
                        sourceShapeId: sourceModel.id,
                        targetShapeId: targetModel.id
                    }});
            });
            ActiveTool.clear();
    }
}


function createNewClassOnClick(stereotypeName) {
    return function(clickPos) {
        if (stereotypeName) {
            metaModel.findStereotype(stereotypeName)
            .then((stereotype) => {
                if (stereotype) {
                    return msgClient.publish('cmdCreateNewMeta', { jsonMeta: { _type: 'UMLClass', stereotypes: [ { $ref: stereotype._id} ]} , opts: { pos: clickPos }});
                }
                else {
                    console.error(`Could not find stereotype ${stereotypeName} in model. Creating naked class`);                
                    return msgClient.publish('cmdCreateNewMeta', { jsonMeta: { _type: 'UMLClass'} , opts: { pos: clickPos }});
                }
            });
        }
        else {
            msgClient.publish('cmdCreateNewMeta', { jsonMeta: { _type: 'UMLClass'} , opts: { pos: clickPos }});
        }
        ActiveTool.clear();          
    };
}


function addActorOnClickWithName(actorName) {
    return function(clickPos) {
        metaModel.findActor(actorName)
        .then((actor) => {
            if (actor) {
                msgClient.publish('cmdAddToDiagram', { metaId: actor._id, opts: { pos: clickPos }});
            }
            else {
                console.error(`Could not find actor ${actorName} in model. Ignoring request.`);
            }
            ActiveTool.clear();          
        });
    };
}


function createNewActorOnClick(clickPos) {
    msgClient.publish('cmdCreateNewMeta', { jsonMeta: { _type: 'UMLActor'} , opts: { pos: clickPos }});
    ActiveTool.clear();          
}


function createAssociationProxy() {
    return new UMLLinkProxy();
}

function createDependencyProxy() {
    return new UMLDependencyProxy();
}

function createGeneralizationProxy() {
    return new UMLGeneralizationProxy();
}


export const ActiveTool = {

    // canStartLink(shapeModel, shapeClickPos)
    // Returns TRUE if a link can be started from the specified shape
    // having been clicked at shapeClickPos. If TRUE is returned
    // getLinkProxy() will be called to obtain the link proxy.
    canStartLink: null,


    // getLinkProxy()
    // Returns a UMLLinkProxy instance
    getLinkProxy: null,


    // createLink(sourceModel, sourcePos, targetModel, targetPos)
    // Creates the actual link between the two models, if appropriate
    createLink: null,

    // onPaperClick(clickPos)
    // Called when the paper is clicked on a blank space.
    // If appropriate, a new shape should be created.
    onPaperClick: null,


    // useTopBottomAnchors
    // If TRUE, a class link will use the top and bottom anchors
    // of the shape. 
    useTopBottomAnchors: false,

    useLeftRightAnchors: false,

    useCenterTopBottomAnchors: false,

    clear() {
        commandPalette.setActiveTool(null);
        ActiveTool.canStartLink = null;
        ActiveTool.getLinkProxy = null;
        ActiveTool.createLink = null;
        ActiveTool.onPaperClick = null;
        ActiveTool.useTopBottomAnchors = false;
        ActiveTool.useLeftRightAnchors = false;
        ActiveTool.useCenterTopBottomAnchors = false;
        verticalPusherTool.deactivate(false);
        horizontalPusherTool.deactivate(false);
    }
};



const commandPalette = new CommandPalette({
    columnCount: 3,
    commands: [
        {
            svg: icons.svgClass,
            exec() {
                ActiveTool.clear();
                ActiveTool.onPaperClick = createNewClassOnClick();
                commandPalette.setActiveTool(icons.svgClass);
            },
        },

        {
            svg: icons.svgEntity,
            exec() {
                ActiveTool.clear();
                ActiveTool.onPaperClick = createNewClassOnClick('Entity');
                commandPalette.setActiveTool(icons.svgEntity);
            },
        },

        {
            svg: icons.svgService,
            exec() {
                ActiveTool.clear();
                ActiveTool.onPaperClick = createNewClassOnClick('Service');
                commandPalette.setActiveTool(icons.svgService);
            },
        },
    
        {
            svg: icons.svgAssociation,
            exec() {
                ActiveTool.clear();
                ActiveTool.canStartLink = canStartClassLink;
                ActiveTool.getLinkProxy = createAssociationProxy;
                ActiveTool.createLink = createAssociation;
                ActiveTool.onPaperClick = ActiveTool.clear;
                ActiveTool.useTopBottomAnchors = true;
                ActiveTool.useCenterTopBottomAnchors = false;
                ActiveTool.useLeftRightAnchors = true;
                commandPalette.setActiveTool(icons.svgAssociation);
            },
        },

        {
            svg: icons.svgDependency,
            exec() {
                ActiveTool.clear();
                ActiveTool.canStartLink = canStartClassLink;
                ActiveTool.getLinkProxy = createDependencyProxy;
                ActiveTool.createLink = createDependency;
                ActiveTool.onPaperClick = ActiveTool.clear;
                ActiveTool.useTopBottomAnchors = true;
                ActiveTool.useCenterTopBottomAnchors = false;
                ActiveTool.useLeftRightAnchors = true;                
                commandPalette.setActiveTool(icons.svgDependency);
            },
        },

        {
            svg: icons.svgGeneralization,
            exec() {
                ActiveTool.clear();
                ActiveTool.canStartLink = canStartGeneralization;
                ActiveTool.getLinkProxy = createGeneralizationProxy;
                ActiveTool.createLink = createGeneralization;
                ActiveTool.useTopBottomAnchors = true;
                ActiveTool.useCenterTopBottomAnchors = true;
                ActiveTool.useLeftRightAnchors = false;
                commandPalette.setActiveTool(icons.svgGeneralization);
            },
        },

        {
            svg: icons.svgActor,
            exec() {
                ActiveTool.clear();
                ActiveTool.onPaperClick = createNewActorOnClick;
                commandPalette.setActiveTool(icons.svgActor);
            },
        },

        {
            svg: icons.svgUser,
            exec() {
                ActiveTool.clear();
                ActiveTool.onPaperClick = addActorOnClickWithName('User');
                commandPalette.setActiveTool(icons.svgUser);
            },
        },

        {
            svg: icons.svgAdmin,
            exec() {
                ActiveTool.clear();
                ActiveTool.onPaperClick = addActorOnClickWithName('Admin');
                commandPalette.setActiveTool(icons.svgAdmin);
            },
        },

        {
            svg: icons.svgVerticalPush,
            exec() {
                ActiveTool.clear();
                commandPalette.setActiveTool(icons.svgVerticalPush);
                verticalPusherTool.activate();
            },
        },

        {
            svg: icons.svgHorizontalPush,
            exec() {
                ActiveTool.clear();
                commandPalette.setActiveTool(icons.svgHorizontalPush);
                horizontalPusherTool.activate();
            },
        },

    ],
});

class UMLLinkProxy extends joint.shapes.standard.Link {

    constructor(attributes = {}, options = {}) {
        super(attributes, options);
    }

    defaults() {
        return joint.util.defaultsDeep( {
            type: 'custom.UMLLinkProxy',
            labels: [],
            attrs: {
                'line': {
                    sourceMarker: {
                        d: ''
                    },
                    targetMarker: {
                        d: ''
                    },
                    stroke: COLOR_CONNECTING,
                    strokeWidth: 2,
                }
            },
            router: {
                name: 'rightAngle',
                margin: 40
            },
            connector: { name: 'jumpover' }            
        }, super.defaults);
    }

}
joint.shapes.custom.UMLLinkProxy = UMLLinkProxy;


class UMLDependencyProxy extends joint.shapes.standard.Link {

constructor(attributes = {}, options = {}) {
    super(attributes, options);
}

defaults() {
    return joint.util.defaultsDeep( {
        type: 'custom.UMLDependencyProxy',
        labels: [],
        attrs: {
            'line': {
                sourceMarker: {
                    d: ''
                },
                stroke: COLOR_CONNECTING,
                strokeWidth: 2,
                strokeDasharray: '5,5' // Dash pattern: 5px dash, 5px gap
            }
        },
        router: {
            name: 'normal',
        },
        connector: { name: 'jumpover' }            
    }, super.defaults);
}


}
joint.shapes.custom.UMLDependencyProxy = UMLDependencyProxy;


class UMLGeneralizationProxy extends joint.shapes.standard.Link {

constructor(attributes = {}, options = {}) {
    super(attributes, options);
}

defaults() {
    return joint.util.defaultsDeep( {
        type: 'custom.UMLGeneralizationProxy',
        labels: [],
        attrs: {
            'line': {
                sourceMarker: {
                    d: ''
                },
                targetMarker: {
                    'type': 'path',
                    'd': 'M 6 -8 L -6 0 L 6 8 z',
                    'fill': 'white',
                    'stroke': COLOR_CONNECTING,
                    'stroke-width': 1
                },
                stroke: COLOR_CONNECTING,
                strokeWidth: 2,
            }
        },
        router: {
            name: 'normal',
        },
        connector: { name: 'jumpover' }            
    }, super.defaults);
}


}
joint.shapes.custom.UMLGeneralizationProxy = UMLGeneralizationProxy;


export class ShapeMoveUndo {

    /**
     * 
     * @param {[joint.dia.Cell]} shapeList a array of JointJS cell objects
     * to track movement
     */
    constructor(shapeList) {
        this.shapeList = shapeList;
        this.before = [];
        this.getShapePos(this.before);
    }

    getShapePos(positionList) {
        this.shapeList.forEach((shape, index) => {
            const position = shape.position();
            positionList.push({ shapeId: shape.id, pos: { x: position.x, y: position.y } });
        });
    }

    moveCompleted() {
        this.after = [];
        this.getShapePos(this.after);
        msgClient.publish('cmdAddUndoRedo', { 
            label: 'Move shapes', 
            op: 'MoveShapes', 
            opts: { 
                before: this.before, 
                after: this.after 
            }
        });
    }
}


class AnchorMoveUndo {

    constructor(linkId, anchorSide, before) {
        this.linkId = linkId;
        this.anchorSide = anchorSide;
        this.before = before;
    }


    moveCompleted(after) {
       msgClient.publish('cmdAddUndoRedo', { 
           label: 'Move anchor', 
           op: 'MoveAnchor', 
           opts: { 
               linkId: this.linkId,
               anchorSide: this.anchorSide,
               before: this.before, 
               after: after 
           }
       });
    }
}


export const UndoFunctions = {

    undo_MoveAnchor: (paper, graph, opts) => {
        const shape = graph.getCell(opts.linkId);
        shape.set(opts.anchorSide, opts.before);
        shape.refreshLabels();
    },

    redo_MoveAnchor: (paper, graph, opts) => {
        const shape = graph.getCell(opts.linkId);
        shape.set(opts.anchorSide, opts.after);
        shape.refreshLabels();
    },

    undo_MoveShapes: (paper, graph, opts) => {
        const shapeList = opts.before;
        shapeList.forEach((entry) => {
            const shape = graph.getCell(entry.shapeId);
            shape.position(entry.pos.x, entry.pos.y);
        });
    },

    redo_MoveShapes: (paper, graph, opts) => {
        const shapeList = opts.after;
        shapeList.forEach((entry) => {
            const shape = graph.getCell(entry.shapeId);
            shape.position(entry.pos.x, entry.pos.y);
        });        
    },
};
