import * as umlShapes from './umlShapes.js';
import { shapeCache } from './shapeCache.js';
import { metaModel } from './metaModel.js';

// Custom UML Class shape that links to meta model

/**
* Extends a method of a Javascript object that was not defined using ES6 class symantics.
* Example usage:
* ```
* this.someFunc = extendMethod(this, 'someFunc', function(superMethod, ...args) {
*   // Your additional logic before the original method
*   console.log('Custom logic before the original function.');
*
*   // Call the original method, auto passing any arguments:
*   superMethod();
*
*   // Or, if you need to modify arguments:
*   // superMethod('newArg1', 'newArg2');
* 
*   // Your additional logic after the original method
*   console.log('Custom logic after the original function.');
* });
* ```
*/
function extendMethod(object, methodName, newLogic) {
    const originalMethod = object[methodName];
    return function(...args) {
        const superMethod = (...superArgs) => {
            return originalMethod.apply(this, superArgs.length ? superArgs : args);
        };
        return newLogic.apply(this, [superMethod, ...args]);
    };
 }
 
 
 
 // A Meta element view that will refresh the element when a
 // "meta:refresh" event is fired by the model.
 const UMLClassView = joint.dia.ElementView.extend({
     initialize: function(...args) {
         joint.dia.ElementView.prototype.initialize.apply(this, args);
         this.listenTo(this.model, 'meta:refresh', function() {
             this.update();
             this.resize();
         });
 
         this.on('meta:dragstart', function(payload) {
             // console.log(`UMLClassView: meta:dragstart: ${payload.type}`);
             this.model.trigger('meta:dragstart', payload);
         });
 
         this.on('element:mouseenter', function() {
             // console.log('UMLClassView: element:mouseenter');
         });
 
         // Extend the default dragLinkStart method so we can send
         // a notification to ourselves that a link creation drag
         // is about to start.
         this.dragLinkStart = extendMethod(this, 'dragLinkStart', function(superMethod, ...args) {
             // console.log('UMLClassView: dragLinkStart');
             this.trigger('meta:dragstart', { type: "UMLAssociation" });
             superMethod();
         });
     }
 });


export class UMLClass extends umlShapes.UMLClassBase {

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
 joint.shapes.custom.UMLClassView = UMLClassView;
 
 
 
 export class UMLActor extends umlShapes.UMLActorBase {
 
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
 
 
 export class UMLLink extends umlShapes.UMLLinkBase {
 
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

         // Tag values are middle label
         if (linkNode.tags.length > 0) {
            let tagValues = linkNode.tags.map((tag) => `${tag.name} = ${tag.value}`).join('\n');
            this.prop('middleEnd/name', tagValues);
         }

       }
    }
 }
 
 joint.shapes.custom.UMLLink = UMLLink;
 
 
 export class UMLAssociation extends UMLLink { 
 
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
 
 
 export class UMLDependency extends UMLLink { 
 
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
                      },
                      strokeDasharray: '5,5' // Dash pattern: 5px dash, 5px gap        
                   }
             },
             router: {
                   name: 'normal'
             }                        
          }, super.defaults());
       }
 }
 joint.shapes.custom.UMLDependency = UMLDependency;
 
 
 export class UMLGeneralization extends UMLLink { 
 
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
 