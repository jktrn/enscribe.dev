import { mount } from "svelte"
import App from "./App.svelte"
// The engine's own stylesheet governs how its line segments lay out. Without
// it every paragraph fails `layout-mismatch` and reverts to native wrapping.
import "@enscribe/linebreak/styles.css"
import "./app.css"

const target = document.getElementById("app")
if (target === null) throw new Error("playground: #app is missing")

export default mount(App, { target })
