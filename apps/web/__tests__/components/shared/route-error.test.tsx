import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouteError } from "@/components/shared/route-error";

jest.mock("@/lib/error-logger", () => ({
  logErrorToBackend: jest.fn(),
}));

describe("RouteError", () => {
  it("renders a friendly message and a retry button", () => {
    render(<RouteError error={new Error("boom")} reset={() => {}} message="Custom message" />);
    expect(screen.getByRole("heading", { name: /something went wrong/i })).toBeInTheDocument();
    expect(screen.getByText("Custom message")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("calls reset when the retry button is clicked", async () => {
    const reset = jest.fn();
    render(<RouteError error={new Error("boom")} reset={reset} />);
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("is exposed to assistive technology as an alert region", () => {
    render(<RouteError error={new Error("boom")} reset={() => {}} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
