import {
  registerTerminalSender,
  sendToActiveTerminal,
  sendToTerminal,
  setActiveTerminalId,
} from "../../utils/terminalInputBridge";

describe("terminalInputBridge", () => {
  it("sends input to explicit terminal sender", () => {
    const sent: string[] = [];
    const unregister = registerTerminalSender("term-1", (payload) => {
      sent.push(payload);
      return true;
    });

    const ok = sendToTerminal("term-1", "abc");
    expect(ok).toBe(true);
    expect(sent).toEqual(["abc"]);

    unregister();
  });

  it("sends input to active terminal", () => {
    const sent: string[] = [];
    const unregister = registerTerminalSender("term-2", (payload) => {
      sent.push(payload);
      return true;
    });
    setActiveTerminalId("term-2");

    const ok = sendToActiveTerminal("payload");
    expect(ok).toBe(true);
    expect(sent).toEqual(["payload"]);

    unregister();
    setActiveTerminalId(null);
  });

  it("returns false when terminal sender is missing", () => {
    setActiveTerminalId("not-found");
    expect(sendToActiveTerminal("x")).toBe(false);
    expect(sendToTerminal("not-found", "x")).toBe(false);
    setActiveTerminalId(null);
  });
});
