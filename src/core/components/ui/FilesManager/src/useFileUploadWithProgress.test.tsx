// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Collab Digital Twins

import * as React from 'react'
import { act, renderHook } from '@testing-library/react'

const mockMutate = jest.fn()
const mockUploadFileWithProgress = jest.fn()

jest.mock('swr', () => ({ mutate: (...args: unknown[]) => mockMutate(...args) }))
jest.mock(
  '../../../viewers/map/src/tools/AddTools/AddFile/utils/uploadToPresignedURLS',
  () => ({
    uploadFileWithProgress: (...args: unknown[]) => mockUploadFileWithProgress(...args),
  }),
)

import { useFileUploadWithProgress } from './useFileUploadWithProgress'

const realFetch = global.fetch

beforeEach(() => {
  mockMutate.mockReset()
  mockUploadFileWithProgress.mockReset().mockResolvedValue(undefined)
  if (!('randomUUID' in globalThis.crypto)) {
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      value: () => 'uuid-stub',
      configurable: true,
    })
  }
  jest.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('uuid-stub' as `${string}-${string}-${string}-${string}-${string}`)
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  global.fetch = realFetch
  jest.restoreAllMocks()
})

function makeFile(name = 'a.csv') {
  return new File(['hello'], name, { type: 'text/csv' })
}

describe('useFileUploadWithProgress', () => {
  it('happy path: presigned URL → upload → metadata POST → onUploadSuccess', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ presignedUrl: 'http://minio/abc' }) })
      .mockResolvedValueOnce({ ok: true, statusText: 'OK' }) as any

    const onUploadSuccess = jest.fn()
    const { result } = renderHook(() => useFileUploadWithProgress({ onUploadSuccess }))

    await act(async () => {
      await result.current.handleFileUpload(makeFile())
    })

    expect(global.fetch).toHaveBeenNthCalledWith(1, '/api/presigned-url-upload?asset=uuid-stub')
    expect(mockUploadFileWithProgress).toHaveBeenCalledWith('http://minio/abc', expect.any(File), expect.any(Function))

    const metadataCall = (global.fetch as ReturnType<typeof jest.fn>).mock.calls[1]
    expect(metadataCall[0]).toBe('/api/files/create')
    const body = JSON.parse(metadataCall[1].body)
    expect(body).toMatchObject({
      type: 'system',
      name: 'a.csv',
      assetId: 'uuid-stub',
      mimeType: 'text/csv',
      extension: 'csv',
      sizeBytes: 5,
    })

    expect(mockMutate).toHaveBeenCalledWith(['files'])
    expect(onUploadSuccess).toHaveBeenCalledTimes(1)
    expect(result.current.uploadState).toEqual({ uploading: false, progress: 0 })
  })

  it('calls onUploadError if the presigned URL fetch fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as any
    const onUploadError = jest.fn()
    const { result } = renderHook(() => useFileUploadWithProgress({ onUploadError }))

    await act(async () => { await result.current.handleFileUpload(makeFile()) })

    expect(onUploadError).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Failed to fetch presigned URL'),
    }))
    expect(mockUploadFileWithProgress).not.toHaveBeenCalled()
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('calls onUploadError when the metadata POST fails', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ presignedUrl: 'http://minio' }) })
      .mockResolvedValueOnce({ ok: false, statusText: 'Internal Error' }) as any

    const onUploadError = jest.fn()
    const { result } = renderHook(() => useFileUploadWithProgress({ onUploadError }))

    await act(async () => { await result.current.handleFileUpload(makeFile()) })

    expect(onUploadError).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Internal Error'),
    }))
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('handleAddFile injects a hidden file input and clicks it', () => {
    const { result } = renderHook(() => useFileUploadWithProgress({ acceptedFileTypes: '.csv' }))

    const clickSpy = jest.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})

    act(() => { result.current.handleAddFile() })

    const inputs = document.body.querySelectorAll('input[type="file"]')
    expect(inputs.length).toBeGreaterThan(0)
    const input = inputs[inputs.length - 1] as HTMLInputElement
    expect(input.accept).toBe('.csv')
    expect(clickSpy).toHaveBeenCalledTimes(1)
  })
})
