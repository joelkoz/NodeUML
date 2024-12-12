import { ProjectDocument } from '../projectDocument';
import * as meta from '../metaModel';

export interface ICommand {
    label: string;
    execute(doc: ProjectDocument): void;
    undo(doc: ProjectDocument): void;
}


export class CommandManager {

    private _document: ProjectDocument;

    private undoStack: ICommand[] = [];
    private redoStack: ICommand[] = [];

    constructor(document: ProjectDocument) {
        this._document = document;
    }

    executeCommand(command: ICommand): void {
        console.log('CommandManager.executeCommand: ' + command.label);
        command.execute(this._document);
        this.undoStack.push(command);
        this.redoStack = []; // Clear redo stack
    }

    lastCommandLabel(): string {
        if (this.undoStack.length > 0) {
            const ndx = this.undoStack.length - 1;
            return this.undoStack[ndx].label;
        }
        else {
            return '<empty>';
        }
    }

    undo(): void {
        const command = this.undoStack.pop();
        console.log('CommandManager.undo: ' + command?.label);
        if (command) {
            command.undo(this._document);
            this.redoStack.push(command);
        }
    }

    redo(): void {
        const command = this.redoStack.pop();
        console.log('CommandManager.redo: ' + command?.label);
        if (command) {
            command.execute(this._document);
            this.undoStack.push(command);
        }
    }

    clear(): void {
        this.undoStack = [];
        this.redoStack = [];
    }
}

