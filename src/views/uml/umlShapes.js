import { ActiveTool } from "./diagramTools.js";
import { paper } from "./diagramEditor.js";

joint.shapes.custom = joint.shapes.custom || {};

function umlClass_findClosestAnchor(x, y) {
    const relAnchors = this.getLinkAnchors();
    const relPoint = this.getRelativePointFromAbsolute({ x, y });
    const distances = relAnchors.map((anchor) => {
        return g.Point(relPoint).squaredDistance(anchor);
    });
    const minDistance = Math.min(...distances);
    return relAnchors[distances.indexOf(minDistance)];
}


export class UMLClassBase extends joint.dia.Element {

    constructor(attributes = {}, options = {}) {
        super(attributes, options);
        this.findClosestAnchor = umlClass_findClosestAnchor;
    }

    defaults() {
        return joint.util.defaultsDeep( {
            type: 'custom.UMLClassBase',
            name: '',
            packageName: '',
            stereotypes: [],
            attributes: [],
            methods: [],
            attrs: {
                body: { magnet: false },
                umlClassNameRect: {  'width': 'calc(w)','stroke': 'black', 'stroke-width': 2, 'fill': '#cfcd8a' },
                umlClassAttrsRect: {  'width': 'calc(w)','stroke': 'black', 'stroke-width': 2, 'fill': '#faf9ac' },
                umlClassMethodsRect: {  'width': 'calc(w)','stroke': 'black', 'stroke-width': 2, 'fill': '#faf9ac' },

                umlClassStereoText: {
                    'ref': 'umlClassNameRect',
                    'ref-y': 0,
                    'ref-x': .5,
                    'text-anchor': 'middle',
                    'y-alignment': 'hanging',
                    'font-weight': 'normal',
                    'font-style': 'italic',
                    'fill': 'black',
                    'font-size': 15,
                    'font-family': 'Arial'
                },
                umlClassPackageText: {
                    'ref': 'umlClassNameRect',
                    'ref-y': 0,
                    'ref-x': .5,
                    'text-anchor': 'middle',
                    'y-alignment': 'hanging',
                    'font-weight': 'normal',
                    'font-style': 'normal',
                    'fill': 'black',
                    'font-size': 14,
                    'font-family': 'Arial'
                },
                umlClassNameText: {
                    'ref': 'umlClassNameRect',
                    'ref-y': 0,
                    'ref-x': .5,
                    'text-anchor': 'middle',
                    'y-alignment': 'hanging',
                    'font-weight': 'bold',
                    'fill': 'black',
                    'font-size': 18,
                    'font-family': 'Trebuchet MS'
                },        
                umlClassAttrsText: {
                    'ref': 'umlClassAttrsRect', 'ref-y': .1, 'ref-x': 5, 'y-alignment': 'hanging',
                    'fill': 'black', 'font-size': 14, 'font-family': 'Courier New'
                },
                umlClassMethodsText: {
                    'ref': 'umlClassMethodsRect', 'ref-y': .1, 'ref-x': 5, 'y-alignment': 'hanging',
                    'fill': 'black', 'font-size': 14, 'font-family': 'Courier New'
                }
            }
        }, super.defaults);
    }

    preinitialize() {
        this.markup = [{
            tagName: 'g',
            children: [

                {
                tagName: 'g',
                selector: 'body',
                children: [
                        {
                        tagName: 'rect',
                        selector: 'umlClassNameRect',
                        className: 'uml-class-name-rect',
                        },

                        {
                        tagName: 'rect',
                        selector: 'umlClassAttrsRect',
                        className: 'uml-class-attrs-rect',
                        },

                        {
                        tagName: 'rect',
                        selector: 'umlClassMethodsRect',
                        className: 'uml-class-methods-rect',
                        },
                ]
                },

                {
                tagName: 'text',
                selector: 'umlClassStereoText',
                className: 'uml-class-stereo-text',
                groupSelector: 'texts'
                },

                {
                tagName: 'text',
                selector: 'umlClassPackageText',
                className: 'uml-class-package-text',
                groupSelector: 'texts'
                },

                {
                tagName: 'text',
                selector: 'umlClassNameText',
                className: 'uml-class-name-text',
                groupSelector: 'texts'
                },

                {
                tagName: 'text',
                selector: 'umlClassAttrsText',
                className: 'uml-class-attrs-text',
                groupSelector: 'texts'
                },

                {
                tagName: 'text',
                selector: 'umlClassMethodsText',
                className: 'uml-class-methods-text',
                groupSelector: 'texts'
                },
            ]
        }];

    }

    initialize(...args) {
        super.initialize(...args);
        this.on('change:name change:packageName change:attributes change:methods change:stereotypes', function() {
            this.updateRectangles();
            this.trigger('meta:refresh');
        }, this);

        this.updateRectangles();
    }

    getClassName() {
        return this.get('name');
    }

    updateRectangles() {

        var attrs = this.get('attrs');

        var rects = [
            { txtName: 'Stereo', txtScale: 1.08, text: this.get('stereotypes') },
            { txtName: 'Package', txtScale: 1.0, text: this.get('packageName') },
            { txtName: 'Name', txtScale: 1.15, text: this.getClassName() },
            { txtName: 'Attrs', txtScale: 1.0, text: this.get('attributes') },
            { txtName: 'Methods', txtScale: 1.0, text: this.get('methods') }
        ];

        var offsetY = 0;
        var maxLength = 0;
        var refY = 0;
        rects.forEach(function(rect, ndx) {

            // Calculate the width and height of the text lines
            var lines = Array.isArray(rect.text) ? rect.text : [rect.text];
            var rectHeight = lines.length * 18 * rect.txtScale;
            maxLength = Math.max(maxLength,...lines.map(str => str.length));

            // Set the text lines for this section
            attrs['umlClass' + rect.txtName + 'Text'].text = lines.join('\n');

            if (ndx >= 3) {
               // attrs and methods get their own box - set the height and translate
               if (ndx === 4) {
                   rectHeight += 5;
               }
               attrs['umlClass' + rect.txtName + 'Rect'].height = rectHeight;
               attrs['umlClass' + rect.txtName + 'Rect'].transform = 'translate(0,' + offsetY + ')';
            }
            else {
                attrs['umlClass' + rect.txtName + 'Text']['ref-y'] = refY;
                refY += (lines.length * 18 * rect.txtScale);
                if (ndx === 2) {
                    // stereo, package, and name all share the top box. Set the cumulative height
                    rectHeight += 5;
                    attrs['umlClass' + rect.txtName + 'Rect'].height = offsetY+rectHeight;
                }
            }
            offsetY += rectHeight;
        });

        // Now, resize the entire box
        this.resize(maxLength * 8.5 + 5, offsetY);
    }

    getLinkAnchors() {
            const { width, height } = this.size();
            const anchors = [];

            if (ActiveTool?.useTopBottomAnchors) {
                for (let x = 20; x < width; x += 20) {
                    anchors.push({ x, y: 0 });
                    anchors.push({ x, y: height });
                }
            }

            if (ActiveTool?.useLeftRightAnchors) {
                for (let y = 20; y < height; y += 20) {
                    anchors.push({ x: 0, y });
                    anchors.push({ x: width, y });
                }
            }

            if (ActiveTool?.useCenterTopBottomAnchors) {
                anchors.push({ x: width / 2, y: 0 });
                anchors.push({ x: width / 2, y: height });
            }
            return anchors;
    }    

}
joint.shapes.custom.UMLClassBase = UMLClassBase;



export class UMLActorBase extends joint.dia.Element {

    constructor(attributes = {}, options = {}) {
        super(attributes, options);
    }

    defaults() {
        return joint.util.defaultsDeep( {
            type: 'custom.UMLActorBase',
            size: {
                width: 35,
                height: 60
            },
            name: '',
            attrs: {
                background: {
                    width: "calc(w)",
                    height: "calc(h)",
                    fill: "transparent"
                },
                body: {
                    d: `M 0 calc(0.4 * h) h calc(w) M 0 calc(h) calc(0.5 * w) calc(0.7 * h) calc(w) calc(h) M calc(0.5 * w) calc(0.7 * h) V calc(0.3 * h)`,
                    fill: "none",
                    stroke: 'black',
                    strokeWidth: 2
                },
                head: {
                    cx: "calc(0.5 * w)",
                    cy: `calc(0.15 * h)`,
                    r: `calc(0.15 * h)`,
                    stroke: 'black',
                    strokeWidth: 2,
                    fill: "#ffffff"
                },
                label: {
                    y: "calc(h + 10)",
                    x: "calc(0.5 * w)",
                    textAnchor: "middle",
                    textVerticalAnchor: "top",
                    fontSize: 14,
                    fontFamily: "sans-serif",
                    fill: 'black',
                    textWrap: {
                        width: "calc(3 * w)",
                        height: null
                    }
                }
            }
        }, super.defaults);
    }

    preinitialize() {
        this.markup =joint.util.svg`
            <rect @selector="background" />
            <path @selector="body" />
            <circle @selector="head" />
            <text @selector="label" />
        `;
    }

    initialize(...args)  {
        super.initialize(...args);
        this.on('change:name', function() {
            this.updateLabels();
            this.trigger('meta:refresh');            
        }, this);

        this.updateLabels();
    }

    updateLabels() {
        this.attr('label/text', this.get('name'));
    }
}
joint.shapes.custom.UMLActorBase = UMLActorBase;



export class UMLLinkBase extends joint.shapes.standard.Link {

    constructor(attributes = {}, options = {}) {
        super(attributes, options);
    }

    defaults() {
        return joint.util.defaultsDeep( {
            type: 'custom.UMLLinkBase',
            metaId: '', 
            labels: [],
            sourceEnd: {
                metaId: '',
                shapeId: '',
                name: '',
                multiplicity: '',
                navigable: true,
            },
            targetEnd: {
                metaId: '',
                shapeId: '',
                name: '',
                multiplicity: '',
                navigable: true,
            },
            middleEnd: {
                name: ''
            },
            attrs: {
                'line': {
                    sourceMarker: {
                        d: ''
                    },
                    targetMarker: {
                        d: ''
                    }
                }
            },
            router: {
                name: 'rightAngle',
                margin: 40
            },
            connector: { name: 'jumpover' }            
        }, super.defaults);
    }

    initialize(...args) {
        super.initialize(...args);
        this.on('change:sourceEnd change:targetEnd change:middleEnd', function() {
            this.refreshLabels();
        }, this);

        this.on('change:labels', function() {
            this.refreshView();
        }, this);

        // Do a delayed refresh to prevent render
        // repaint problem
        setTimeout(() => {
            this.refreshLabels();
        }, 10);
    }

    refreshLabels() {
        this.updateLabels();
        this.refreshView();
    }

    refreshView() {
        const myView = paper.findViewByModel(this);
        if (myView) {
            myView.update();
        }
    }



    resolveShapeId(metaId) {
        return null;
    }

    updateLabels() {
       const labels = [];
       const sourceEnd = this.get('sourceEnd');
        if (sourceEnd && sourceEnd.metaId) {
           let shapeId = sourceEnd.shapeId;
           if (!shapeId) {
               shapeId = this.resolveShapeId(sourceEnd.metaId);
           }
           if (shapeId) {
               this.prop('source', { id: shapeId });
               const linkOnRight = (this.source().anchor.args.dx === "100%" || this.source().anchor.args.dy === "0%");
               if (sourceEnd.name) {
                   labels.push({
                        'attrs': {
                            'text': {
                                'text': sourceEnd.name,
                                'text-anchor': linkOnRight ? 'start' : 'end',
                                'fill': 'black',
                                'font-size': 14, 
                                'font-family': 'Courier New'
                            },
                            'rect': {
                                'stroke': 'black',
                                'fill': 'none',
                                'strokeWidth': 0
                            }
                        },
                        'position': {
                            'distance': 5, 
                            'offset': -12,
                            'args': { 'keepGradient': true, 'ensureLegibility': true }
                        }
                   });
               }
               if (sourceEnd.multiplicity) {
                   labels.push({
                        'attrs': {
                            'text': {
                                'text': sourceEnd.multiplicity,
                                'text-anchor': linkOnRight ? 'start' : 'end',
                                'fill': 'black',
                                'font-size': 14, 
                                'font-family': 'Courier New'
                            },
                            'rect': {
                                'stroke': 'black',
                                'fill': 'none',
                                'strokeWidth': 0
                            }
                        },
                        'position': {
                            'distance': 5, 
                            'offset': 12,
                            'args': { 'keepGradient': true, 'ensureLegibility': true }

                        }
                   });
               }
           }
       }

       const targetEnd = this.get('targetEnd');
       if (targetEnd && targetEnd.metaId) {
           let shapeId = targetEnd.shapeId;
           if (!shapeId) {
               shapeId = this.resolveShapeId(targetEnd.metaId);
           }
           if (shapeId) {
               this.prop('target', { id: shapeId });
               const linkOnRight = (this.target().anchor.args.dx === "100%" || this.target().anchor.args.dy === "0%");
               if (targetEnd.name) {
                   labels.push({
                        'attrs': {
                            'text': {
                                'text': targetEnd.name,
                                'text-anchor': linkOnRight ? 'start' : 'end',
                                'fill': 'black',
                                'font-size': 14, 
                                'font-family': 'Courier New'
                            },
                            'rect': {
                                'stroke': 'black',
                                'fill': 'none',
                                'strokeWidth': 0
                            }
                        },
                        'position': {
                            'distance': -5, 
                            'offset': -12,
                            'args': { 'keepGradient': true, 'ensureLegibility': true }
                        }
                   });
               }
               if (targetEnd.multiplicity) {
                   labels.push({
                        'attrs': {
                            'text': {
                                'text': targetEnd.multiplicity,
                                'text-anchor': linkOnRight ? 'start' : 'end',
                                'fill': 'black',
                                'font-size': 14, 
                                'font-family': 'Courier New'
                            },
                            'rect': {
                                'stroke': 'black',
                                'fill': 'none',
                                'strokeWidth': 0
                            }
                        },
                        'position': {
                            'distance': -5, 
                            'offset': 12,
                            'args': { 'keepGradient': true, 'ensureLegibility': true }
                        }
                   });
               }
           }
       }

       const middleEnd = this.get('middleEnd');
       if (middleEnd?.name) {
            labels.push({
                'attrs': {
                    'text': {
                        'text': middleEnd.name,
                        'fill': 'black',
                        'font-size': 14, 
                        'font-family': 'Courier New'
                    },
                    'rect': {
                        'stroke': 'black',
                        'fill': 'none',
                        'strokeWidth': 0
                    }
                },
                'position': {
                    'distance': 0.5,
                    'args': { 'ensureLegibility': true }
                }
            });
       }
    

       this.set('labels', labels);
    }

}
joint.shapes.custom.UMLLinkBase = UMLLinkBase;


