// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../hooks/use-route-enum-param', () => ({
  useRouteEnumParam: () => ['config:appearance', vi.fn()]
}))

vi.mock('../overlays/overlay-search-input', () => ({
  OverlaySearchInput: ({ placeholder }: { placeholder: string }) => <div data-testid="settings-search">{placeholder}</div>
}))

vi.mock('./appearance-settings', () => ({
  AppearanceSettings: () => <div data-testid="appearance-settings">Appearance panel</div>
}))

vi.mock('./about-settings', () => ({
  AboutSettings: () => <div>About panel</div>
}))

vi.mock('./config-settings', () => ({
  ConfigSettings: () => <div>Config panel</div>
}))

vi.mock('./gateway-settings', () => ({
  GatewaySettings: () => <div>Gateway panel</div>
}))

vi.mock('./keys-settings', () => ({
  KeysSettings: () => <div>Keys panel</div>
}))

vi.mock('./mcp-settings', () => ({
  McpSettings: () => <div>MCP panel</div>
}))

vi.mock('./providers-settings', () => ({
  ProvidersSettings: () => <div>Providers panel</div>
}))

vi.mock('./sessions-settings', () => ({
  SessionsSettings: () => <div>Sessions panel</div>
}))

vi.mock('./update-sources-settings', () => ({
  UpdateSourcesSettings: () => <div>Update sources panel</div>
}))

describe('SettingsView theme shells', () => {
  it('keeps the settings sidebar, active subnav, and header on workbench tokens', async () => {
    const { SettingsView } = await import('./index')
    const { container } = render(
      <SettingsView gateway={null} onClose={vi.fn()} onConfigSaved={vi.fn()} onMainModelChanged={vi.fn()} />
    )

    const sidebar = container.querySelector('aside') as HTMLElement
    const mainPanel = sidebar.nextElementSibling as HTMLElement
    const header = mainPanel.firstElementChild as HTMLElement
    const activeNav = screen.getByRole('button', { name: 'Appearance' })

    expect(sidebar.className).toContain('bg-[var(--workbench-panel-bg)]')
    expect(sidebar.className).not.toContain('white_2%')
    expect(mainPanel.className).toContain('bg-[var(--workbench-panel-bg)]')
    expect(mainPanel.className).not.toContain('white_1%')
    expect(header.className).toContain('bg-[var(--workbench-panel-muted-bg)]')
    expect(header.className).not.toContain('white_16%')
    expect(activeNav.className).toContain('bg-[var(--workbench-active)]')
  })
})
