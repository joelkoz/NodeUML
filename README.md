# nodeUML

**nodeUML** is a Visual Studio Code extension for creating and managing UML models. It is designed to be a companion to [NodeMDA](https://github.com/joelkoz/NodeMDA), providing a graphical interface for UML modeling that integrates seamlessly into a model-driven development (MDD) workflow. Models created with nodeUML are saved in `.numl` files and can be used directly with NodeMDA to generate source code.

## Key Features

- **Intuitive UML Diagramming**
  - Drag-and-drop interface for creating UML diagrams.
  - Support for core UML elements, including classes, attributes, methods, actors, associations, and dependencies.
  - Multiplicity and visibility options for attributes and associations.

- **Structured Models**
  - Manage models in a multi-level package structure.
  - Includes a `Model Explorer` view to navigate your project hierarchy.

- **Customizable Profiles**
  - Define data types, stereotypes, and tags for your model using JSON-based profiles.
  - Extend UML elements with additional metadata.

- **Seamless NodeMDA Integration**
  - Models saved as `.numl` files are directly compatible with NodeMDA for source code generation.

## Getting Started

### Installation
*** This project is a work in progress. As of this moment, you can only use this extension by building
from source.  Once the project reaches a release version, you will be able to install it from the
Visual Studio Code Marketplace. ***


### Creating a UML Model
1. Open a folder in Visual Studio Code.
2. Right click on any entry in the VSCode File Explorer and select `Create UML Model` to create a new `.numl` file.
3. Open the file to start building your model.

### Editing Diagrams
1. Open the `.numl` file to access the Diagram Editor.
2. Use the drag-and-drop palette to add elements to the diagram.
3. Use the Properties View to edit element details such as name, stereotypes, and tags.

### Exporting to NodeMDA
1. Save your `.numl` file.
2. Run NodeMDA to generate source code from your model.

## Requirements

- Visual Studio Code (1.80 or later)
- Node.js (16.x or later)

## Development

### Building from Source
1. Clone this repository.
2. Install dependencies:
   ```bash
   npm install
   ```
