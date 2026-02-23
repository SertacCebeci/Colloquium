import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PostBody } from "./PostBody";

describe("PostBody", () => {
  it("renders body text", () => {
    render(<PostBody body="Hello world" />);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });
  it("splits on double newlines into separate paragraphs", () => {
    render(<PostBody body={"Para one\n\nPara two"} />);
    expect(screen.getByText("Para one")).toBeInTheDocument();
    expect(screen.getByText("Para two")).toBeInTheDocument();
  });
});
