/** `auto-dev` namespace dictionaries. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'auto-dev'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'toggle.aria.off': '开启自动开发监测',
  'toggle.aria.on': '关闭自动开发监测',
  'toggle.title.off': '自动开发：关',
  'toggle.title.on': '自动开发：开',
  'toggle.label': '自动开发',
} as const

/** English dictionary matching the Chinese key set. */
export const en: { readonly [K in keyof typeof zh]: string } = {
  'toggle.aria.off': 'Turn on auto-dev monitoring',
  'toggle.aria.on': 'Turn off auto-dev monitoring',
  'toggle.title.off': 'Auto-dev: off',
  'toggle.title.on': 'Auto-dev: on',
  'toggle.label': 'Auto-dev',
}

/** Locale keys owned by this namespace. */
export type AutoDevKey = keyof typeof zh
