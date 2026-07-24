import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { HeroSection } from "@/components/homepage/hero";
import { CategoryGrid } from "@/components/homepage/category-grid";

expect.extend(toHaveNoViolations);

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("next/link", () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

describe("Accessibility", () => {
  it("HeroSection has no axe violations", async () => {
    const { container } = await render(<HeroSection />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("CategoryGrid has no axe violations", async () => {
    const { container } = await render(<CategoryGrid />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});