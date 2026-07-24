export const byId = (id: string) => {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLElement)) throw new Error(`Missing #${id}`)
  return element
}
