"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateXlsx = generateXlsx;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const exceljs_1 = __importDefault(require("exceljs"));
const HEADER_FILL = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F3864" },
    bgColor: { argb: "FF1F3864" },
};
const KUNCI_FILL = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFC6E0B4" },
    bgColor: { argb: "FFC6E0B4" },
};
const ALT_FILL = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF2F2F2" },
    bgColor: { argb: "FFF2F2F2" },
};
const BORDER = {
    left: { style: "thin", color: { argb: "FFBFBFBF" } },
    right: { style: "thin", color: { argb: "FFBFBFBF" } },
    top: { style: "thin", color: { argb: "FFBFBFBF" } },
    bottom: { style: "thin", color: { argb: "FFBFBFBF" } },
};
function resolveField(obj, fieldPath) {
    const parts = fieldPath.split(".");
    let current = obj;
    for (const part of parts) {
        if (current === null || current === undefined)
            return null;
        const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
        if (arrayMatch) {
            const [, key, indexStr] = arrayMatch;
            const index = parseInt(indexStr, 10);
            const arr = current[key];
            if (!Array.isArray(arr) || index >= arr.length)
                return null;
            current = arr[index];
            if (typeof current === "object" && current !== null && "value" in current) {
                current = current.value;
            }
        }
        else {
            current = current[part];
        }
    }
    if (typeof current === "object" && current !== null) {
        return JSON.stringify(current);
    }
    return current;
}
async function generateXlsx(rows, mappings, outputPath) {
    const workbook = new exceljs_1.default.Workbook();
    const sheet = workbook.addWorksheet("Soal");
    const kunciColIdx = mappings.findIndex((m) => m.excelColumn === "KUNCI_JAWABAN");
    // Header row
    const headerRow = sheet.addRow(mappings.map((m) => m.label));
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
        cell.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
        cell.fill = HEADER_FILL;
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = BORDER;
    });
    // Data rows
    rows.forEach((row, idx) => {
        const dataRow = mappings.map((m) => {
            const value = resolveField({
                questionText: row.questionText,
                content: row.content,
                difficulty: row.difficulty,
                tags: row.tags,
                skill: row.skill,
            }, m.sourceField);
            return value !== null && value !== undefined ? String(value) : "";
        });
        const excelRow = sheet.addRow(dataRow);
        const isAlt = idx % 2 === 1;
        excelRow.eachCell((cell, colIdx) => {
            const isKunci = kunciColIdx !== -1 && colIdx === kunciColIdx + 1;
            cell.font = {
                name: "Arial",
                size: isKunci ? 11 : 10,
                bold: isKunci ? true : undefined,
                color: isKunci ? { argb: "FF1F3864" } : undefined,
            };
            cell.alignment = isKunci
                ? { horizontal: "center", vertical: "middle" }
                : { horizontal: "left", vertical: "top", wrapText: true };
            if (isKunci) {
                cell.fill = KUNCI_FILL;
            }
            else if (isAlt) {
                cell.fill = ALT_FILL;
            }
            cell.border = BORDER;
        });
        // Auto row height
        let maxLines = 1;
        excelRow.eachCell((cell, colIdx) => {
            const val = cell.value ? String(cell.value) : "";
            const width = 30;
            const lines = Math.ceil(val.length / Math.max(width - 2, 1)) + (val.split("\n").length - 1);
            if (lines > maxLines)
                maxLines = lines;
        });
        excelRow.height = Math.max(28, Math.min(maxLines * 18, 300));
    });
    // Column widths (set after rows so ExcelJS knows column count)
    const colWidths = mappings.map((m) => {
        if (m.excelColumn === "SOAL")
            return 45;
        if (m.excelColumn.startsWith("OPSI_"))
            return 32;
        if (m.excelColumn === "KUNCI_JAWABAN")
            return 14;
        if (m.excelColumn === "PEMBAHASAN")
            return 55;
        return 20;
    });
    colWidths.forEach((w, i) => {
        try {
            sheet.getColumn(i + 1).width = w;
        }
        catch { /* skip */ }
    });
    // Freeze header row
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    const dir = path_1.default.dirname(outputPath);
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
    await workbook.xlsx.writeFile(outputPath);
}
//# sourceMappingURL=exportService.js.map