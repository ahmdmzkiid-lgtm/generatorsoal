export interface ColumnMapping {
    excelColumn: string;
    label: string;
    sourceField: string;
}
export interface ExportRow {
    questionText: string;
    content: Record<string, unknown>;
    difficulty: string;
    tags: string[];
    skill?: {
        name: string;
        subject: string;
        gradeLevel: string;
    };
}
export declare function generateXlsx(rows: ExportRow[], mappings: ColumnMapping[], outputPath: string): Promise<void>;
//# sourceMappingURL=exportService.d.ts.map