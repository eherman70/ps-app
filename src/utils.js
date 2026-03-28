/**
 * Simple CSV parser that handles basic quoted values and newlines.
 * @param {string} text The CSV text to parse.
 * @returns {string[][]} A 2D array of strings.
 */
export function parseCSV(text) {
  const lines = [];
  const chars = Array.from(text);
  let currentLine = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const nextChar = chars[i + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      currentField += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      currentLine.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentLine.push(currentField.trim());
      if (currentLine.length > 1 || currentLine[0] !== '') {
        lines.push(currentLine);
      }
      currentLine = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField || currentLine.length > 0) {
    currentLine.push(currentField.trim());
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Generates a CSV string from a 2D array.
 * @param {string[][]} rows 
 * @returns {string}
 */
export function generateCSV(rows) {
  return rows.map(row => 
    row.map(field => {
      const stringField = String(field || '');
      if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
        return `"${stringField.replace(/"/g, '""')}"`;
      }
      return stringField;
    }).join(',')
  ).join('\n');
}

/**
 * Triggers a download of a CSV file.
 * @param {string} filename 
 * @param {string} content 
 */
export function downloadCSV(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export function getScopedPS(currentUser, activePS) {
  const role = String(currentUser?.role || '').toLowerCase();
  const isSupervisor = role === 'admin' || role === 'supervisor';

  if (isSupervisor) {
    return activePS || 'All';
  }

  return currentUser?.ps || '';
}

export function filterItemsByPS(items, scopedPS, field = 'ps') {
  if (!Array.isArray(items)) {
    return [];
  }

  if (!scopedPS || scopedPS === 'All') {
    return items;
  }

  return items.filter(item => item?.[field] === scopedPS);
}
