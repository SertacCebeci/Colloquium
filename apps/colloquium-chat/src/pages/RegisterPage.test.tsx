import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { RegisterPage } from "./RegisterPage";

function renderRegisterPage() {
  return render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>
  );
}

async function fillAndSubmitForm(
  user: ReturnType<typeof userEvent.setup>,
  email = "dup@example.com"
) {
  await user.type(screen.getByLabelText(/email/i), email);
  await user.type(screen.getByLabelText(/^username$/i), "testuser");
  await user.type(screen.getByLabelText(/^password$/i), "SecurePass123!");
  await user.type(screen.getByLabelText(/confirm password/i), "SecurePass123!");
  await user.click(screen.getByRole("button", { name: /create account/i }));
}

describe("RegisterPage — duplicate email error", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("displays a field-level error beneath the email input when the API returns 409", async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ error: "Email already in use" }),
      })
    );

    renderRegisterPage();
    await fillAndSubmitForm(user);

    await waitFor(() => {
      expect(screen.getByText(/an account with that email already exists/i)).toBeInTheDocument();
    });

    // Error must appear next to the email field, not as a root-level banner
    const emailError = screen.getByText(/an account with that email already exists/i);
    const emailInput = screen.getByLabelText(/email/i);
    expect(emailInput.closest("div")).toContainElement(emailError);
  });
});
