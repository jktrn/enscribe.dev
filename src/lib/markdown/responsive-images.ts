import { defineHastPlugin } from "satteri"

const RASTER = /\.(avif|gif|jpe?g|png|webp)$/i

export const PROSE_IMAGE_WIDTHS = [640, 960, 1344, 1920]
export const PROSE_IMAGE_SIZES = "(min-width: 48rem) 42rem, calc(100vw - 2rem)"

export const responsiveImages = defineHastPlugin({
  name: "responsive-images",
  element: {
    filter: ["img"],
    visit(node, ctx) {
      const src = node.properties.src
      if (typeof src !== "string" || !src.startsWith(".")) return
      if (!RASTER.test(src)) return
      ctx.setProperty(node, "widths", PROSE_IMAGE_WIDTHS)
      ctx.setProperty(node, "sizes", PROSE_IMAGE_SIZES)
    },
  },
})
