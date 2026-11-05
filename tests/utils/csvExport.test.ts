import { escapeCsvField, buildCsvRows } from "@/utils/csvExport";

describe("escapeCsvField", () => {
  it("returns plain string unchanged", () => {
    expect(escapeCsvField("hello")).toBe("hello");
  });

  it("returns number as string", () => {
    expect(escapeCsvField(42)).toBe("42");
    expect(escapeCsvField(3.14)).toBe("3.14");
  });

  it("returns empty string for null", () => {
    expect(escapeCsvField(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(escapeCsvField(undefined)).toBe("");
  });

  it("wraps value containing commas in quotes", () => {
    expect(escapeCsvField("hello, world")).toBe('"hello, world"');
  });

  it("wraps and escapes value containing double quotes", () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });

  it("wraps value containing newlines in quotes", () => {
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("handles value with commas and quotes together", () => {
    expect(escapeCsvField('a,"b"')).toBe('"a,""b"""');
  });

  it("returns empty string for zero", () => {
    expect(escapeCsvField(0)).toBe("0");
  });
});

describe("buildCsvRows", () => {
  it("generates CSV with headers and data rows", () => {
    const headers = ["Name", "Score"];
    const rows: (string | number | null)[][] = [
      ["Alice", 95],
      ["Bob", 87],
    ];

    const result = buildCsvRows(headers, rows);
    const lines = result.split("\n");

    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("Name,Score");
    expect(lines[1]).toBe("Alice,95");
    expect(lines[2]).toBe("Bob,87");
  });

  it("generates headers only when no data rows", () => {
    const headers = ["A", "B", "C"];
    const result = buildCsvRows(headers, []);

    expect(result).toBe("A,B,C");
  });

  it("escapes special characters in data", () => {
    const headers = ["Name", "Comment"];
    const rows: (string | number | null)[][] = [
      ["Alice", "good, great"],
      ["Bob", 'said "yes"'],
    ];

    const result = buildCsvRows(headers, rows);
    const lines = result.split("\n");

    expect(lines[1]).toBe('Alice,"good, great"');
    expect(lines[2]).toBe('Bob,"said ""yes"""');
  });

  it("handles null values in data", () => {
    const headers = ["Name", "Score"];
    const rows: (string | number | null)[][] = [["Alice", null]];

    const result = buildCsvRows(headers, rows);
    const lines = result.split("\n");

    expect(lines[1]).toBe("Alice,");
  });

  it("escapes special characters in headers", () => {
    const headers = ["Name, First", "Score"];
    const rows: (string | number | null)[][] = [];

    const result = buildCsvRows(headers, rows);
    expect(result).toBe('"Name, First",Score');
  });
});
