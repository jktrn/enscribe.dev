import { mount } from "svelte"
import App from "./App.svelte"
import "@enscribe/linebreak/styles.css"
import "./app.css"

const target = document.getElementById("app")
if (target === null) throw new Error("playground: #app is missing")

export default mount(App, { target })
