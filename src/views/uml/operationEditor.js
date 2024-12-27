import { ClassEditorBase } from "./attributeEditor.js";

export class OperationEditor extends ClassEditorBase {
    constructor() {
      super();
    }
  
    getItemsFromClass(jsonClass) {
      return jsonClass.ownedElements.filter(
        (el) => el._type === "UMLOperation"
      );
    }
  
    formatItem(op) {
      if (!op) {
        return "";
      }
      const visibilityMap = {
        public: "+",
        protected: "#",
        private: "-",
      };
      const visibility = visibilityMap[op.visibility] || "+";
      const name = op.name || "";
      const params = op.ownedElements
        .filter((el) => el._type === "UMLParameter" && el.direction === 0)
        .map((param) => {
          const paramType = param?.type?.className || param?.type?.name ||'void';
          let multiplicity = param.multiplicity || "";
          if (multiplicity && multiplicity !== "0..1") {
              multiplicity = ` [${multiplicity}]`;
          }
          else {
            multiplicity = "";
          }
          return `${param.name}: ${paramType}${multiplicity}`;
        })
        .join(", ");
      const returnType = op?.type?.className || op?.type?.name ||'void';
      return `${visibility}${name}(${params}): ${returnType}`;
    }
  
    isValidInput(value) {
      const regex =
        /^[\+\-\#][a-zA-Z][a-zA-Z0-9]*\s*\(([^()]*)\)\s*(?::\s*[a-zA-Z][a-zA-Z0-9]*)?$/;
      return regex.test(value);
    }
  
    parseItem(value) {
      const regex =
        /^([\+\-\#])([a-zA-Z][a-zA-Z0-9]*)\s*\(([^)]*)\)\s*(?::\s*([a-zA-Z][a-zA-Z0-9]*))?$/;
      const match = value.match(regex);
      if (!match) {
        return null;
      }
      const visibilityMap = {
        "+": "public",
        "#": "protected",
        "-": "private",
      };
      const visibility = visibilityMap[match[1]];
      const name = match[2];
      const paramsString = match[3].trim();
      const returnType = match[4] ? match[4].trim() : "void";
  
      const params = [];
      if (paramsString !== "") {
        const paramsArray = paramsString.split(",");
        for (let paramStr of paramsArray) {
          const paramMatch = paramStr
              .trim()
              .match(/^([a-zA-Z][a-zA-Z0-9]*)\s*:\s*([a-zA-Z][a-zA-Z0-9]*)(\s*\[(\d+|\d+\.\.\d+|\d+\.\.\*)\])?$/);
          if (!paramMatch) {
            return null;
          }
          params.push({
            _type: "UMLParameter",
            name: paramMatch[1],
            type: { name: paramMatch[2] },
            direction: 0,
            multiplicity: paramMatch[4] || "0..1",
          });
        }
      }
      return {
        visibility,
        name,
        parameters: params,
        returnType,
      };
    }
  
    updateItem(operation, parsed) {
      operation.visibility = parsed.visibility;
      operation.name = parsed.name;
      operation.returnType = { name: parsed.returnType };
      operation.ownedElements = parsed.parameters;
    }
  
    createNewItem(parsed) {
      return {
        _type: "UMLOperation",
        visibility: parsed.visibility,
        name: parsed.name,
        returnType: { name: parsed.returnType },
        ownedElements: parsed.parameters,
      };
    }
  }
  