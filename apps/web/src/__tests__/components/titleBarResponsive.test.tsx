import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TitleBar } from "../../components/TitleBar";

describe("TitleBar responsive menus", () => {
  it("shows hamburger menu button in mobile mode", () => {
    render(<TitleBar isMobileMode={true} />);
    expect(screen.getByLabelText("Open menus")).toBeInTheDocument();
  });

  it("does not show hamburger menu button in desktop mode", () => {
    render(<TitleBar isMobileMode={false} />);
    expect(screen.queryByLabelText("Open menus")).toBeNull();
  });
});
