import { render } from "@testing-library/react";
import CourseDetailLoading from "@/app/(public)/courses/[category]/[course]/loading";

describe("CourseDetailLoading", () => {
  it("renders a loading skeleton without crashing", () => {
    const { container } = render(<CourseDetailLoading />);
    expect(container.querySelector("section")).not.toBeNull();
    expect(container.querySelectorAll("[class*='animate']").length).toBeGreaterThan(0);
  });

  it("renders the shimmer skeleton elements used by the loading pattern", () => {
    const { container } = render(<CourseDetailLoading />);
    const shimmerBlocks = container.querySelectorAll(".animate-shimmer");
    expect(shimmerBlocks.length).toBeGreaterThan(0);
  });
});
