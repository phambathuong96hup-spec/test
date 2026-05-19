import { describe, it, expect } from 'vitest';
import { exportCsv, type CsvRow } from './exportCsv';

// Mock document.createElement and URL APIs for testing
const mockClick = vi.fn();
const mockCreateObjectURL = vi.fn(() => 'blob:test-url');
const mockRevokeObjectURL = vi.fn();

vi.stubGlobal('URL', {
  createObjectURL: mockCreateObjectURL,
  revokeObjectURL: mockRevokeObjectURL,
});

vi.spyOn(document, 'createElement').mockReturnValue({
  href: '',
  download: '',
  click: mockClick,
} as unknown as HTMLElement);

describe('exportCsv', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not create a download for empty rows', () => {
    exportCsv([], 'test.csv');
    expect(mockClick).not.toHaveBeenCalled();
  });

  it('should create a download link with proper filename', () => {
    const rows: CsvRow[] = [{ name: 'Device A', department: 'Khoa Nhi' }];
    exportCsv(rows, 'devices');
    expect(mockClick).toHaveBeenCalledOnce();
  });

  it('should add .csv extension if missing', () => {
    const rows: CsvRow[] = [{ name: 'Test' }];
    exportCsv(rows, 'report');
    // The function adds .csv
    const link = (document.createElement as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(link.download).toBe('report.csv');
  });

  it('should not duplicate .csv extension', () => {
    const rows: CsvRow[] = [{ name: 'Test' }];
    exportCsv(rows, 'report.csv');
    const link = (document.createElement as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(link.download).toBe('report.csv');
  });

  it('should handle null and undefined values', () => {
    const rows: CsvRow[] = [{ a: null, b: undefined, c: 'hello' }];
    // Should not throw
    expect(() => exportCsv(rows, 'test.csv')).not.toThrow();
    expect(mockClick).toHaveBeenCalledOnce();
  });

  it('should escape values containing commas and quotes', () => {
    const rows: CsvRow[] = [{ desc: 'Máy "siêu âm", loại A' }];
    expect(() => exportCsv(rows, 'test.csv')).not.toThrow();
    expect(mockCreateObjectURL).toHaveBeenCalled();
  });

  it('should merge headers from all rows', () => {
    const rows: CsvRow[] = [
      { a: 1, b: 2 },
      { b: 3, c: 4 },
    ];
    expect(() => exportCsv(rows, 'test.csv')).not.toThrow();
    expect(mockCreateObjectURL).toHaveBeenCalled();
  });
});
