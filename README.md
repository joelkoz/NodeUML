# NodeUML

**NodeUML** is a Visual Studio Code extension for creating UML class diagrams and generating source code from them. It integrates seamlessly with [NodeMDA](https://github.com/joelkoz/NodeMDA), enabling a model-driven development (MDD) workflow. With NodeUML, you can graphically design your application's architecture, configure the code generator, and produce platform-specific source code directly from your UML models.

## Key Features

- **Intuitive UML Diagramming**
  - Click-and-drag interface with undo/redo functionality.
  - Support for UML elements: classes, attributes, operations, actors, associations, dependencies, and generalizations.
  - Tool palette for easy creation of UML components.

- **Model Management**
  - Multi-level package structure with a `Model Explorer` tree view.
  - Editable properties for all model elements via the `Model Properties` panel.

- **Customizable Profiles**
  - Define data types, stereotypes, and tags for custom NodeMDA code generation plugins.

- **Code Generation**
  - Generate code directly from `.numl` models using NodeMDA.
  - Supports multiple languages and frameworks with NodeMDA plugins.

---

## Getting Started

### Installation

> **Note**: NodeUML is currently under development. To use the extension, you must build it from source.

1. Clone this repository:
   ```bash
   git clone https://github.com/joelkoz/NodeUML.git
   cd NodeUML
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Open the project folder in Visual Studio Code.
4. Press `F5` to launch the extension in a development environment.

---

## Workflow Overview

1. **Create a UML Model**: Right-click in the VSCode File Explorer to create a new `.numl` file.
2. **Add Classes and Relationships**: Use the diagram editor or the `Model Explorer` to build your model.
3. **Run the Code Generator**: Configure and generate platform-specific code from your UML model.
4. **Develop and Iterate**: Modify your UML model as your application evolves.

---

## Using NodeUML

### Creating a New Model
1. Open a folder in VSCode.
2. Right-click on a file or folder in the File Explorer and select **New UML Model**.
3. A `.numl` file will be created in a `uml` folder and opened in the Diagram Editor.

### Editing a Model
1. Open a `.numl` file to access the Diagram Editor.
2. Expand the **UML Tools** icon in the Activity Bar to view:
   - **Model Explorer**: Tree view of the model components.
   - **Model Properties**: Edit properties of selected elements (e.g., name, visibility, stereotypes, tags).
3. Use the Tool Palette in the Diagram Editor to add elements:
   - **New Class**, **New Entity**, or **New Service** tools for creating classes.
   - **Association**, **Dependency**, or **Generalization** tools for relationships.

### Adding Attributes and Operations
- **Preferred Method**: Click the green "+" on a class in the Diagram Editor to open the Attribute/Operation Editor. Use this format:
  ```
  [visibility]name: type [multiplicity]
  ```
  Example: `+age: Integer [1]`
- **Alternative Method**: Right-click a class in the Model Explorer and select **Add Element** > **Attribute** or **Operation**.

### Relationships
- Drag relationships (e.g., Associations, Dependencies) from the Tool Palette and connect classes or actors.
- Generalizations can be created between classes using the same method.

### Code Generation
1. Use the VSCode Command Palette to run **NodeUML: Configure Code Generator**. Configure the following:
   - **Force Overwrite**: Overwrite all files if enabled.
   - **NodeMDA Status**: Check or install NodeMDA.
   - **Target Platform**: Choose a NodeMDA plugin for code generation (e.g., `nodemda-java`).
2. Save your `.numl` file.
3. Right-click the `Model` node in the `Model Explorer` and select **Generate Code from UML**.

---

## Requirements

- Visual Studio Code (1.80 or later)
- Node.js (20.x or later)

---

## Development Notes

- New elements can be added via the Diagram Editor or the `Model Explorer` tree view.
- Undo/redo actions are supported using standard shortcuts (e.g., `Cmd+Z` on macOS).
- `.numl` files store UML models as JSON and are fully compatible with NodeMDA.

---

## Contributing

NodeUML is an open-source project. Contributions are welcome! To contribute:
1. Fork the repository.
2. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Submit a pull request with a clear description of the changes.

---

## Why NodeUML?
Why did I write this extension? I am a big believer in Open Source Software. After a long career in software developent where I benefited greaty from OSS, I felt a need to give back. Having developed a large, commercially successful SaaS application in Java using the MDA methodology, I wrote NodeMDA in 2016 as a way to learn NodeJS. 

This year, I wanted to practice coding using ChatGPT. As I continued to push the envelope of what ChatGPT could do, I tried to think of the most ambitious project I could give to ChatGPT. I had switched to VSCode as my preferred IDE about six years ago. I had just finished a new plugin for NodeMDA to create apps using Koa, React, and MongoDB (I wrote that to learn that platform).  I always wanted a free, open source UML tool taylored specificially for use with NodeMDA. I had no idea how to write an extension, so those two converged and I decided to get ChatGPT to write the extension for me.  A large percentage of the code that makes up NodeUML was written by ChatGPT - I'd guess about 75%. However, that 75% did not come out on its own.  It took a lot of work on my part to get that code to work, checking it, and having ChatGPT write and rewrite the code until it worked like I wanted.  The experience was much closer to a "paired programming" project where two developers worked side by side. I would say the final result is a 50/50 effort, where my design specs, oversight, and testing was required to finish the job.  As a matter of fact, the instructions in this README was written by ChatGPT, with the exception of this paragraph. Next up is for me to create a NodeMDA plugin that generates specifications to prompt an LLM to write specs for the designed UML model.
---

## License

NodeUML is released under the MIT License. See the [LICENSE](./LICENSE) file for details.
