import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SupportChatWidget } from "@/components/support/SupportChatWidget";
import { ToastProvider } from "@/components/ui/toast";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

const encoder = new TextEncoder();

function sseResponse(events: Array<{ event?: string; data: string }>): Response {
  const body = events
    .map(({ event, data }) => `${event ? `event: ${event}\n` : ""}data: ${data}\n\n`)
    .join("");
  return {
    ok: true,
    status: 200,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(body));
        controller.close();
      },
    }),
  } as unknown as Response;
}

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve({ success: true, data }),
    text: () => Promise.resolve(ok ? "" : String(data)),
  } as unknown as Response;
}

function renderWidget() {
  return render(
    <ToastProvider>
      <SupportChatWidget />
    </ToastProvider>
  );
}

async function openChat(user = userEvent.setup()) {
  await user.click(screen.getByRole("button", { name: "Open support chat" }));
}

describe("SupportChatWidget", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    window.localStorage.clear();
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("streams chunks from the SSE endpoint into the conversation", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/support/chat/stream")) {
        return Promise.resolve(
          sseResponse([
            { event: "message", data: JSON.stringify({ delta: "Hello" }) },
            { event: "message", data: JSON.stringify({ delta: " world" }) },
            { event: "done", data: JSON.stringify({ conversation_id: "conv-1" }) },
          ])
        );
      }
      return Promise.resolve(jsonResponse([]));
    });

    renderWidget();
    await openChat(user);
    await user.type(screen.getByRole("textbox", { name: "Chat message" }), "What is refund policy?");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Hello world")).toBeInTheDocument();
    expect(screen.queryByText(/thinking/i)).not.toBeInTheDocument();
  });

  it("renders a create_ticket action and converts the conversation to a ticket", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/support/chat/stream")) {
        return Promise.resolve(
          sseResponse([
            { event: "message", data: JSON.stringify({ delta: "I can't sign in." }) },
            { event: "actions", data: JSON.stringify([{ type: "create_ticket", label: "Create support ticket" }]) },
            { event: "done", data: JSON.stringify({ conversation_id: "conv-1" }) },
          ])
        );
      }
      if (url.includes("/support/chat/convert-to-ticket")) {
        return Promise.resolve(jsonResponse({ ticket_id: "T123" }));
      }
      return Promise.resolve(jsonResponse([]));
    });

    renderWidget();
    await openChat(user);
    await user.type(screen.getByRole("textbox", { name: "Chat message" }), "I can't sign in");
    await user.click(screen.getByRole("button", { name: "Send" }));

    const ticketButton = await screen.findByRole("button", { name: "Create support ticket" });
    await user.click(ticketButton);

    expect(await screen.findByRole("link", { name: /Ticket #T123 created/ })).toBeInTheDocument();

    const convertCall = fetchMock.mock.calls.find(([, init]) =>
      String((init as RequestInit | undefined)?.body ?? "").includes("conversation_id")
    );
    const body = convertCall?.[1] ? JSON.parse(String((convertCall[1] as RequestInit).body)) : null;
    expect(body).toMatchObject({ question: "I can't sign in", answer: "I can't sign in.", conversation_id: "conv-1" });
  });

  it("falls back to the JSON endpoint when streaming is unavailable", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/support/chat/stream")) {
        return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("not found") } as unknown as Response);
      }
      if (url.includes("/support/chat/history")) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse({ answer: "Fallback answer", actions: [], conversation_id: "conv-fb" }));
    });

    renderWidget();
    await openChat(user);
    await user.type(screen.getByRole("textbox", { name: "Chat message" }), "Where is my receipt?");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Fallback answer")).toBeInTheDocument();
  });

  it("sends the selected quick reply as the chat message", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/support/chat/stream")) {
        return Promise.resolve(
          sseResponse([
            { event: "message", data: JSON.stringify({ delta: "Sure!" }) },
            { event: "done", data: "{}" },
          ])
        );
      }
      return Promise.resolve(jsonResponse([]));
    });

    renderWidget();
    await openChat(user);
    await user.click(screen.getByRole("button", { name: "I need help with billing" }));

    await screen.findByText("Sure!");
    const streamCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/support/chat/stream"));
    const body = streamCall?.[1] ? JSON.parse(String((streamCall[1] as RequestInit).body)) : null;
    expect(body).toEqual({ message: "I need help with billing" });
  });

  it("exposes accessible controls and a live region", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(jsonResponse([]));

    renderWidget();
    const launcher = screen.getByRole("button", { name: "Open support chat" });
    expect(launcher).toHaveAttribute("aria-expanded", "false");

    await openChat(user);
    expect(screen.getByRole("dialog", { name: /ascendly support chat/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close support chat" })).toBeInTheDocument();

    const log = screen.getByRole("log");
    expect(log).toHaveAttribute("aria-live", "polite");
  });

  it("clears the conversation and calls DELETE on history", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/support/chat/stream")) {
        return Promise.resolve(
          sseResponse([
            { event: "message", data: JSON.stringify({ delta: "ok" }) },
            { event: "done", data: "{}" },
          ])
        );
      }
      if (init?.method === "DELETE") return Promise.resolve(jsonResponse({ cleared: true }));
      return Promise.resolve(jsonResponse([]));
    });

    renderWidget();
    await openChat(user);
    await user.type(screen.getByRole("textbox", { name: "Chat message" }), "hello");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("ok");

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByRole("button", { name: "I need help with billing" })).toBeInTheDocument();
    const deleteCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === "DELETE");
    expect(deleteCall).toBeDefined();
    expect(window.localStorage.getItem("ascendly-support-chat")).toBeNull();
  });
});
