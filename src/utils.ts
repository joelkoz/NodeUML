// toCamelCase.ts

export function isCamelCase(str: string): boolean {
    return /^[a-z]+([A-Z][a-z0-9]*)*$/.test(str);
}

export function camelCase(str: string): string {
    if (isCamelCase(str)) {
        return str;
    }

    const words = str
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map(word => word.toLowerCase());

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        if (word.length > 0) {
            words[i] = word[0].toUpperCase() + word.slice(1);
        }
    }

    return words.join('');
}

export function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 16; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}


export function assignProperty(obj: any, propName: string, value: any) {
    const keys = propName.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!current[key] || typeof current[key] !== 'object') {
            current[key] = {}; // Create the object if it doesn't exist
        }
        current = current[key];
    }

    current[keys[keys.length - 1]] = value;
}


export function getPropertyValue(obj: any, propName: string, defaultValue: any) {
    const keys = propName.split('.');
    let current = obj;

    for (let key of keys) {
        if (current && typeof current === 'object' && key in current) {
            current = current[key];
        } else {
            return defaultValue; // Return defaultValue if the property (or child object) doesn't exist
        }
    }

    if (current) {
        return current;
    }
    else {
        return defaultValue;
    }
}
