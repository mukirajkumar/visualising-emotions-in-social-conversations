
export function getIndices(regex: RegExp, text: string): [number, number][] {

    const matches = [];
    let match = null;
    while ((match = regex.exec(text)) != null) {
        matches.push(match);
    }

    return matches.map(match => [match.index, match.index + match[0].length]);
}