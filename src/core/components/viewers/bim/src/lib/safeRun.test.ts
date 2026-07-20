// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Collab Digital Twins

import { safeRun, safeRunAsync } from './safeRun'

describe('safeRun', () => {
  it('invokes the function and returns nothing', () => {
    const fn = jest.fn()
    safeRun(fn, 'label')
    expect(fn).toHaveBeenCalled()
  })

  it('swallows synchronous errors and logs with the label', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const fn = () => { throw new Error('boom') }
    expect(() => safeRun(fn, 'tool-deactivate')).not.toThrow()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[tool-deactivate]'), expect.any(Error))
    warn.mockRestore()
  })
})

describe('safeRunAsync', () => {
  it('awaits the promise on success', async () => {
    const fn = jest.fn().mockResolvedValue(123)
    await safeRunAsync(fn, 'label')
    expect(fn).toHaveBeenCalled()
  })

  it('swallows rejections and logs with the label', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const fn = jest.fn().mockRejectedValue(new Error('boom'))
    await expect(safeRunAsync(fn, 'tool-activate')).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[tool-activate]'), expect.any(Error))
    warn.mockRestore()
  })
})
