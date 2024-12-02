
    // Mock metaModel with getDataTypes function
    const metaModel = {
      getDataTypes: async function() {
        return [
          {
            "packageName": "Primitives",
            "node": {
              "name": "String"
            }
          },
          {
            "packageName": "Primitives",
            "node": {
              "name": "Integer"
            }
          },
          {
            "packageName": "Primitives",
            "node": {
              "name": "Boolean"
            }
          },
          {
            "packageName": "Primitives",
            "node": {
              "name": "Float"
            }
          }
        ];
      }
    };

    // Mock jsonClass data
    const jsonClass = {
      "_id": "278c7dbe-c175-4bfc-b729-9fb041f37764",
      "name": "MyClass",
      "_type": "UMLClass",
      "ownedElements": [
        {
          "_id": "0fed7244-0f76-4cf3-8723-d5c090e43718",
          "name": "attribute1",
          "_type": "UMLAttribute",
          "visibility": "public",
          "type": {
            "name": "String"
          },
          "multiplicity": "0..1"
        },
        {
          "_id": "1fed7244-0f76-4cf3-8723-d5c090e43719",
          "name": "attribute2",
          "_type": "UMLAttribute",
          "visibility": "private",
          "type": {
            "name": "Integer"
          },
          "multiplicity": "1..*"
        }
      ]
    };

    // Usage example:
    // Instantiate the AttributeEditor with the mock data
    const editor = new AttributeEditor(jsonClass);

    // Override the onNewAttribute, onUpdateAttribute, and onRemoveAttribute methods for testing
    editor.onNewAttribute = function(jsonAttribute) {
      console.log("New Attribute:", jsonAttribute);
      // For testing, add it to the jsonClass ownedElements
      jsonClass.ownedElements.push(jsonAttribute);
      this.attributes = jsonClass.ownedElements.filter(
        (el) => el._type === "UMLAttribute"
      );
    };

    editor.onUpdateAttribute = function(jsonAttribute) {
      console.log("Updated Attribute:", jsonAttribute);
      // For testing, nothing else needed
    };

    editor.onRemoveAttribute = function(metaId) {
      console.log("Removed Attribute ID:", metaId);
      // For testing, remove it from the jsonClass ownedElements
      jsonClass.ownedElements = jsonClass.ownedElements.filter(
        (el) => el._id !== metaId
      );
      this.attributes = jsonClass.ownedElements.filter(
        (el) => el._type === "UMLAttribute"
      );
    };

    // Activate the editor
    editor.activate();
