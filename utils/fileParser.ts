
import { FileData } from '../types';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

/**
 * Reads a File object and converts it into a base64 encoded string.
 */
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64String = (reader.result as string).split(',')[1];
            if (!base64String) {
                reject(new Error("Failed to read file as base64."));
            } else {
                resolve(base64String);
            }
        };
        reader.onerror = error => reject(error);
    });
};

/**
 * Reads a File object as text.
 */
const fileToText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsText(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

/**
 * Parses a File object into our custom FileData structure.
 */
export const parseFile = async (file: File): Promise<FileData> => {
    if (!file) {
        throw new Error("No file provided to parse.");
    }

    if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File is too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB.`);
    }

    const fileData: FileData = {
        name: file.name,
        type: file.type,
        size: file.size,
        content: '',
    };

    const extension = file.name.split('.').pop()?.toLowerCase();

    // Handle Word Documents
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || extension === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        fileData.extractedText = result.value;
        fileData.content = await fileToBase64(file);
    } 
    // Handle Excel Sheets
    else if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || extension === 'xlsx' || extension === 'xls' || extension === 'csv') {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer);
        let combinedText = '';
        workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            combinedText += `\n--- Sheet: ${sheetName} ---\n`;
            combinedText += XLSX.utils.sheet_to_csv(worksheet);
        });
        fileData.extractedText = combinedText;
        fileData.content = await fileToBase64(file);
    }
    // Handle plain text files
    else if (file.type === 'text/plain' || extension === 'txt' || extension === 'md') {
        fileData.extractedText = await fileToText(file);
        fileData.content = await fileToBase64(file);
    }
    // Handle standard Gemini supported types (Images, PDF, Audio, Video)
    else {
        fileData.content = await fileToBase64(file);
    }

    return fileData;
};
