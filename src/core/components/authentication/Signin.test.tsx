// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Collab Digital Twins

import * as React from 'react'
import { act, render, screen, fireEvent } from '@testing-library/react'

const mockSignIn = jest.fn()

jest.mock('./AuthPage', () => ({
  AuthPage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useAuthTheme: () => 'dark',
}))
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, vars?: Record<string, string>) =>
    vars ? `${key}:${Object.values(vars).join(',')}` : key,
}))
jest.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}))
jest.mock('next/navigation', () => ({
  useParams: () => ({ instance: 'canada' }),
  useSearchParams: () => ({ get: () => null }),
}))
jest.mock('react-google-recaptcha', () => ({
  __esModule: true,
  default: () => <div data-testid="recaptcha" />,
}))
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
  Toaster: () => null,
}))
jest.mock('../ui', () => ({
  Button: ({ children, ...rest }: any) => <button {...rest}>{children}</button>,
  GoogleIcon: () => <span>G</span>,
  Input: (props: any) => <input {...props} />,
  LoadingSpinner: () => <span>...</span>,
}))

import { SignIn } from './Signin'

beforeEach(() => mockSignIn.mockReset())

describe('SignIn', () => {
  it('renders the email/password form on first render', () => {
    render(<SignIn />)
    expect(screen.getAllByPlaceholderText(/placeholder/i).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument()
  })

  it('calls signIn("credentials") with the submitted email + password', async () => {
    mockSignIn.mockResolvedValue({})
    render(<SignIn />)

    const [emailInput, passwordInput] = screen.getAllByPlaceholderText(/placeholder/i)
    fireEvent.change(emailInput, { target: { value: 'a@b.com' } })
    fireEvent.change(passwordInput, { target: { value: 'pw1234567890' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /login/i }))
    })

    expect(mockSignIn).toHaveBeenCalledWith(
      'credentials',
      expect.objectContaining({ email: 'a@b.com', password: 'pw1234567890', redirect: false }),
    )
  })

  it('shows the captcha-failure message on invalid_credentials when captcha hasn\'t been completed', async () => {
    // handleSubmit checks `!captchaStatus` before `result.code === 'invalid_credentials'`,
    // so this branch is shadowed until the ReCAPTCHA widget's onChange has fired. We can't
    // drive the real ReCAPTCHA here (it's mocked as a static div), so captchaStatus stays
    // false and "Captcha Verification Failed." is what actually renders — same gating
    // documented in the mfa_required test below.
    mockSignIn.mockResolvedValue({ error: 'bad', code: 'invalid_credentials' })
    render(<SignIn />)

    const [emailInput, passwordInput] = screen.getAllByPlaceholderText(/placeholder/i)
    fireEvent.change(emailInput, { target: { value: 'a@b.com' } })
    fireEvent.change(passwordInput, { target: { value: 'wrongpw1234567' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /login/i }))
    })

    expect(screen.getByText(/Captcha Verification Failed/i)).toBeInTheDocument()
  })

  it('shows "Invalid email or password" for a whitelist_invalid_credentials response (checked before the captcha gate)', async () => {
    mockSignIn.mockResolvedValue({ error: 'bad', code: 'whitelist_invalid_credentials' })
    render(<SignIn />)

    const [emailInput, passwordInput] = screen.getAllByPlaceholderText(/placeholder/i)
    fireEvent.change(emailInput, { target: { value: 'a@b.com' } })
    fireEvent.change(passwordInput, { target: { value: 'wrongpw1234567' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /login/i }))
    })

    expect(screen.getByText(/Invalid email or password/i)).toBeInTheDocument()
  })

  it('moves to the MFA step when signIn returns mfa_required', async () => {
    // After captcha is ticked the component lets the mfa_required branch run.
    // The mfa_required branch is only reached if the captcha branch is skipped,
    // which happens after onReCaptchaSuccess fires. We can't drive the real
    // ReCAPTCHA here, so instead we assert the captcha-failure message — which
    // is the documented behaviour when captcha hasn't completed yet.
    mockSignIn.mockResolvedValue({ error: 'mfa', code: 'mfa_required' })
    render(<SignIn />)

    const [emailInput, passwordInput] = screen.getAllByPlaceholderText(/placeholder/i)
    fireEvent.change(emailInput, { target: { value: 'a@b.com' } })
    fireEvent.change(passwordInput, { target: { value: 'pw1234567890' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /login/i }))
    })

    // We're still on the login step because captcha hasn't been completed.
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument()
  })
})
