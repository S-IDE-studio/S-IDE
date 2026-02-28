import { describe, expect, it } from "vitest";
import { parseListeningLocalPorts } from "../../utils/local-server-scan.js";

describe("parseListeningLocalPorts", () => {
  it("should parse Windows netstat output and return sorted unique ports", () => {
    const output = `
  Proto  Local Address          Foreign Address        State           PID
  TCP    127.0.0.1:3000         0.0.0.0:0              LISTENING       1234
  TCP    0.0.0.0:8787           0.0.0.0:0              LISTENING       2222
  TCP    [::1]:5173             [::]:0                 LISTENING       3333
  TCP    [::]:9229              [::]:0                 LISTENING       4444
  TCP    127.0.0.1:3000         0.0.0.0:0              LISTENING       1234
  TCP    127.0.0.1:6000         127.0.0.1:50123        ESTABLISHED     1234
`;

    expect(parseListeningLocalPorts(output, "win32")).toEqual([3000, 5173, 8787, 9229]);
  });

  it("should parse Linux ss output", () => {
    const output = `
LISTEN 0      4096     127.0.0.1:3001      0.0.0.0:*
LISTEN 0      4096       0.0.0.0:8080      0.0.0.0:*
LISTEN 0      4096          [::1]:5174        [::]:*
LISTEN 0      4096             [::]:8788        [::]:*
`;

    expect(parseListeningLocalPorts(output, "linux")).toEqual([3001, 5174, 8080, 8788]);
  });

  it("should parse macOS netstat output", () => {
    const output = `
tcp4       0      0  127.0.0.1.3002         *.*                    LISTEN
tcp4       0      0  *.8081                  *.*                    LISTEN
tcp6       0      0  ::1.5175                *.*                    LISTEN
tcp6       0      0  *.8789                  *.*                    LISTEN
`;

    expect(parseListeningLocalPorts(output, "darwin")).toEqual([3002, 5175, 8081, 8789]);
  });
});
