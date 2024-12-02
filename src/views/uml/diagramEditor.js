const graph = new joint.dia.Graph();
const paper = new joint.dia.Paper({
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


let verticalPusherTool = new VerticalPusherTool(paper, graph);
verticalPusherTool.onShapesMoved = function() {
   msgClient.publish('diagramDirty', { });
};


let horizontalPusherTool = new HorizontalPusherTool(paper, graph);
horizontalPusherTool.onShapesMoved = function() {
   msgClient.publish('diagramDirty', { });
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
msgClient.subscribe('restoreDiagram', (json) => {
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


class MetaShapes {
    constructor(metaId) {
       this.metaId = metaId;
       this.shapeIds = [];
    }
    
    addShapeId(shapeId) {
        if (!this.shapeIds.includes(shapeId)) {
          this.shapeIds.push(shapeId);
        }
    }

    removeShapeId(shapeId) {
      const index = this.shapeIds.indexOf(shapeId);
      if (index !== -1) {
        this.shapeIds.splice(index, 1);
      }
    }
}


class ShapeCache {
    constructor() {
       this.metaToShapes = new Map();
       this.shapeToMeta = new Map();
    }

    getShapeIds(metaId) {
       const metaShapes = this.metaToShapes.get(metaId);
       if (metaShapes) {
          return metaShapes.shapeIds;
       }
       else {
          return [];
       }
    }

    getMetaId(shapeId) {
       const metaShapes = this.shapeToMeta.get(shapeId);
       if (metaShapes) {
          return metaShapes.metaId;
       }
       return null;
    }

    removeShapeId(shapeId) {
       const metaShapes = this.shapeToMeta.get(shapeId);
       if (metaShapes) {
          metaShapes.removeShapeId(shapeId);
       }
       this.shapeToMeta.delete(shapeId);
    }


    associate (metaId, shapeId) {
       // First see if shape is already associated with something.
       let metaShapes = this.shapeToMeta.get(shapeId);
       if (metaShapes) {
          // It is. Do we already have this association?
          if (metaShapes.metaId === metaId) {
             // Yes we do. Ignore redundant request
             return;
          }

          // Disassociate with the old metaId
          metaShapes.removeShapeId(shapeId);
       }


       // Now, find the correct target metaShapes
       metaShapes = this.metaToShapes.get(metaId);
       if (!metaShapes) {
          metaShapes = new MetaShapes(metaId);
          this.metaToShapes.set(metaId, metaShapes);
       }
       metaShapes.addShapeId(shapeId);
       this.shapeToMeta.set(shapeId, metaShapes);
    }

}
const shapeCache = new ShapeCache();


class MetaModel {

  async findId(id) {
     let node = null;
     if (id) {
        node = await rpcClient.call('findMetaNode', id);
     }
     return node;
  }


  async gatherAll(nodeType) { 
     return await rpcClient.call('gatherAll', nodeType);
  }


  async getStereotypes() {
      if (!this._stereotypes) {
         this._stereotypes = await this.gatherAll('UMLStereotype');
      }
      return this._stereotypes;   
  }

 
  async findStereotype(name) {
      const stereotypes = await this.getStereotypes();
      const lcName = name.toLowerCase();
      const entry = stereotypes.find((s) => s?.node?.name?.toLowerCase() === lcName);
      return entry?.node;
  } 

  
  async getDataTypes() {
      if (!this._dataTypes) {
         this._dataTypes = await this.gatherAll('UMLDataType');
      }
      return this._dataTypes;
  }


  async findDataType(name, dtCache) {
     let dataTypes;
     if (!dtCache) {
        dataTypes = await this.getDataTypes();
     }
     else {
        dataTypes = dtCache;
     }
     const lcName = name.toLowerCase();
     const entry = dataTypes.find((s) => s?.node?.name?.toLowerCase() === lcName);
     return entry?.node;
  }


  async getActors() {
      if (!this._actors) {
         this._actors = await this.gatherAll('UMLActor');
      }
      return this._actors;
  }


  async findActor(name) {
     const actors = await this.getActors();
     const lcName = name.toLowerCase();
     const entry = actors.find((s) => s?.node?.name?.toLowerCase() === lcName);
     return entry?.node;
  }


  /**
   * Attempts to find the class node associated with the meta element represented by the meta parameter.
   * @param meta a string id or a MetaElementNode associated with a class, an attribute, an operation, or a parameter of an operation
   */
  async getClassNode(meta) {

      if (!meta) {
          // Nothing to find
          return null;
      }

      if (typeof meta === 'string') {
          meta = await this.findId(meta);
      }

      // Check to see if we are dealing with an actual MetaElementNode via duck typing
      if (meta?._id && meta?._type && meta?.ownedElements) {
          switch (meta._type) {
              case 'UMLClass':
                  return meta;

              case 'UMLAttribute':
              case 'UMLOperation':
              case 'UMLParameter':
                   return await this.getClassNode(meta?._parent?.$ref ?? meta?._parent?._id);
          }
      }
      return null;
  }

}
const metaModel = new MetaModel();

// Custom UML Class shape that links to meta model
//------------------
class UMLClass extends joint.shapes.custom.UMLClassBase {

   constructor(attributes = {}, options = {}) {
       super(attributes, options);
   }

   defaults() {
       return joint.util.defaultsDeep( {
           type: 'custom.UMLClass',
           metaId: '',
       }, super.defaults());
   }

   async metaToProps(classNode) {
      if (!classNode) {
        classNode = await metaModel.getClassNode(this.attributes.metaId);
      }
      if (classNode?._type === 'UMLClass') {
         this.stereoToProps(classNode);
         this.nameToProps(classNode);
         this.childrenToProps(classNode);
      }
      else {
         this.set('name', "no-name");
         this.set('packageName', "");
         this.set('stereotypes', []);
         this.set('attributes', []);
         this.set('methods', []);
      }
   }
 
   nameToProps(classNode) {
     this.set('name', classNode.name);
     const packageName = classNode.packageName || '(root)';    
     this.prop('packageName', packageName);
   }
 
   stereoToProps(classNode) {
      const stereo = [];
      classNode.stereotypes.forEach((stereotype) => {
         stereo.push(`<<${stereotype.name}>>`);
      });
      this.set('stereotypes', stereo);
   }
 
   childrenToProps(classNode) {
      const attribs = [];
      const methods = [];
      if (classNode?.ownedElements) {
         classNode.ownedElements.forEach((element) => {
            if (element._type === 'UMLAttribute') {
                const attrib = element;
                const viz = attrib?.visibility === 'private' ? '-' : attrib?.visibility === 'protected' ? '#' : '+';
                const strAttrib = 
                   `${viz}${attrib?.name}: ${attrib?.type?.name || ''} ${attrib?.multiplicity !== '0..1' ? '['+attrib?.multiplicity+']' : ''}`;
                attribs.push(strAttrib);
            }
            else if (element._type === 'UMLOperation') {
                const method = element;
                const viz = method?.visibility === 'private' ? '-' : method?.visibility === 'protected' ? '#' : '+';
                const strMethod =
                   `${viz}${method?.name}(${method.ownedElements.map(param => param.name).join(',')})${method?.returnType ? ': ' + method.returnType?.name : ''}`;
                methods.push(strMethod);
            }
         });
      }
 
      if (attribs.length === 0) {
         // Reserve display space for future attributes
         attribs.push('');
      }
      if (methods.length === 0) {
         // Reserve display space for future methods
         methods.push('');
      }
 
      this.set('attributes', attribs);
      this.set('methods', methods);
   }
}
joint.shapes.custom.UMLClass = UMLClass;
joint.shapes.custom.UMLClassView = UMLMetaView;




class UMLActor extends joint.shapes.custom.UMLActorBase {

   constructor(attributes = {}, options = {}) {
       super(attributes, options);
   }

   defaults() {
       return joint.util.defaultsDeep( {
           type: 'custom.UMLActor',
           metaId: '',
       }, super.defaults());
   }

   async metaToProps(actorNode) {
      if (!actorNode) {
         actorNode = await metaModel.findId(this.metaId);
      }
      if (actorNode?._type === 'UMLActor') {
          this.set('name', actorNode.name);
      }
      else {
         this.set('name', '');
      }
   }

}
joint.shapes.custom.UMLActor = UMLActor;


class UMLLink extends joint.shapes.custom.UMLLinkBase {

   constructor(attributes = {}, options = {}) {
       super(attributes, options);
   }


   defaults() {
       return joint.util.defaultsDeep( {
           type: 'custom.UMLLink',
           metaId: '',
       }, super.defaults());
   }


   resolveShapeId(metaId) {
      let shapeIds = shapeCache.getShapeIds(metaId);
      if (shapeIds.length > 0) {
          return shapeIds[0];
      }
   }


   async metaToProps(linkNode) {
      if (!linkNode) {
         linkNode = await metaModel.findId(this.metaId);
      }
      if (linkNode) {
         if (linkNode.end1) {
             this.prop('sourceEnd/metaId', linkNode.end1.node.$ref);
             this.prop('sourceEnd/name', linkNode.end1.name);
             this.prop('sourceEnd/multiplicity', linkNode.end1.multiplicity);
         }
         else {
            this.prop('sourceEnd/metaId', '');
            this.prop('sourceEnd/name', '');
            this.prop('sourceEnd/multiplicity', '');
         }

         if (linkNode.end2) {
            this.prop('targetEnd/metaId', linkNode.end2.node.$ref);
            this.prop('targetEnd/name', linkNode.end2.name);
            this.prop('targetEnd/multiplicity', linkNode.end2.multiplicity);
        }
        else {
            this.prop('targetEnd/metaId', '');
            this.prop('targetEnd/name', '');
            this.prop('targetEnd/multiplicity', '');
        }
      }
   }
}

joint.shapes.custom.UMLLink = UMLLink;


class UMLAssociation extends UMLLink { 

   constructor(attributes = {}, options = {}) {
      super(attributes, options);
   }


   defaults() {
      return joint.util.defaultsDeep( {
         type: 'custom.UMLAssociation'
      }, super.defaults());
   }


   async metaToProps(linkNode) {
      super.metaToProps(linkNode);
      if (linkNode.end1.navigable !== linkNode.end2.navigable) {

         if (linkNode.end1.navigable) {
            this.prop('attrs/line/sourceMarker/d', 'M 10 -5 0 0 10 5');
            this.prop('attrs/line/sourceMarker/stroke-width', '1');
            this.prop('attrs/line/sourceMarker/fill', 'none');
            this.prop('attrs/line/targetMarker/d', '');
         }
         else {
            this.prop('attrs/line/sourceMarker/d', '');
            this.prop('attrs/line/targetMarker/d', 'M 10 -5 0 0 10 5');
            this.prop('attrs/line/targetMarker/fill', 'none');
            this.prop('attrs/line/targetMarker/stroke-width', '1');
         }
      }
      else {
         this.prop('attrs/line/sourceMarker/d', '');
         this.prop('attrs/line/targetMarker/d', '');
      }
   }

}
joint.shapes.custom.UMLAssociation = UMLAssociation;


class UMLDependency extends UMLLink { 

   constructor(attributes = {}, options = {}) {
         super(attributes, options);
      }

      defaults() {
         return joint.util.defaultsDeep( {
            type: 'custom.UMLDependency',
            attrs: {
                  line: {
                     targetMarker: {
                        'type': 'path',
                        'd': 'M 10 -5 0 0 10 5 z'
                     }            
                  }
            },
            router: {
                  name: 'normal'
            }                        
         }, super.defaults());
      }
}
joint.shapes.custom.UMLDependency = UMLDependency;


class UMLGeneralization extends UMLLink { 

   constructor(attributes = {}, options = {}) {
         super(attributes, options);
      }

      defaults() {
         return joint.util.defaultsDeep( {
            type: 'custom.UMLGeneralization',
            attrs: {
                  line: {
                     targetMarker: {
                        'type': 'path',
                        'd': 'M 10 -8 L 0 0 L 10 8 z',
                        'fill': 'white',
                        'stroke-width': 1
                    },           
                  }
            },
            router: {
                  name: 'normal'
            }                        
         }, super.defaults());
      }
}
joint.shapes.custom.UMLGeneralization = UMLGeneralization;

//------------------

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



function createMetaShape(jsonMeta, opts) {
   const factory = shapeFactory.get(jsonMeta._type);
   if (factory?.create) {
        const shape = factory.create(jsonMeta, opts);
        if (shape) {
           shapeCache.associate(jsonMeta._id, shape.id);
           graph.addCell(shape);
           msgClient.publish('diagramDirty', { cellId: shape.id });
        }
   } 
}


// Respond to new meta nodes being created
msgClient.subscribe('createMeta', (payload) => {
   const { jsonMeta, opts } = payload;
   console.log(`createMeta: ${JSON.stringify(jsonMeta, null, 2)}\n opts: ${JSON.stringify(opts, null, 2)}`);
   createMetaShape(jsonMeta, opts);
});


function updateMetaShape(jsonMeta, opts) {
   const factory = shapeFactory.get(jsonMeta._type);
   if (factory?.update) {
      factory.update(jsonMeta, opts);
      msgClient.publish('diagramDirty', { });
   }
 }

// Respond to meta nodes being updated
msgClient.subscribe('updateMeta', (payload) => {
  const { jsonMeta, opts } = payload;
  console.log(`updateMeta: ${jsonMeta.name} (${jsonMeta._id})`, JSON.stringify(jsonMeta, null, 2));
  updateMetaShape(jsonMeta, opts);
});


msgClient.subscribe('removeMeta', (metaId) => {
   console.log(`removeMeta: ${metaId}`);
   const shapeIds = shapeCache.getShapeIds(metaId);
   shapeIds.forEach((shapeId) => {
      const shape = graph.getCell(shapeId);
      if (shape) {
         shape.remove();
         shapeCache.removeShapeId(shapeId);
         msgClient.publish('diagramDirty', { });
      }
   });
}); 



paper.on('cell:pointerup', (cellView) => {
    msgClient.publish('diagramDirty', { cellId: cellView.id });
});

// Tell the extension we are ready to go!
msgClient.publish('diagramEditorReady', true);
