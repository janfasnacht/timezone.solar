export interface DebouncedCallback {
  call: (...args: unknown[]) => void
  cancel: () => void
  isPending: () => boolean
}

export function createDebouncedCallback(
  callback: (...args: unknown[]) => void,
  delay: number,
): DebouncedCallback {
  let timer: ReturnType<typeof setTimeout> | null = null

  function call(...args: unknown[]) {
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      callback(...args)
    }, delay)
  }

  function cancel() {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function isPending() {
    return timer !== null
  }

  return { call, cancel, isPending }
}
