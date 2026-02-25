/**
 * Screen Buffer Abstraction
 *
 * VT100エスケープシーケンスを解釈し、仮想画面状態を維持する。
 * エージェント向けに構造化データを提供する（INV-5）。
 */

export interface Cell {
  char: string;
  attributes: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    inverse?: boolean;
    foreground?: number;
    background?: number;
  };
}

export interface Cursor {
  row: number;
  col: number;
  visible: boolean;
}

export interface ScreenMetadata {
  cwd?: string;
  process?: string;
  exitCode?: number;
  lastCommand?: string;
}

export interface Change {
  row: number;
  col: number;
  oldChar: string;
  newChar: string;
  oldAttributes?: Cell["attributes"];
  newAttributes?: Cell["attributes"];
}

export interface ScreenSnapshot {
  screen: string[][];
  cursor: Cursor;
  scrollback: string[];
  changes: Change[];
  metadata: ScreenMetadata;
  timestamp: number;
}

export class ScreenBuffer {
  private rows: number;
  private cols: number;
  private buffer: Cell[][];
  private cursor: Cursor;
  private scrollback: string[] = [];
  private scrollbackLimit: number;
  private lastSnapshot: ScreenSnapshot | null = null;
  private changesSinceLastSnapshot: Change[] = [];
  private metadata: ScreenMetadata = {};

  private escapeSequence = "";
  private inEscape = false;
  private inCsi = false;

  constructor(rows = 24, cols = 80, scrollbackLimit = 1000) {
    this.rows = rows;
    this.cols = cols;
    this.scrollbackLimit = scrollbackLimit;
    this.buffer = this.createEmptyBuffer();
    this.cursor = { row: 0, col: 0, visible: true };
  }

  private createEmptyBuffer(): Cell[][] {
    return Array.from({ length: this.rows }, () =>
      Array.from({ length: this.cols }, () => ({
        char: " ",
        attributes: {},
      }))
    );
  }

  processData(data: string): void {
    for (const char of data) {
      this.processChar(char);
    }
  }

  private processChar(char: string): void {
    const code = char.charCodeAt(0);

    if (code === 0x1b) {
      this.inEscape = true;
      this.escapeSequence = "";
      return;
    }

    if (this.inEscape) {
      this.escapeSequence += char;

      if (this.escapeSequence === "[") {
        this.inCsi = true;
        return;
      }

      if (this.inCsi) {
        if (code >= 0x40 && code <= 0x7e) {
          this.processCsiSequence(this.escapeSequence + char);
          this.inEscape = false;
          this.inCsi = false;
          this.escapeSequence = "";
        }
        return;
      }

      if (this.escapeSequence.length === 1) {
        this.processSimpleEscape(this.escapeSequence);
        this.inEscape = false;
        this.escapeSequence = "";
      }

      return;
    }

    if (this.processControlChar(code)) {
      return;
    }

    this.writeChar(char);
  }

  private processControlChar(code: number): boolean {
    switch (code) {
      case 0x07:
        return true;
      case 0x08:
        this.cursor.col = Math.max(0, this.cursor.col - 1);
        return true;
      case 0x09:
        this.cursor.col = Math.min(this.cols - 1, this.cursor.col + 8 - (this.cursor.col % 8));
        return true;
      case 0x0a:
      case 0x0b:
      case 0x0c:
        this.lineFeed();
        return true;
      case 0x0d:
        this.cursor.col = 0;
        return true;
      case 0x7f:
        return true;
      default:
        if (code < 0x20) return true;
        return false;
    }
  }

  private processSimpleEscape(seq: string): void {
    switch (seq) {
      case "M":
        if (this.cursor.row > 0) this.cursor.row--;
        break;
      case "c":
        this.reset();
        break;
    }
  }

  private processCsiSequence(seq: string): void {
    const params = seq.slice(1, -1);
    const command = seq.slice(-1);

    const getParams = (defaults: number[]): number[] => {
      if (!params) return defaults;
      const parsed = params.split(";").map((p) => {
        const n = Number.parseInt(p, 10);
        return Number.isNaN(n) ? 1 : n;
      });
      while (parsed.length < defaults.length) {
        parsed.push(defaults[parsed.length]);
      }
      return parsed;
    };

    switch (command) {
      case "A":
        this.cursor.row = Math.max(0, this.cursor.row - (getParams([1])[0] || 1));
        break;
      case "B":
        this.cursor.row = Math.min(this.rows - 1, this.cursor.row + (getParams([1])[0] || 1));
        break;
      case "C":
        this.cursor.col = Math.min(this.cols - 1, this.cursor.col + (getParams([1])[0] || 1));
        break;
      case "D":
        this.cursor.col = Math.max(0, this.cursor.col - (getParams([1])[0] || 1));
        break;
      case "E":
        this.cursor.row = Math.min(this.rows - 1, this.cursor.row + (getParams([1])[0] || 1));
        this.cursor.col = 0;
        break;
      case "F":
        this.cursor.row = Math.max(0, this.cursor.row - (getParams([1])[0] || 1));
        this.cursor.col = 0;
        break;
      case "G":
        this.cursor.col = Math.max(0, Math.min(this.cols - 1, (getParams([1])[0] || 1) - 1));
        break;
      case "H":
      case "f": {
        const [row, col] = getParams([1, 1]);
        this.cursor.row = Math.max(0, Math.min(this.rows - 1, row - 1));
        this.cursor.col = Math.max(0, Math.min(this.cols - 1, col - 1));
        break;
      }
      case "J":
        this.eraseInDisplay(getParams([0])[0]);
        break;
      case "K":
        this.eraseInLine(getParams([0])[0]);
        break;
      case "S":
        this.scrollUp(getParams([1])[0]);
        break;
      case "T":
        this.scrollDown(getParams([1])[0]);
        break;
    }
  }

  private writeChar(char: string): void {
    if (this.cursor.row >= this.rows || this.cursor.col >= this.cols) return;

    const oldCell = this.buffer[this.cursor.row][this.cursor.col];
    const newCell: Cell = { char, attributes: { ...oldCell.attributes } };

    if (oldCell.char !== char) {
      this.changesSinceLastSnapshot.push({
        row: this.cursor.row,
        col: this.cursor.col,
        oldChar: oldCell.char,
        newChar: char,
        oldAttributes: oldCell.attributes,
        newAttributes: newCell.attributes,
      });
    }

    this.buffer[this.cursor.row][this.cursor.col] = newCell;
    this.cursor.col++;

    if (this.cursor.col >= this.cols) {
      this.cursor.col = 0;
      this.lineFeed();
    }
  }

  private lineFeed(): void {
    if (this.cursor.row < this.rows - 1) {
      this.cursor.row++;
    } else {
      this.scrollUp(1);
    }
  }

  private scrollUp(lines = 1): void {
    for (let i = 0; i < lines; i++) {
      const topLine = this.buffer[0].map((c) => c.char).join("").trimEnd();
      if (topLine) {
        this.scrollback.push(topLine);
        if (this.scrollback.length > this.scrollbackLimit) this.scrollback.shift();
      }
      this.buffer.shift();
      this.buffer.push(Array.from({ length: this.cols }, () => ({ char: " ", attributes: {} })));
    }
  }

  private scrollDown(lines = 1): void {
    for (let i = 0; i < lines; i++) {
      this.buffer.pop();
      this.buffer.unshift(Array.from({ length: this.cols }, () => ({ char: " ", attributes: {} })));
    }
  }

  private eraseInDisplay(mode: number): void {
    switch (mode) {
      case 0:
        this.eraseInLine(0);
        for (let row = this.cursor.row + 1; row < this.rows; row++) this.clearRow(row);
        break;
      case 1:
        for (let row = 0; row < this.cursor.row; row++) this.clearRow(row);
        this.eraseInLine(1);
        break;
      case 2:
      case 3:
        for (let row = 0; row < this.rows; row++) this.clearRow(row);
        if (mode === 3) this.scrollback = [];
        break;
    }
  }

  private eraseInLine(mode: number): void {
    const row = this.cursor.row;
    switch (mode) {
      case 0:
        for (let col = this.cursor.col; col < this.cols; col++)
          this.buffer[row][col] = { char: " ", attributes: {} };
        break;
      case 1:
        for (let col = 0; col <= this.cursor.col; col++)
          this.buffer[row][col] = { char: " ", attributes: {} };
        break;
      case 2:
        this.clearRow(row);
        break;
    }
  }

  private clearRow(row: number): void {
    for (let col = 0; col < this.cols; col++) this.buffer[row][col] = { char: " ", attributes: {} };
  }

  reset(): void {
    this.buffer = this.createEmptyBuffer();
    this.cursor = { row: 0, col: 0, visible: true };
    this.scrollback = [];
    this.changesSinceLastSnapshot = [];
    this.metadata = {};
    this.lastSnapshot = null;
  }

  resize(rows: number, cols: number): void {
    const newBuffer: Cell[][] = Array.from({ length: rows }, (_, row) =>
      Array.from({ length: cols }, (_, col) =>
        row < this.rows && col < this.cols ? this.buffer[row][col] : { char: " ", attributes: {} }
      )
    );
    this.rows = rows;
    this.cols = cols;
    this.buffer = newBuffer;
    this.cursor.row = Math.min(this.cursor.row, rows - 1);
    this.cursor.col = Math.min(this.cursor.col, cols - 1);
  }

  getScreen(): string[][] {
    return this.buffer.map((row) => row.map((cell) => cell.char));
  }

  getScreenLines(): string[] {
    return this.buffer.map((row) => row.map((cell) => cell.char).join("").trimEnd());
  }

  getCursor(): Cursor {
    return { ...this.cursor };
  }

  getScrollback(): string[] {
    return [...this.scrollback];
  }

  getChanges(): Change[] {
    return [...this.changesSinceLastSnapshot];
  }

  clearChanges(): void {
    this.changesSinceLastSnapshot = [];
  }

  getMetadata(): ScreenMetadata {
    return { ...this.metadata };
  }

  setMetadata(metadata: Partial<ScreenMetadata>): void {
    this.metadata = { ...this.metadata, ...metadata };
  }

  takeSnapshot(): ScreenSnapshot {
    const snapshot: ScreenSnapshot = {
      screen: this.getScreen(),
      cursor: this.getCursor(),
      scrollback: this.getScrollback(),
      changes: this.getChanges(),
      metadata: this.getMetadata(),
      timestamp: Date.now(),
    };
    this.lastSnapshot = snapshot;
    this.clearChanges();
    return snapshot;
  }

  getSummary(): string {
    const lines = this.getScreenLines();
    const cursor = this.getCursor();
    let promptLine = cursor.row;

    while (
      promptLine >= 0 &&
      !lines[promptLine].includes("$") &&
      !lines[promptLine].includes(">")
    ) {
      promptLine--;
    }

    const contextLines: string[] = [];
    const startLine = Math.max(0, promptLine >= 0 ? promptLine : cursor.row - 5);
    const endLine = Math.min(this.rows - 1, cursor.row + 2);

    for (let i = startLine; i <= endLine; i++) {
      const line = lines[i];
      if (line || i === cursor.row) contextLines.push(i === cursor.row ? `> ${line}` : `  ${line}`);
    }

    return contextLines.join("\n") || "[Empty terminal]";
  }
}
