import * as vscode from 'vscode';
import { AbstractNode, DataTypeNode, MetaElementNode, TagNode, UMLVisibility } from '../metaModel';
import { propertyDefinitions, PropertyDefinition } from './propertyDefinitions';
import { openProjects } from '../projectDocument';
import * as utils from '../utils';

const subCount = 0;

export class PropertiesProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _selectedNode: MetaElementNode | null = null;

    private htmlContent: string = '';
    private jsContent: string = '';
    private jsHasListSupport: boolean = false;
    private cssHasModelStyles: boolean = false;

    constructor(private readonly context: vscode.ExtensionContext) {}

    resolveWebviewView(view: vscode.WebviewView) {
        this._view = view;
        this._view.webview.options = {
            enableScripts: true,
            enableForms: true,
            localResourceRoots: [this.context.extensionUri]
        };        
        this.update();
        this._view.webview.onDidReceiveMessage(message => this.handleUpdateProperty(message.field, message.value));
    }


    
    setSelectedNode(node: MetaElementNode | null) {
        console.log('PropertiesProvider: Setting selected node to ' + node?.name || 'null');        
        this._selectedNode = node;
        if (node) {
            this.generateContent(node);
        }
        this.update();
    }

    private generateContent(node: MetaElementNode) {
        this.htmlContent = '';
        this.jsContent = '';
        this.jsHasListSupport = false;
        this.cssHasModelStyles = false;

        const config = propertyDefinitions[node._type] || [];
        config.forEach(({ property, label, controlType, options, referenceType }) => {
            switch (controlType) {
                case 'input':
                    this.addInput(property, label, utils.getPropertyValue((node as any), property, ''));
                    break;
                case 'select':
                    this.addSelect(property, label, options || [], utils.getPropertyValue((node as any), property,  options?.[0]));
                    break;
                case 'datatype':
                    this.addDataTypeSelect(property, label, utils.getPropertyValue((node as any), property, ''));
                    break;   
                case 'referenceList':
                    this.addReferenceList(property, label, referenceType!, utils.getPropertyValue((node as any), property, []));
                    break;      
                case 'tagValueList':
                    this.addTagValueList(property, label, utils.getPropertyValue((node as any), property, []));
                    break;                               
                case 'textarea':
                    this.addInput(property, label, utils.getPropertyValue((node as any), property, ''), 'textarea');
                    break;
                case 'readonly':
                    this.addInput(property, label, utils.getPropertyValue((node as any), property, ''), 'readonly');
                    break;
                case 'checkbox':
                    this.addCheckbox(property, label, utils.getPropertyValue((node as any), property, false));
                    break;
            }
        });
    }

    private addInput(propertyName: string, label: string, value: string, type: string = 'text') {
        const controlId = propertyName;
        this.htmlContent += `<div class="property-widget"><label for="${controlId}">${label}:</label><br/>`;
        
        if (type === 'textarea') {
            this.htmlContent += `<textarea id="${controlId}" rows="3">${value}</textarea>`;
        }
        else if (type === 'readonly') {
            this.htmlContent += `<input type="${type}" id="${controlId}" value="${value}" readonly />`;
                    }
        else {
            this.htmlContent += `<input type="${type}" id="${controlId}" value="${value}" />`;
        }
        this.htmlContent += `</div><br />`;

        this.jsContent += `
            document.getElementById('${controlId}').onchange = (e) => {
                vscode.postMessage({ command: 'updateProperty', field: '${propertyName}', value: e.target.value });
            };
        `;
    }

    private addSelect(propertyName: string, label: string, options: string[], selectedValue: string) {
        const controlId = propertyName;
        this.htmlContent += `<div class="property-widget"><label for="${controlId}">${label}:</label><br/><select id="${controlId}" class="dropdown">`;
        
        options.forEach(option => {
            const selected = option === selectedValue ? 'selected' : '';
            this.htmlContent += `<option ${selected}>${option}</option>`;
        });
        
        this.htmlContent += `</select>`;
        this.htmlContent += `</div><br />`;

        this.jsContent += `
            document.getElementById('${controlId}').onchange = (e) => {
                vscode.postMessage({ command: 'updateProperty', field: '${propertyName}', value: e.target.value });
            };
        `;
    }


    private addDataTypeSelect(propertyName: string, label: string, selectedValue: DataTypeNode) {
        const controlId = propertyName;
        const dataTypes = openProjects.currentProjectDoc!.project.gatherAll('UMLDataType');
        this.htmlContent += `<div class="property-widget"><label for="${controlId}">${label}:</label><br/><select id="${controlId}" class="dropdown">`;
        
        dataTypes.forEach(({ node }) => {
            const selected = node._id === selectedValue._id ? 'selected' : '';
            this.htmlContent += `<option value="${node._id}" ${selected}>${node.name}</option>`;
        });
        
        this.htmlContent += `</select></div><br />`;
    
        // JavaScript for handling selection changes
        this.jsContent += `
            document.getElementById('${controlId}').onchange = (e) => {
                vscode.postMessage({
                    command: 'updateProperty',
                    field: '${propertyName}',
                    value: { $ref: e.target.value }
                });
            };
        `;
    }

    private addModelStyles() {
        if (!this.cssHasModelStyles) {
            this.htmlContent += `
            <style>
                .modal {
                    display: none;
                    position: fixed;
                    z-index: 1;
                    left: 0; 
                    top: 5em;
                    width: 100%; height: 100%;
                    overflow: auto;
                    background-color: rgba(0,0,0,0.4);
                }
                .modal label {
                    margin-bottom: 5px;
                }
                .modal select {
                    margin-bottom: 10px;
                }
                .modal button {
                    margin-right: 5px;
                }
                .modal-content {
                    background-color: var(--vscode-editor-background);
                    margin: 15% auto;
                    padding: 15px;
                    border: 1px solid var(--vscode-input-border);
                    width: 80%;
                }
                .close {
                    color: var(--vscode-editor-foreground);
                    float: right;
                    font-size: 28px;
                    font-weight: bold;
                    cursor: pointer;
                    position: relative;
                    top: -15px;
                }
    
                input:read-only {
                    color: grey;
                }
            </style>
            `;
            this.cssHasModelStyles = true;
        }

    }

    private addReferenceList(propertyName: string, label: string, referenceType: string, selectedValues: any[]) {
        const selectId = `${propertyName}Select`;
        const controlId = propertyName;
    
        // Gather all possible nodes of the referenceType
        const possibleNodes = openProjects.currentProjectDoc!.project.gatherAll(referenceType);
    
        // Map node IDs to names for easy lookup
        const nodeMap = new Map<string, string>();
        possibleNodes.forEach(({ node }) => {
            nodeMap.set(node._id, node.name);
        });
    
        // Get the list of selected node IDs
        const selectedNodeIds = selectedValues.map((node: any) => node._id);
    
        // Generate options for the select element
        const selectedOptions = selectedNodeIds.map((nodeId: string) => {
            const nodeName = nodeMap.get(nodeId) || 'Unknown';
            return `<option value="${nodeId}">${nodeName}</option>`;
        }).join('');
    
        // HTML for the list and modal dialog
        this.htmlContent += `
        <div class="property-widget">
            <label>${label}:</label>
            <div id="${propertyName}" class="list-container">
                <select id="${selectId}" size="3" style="width: 100%;">
                    ${selectedOptions}
                </select>
                <br />
                <button id="${propertyName}AddButton">+</button>
                <button id="${propertyName}RemoveButton">-</button>
            </div>
        </div><br />
    
        <!-- Modal Dialog -->
        <div id="${propertyName}Modal" class="modal">
            <div class="modal-content">
                <span id="${propertyName}ModalClose" class="close">&times;</span>
                <label for="${propertyName}ModalSelect">Select ${label}:</label><br/>
                <select id="${propertyName}ModalSelect">
                    ${possibleNodes.map(({ node }) => {
                        const nodeId = node._id;
                        const nodeName = node.name;
                        return `<option value="${nodeId}">${nodeName}</option>`;
                    }).join('')}
                </select><br/>
                <button id="${propertyName}ModalAddButton" type="button">Add</button>
                <button id="${propertyName}ModalCancelButton" type="button">Cancel</button>
            </div>
        </div>
        `;
    
        // Add CSS for the modal dialog (you can adjust styles as needed)
        this.addModelStyles();
    
        // JavaScript to handle modal interactions
        this.jsContent += `
        (function() {
            const refList = document.getElementById('${selectId}');
            const addButton = document.getElementById('${propertyName}AddButton');
            const removeButton = document.getElementById('${propertyName}RemoveButton');
            const modal = document.getElementById('${propertyName}Modal');
            const modalSelect = document.getElementById('${propertyName}ModalSelect');
            const modalClose = document.getElementById('${propertyName}ModalClose');
            const modalAddButton = document.getElementById('${propertyName}ModalAddButton');
            const modalCancelButton = document.getElementById('${propertyName}ModalCancelButton');
    
            addButton.onclick = (e) => {
                e.preventDefault();
                modal.style.display = 'block';
            };
    
            modalClose.onclick = () => {
                modal.style.display = 'none';
            };
    
            modalCancelButton.onclick = () => {
                modal.style.display = 'none';
            };
    
            modalAddButton.onclick = () => {
                const selectedOption = modalSelect.options[modalSelect.selectedIndex];
                const nodeId = selectedOption.value;
                const nodeName = selectedOption.textContent;
    
                // Check if already in the list
                for (let i = 0; i < refList.options.length; i++) {
                    if (refList.options[i].value === nodeId) {
                        modal.style.display = 'none';
                        return;
                    }
                }
    
                // Add new option to the select element
                const option = document.createElement('option');
                option.value = nodeId;
                option.textContent = nodeName;
                refList.appendChild(option);
    
                // Update the property value
                const selectedValues = Array.from(refList.options).map(opt => ({ $ref: opt.value }));
                vscode.postMessage({ command: 'updateProperty', field: '${propertyName}', value: selectedValues });
    
                modal.style.display = 'none';
            };
    
            removeButton.onclick = (e) => {
                e.preventDefault();
                const selectedIndex = refList.selectedIndex;
                if (selectedIndex >= 0) {
                    refList.remove(selectedIndex);
                    const selectedValues = Array.from(refList.options).map(opt => ({ $ref: opt.value }));              
                    vscode.postMessage({ command: 'updateProperty', field: '${propertyName}', value: selectedValues });
                }
            };
    
            // Close modal when clicking outside of it
            window.onclick = function(event) {
                if (event.target == modal) {
                    modal.style.display = 'none';
                }
            };
        })();
        `;
    }

    private addTagValueList(propertyName: string, label: string, selectedTags: TagNode[]) {
        const listId = `${propertyName}List`;
        const addButtonId = `${propertyName}AddButton`;
        const removeButtonId = `${propertyName}RemoveButton`;
    
        // Gather all possible tag definitions (include all)
        const possibleTags = openProjects.currentProject!.gatherAll('UMLTag');
    
        // Create an object mapping tag names to tag values
        const tagDefinitionsObj: { [key: string]: string } = {};
        possibleTags.forEach((tagDef) => {
            const node = tagDef.node as TagNode;
            tagDefinitionsObj[node.name] = node.value || '';
        });
    
        // Include "<new>" option
        const tagOptions = [`<option value="<new>">&lt;new&gt;</option>`]
            .concat(possibleTags.map(({ node }) => {
                const nodeName = node.name;
                return `<option value="${nodeName}">${nodeName}</option>`;
            })).join('');
    
        // Generate HTML for the list of tags
        this.htmlContent += `
        <div class="property-widget">
            <label>${label}:</label>
            <div id="${propertyName}" class="tag-value-list">
                <table id="${listId}" style="width: 100%;">
                    <tr>
                        <th>Name</th>
                        <th>Value</th>
                    </tr>
                    ${selectedTags.map((tag, index) => `
                    <tr data-index="${index}">
                        <td><input type="text" id="${propertyName}_name_${index}" value="${tag.name}" /></td>
                        <td><input type="text" id="${propertyName}_value_${index}" value="${tag.value}" /></td>
                    </tr>`).join('')}
                </table>
                <br />
                <button id="${addButtonId}" type="button">+</button>
                <button id="${removeButtonId}" type="button">-</button>
            </div>
        </div><br />
        `;
    
        // Modal dialog for selecting tags to add
        const modalId = `${propertyName}Modal`;
        const modalSelectId = `${propertyName}ModalSelect`;
        const modalAddButtonId = `${propertyName}ModalAddButton`;
        const modalCancelButtonId = `${propertyName}ModalCancelButton`;
        const modalCloseId = `${propertyName}ModalClose`;
    
        this.htmlContent += `
        <!-- Modal Dialog -->
        <div id="${modalId}" class="modal">
            <div class="modal-content">
                <span id="${modalCloseId}" class="close">&times;</span>
                <label for="${modalSelectId}">Select ${label}:</label><br/>
                <select id="${modalSelectId}">
                    ${tagOptions}
                </select><br/>
                <button id="${modalAddButtonId}" type="button">Add</button>
                <button id="${modalCancelButtonId}" type="button">Cancel</button>
            </div>
        </div>
        `;
    
        this.addModelStyles();

        // JavaScript to handle interactions
        // Inject `tagDefinitionsObj` into the JavaScript code
        this.jsContent += `
        (function() {
            const tagDefinitions = ${JSON.stringify(tagDefinitionsObj)};
            const tagList = document.getElementById('${listId}');
            const addButton = document.getElementById('${addButtonId}');
            const removeButton = document.getElementById('${removeButtonId}');
            const modal = document.getElementById('${modalId}');
            const modalSelect = document.getElementById('${modalSelectId}');
            const modalClose = document.getElementById('${modalCloseId}');
            const modalAddButton = document.getElementById('${modalAddButtonId}');
            const modalCancelButton = document.getElementById('${modalCancelButtonId}');
    
            // Handle '+' button click
            addButton.onclick = (e) => {
                e.preventDefault();
                modal.style.display = 'block';
            };
    
            // Handle modal 'Add' button click
            modalAddButton.onclick = (e) => {
                e.preventDefault();
                const selectedOption = modalSelect.options[modalSelect.selectedIndex];
                const tagName = selectedOption.value;
    
                let newTagName = tagName;
                let newTagValue = '';
    
                if (tagName === '<new>') {
                    newTagName = 'newTag';
                } else {
                    newTagValue = tagDefinitions[tagName] || '';
                }
    
                // Add new tag to the list
                const index = tagList.rows.length - 1; // Adjust for header row
                const row = tagList.insertRow();
                row.setAttribute('data-index', index);
                const cellName = row.insertCell(0);
                const cellValue = row.insertCell(1);
    
                cellName.innerHTML = '<input type="text" id="${propertyName}_name_' + index + '" value="' + newTagName + '" />';
                cellValue.innerHTML = '<input type="text" id="${propertyName}_value_' + index + '" value="' + newTagValue + '" />';
    
                // Attach event listeners for changes
                cellName.querySelector('input').addEventListener('change', sendUpdateProperty);
                cellValue.querySelector('input').addEventListener('change', sendUpdateProperty);
    
                sendUpdateProperty();
    
                modal.style.display = 'none';
            };
    
            // Handle modal 'Cancel' button click
            modalCancelButton.onclick = (e) => {
                e.preventDefault();
                modal.style.display = 'none';
            };
    
            // Handle modal 'Close' button click
            modalClose.onclick = (e) => {
                e.preventDefault();
                modal.style.display = 'none';
            };
    
            // Handle '-' button click
            removeButton.onclick = (e) => {
                e.preventDefault();
                const selectedRow = tagList.querySelector('tr.selected');
                if (selectedRow) {
                    tagList.deleteRow(selectedRow.rowIndex);
                    // Reassign data-index attributes and IDs
                    const rows = tagList.querySelectorAll('tr');
                    for (let i = 1; i < rows.length; i++) {
                        rows[i].setAttribute('data-index', i - 1);
                        const inputs = rows[i].querySelectorAll('input');
                        inputs[0].id = '${propertyName}_name_' + (i - 1);
                        inputs[1].id = '${propertyName}_value_' + (i - 1);
                    }
                    sendUpdateProperty();
                }
            };
    
            // Handle row selection
            tagList.onclick = (e) => {
                const tr = e.target.closest('tr');
                if (!tr || tr.rowIndex === 0) return; // Skip header row
                Array.from(tagList.rows).forEach(row => row.classList.remove('selected'));
                tr.classList.add('selected');
            };
    
            // Handle value changes
            const nameInputs = tagList.querySelectorAll('input[id^="${propertyName}_name_"]');
            const valueInputs = tagList.querySelectorAll('input[id^="${propertyName}_value_"]');
    
            nameInputs.forEach(input => {
                input.addEventListener('change', sendUpdateProperty);
            });
    
            valueInputs.forEach(input => {
                input.addEventListener('change', sendUpdateProperty);
            });
    
            // Function to send updateProperty message
            function sendUpdateProperty() {
                const tags = [];
                const rows = tagList.querySelectorAll('tr');
                for (let i = 1; i < rows.length; i++) {
                    const inputs = rows[i].querySelectorAll('input');
                    const tagName = inputs[0].value;
                    const tagValue = inputs[1].value;
                    tags.push({ name: tagName, value: tagValue, _type: 'UMLTag' });
                }
                vscode.postMessage({ command: 'updateProperty', field: '${propertyName}', value: tags });
            }
    
            // Close modal when clicking outside of it
            window.onclick = function(event) {
                if (event.target == modal) {
                    modal.style.display = 'none';
                }
            };
        })();
        `;
    }
    
    private addCheckbox(propertyName: string, label: string, checked: boolean) {
        const controlId = propertyName;
        this.htmlContent += `<div class="property-widget"><input type="checkbox" id="${controlId}" ${checked ? 'checked' : ''} />
                             <label for="${controlId}">${label}:</label>`;
        this.htmlContent += `</div><br />`;

        this.jsContent += `
            document.getElementById('${controlId}').onchange = (e) => {
                vscode.postMessage({ command: 'updateProperty', field: '${propertyName}', value: e.target.checked });
            };
        `;
    }

    private update() {
        console.log('PropertiesProvider: update()...');
        if (this._view) {            
            if (this._selectedNode) {
                this._view.webview.html = this.getHtmlForNode();
            }
            else {
                this._view.webview.html = '<html><body>No meta element selected</body></html>';
            }
        }
    }

    private getHtmlForNode(): string {
        let editorType = '';
        if (this._selectedNode) {
            editorType = this._selectedNode._type.slice(3);
        }
        return `
            <html>
                <head>
                    <style>
                        body {
                            color: var(--vscode-editor-foreground);
                            background-color: var(--vscode-editor-background);
                            font-family: var(--vscode-font-family);
                            font-size: var(--vscode-font-size);
                        }
                        input, select, button, textarea {
                            color: var(--vscode-input-foreground);
                            background-color: var(--vscode-input-background);
                            border: 1px solid var(--vscode-input-border);
                        }
                        textarea {
                            width: 100%;
                        }
                        label{
                            display: inline-block;
                            margin-bottom: 3px;
                        }
                        .property-widget {
                            margin-bottom: 0px;
                        }
                        .list-container button{
                            margin-top: 6px;                            
                        }
                    </style>                
                </head>
                <body>
                    <h3>${editorType} Properties</h3>
                    <form>
                        ${this.htmlContent}
                    </form>
                    <script>
                        const vscode = acquireVsCodeApi();

                        ${this.jsContent}
                    </script>
                </body>
            </html>
        `;
    }


    public refresh() {
        this.setSelectedNode(this._selectedNode);
    }


    private handleUpdateProperty(field: string, value: any) {
        if (this._selectedNode) {
            console.log(`PropertiesProvider: web view sent updateProperty('${field}', ${JSON.stringify(value)})...`);
            // Check if value is a reference object
            vscode.commands.executeCommand('nodeuml.updateProperty', field, value);

            if (field === 'type' || field === 'stereotypes') {
                this.refresh();
            }
        }
    }
}
