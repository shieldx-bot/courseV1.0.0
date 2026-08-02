import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MasteryRadar } from "@/components/adaptive/MasteryRadar";

describe("MasteryRadar", () => {
  it("renders the concept list with names and formatted scores", () => {
    const concepts = [
      { id: "c1", name: "Variables", mastery_score: 2.5 },
      { id: "c2", name: "Control Flow", mastery_score: 4 },
      { id: "c3", name: "Functions", mastery_score: 8 },
    ];
    render(<MasteryRadar concepts={concepts} />);

    expect(screen.getByText("Variables")).toBeInTheDocument();
    expect(screen.getByText("Control Flow")).toBeInTheDocument();
    expect(screen.getByText("Functions")).toBeInTheDocument();
    expect(screen.getByText("2.5")).toBeInTheDocument();
    expect(screen.getByText("4.0")).toBeInTheDocument();
    expect(screen.getByText("8.0")).toBeInTheDocument();
  });

  it("colors the radar dots by mastery score: red <3, yellow 3-6, green >6", () => {
    const concepts = [
      { id: "c1", name: "Weak", mastery_score: 2 },
      { id: "c2", name: "Mid", mastery_score: 5 },
      { id: "c3", name: "Strong", mastery_score: 7 },
    ];
    const { container } = render(<MasteryRadar concepts={concepts} />);

    const dots = Array.from(container.querySelectorAll("svg g"));
    const fillByName = new Map(
      dots.map((g) => [g.querySelector("title")?.textContent, g.querySelector("circle")?.getAttribute("fill")])
    );

    expect(fillByName.get("Weak: 2")).toBe("var(--color-error, #E5484D)");
    expect(fillByName.get("Mid: 5")).toBe("var(--color-warning, #F5A623)");
    expect(fillByName.get("Strong: 7")).toBe("var(--color-success, #30A46C)");
  });

  it("uses the matching badge variant per score band", () => {
    const concepts = [
      { id: "c1", name: "Weak", mastery_score: 2 },
      { id: "c2", name: "Mid", mastery_score: 5 },
      { id: "c3", name: "Strong", mastery_score: 7 },
    ];
    render(<MasteryRadar concepts={concepts} />);

    const badge = (score: string) => screen.getByText(score).parentElement as HTMLElement;
    expect(badge("2.0").className).toContain("bg-red-100");
    expect(badge("5.0").className).toContain("bg-amber-100");
    expect(badge("7.0").className).toContain("bg-emerald-100");
  });

  it("renders without crashing when given an empty concept list", () => {
    const { container } = render(<MasteryRadar concepts={[]} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("calls onSelect when a concept row is clicked", async () => {
    const onSelect = jest.fn();
    const user = userEvent.setup();
    render(
      <MasteryRadar
        concepts={[{ id: "c1", name: "Variables", mastery_score: 2.5 }]}
        onSelect={onSelect}
      />
    );

    await user.click(screen.getByRole("button", { name: /Variables/ }));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "c1", name: "Variables" }));
  });
});
