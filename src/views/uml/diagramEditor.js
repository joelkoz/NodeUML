import { ActiveTool, ClassToolBox, LinkToolBox, ActorToolBox, HighlightAnchorPoints, activeClassEditor, UndoFunctions, ShapeMoveUndo } from './diagramTools.js';
import { msgClient, rpcClient } from './messageBus.js';
import { VerticalPusherTool, HorizontalPusherTool } from './pusherTools.js';
import { shapeCache } from './shapeCache.js';
import { metaModel } from './metaModel.js';
import * as diagramShapes from './diagramShapes.js';

export const graph = new joint.dia.Graph();
export const paper = new joint.dia.Paper({
   el: document.getElementById('paper'),
   model: graph,
   width: '3000',
   height: '3000',
   gridSize: 10,
   drawGrid: true,
   background: {
      color: '#f8f8f8'
   },

   defaultConnector: {
       name: 'straight',
       args: {
           cornerType: 'line',
       },
   },

   // This will only get called if the ActiveTool.canStartLink() function
   // has returned true. It is assumed that in that case, the active tool's
   // getLinkProxy has been defined.
   defaultLink: function (elementView, magnet) {
       return ActiveTool.getLinkProxy();
   },


   // After the proxy link has been defined, delegate the link creation to the tool
   // IF the link is actually connecting two elements
   // Regardless, return FALSE to the link proxy is removed from the model.
   // The ActiveTool.createLink function should create the real link if appropriate
   allowLink: function(linkView, paper) {
      var graph = paper.model;
      const sourceModel = linkView?.sourceView?.model;
      const targetModel = linkView?.targetView?.model;
      if (ActiveTool.createLink && sourceModel && targetModel) {
          const sourceBBox = sourceModel.getBBox();
          const targetBBox = targetModel.getBBox();
          const sourceX = asPct(linkView.sourcePoint.x - sourceBBox.x, sourceBBox.width);
          const sourceY = asPct(linkView.sourcePoint.y - sourceBBox.y, sourceBBox.height);
          const targetX = asPct(linkView.targetPoint.x - targetBBox.x, targetBBox.width);
          const targetY = asPct(linkView.targetPoint.y - targetBBox.y, targetBBox.height);
          const sourcePos = { x: sourceX, y: sourceY };
          const targetPos = { x: targetX, y: targetY };
          ActiveTool.createLink(linkView.sourceView.model, sourcePos, linkView.targetView.model, targetPos);
      }
      return false;
   },

   defaultRouter: function(vertices, _options, linkView) {
       if (!linkView.sourceView || !linkView.targetView) {
           return [];
       }
       return joint.routers.rightAngle(
           vertices,
           {
               useVertices: true,
               margin: 40,
           },
           linkView
       );
   },

   defaultConnectionPoint: { name: 'boundary', args: { }},

   connectionStrategy: function(end, view, _magnet, coords) {
       const size = view.model.size();
       if (view.model.findClosestAnchor) {
           const anchor = view.model.findClosestAnchor(coords.x, coords.y);
           return {
               anchor: {
                   name: 'modelCenter',
                   args: {
                       dx: anchor.x - size.width / 2,
                       dy: anchor.y - size.height / 2,
                   },
               },
               magnet: 'body',
               id: end.id,
           };
       }
   },

   snapLinks: true,

   highlighting: {
       // Whenever a link is connected to an element, highlight the anchors of the element
       // (with the custom `anchors` highlighter defined above)
       connecting: {
           name: 'anchorPoints',
       },
   },

   // Extend the default highlighters and add our custom highlighter
   highlighterNamespace: {
       ...joint.highlighters,
       anchorPoints: HighlightAnchorPoints,
   },

   validateConnection(sourceView, _, targetView) {
       return sourceView.model.isElement() && targetView.model.isElement() && sourceView !== targetView;
   },


   // Control whether or not a link creation drag can be started
   // Delegate this decision to the ActiveTool's canStartLink()
   // method.
   validateMagnet: function(cellView, magnet, evt) {

       if (ActiveTool.canStartLink) {

           const shapeModel = cellView.model;

           // Get the click position in the page (screen) coordinates
           const clickPageCoords = { x: evt.clientX, y: evt.clientY };

           // Convert the page coordinates to local coordinates relative to the Paper
           const clickPaperCoords = paper.pageToLocalPoint(clickPageCoords);

           // Get the model position
           const cellPosition = shapeModel.position();

           // Translate to the cell's local coordinates
           const modelClickPos = {
               x: clickPaperCoords.x - cellPosition.x,
               y: clickPaperCoords.y - cellPosition.y
           };
           return ActiveTool.canStartLink(shapeModel, modelClickPos);
       }
       return false;
   }
});


export const verticalPusherTool = new VerticalPusherTool(paper, graph);
verticalPusherTool.onMoveStarted = function() {
    this.undoMove = new ShapeMoveUndo(this.selectedShapes);
};

verticalPusherTool.onMoveCompleted = function() {
   if (this.undoMove) {
       this.undoMove.moveCompleted();
       this.undoMove = null;
   }
};


export const horizontalPusherTool = new HorizontalPusherTool(paper, graph);
horizontalPusherTool.onMoveStarted = function() {
    this.undoMove = new ShapeMoveUndo(this.selectedShapes);
};

horizontalPusherTool.onMoveCompleted = function() {
    if (this.undoMove) {
        this.undoMove.moveCompleted();
        this.undoMove = null;
    }
};


function asPct(value, maxValue) {
   if (!maxValue) { return '0%'; } // Avoid division by zero
   const percentage = Math.round((value / maxValue) * 100);
   return `${percentage}%`;
}


// Paper event handlers/command dispatchers
let currentPaperScale = 1;

// Add mouse wheel listener
document.getElementById('scroll-container').addEventListener('wheel', (event) => {
    if (event.ctrlKey || event.metaKey) { // Check for Ctrl or Command key
        event.preventDefault(); // Prevent default scrolling/zooming behavior

        const delta = event.deltaY > 0 ? -0.01 : 0.01; // Zoom in or out
        currentPaperScale = Math.max(0.2, Math.min(currentPaperScale + delta, 5)); // Clamp scale between 0.2 and 5
        paper.scale(currentPaperScale, currentPaperScale);
    }
});

function animateScale(targetScale) {
   const currentScale = paper.scale();
   const step = 0.03 * (targetScale - currentScale.sx); // Adjust step size
   
   function stepAnimation() {
       if (Math.abs(targetScale - currentScale.sx) > 0.03) {
           currentScale.sx += step;
           currentScale.sy += step;
           paper.scale(currentScale.sx, currentScale.sy);
           requestAnimationFrame(stepAnimation);
       } else {
           paper.scale(targetScale, targetScale); // Final correction
       }
   }

   stepAnimation();
   currentPaperScale = targetScale;

}


paper.on('blank:pointerdblclick', () => {
   animateScale(1.0);
   // paper.translate(0, 0); // Optional translation reset
});

paper.on('link:mouseenter', function(linkView) {
   linkView.removeTools();
   linkView.addTools(LinkToolBox.defaultTools);
});

paper.on('link:mouseleave', function(linkView) {
   linkView.removeTools();
});

paper.on('element:mouseenter', function(elementView) {
    elementView.highlight();
    const model = elementView.model;
    const modelType = model.get('type');
    if (modelType?.startsWith('custom.UMLClass')) {
        elementView.removeTools();
        elementView.addTools(ClassToolBox.defaultTools);
    }
    else if (modelType?.startsWith('custom.UMLActor')) { 
        elementView.removeTools();
        elementView.addTools(ActorToolBox.defaultTools);
    }
});   


paper.on('element:mouseleave', function(elementView) {
   elementView.unhighlight();
   const model = elementView.model;
   elementView.removeTools();
});


paper.on('blank:pointerdown', (evt, x, y) => {
   const [element] = paper.model.findModelsFromPoint({ x, y });
   if (element) {
       // const elementView = paper.findViewByModel(element);
       // do something with elementView
       console.log('paper: blank:pointerdown: element is', element?.attributes?.type);
   } else {
       // User clicked on blank space on paper
       if (ActiveTool.onPaperClick) {
           ActiveTool.onPaperClick({ x, y });
       }
   }
});



// Respond to async request to restore diagram data
msgClient.subscribe('cmdRestoreDiagram', (json) => {
   console.log('Restoring diagram...');
   graph.fromJSON(json);

   // Now, rebuild the shape cache
   const allShapes = graph.getElements().concat(graph.getLinks());
   allShapes.forEach((shape) => {
      if (shape?.attributes?.metaId && shape.id) {
         shapeCache.associate(shape.attributes.metaId, shape.id);
      }
  });
});



function assignProperty(obj, propName, value) {
   const keys = propName.split('.');
   let current = obj;

   for (let i = 0; i < keys.length - 1; i++) {
       const key = keys[i];
       if (!current[key] || typeof current[key] !== 'object') {
           current[key] = {}; // Create the object if it doesn't exist
       }
       current = current[key];
   }

   current[keys[keys.length - 1]] = value;
}


function getPropertyValue(obj, propName, defaultValue) {
   const keys = propName.split('.');
   let current = obj;

   for (let key of keys) {
       if (current && typeof current === 'object' && key in current) {
           current = current[key];
       } else {
           return defaultValue; // Return defaultValue if the property (or child object) doesn't exist
       }
   }

   return current; // Return the found value
}


async function refreshMetaShapes(metaId, metaNode) {
  if (metaId) {
      let shapeIds = shapeCache.getShapeIds(metaId);
      shapeIds.forEach(async (shapeId) => {
        const shape = graph.getCell(shapeId);
        if (shape && typeof shape.metaToProps === 'function') {
            await shape.metaToProps(metaNode);
        }
      });   
  }
}


async function refreshClassShapes(metaNode) {
  if (metaNode._type !== 'UMLClass') {
     metaNode = await metaModel.getClassNode(metaNode);
  }

  if (metaNode) {
      await refreshMetaShapes(metaNode._id, metaNode);
      if (activeClassEditor) {
          activeClassEditor.setModel(metaNode);
      }
  }
}

const shapeFactory = new Map();


shapeFactory.set('UMLClass', {
    create: (classNode, opts) => {
              const umlClass = new joint.shapes.custom.UMLClass({
                    position: { x: opts?.pos?.x ||30, y: opts?.pos?.y ||30 },
                    metaId: classNode._id
              });
              umlClass.metaToProps(classNode);
              return umlClass;
    },

    update: (classNode) => {
        refreshClassShapes(classNode);
    },

});


shapeFactory.set('UMLAttribute', {
  create: (attribNode, opts) => {     
      refreshClassShapes(attribNode);
      return null;
  },

  update: (attribNode) => {
    refreshClassShapes(attribNode);
},
});


shapeFactory.set('UMLOperation', {
  create: (opNode, opts) => {      
   refreshClassShapes(opNode);
      return null;
  },

  update: (opNode) => {
    refreshClassShapes(opNode);
},
});


shapeFactory.set('UMLParameter', {
  create: (paramNode, opts) => {
      refreshClassShapes(paramNode);
      return null;
  },

  update: (paramNode) => {
    refreshClassShapes(paramNode);
},
});


shapeFactory.set('UMLActor', {
   create: (actorNode, opts) => {
             const umlActor = new joint.shapes.custom.UMLActor({
                   position: { x: opts?.pos?.x ||30, y: opts?.pos?.y ||30 },
                   metaId: actorNode._id
             });
             umlActor.metaToProps(actorNode);
             return umlActor;
   },

   update: (actorNode) => {
       refreshMetaShapes(actorNode._id, actorNode);
   },

});



shapeFactory.set('UMLAssociation', {
   create: (assocNode, opts) => {
             const umlAssoc = new joint.shapes.custom.UMLAssociation({
                   metaId: assocNode._id,
                   sourceEnd: { 
                     metaId: assocNode.end1.node.$ref,
                     name: assocNode.end1.name,
                     multiplicity: assocNode.end1.multiplicity,
                     navigable: assocNode.end1.navigable
                  },
                  source: {
                     anchor: { name: 'topLeft', 
                        args: { dx: opts.sourcePos.x, dy: opts.sourcePos.y } 
                     }
                  },
                   targetEnd: { 
                     metaId: assocNode.end2.node.$ref,
                     name: assocNode.end2.name,
                     multiplicity: assocNode.end2.multiplicity,
                     navigable: assocNode.end2.navigable
                  },
                  target: {
                     anchor: { name: 'topLeft', 
                        args: { dx: opts.targetPos.x, dy: opts.targetPos.y }
                     }
                  }
             });
             umlAssoc.metaToProps(assocNode);
             return umlAssoc;
   },


   update: (assocNode) => {
       refreshMetaShapes(assocNode._id, assocNode);
   },

});


shapeFactory.set('UMLDependency', {
   create: (depNode, opts) => {
      const umlDep = new joint.shapes.custom.UMLDependency({
         metaId: depNode._id,
         sourceEnd: { 
           metaId: depNode.end1.node.$ref,
           name: depNode.end1.name,
        },
        source: {
           anchor: { name: 'topLeft', 
              args: { dx: opts.sourcePos.x, dy: opts.sourcePos.y } 
           }
        },
         targetEnd: { 
           metaId: depNode.end2.node.$ref,
           name: depNode.end2.name,
        },
        target: {
           anchor: { name: 'topLeft', 
              args: { dx: opts.targetPos.x, dy: opts.targetPos.y }
           }
        }
      });
      umlDep.metaToProps(depNode);
      return umlDep;
},

   update: (depNode) => {
       refreshMetaShapes(depNode._id, depNode);
   },

});


shapeFactory.set('UMLGeneralization', {
   create: (genNode, opts) => {
      const umlGen = new joint.shapes.custom.UMLGeneralization({
         metaId: genNode._id,
         sourceEnd: { 
           metaId: genNode.end1.node.$ref,
           name: genNode.end1.name,
        },
        source: {
           anchor: { name: 'topLeft', 
              args: { dx: opts.sourcePos.x, dy: opts.sourcePos.y } 
           }
        },
         targetEnd: { 
           metaId: genNode.end2.node.$ref,
           name: genNode.end2.name,
        },
        target: {
           anchor: { name: 'topLeft', 
              args: { dx: opts.targetPos.x, dy: opts.targetPos.y }
           }
        }
      });
      umlGen.metaToProps(genNode);
      return umlGen;
},

   update: (genNode) => {
       refreshMetaShapes(genNode._id, genNode);
   },

});



export function createMetaShape(jsonMeta, opts) {
   const factory = shapeFactory.get(jsonMeta._type);
   if (factory?.create) {
        const shape = factory.create(jsonMeta, opts);
        if (shape) {
           shapeCache.associate(jsonMeta._id, shape.id);
           graph.addCell(shape);
           msgClient.publish('onDiagramDirty', { cellId: shape.id });
        }
   } 
}


// Respond to new meta nodes being created
msgClient.subscribe('onCreateMeta', (payload) => {
   const { jsonMeta, opts } = payload;
   console.log(`onCreateMeta: ${JSON.stringify(jsonMeta, null, 2)}\n opts: ${JSON.stringify(opts, null, 2)}`);
   createMetaShape(jsonMeta, opts);
});


function updateMetaShape(jsonMeta, opts) {
   const factory = shapeFactory.get(jsonMeta._type);
   if (factory?.update) {
      factory.update(jsonMeta, opts);
      msgClient.publish('onDiagramDirty', { });
   }
 }

// Respond to meta nodes being updated
msgClient.subscribe('onUpdateMeta', (payload) => {
  const { jsonMeta, opts } = payload;
  console.log(`onUpdateMeta: ${jsonMeta.name} (${jsonMeta._id})`, JSON.stringify(jsonMeta, null, 2));
  updateMetaShape(jsonMeta, opts);
});


msgClient.subscribe('onRemoveMeta', (metaId) => {
   console.log(`onRemoveMeta: ${metaId}`);
   const shapeIds = shapeCache.getShapeIds(metaId);
   shapeIds.forEach((shapeId) => {
      const shape = graph.getCell(shapeId);
      if (shape) {
         shape.remove();
         shapeCache.removeShapeId(shapeId);
         msgClient.publish('onDiagramDirty', { });
      }
   });
}); 


msgClient.subscribe('onUndo', (payload) => {
    const fn = UndoFunctions['undo_' + payload.op];
    if (fn) {
        fn(paper, graph, payload.opts);
    }
});


msgClient.subscribe('onRedo', (payload) => {
    const fn = UndoFunctions['redo_' + payload.op];
    if (fn) {
        fn(paper, graph, payload.opts);
    }
});


let cellMoveUndo = null;
paper.on('cell:pointerdown', (cellView) => {
    cellMoveUndo = new ShapeMoveUndo([cellView.model]);
});


paper.on('cell:pointerup', (cellView) => {
    if (cellMoveUndo) {
        cellMoveUndo.moveCompleted();
        cellMoveUndo = null;
    }
});


document.addEventListener('keydown', (event) => {
  if ((event.metaKey && event.key === 'z') || // Cmd+Z on Mac
      (event.ctrlKey && event.key === 'z')) { // Ctrl+Z on Windows/Linux
      if (event.shiftKey) {
          event.preventDefault();
          msgClient.publish('onRedoKey', {});         
      }
      else {
          event.preventDefault();
          msgClient.publish('onUndoKey', {});
      }
  } 
});


// Tell the extension we are ready to go!
msgClient.publish('onDiagramEditorReady', true);
