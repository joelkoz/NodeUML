export interface PropertyDefinition {
    property: string;
    label: string;
    controlType: string;
    isNumericEnum?: boolean | undefined;
    options?: string[];
    referenceType?: string;    
}

export const propertyDefinitions: { [key: string]: PropertyDefinition[] } = {
    Project: [
        { property: 'name', label: 'Name', controlType: 'input' },
        { property: 'visibility', label: 'Visibility', controlType: 'select', isNumericEnum: true, options: ['public', 'protected', 'private'] },
        { property: 'stereotypes', label: 'Stereotypes', controlType: 'referenceList', referenceType: 'UMLStereotype' },
        { property: 'tags', label: 'Tags', controlType: 'tagValueList' },
        { property: 'comment', label: 'Comment', controlType: 'textarea' }
    ],
    Profiles: [
        { property: 'name', label: 'Name', controlType: 'input' },
        { property: 'visibility', label: 'Visibility', controlType: 'select', options: ['public', 'protected', 'private'] },
        { property: 'stereotypes', label: 'Stereotypes', controlType: 'referenceList', referenceType: 'UMLStereotype' },
        { property: 'tags', label: 'Tags', controlType: 'tagValueList' },
        { property: 'comment', label: 'Comment', controlType: 'textarea' }
    ],
    UMLModel: [
        { property: 'name', label: 'Name', controlType: 'input' },
        { property: 'visibility', label: 'Visibility', controlType: 'select', options: ['public', 'protected', 'private'] },
        { property: 'stereotypes', label: 'Stereotypes', controlType: 'referenceList', referenceType: 'UMLStereotype' },
        { property: 'tags', label: 'Tags', controlType: 'tagValueList' },
        { property: 'comment', label: 'Comment', controlType: 'textarea' }
    ],
    UMLProfile: [
        { property: 'name', label: 'Name', controlType: 'input' },
        { property: 'comment', label: 'Comment', controlType: 'textarea' }
    ],
    UMLClass: [
        { property: 'name', label: 'Name', controlType: 'input' },
        { property: 'visibility', label: 'Visibility', controlType: 'select', options: ['public', 'protected', 'private'] },
        { property: 'stereotypes', label: 'Stereotypes', controlType: 'referenceList', referenceType: 'UMLStereotype' },
        { property: 'tags', label: 'Tags', controlType: 'tagValueList' },
        { property: 'comment', label: 'Comment', controlType: 'textarea' }
    ],
    UMLActor: [
        { property: 'name', label: 'Name', controlType: 'input' },
        { property: 'visibility', label: 'Visibility', controlType: 'select', options: ['public', 'protected', 'private'] },
        { property: 'stereotypes', label: 'Stereotypes', controlType: 'referenceList', referenceType: 'UMLStereotype' },
        { property: 'tags', label: 'Tags', controlType: 'tagValueList' },
        { property: 'comment', label: 'Comment', controlType: 'textarea' }
    ],
    UMLAttribute: [
        { property: 'name', label: 'Name', controlType: 'input' },
        { property: 'type', label: 'Data type', controlType: 'datatype' },
        { property: 'visibility', label: 'Visibility', controlType: 'select', options: ['public', 'protected', 'private'] },
        { property: 'isStatic', label: 'Static', controlType: 'checkbox' },
        { property: 'isReadOnly', label: 'Read Only', controlType: 'checkbox' },
        { property: 'multiplicity', label: 'Multiplicity', controlType: 'select', options: ['', '1', '0..1', '0..*', '1..*'] },
        { property: 'stereotypes', label: 'Stereotypes', controlType: 'referenceList', referenceType: 'UMLStereotype' },
        { property: 'tags', label: 'Tags', controlType: 'tagValueList' },
        { property: 'comment', label: 'Comment', controlType: 'textarea' }
    ],
    UMLOperation: [
        { property: 'name', label: 'Name', controlType: 'input' },
        { property: 'returnType', label: 'Return type', controlType: 'datatype' },
        { property: 'visibility', label: 'Visibility', controlType: 'select', options: ['public', 'protected', 'private'] },
        { property: 'isStatic', label: 'Static', controlType: 'checkbox' },
        { property: 'isReadOnly', label: 'Read Only', controlType: 'checkbox' },
        { property: 'multiplicity', label: 'Multiplicity', controlType: 'select', options: ['', '1', '0..1', '0..*', '1..*'] },
        { property: 'stereotypes', label: 'Stereotypes', controlType: 'referenceList', referenceType: 'UMLStereotype' },
        { property: 'tags', label: 'Tags', controlType: 'tagValueList' },
        { property: 'comment', label: 'Comment', controlType: 'textarea' }
    ],
    UMLStereotype: [
        { property: 'name', label: 'Name', controlType: 'input' },
        { property: 'stereotypes', label: 'Stereotypes', controlType: 'referenceList', referenceType: 'UMLStereotype' },
        { property: 'tags', label: 'Tags', controlType: 'tagValueList' },
        { property: 'comment', label: 'Comment', controlType: 'textarea' }
    ],
    UMLTag: [
        { property: 'name', label: 'Name', controlType: 'input' },
        { property: 'value', label: 'Value', controlType: 'input' },
        { property: 'stereotypes', label: 'Stereotypes', controlType: 'referenceList', referenceType: 'UMLStereotype' },
        { property: 'comment', label: 'Comment', controlType: 'textarea' }
    ],
    UMLPackage: [
        { property: 'name', label: 'Name', controlType: 'input' },
        { property: 'visibility', label: 'Visibility', controlType: 'select', options: ['public', 'protected', 'private'] },
        { property: 'stereotypes', label: 'Stereotypes', controlType: 'referenceList', referenceType: 'UMLStereotype' },
        { property: 'tags', label: 'Tags', controlType: 'tagValueList' },
        { property: 'comment', label: 'Comment', controlType: 'textarea' }
    ],
    UMLDataType: [
        { property: 'name', label: 'Name', controlType: 'input' },
        { property: 'tags', label: 'Tags', controlType: 'tagValueList' },
        { property: 'comment', label: 'Comment', controlType: 'textarea' }
    ],
    UMLParameter: [
        { property: 'name', label: 'Name', controlType: 'input' },
        { property: 'type', label: 'Data type', controlType: 'datatype' },
        { property: 'direction', label: 'Direction', controlType: 'select', options: ['IN', 'OUT', 'INOUT', 'RETURN'] },
        { property: 'isReadOnly', label: 'Read Only', controlType: 'checkbox' },
        { property: 'multiplicity', label: 'Multiplicity', controlType: 'select', options: ['','1', '0..1', '0..*', '1..*'] },
        { property: 'isUnique', label: 'Unique', controlType: 'checkbox' },
        { property: 'defaultValue', label: 'Default Value', controlType: 'input' },
        { property: 'stereotypes', label: 'Stereotypes', controlType: 'referenceList', referenceType: 'UMLStereotype' },
        { property: 'tags', label: 'Tags', controlType: 'tagValueList' },
        { property: 'comment', label: 'Comment', controlType: 'textarea' }
    ],
    UMLAssociation: [
        { property: 'name', label: 'Link name', controlType: 'input' },
        { property: 'end1.node.name', label: 'End 1 connection', controlType: 'readonly' },
        { property: 'end1.name', label: 'End 1 name', controlType: 'input' },
        { property: 'end1.multiplicity', label: "End 1 Multiplicity", controlType: 'select', options: ['', '1', '0..1', '0..*', '1..*']},
        { property: 'end1.navigable', label: "End 1 Navigable", controlType: 'checkbox' },
        { property: 'end2.node.name', label: 'End 2 connection', controlType: 'readonly' },
        { property: 'end2.name', label: 'End 2 name', controlType: 'input' },
        { property: 'end2.multiplicity', label: "End 2 Multiplicity", controlType: 'select', options: ['','1', '0..1', '0..*', '1..*']},
        { property: 'end2.navigable', label: "End 2 Navigable", controlType: 'checkbox' },
        { property: 'stereotypes', label: 'Stereotypes', controlType: 'referenceList', referenceType: 'UMLStereotype' },
        { property: 'tags', label: 'Tags', controlType: 'tagValueList' },
        { property: 'comment', label: 'Comment', controlType: 'textarea' }
    ],
    UMLDependency: [
        { property: 'name', label: 'Name', controlType: 'input' },
        { property: 'end1.node.name', label: 'End 1 connection', controlType: 'readonly' },
        { property: 'end1.name', label: 'End 1 name', controlType: 'input' },
        { property: 'end1.multiplicity', label: "End 1 Multiplicity", controlType: 'select', options: ['', '1', '0..1', '0..*', '1..*']},
        { property: 'end2.node.name', label: 'End 2 connection', controlType: 'readonly' },
        { property: 'end2.name', label: 'End 2 name', controlType: 'input' },
        { property: 'end2.multiplicity', label: "End 2 Multiplicity", controlType: 'select', options: ['', '1', '0..1', '0..*', '1..*']},
        { property: 'stereotypes', label: 'Stereotypes', controlType: 'referenceList', referenceType: 'UMLStereotype' },
        { property: 'tags', label: 'Tags', controlType: 'tagValueList' },
        { property: 'comment', label: 'Comment', controlType: 'textarea' }
    ],
    UMLGeneralization: [
        { property: 'name', label: 'Name', controlType: 'input' },
        { property: 'end1.node.name', label: 'End 1 connection', controlType: 'readonly' },
        { property: 'end1.name', label: 'End 1 name', controlType: 'input' },
        { property: 'end1.multiplicity', label: "End 1 Multiplicity", controlType: 'select', options: ['', '1', '0..1', '0..*', '1..*']},
        { property: 'end2.node.name', label: 'End 2 connection', controlType: 'readonly' },
        { property: 'end2.name', label: 'End 2 name', controlType: 'input' },
        { property: 'end2.multiplicity', label: "End 2 Multiplicity", controlType: 'select', options: ['', '1', '0..1', '0..*', '1..*']},
        { property: 'stereotypes', label: 'Stereotypes', controlType: 'referenceList', referenceType: 'UMLStereotype' },
        { property: 'tags', label: 'Tags', controlType: 'tagValueList' },
        { property: 'comment', label: 'Comment', controlType: 'textarea' }
    ],
};
