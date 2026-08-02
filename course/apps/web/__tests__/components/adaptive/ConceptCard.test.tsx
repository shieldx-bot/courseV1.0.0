import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConceptCard } from "@/components/adaptive/ConceptCard";

describe("ConceptCard", () => {
  it("calls onSelect with the concept when the card is clicked", async () => {
    const onSelect = jest.fn();
    const concept = { id: "c1", name: "Variables", mastery_score: 2.5, trend: "declining" as const };
    const user = userEvent.setup();
    render(<ConceptCard concept={concept} onSelect={onSelect} />);

    await user.click(screen.getByRole("button", { name: /Variables/ }));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "c1", name: "Variables" }));
  });

  it("invokes onSelect via keyboard Enter on the card", async () => {
    const onSelect = jest.fn();
    const concept = { id: "c2", name: "Functions", mastery_score: 8 };
    const user = userEvent.setup();
    render(<ConceptCard concept={concept} onSelect={onSelect} />);

    const card = screen.getByRole("button", { name: /Functions/ });
    card.focus();
    await user.keyboard("{Enter}");

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "c2" }));
  });

  it("renders the remediation action for weak concepts when a callback is provided", async () => {
    const onRequestRemediation = jest.fn();
    const concept = { id: "c3", name: "Loops", mastery_score: 1.2 };
    const user = userEvent.setup();
    render(<ConceptCard concept={concept} onRequestRemediation={onRequestRemediation} />);

    await user.click(screen.getByRole("button", { name: "Get remediation" }));

    expect(onRequestRemediation).toHaveBeenCalledWith(expect.objectContaining({ id: "c3" }));
  });
});
