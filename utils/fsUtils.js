import fs from 'fs';
import path from 'path';

export function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Directory created: ${dirPath}`);
  }
}

export function readJSON(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    } else {
      console.warn(`File not found: ${filePath}`);
      return null;
    }
  } catch (err) {
    console.error(`Failed to read JSON file at ${filePath}:`, err);
    return null;
  }
}

export function writeJSON(filePath, data) {
  try {
    const dir = path.dirname(filePath);
    ensureDirExists(dir);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`Successfully wrote JSON to ${filePath}`);
  } catch (err) {
    console.error(`Failed to write JSON file at ${filePath}:`, err);
  }
}