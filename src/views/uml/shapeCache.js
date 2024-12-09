export class MetaShapes {
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


export class ShapeCache {
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

export const shapeCache = new ShapeCache();

