import { bindCopyButton } from './clipboard'
import {
  FRAMEWORKS,
  isSnippetKey,
  SNIPPETS,
  type Framework,
  type Snippet,
} from './snippets'

function make<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag)
  if (className) element.className = className
  if (text !== undefined) element.textContent = text
  return element
}

export function mountCodeSnippets(): void {
  const hosts = document.querySelectorAll<HTMLElement>('[data-snippet]')
  hosts.forEach((host, index) => {
    const key = host.dataset.snippet ?? ''
    if (!isSnippetKey(key)) return
    mountCodeSnippet(host, SNIPPETS[key], index)
  })
}

function mountCodeSnippet(
  host: HTMLElement,
  snippet: Snippet,
  index: number,
): void {
  const prefix = `snippet-${index}`
  const block = make('div', 'code-block')
  const head = make('div', 'code-block__head')
  const tablist = make('div', 'code-tabs')
  tablist.setAttribute('role', 'tablist')
  tablist.setAttribute('aria-label', 'Choose a framework')

  const language = make('span', 'code-block__lang')
  const actions = make('div', 'code-block__actions')
  const copy = make('button', 'code-copy', 'Copy')
  copy.type = 'button'
  copy.setAttribute('aria-label', 'Copy code')
  actions.append(language, copy)
  head.append(tablist, actions)

  const panels = make('div', 'code-panels')
  const tabs = new Map<Framework, HTMLButtonElement>()
  const views = new Map<Framework, HTMLElement>()
  let active: Framework = 'vanilla'

  const select = (framework: Framework, focusTab = false): void => {
    active = framework
    for (const entry of FRAMEWORKS) {
      const tab = tabs.get(entry.id)
      const panel = views.get(entry.id)
      if (!tab || !panel) continue

      const selected = entry.id === framework
      tab.setAttribute('aria-selected', String(selected))
      tab.tabIndex = selected ? 0 : -1
      panel.hidden = !selected
    }

    const meta = FRAMEWORKS.find((entry) => entry.id === framework) ?? FRAMEWORKS[0]
    language.textContent = meta.language
    if (focusTab) tabs.get(framework)?.focus()
  }

  for (const entry of FRAMEWORKS) {
    const tabId = `${prefix}-tab-${entry.id}`
    const panelId = `${prefix}-panel-${entry.id}`
    const tab = make('button', 'code-tab', entry.label)
    tab.type = 'button'
    tab.id = tabId
    tab.setAttribute('role', 'tab')
    tab.setAttribute('aria-controls', panelId)
    tab.setAttribute('aria-selected', String(entry.id === active))
    tab.tabIndex = entry.id === active ? 0 : -1
    tab.addEventListener('click', () => select(entry.id))
    tabs.set(entry.id, tab)
    tablist.append(tab)

    const panel = make('div', 'code-panel')
    panel.id = panelId
    panel.setAttribute('role', 'tabpanel')
    panel.setAttribute('aria-labelledby', tabId)
    panel.hidden = entry.id !== active
    panel.tabIndex = 0

    const pre = make('pre', 'code-panel__pre')
    pre.tabIndex = 0
    const code = make('code', `language-${entry.id}`)
    code.dataset.language = entry.language
    code.textContent = snippet[entry.id]
    pre.append(code)
    panel.append(pre)
    views.set(entry.id, panel)
    panels.append(panel)
  }

  tablist.addEventListener('keydown', (event) => {
    const currentIndex = FRAMEWORKS.findIndex((entry) => entry.id === active)
    let nextIndex: number | null = null

    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % FRAMEWORKS.length
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + FRAMEWORKS.length) % FRAMEWORKS.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = FRAMEWORKS.length - 1

    if (nextIndex === null) return
    event.preventDefault()
    const next = FRAMEWORKS[nextIndex]
    if (next) select(next.id, true)
  })

  bindCopyButton(copy, () => snippet[active])
  block.append(head, panels)
  host.replaceChildren(block)
  select(active)
}
