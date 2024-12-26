
import { rpcClient } from './messageBus.js';


/**
 * MetaModel is a class that gives this web view panel access to the VSCode extension's
 * meta model.
 */
export class MetaModel {

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
           const classDefs = await this.gatherAll('UMLClass');
           this._dataTypes.push(...classDefs);
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

export const metaModel = new MetaModel();
