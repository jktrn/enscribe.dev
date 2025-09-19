import { defineEcConfig } from 'astro-expressive-code'
import { pluginCollapsibleSections } from '@expressive-code/plugin-collapsible-sections'
import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers'

export default defineEcConfig({
  themes: ['vitesse-dark', 'vitesse-dark'],
  plugins: [pluginCollapsibleSections(), pluginLineNumbers()],
  defaultProps: {
    wrap: true,
    collapseStyle: 'collapsible-auto',
    overridesByLang: {
      'ansi,bat,bash,batch,cmd,console,powershell,ps,ps1,psd1,psm1,sh,shell,shellscript,shellsession,text,zsh':
        {
          showLineNumbers: false,
        },
    },
  },
  frames: {
    showCopyToClipboardButton: false,
  },
  styleOverrides: {
    borderColor: 'var(--border)',
    borderRadius: '0px',
    codeBackground: 'var(--muted)',
    codeFontFamily: 'var(--font-mono)',
    codeFontSize: '0.75rem',
    frames: {
      editorActiveTabForeground: 'var(--foreground)',
      editorActiveTabBackground: 'var(--muted)',
      editorActiveTabIndicatorBottomColor: 'transparent',
      editorActiveTabIndicatorTopColor: 'transparent',
      editorTabBorderRadius: '0',
      editorBackground: 'var(--muted)',
      editorTabBarBackground: 'var(--background)',
      editorTabBarBorderBottomColor: 'transparent',
      frameBoxShadowCssValue: 'none',
      inlineButtonBorder: 'transparent',
      terminalBackground: 'var(--muted)',
      terminalTitlebarBackground: 'var(--background)',
      terminalTitlebarBorderBottomColor: 'transparent',
      terminalTitlebarForeground: 'var(--foreground)',
      terminalTitlebarDotsForeground: 'var(--border)',
      terminalTitlebarDotsOpacity: '100%',
    },
    lineNumbers: {
      foreground: 'var(--muted-foreground)',
    },
    collapsibleSections: {
      closedBackgroundColor: 'var(--border)',
      openBackgroundColorCollapsible:
        'color-mix(in oklab, var(--border) 50%, transparent)',
      closedTextColor: 'var(--foreground)',
      closedMargin: '0.5rem 0',
    },
    textMarkers: {
      markBackground: 'color-mix(in oklab, var(--foreground) 5%, transparent)',
      markBorderColor:
        'color-mix(in oklab, var(--foreground) 25%, transparent)',
    },
    uiFontFamily: 'var(--font-mono)',
  },
})
