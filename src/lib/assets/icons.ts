import { readFileSync } from "node:fs"
import { join } from "node:path"

const ICONS_DIR = join(process.cwd(), "src/assets/icons")

export const loadIcon = (path: string) =>
  readFileSync(join(ICONS_DIR, `${path}.svg`), "utf8")
    .replace("<svg", '<svg aria-hidden="true"')
    .replace(/\s+/g, " ")
    .trim()
