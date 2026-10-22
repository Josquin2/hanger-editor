const FEEDBACK_MS = 1500

async function fallbackCopy(value: string): Promise<boolean> {
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  textarea.style.pointerEvents = 'none'
  document.body.append(textarea)
  textarea.select()

  try {
    return document.execCommand('copy')
  }
  catch {
    return false
  }
  finally {
    textarea.remove()
  }
}

export async function copyText(value: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value)
      return true
    }
    catch {
      // Fall through to the legacy path for denied permissions and older
      // browsers.
    }
  }
  return fallbackCopy(value)
}

export function bindCopyButton(
  button: HTMLButtonElement,
  getValue: () => string,
): void {
  const idleLabel = (button.textContent ?? 'Copy').trim()
  let timer: number | undefined

  button.addEventListener('click', async () => {
    const copied = await copyText(getValue())
    button.textContent = copied ? 'Copied' : 'Copy failed'
    button.classList.toggle('is-copied', copied)
    button.classList.toggle('is-failed', !copied)

    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      button.textContent = idleLabel
      button.classList.remove('is-copied', 'is-failed')
    }, FEEDBACK_MS)
  })
}
