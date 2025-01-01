# NodeUML

**NodeUML** is a Visual Studio Code extension for creating UML class diagrams and generating source code from them. It integrates seamlessly with [NodeMDA](https://github.com/joelkoz/NodeMDA), enabling a model-driven development (MDD) workflow. With NodeUML, it is as simple as:

## **1. Define your data classes**
![WYSIWYG diagraming to create class definitions](/media/NodeUML-create.gif)

## **2. Define your permissions**
![Draw dependencies to Actors to represent permissions](/media/NodeUML-permissions.gif)

## **3. Generate your code**
![Generate complete working code in any language](/media/NodeUML-gen.gif)


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

   *From NodeUML directory*
   ```bash
   npm install
   ```
3. Open the project folder in Visual Studio Code.
4. Press `F5` to launch the extension in a development environment.

5. (Optional): Bundle as .vsix file and install directly into vscode:

   *From NodeUML directory*

   ```
   npm install -g vsce

   vsce package
   ```
   *Then select "Install from VSIX" from VSCode Extensions panel*
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

   (*alternative*) Select File -> New File -> New UML Model 
3. A `.numl` file will be created in a `uml` folder and opened in the Diagram Editor.

### Editing a Model
1. Open a `.numl` file to access the Diagram Editor.

2. Expand the **UML Tools** icon in the Activity Bar to view:
   - **Model Explorer**: Tree view of the model components.
   - **Model Properties**: Edit properties of selected elements (e.g., name, visibility, stereotypes, tags).
   
3. New elements can be added via the Diagram Editor OR a right-click anywhere on the `Model Explorer` tree view.
   - Use the Tool Palette in the Diagram Editor to add elements:
      - **New Class**, **New Entity**, or **New Service** tools for creating classes. Select the tool, then click on blank space in diagram to create
      - **Association**, **Dependency**, or **Generalization** tools for relationships. Click and hold on edge of source class. Drag mouse to edge of target class
   - **Alternative Method**: Right-click on the model or a package node in the Model Explorer and select **Add Element** > **Class**

### Adding Attributes and Operations
- **Preferred Method**: Click the green "+" on a class in the Diagram Editor to open the Class Definition Quick Editor. 
  - Quickly change class name and stereotype
  - Press ENTER to advance to next section
  - Enter one or more attributes using this format:
    ```
    [visibility]name: type [multiplicity]
    ```

    Example: `+age: Integer [1]`

  - Use the up and down arrows in the attributes section to move to next/previous attribute
  - Enter one or more operations using this format:

    ```
    [visibility]name(paramName: dataType[multiplicity], paramName2: dataType2[multiplicity]): optionalReturnType
    ```
    
    Example: `+foo(name: String[1]): Integer`

- **Alternative Method**: Right-click a class in the Model Explorer and select **Add Element** > **Attribute** or **Operation**.

### Profile definitions
- Create additional customized data types, actors, stereotypes, and tag values by creating a new "Profile" (or adding to an existing one):
1. Right click on "Profiles" node in Model Explorer
2. Select "Add Element" -> "Profile"
3. Give profile a name using Property editor
4. Right click on new profile and select "Add Element" to add additional entries to your profile
5. Right click on profile and select "Export profile" to save your custom profile to an external file
6. Right click on "Profiles" node and select "Import profile" to import profiles from other projects into your current one

### Additional editing features
- Scroll the diagram view window up/down and left/right using mouse 
- Zoom in/out by scrolling mouse wheel while holding down Cmd key (Mac) or Ctrl key (Windows)
- Returns to normal 1:1 zoom by double clicking on blank area of diagram
- Undo/redo actions are supported using standard shortcuts (e.g., `Cmd+Z` on macOS).
- Copy/Paste actions are supported from right mouse menu in Model Tree
  - Can copy attributes, operations, tag definitions, and complete classes
  - Multiple selections are allowed, but they must all be of the same type
  - Attributes and operations pasted onto a class are added at the end of the class definition
  - You can copy/paste to the same class
  - If you copy/paste tag definitions, those definitions will be ADDED to the tag list of the
    target node, as if they were added with the properties editor.
  - Due to limitations of VSCode API, you must make a node a selected node with a left click before pasting
    is available.

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

Why did I write this extension? I am a big believer in Open Source Software. After a long career in software development where I benefited greatly from OSS, I felt a need to give back. Having developed a large, commercially successful SaaS application in Java using the MDA methodology, I wrote NodeMDA in 2016 as a way to learn Node.js. 

In 2024, I wanted to practice coding using ChatGPT. As I continued to push the envelope of what ChatGPT could do, I tried to think of the most ambitious project I could give it (within reason). I had switched to VSCode as my preferred IDE about eight years ago. I had just finished a new plugin for NodeMDA to create apps using Koa, React, and MongoDB (I wrote that to learn that platform). I had long envisioned a free, open-source UML tool designed to integrate seamlessly with NodeMDA. I had no idea how to write an extension, so those two converged, and I decided to get ChatGPT to write the extension for me. A large percentage of the code that makes up NodeUML was written by ChatGPT—I’d guess about 80%. However, that 80% did not come out on its own. It took a lot of work on my part to get that code to work, checking it, and having ChatGPT write and rewrite the code until it worked like I wanted. The experience was much closer to a “pair programming” project where two developers worked side by side. I would say the final result is a 50/50 effort, where my design specs, oversight, and testing were required to finish the job. As a matter of fact, the instructions in this README were written by ChatGPT, with the exception of this paragraph. Next, I plan to create a NodeMDA plugin that generates a prompt to an LLM to write code from specifications generated from the designed UML model

---

## License

NodeUML is released under the MIT License. See the [LICENSE](./LICENSE) file for details.
